import {
  AudioLines,
  FileOutput,
  FilePenLine,
  ScanText,
  ShieldCheck,
} from "lucide-react";

import type { WorkflowStep } from "@/lib/types/project";

type ProjectWorkflowBoardProps = {
  workflow: WorkflowStep[];
};

const iconMap = {
  upload: AudioLines,
  transcription: ScanText,
  ai_refine: ShieldCheck,
  manual_review: FilePenLine,
  export: FileOutput,
};

const statusMap = {
  completed: "已完成",
  in_progress: "进行中",
  pending: "待处理",
};

export function ProjectWorkflowBoard({
  workflow,
}: ProjectWorkflowBoardProps) {
  return (
    <section className="paper-panel rounded-[1.85rem] p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">处理进度</p>
          <h2 className="font-display mt-2 text-[1.7rem] font-semibold text-accent-strong md:text-[2rem]">
            自动处理链路
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted">
          上传音频后，系统会自动完成转写、AI整理与人工审校准备。
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {workflow.map((step, index) => {
          const Icon = iconMap[step.key];
          const isCompleted = step.status === "completed";
          const isActive = step.status === "in_progress";

          return (
            <article
              key={step.key}
              className="surface-card relative rounded-[1.45rem] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-[1rem] shadow-[0_12px_24px_rgba(49,35,24,0.08)] ${
                    isCompleted
                      ? "bg-success/12 text-success"
                      : isActive
                        ? "bg-warning/12 text-warning"
                        : "bg-accent-soft text-accent-strong"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] ${
                    isCompleted
                      ? "bg-success/12 text-success"
                      : isActive
                        ? "bg-warning/12 text-warning"
                        : "bg-white/80 text-muted"
                  }`}
                >
                  {statusMap[step.status]}
                </span>
              </div>

              <p className="mt-4 text-[11px] font-semibold tracking-[0.18em] text-accent-strong/75">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-sm font-semibold text-foreground">
                {step.label}
              </h3>
              <p className="mt-2 text-xs leading-6 text-muted">
                {step.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
