"use client";

import { useState } from "react";
import { FolderArchive, Sparkles } from "lucide-react";

import { ProjectOverviewPanel } from "@/components/projects/project-overview-panel";
import { ProjectProcessingConsole } from "@/components/projects/project-processing-console";
import { ProjectQAPanel } from "@/components/projects/project-qa-panel";
import type { ProjectRecord } from "@/lib/types/project";

type ProjectDetailTabsProps = {
  project: ProjectRecord;
  autoStart: boolean;
};

const TAB_ACTIVE =
  "inline-flex items-center gap-2 rounded-full border border-accent-soft bg-accent-soft/70 px-4 py-2 text-sm font-semibold text-accent-strong";
const TAB_IDLE =
  "inline-flex items-center gap-2 rounded-full border border-line/60 bg-white/60 px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground";

export function ProjectDetailTabs({
  project,
  autoStart,
}: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"review" | "archive">("review");

  return (
    <div className="grid gap-2">
      <div
        role="tablist"
        aria-label="项目视图切换"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "review"}
          onClick={() => setActiveTab("review")}
          className={activeTab === "review" ? TAB_ACTIVE : TAB_IDLE}
        >
          <Sparkles className="h-4 w-4" />
          整理处理
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "archive"}
          onClick={() => setActiveTab("archive")}
          className={activeTab === "archive" ? TAB_ACTIVE : TAB_IDLE}
        >
          <FolderArchive className="h-4 w-4" />
          档案概览
        </button>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === "review" ? (
          <ProjectProcessingConsole project={project} autoStart={autoStart} />
        ) : (
          <div className="grid gap-2">
            <ProjectOverviewPanel project={project} />
            {project.status === "manual_review" ||
            project.status === "ready_to_export" ? (
              <ProjectQAPanel projectId={project.id} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
