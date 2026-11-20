"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  BasicInfoForm,
  type BasicInfo,
} from "@/components/new-project/basic-info-form";
import { RouteChooser } from "@/components/new-project/route-chooser";
import { OutlinePlanWorkspace } from "@/components/outline/outline-plan-workspace";
import {
  WritingTemplateSelect,
  type WritingTemplateSelection,
} from "@/components/ui/writing-template-select";
import {
  readOutlineDraftSession,
  saveOutlineDraftToSession,
} from "@/lib/outline-session";

// 步骤 key 同时是 URL 的 step 值与 #new-step-* 锚点后缀（IMPL §3.3）。
// REQ-36：提纲是 AI 分访谈的准备工作，先让用户选采集方式（AI / 上传），
// 上传路径因此可整段跳过提纲步。
const NEW_PROJECT_STEPS = [
  { key: "basic", label: "基本信息" },
  { key: "route", label: "选择方式" },
  { key: "outline", label: "提纲" },
] as const;

type NewProjectStep = (typeof NEW_PROJECT_STEPS)[number]["key"];

// step 白名单：非法值一律回落 basic，避免被任意 query 影响渲染。
function normalizeStep(value: string | undefined): NewProjectStep {
  const matched = NEW_PROJECT_STEPS.find((item) => item.key === value);
  return matched ? matched.key : "basic";
}

const EMPTY_BASIC_INFO: BasicInfo = {
  projectName: "",
  intervieweeName: "",
  overview: "",
};

