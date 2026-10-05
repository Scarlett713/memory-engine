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
const defaultRules: RedactionRule[] = [
  "phone",
  "id_card",
  "address",
  "contact_account",
];

// 讯飞转写 language 参数取值（方言识别）
const languageOptions = [
  { value: "cn", label: "普通话（默认）" },
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

// 知情同意弹窗：创建项目的唯一闸口，用户点「我确认」之后才真正发起创建。
// 不做任何本地记忆 —— 每次点「创建项目」都重新弹，并重置勾选态。
function ConsentDialog({
  open,
  checked,
  onCheckedChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
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
            <p>
              本平台会对本次口述音频进行本地转写、AI 整理与隐私脱敏处理，处理结果仅用于研究/归档目的。上传前，请确认您已向受访者完整说明上述用途。
            </p>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[1.15rem] border border-emerald-500/30 bg-white/60 p-3.5 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
              checked={checked}
              onChange={(event) => onCheckedChange(event.target.checked)}
            />
            <span>
              我确认已获得受访者的口头或书面知情同意，受访者已了解本次口述内容将被录音、转写、AI
              整理，并同意在脱敏处理后用于研究/归档目的。
            </span>
          </label>

          {!checked ? (
            <p className="mt-2.5 text-xs leading-5 text-muted">
              请先勾选知情同意确认，才能创建项目并开始处理。
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
              我确认
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
  // 两项齐了就直接从步骤二开始，不再要求重复填写。缺任一则维持从步骤一开始。
  //
  // REQ-21 / P3：从新建流程的分流步跳进来时，采集路径已在上一步选过（用户点的就是
  // 「上传音频」），画像也已在基本信息步填过 —— 再让用户点一遍是重复劳动，直接落到
  // 「音频与提交」。必须同时要求 outline 标记位：裸访问 /upload、老书签、?outline=0
  // 时 hasOutlineFlag 为 false，逐字走下面的原逻辑，行为零变化。
  const [step, setStep] = useState<WizardStep>(() => {
    const ready = Boolean(
      prefill?.profile.projectName && prefill?.profile.intervieweeName,
    );

    if (hasOutlineFlag && ready) {
      return 3;
    }

    return ready ? 2 : 1;
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
      return "支持 mp3、wav、m4a、aac、flac、ogg 等常见音频格式。";
    }

    const sizeInMb = (audioFile.size / 1024 / 1024).toFixed(2);
    return `已选择：${audioFile.name}，${sizeInMb} MB`;
  }, [audioFile]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
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

  // P3：从新建流程分流步进来的用户没有「upload 内部上一步」的概念 —— 新建流程的步骤
  // 是 SPA 内部 state，刷新即丢，goBack 只会把人带回 upload 自己的步骤一，与用户的
  // 来路再无关系。留个按钮只会误导，藏掉。
  // 只在「步骤三 + 带标记位」这一种组合下藏：用户若自己点步骤条回到步骤二，按钮照常
  // 出现（那是 upload 内部回退，语义正确）；从步骤二点「下一步」回到步骤三后它会再次
  // 隐藏 —— 预期行为，用户始终处在「从新建流程进入」的上下文里。
  const hideBackButton = step === 3 && hasOutlineFlag;

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
    <section className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] p-5 md:p-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <form
        className="mt-1 flex flex-col gap-4 xl:min-h-0 xl:flex-1"
        onSubmit={handleFormSubmit}
      >
        {/* 步骤条：仅支持回退，前进必须走「下一步」校验 */}
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
                    <p className="section-eyebrow">受访音频</p>
                    <h3 className="mt-1.5 text-base font-semibold text-foreground">
                      上传音频材料
                    </h3>
                  </div>
                  <div className="tape-label">Audio</div>
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
                        <p className="mt-1.5 text-sm leading-6 text-muted">
                          {helperText}
                        </p>
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
                : "提交后将直接开始本地音频转写、AI 整理与隐私脱敏处理。"}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {step > 1 && !hideBackButton ? (
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
                    创建项目并开始处理
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
      />
    </section>
  );
}
