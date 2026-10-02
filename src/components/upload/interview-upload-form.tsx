"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  ChevronLeft,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  collectionPathOptions,
  confidentialityLevelOptions,
  interviewScenarioOptions,
  privacyLevelOptions,
  redactionRuleOptions,
} from "@/lib/oral-history";
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

type WizardStep = 1 | 2 | 3;

const wizardSteps: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: "基础信息" },
  { step: 2, label: "采集路径" },
  { step: 3, label: "音频与提交" },
];

function ConsentNotice({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="surface-card rounded-[1.55rem] border-2 border-emerald-500/40 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <p className="section-eyebrow">知情同意确认</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        本平台会对本次口述音频进行本地转写、AI 整理与隐私脱敏处理，处理结果仅用于研究 / 归档目的。上传前，请确认您已向受访者完整说明上述用途。
        <span className="text-stone-400">（占位文案，待姚婷婷提供正式文案后替换）</span>
      </p>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[1.15rem] border border-emerald-500/30 bg-white/60 p-3.5 text-sm leading-6 text-foreground">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          我确认已获得受访者的口头或书面知情同意，受访者已了解本次口述内容将被录音、转写、AI
          整理，并同意在脱敏处理后用于研究 / 归档目的。
        </span>
      </label>
      {!checked ? (
        <p className="mt-2.5 text-xs leading-5 text-muted">
          请先勾选知情同意确认，才能上传并开始 AI 处理。
        </p>
      ) : null}
    </div>
  );
}

export function InterviewUploadForm() {
  const router = useRouter();
  const { loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createProject = useProjectWorkspaceStore((state) => state.createProject);
  const isSubmitting = useProjectWorkspaceStore((state) => state.isSubmitting);

  const [step, setStep] = useState<WizardStep>(1);

  // ── Step 1 基础信息 ──────────────────────────────────────
  const [projectName, setProjectName] = useState("");
  const [intervieweeName, setIntervieweeName] = useState("");
  const [collectionScenario, setCollectionScenario] =
    useState<InterviewScenario>("urban_memory");
  const [customScenarioLabel, setCustomScenarioLabel] = useState("");
  // 标了 ✱ 就必须真的让用户选，所以初值是 null 而不是 "internal"
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<ConfidentialityLevel | null>(null);
  const [notes, setNotes] = useState("");
  const [outlineDraftMarkdown, setOutlineDraftMarkdown] = useState("");

  // ── Step 1 高级设置 ──────────────────────────────────────
  const [institutionName, setInstitutionName] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("standard");
  const [customRedactionRules, setCustomRedactionRules] =
    useState<RedactionRule[]>(defaultRules);

  // ── Step 2 采集路径 ──────────────────────────────────────
  const [collectionPath, setCollectionPath] = useState<CollectionPath>("upload");

  // ── Step 3 音频与提交 ────────────────────────────────────
  const [language, setLanguage] = useState("cn");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const [error, setError] = useState<string | null>(null);

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

    void submitProject();
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
                        className={`rounded-[1.1rem] border px-4 py-3 text-sm transition-colors ${
                          isActive
                            ? "border-accent-soft bg-accent-soft/70 text-accent-strong"
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

              <details className="surface-card rounded-[1.55rem] p-4">
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

              <details className="surface-card rounded-[1.55rem] p-4">
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
                          className={`rounded-[1.1rem] border px-4 py-3 text-sm transition-colors ${
                            isActive
                              ? "border-accent-soft bg-accent-soft/70 text-accent-strong"
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
                    className={`rounded-[1.4rem] border-2 p-5 transition-colors ${
                      isDisabled
                        ? "cursor-not-allowed border-line/60 bg-white/40 text-muted/70"
                        : isActive
                          ? "cursor-pointer border-accent-soft bg-accent-soft/70 text-accent-strong"
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
                  音频语言 / 方言
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

              <ConsentNotice
                checked={consentChecked}
                onChange={setConsentChecked}
              />

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

                <div className="mt-3 flex flex-1">
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
            {step > 1 ? (
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
                disabled={isSubmitting || !consentChecked}
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
    </section>
  );
}
