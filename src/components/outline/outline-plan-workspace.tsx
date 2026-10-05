"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { nanoid } from "nanoid";

import { Button } from "@/components/ui/button";
import { MarkdownSheet } from "@/components/ui/markdown-sheet";
import {
  OUTLINE_FLAG_PARAM,
  saveOutlineDraftToSession,
} from "@/lib/outline-session";
import type { OutlineChatMessage } from "@/lib/types/outline";
import type { InterviewScenario } from "@/lib/types/project";

const MESSAGE_MAX_LENGTH = 1000;
// 与 route 的 MESSAGE_HISTORY_LIMIT 对齐：历史只留最近 10 条。
const MESSAGE_HISTORY_LIMIT = 10;

/**
 * UI-12：机构 / 采集场景 / 研究焦点 / 重大事件 / 时间节点 / 伦理备注六项已合并进
 * 「访谈内容概述」自由文本框，前端不再采集。这些 key 在请求契约里仍然存在，
 * 故按 PRD §4 发默认值占位（不删 key，不触数据层冻结面）。
 */
// 导出给 REQ-21 的分流步复用（route-chooser.tsx 建 AI 项目时发同一个默认场景），
// 避免两处各写一份 "urban_memory" 日后漂移。
export const DEFAULT_COLLECTION_SCENARIO: InterviewScenario = "urban_memory";
// 与服务端 NOTES_MAX_LENGTH 对齐。
const OVERVIEW_MAX_LENGTH = 1000;

// UI-24：与 project-detail-tabs.tsx:16-19 同一个类串（那份没导出，本地复制）。
const TAB_ACTIVE =
  "inline-flex items-center gap-2 rounded-full border border-accent-soft bg-accent-soft/70 px-4 py-2 text-sm font-semibold text-accent-strong";
const TAB_IDLE =
  "inline-flex items-center gap-2 rounded-full border border-line/60 bg-white/60 px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground";

type OutlineGenerateResponse = {
  markdown?: string;
  error?: string;
  // 老 route 用的是 message 信封，读的时候两个都认。
  message?: string;
};

type OutlineChatResponse = {
  markdown?: string;
  assistantMessage?: string;
  error?: string;
};

// LLM 失败时的通用模板。有主题就把主题填进去，没有则留占位符。
function buildFallbackMarkdown(topic: string) {
  return [
    "## 开场",
    "- 请先介绍一下您自己",
    "",
    "## 主要经历",
    "- 请谈谈您印象最深的经历",
    "",
    "## 深入探讨",
    `- 关于 ${topic.trim() || "[主题]"}，您有什么想特别说的？`,
    "",
    "## 结束",
    "- 还有什么想补充的？",
  ].join("\n");
}

type OutlinePlanWorkspaceProps = {
  /**
   * 被 REQ-21 三步流程当作「提纲步」宿主渲染时为 true：
   * 去掉自带的整页外壳（<main> / dvh 高度 / 返回链接与标题块），只留表单与提纲本体。
   * 默认 false —— 独立路由已于 Phase 3 改为 307 跳板；此 flag 控制嵌入式渲染的外壳与按钮差异。
   */
  embedded?: boolean;
  /**
   * 提供时取代「确认 / 跳过」两条路径里的 router.push，把下一步交给宿主。
   * 无论是否提供，草稿都照常写 sessionStorage（分流步的提纲判定与上传页预填都靠它）。
   */
  onContinue?: (result: { skipped: boolean }) => void;
  /**
   * 「主题」输入框的初值。默认 "" —— 不传时与本次改动前的行为逐字一致。
   * 三步流程传基本信息步的项目名，免去用户在提纲步重输（PRD REQ-21 §5.2）。
   */
  initialTopic?: string;
  /**
   * 「受访者」输入框的初值。默认 "" —— 不传时与本次改动前的行为逐字一致。
   * 与 initialTopic 同源，取自基本信息步的受访者姓名。
   */
  initialSubject?: string;
};

