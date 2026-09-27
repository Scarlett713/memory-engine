import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AudioLines, CalendarClock, UserRound } from "lucide-react";

import { ProjectDetailTabs } from "@/components/projects/project-detail-tabs";
import { ProjectWorkflowBoard } from "@/components/projects/project-workflow-board";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getProjectById,
  isProjectOwnedBy,
} from "@/lib/server/project-store";
import { formatDateTime } from "@/lib/utils";

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    autostart?: string;
  }>;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const { autostart } = await searchParams;
  const userId = (await headers()).get("x-user-id") ?? "";
  const project = await getProjectById(projectId);

  if (!project || !isProjectOwnedBy(project, userId)) {
    notFound();
  }

  return (
    <main className="min-h-[100dvh] px-1 py-1 sm:px-1.5 sm:py-1.5">
      <div className="grid gap-2">
        <section className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] p-4 md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="archive-mark hidden sm:grid">
                  <span />
                  <span />
                  <span />
                </div>

                <div>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    返回工作台
                  </Link>
                  <p className="section-eyebrow mt-3">口述项目</p>
                  <h1 className="font-display mt-2 text-[1.9rem] font-semibold leading-tight text-accent-strong md:text-[2.35rem]">
                    {project.projectName}
                  </h1>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
                    {project.notes || "当前项目未填写项目说明。"}
                  </p>
                </div>
              </div>

              <StatusBadge status={project.status} />
            </div>

            <div className="grid gap-1.5 sm:grid-cols-3 sm:gap-2">
              <div className="surface-card min-w-0 rounded-xl px-3 py-2 sm:rounded-[1.2rem] sm:px-4 sm:py-3 flex items-center justify-between sm:block">
                <span className="section-eyebrow">受访对象</span>
                <p className="sm:mt-2 flex min-w-0 items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                  <UserRound className="hidden sm:block h-4 w-4 text-accent-strong" />
                  <span className="truncate">{project.intervieweeName || "未填写"}</span>
                </p>
              </div>
              <div className="surface-card min-w-0 rounded-xl px-3 py-2 sm:rounded-[1.2rem] sm:px-4 sm:py-3 flex items-center justify-between sm:block">
                <span className="section-eyebrow">受访音频</span>
                <p className="sm:mt-2 flex min-w-0 items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                  <AudioLines className="hidden sm:block h-4 w-4 text-accent-strong" />
                  <span className="truncate">{project.audioFileName}</span>
                </p>
              </div>
              <div className="surface-card min-w-0 rounded-xl px-3 py-2 sm:rounded-[1.2rem] sm:px-4 sm:py-3 flex items-center justify-between sm:block">
                <span className="section-eyebrow">建档时间</span>
                <p className="sm:mt-2 flex min-w-0 items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                  <CalendarClock className="hidden sm:block h-4 w-4 text-accent-strong" />
                  <span className="truncate">{formatDateTime(project.createdAt)}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-2">
          <ProjectWorkflowBoard workflow={project.workflow} />
          <ProjectDetailTabs
            project={project}
            autoStart={autostart === "1"}
          />
        </div>
      </div>
    </main>
  );
}
