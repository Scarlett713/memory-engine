"use client";

import { useEffect } from "react";
import {
  AudioWaveform,
  BrainCircuit,
  FolderArchive,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { RecentProjectList } from "@/components/home/recent-project-list";
import { InterviewUploadForm } from "@/components/upload/interview-upload-form";
import { useProjectWorkspaceStore } from "@/store/project-workspace";

const workflowLabels = [
  {
    label: "上传音频",
    icon: FolderArchive,
  },
  {
    label: "采集辅助",
    icon: BrainCircuit,
  },
  {
    label: "自动转写",
    icon: AudioWaveform,
  },
  {
    label: "情绪识别",
    icon: HeartHandshake,
  },
  {
    label: "AI整理脱敏",
    icon: Sparkles,
  },
  {
    label: "人工审校与导出",
    icon: ShieldCheck,
  },
];

export function HomeWorkspace() {
  const projects = useProjectWorkspaceStore((state) => state.projects);
  const isLoading = useProjectWorkspaceStore((state) => state.isLoading);
  const fetchProjects = useProjectWorkspaceStore((state) => state.fetchProjects);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
      <div className="flex flex-col gap-4">
        <header className="archive-frame paper-panel paper-panel-strong rounded-[2rem] px-5 py-5 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="archive-mark hidden sm:grid">
                <span />
                <span />
                <span />
              </div>

              <div>
                <p className="section-eyebrow">记忆引擎</p>
                <h1 className="font-display mt-2 text-[2rem] font-semibold leading-tight text-accent-strong md:text-[2.75rem]">
                  口述项目工作台
                </h1>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[480px]">
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">项目总量</span>
                <p className="mt-2 text-xl font-semibold text-foreground">{projects.length}</p>
              </div>
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">当前流程</span>
                <p className="mt-2 text-sm font-semibold text-foreground">上传即自动处理</p>
              </div>
              <div className="surface-card rounded-[1.2rem] px-4 py-3">
                <span className="section-eyebrow">报告形态</span>
                <p className="mt-2 text-sm font-semibold text-foreground">可审校稿件</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            {workflowLabels.map(({ label, icon: Icon }, index) => (
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

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:items-stretch">
          <InterviewUploadForm />
          <RecentProjectList projects={projects} isLoading={isLoading} />
        </section>
      </div>
    </main>
  );
}
