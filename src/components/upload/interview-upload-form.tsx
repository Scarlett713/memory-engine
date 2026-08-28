"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AudioLines,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { MarkdownSheet } from "@/components/ui/markdown-sheet";
import { Button } from "@/components/ui/button";
import {
  OUTLINE_SESSION_STORAGE_KEY,
  normalizeOutlineSession,
} from "@/lib/outline-session";
import {
  interviewScenarioOptions,
  privacyLevelOptions,
  redactionRuleOptions,
} from "@/lib/oral-history";
import type {
  InterviewScenario,
  PrivacyLevel,
  RedactionRule,
} from "@/lib/types/project";
import { useProjectWorkspaceStore } from "@/store/project-workspace";
import { useAuth } from "@/hooks/useAuth";
import { useDeviceType } from "@/hooks/useDeviceType";

const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,audio/*";
const defaultRules: RedactionRule[] = [
  "phone",
  "id_card",
  "address",
  "contact_account",
];

function readStoredOutlineSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(OUTLINE_SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return normalizeOutlineSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function InterviewUploadForm() {
  const router = useRouter();
  const { user } = useAuth();
  const deviceType = useDeviceType();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createProject = useProjectWorkspaceStore((state) => state.createProject);
  const isSubmitting = useProjectWorkspaceStore((state) => state.isSubmitting);
  const [initialSession] = useState(() => readStoredOutlineSession());

  const [projectName, setProjectName] = useState("");
  const [intervieweeName, setIntervieweeName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [notes, setNotes] = useState(() => initialSession?.profile.notes || "");
  const [researchFocus, setResearchFocus] = useState(
    () => initialSession?.profile.researchFocus || "",
  );
  const [collectionScenario, setCollectionScenario] = useState<InterviewScenario>(
    () => initialSession?.profile.collectionScenario || "urban_memory",
  );
  const [customScenarioLabel, setCustomScenarioLabel] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("standard");
  const [customRedactionRules, setCustomRedactionRules] =
    useState<RedactionRule[]>(defaultRules);
  const [outlineDraftMarkdown] = useState(
    () => initialSession?.outlineMarkdown || "",
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectName.trim()) {
      setError("请填写口述项目名称。");
      return;
    }

    if (!intervieweeName.trim()) {
      setError("请填写受访对象。");
      return;
    }

    if (!audioFile) {
      setError("请先选择一段受访音频。");
      return;
    }

    if (collectionScenario === "custom" && !customScenarioLabel.trim()) {
      setError("选择自定义主题后，请填写具体口述场景。");
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
        outlineDraftMarkdown,
        projectName: projectName.trim(),
        collectionScenario,
        researchFocus: researchFocus.trim(),
        privacyLevel,
        customRedactionRules,
      });

      router.refresh();
      router.push(`/projects/${project.id}?autostart=1`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "上传失败，请稍后重试。",
      );
    }
  }


  // ── 个人端极简表单（移动端）──────────────────────────────
  const [simpleIntervieweeName, setSimpleIntervieweeName] = useState('');
  const [simpleRelation, setSimpleRelation] = useState('grandparent');

  const relationOptions = [
    { value: 'grandparent', label: '祖父母 / 外祖父母' },
    { value: 'parent', label: '父母' },
    { value: 'spouse', label: '配偶' },
    { value: 'sibling', label: '兄弟姐妹' },
    { value: 'friend', label: '朋友 / 邻居' },
    { value: 'other', label: '其他' },
  ];

  async function handleSimpleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!simpleIntervieweeName.trim()) {
      setError('请填写受访者的称呼。');
      return;
    }
    if (!audioFile) {
      setError('请先选择一段音频。');
      return;
    }
    try {
      setError(null);
      const now = new Date();
      const yearMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`;
      const project = await createProject({
        audioFile,
        intervieweeName: simpleIntervieweeName.trim(),
        projectName: `${simpleIntervieweeName.trim()}的口述回忆 · ${yearMonth}`,
        institutionName: '',
        collectionScenario: 'family_memory',
        researchFocus: relationOptions.find(o => o.value === simpleRelation)?.label || '',
        privacyLevel: 'standard',
        customRedactionRules: defaultRules,
        customScenarioLabel: '',
        notes: '',
        outlineDraftMarkdown: '',
      });
      router.push(`/projects/${project.id}?autostart=1`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '上传失败，请稍后重试。'
      );
    }
  }

  // 移动端个人用户 → 极简版
  if (deviceType === 'mobile' && user?.userType === 'personal') {
    return (
      <section className="archive-frame paper-panel paper-panel-strong h-full min-h-0 rounded-[1.85rem] p-5">
        <div className="mb-5">
          <p className="section-eyebrow">上传音频</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-accent-strong">
            记录这段回忆
          </h2>
        </div>

        <form className="soft-scroll space-y-4 overflow-auto" onSubmit={handleSimpleSubmit}>
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 受访者称呼 */}
          <div>
            <label className="field-label" htmlFor="simpleIntervieweeName">
              受访者的称呼
            </label>
            <input
              id="simpleIntervieweeName"
              className="text-field"
              value={simpleIntervieweeName}
              onChange={(e) => setSimpleIntervieweeName(e.target.value)}
              placeholder="例如：外婆、王爷爷"
              required
            />
          </div>

          {/* 与受访者关系 */}
          <div>
            <label className="field-label" htmlFor="simpleRelation">
              TA 和你的关系
            </label>
            <select
              id="simpleRelation"
              className="text-field"
              value={simpleRelation}
              onChange={(e) => setSimpleRelation(e.target.value)}
            >
              {relationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* 音频上传区 */}
          <div>
            <label className="field-label">上传音频</label>
            <div
              className="mt-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              {audioFile ? (
                <div className="space-y-1">
                  <AudioLines className="mx-auto h-6 w-6 text-accent-strong" />
                  <p className="text-sm font-medium text-stone-700">{audioFile.name}</p>
                  <p className="text-xs text-stone-400">
                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="mx-auto h-8 w-8 text-stone-300" />
                  <p className="text-sm text-stone-500">点击选择音频文件</p>
                  <p className="text-xs text-stone-400">支持 MP3、WAV、M4A 等格式</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedAudioExtensions}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="send-pill w-full justify-center"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {isSubmitting ? '上传中…' : '开始整理这段回忆'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="archive-frame paper-panel paper-panel-strong h-full min-h-0 rounded-[1.85rem] p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">Step 02</p>
          <h2 className="font-display mt-2 text-[1.8rem] font-semibold text-accent-strong md:text-[2.15rem]">
            上传受访音频
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted">
          <div className="meta-pill">
            <AudioLines className="h-4 w-4 text-accent-strong" />
            本地归档
          </div>
          <div className="meta-pill">
            <ShieldCheck className="h-4 w-4 text-accent-strong" />
            脱敏规则可配置
          </div>
          <Link href="/" className="meta-pill">
            <ArrowLeft className="h-4 w-4 text-accent-strong" />
            返回提纲页
          </Link>
        </div>
      </div>

      <form
        className="soft-scroll mt-5 h-[calc(100%-5.4rem)] space-y-4 overflow-auto pr-1"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2">
            <label className="field-label" htmlFor="projectName">
              口述项目名称
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
              受访对象
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
            <label className="field-label" htmlFor="institutionName">
              整理机构
            </label>
            <input
              id="institutionName"
              className="text-field"
              value={institutionName}
              onChange={(event) => setInstitutionName(event.target.value)}
              placeholder="例如：城市口述历史工作站"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="collectionScenario">
              口述场景
            </label>
            <select
              id="collectionScenario"
              className="text-field"
              value={collectionScenario}
              onChange={(event) =>
                setCollectionScenario(event.target.value as InterviewScenario)
              }
            >
              {interviewScenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

          {collectionScenario === "custom" ? (
            <div className="xl:col-span-2">
              <label className="field-label" htmlFor="customScenarioLabel">
                自定义口述主题
              </label>
              <input
                id="customScenarioLabel"
                className="text-field"
                value={customScenarioLabel}
                onChange={(event) => setCustomScenarioLabel(event.target.value)}
                placeholder="例如：双王街道老城厢生活变迁"
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr] xl:items-stretch">
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="researchFocus">
                研究焦点
              </label>
              <textarea
                id="researchFocus"
                className="text-area min-h-[7rem]"
                value={researchFocus}
                onChange={(event) => setResearchFocus(event.target.value)}
                placeholder="例如：关注街区生活、空间变迁、邻里关系与代际记忆。"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="notes">
                项目说明
              </label>
              <textarea
                id="notes"
                className="text-area min-h-[9rem]"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="补充本次口述采集的背景、访谈风格、需要重点照顾的伦理风险等。"
              />
            </div>

            <div className="surface-card rounded-[1.55rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">隐私保护</p>
                  <h3 className="mt-1.5 text-base font-semibold text-foreground">
                    自定义脱敏规则
                  </h3>
                </div>
                <div className="tape-label">Privacy</div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {redactionRuleOptions.map((option) => {
                  const isActive = customRedactionRules.includes(option.value);

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
          </div>

          <div className="grid gap-4">
            <div className="surface-card flex h-full flex-col rounded-[1.55rem] p-4">
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
                  className="file-trigger h-full text-left"
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

            <div className="surface-card rounded-[1.55rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">已带入提纲</p>
                  <h3 className="mt-1.5 text-base font-semibold text-foreground">
                    Markdown 草稿预览
                  </h3>
                </div>
                <div className="tape-label">Outline</div>
              </div>

              <div className="soft-scroll mt-4 max-h-[360px] overflow-auto rounded-[1.2rem] border border-line/60 bg-white/60 p-4">
                <MarkdownSheet
                  markdown={outlineDraftMarkdown}
                  emptyMessage="当前还没有从提纲页带入内容，你也可以返回上一步继续完善提纲。"
                />
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-[1.4rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            提交后将直接开始本地音频转写、AI 整理与隐私脱敏处理，上一阶段生成的访谈提纲也会一并写入项目档案。
          </p>
          <Button
            type="submit"
            className="min-w-[220px] justify-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在上传并处理...
              </>
            ) : (
              <>
                创建项目并开始处理
                <FileText className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
