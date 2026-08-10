"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  FileText,
  LoaderCircle,
  Maximize2,
  ScanText,
  ShieldAlert,
  Sparkles,
  Tags,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EmotionSignal, ProjectRecord, TranscriptSegment } from "@/lib/types/project";

type ProjectProcessingConsoleProps = {
  project: ProjectRecord;
  autoStart?: boolean;
};

type TextPanelProps = {
  title: string;
  icon: typeof FileText;
  content: string;
  tag: string;
  dense?: boolean;
};

function formatSegmentTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function SurfaceSection({
  title,
  icon: Icon,
  tag,
  children,
  dense = false,
}: {
  title: string;
  icon: typeof FileText;
  tag: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <article className={`surface-card rounded-[1.55rem] ${dense ? "p-4" : "p-4 md:p-5"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-accent-strong" />
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        <span className="tape-label">{tag}</span>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function TextPanel({ title, icon: Icon, content, tag, dense = false }: TextPanelProps) {
  return (
    <SurfaceSection title={title} icon={Icon} tag={tag} dense={dense}>
      <div className="whitespace-pre-wrap text-sm leading-7 text-muted">
        {content || "暂无内容"}
      </div>
    </SurfaceSection>
  );
}

function SegmentList({
  segments,
  dense = false,
}: {
  segments: TranscriptSegment[];
  dense?: boolean;
}) {
  return (
    <SurfaceSection title="分段转写" icon={ScanText} tag="Trace" dense={dense}>
      <div className="grid gap-3">
        {segments.length > 0 ? (
          segments.map((segment) => (
            <div
              key={segment.id}
              className="rounded-[1.1rem] border border-line/70 bg-white/58 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.08em] text-accent-strong">
                <span className="rounded-full bg-accent-soft/60 px-2.5 py-1 text-[11px]">
                  {formatSegmentTime(segment.startMs)}
                </span>
                <span>{segment.speaker}</span>
                {typeof segment.confidence === "number" ? (
                  <span>置信度 {Math.round(segment.confidence * 100)}%</span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-7 text-foreground">{segment.text}</p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-muted">暂无分段转写结果。</p>
        )}
      </div>
    </SurfaceSection>
  );
}

function EmotionPanel({
  signals,
  dense = false,
}: {
  signals: EmotionSignal[];
  dense?: boolean;
}) {
  const levelStyleMap = {
    notice: "border-accent-soft bg-accent-soft/55 text-accent-strong",
    warning: "border-warning/20 bg-warning/10 text-warning",
    high: "border-danger/20 bg-danger/10 text-danger",
  } as const;

  return (
    <SurfaceSection
      title="情感与创伤识别"
      icon={AlertTriangle}
      tag="Safety"
      dense={dense}
    >
      <div className="grid gap-3">
        {signals.length > 0 ? (
          signals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded-[1.15rem] border p-4 ${levelStyleMap[signal.level]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{signal.label}</p>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]">
                  {signal.level}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6">片段：{signal.excerpt}</p>
              <p className="mt-1 text-sm leading-6">建议：{signal.guidance}</p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-muted">暂无需要重点关注的情绪风险片段。</p>
        )}
      </div>
    </SurfaceSection>
  );
}

function KeywordsPanel({
  keywords,
  dense = false,
}: {
  keywords: string[];
  dense?: boolean;
}) {
  return (
    <SurfaceSection title="主题关键词" icon={Tags} tag="Topics" dense={dense}>
      <div className="flex flex-wrap gap-2">
        {keywords.length > 0 ? (
          keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-accent-soft bg-accent-soft/72 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-accent-strong"
            >
              {keyword}
            </span>
          ))
        ) : (
          <p className="text-sm text-muted">暂无内容</p>
        )}
      </div>
    </SurfaceSection>
  );
}

function RedactionPanel({
  notes,
  marks,
  dense = false,
}: {
  notes: string[];
  marks: ProjectRecord["sensitiveMarks"];
  dense?: boolean;
}) {
  return (
    <SurfaceSection title="脱敏提示" icon={ShieldAlert} tag="Redaction" dense={dense}>
      <div>
        {notes.length > 0 ? (
          <ul className="space-y-2 text-sm leading-6 text-muted">
            {notes.map((note, index) => (
              <li key={`${note}-${index}`}>{index + 1}. {note}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted">暂无内容</p>
        )}

        {marks.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {marks.map((mark) => (
              <div
                key={mark.id}
                className="rounded-[1.15rem] border border-warning/18 bg-warning/8 p-4"
              >
                <p className="text-sm font-semibold text-foreground">{mark.type}</p>
                <p className="mt-2 text-sm leading-6 text-muted">片段：{mark.excerpt}</p>
                <p className="mt-1 text-sm leading-6 text-muted">原因：{mark.reason}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SurfaceSection>
  );
}

function TimelinePanel({
  events,
  dense = false,
}: {
  events: ProjectRecord["timelineEvents"];
  dense?: boolean;
}) {
  return (
    <SurfaceSection title="关键时间线" icon={Sparkles} tag="Timeline" dense={dense}>
      <div className="grid gap-3">
        {events.length > 0 ? (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-[1.1rem] border border-line/70 bg-white/58 p-4"
            >
              <p className="text-xs font-semibold tracking-[0.08em] text-accent-strong">
                {event.timeLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{event.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{event.description}</p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-muted">暂无时间线内容。</p>
        )}
      </div>
    </SurfaceSection>
  );
}

function StructuredPanel({
  sections,
  dense = false,
}: {
  sections: ProjectRecord["structuredSections"];
  dense?: boolean;
}) {
  return (
    <SurfaceSection title="结构化档案" icon={FileText} tag="Archive" dense={dense}>
      <div className="grid gap-3">
        {sections.length > 0 ? (
          sections.map((section) => (
            <div
              key={section.id}
              className="rounded-[1.1rem] border border-line/70 bg-white/58 p-4"
            >
              <p className="text-sm font-semibold text-foreground">{section.heading}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                {section.content}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-muted">暂无结构化内容。</p>
        )}
      </div>
    </SurfaceSection>
  );
}

function ResultGrid({ project, expanded = false }: { project: ProjectRecord; expanded?: boolean }) {
  return (
    <div className="grid gap-4">
      <div className={`grid gap-4 ${expanded ? "2xl:grid-cols-[1.1fr_0.9fr]" : "xl:grid-cols-[1.08fr_0.92fr]"}`}>
        <div className="grid gap-4">
          <TextPanel
            title="自动转写稿"
            icon={FileText}
            content={project.transcriptRaw}
            tag="Raw"
            dense={expanded}
          />
          <TextPanel
            title="脱敏整理稿"
            icon={Sparkles}
            content={project.redactedAiDraft || project.aiDraft}
            tag="Redacted"
            dense={expanded}
          />
          <SegmentList segments={project.transcriptSegments} dense={expanded} />
        </div>

        <div className="grid gap-4">
          <TextPanel
            title="口述摘要"
            icon={ScanText}
            content={project.summary}
            tag="Summary"
            dense={expanded}
          />
          <KeywordsPanel keywords={project.keywords} dense={expanded} />
          <EmotionPanel signals={project.emotionalSignals} dense={expanded} />
          <RedactionPanel
            notes={project.redactionNotes}
            marks={project.sensitiveMarks}
            dense={expanded}
          />
        </div>
      </div>

      <div className={`grid gap-4 ${expanded ? "2xl:grid-cols-[0.9fr_1.1fr]" : "xl:grid-cols-[0.92fr_1.08fr]"}`}>
        <TimelinePanel events={project.timelineEvents} dense={expanded} />
        <StructuredPanel sections={project.structuredSections} dense={expanded} />
      </div>
    </div>
  );
}

export function ProjectProcessingConsole({
  project,
  autoStart = false,
}: ProjectProcessingConsoleProps) {
  const router = useRouter();
  const [currentProject, setCurrentProject] = useState(project);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  const handleProcess = useCallback(
    (cleanupUrl = false) => {
      setError(null);
      setIsProcessing(true);
      setCurrentProject((current) => ({
        ...current,
        lastProcessingError: null,
        status:
          current.status === "uploaded" ? "transcribing" : current.status,
      }));

      startTransition(async () => {
        try {
          const response = await fetch(`/api/projects/${project.id}/process`, {
            method: "POST",
          });

          const payload = (await response.json()) as {
            message?: string;
            project?: ProjectRecord;
          };

          if (!response.ok) {
            throw new Error(payload.message ?? "处理失败，请稍后重试。");
          }

          if (payload.project) {
            setCurrentProject(payload.project);
          }
          setIsProcessing(false);

          if (cleanupUrl) {
            router.replace(`/projects/${project.id}`);
          }

          router.refresh();
        } catch (processError) {
          setIsProcessing(false);
          setError(
            processError instanceof Error
              ? processError.message
              : "处理失败，请稍后重试。",
          );

          if (cleanupUrl) {
            router.replace(`/projects/${project.id}`);
          }
        }
      });
    },
    [project.id, router],
  );

  const hasResults = Boolean(
    currentProject.transcriptRaw ||
      currentProject.aiDraft ||
      currentProject.summary ||
      currentProject.keywords.length > 0 ||
      currentProject.redactionNotes.length > 0 ||
      currentProject.structuredSections.length > 0,
  );

  const isProjectProcessing =
    currentProject.status === "transcribing" ||
    currentProject.status === "ai_refining";
  const isBusy = isProcessing || isProjectProcessing;

  useEffect(() => {
    const shouldAutoStart =
      autoStart &&
      !hasAutoStartedRef.current &&
      !currentProject.transcriptRaw &&
      currentProject.status === "uploaded";

    if (!shouldAutoStart) {
      return;
    }

    hasAutoStartedRef.current = true;
    handleProcess(true);
  }, [
    autoStart,
    currentProject.status,
    currentProject.transcriptRaw,
    handleProcess,
  ]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <section className="paper-panel h-full min-h-0 rounded-[1.85rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">上传即处理</p>
            <h2 className="font-display mt-2 text-[1.7rem] font-semibold text-accent-strong md:text-[2rem]">
              整理结果
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasResults ? (
              <Button
                type="button"
                variant="secondary"
                className="min-w-[138px]"
                onClick={() => setIsExpanded(true)}
              >
                <Maximize2 className="h-4 w-4" />
                放大查看
              </Button>
            ) : null}
            <Button onClick={() => handleProcess()} disabled={isBusy}>
              {isBusy ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在整理...
                </>
              ) : (
                <>
                  {currentProject.transcriptRaw ? "重新生成整理结果" : "立即开始整理"}
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="soft-scroll mt-4 h-[calc(100%-4.6rem)] overflow-auto pr-1">
          {error || currentProject.lastProcessingError ? (
            <div className="rounded-[1.2rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
              {error || currentProject.lastProcessingError}
            </div>
          ) : null}

          {!hasResults ? (
            <div className="surface-card rounded-[1.5rem] p-5 text-sm leading-6 text-muted">
              上传完成后，系统会自动生成分段转写、情绪提示、脱敏稿和结构化档案内容；如果没有自动触发，也可以手动点击右上角立即开始整理。
            </div>
          ) : null}

          {hasResults ? <ResultGrid project={currentProject} /> : null}
        </div>
      </section>

      {isExpanded ? (
        <div className="fixed inset-0 z-[70] bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px]">
          <div className="flex h-full flex-col p-2 sm:p-3">
            <div className="paper-panel paper-panel-strong flex min-h-0 flex-1 flex-col rounded-[2rem] px-4 py-4 md:px-6 md:py-5">
              <div className="flex flex-col gap-3 border-b border-line/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="section-eyebrow">Expanded View</p>
                  <h3 className="font-display mt-2 text-[1.8rem] font-semibold text-accent-strong">
                    整理结果全屏查看
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    更适合通读长文本；按 <span className="font-semibold text-accent-strong">Esc</span> 也可以关闭。
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsExpanded(false)}
                  >
                    <X className="h-4 w-4" />
                    退出放大
                  </Button>
                </div>
              </div>

              <div className="soft-scroll mt-4 min-h-0 flex-1 overflow-auto pr-1">
                <ResultGrid project={currentProject} expanded />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
