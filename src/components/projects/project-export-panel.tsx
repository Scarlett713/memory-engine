"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileCode2, FileText, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProjectRecord } from "@/lib/types/project";

type ExportFormat = "docx" | "txt" | "json";

type ProjectExportPanelProps = {
  project: ProjectRecord;
};

const formatMeta: Record<
  ExportFormat,
  {
    label: string;
    icon: typeof Download;
  }
> = {
  docx: {
    label: "导出 Word 档案稿",
    icon: Download,
  },
  txt: {
    label: "导出 TXT 文本",
    icon: FileText,
  },
  json: {
    label: "导出结构化 JSON",
    icon: FileCode2,
  },
};

function readFileNameFromHeader(header: string | null, fallback: string) {
  if (!header) {
    return fallback;
  }

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = header.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] || fallback;
}

export function ProjectExportPanel({ project }: ProjectExportPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [isPending, startTransition] = useTransition();

  const canExport = useMemo(
    () => Boolean(project.redactedAiDraft || project.aiDraft),
    [project.aiDraft, project.redactedAiDraft],
  );

  function handleExport(format: ExportFormat) {
    if (
      project.emotionalSignals?.some((s) => s.level === "high") &&
      !window.confirm("检测到受访者在本段访谈中情绪较为激动，是否确认导出？")
    ) {
      return;
    }

    if (!canExport) {
      return;
    }

    setError(null);
    setActiveFormat(format);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${project.id}/export?format=${format}`,
        );

        if (!response.ok) {
          const payload = (await response.json()) as { message?: string };
          throw new Error(payload.message ?? "导出失败，请稍后重试。");
        }

        const blob = await response.blob();
        const fileName = readFileNameFromHeader(
          response.headers.get("Content-Disposition"),
          `${project.projectName}-archive.${format}`,
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        // 注意：此处不要 router.refresh()——会重渲染整棵 RSC 树，页面会闪一下，
        // 并且 status 变成 ready_to_export 后本面板会被卸载掉，没法连续导出其它格式
      } catch (exportError) {
        setError(
          exportError instanceof Error
            ? exportError.message
            : "导出失败，请稍后重试。",
        );
      } finally {
        setActiveFormat(null);
      }
    });
  }

  return (
    <section className="surface-card mt-4 rounded-[1.5rem] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">成果导出</p>
          <h3 className="mt-1.5 text-base font-semibold text-foreground">
            档案级输出
          </h3>
        </div>
        <p className="text-sm text-muted">
          支持 `.docx`、`.txt` 和结构化 `.json` 三种导出格式。
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {(Object.keys(formatMeta) as ExportFormat[]).map((format) => {
          const config = formatMeta[format];
          const Icon = config.icon;
          const isLoading = isPending && activeFormat === format;

          return (
            <Button
              key={format}
              variant={format === "docx" ? "primary" : "secondary"}
              className="justify-between"
              disabled={!canExport || isPending}
              onClick={() => handleExport(format)}
            >
              <span>{config.label}</span>
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </Button>
          );
        })}
      </div>

      {!canExport ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          需要先完成自动整理，才能生成档案导出文件。
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-[1.2rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
          {error}
        </div>
      ) : null}
    </section>
  );
}
