"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AudioLines,
  Check,
  ChevronLeft,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clearOutlineDraftFromSession,
  OUTLINE_FLAG_PARAM,
  readOutlineDraftSession,
} from "@/lib/outline-session";
import {
  collectionPathOptions,
  confidentialityLevelOptions,
  interviewScenarioOptions,
  privacyLevelOptions,
  redactionRuleOptions,
} from "@/lib/oral-history";
import type { StoredOutlineSession } from "@/lib/types/outline";
import type {
  CollectionPath,
  ConfidentialityLevel,
  InterviewScenario,
  PrivacyLevel,
  RedactionRule,
} from "@/lib/types/project";
import { useProjectWorkspaceStore } from "@/store/project-workspace";
import { useAuth } from "@/hooks/useAuth";

const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,audio/*";
// 与 src/lib/server/upload-store.ts 的 100MB 业务上限同口径（那边是既有实现，本批不动）：
// 选文件时就挡一道，超限文件不必白跑一次 multipart 上传才被拒。
const maxAudioBytes = 100 * 1024 * 1024;
const defaultRules: RedactionRule[] = [
  "phone",
  "id_card",
  "address",
  "contact_account",
];

// 讯飞转写 language 参数取值（方言识别）
const languageOptions = [
  { value: "cn", label: "普通话" },
  { value: "en", label: "英语" },
  { value: "cn_cantonese", label: "粤语" },
  { value: "cn_sichuan", label: "四川话" },
  { value: "cn_shanghai", label: "上海话" },
  { value: "cn_henanese", label: "河南话" },
];

// 只在带标记位时读 sessionStorage。没有标记位一律返回 null，
// 保证直接进 /upload 不会被上一次的提纲串味。
function readInitialOutlineDraft(hasOutlineFlag: boolean): StoredOutlineSession | null {
  if (!hasOutlineFlag || typeof window === "undefined") {
    return null;
  }

  return readOutlineDraftSession();
}

type WizardStep = 1 | 2 | 3;

const wizardSteps: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: "基础信息" },
  { step: 2, label: "采集路径" },
  { step: 3, label: "音频与提交" },
];

// REQ-24 §4.3：新版分支底栏「返回上一步」的落点 —— 新建流程的分流步。
// 用常量而非内联字面量：探针 J2/J3 与访谈页（同名常量，各自文件内声明）按同一字符串断言。
// 必须是真实 a[href]（Link，不是 Button + router.push）—— 中键新开、无 JS 兜底、
// href 属性可断言，且历史栈语义确定（不用 router.back()，见 PRD §4.3）。
const ROUTE_STEP_HREF = "/projects/new?step=route";

// UI-06 v2：知情同意弹窗 3 处文案 ＋《个人信息处理说明》全文常量。
// 全部走常量而非内联字面量 —— 与 ROUTE_STEP_HREF（:88-91）同一理由：
// 文案一旦内联进 JSX，「换行 ＋ 缩进」会被折叠成一个空格（可能凭空造出
// 带空格的斜杠字面），且逐字定稿无法被脚本按「整行相等」核验。
// 改任一字面，必须同批改：docs/PRD_UI-06_知情同意弹窗.md §4 ＋ 本单 §0.6
// ＋ 3 支探针（本单 §1.2-1.4；授权行见 §0.4 A8）。
const CONSENT_BODY_1 =
  "平台将通过云端技术服务，对您本次录制或上传的口述资料进行智能转写、要素标引与校订脱敏，并为您提供资料保存与检索服务。";
const CONSENT_BODY_2 =
  "平台仅在您授权的范围内处理与使用资料，通过访问权限控制与脱敏处理保护个人信息。如需将资料用于公开展示、图书出版、网络传播等用途，平台将另行征求您的同意。资料保存期限、云端处理情况及撤回同意、更正与删除的申请方式，详见《个人信息处理说明》。";
const CONSENT_TICK =
  "我已阅读并理解《个人信息处理说明》，同意平台按上述目的与方式处理本次口述资料。";
const CONSENT_BUTTON_LABEL = "同意并继续";

type ConsentDocBlock =
  | { kind: "title" | "h1" | "h2" | "p"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

// 《个人信息处理说明》（更新/生效日期 2026年10月8日）逐字全文，73 块 ＝
// Title 1 ＋ 章标题 9（h1 → <h3>）＋ 小节标题 6（h2 → <h4>）＋ 正文段 52 ＋ 表格 5。
// 纯文本 4,124 字符（正文段 2,704 ＋ 表格单元格 1,420）。
// docx 的 5 个官方链接以 HYPERLINK 字段码存在 ⇒ 此处只有链接标签文字、无 URL（PRD §4.2）。
const CONSENT_DOC_BLOCKS: ConsentDocBlock[] = [
  { kind: "title", text: "个人信息处理说明" },
  { kind: "p", text: "更新日期：2026年10月8日" },
  { kind: "p", text: "生效日期：2026年10月8日" },
  { kind: "p", text: "“记忆引擎”平台提供口述采集、智能转写、要素标引、校订脱敏、资料检索与成果转化服务。本说明介绍个人信息的处理范围、云端服务、保存规则与权利申请方式。" },
  { kind: "h1", text: "处理主体" },
  { kind: "p", text: "平台运营主体：复旦大学“记忆引擎”智述时光项目组" },
  { kind: "p", text: "联系电话：17376590989" },
  { kind: "p", text: "联系地址：上海市杨浦区邯郸路220号" },
  { kind: "p", text: "您可以通过上述电话联系我们，咨询资料处理规则，或提出查阅、复制、更正、删除与撤回同意的申请。" },
  { kind: "h1", text: "处理的信息" },
  { kind: "p", text: "平台根据您选择的服务，处理以下信息：" },
  { kind: "table", head: ["信息类别", "具体内容"], rows: [
    ["口述资料", "本次录制或上传的音视频、文字与补充材料，以及其中涉及的人物经历、家庭关系、工作经历等信息"],
    ["整理成果", "转写稿、校订稿、时间戳、要素标引、检索索引与经授权形成的转化成果"],
    ["项目信息", "项目名称、访谈主题、成果用途、授权范围与保存期限"],
    ["服务记录", "处理进度、修改记录、审核记录、授权变更与必要的操作日志"],
  ] },
  { kind: "p", text: "平台按照具体服务需要处理信息。您可以根据记录目的选择使用真实姓名、化名或隐去姓名，减少提交与本次服务无关的个人信息。" },
  { kind: "h1", text: "处理目的与方式" },
  { kind: "p", text: "口述采集：根据您的操作录制音视频，或接收您上传的口述资料。" },
  { kind: "p", text: "智能转写：将语音转写为文字，形成时间戳、文本分段与说话人区分等信息。" },
  { kind: "p", text: "要素标引：识别与整理时间、地点、人物、事件、机构与主题，便于资料查考。" },
  { kind: "p", text: "校订脱敏：辅助标记转写疑点、存疑信息与敏感内容，按服务约定开展人工校订、复核与脱敏处理。" },
  { kind: "p", text: "资料检索：在授权范围内提供分类浏览、关键词检索、全文检索、语义检索与内容定位。" },
  { kind: "p", text: "成果转化：根据您的需求与授权，将整理后的资料转化为回忆录、口述史编研稿、展览文本、视频脚本与音频故事等成果。" },
  { kind: "p", text: "AI处理结果可能存在错误、遗漏或表达偏差。涉及人名、地名、时间、事件与敏感内容的结果，应结合原始资料核对；听辨不清或尚未核实的内容保留说明。" },
  { kind: "h1", text: "云端技术服务" },
  { kind: "p", text: "平台使用阿里云技术服务完成语音识别、文本处理、向量检索、资料存储与应用运行。调用时，仅传输完成对应任务所需的信息。" },
  { kind: "h2", text: "服务提供方及产品" },
  { kind: "table", head: ["处理用途", "服务提供方及产品", "涉及信息"], rows: [
    ["语音识别", "阿里云百炼：Paraformer-v2、Paraformer-realtime-v2", "待转写音频、实时语音与必要的识别参数"],
    ["语音合成", "阿里云百炼：CosyVoice-v2", "需要播报的访谈提问与提示文本"],
    ["文本处理", "阿里云百炼：通义千问Qwen-Plus", "待整理文字、必要的上下文与处理指令"],
    ["向量生成", "阿里云百炼：text-embedding-v4", "用于建立检索索引的文本片段与检索问题"],
    ["向量检索", "阿里云向量检索服务DashVector", "文本向量、资料编号、必要的标引字段与检索条件"],
    ["存储备份", "阿里云对象存储OSS", "原始音视频、整理文稿、转化成果与备份资料"],
    ["应用运行", "阿里云云服务器ECS", "项目信息、处理任务、权限设置与必要的运行日志"],
  ] },
  { kind: "p", text: "语音合成用于播报提问与提示，采用服务商提供的声音，不以本次口述资料开展声音克隆。" },
  { kind: "p", text: "科大讯飞为可研报告中的语音识别备选服务。正式启用前，平台将补充具体产品、处理范围与相关说明，并告知您。" },
  { kind: "h2", text: "服务条款与保存规则" },
  { kind: "table", head: ["服务产品", "保存与处理规则", "官方说明"], rows: [
    ["阿里云百炼", "根据法律法规留存模型与应用调用数据；业务数据的处理、删除与服务终止后的保留，按服务协议执行。平台使用模型API开展处理，不将资料提交至个人聊天产品", "阿里云百炼服务协议、合规资质与隐私说明"],
    ["DashVector", "按平台指令保存、修改与删除检索数据；释放服务、终止服务或欠费后的数据处理，按协议及产品缓冲期规则执行", "阿里云向量检索服务协议"],
    ["OSS", "保存期限由平台设置的存储规则控制。删除资料时，同步处理相应历史版本与备份，避免仅删除当前版本而继续保留旧版本", "对象存储OSS服务协议"],
    ["ECS", "应用数据与系统备份由平台管理；服务终止、实例释放与数据清理按云服务器协议及相应产品规则执行", "阿里云云服务器服务协议"],
  ] },
  { kind: "p", text: "平台保存期限与服务商依法留存调用记录的期限分别管理。平台办理删除时，将清理自主管理的资料，并向受托服务商提出适用的删除要求；依法需要保留的记录，按相应规则限制使用。" },
  { kind: "h2", text: "模型训练" },
  { kind: "p", text: "本次授权用于口述资料处理与约定的保存服务，不包含模型训练。" },
  { kind: "p", text: "平台不将您的原始音视频、未公开文稿与个人信息用于模型训练。依据阿里云百炼现行服务协议，服务商不得未经授权将客户业务数据用于模型训练。建立文本向量与检索索引，是为了完成本项目资料检索，不属于模型训练。" },
  { kind: "p", text: "后续如开展模型训练，平台将另行说明资料范围、训练用途、参与方与保存规则，并依法取得相应授权。" },
  { kind: "h1", text: "敏感信息与他人资料" },
  { kind: "p", text: "口述资料可能涉及医疗健康、宗教信仰、金融账户、行踪轨迹等敏感个人信息。确需处理此类信息时，平台将说明处理的必要性与对个人权益的影响，并依法取得单独同意。" },
  { kind: "p", text: "您可以跳过有关问题、暂停录制或结束访谈。敏感内容的处理与公开范围，可以分别选择。" },
  { kind: "p", text: "您代他人录制或上传资料时，应向受访者说明录音、云端处理、整理用途与保存规则，并取得相应授权。涉及第三方个人信息的内容，平台将核查使用依据，根据需要限制利用或进行脱敏处理。" },
  { kind: "p", text: "涉及不满十四周岁未成年人的个人信息，平台将在处理前征得监护人同意，并提供相应的处理说明。" },
  { kind: "h1", text: "资料使用与公开" },
  { kind: "p", text: "原始资料与整理成果按项目管理，仅向具有相应权限的用户与工作人员开放。人工校订人员根据任务需要访问资料，并承担保密义务。" },
  { kind: "p", text: "公开展示、图书出版、网络传播，以及向档案、文旅、教育等机构提供可识别个人身份的资料，须具有对应的授权或其他合法依据。平台将明确使用目的、接收方、资料范围、署名方式与使用期限。" },
  { kind: "p", text: "脱敏处理用于降低身份识别与隐私泄露风险，不代替公开授权。声音、影像与叙述细节仍可能识别个人，公开前需结合具体内容复核。" },
  { kind: "h1", text: "资料保存与保护" },
  { kind: "h2", text: "存储地域" },
  { kind: "p", text: "平台云端服务采用中国境内的华北2（北京）地域，原始资料与整理成果存储于该地域的OSS，检索数据存储于DashVector，应用运行使用ECS。异地备份限定在中国境内。" },
  { kind: "p", text: "平台使用境内模型服务接口。本服务不安排个人信息出境；后续如需变更，将另行履行告知与相应程序。" },
  { kind: "h2", text: "保存期限" },
  { kind: "p", text: "资料保存以授权目的与必要期限为依据。您可以选择保存服务、申请较短期限或提前删除资料。" },
  { kind: "table", head: ["保存类别", "保存期限", "适用范围与起算方式"], rows: [
    ["基础保存", "3年", "个人、家庭与一般机构选择基础保存服务的资料，自成果确认或项目验收之日起计算"],
    ["延长保存", "5年", "需要持续补充、查考或再次利用的资料，经确认选择延长保存服务后，自成果确认或项目验收之日起计算"],
    ["项目保存", "10年", "具有持续查考需求的机构项目资料，经书面约定保存范围与期限后，自项目验收之日起计算"],
    ["过程资料", "项目结束后30日内清理", "临时音频片段、中间文件与无保留必要的重复稿件；具有校订或审核依据价值的版本随项目资料保存"],
    ["授权记录", "保存服务期间及结束后3年", "保存证明授权范围、变更情况与申请处理结果所需的最少信息"],
    ["安全日志", "至少6个月", "用于安全排查的访问与操作记录；法律法规要求更长期限的，按相应要求执行"],
    ["备份资料", "随主资料期限管理", "主资料删除后停止日常访问，在30日内完成平台自主管理备份中的清理；依法需要保留的除外"],
  ] },
  { kind: "p", text: "3年、5年与10年为平台提供的保存服务期限，并非对全部口述史料统一规定的档案保管期限。" },
  { kind: "p", text: "需正式归档的口述史料，由委托单位依据《口述史料采集与管理规范》及本单位制度，确定永久、30年或10年的保管期限。平台按约定完成移交；需要继续托管的，另行明确保存责任与服务期限。" },
  { kind: "p", text: "订阅服务到期后，平台提供30日资料导出期。您可以续订或选择单独的保存服务；未继续选择服务的，平台在导出期结束后按上述规则清理资料。" },
  { kind: "p", text: "保存期满前30日，平台提醒您办理导出、续期或移交。处理目的已经完成、授权撤回或依法应当删除时，平台按申请与法律要求提前处理。" },
  { kind: "h2", text: "安全措施" },
  { kind: "p", text: "平台按照可研报告的安全方案设置以下措施：" },
  { kind: "p", text: "传输保护：平台访问与云端调用使用HTTPS/TLS加密传输；资料下载使用限时授权链接。" },
  { kind: "p", text: "加密存储：原始音视频、整理文稿与备份资料启用存储加密，原始资料保留只读副本，校订过程保留版本记录。" },
  { kind: "p", text: "访问权限：按项目与岗位分配权限，人工审核人员仅访问承担任务所需的资料；管理账号与技术密钥分别管理。" },
  { kind: "p", text: "项目隔离：通过独立的资料目录、项目标识与检索权限，限制不同项目之间的资料访问。" },
  { kind: "p", text: "操作日志：记录访问、编辑、导出、删除与授权变更，限制日志访问范围，避免写入完整口述内容与无关敏感信息。" },
  { kind: "p", text: "资料备份：开展每日增量备份与每周完整备份，设置境内异地备份，定期检查备份完整性与恢复能力。" },
  { kind: "p", text: "发生或可能发生资料泄露、损毁、丢失时，平台将立即采取补救措施，核实影响范围，并依法履行通知与报告义务。" },
  { kind: "h1", text: "您的信息管理权利" },
  { kind: "p", text: "您可以通过项目页面的文本编辑、成果导出、授权管理与资料删除功能管理资料，也可以拨打17376590989提出申请。" },
  { kind: "table", head: ["申请事项", "办理方式"], rows: [
    ["查阅复制", "在项目页面查阅资料，通过成果导出获取相应副本；原始资料副本可联系项目组申请"],
    ["更正补充", "通过文本编辑补充或修改内容；需保留原始记录的，采用校订与说明方式处理"],
    ["撤回同意", "在授权管理中提交撤回申请，或电话说明需要撤回的处理事项与使用范围"],
    ["删除资料", "在项目页面提出资料删除申请，或联系项目组办理"],
    ["咨询投诉", "通过联系电话咨询处理规则，提出异议或投诉"],
  ] },
  { kind: "p", text: "受访者即使未注册平台账号，也可以通过联系电话提出有关本人信息的申请。平台仅核验确认申请人身份与资料关联所需的信息。" },
  { kind: "p", text: "平台在收到申请并完成必要身份核验后，于15个工作日内完成处理并反馈结果。无法按申请办理的，将说明具体原因与处理依据。" },
  { kind: "p", text: "撤回同意不影响撤回前基于同意开展的合法处理。撤回后，平台停止相应处理；如影响转写、检索或保存服务，将告知受影响的功能。" },
  { kind: "p", text: "依法仍需保存，或技术上暂时难以删除的信息，平台将限制为必要的存储与安全保护，并说明保留依据及后续处理安排。" },
  { kind: "h1", text: "说明更新" },
  { kind: "p", text: "服务提供方、处理目的、信息范围、保存规则或权利申请方式发生变化时，平台将更新本说明，并通过平台提示或项目联系方式告知您。" },
  { kind: "p", text: "需要重新取得同意的变更，将在取得相应同意后实施。更新本说明不自动扩大您原有的授权范围。" },
];

// 知情同意弹窗：创建项目的唯一闸口，用户点「我确认」之后才真正发起创建。
// 不做任何本地记忆 —— 每次点「创建项目」都重新弹，并重置勾选态。
function ConsentDialog({
  open,
  checked,
  onCheckedChange,
  onConfirm,
  onCancel,
  docOpen,
  onDocOpenChange,
}: {
  open: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  docOpen: boolean;
  onDocOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  // 必须挂到 body：本组件嵌在 .paper-panel 之内（根元素是 :451 的
  // `<section className="archive-frame paper-panel paper-panel-strong …">`），而 .paper-panel
  // 会从两处破坏 fixed ——
  // (1) backdrop-filter: blur(24px)（globals.css:104）让面板成为 fixed 后代的包含块，
  //     遮罩于是相对面板而非视口定位；
  // (2) 未分层的 `.paper-panel > * { position: relative }`（globals.css:125）直接压掉
  //     Tailwind 的 .fixed —— 后者在 @layer utilities 里，未分层正常声明恒胜过分层声明。
  // 实测后果：遮罩的计算样式是 relative，inset-0 失效，它退回文档流堆在卡片页脚之后，
  // 再被 .paper-panel 的 overflow: hidden 裁掉 —— 就是「弹窗出现在页面底部而非覆盖全屏」。
  // 挂到 body 一次摆脱这两个问题。同一手术见 route-chooser.tsx:56-65（R5）。
  return createPortal(
    <div
      data-upload-modal="consent"
      className="fixed inset-0 z-[70] bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px]"
      onClick={onCancel}
    >
      <div className="flex h-full flex-col items-center justify-center p-3 sm:p-5">
        {/* stopPropagation 必须挂在卡片上，不能挂上面那层包裹 div —— 它是 flex h-full，
            铺满整个遮罩，挂它上面会把「点遮罩关闭」整个吃掉（R5 实测：点 (6,6) 无效）。
            点遮罩只当取消、不提交 —— 与弹窗里那个「取消」按钮同义。 */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-dialog-title"
          onClick={(event) => event.stopPropagation()}
          className="paper-panel paper-panel-strong flex w-full max-w-xl flex-col rounded-[2rem] px-4 py-5 md:px-6 md:py-6"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <p className="section-eyebrow">知情同意确认</p>
          </div>

          <h2
            id="consent-dialog-title"
            className="font-display mt-2 text-[1.5rem] font-semibold text-accent-strong"
          >
            知情同意书
          </h2>

          <div className="soft-scroll mt-3 max-h-[min(55vh,24rem)] overflow-y-auto pr-2 text-sm leading-7 text-muted">
            <p data-ui06-part="body1">{CONSENT_BODY_1}</p>
            <p data-ui06-part="body2" className="mt-2.5">{CONSENT_BODY_2}</p>

            <button
              type="button"
              data-ui06-toggle=""
              aria-expanded={docOpen}
              aria-controls="ui06-consent-doc"
              onClick={() => onDocOpenChange(!docOpen)}
              className="mt-3 flex w-full items-center gap-1.5 rounded-[0.9rem] px-1 py-1 text-left text-xs font-medium text-accent-strong transition-colors"
            >
              <span aria-hidden="true">{docOpen ? "▼" : "▶"}</span>
              <span className="underline decoration-dotted underline-offset-4">个人信息处理说明</span>
            </button>

            {docOpen ? (
              <div
                id="ui06-consent-doc"
                data-ui06-doc=""
                className="ui06-doc mt-2.5 max-h-[240px] overflow-y-auto rounded-[0.9rem] border border-line/70 bg-white/55 px-3 py-2.5 text-xs leading-6 text-muted"
              >
                {CONSENT_DOC_BLOCKS.map((block, index) => {
                  if (block.kind === "table") {
                    return (
                      <table key={`t${index}`} className="mt-2 w-full border-collapse text-left">
                        <thead>
                          <tr>
                            {block.head.map((cell, cellIndex) => (
                              <th key={`h${cellIndex}`} className="border border-line/60 px-2 py-1 font-medium text-foreground">
                                {cell}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rowIndex) => (
                            <tr key={`r${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <td key={`c${cellIndex}`} className="border border-line/60 px-2 py-1 align-top">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  }

                  if (block.kind === "h1") {
                    return (
                      <h3 key={`h${index}`} className="mt-3 font-semibold text-foreground">{block.text}</h3>
                    );
                  }

                  if (block.kind === "h2") {
                    return (
                      <h4 key={`s${index}`} className="mt-2 font-medium text-foreground">{block.text}</h4>
                    );
                  }

                  if (block.kind === "title") {
                    return (
                      <p key={`t${index}`} className="text-sm font-semibold text-foreground">{block.text}</p>
                    );
                  }

                  return <p key={`p${index}`} className="mt-1.5">{block.text}</p>;
                })}
              </div>
            ) : null}
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[1.15rem] border border-emerald-500/30 bg-white/60 p-3.5 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
              checked={checked}
              onChange={(event) => onCheckedChange(event.target.checked)}
            />
            <span>
              {CONSENT_TICK}
            </span>
          </label>

          {!checked ? (
            <p className="mt-2.5 text-xs leading-5 text-muted">
              请先勾选知情同意
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-center sm:w-auto"
              onClick={onCancel}
            >
              取消
            </Button>
            <Button
              type="button"
              className="w-full justify-center sm:w-auto sm:min-w-[140px]"
              disabled={!checked}
              onClick={onConfirm}
            >
              {CONSENT_BUTTON_LABEL}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function InterviewUploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createProject = useProjectWorkspaceStore((state) => state.createProject);
  const isSubmitting = useProjectWorkspaceStore((state) => state.isSubmitting);

  // 提纲草稿由 /projects/new/outline 带来：URL 只带 ?outline=1 标记位，提纲全文与画像都在 sessionStorage。
  // 读取放在惰性初始化里而不是 effect 里 —— 同步 setState 的 effect 会触发级联渲染（lint 会报）。
  // 这个子树不会 SSR：useSearchParams 让它在最近的 Suspense 边界内退化成客户端渲染，
  // 所以首帧就能拿到草稿；typeof window 守卫只是防它以后变成动态渲染。
  // 只读一次、六个字段都从它派生 —— 之前 markdown 和展开态各读了一次 sessionStorage。
  const hasOutlineFlag = searchParams.get(OUTLINE_FLAG_PARAM) === "1";
  const [prefill] = useState(() => readInitialOutlineDraft(hasOutlineFlag));

  // REQ-21 §5.2：基本信息已由新建流程写入草稿的 projectName / intervieweeName，
  // 两项齐了才称得上「从新建流程进来」；缺任一（老书签、手写 URL、清过 sessionStorage）
  // 都维持从步骤一开始，不再要求重复填写。
  const draftReady = Boolean(
    prefill?.profile.projectName && prefill?.profile.intervieweeName,
  );
  // REQ-24 §4.1：新版分支（分流支路）的唯一开关 = 「带标记位」且「草稿就绪」。
  // 必须同时要求标记位：裸 /upload、老书签、?outline=0 时 hasOutlineFlag 为 false，
  // 逐字走下面的原逻辑，旧版行为零变化。
  // 只看标记位不看草稿就绪会造出死路：必填字段没有 UI 可填，提交必被 validateStepOne 弹回
  // （PRD §4.1「反例防护」，规格而非实现细节）。
  const flowMode = hasOutlineFlag && draftReady;

  // REQ-24 §4.2：从分流步进来的用户，采集路径已在上一步选过（点的就是「上传音频」），
  // 画像也已在基本信息步填过，来路是新建流程的三步 —— 直接落到「音频与提交」：
  // 既不重填，也不再渲染步骤条（步骤条会让人以为还要走前两步）。
  const [step, setStep] = useState<WizardStep>(() => {
    if (flowMode) {
      return 3;
    }

    return draftReady ? 2 : 1;
  });

  // ── Step 1 基础信息 ──────────────────────────────────────
  const [projectName, setProjectName] = useState(
    () => prefill?.profile.projectName ?? "",
  );
  const [intervieweeName, setIntervieweeName] = useState(
    () => prefill?.profile.intervieweeName ?? "",
  );
  const [collectionScenario, setCollectionScenario] =
    useState<InterviewScenario>(
      // normalizer 已经做过白名单，这里拿到的必定是合法枚举。
      () => prefill?.profile.collectionScenario ?? "urban_memory",
    );
  // profile 里没有「自定义场景名」，所以提纲页选了 custom 的话这里补不了，
  // 由 Step 1 的校验提示用户填 —— 属预期行为。
  const [customScenarioLabel, setCustomScenarioLabel] = useState("");
  // 默认「内部」：新建流程的画像里没有这个字段，从分流步直落步骤三的用户看不到步骤一的
  // 单选控件，若初值仍是 null，validateStepOne() 会把他们弹回步骤一（本批修的就是这个）。
  // "internal" 是本页既有的默认档 —— confidentialityLevelOptions 里它的 description 就写着
  // 「默认级别。」，getConfidentialityLevelLabel 的兜底也是 ?? "internal"。
  // 类型保留 | null 是有意的：validateStepOne() 的保守卫与提交前那道 `=== null` 因此零改动。
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<ConfidentialityLevel | null>("internal");
  const [notes, setNotes] = useState(() => prefill?.profile.notes ?? "");

  // ── Step 1 高级设置 ──────────────────────────────────────
  const [institutionName, setInstitutionName] = useState(
    () => prefill?.profile.institutionName ?? "",
  );
  const [researchFocus, setResearchFocus] = useState(
    () => prefill?.profile.researchFocus ?? "",
  );
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("standard");
  const [customRedactionRules, setCustomRedactionRules] =
    useState<RedactionRule[]>(defaultRules);

  // ── Step 2 采集路径 ──────────────────────────────────────
  const [collectionPath, setCollectionPath] = useState<CollectionPath>("upload");

  // ── Step 3 音频与提交 ────────────────────────────────────
  const [language, setLanguage] = useState("cn");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  // 弹窗开关：Step 3 点「创建项目」时才开，关闭即作废，不落任何存储。
  const [consentOpen, setConsentOpen] = useState(false);
  // 展开态受控：与勾选态同址复位，保证每次重弹都是收起态（UI-06 PRD §4.5 第 4 条）。
  const [consentDocOpen, setConsentDocOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [outlineDraftMarkdown, setOutlineDraftMarkdown] = useState(
    () => prefill?.outlineMarkdown ?? "",
  );
  // 带草稿进来时默认展开折叠区，否则草稿藏在 <details> 里，用户会以为没预填。
  const [outlineDetailsOpen, setOutlineDetailsOpen] = useState(
    () => Boolean(prefill?.outlineMarkdown.trim()),
  );
  // 同理：机构/研究焦点预填了却折叠着，用户会以为没填。初值直接看 prefill，
  // 不看上面那两个 state —— 免得依赖「字段 state 必须先声明」这种隐式次序。
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    Boolean(prefill?.profile.institutionName || prefill?.profile.researchFocus),
  );

  useEffect(() => {
    // 没有标记位就清掉残留草稿，避免上一次的提纲串进这次上传。
    // 这里只写外部存储、不 setState，正是 effect 该干的事。
    if (!hasOutlineFlag) {
      clearOutlineDraftFromSession();
    }
  }, [hasOutlineFlag]);

  const helperText = useMemo(() => {
    if (!audioFile) {
      return "";
    }

    const sizeInMb = (audioFile.size / 1024 / 1024).toFixed(2);
    return `已选择：${audioFile.name}，${sizeInMb} MB`;
  }, [audioFile]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && nextFile.size > maxAudioBytes) {
      // 提示文案与服务端的拒收提示同口径，用户看到的是同一句话。
      setAudioFile(null);
      setError("演示版本建议上传 100MB 以内的音频文件。");
      // 清掉原生 input：否则再选同一个超限文件不会触发 change，用户会以为按钮坏了。
      event.target.value = "";
      return;
    }

    setAudioFile(nextFile);
    setError(null);
  }

  function toggleRedactionRule(rule: RedactionRule) {
    setCustomRedactionRules((current) =>
      current.includes(rule)
        ? current.filter((item) => item !== rule)
        : [...current, rule],
    );
  }

  function validateStepOne(): string | null {
    if (!projectName.trim()) {
      return "请填写口述项目名称。";
    }

    if (!intervieweeName.trim()) {
      return "请填写受访对象姓名。";
    }

    if (collectionScenario === "custom" && !customScenarioLabel.trim()) {
      return "选择自定义主题后，请填写具体口述场景。";
    }

    if (confidentialityLevel === null) {
      return "请选择保密级别。";
    }

    return null;
  }

  function goToStep(next: WizardStep) {
    setError(null);
    setStep(next);
  }

  function goNext() {
    if (step === 1) {
      const message = validateStepOne();

      if (message) {
        setError(message);
        return;
      }

      goToStep(2);
      return;
    }

    if (step === 2) {
      goToStep(3);
    }
  }

  function goBack() {
    if (step === 1) {
      return;
    }

    goToStep(step === 3 ? 2 : 1);
  }

  // REQ-24 §3.3（取代 REQ-21 / P3 口径）：新版分支（从分流步进来）不再渲染步骤条，
  // 页面里也就没有「上传页内部上一步」这个概念了 —— 传进去只会把人带回 upload 自己的
  // 步骤一，与用户来路（新建流程 basic → outline → route）再无关系。
  // 回退入口因此只有一个：底栏「返回上一步」→ /projects/new?step=route（见下方底栏区段）。
  // 旧版向导（裸 /upload、?outline=1 但草稿不就绪）逐字不变：step > 1 时「上一步」照常出现。

  async function submitProject() {
    if (!audioFile) {
      setError("请先选择一段受访音频。");
      return;
    }

    // 回退到 Step 1 让用户补齐；这里的 null 检查同时把类型收窄成 ConfidentialityLevel
    const stepOneError = validateStepOne();

    if (stepOneError || confidentialityLevel === null) {
      setError(stepOneError ?? "请选择保密级别。");
      setStep(1);
      return;
    }

    try {
      setError(null);

      const project = await createProject({
        audioFile,
        institutionName: institutionName.trim(),
        intervieweeName: intervieweeName.trim(),
        customScenarioLabel:
          collectionScenario === "custom" ? customScenarioLabel.trim() : "",
        notes: notes.trim(),
        outlineDraftMarkdown: outlineDraftMarkdown.trim(),
        projectName: projectName.trim(),
        collectionScenario,
        researchFocus: researchFocus.trim(),
        privacyLevel,
        confidentialityLevel,
        collectionPath,
        customRedactionRules,
        language,
      });

      // 草稿已经进了项目档案，清掉 sessionStorage 里的副本，避免下次上传串味。
      clearOutlineDraftFromSession();

      // 注意：这里不要加 router.refresh()——与 push 同 tick 调用会吞掉跳转
      router.push(`/projects/${project.id}?autostart=1`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "上传失败，请稍后重试。",
      );
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < 3) {
      goNext();
      return;
    }

    // 每次创建都重新确认：先重置勾选态并弹窗，确认后才真正创建。
    setConsentChecked(false);
    setConsentDocOpen(false);
    setConsentOpen(true);
  }

  function handleConsentConfirm() {
    setConsentOpen(false);
    void submitProject();
  }

  function handleConsentCancel() {
    setConsentOpen(false);
  }

  // 认证状态未就绪 → 占位，避免首帧落到完整表单
  if (loading) {
    return (
      <section className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] p-5 md:p-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
        <div className="surface-card rounded-[1.4rem] p-5 text-sm text-muted">
          正在加载表单…
        </div>
      </section>
    );
  }

  return (
    <section
      className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] p-5 md:p-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col"
      data-upload-flow={flowMode ? "from-route" : undefined}
    >
      <form
        className="mt-1 flex flex-col gap-4 xl:min-h-0 xl:flex-1"
        onSubmit={handleFormSubmit}
      >
        {/* 步骤条：仅支持回退，前进必须走「下一步」校验。
            REQ-24 §4.2：新版分支（从分流步进来）不渲染它 —— 「01/02/03」会让人以为
            还要填前两步，而那两步在分流支路里已经走过；判据是「不在 DOM」，
            不是隐藏（hidden / sr-only / disabled 均不合规）。 */}
        {flowMode ? null : (
          <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {wizardSteps.map(({ step: stepNumber, label }) => {
              const isCurrent = step === stepNumber;
              const isDone = step > stepNumber;
              const canGoBack = stepNumber < step;

              return (
                <li key={stepNumber} className="min-w-0 sm:flex-1">
                  <button
                    type="button"
                    disabled={!canGoBack}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => goToStep(stepNumber)}
                    className={`flex w-full items-center gap-2 rounded-[1rem] border px-3 py-2 text-left text-sm transition-colors ${
                      isCurrent
                        ? "border-accent-soft bg-accent-soft/70 text-accent-strong"
                        : isDone
                          ? "border-line/80 bg-white/70 text-foreground"
                          : "border-line/60 bg-white/40 text-muted"
                    } ${canGoBack ? "cursor-pointer hover:border-accent-soft" : "cursor-default"}`}
                  >
                    <span className="text-[11px] font-semibold tracking-[0.18em]">
                      {String(stepNumber).padStart(2, "0")}
                    </span>
                    <span className="truncate font-semibold">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="soft-scroll space-y-4 pr-1 xl:min-h-0 xl:flex-1 xl:overflow-auto">
          {step === 1 ? (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="xl:col-span-2">
                  <label className="field-label" htmlFor="projectName">
                    口述项目名称
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    id="projectName"
                    className="text-field"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="例如：上海老城厢口述访谈"
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="intervieweeName">
                    受访对象姓名
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    id="intervieweeName"
                    className="text-field"
                    value={intervieweeName}
                    onChange={(event) => setIntervieweeName(event.target.value)}
                    placeholder="例如：王阿婆"
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="collectionScenario">
                    采集场景
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <select
                    id="collectionScenario"
                    className="text-field"
                    value={collectionScenario}
                    onChange={(event) =>
                      setCollectionScenario(
                        event.target.value as InterviewScenario,
                      )
                    }
                  >
                    {interviewScenarioOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 自定义主题是 custom 场景的必填项，就地展开而不藏进折叠区，
                    否则校验错误会被折叠区挡住 */}
                {collectionScenario === "custom" ? (
                  <div className="xl:col-span-2">
                    <label className="field-label" htmlFor="customScenarioLabel">
                      自定义口述主题
                      <span className="ml-1 text-red-500">*</span>
                    </label>
                    <input
                      id="customScenarioLabel"
                      className="text-field"
                      value={customScenarioLabel}
                      onChange={(event) =>
                        setCustomScenarioLabel(event.target.value)
                      }
                      placeholder="例如：双王街道老城厢生活变迁"
                    />
                  </div>
                ) : null}
              </div>

              <div className="surface-card rounded-[1.55rem] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="section-eyebrow">
                      保密级别
                      <span className="ml-1 text-red-500">*</span>
                    </p>
                    <h3 className="mt-1.5 text-base font-semibold text-foreground">
                      档案可见范围
                    </h3>
                  </div>
                  <div className="tape-label">Confidentiality</div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {confidentialityLevelOptions.map((option) => {
                    const isActive = confidentialityLevel === option.value;

                    return (
                      <label
                        key={option.value}
                        className={`relative rounded-[1.1rem] border py-3 pl-4 pr-8 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent-strong/40 ${
                          isActive
                            ? "border-accent-strong bg-accent-soft/70 text-accent-strong"
                            : "border-line/80 bg-white/55 text-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="confidentialityLevel"
                          className="sr-only"
                          checked={isActive}
                          onChange={() =>
                            setConfidentialityLevel(option.value)
                          }
                        />
                        <span className="font-semibold">{option.label}</span>
                        <span className="mt-1.5 block text-xs leading-5">
                          {option.description}
                        </span>
                        {isActive ? (
                          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-strong text-white">
                            <Check
                              aria-hidden
                              className="h-3 w-3"
                              strokeWidth={3}
                            />
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="notes">
                  项目说明
                </label>
                <textarea
                  id="notes"
                  className="text-area min-h-[7rem]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="补充本次口述采集的背景、访谈风格、需要重点照顾的伦理风险等。"
                />
              </div>

              <details
                className="surface-card rounded-[1.55rem] p-4"
                open={outlineDetailsOpen}
                onToggle={(event) =>
                  setOutlineDetailsOpen(event.currentTarget.open)
                }
              >
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  访谈提纲（选填）
                </summary>
                <p className="mt-2 text-xs leading-5 text-muted">
                  可粘贴或手写本次访谈提纲，提交后会写入项目档案，并出现在导出的「访谈提纲草稿」一节。
                </p>
                <textarea
                  id="outlineDraftMarkdown"
                  className="text-area mt-3 min-h-[9rem]"
                  value={outlineDraftMarkdown}
                  onChange={(event) =>
                    setOutlineDraftMarkdown(event.target.value)
                  }
                  placeholder="例如：一、童年与家庭；二、迁居经历；三、街区变迁……"
                />
              </details>

              <details
                className="surface-card rounded-[1.55rem] p-4"
                open={advancedOpen}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              >
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  高级设置（选填）
                </summary>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="institutionName">
                      整理机构
                    </label>
                    <input
                      id="institutionName"
                      className="text-field"
                      value={institutionName}
                      onChange={(event) =>
                        setInstitutionName(event.target.value)
                      }
                      placeholder="例如：城市口述历史工作站"
                    />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="privacyLevel">
                      脱敏级别
                    </label>
                    <select
                      id="privacyLevel"
                      className="text-field"
                      value={privacyLevel}
                      onChange={(event) =>
                        setPrivacyLevel(event.target.value as PrivacyLevel)
                      }
                    >
                      {privacyLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="researchFocus">
                      研究焦点
                    </label>
                    <textarea
                      id="researchFocus"
                      className="text-area min-h-[7rem]"
                      value={researchFocus}
                      onChange={(event) =>
                        setResearchFocus(event.target.value)
                      }
                      placeholder="例如：关注街区生活、空间变迁、邻里关系与代际记忆。"
                    />
                  </div>
                </div>

                <div className="mt-4 border-t border-line/70 pt-4">
                  <p className="section-eyebrow">隐私保护</p>
                  <h3 className="mt-1.5 text-base font-semibold text-foreground">
                    自定义脱敏规则
                  </h3>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {redactionRuleOptions.map((option) => {
                      const isActive = customRedactionRules.includes(
                        option.value,
                      );

                      return (
                        <label
                          key={option.value}
                          className={`relative rounded-[1.1rem] border py-3 pl-4 pr-8 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent-strong/40 ${
                            isActive
                              ? "border-accent-strong bg-accent-soft/70 text-accent-strong"
                              : "border-line/80 bg-white/55 text-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isActive}
                            onChange={() => toggleRedactionRule(option.value)}
                          />
                          {option.label}
                          {isActive ? (
                            <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-strong text-white">
                              <Check
                                aria-hidden
                                className="h-3 w-3"
                                strokeWidth={3}
                              />
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>
            </>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {collectionPathOptions.map((option) => {
                const isDisabled = option.value === "ai_interview";
                const isActive = collectionPath === option.value;

                return (
                  <label
                    key={option.value}
                    className={`relative rounded-[1.4rem] border-2 p-5 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent-strong/40 ${
                      isDisabled
                        ? "cursor-not-allowed border-line/60 bg-white/40 text-muted/70"
                        : isActive
                          ? "cursor-pointer border-accent-strong bg-accent-soft/70 text-accent-strong"
                          : "cursor-pointer border-line/80 bg-white/55 text-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="collectionPath"
                      className="sr-only"
                      disabled={isDisabled}
                      checked={isActive}
                      onChange={() => setCollectionPath(option.value)}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold">{option.label}</span>
                      {isDisabled ? (
                        <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-muted">
                          即将开放
                        </span>
                      ) : isActive ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-strong text-white">
                          <Check
                            aria-hidden
                            className="h-3 w-3"
                            strokeWidth={3}
                          />
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-2 block text-xs leading-6">
                      {option.description}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <label className="field-label" htmlFor="language">
                  音频语言/方言
                </label>
                <select
                  id="language"
                  className="text-field"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="surface-card flex flex-col rounded-[1.55rem] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="mt-1.5 text-base font-semibold text-foreground">
                      上传音频
                    </h3>
                  </div>
                </div>

                <div className="relative mt-3 flex flex-1">
                  <button
                    type="button"
                    className="file-trigger min-h-[10rem] w-full text-left"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-deep text-white shadow-[0_16px_30px_rgba(30,55,55,0.2)]">
                        {audioFile ? (
                          <AudioLines className="h-6 w-6" />
                        ) : (
                          <UploadCloud className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground md:text-base">
                          {audioFile ? "更换受访音频" : "选择音频文件"}
                        </p>
                        {helperText ? (
                          <p className="mt-1.5 text-sm leading-6 text-muted">
                            {helperText}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept={acceptedAudioExtensions}
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-[1.4rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            {step === 1
              ? "带 * 的项为必填，完成后进入采集路径选择。"
              : step === 2
                ? "本轮仅开放本地上传，AI 访谈即将开放。"
                : "提交后开始处理"}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {flowMode ? (
              <Link
                href={ROUTE_STEP_HREF}
                data-upload-back="route-step"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-white/72 px-5 py-3 text-sm font-semibold tracking-[0.02em] text-accent-strong transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/92 sm:w-auto"
              >
                <ChevronLeft className="h-4 w-4" />
                返回上一步
              </Link>
            ) : step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center sm:w-auto"
                onClick={goBack}
              >
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="submit"
                className="w-full justify-center sm:w-auto sm:min-w-[160px]"
              >
                下一步
              </Button>
            ) : (
              <Button
                type="submit"
                className="w-full justify-center sm:w-auto sm:min-w-[220px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    上传中…
                  </>
                ) : (
                  <>
                    开始处理
                    <FileText className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>

      <ConsentDialog
        open={consentOpen}
        checked={consentChecked}
        onCheckedChange={setConsentChecked}
        onConfirm={handleConsentConfirm}
        onCancel={handleConsentCancel}
        docOpen={consentDocOpen}
        onDocOpenChange={setConsentDocOpen}
      />
    </section>
  );
}
