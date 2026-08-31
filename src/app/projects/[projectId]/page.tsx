import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  AudioLines,
  Building2,
  CalendarClock,
  UserRound,
} from "lucide-react";

import { ProjectDetailTabs } from "@/components/projects/project-detail-tabs";
import { ProjectWorkflowBoard } from "@/components/projects/project-workflow-board";
import { StatusBadge } from "@/components/ui/status-badge";
import { getInterviewScenarioLabel } from "@/lib/oral-history";
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

              <div className="flex flex-col items-start gap-2 xl:items-end">
                <StatusBadge status={project.status} />
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <div className="meta-pill">
                    <AudioLines className="h-4 w-4 text-accent-strong" />
                    受访音频已归档
                  </div>
                  <div className="meta-pill">
                    <Building2 className="h-4 w-4 text-accent-strong" />
                    {getInterviewScenarioLabel(project.collectionScenario)}
                  </div>
                  <div className="meta-pill">
                    <CalendarClock className="h-4 w-4 text-accent-strong" />
                    最近更新 {formatDateTime(project.updatedAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">受访对象</span>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserRound className="h-4 w-4 text-accent-strong" />
                  {project.intervieweeName || "未填写"}
                </p>
              </div>
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">受访音频</span>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AudioLines className="h-4 w-4 text-accent-strong" />
                  {project.audioFileName}
                </p>
              </div>
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">建档时间</span>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarClock className="h-4 w-4 text-accent-strong" />
                  {formatDateTime(project.createdAt)}
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
