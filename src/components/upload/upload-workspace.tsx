"use client";

import { useEffect } from "react";
import { AudioWaveform, FileText, FolderArchive, Sparkles } from "lucide-react";

import { RecentProjectList } from "@/components/home/recent-project-list";
import { InterviewUploadForm } from "@/components/upload/interview-upload-form";
import { useProjectWorkspaceStore } from "@/store/project-workspace";

const stepLabels = [
  { label: "提纲构建", icon: FileText },
  { label: "音频上传", icon: FolderArchive },
  { label: "自动转写", icon: AudioWaveform },
  { label: "AI 整理", icon: Sparkles },
];

export function UploadWorkspace() {
  const projects = useProjectWorkspaceStore((state) => state.projects);
  const isLoading = useProjectWorkspaceStore((state) => state.isLoading);
  const fetchProjects = useProjectWorkspaceStore((state) => state.fetchProjects);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return (
    <main className="h-[100dvh] overflow-hidden px-1 py-1 sm:px-1.5 sm:py-1.5">
      <div className="grid h-full gap-2 grid-rows-[auto_minmax(0,1fr)]">
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
                <h1 className="font-display mt-2 text-[1.9rem] font-semibold leading-tight text-accent-strong md:text-[2.35rem]">
                  音频建档与处理
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
                  先完成聊天式提纲构建，再把本地受访音频与项目信息一起建档，进入自动转写与整理流程。
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">项目总量</span>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {projects.length}
                </p>
              </div>
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">当前阶段</span>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Step 02 / 上传音频
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {stepLabels.map(({ label, icon: Icon }, index) => (
              <div
                key={label}
                className="surface-card flex items-center gap-3 rounded-[1.2rem] px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-deep text-white shadow-[0_10px_25px_rgba(30,55,55,0.18)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-0.5 text-xs text-muted">0{index + 1} 节点</p>
                </div>
              </div>
            ))}
          </div>
        </header>

        <section className="grid min-h-0 gap-2 xl:grid-cols-[1.2fr_0.8fr] xl:items-stretch">
          <div className="min-h-0">
            <InterviewUploadForm />
          </div>
          <div className="min-h-0">
            <RecentProjectList projects={projects} isLoading={isLoading} />
          </div>
        </section>
      </div>
    </main>
  );
}
