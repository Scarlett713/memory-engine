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
              {/* 徽标槽位的固定占位。useAuth 的 user 是组件内 state，客户端跳转回首页时
                  组件重新挂载 —— user 先是 null（徽标不渲染），/api/auth/me 到货后才插进来，
                  header 被撑高，下方列表跟着下跳。跳变量恒为 47px（徽标实测高度）+ 外层 gap-3
                  的 12px = 59px，与这一列里已排了几个 CTA 无关。
                  本列现在是「槽位 / 新建访谈项目 / 新建访谈（含提纲生成）」三项：两个 CTA
                  都不依赖异步数据、首帧即渲染，因此不参与占位 —— 只有槽位常驻 47px 才抵得掉
                  那 59px。min-h 取 47 而非 59：有徽标时 max(47, 47) 不生长，375px 的 header
                  保持原高；≥640px 槽位已被 CTA 撑到 54px，47 ≤ 54 同样不生长。全断点中性。 */}
              <div className="min-h-[47px]">
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
              </div>

              <Link
                href="/projects/new/outline"
                className="sidebar-secondary w-full px-5 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                新建访谈（含提纲生成）
              </Link>

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
