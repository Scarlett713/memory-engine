"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { RecentProjectList } from "@/components/home/recent-project-list";
import { useAuth } from "@/hooks/useAuth";
import { useProjectWorkspaceStore } from "@/store/project-workspace";

export function HomeDashboard() {
  const projects = useProjectWorkspaceStore((state) => state.projects);
  const isLoading = useProjectWorkspaceStore((state) => state.isLoading);
  const fetchProjects = useProjectWorkspaceStore((state) => state.fetchProjects);
  const { user, logout } = useAuth();

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return (
    <main className="min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5 xl:h-dvh xl:overflow-hidden">
      <div className="flex flex-col gap-2 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]">
        <header className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] px-4 py-4 md:px-5 md:py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="archive-mark hidden sm:grid">
                <span />
                <span />
                <span />
              </div>

              <div>
                <p className="section-eyebrow">记忆引擎</p>
                <h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem] md:text-[2.35rem]">
                  已建档口述项目
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
                  全部受访项目的归档入口。打开任一项目即可进入处理台，查看转写、整理与导出进度。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:min-w-[420px] xl:justify-end">
              {user ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 sm:justify-start">
                  <div className="min-w-0">
                    <p
                      className="truncate text-xs font-medium text-stone-700"
                      title={user.email}
                    >
                      {user.email}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {user.userType === "personal" ? "个人版" : "机构版"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="ml-2 shrink-0 text-[11px] text-stone-400 transition-colors hover:text-red-500"
                  >
                    退出
                  </button>
                </div>
              ) : null}

              <Link href="/upload" className="sidebar-cta w-full px-5 sm:w-auto">
                <Plus className="h-4 w-4" />
                新建访谈项目
              </Link>
            </div>
          </div>
        </header>

        <section className="min-w-0 xl:min-h-0">
          <RecentProjectList projects={projects} isLoading={isLoading} />
        </section>
      </div>
    </main>
  );
}
