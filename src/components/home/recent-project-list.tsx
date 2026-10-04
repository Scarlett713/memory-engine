"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Clock3,
  FolderArchive,
  LoaderCircle,
  Trash2,
  Workflow,
} from "lucide-react";

import { getWorkflowStatusLabel } from "@/components/projects/project-workflow-board";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  HOME_SCROLL_STORAGE_KEY,
  useScrollRestoration,
} from "@/hooks/useScrollRestoration";
import type { ProjectRecord } from "@/lib/types/project";
import { formatDateTime } from "@/lib/utils";
import { useProjectWorkspaceStore } from "@/store/project-workspace";

type RecentProjectListProps = {
  projects: ProjectRecord[];
  isLoading: boolean;
};

function getCompletedStepCount(project: ProjectRecord) {
  return project.workflow.filter((item) => item.status === "completed").length;
}

export function RecentProjectList({
  projects,
  isLoading,
}: RecentProjectListProps) {
  const deleteProject = useProjectWorkspaceStore((state) => state.deleteProject);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 记住首页列表的滚动位置，从项目详情页返回时恢复。
  // ready 跟 isLoading 走：加载占位块插在卡片上方会整体下移列表，等它落定再钳位恢复。
  useScrollRestoration(scrollContainerRef, {
    storageKey: HOME_SCROLL_STORAGE_KEY,
    persistPath: "/",
    ready: !isLoading,
  });

  function handleDelete(projectId: string) {
    if (!window.confirm("确定要删除该项目吗？此操作不可恢复。")) return;

    setError(null);
    setPendingProjectId(projectId);

    startTransition(async () => {
      try {
        await deleteProject(projectId);
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "删除项目失败，请稍后重试。",
        );
      } finally {
        setPendingProjectId(null);
      }
    });
  }

  return (
    <section className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">项目索引</p>
          <h2 className="font-display mt-2 text-[1.35rem] font-semibold text-accent-strong">
            历史项目
          </h2>
        </div>

        <div className="meta-pill text-sm font-medium text-muted">
          <FolderArchive className="h-4 w-4 text-accent-strong" />
          {projects.length} 个项目
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[1.2rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
          {error}
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        className="soft-scroll mt-4 pr-1 xl:min-h-0 xl:flex-1 xl:overflow-auto"
      >
        <div className="space-y-3">
          {/* 有项目时不再插占位块：列表已经在屏幕上，这块既没有信息量，又会把
              下面所有卡片整体下推、在返回首页时造成一次可见的内容抖动。 */}
          {isLoading && projects.length === 0 ? (
            <div className="surface-card rounded-[1.4rem] p-5 text-sm text-muted">
              正在加载项目列表...
            </div>
          ) : null}

          {!isLoading && projects.length === 0 ? (
            <div className="surface-card rounded-[1.5rem] p-6">
              <div className="flex items-center gap-3 text-accent-strong">
                <FolderArchive className="h-5 w-5" />
                <p className="text-sm font-semibold">暂无项目</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                点上方「新建访谈」开始建档，完成后项目会出现在这里。
              </p>
            </div>
          ) : null}

          {projects.map((project) => {
            const completedSteps = getCompletedStepCount(project);
            const progress = `${Math.round(
              (completedSteps / project.workflow.length) * 100,
            )}%`;
            const isDeleting =
              isPending && pendingProjectId === project.id;
            // 当前阶段：优先「进行中」的那一步，没有就退回第一个「待处理」。
            // 全部完成时不显示——此时 StatusBadge 已经在说结果了。
            const activeStep =
              project.workflow.find((step) => step.status === "in_progress") ??
              project.workflow.find((step) => step.status === "pending");

            return (
              <article
                key={project.id}
                className="surface-card rounded-[1.45rem] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {project.projectName}
                      </h3>
                      <StatusBadge status={project.status} />
                      {activeStep ? (
                        <span className="meta-pill text-xs font-medium text-muted">
                          当前阶段：{activeStep.label} ·{" "}
                          {getWorkflowStatusLabel(activeStep)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-sm text-muted">
                      受访对象：{project.intervieweeName || "未填写"}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted">
                      受访音频：{project.audioFileName}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="meta-pill text-sm font-medium text-accent-strong transition-colors hover:text-accent-strong/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
                    >
                      打开
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line/70 bg-white/72 text-muted transition-colors hover:border-danger/20 hover:bg-danger/8 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isDeleting}
                      onClick={() => handleDelete(project.id)}
                      aria-label={`删除项目 ${project.projectName}`}
                    >
                      {isDeleting ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  <div className="rounded-[1rem] border border-line/70 bg-white/58 px-3 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock3 className="h-4 w-4 text-accent-strong" />
                      建档时间
                    </span>
                    <p className="mt-1.5 text-sm text-muted">
                      {formatDateTime(project.createdAt)}
                    </p>
                  </div>

                  <div className="rounded-[1rem] border border-line/70 bg-white/58 px-3 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Workflow className="h-4 w-4 text-accent-strong" />
                      进度
                    </span>
                    <p className="mt-1.5 text-sm text-muted">
                      {completedSteps} / {project.workflow.length} 已完成
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-2 rounded-full bg-accent-soft/65">
                  <div
                    className="h-full rounded-full bg-deep shadow-[0_8px_18px_rgba(30,55,55,0.2)]"
                    style={{ width: progress }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
