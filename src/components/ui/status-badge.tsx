import type { ProjectStatus } from "@/lib/types/project";

type StatusBadgeProps = {
  status: ProjectStatus;
};

const statusMap: Record<
  ProjectStatus,
  {
    label: string;
    className: string;
  }
> = {
  uploaded: {
    label: "整理中",
    className: "border border-accent-soft bg-accent-soft/70 text-accent-strong",
  },
  transcribing: {
    label: "转写处理中",
    className: "border border-warning/20 bg-warning/10 text-warning",
  },
  ai_refining: {
    label: "整理处理中",
    className: "border border-warning/20 bg-warning/10 text-warning",
  },
  manual_review: {
    label: "待审核",
    className: "border border-deep/15 bg-deep/10 text-deep",
  },
  ready_to_export: {
    label: "可导出",
    className: "border border-success/20 bg-success/10 text-success",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.08em] ${config.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}
