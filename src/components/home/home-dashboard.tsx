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
                  口述项目工作台
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
                  新建访谈、续写草稿、打开已建档项目，都在这一页。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:min-w-[420px] xl:justify-end">
              {/* 徽标槽位的固定占位。useAuth 的 user 是组件内 state，客户端跳转回首页时
                  组件重新挂载 —— user 先是 null（徽标不渲染），/api/auth/me 到货后才插进来，
                  header 被撑高，下方三区跟着下跳。

                  REQ-16 把两个新建 CTA 迁进「新建」区后，本列只剩槽位一项：
                  无徽标时槽位被 min-h 撑到 47px；徽标到货后内容高 47px，max(47, 47) 不生长。
                  单子元素不产生 gap-3 的子项间距，故跳变量为 0，全断点中性。
                  47 已由 measure-375.mjs 复测定稿（Phase 4，三视口一致）。 */}
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
            </div>
          </div>
        </header>

        <section className="flex min-w-0 flex-col gap-2 xl:grid xl:min-h-0 xl:grid-cols-[minmax(0,17rem)_minmax(0,17rem)_minmax(0,1fr)]">
          <div
            data-home-zone="new"
            className="paper-panel archive-frame flex flex-col gap-3 rounded-[2rem] p-5 xl:min-h-0"
          >
            <p className="section-eyebrow">新建</p>
            <h2 className="font-display text-[1.35rem] font-semibold text-accent-strong">
              开始一个新项目
            </h2>
            <p className="text-sm leading-6 text-muted">
              填写受访者与访谈主题，生成个性化提纲后进入建档流程。
            </p>
            {/* 首页唯一的新建入口。REQ-16 之前 header 里有两个 CTA（/projects/new/outline
                与 /upload），现收敛为这一个；/upload 降级为非首页入口，仅由提纲链路跳入。 */}
            <Link
              href="/projects/new"
              className="sidebar-cta mt-auto w-full px-5"
            >
              <Plus className="h-4 w-4" />
              新建访谈
            </Link>
          </div>

          <div
            data-home-zone="draft"
            className="paper-panel archive-frame flex flex-col gap-3 rounded-[2rem] p-5 xl:min-h-0"
          >
            <p className="section-eyebrow">草稿</p>
            <h2 className="font-display text-[1.35rem] font-semibold text-accent-strong">
              未完成的草稿
            </h2>
            {/* REQ-15 未到位，本区只落空态：不读写存储、不自建第二套 sessionStorage。 */}
            <div className="surface-card rounded-[1.5rem] p-5">
              <p className="text-sm font-semibold text-accent-strong">暂无草稿</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                新建访谈后未提交的内容会出现在这里，可随时继续填写。
              </p>
            </div>
          </div>

          {/* 历史项目区：外壳只出面板与内边距，区头（eyebrow + 「历史项目」+ 计数 pill）
              由 RecentProjectList 自己渲染，避免两处标题重复。 */}
          <div
            data-home-zone="projects"
            className="paper-panel archive-frame flex min-w-0 flex-col rounded-[2rem] p-5 xl:min-h-0"
          >
            <RecentProjectList projects={projects} isLoading={isLoading} />
          </div>
        </section>
      </div>
    </main>
  );
}
