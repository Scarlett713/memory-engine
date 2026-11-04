"use client";

import { useRouter } from "next/navigation";
import { AudioLines, Bot } from "lucide-react";

import type { BasicInfo } from "@/components/new-project/basic-info-form";
import {
  OUTLINE_FLAG_PARAM,
  readOutlineDraftSession,
  saveOutlineDraftToSession,
} from "@/lib/outline-session";

type RouteChooserProps = {
  /** 由 NewProjectFlow 经 props 直接下传，不经 context、不经 sessionStorage。 */
  basicInfo: BasicInfo;
  /** REQ-36：点「AI 实时访谈」只切到提纲步；建项挪到提纲确认时由流程容器做。 */
  onSelectAi: () => void;
};

export function RouteChooser({ basicInfo, onSelectAi }: RouteChooserProps) {
  const router = useRouter();

  // POST /api/projects/ai-interview 强制 projectName / intervieweeName 非空
  // （route.ts:123-139），所以基本信息的必填项在这里是再次生效的前置条件。
  const hasBasicInfo = Boolean(
    basicInfo.projectName.trim() && basicInfo.intervieweeName.trim(),
  );

  function handleUpload() {
    // REQ-36 Q3：上传路径不需要提纲 —— 先把草稿里的旧提纲清空，避免它随
    // ?outline=1 串进上传页；画像字段照带（上传页要用项目名 / 受访者预填）。
    saveOutlineDraftToSession("", readOutlineDraftSession()?.profile);
    // 标志位不能省：上传页在没有 outline=1 时会主动清掉草稿
    // （interview-upload-form.tsx:260-266），预填会全丢。
    router.push(`/upload?${OUTLINE_FLAG_PARAM}=1`);
  }

  function handleRealtime() {
    // 提纲与建项都交给流程容器的下一步：本组件不再直接建项目，
    // 也不再拦「无提纲」（REQ-36 把提纲挪到选择方式之后）。
    if (!hasBasicInfo) {
      return;
    }

    onSelectAi();
  }

  return (
    <div className="archive-frame paper-panel paper-panel-strong flex flex-col gap-5 rounded-[1.85rem] p-4 md:p-5">
      <div>
        <p className="section-eyebrow">选择方式</p>
        <h2 className="font-display mt-2 text-[1.35rem] font-semibold text-accent-strong">
          这次访谈怎么开始
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          已自动带入基本信息
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 卡片结构沿用上传页「采集路径」的两卡网格（interview-upload-form.tsx:738-786），
            但那版是 radio，这里每个动作各自独立，故用 button。 */}
        <button
          type="button"
          id="route-chooser-realtime"
          data-route="live"
          disabled={!hasBasicInfo}
          onClick={handleRealtime}
          className="relative rounded-[1.4rem] border-2 border-line/80 bg-white/55 p-5 text-left text-muted transition-colors hover:border-accent-strong hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:border-line/60 disabled:bg-white/40 disabled:text-muted/70"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <Bot className="h-4 w-4 text-accent-strong" />
              AI 实时访谈
            </span>
          </div>
          <span className="mt-2 block text-xs leading-6">
            按提纲逐题访谈并自动记录
          </span>
        </button>

        <button
          type="button"
          id="route-chooser-upload"
          data-route="upload"
          onClick={handleUpload}
          className="relative rounded-[1.4rem] border-2 border-line/80 bg-white/55 p-5 text-left text-muted transition-colors hover:border-accent-strong hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
        >
          <span className="flex items-center gap-2 font-semibold">
            <AudioLines className="h-4 w-4 text-accent-strong" />
            上传音频
          </span>
          <span className="mt-2 block text-xs leading-6">
            上传录音，自动转写整理
          </span>
        </button>
      </div>

      {!hasBasicInfo ? (
        <p className="text-xs leading-5 text-muted">
          AI 实时访谈需要访谈主题与受访者姓名，请先回到上一步填写。
        </p>
      ) : null}

      {/* 本组件不再渲染自己的「返回上一步」：header 里那个（new-project-flow.tsx:110-117）
          走同一个落点，同屏两个同文案返回入口违反「全流程唯一一个返回按钮」（P1 裁决）。 */}
      <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted">
          上传音频无需提纲；AI 实时访谈将在下一步生成提纲
        </p>
      </div>
    </div>
  );
}
