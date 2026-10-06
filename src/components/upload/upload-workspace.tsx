"use client";

import { Suspense } from "react";
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
              <h1 className="font-display mt-3 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem] md:text-[2.35rem]">
                音频处理
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
                上传录音后自动转写整理
              </p>
            </div>
          </div>
        </header>

        <section className="min-w-0 xl:min-h-0">
          {/* InterviewUploadForm 里用了 useSearchParams 读提纲标记位。
              静态预渲染路由下这是 CSR bailout，没有祖先 Suspense 会直接让 build 失败。 */}
          <Suspense
            fallback={
              <div className="surface-card rounded-[1.55rem] p-5 text-sm text-muted">
                正在加载表单…
              </div>
            }
          >
            <InterviewUploadForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
