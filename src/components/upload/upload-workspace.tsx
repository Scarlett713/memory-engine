"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { InterviewUploadForm } from "@/components/upload/interview-upload-form";

export function UploadWorkspace() {
  return (
    <main className="min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5 xl:h-dvh xl:overflow-hidden">
      <div className="flex flex-col gap-2 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]">
        <header className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] px-4 py-4 md:px-5 md:py-4">
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
              <p className="section-eyebrow mt-3">记忆引擎</p>
              <h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem] md:text-[2.35rem]">
                音频建档与处理
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
                填写受访人基础信息，上传本地音视频文件，进入自动转写与整理流程。
              </p>
            </div>
          </div>
        </header>

        <section className="min-w-0 xl:min-h-0">
          <InterviewUploadForm />
        </section>
      </div>
    </main>
  );
}