export function NewProjectFlow({ initialStep }: { initialStep?: string }) {
  const router = useRouter();
  // 初始步只取一次：之后由 state 主导，router.replace 触发的 RSC 重渲染不会把步骤弹回去。
  const [step, setStep] = useState<NewProjectStep>(() =>
    normalizeStep(initialStep),
  );
  // 基本信息只走 React state，不下沉 sessionStorage（IMPL §3.4）。
  // BUG-10：访谈页「返回上一步」是跨路由 <Link> → /projects/new?step=route
  // （interview-console.tsx:975-982），NewProjectFlow 会整棵重挂载；不读回就退回
  // EMPTY_BASIC_INFO ⇒ 分流页「AI 实时访谈」disabled、并冒出「请先回到上一步填写」。
  // 故只在分流步冷启动时从既有草稿读回一次（IMPL §6-Q1 取 B）：不扩大到 basic / outline，
  // 否则 ?step=outline 冷启动也会拿到初值，连带触发提纲步的 600ms 自动生成。
  //
  // BUG-16：读回**不得**发生在渲染期。本组件是 client component、仍参与 SSR，而 SSR 期
  // 读草稿必为空 ⇒ 服务端渲出 `disabled=""` ＋ 空态提示，客户端首帧却读到草稿渲出可点且
  // 无提示，两侧 HTML 不一致 ⇒ React 报 hydration 失败、丢弃服务端 HTML 整棵重渲染
  // （实测原文：Hydration failed because the server rendered HTML didn't match the client.，
  //   React 并直接点名 A server/client branch 「if (typeof window !== 'undefined')」这一形态。）
  // 现改为：两态都用 EMPTY_BASIC_INFO 起手（SSR / 客户端首帧产物一致），草稿在挂载后的
  // effect 里补进来（视觉上等价于「首帧空、随即回填」，不再有 mismatch）。
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(EMPTY_BASIC_INFO);
  // REQ-36 Q2：提纲种子。值只在「点 AI 实时访谈」这一下从草稿读一次，
  // 再作为 OutlinePlanWorkspace 的首帧初值下传（workspace 的 markdown 是 useState，
  // prop 只在首帧被消费，渲染期或 effect 后补都拿不到）。
  const [outlineSeed, setOutlineSeed] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [outlineError, setOutlineError] = useState("");
  // REQ-33：缺省「不套模板」= 不发送 writingTemplateKey。初值只能是空串 ——
  // 渲染期读 sessionStorage 会让首帧客户端与 SSR 不同值（BUG-16 hydration 陷阱）。
  const [writingTemplateKey, setWritingTemplateKey] =
    useState<WritingTemplateSelection>("");

  useEffect(() => {
    // 与 BUG-10 同范围：只在分流步冷启动回填（IMPL §6-Q1 取 B，不扩大到 basic）。
    // REQ-36 Q4：?step=outline 冷启动（刷新 / 直入 / 老书签 307 跳板）没有「已选 AI」
    // 这一前提，outline 已是 AI 分支的终局步 ⇒ 回填 basicInfo 后直接回 route 重选。
    if (initialStep !== "route" && initialStep !== "outline") {
      return;
    }

    const profile = readOutlineDraftSession()?.profile;

    if (profile) {
      setBasicInfo({
        projectName: profile.projectName ?? "",
        intervieweeName: profile.intervieweeName ?? "",
        overview: profile.notes ?? "",
      });
    }

    // 必须走 goToStep：它同时 setStep + router.replace。只 replace 不改本地 step，
    // 页面会停在 outline（见任务单 S1 / PRD Q4）。
    if (initialStep === "outline") {
      goToStep("route");
    }
    // 只在挂载时读回一次（与 BUG-10 懒初始化同语义）：initialStep 只是这一次性判定的输入，
    // 后续 RSC 重渲染带来的 prop 变化不该触发第二次回填，否则分流步往返时会拿草稿去盖
    // 用户刚在 state 里改的值。依赖数组故留空。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentIndex = NEW_PROJECT_STEPS.findIndex((item) => item.key === step);

  // 只写 URL、不读 useSearchParams —— 初始步由 server 传下来，
  // 因此本组件不需要 Suspense 包裹（对比 login / upload 两页的写法）。
  // 用 replace 是为了不把每一步都压进历史栈。
  function goToStep(next: NewProjectStep) {
    setStep(next);
    router.replace(`/projects/new?step=${next}`);
  }

  // 返回：basic 步是流程入口，回首页；其余步回上一步（route → basic，outline → route）。
  // 回退也走 goToStep（而不是裸 setStep）—— 它同时 router.replace 同步 URL，
  // 否则地址栏仍停在旧 step，一次刷新就被弹回原来的步骤。
  function handleBack() {
    if (step === "basic") {
      router.push("/");
      return;
    }
    goToStep(step === "route" ? "basic" : "route");
  }

  // REQ-21 §5.2：基本信息不是「只活在 React state」，点下一步时写进既有草稿。
  //
  // 必须先读再 merge：saveOutlineDraftToSession 是整体覆盖（outline-session.ts:155-161
  // 从 createEmptyOutlineSession() 起重建，messages 一并清零），直写会把提纲步
  // 已生成的对话与 institutionName / collectionScenario / researchFocus 全部抹掉。
  // 本仓库禁止扩展 src/lib/**（IMPL §7.1.3），所以 merge 只能在这层做。
  function persistBasicInfo(next: BasicInfo) {
    const existing = readOutlineDraftSession();

    // 冷启动直达 /projects/new?step=outline（老书签 → 307 跳板）时 basicInfo 仍是
    // EMPTY_BASIC_INFO，无条件写入会把提纲步刚写下的三个字段清成空字符串。
    // 因此只覆盖用户真填了的字段，其余沿用草稿里的既有值。
    // 先 trim 再判空：'   ' 这种全空白等同于没填，同样不该顶掉旧值。
    const projectName = next.projectName.trim();
    const intervieweeName = next.intervieweeName.trim();
    const notes = next.overview.trim();

    saveOutlineDraftToSession(existing?.outlineMarkdown ?? "", {
      ...existing?.profile,
      ...(projectName ? { projectName } : {}),
      ...(intervieweeName ? { intervieweeName } : {}),
      // IMPL §3.3 裁决：描述信息 → notes；researchFocus 不由基本信息写入。
      ...(notes ? { notes } : {}),
    });
  }

  // REQ-36：建项逻辑从 route-chooser 迁到流程容器 —— 提纲是 AI 分支的终局步，
  // 用户在这里点「确认提纲，开始访谈」才建项目（步骤顺序 basic → route → outline）。
  // 契约不变：POST /api/projects/ai-interview 仍要求提纲 + 项目名 + 受访对象。
  async function createAiInterviewProject() {
    if (isCreating) {
      return;
    }

    const draft = readOutlineDraftSession();
    const markdown = draft?.outlineMarkdown?.trim() ?? "";
    const profile = draft?.profile;

    if (
      !profile ||
      !markdown ||
      !profile.projectName.trim() ||
      !profile.intervieweeName.trim()
    ) {
      setOutlineError("提纲或基本信息不完整，请返回上一步补填。");
      return;
    }

    setIsCreating(true);
    setOutlineError("");

    try {
      const response = await fetch("/api/projects/ai-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // 字段与 outline-plan-workspace.tsx 的建项请求逐项一致；
        // 画像直接取 workspace 刚写回草稿的那一份（含用户在提纲步的编辑）。
        body: JSON.stringify({
          projectName: profile.projectName.trim(),
          intervieweeName: profile.intervieweeName.trim(),
          institutionName: profile.institutionName,
          researchFocus: profile.researchFocus,
          collectionScenario: profile.collectionScenario,
          notes: profile.notes,
          outlineDraftMarkdown: markdown,
          ...(writingTemplateKey ? { writingTemplateKey } : {}),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as { project?: { id?: string }; message?: string } | null;
      const projectId = payload?.project?.id;

      if (!response.ok || !projectId) {
        throw new Error(payload?.message ?? "创建项目失败");
      }

      router.push(`/projects/${projectId}/interview`);
    } catch {
      setOutlineError("创建项目失败，请重试。");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5 xl:h-dvh xl:overflow-hidden">
      <div className="flex flex-col gap-2 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]">
        <header className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] px-4 py-4 md:px-5">
          <div className="flex items-start gap-4">
            <div className="archive-mark hidden sm:grid">
              <span />
              <span />
              <span />
            </div>

            <div className="min-w-0 flex-1">
              {/* 每步左上角的返回入口，文案与落点随步骤切换（basic 回首页 /
                  outline·route 回上一步）。位置固定在步骤条上方，全流程唯一一个返回按钮。 */}
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === "basic" ? "返回首页" : "返回上一步"}
              </button>
              <h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem]">
                新建项目
              </h1>

              {/* 步骤条纯展示、不可点：可点会绕过基本信息校验（PRD §9-2
                  「必填未过时不能进入任一分支」）。前进只能走各步自己的按钮。 */}
              <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                {NEW_PROJECT_STEPS.map(({ key, label }, index) => {
                  const isCurrent = step === key;
                  const isDone = index < currentIndex;

                  return (
                    <li key={key} className="min-w-0 sm:flex-1">
                      <div
                        aria-current={isCurrent ? "step" : undefined}
                        className={`flex w-full items-center gap-2 rounded-[1rem] border px-3 py-2 text-sm ${
                          isCurrent
                            ? "border-accent-soft bg-accent-soft/70 text-accent-strong"
                            : isDone
                              ? "border-line/80 bg-white/70 text-foreground"
                              : "border-line/60 bg-white/40 text-muted"
                        }`}
                      >
                        <span className="text-[11px] font-semibold tracking-[0.18em]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate font-semibold">{label}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </header>

        {/* 步骤体只做布局，不加 paper-panel：backdrop-filter 会成为 fixed 后代的包含块，
            而嵌入式提纲工作台底部有一条 fixed 的移动端输入条（outline-plan-workspace.tsx:916）。 */}
        <section className="flex min-w-0 flex-col xl:min-h-0">
          {step === "basic" ? (
            <div id="new-step-basic" className="min-w-0">
              <BasicInfoForm
                value={basicInfo}
                onChange={setBasicInfo}
                onNext={() => {
                  persistBasicInfo(basicInfo);
                  goToStep("route");
                }}
              />
            </div>
          ) : null}

          {step === "outline" ? (
            <div
              id="new-step-outline"
              className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1"
            >
              {/* embedded：去掉工作台自带的整页外壳与 header，只留表单与提纲本体；
                  onContinue 取代它内部的 router.push，把「下一步」交给本容器。 */}
              {/* REQ-33：模板选择放在提纲步、工作台**之外** —— 不碰 outline-plan-workspace.tsx，
                  也不进它的滚动区；framed 只加 surface-card（不加 paper-panel，见 :263 注释）。 */}
              <WritingTemplateSelect
                id="writing-template-key"
                framed
                value={writingTemplateKey}
                onChange={setWritingTemplateKey}
              />
              <OutlinePlanWorkspace
                embedded
                initialMarkdown={outlineSeed}
                initialTopic={basicInfo.projectName}
                initialSubject={basicInfo.intervieweeName}
                initialOverview={basicInfo.overview}
                onContinue={() => {
                  // workspace 已在 handleConfirm 里把 markdown + 表单画像整体写回草稿，
                  // 这里直接建项（不再 persistBasicInfo：那会用基本信息步的旧值
                  // 盖掉用户在提纲步刚改过的主题 / 受访者）。
                  void createAiInterviewProject();
                }}
              />
              {outlineError ? (
                <div className="mt-3 rounded-[1.4rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
                  {outlineError}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "route" ? (
            <div id="new-step-route" className="min-w-0">
              <RouteChooser
                basicInfo={basicInfo}
                onSelectAi={() => {
                  // REQ-36 Q2：种子的读取必须留在点击事件里。渲染期读 sessionStorage
                  // 在 SSR 下必为空、客户端首帧却有值 ⇒ BUG-16 的 hydration mismatch 复发。
                  setOutlineSeed(readOutlineDraftSession()?.outlineMarkdown ?? "");
                  goToStep("outline");
                }}
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