export function OutlinePlanWorkspace({
  embedded = false,
  onContinue,
  initialTopic,
  initialSubject,
}: OutlinePlanWorkspaceProps = {}) {
  const router = useRouter();

  const [subject, setSubject] = useState(initialSubject ?? "");
  const [topic, setTopic] = useState(initialTopic ?? "");
  // UI-12：六个被合并字段共用这一个自由文本框，提交时双写进
  // researchFocus 与 ethicsNotes / notes（见 PRD §4 决策记录）。
  const [overview, setOverview] = useState("");

  const [markdown, setMarkdown] = useState("");
  const [notice, setNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 对话历史只活在页面里：不写 sessionStorage，刷新即丢（本轮约定）。
  const [messages, setMessages] = useState<OutlineChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isEnteringInterview, setIsEnteringInterview] = useState(false);
  // 提纲默认给渲染后的样子；要动手改再切回编辑。
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  // UI-24 两阶段：phase 是唯一的阶段真源（不用 Boolean(markdown) 派生 ——
  // 编辑态把 markdown 清空不该把整页弹回填写态）。
  const [phase, setPhase] = useState<"form" | "outline">("form");
  // PC（xl）overlay 抽屉开合。
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  // 移动端（<xl）Tab。初值取 "outline"：phase="form" 时 Tab 不渲染，该值无副作用；
  // 万一哪条路径漏了 setMobileTab，兜底也落在产品确认的默认位「提纲修改」。
  const [mobileTab, setMobileTab] = useState<"form" | "outline">("outline");

  // 记住上一次生成的原文，用来判断用户是不是手动改过。
  const lastGeneratedRef = useRef("");
  const canGenerate =
    Boolean(subject.trim() && topic.trim()) && !isGenerating && !isChatting;
  const canChat = Boolean(chatInput.trim()) && !isChatting && !isGenerating;
  // AI 访谈建项目强制要提纲 + 项目名 + 受访对象（route 侧同样校验），三者齐了才放行。
  const canEnterAiInterview =
    Boolean(markdown.trim() && subject.trim() && topic.trim()) &&
    !isEnteringInterview &&
    !isGenerating &&
    !isChatting;

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 空历史直接 return：生成成功会 setMessages([])，新数组引用照样触发本 effect，
    // 此时若照滚会把页面硬拽到对话区。
    if (!messages.length) {
      return;
    }

    // block: "nearest" 只滚最近的滚动祖先（PC 阶段 2 是那个 flex-1 消息区，
    // 阶段 1 与移动端阶段 2 则是页面本身），不连带滚整页。
    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    // 第二个条件是给对话历史留的：handleChat 成功时会把 lastGeneratedRef 同步成新 markdown，
    // 所以「对话改过」在第一个条件看来等于「没改过」。但重新生成会清空对话历史，
    // 不能一声不吭地把多轮记录丢掉，必须也走一次确认。
    if (
      markdown.trim() &&
      (markdown !== lastGeneratedRef.current || messages.length > 0)
    ) {
      const confirmed = window.confirm(
        "重新生成将覆盖当前提纲并清空对话记录，确定继续？",
      );

      if (!confirmed) {
        return;
      }
    }

    setIsGenerating(true);
    setNotice("");

    try {
      const response = await fetch("/api/outline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: subject.trim(),
          topic: topic.trim(),
          institution: "",
          // 双写：契约里没有能同时承载「人物背景 + 访谈内容 + 主要事件」的字段。
          researchFocus: overview.trim(),
          collectionScenario: DEFAULT_COLLECTION_SCENARIO,
          events: [],
          timePoints: [],
          ethicsNotes: overview.trim(),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as OutlineGenerateResponse | null;
      const generated = payload?.markdown?.trim() ?? "";

      if (!response.ok || !generated) {
        throw new Error(payload?.error ?? payload?.message ?? "生成失败");
      }

      // 提纲真被替换了才清空对话历史（方案 B：随结果清空，不随意图清空）。
      // 用户取消上面的确认弹窗会 early return，历史完整保留。
      setMarkdown(generated);
      setMessages([]);
      lastGeneratedRef.current = generated;
      setNotice("");
      enterOutlinePhase();
    } catch {
      // 这一支不 rethrow，markdown 同样被换成了通用模板，所以一并清历史。
      const fallback = buildFallbackMarkdown(topic);
      setMarkdown(fallback);
      setMessages([]);
      lastGeneratedRef.current = fallback;
      setNotice("LLM 生成失败，已载入通用模板，可手动调整");
      // 兜底模板同样算「已产出提纲」，照切阶段 2。
      enterOutlinePhase();
    } finally {
      setIsGenerating(false);
    }
  }

  /**
   * UI-24：产出提纲后统一收口。放在「生成中」之外 —— isGenerating 全程不动 phase，
   * 所以首次生成期间保持阶段 1，已在阶段 2 时重新生成也不闪回填写态。
   */
  function enterOutlinePhase() {
    setPhase("outline");
    setMobileTab("outline");
    setIsFormDrawerOpen(false);
  }

  async function handleChat() {
    const instruction = chatInput.trim();

    if (!instruction || isChatting || isGenerating) {
      return;
    }

    const userMessage: OutlineChatMessage = {
      id: nanoid(8),
      role: "user",
      content: instruction.slice(0, MESSAGE_MAX_LENGTH),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage].slice(
      -MESSAGE_HISTORY_LIMIT,
    );

    setIsChatting(true);

    try {
      const response = await fetch("/api/outline/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: nextMessages,
          currentOutline: markdown,
          subject: subject.trim(),
          topic: topic.trim(),
          institution: "",
          // 同 handleGenerate：双写。重建提纲时自由文本继续作为画像喂给模型。
          researchFocus: overview.trim(),
          collectionScenario: DEFAULT_COLLECTION_SCENARIO,
          events: [],
          timePoints: [],
          ethicsNotes: overview.trim(),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as OutlineChatResponse | null;
      const nextMarkdown = payload?.markdown?.trim() ?? "";

      if (!response.ok || !nextMarkdown) {
        throw new Error(payload?.error ?? "修改失败");
      }

      const assistantMessage: OutlineChatMessage = {
        id: nanoid(8),
        role: "assistant",
        content: payload?.assistantMessage?.trim() || "已按你的要求更新提纲。",
        createdAt: new Date().toISOString(),
      };

      // 成功才把这一轮双方一起落进历史：失败时不写 user，重发不会产生重复轮次，
      // 聊天区也不会留下没被回答的孤儿提问。
      setMessages(
        [...nextMessages, assistantMessage].slice(-MESSAGE_HISTORY_LIMIT),
      );
      setMarkdown(nextMarkdown);
      // 对话也算模型产物：否则下一轮「生成」会误判成用户手动改过而弹覆盖确认。
      lastGeneratedRef.current = nextMarkdown;
      setChatInput("");
      setNotice("");
    } catch {
      // markdown 与 messages 都不动，chatInput 保留方便直接重发。
      setNotice("提纲修改失败，请稍后重试或手动编辑");
    } finally {
      setIsChatting(false);
    }
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    // 中文输入法按回车是确认候选词，isComposing 为 true，不能当成发送。
    if (event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void handleChat();
  }

  function handleConfirm() {
    if (!markdown.trim()) {
      return;
    }

    saveOutlineDraftToSession(markdown, {
      projectName: topic.trim(),
      intervieweeName: subject.trim(),
      institutionName: "",
      collectionScenario: DEFAULT_COLLECTION_SCENARIO,
      researchFocus: overview.trim(),
      notes: overview.trim(),
    });

    // 被流程宿主接管时不跳 /upload，交给上一步的分流去定去哪儿。
    if (onContinue) {
      onContinue({ skipped: false });
      return;
    }

    router.push(`/upload?${OUTLINE_FLAG_PARAM}=1`);
  }

  function handleSkip() {
    // 提纲留空，但画像字段照带 —— 用户跳过的是提纲，不是刚填的资料。
    // 标记位不能省：上传页在没有 outline=1 时会清掉这份草稿。
    saveOutlineDraftToSession("", {
      projectName: topic.trim(),
      intervieweeName: subject.trim(),
      institutionName: "",
      collectionScenario: DEFAULT_COLLECTION_SCENARIO,
      researchFocus: overview.trim(),
      notes: overview.trim(),
    });

    if (onContinue) {
      onContinue({ skipped: true });
      return;
    }

    router.push(`/upload?${OUTLINE_FLAG_PARAM}=1`);
  }

  // D7=B：与「确认提纲，进入上传」并列的另一条链路，建一个尚无音频的项目后进访谈控制台。
  // 不走 sessionStorage —— 提纲直接落进项目档案，控制台从服务端读。
  async function handleEnterAiInterview() {
    if (!canEnterAiInterview) {
      return;
    }

    setIsEnteringInterview(true);
    setNotice("");

    try {
      const response = await fetch("/api/projects/ai-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectName: topic.trim(),
          intervieweeName: subject.trim(),
          institutionName: "",
          // AI 访谈 route 不截断，自由文本全文入档。
          researchFocus: overview.trim(),
          collectionScenario: DEFAULT_COLLECTION_SCENARIO,
          notes: overview.trim(),
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

      // 访谈控制台页面由后续步骤实现，此处先照 PRD 跳过去。
      router.push(`/projects/${projectId}/interview`);
    } catch {
      setNotice("创建项目失败，请重试");
    } finally {
      setIsEnteringInterview(false);
    }
  }

  // ── UI-24：以下四个渲染块各只写一份，阶段 1 / PC 抽屉 / 移动端 Tab 三处复用。 ──

  /**
   * idPrefix 不是可选的：阶段 2 里抽屉副本与移动端 Tab 副本会同时挂载，
   * 若两份都用 outline-topic/subject/overview，就会出现重复 id，
   * label 的 htmlFor 会绑到 display:none 的那份输入框上。
   */
  function renderProfileCard(idPrefix: string) {
    return (
      <div className="surface-card flex min-h-0 flex-1 flex-col rounded-[1.55rem] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-eyebrow">
              受访者画像
              <span className="ml-1 text-red-500">*</span>
            </p>
            <h2 className="mt-1.5 text-base font-semibold text-foreground">
              必填信息
            </h2>
          </div>
          <div className="tape-label">Profile</div>
        </div>

        {/* UI-12：单卡三控件，顺序固定为 主题 → 姓名 → 内容概述（对齐 REQ-21）。 */}
        {/* md:grid-rows-[auto_1fr]：第二行（内容概述）吸收卡片剩余高度，
            <768px 单列文档流不受影响。 */}
        <div className="mt-4 grid min-h-0 flex-1 gap-4 md:grid-cols-2 md:grid-rows-[auto_1fr]">
          <div>
            <label className="field-label" htmlFor={`${idPrefix}-topic`}>
              访谈主题
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-topic`}
              className="text-field"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="例如：老城厢搬迁与邻里记忆"
            />
          </div>

          <div>
            <label className="field-label" htmlFor={`${idPrefix}-subject`}>
              访谈对象姓名
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-subject`}
              className="text-field"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="例如：陈秀兰"
            />
          </div>

          <div className="flex min-h-0 flex-col md:col-span-2">
            <label className="field-label" htmlFor={`${idPrefix}-overview`}>
              访谈内容概述
            </label>
            <textarea
              id={`${idPrefix}-overview`}
              className="text-area min-h-[7rem] flex-1 max-h-[20rem]"
              value={overview}
              onChange={(event) => setOverview(event.target.value)}
              maxLength={OVERVIEW_MAX_LENGTH}
              placeholder="介绍受访者的人物背景、本次访谈的主要内容与主要事件。例如：受访者 1940 年生，1992 年下岗后经营裁缝铺；本次主要访谈老城厢搬迁前后的邻里记忆。"
            />
          </div>
        </div>
      </div>
    );
  }

  const generateRow = (
    <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-5 text-muted">
        生成后可自由修改，提纲不会自动上传。
      </p>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full sm:w-auto"
      >
        {isGenerating ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isGenerating ? "生成中…" : "生成访谈提纲"}
      </Button>
    </div>
  );

  // 验收修订：三条动作按钮始终留在提纲一侧 —— 阶段 1 在右栏底部（原样），
  // 阶段 2 PC 在预览面板底部、移动端在「提纲修改」Tab 底部。
  // 抽屉与移动端「填写信息」Tab 只剩表单字段 + 生成按钮。
  const actionRow = (
    <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
      <Button
        type="button"
        variant="secondary"
        onClick={handleSkip}
        className="w-full sm:w-auto"
      >
        {embedded ? "跳过提纲，下一步" : "跳过，直接上传"}
      </Button>
      {/* 「进入 AI 访谈」只在独立页出现。嵌进 REQ-21 流程后，AI 那条路
          归分流步（route-chooser）决定，此处再放一个就成了同屏双入口。 */}
      {embedded ? null : (
        <Button
          type="button"
          variant="secondary"
          onClick={handleEnterAiInterview}
          disabled={!canEnterAiInterview}
          className="w-full sm:w-auto"
        >
          {isEnteringInterview ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              创建中…
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              进入 AI 访谈
            </>
          )}
        </Button>
      )}
      <Button
        type="button"
        onClick={handleConfirm}
        disabled={!markdown.trim()}
        className="w-full sm:w-auto"
      >
        {embedded ? "确认提纲，下一步" : "确认提纲，进入上传"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // 预览态与编辑态共用的外框，保证两种模式高度与滚动行为一致。
  const PREVIEW_FRAME =
    "soft-scroll min-h-[24rem] flex-1 overflow-auto rounded-[1.1rem] border border-line/60 bg-white/60";

  const previewBody = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow">提纲编辑</p>
          <h2 className="mt-1.5 text-base font-semibold text-foreground">
            Markdown 草稿
          </h2>
        </div>
        <div className="tape-label">Editable</div>
      </div>

      {notice ? (
        <div className="rounded-[1.4rem] border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm leading-7 text-accent-strong">
          {notice}
        </div>
      ) : null}

      {markdown ? (
        <>
          {/* 切换 tab 只在有提纲时出现 —— 空态露出来会指向不存在的可切换内容。 */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant={isPreviewMode ? "secondary" : "ghost"}
              className="min-h-9 px-4 py-1.5"
              onClick={() => setIsPreviewMode(true)}
            >
              预览
            </Button>
            <Button
              type="button"
              variant={isPreviewMode ? "ghost" : "secondary"}
              className="min-h-9 px-4 py-1.5"
              onClick={() => setIsPreviewMode(false)}
            >
              编辑
            </Button>
          </div>

          {/* 预览与编辑共用同一个框（同一块最小高度、同一套边框/圆角/底色/内滚），
              切换模式时面板不跳、两种模式的滚动行为一致。
              padding 放在内层：绝对定位子元素的包含块是父级的 padding box，
              若 p-4 留在框上，inset-0 的 textarea 会覆盖进 padding 里，与预览的 16px 对不齐。 */}
          {isPreviewMode ? (
            <div className={PREVIEW_FRAME}>
              <div className="p-4">
                <MarkdownSheet markdown={markdown} />
              </div>
            </div>
          ) : (
            <div
              className={`${PREVIEW_FRAME} relative focus-within:border-accent-strong/45 focus-within:ring-4 focus-within:ring-accent-strong/10`}
            >
              {/* 不挂 .text-area：它是未分层样式，min-height/resize/圆角恒胜工具类，
                  会让编辑态和预览态长得不一样。视觉由外层框给。 */}
              <textarea
                className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 text-sm leading-7 text-foreground outline-none"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                aria-label="访谈提纲草稿"
              />
            </div>
          )}
        </>
      ) : (
        <div className="surface-card flex min-h-[24rem] flex-1 items-center justify-center rounded-[1.55rem] px-4 py-4 text-sm leading-6 text-muted">
          {isGenerating ? (
            "正在生成提纲…"
          ) : (
            /* 「左侧」只在 PC 成立：<xl 阶段 1 是单栏。 */
            <>
              填写<span className="hidden xl:inline">左侧</span>信息后点击生成
            </>
          )}
        </div>
      )}
    </>
  );

  /**
   * listClassName 必须由调用方给：阶段 1 的列表是 max-h-48 内滚（现状），
   * 阶段 2 移动端要随页面自然增长（PRD §3.2 明确不做内滚），PC 要 flex-1 吃满面板。
   * 这三者用响应式类糊在一起会在 <xl 阶段 2 继续套着 max-h-48。
   */
  function renderChatBody(listClassName: string) {
    return (
      <>
        {/* 验收修订：去掉「多轮对话细化」小标题 —— 它孤立在编辑区与对话区之间，
            有消息时右侧计数已足够说明这块是什么。 */}
        {messages.length ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted">{messages.length} 条记录</span>
          </div>
        ) : null}

        {messages.length ? (
          <div className={listClassName}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-row ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`chat-bubble ${
                    message.role === "user"
                      ? "chat-bubble-user"
                      : "chat-bubble-assistant"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] opacity-80">
                    {message.role === "assistant" ? (
                      <>
                        <Bot className="h-3.5 w-3.5" />
                        提纲助手
                      </>
                    ) : (
                      <>
                        <NotebookPen className="h-3.5 w-3.5" />
                        研究者
                      </>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted">
            生成提纲后，可以用一句话让 AI 继续调整，例如调整提问顺序或语气。
          </p>
        )}
      </>
    );
  }

  const chatComposer = (
    <>
      <textarea
        className="text-area min-h-22"
        value={chatInput}
        onChange={(event) => setChatInput(event.target.value)}
        onKeyDown={handleChatKeyDown}
        disabled={isChatting || isGenerating}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="例如：把开场问题改得更生活化"
        aria-label="提纲修改说明"
      />

      <div className="flex items-center justify-end">
        <Button
          type="button"
          onClick={() => void handleChat()}
          disabled={!canChat}
          className="w-full sm:w-auto"
        >
          {isChatting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              修改中…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              发送修改
            </>
          )}
        </Button>
      </div>
    </>
  );

  // 嵌入时的根标签换成 <section>：外层流程容器已经是 <main>，
  // 再套一层 <main> 既是重复地标，也会因两层 min-h-dvh / xl:h-dvh / xl:overflow-hidden 打架。
  // 同理内层不再用 xl:grid（那套行模板的前提是上面有个 header 占 auto 行）。
  const Root = embedded ? "section" : "main";

  return (
    <Root
      className={
        embedded
          ? "flex min-w-0 flex-col gap-2 xl:min-h-0 xl:flex-1"
          : "min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5 xl:h-dvh xl:overflow-hidden"
      }
    >
      <div
        className={
          embedded
            ? "flex min-h-0 flex-1 flex-col gap-2"
            : "flex flex-col gap-2 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]"
        }
      >
        {/* 嵌入时整块不渲染：标题、返回链接与步骤编号都由流程容器提供
            （这里的「Step 01 · 访谈准备」在流程里是第 2 步，写死会自相矛盾）。 */}
        {embedded ? null : (
          <header className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] px-4 py-4 md:px-5">
            {/* 返回链接的位置与 class 与上传页、项目详情页保持逐字节一致，
                别改回右侧槽位的按钮样式 —— 三处要看起来是同一个控件。 */}
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
                <p className="section-eyebrow mt-3">Step 01 · 访谈准备</p>
                <h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem]">
                  生成个性化访谈提纲
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  填写受访者与访谈要点，生成一版可编辑的提纲；确认后会自动带入上传页的「访谈提纲」字段。
                </p>
              </div>
            </div>
          </header>
        )}

        {phase === "form" ? (
          /* ── 阶段 1 · 填写态：与 UI-24 之前逐像素一致（lg 仍是两栏表单） ── */
          <div className="grid min-w-0 gap-2 lg:grid-cols-2 xl:min-h-0">
            <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-4 rounded-[1.85rem] p-4 md:p-5 xl:min-h-0">
              {renderProfileCard("outline")}
              {generateRow}
            </section>

            <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-4 rounded-[1.85rem] p-4 md:p-5 xl:min-h-0">
              <div className="soft-scroll flex min-h-0 flex-col gap-4 xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
                {previewBody}

                {markdown ? (
                  <div className="surface-card flex flex-col gap-3 rounded-[1.55rem] p-4">
                    {renderChatBody(
                      "soft-scroll flex max-h-48 flex-col gap-3 overflow-y-auto pr-1",
                    )}
                    {chatComposer}
                  </div>
                ) : null}
              </div>

              {actionRow}
            </section>
          </div>
        ) : (
          /* ── 阶段 2 · 提纲态：表单让位给「预览 │ 对话」，PC 收进抽屉、移动端进 Tab ── */
          <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
            {/* 移动端 Tab 栏：只在已产出提纲后出现，PC 不渲染。
                两个面板都用可见性切换（不条件渲染），切 Tab 才不会 unmount 丢焦点。 */}
            <div
              role="tablist"
              aria-label="提纲工作台视图"
              className="flex flex-wrap gap-2 xl:hidden"
            >
              <button
                type="button"
                role="tab"
                id="outline-tab-form"
                aria-selected={mobileTab === "form"}
                aria-controls="outline-panel-form"
                onClick={() => setMobileTab("form")}
                className={mobileTab === "form" ? TAB_ACTIVE : TAB_IDLE}
              >
                填写信息
              </button>
              <button
                type="button"
                role="tab"
                id="outline-tab-outline"
                aria-selected={mobileTab === "outline"}
                aria-controls="outline-panel-outline"
                onClick={() => setMobileTab("outline")}
                className={mobileTab === "outline" ? TAB_ACTIVE : TAB_IDLE}
              >
                提纲修改
              </button>
            </div>

            <section
              id="outline-panel-form"
              role="tabpanel"
              aria-labelledby="outline-tab-form"
              className={`archive-frame paper-panel paper-panel-strong flex-col gap-4 rounded-[1.85rem] p-4 md:p-5 xl:hidden ${
                mobileTab === "form" ? "flex" : "hidden"
              }`}
            >
              {renderProfileCard("outline-mobile")}
              {generateRow}
            </section>

            {/* relative 是 overlay 的定位上下文。注意不带 lg:grid-cols-2 ——
                1024–1279px 归移动形态，长出两列就与 Tab 打架了。 */}
            <div
              id="outline-panel-outline"
              role="tabpanel"
              aria-labelledby="outline-tab-outline"
              className={`relative grid min-w-0 gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[3rem_minmax(0,1fr)] ${
                mobileTab === "form" ? "hidden xl:grid" : "grid"
              }`}
            >
              {/* 细条：宽 w-12 = 3rem = 栅格第一列。z-[65] 夹在遮罩(55)与全屏模态(70)之间，
                  且必须高于抽屉(60) —— 否则抽屉会盖住图标，「再点图标收回」就点不到了。
                  验收修订：不挂 paper-panel / archive-frame，细条不带底色、边框、阴影、圆角
                  与毛玻璃，只留一个 ghost 图标；relative 必须在这里显式给（原来由 .paper-panel 附带，
                  去掉后若变 static，z-[65] 会整条失效）。 */}
              <aside className="relative z-[65] hidden w-12 flex-col items-center pt-4 xl:flex">
                <Button
                  type="button"
                  variant="ghost"
                  title="修改填写信息"
                  aria-label={isFormDrawerOpen ? "收起填写信息" : "展开填写信息"}
                  aria-expanded={isFormDrawerOpen}
                  aria-controls="outline-profile-drawer"
                  onClick={() => setIsFormDrawerOpen((open) => !open)}
                  className="min-h-10 w-10 px-0 py-0"
                >
                  {isFormDrawerOpen ? (
                    <ChevronLeft className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </Button>
              </aside>

              {/* 抽屉打开时把右区设为 inert：仓库没有 focus trap，
                  否则 Tab 键会串到遮罩后面（PRD §10-8）。 */}
              <div
                inert={isFormDrawerOpen}
                className="grid min-w-0 gap-2 xl:min-h-0 xl:grid-cols-2"
              >
                <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-4 rounded-[1.85rem] p-4 md:p-5 xl:min-h-0">
                  <div className="soft-scroll flex min-h-0 flex-col gap-4 xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
                    {previewBody}
                  </div>

                  {/* 动作行贴在预览面板底部、滚动区之外，只在 PC 显示 ——
                      移动端那一份在「提纲修改」Tab 最底部（见下方 pb-64 那块）。
                      这个 section 在移动端也存在，不加 hidden xl:block 会多出第三份。 */}
                  <div className="hidden shrink-0 xl:block">{actionRow}</div>
                </section>

                <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-3 rounded-[1.85rem] p-4 md:p-5 xl:min-h-0">
                  {/* 移动端底下是动作行 + pb-64 留白，不再需要给固定输入条预留的 pb-36。 */}
                  {renderChatBody(
                    "soft-scroll flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 xl:flex-1",
                  )}

                  {/* PC 的输入区贴在面板底部（滚动区之外）；移动端走下面那条固定条。
                      xl:mt-auto 兜住「还没发过消息」时 flex-1 不存在的情况。 */}
                  <div className="hidden shrink-0 flex-col gap-3 xl:mt-auto xl:flex">
                    {chatComposer}
                  </div>
                </section>
              </div>

              {/* 遮罩与抽屉都是绝对定位的直属子节点：脱离文档流，不占栅格位。 */}
              <div
                onClick={() => setIsFormDrawerOpen(false)}
                className={`absolute inset-0 z-[55] hidden bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px] transition-opacity duration-200 ease-out motion-reduce:transition-none xl:block ${
                  isFormDrawerOpen
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              />

              {/* left-12 而不是 left-0：细条压在抽屉下面会吃掉表单左边缘。 */}
              <div
                id="outline-profile-drawer"
                aria-hidden={!isFormDrawerOpen}
                inert={!isFormDrawerOpen}
                className={`absolute inset-y-0 left-12 z-[60] hidden w-[min(32rem,88%)] transition-transform duration-300 ease-out motion-reduce:transition-none xl:block ${
                  isFormDrawerOpen
                    ? "translate-x-0"
                    : "pointer-events-none -translate-x-full"
                }`}
              >
                {/* .paper-panel 恒带 overflow:hidden（globals.css 未分层），
                    所以内滚必须放到再内一层，挂同一个元素上会被静默吃掉。 */}
                <div className="archive-frame paper-panel paper-panel-strong h-full rounded-[1.85rem]">
                  <div className="soft-scroll h-full overflow-y-auto">
                    <div className="flex flex-col gap-4 p-4 md:p-5">
                      {renderProfileCard("outline")}
                      {generateRow}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 移动端动作行：必须放在 outline-panel-outline 之外 —— 那是个栅格，
                第 5 个子节点会被当成栅格项丢进第二行第一列。也必须带 mobileTab 门，
                否则切到「填写信息」Tab 时它会重复露出一份。
                pb-64（16rem）给底部固定输入条（约 13rem）让位 —— 输入框会随用户
                敲长句自动增高，13rem 只是下限，留 ~50px 余量兜住。 */}
            {mobileTab === "outline" ? (
              <div className="pb-64 xl:hidden">{actionRow}</div>
            ) : null}
          </div>
        )}
      </div>

      {/* 移动端输入框固定页面底部、不随内容滚动。必须是根元素的直属子节点，
          且它与根之间不得有 backdrop-filter 祖先（.paper-panel / .meta-pill 都带）——
          那会成为 fixed 后代的包含块，就不再贴视口。
          嵌入 REQ-21 流程时同理：流程的步骤体容器刻意不用 paper-panel。 */}
      {phase === "outline" && mobileTab === "outline" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white to-transparent px-1 pb-[env(safe-area-inset-bottom)] xl:hidden">
          <div className="archive-frame paper-panel paper-panel-strong mb-2 mt-6 rounded-[1.55rem] p-3">
            <div className="flex flex-col gap-3">{chatComposer}</div>
          </div>
        </div>
      ) : null}
    </Root>
  );
}
