"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AudioLines, Bot, LoaderCircle, NotebookPen } from "lucide-react";

import type { BasicInfo } from "@/components/new-project/basic-info-form";
import { DEFAULT_COLLECTION_SCENARIO } from "@/components/outline/outline-plan-workspace";
import { Button } from "@/components/ui/button";
import {
  OUTLINE_FLAG_PARAM,
  readOutlineDraftSession,
} from "@/lib/outline-session";

type RouteChooserProps = {
  /** 由 NewProjectFlow 经 props 直接下传，不经 context、不经 sessionStorage。 */
  basicInfo: BasicInfo;
  /** 引导弹窗的「去补填」；路由语义由流程容器负责，本组件不碰。 */
  onBackToOutline: () => void;
};

/**
 * 无提纲时选「AI 实时访谈」的引导弹窗。
 * 结构镜像 interview-upload-form.tsx:84-184 的 ConsentDialog（本仓唯一真实 modal 的先例）：
 * 条件渲染 + fixed 遮罩 + role="dialog" + Escape 关闭，不引第三方依赖。
 */
function OutlineRequiredDialog({
  open,
  onClose,
  onGoOutline,
}: {
  open: boolean;
  onClose: () => void;
  onGoOutline: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  // 必须挂到 body：本组件嵌在 .paper-panel 之内（route-chooser.tsx 的根元素就是它），
  // 而 .paper-panel 会从两处破坏 fixed ——
  // (1) backdrop-filter: blur(24px)（globals.css:104）让面板成为 fixed 后代的包含块，
  //     遮罩于是相对面板而非视口定位；
  // (2) 未分层的 `.paper-panel > * { position: relative }`（globals.css:125）直接压掉
  //     Tailwind 的 .fixed —— 后者在 @layer utilities 里，未分层正常声明恒胜过分层声明。
  // 实测后果：遮罩的计算样式是 relative，inset-0 失效，它退回文档流堆在卡片页脚之后，
  // 再被 .paper-panel 的 overflow: hidden 裁掉 —— 就是「提示出现在页面底部而非弹窗」。
  // 挂到 body 一次摆脱这两个问题。
  return createPortal(
    <div
      data-route-modal="outline-required"
      className="fixed inset-0 z-[70] bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div className="flex h-full flex-col items-center justify-center p-3 sm:p-5">
        {/* stopPropagation 必须挂在卡片上，不能挂上面那层包裹 div —— 它是 flex h-full，
            铺满整个遮罩，挂它上面会把「点遮罩关闭」整个吃掉（实测：点 (6,6) 无效）。
            点遮罩只关弹窗、不触发 onBackToOutline —— 用户留在分流步，随时可以重选。 */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outline-required-title"
          onClick={(event) => event.stopPropagation()}
          className="paper-panel paper-panel-strong flex w-full max-w-xl flex-col rounded-[2rem] px-4 py-5 md:px-6 md:py-6"
        >
          <div className="flex items-center gap-2 text-accent-strong">
            <NotebookPen className="h-5 w-5" />
            <p className="section-eyebrow">还差一步</p>
          </div>

          <h2
            id="outline-required-title"
            className="font-display mt-2 text-[1.5rem] font-semibold text-accent-strong"
          >
            需要访谈提纲
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted">
            AI
            实时访谈需要提纲来引导对话。请先完成提纲，再开始访谈。补填完成后回到这一步重新选择即可。
          </p>

          <div className="mt-4 flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-center sm:w-auto"
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              type="button"
              className="w-full justify-center sm:w-auto sm:min-w-[140px]"
              onClick={onGoOutline}
            >
              返回提纲步骤
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function RouteChooser({ basicInfo, onBackToOutline }: RouteChooserProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // POST /api/projects/ai-interview 强制 projectName / intervieweeName 非空
  // （route.ts:123-139），所以基本信息的必填项在这里是再次生效的前置条件。
  const hasBasicInfo = Boolean(
    basicInfo.projectName.trim() && basicInfo.intervieweeName.trim(),
  );

  function handleUpload() {
    // 标志位不能省：上传页在没有 outline=1 时会主动清掉草稿
    // （interview-upload-form.tsx:260-266），预填会全丢。
    router.push(`/upload?${OUTLINE_FLAG_PARAM}=1`);
  }

  async function handleRealtime() {
    if (!hasBasicInfo || isCreating) {
      return;
    }

    const markdown = readOutlineDraftSession()?.outlineMarkdown?.trim() ?? "";

    if (!markdown) {
      // 提纲是流程内的可选步骤，但 AI 分支必须要有提纲。
      // 不放开 API 契约，改为引导回提纲步补填（PRD §5.3）。
      setIsGuideOpen(true);
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/projects/ai-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // payload 与 outline-plan-workspace.tsx:349-358 逐字段一致。
        body: JSON.stringify({
          projectName: basicInfo.projectName.trim(),
          intervieweeName: basicInfo.intervieweeName.trim(),
          institutionName: "",
          researchFocus: basicInfo.overview.trim(),
          collectionScenario: DEFAULT_COLLECTION_SCENARIO,
          notes: basicInfo.overview.trim(),
          outlineDraftMarkdown: markdown,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as { project?: { id?: string }; message?: string } | null;
      const projectId = payload?.project?.id;

      if (!response.ok || !projectId) {
        throw new Error(payload?.message ?? "创建项目失败");
      }

      router.push(`/projects/${projectId}/interview`);
    } catch {
      setError("创建项目失败，请重试。");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="archive-frame paper-panel paper-panel-strong flex flex-col gap-5 rounded-[1.85rem] p-4 md:p-5">
      <div>
        <p className="section-eyebrow">选择方式</p>
        <h2 className="font-display mt-2 text-[1.35rem] font-semibold text-accent-strong">
          这次访谈怎么开始
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          两种方式都会带上你刚填的基本信息，不需要再填一遍。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 卡片结构沿用上传页「采集路径」的两卡网格（interview-upload-form.tsx:738-786），
            但那版是 radio，这里每个动作各自独立，故用 button。 */}
        <button
          type="button"
          id="route-chooser-realtime"
          data-route="live"
          disabled={!hasBasicInfo || isCreating}
          onClick={() => void handleRealtime()}
          className="relative rounded-[1.4rem] border-2 border-line/80 bg-white/55 p-5 text-left text-muted transition-colors hover:border-accent-strong hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:border-line/60 disabled:bg-white/40 disabled:text-muted/70"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <Bot className="h-4 w-4 text-accent-strong" />
              AI 实时访谈
            </span>
            {isCreating ? (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
            ) : null}
          </div>
          <span className="mt-2 block text-xs leading-6">
            用提纲驱动 AI 逐题追问，边聊边录，结束后直接进访谈控制台。
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
            已经有录音了？上传音频文件，自动转写、整理与脱敏。
          </span>
        </button>
      </div>

      {!hasBasicInfo ? (
        <p className="text-xs leading-5 text-muted">
          AI 实时访谈需要访谈主题与受访者姓名，请先回到上一步填写。
        </p>
      ) : null}

      {error ? (
        <div className="rounded-[1.4rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
          {error}
        </div>
      ) : null}

      {/* 本组件不再渲染自己的「返回上一步」：header 里那个（new-project-flow.tsx:110-117）
          走同一个落点（step 3 → step 2），同屏两个同文案返回入口违反
          new-project-flow.tsx:108 的「全流程唯一一个返回按钮」（P1 裁决）。
          onBackToOutline 保留，由下面的 OutlineRequiredDialog 消费。 */}
      <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted">
          提纲留空也可以直接上传音频。
        </p>
      </div>

      <OutlineRequiredDialog
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onGoOutline={() => {
          setIsGuideOpen(false);
          onBackToOutline();
        }}
      />
    </div>
  );
}
