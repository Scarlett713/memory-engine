"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSpeechRecorder } from "@/hooks/use-speech-recorder";
import type { ProjectRecord } from "@/lib/types/project";

/**
 * REQ-14 Step 2：访谈控制台骨架。
 *
 * 跳转表（非法转移一律 return state，不抛错）：
 *
 * | action                | from                                        | to                        |
 * | --------------------- | ------------------------------------------- | ------------------------- |
 * | INITIALIZED           | initializing                                | ready                     |
 * | START                 | ready                                       | ai_thinking               |
 * | AI_QUESTION_READY     | ai_thinking                                 | ai_asking（见下）         |
 * | USER_START_ANSWERING  | ai_asking                                   | user_answering            |
 * | USER_DONE_SPEAKING    | user_answering                              | ai_thinking               |
 * | NEXT_QUESTION_READY   | ai_thinking                                 | ai_asking（题号 +1）      |
 * | PAUSE                 | ai_asking / user_answering / ai_thinking    | paused（记 resumedPhase） |
 * | RESUME                | paused                                      | resumedPhase ?? user_…    |
 * | FINISH                | ready / ai_asking / user_answering / ai_… / paused | uploading          |
 * | UPLOAD_DONE           | uploading                                   | done                      |
 * | FAIL                  | 任意非终态                                  | error（记 prevPhase）     |
 * | RETRY                 | error                                       | prevPhase ?? ready        |
 * | CAPTION_INTERIM       | 任意 phase                                  | 不变，只覆盖临时字幕      |
 * | CAPTION_FINAL         | 任意 phase                                  | 不变，只追加定格字幕      |
 *
 * PAUSE / RESUME 除改 phase 外，还会连带调用 useSpeechRecorder 的
 * pause() / resume()（停止识别与音频写入、冻结计时）；FINISH 与「结束回答」
 * 会连带 stop()，否则暂停或结束后麦克风仍在录。
 *
 * START 落到 ai_thinking 而不是直接 ai_asking：PRD §3 模块 3 要「读取提纲 →
 * 生成当前问题」，首问同样是异步的。
 *
 * prevPhase 与 resumedPhase 分开：前者是异常回退（FAIL/RETRY），后者是暂停恢复
 * （PAUSE/RESUME），两者生命周期不同，不合并。
 *
 * Step 4：ai_thinking 不再走占位定时器，改为真实 POST
 * …/interview/next-question。该 action 现在同时承担首问与后续每一问
 * （NEXT_QUESTION_READY 因此暂时没有生产者，保留给 Step 5+ 的「待补录」兜底）：
 * 按 isFollowUp 决定是否推进题号、累积 coveredItemIds，并把本轮字幕存进
 * transcript 后清空。回包 done 则直接 FINISH。
 */

export type InterviewPhase =
  | "initializing"
  | "ready"
  | "ai_asking"
  | "user_answering"
  | "ai_thinking"
  | "paused"
  | "uploading"
  | "done"
  | "error";

type PauseReason = "manual" | "emotion";

type InterviewState = {
  phase: InterviewPhase;
  /** 0-based，当前题号。 */
  questionIndex: number;
  currentQuestion: string;
  /** 已定格的字幕，逐段追加。 */
  captions: string;
  /** 当前未定格的临时字幕，每次覆盖；与 captions 分开存才能既追加又覆盖。 */
  interimCaption: string;
  /** 会话级完整转写：每问结束把 captions 并进来，captions 本身则逐问清空。 */
  transcript: string;
  /** 当前题已连续追问的次数。推进到下一题时归零。 */
  followUpCount: number;
  /** 已覆盖的提纲条目 id（服务端下发的不透明 token），跨问累积。 */
  coveredItemIds: string[];
  /** RESUME 回到暂停前的 phase。 */
  resumedPhase: InterviewPhase | null;
  /** FAIL 时记下出错前 phase，供 RETRY 原路返回。 */
  prevPhase: InterviewPhase | null;
  pauseReason: PauseReason | null;
  errorMessage: string | null;
};

type InterviewAction =
  | { type: "INITIALIZED" }
  | { type: "START" }
  | {
      type: "AI_QUESTION_READY";
      question: string;
      isFollowUp: boolean;
      coveredItemIds: string[];
    }
  | { type: "USER_START_ANSWERING" }
  | { type: "USER_DONE_SPEAKING" }
  | { type: "NEXT_QUESTION_READY"; question: string; questionIndex?: number }
  | { type: "PAUSE"; reason?: PauseReason }
  | { type: "RESUME" }
  | { type: "FINISH" }
  | { type: "UPLOAD_DONE" }
  | { type: "FAIL"; message: string }
  | { type: "RETRY" }
  | { type: "CAPTION_INTERIM"; text: string }
  | { type: "CAPTION_FINAL"; text: string };

const INITIAL_STATE: InterviewState = {
  phase: "initializing",
  questionIndex: 0,
  currentQuestion: "",
  captions: "",
  interimCaption: "",
  transcript: "",
  followUpCount: 0,
  coveredItemIds: [],
  resumedPhase: null,
  prevPhase: null,
  pauseReason: null,
  errorMessage: null,
};

const PAUSABLE_PHASES: readonly InterviewPhase[] = [
  "ai_asking",
  "user_answering",
  "ai_thinking",
];

const FINISHABLE_PHASES: readonly InterviewPhase[] = [
  "ready",
  "ai_asking",
  "user_answering",
  "ai_thinking",
  "paused",
];

const OUTLINE_PREVIEW_COUNT = 3;

/** ⚠️ Step 6 之前的上传占位：真实上传接口接好后随占位块一起删除。 */
const UPLOAD_PLACEHOLDER_MS = 900;

/**
 * Step 3：真实解析器落在 interview-outline-checklist.tsx（PRD §3 模块 7）。
 * 这里只做「去 Markdown 前缀取非空行」的粗解析，供摘要与逐题推进占位使用。
 */
function extractOutlineItems(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.replace(/^\s*(?:#{1,6}|[-*+]|\d+[.、)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function interviewReducer(
  state: InterviewState,
  action: InterviewAction,
): InterviewState {
  switch (action.type) {
    case "INITIALIZED":
      return state.phase === "initializing"
        ? { ...state, phase: "ready" }
        : state;

    case "START":
      return state.phase === "ready" ? { ...state, phase: "ai_thinking" } : state;

    case "AI_QUESTION_READY":
      if (state.phase !== "ai_thinking") {
        return state;
      }
      return {
        ...state,
        phase: "ai_asking",
        currentQuestion: action.question,
        // 首问不推进题号：进 ai_thinking 前 currentQuestion 还是空串，就说明一次
        // 都还没问过（沿用被删掉的占位分支判「首问 / 下一问」的同一写法）。
        questionIndex:
          action.isFollowUp || !state.currentQuestion
            ? state.questionIndex
            : state.questionIndex + 1,
        followUpCount: action.isFollowUp ? state.followUpCount + 1 : 0,
        // 不能用 normalizeCoveredItemIds：它按 MAX_COVERED_ITEM_IDS=3 截断，
        // 累计覆盖态会被砍回 3 条。回包只含「本轮新增」，必须并集。
        coveredItemIds: [
          ...new Set([...state.coveredItemIds, ...action.coveredItemIds]),
        ],
        // 清空本轮字幕前先并进会话转写：paused 弹窗的「已记录文字」与 Step 5 的
        // 崩溃恢复都要完整已识别文字。首问时 captions 为空，自然跳过。
        transcript: state.captions
          ? state.transcript
            ? `${state.transcript}\n${state.captions}`
            : state.captions
          : state.transcript,
        captions: "",
        interimCaption: "",
      };

    case "USER_START_ANSWERING":
      return state.phase === "ai_asking"
        ? { ...state, phase: "user_answering" }
        : state;

    case "USER_DONE_SPEAKING":
      return state.phase === "user_answering"
        ? { ...state, phase: "ai_thinking" }
        : state;

    case "NEXT_QUESTION_READY":
      if (state.phase !== "ai_thinking") {
        return state;
      }
      return {
        ...state,
        phase: "ai_asking",
        currentQuestion: action.question,
        questionIndex: action.questionIndex ?? state.questionIndex + 1,
      };

    case "PAUSE":
      if (!PAUSABLE_PHASES.includes(state.phase)) {
        return state;
      }
      return {
        ...state,
        phase: "paused",
        resumedPhase: state.phase,
        pauseReason: action.reason ?? "manual",
      };

    case "RESUME":
      if (state.phase !== "paused") {
        return state;
      }
      return {
        ...state,
        phase: state.resumedPhase ?? "user_answering",
        resumedPhase: null,
        pauseReason: null,
      };

    case "FINISH":
      if (!FINISHABLE_PHASES.includes(state.phase)) {
        return state;
      }
      return {
        ...state,
        phase: "uploading",
        resumedPhase: null,
        pauseReason: null,
      };

    case "UPLOAD_DONE":
      return state.phase === "uploading" ? { ...state, phase: "done" } : state;

    case "FAIL":
      if (state.phase === "done" || state.phase === "error") {
        return state;
      }
      return {
        ...state,
        phase: "error",
        prevPhase: state.phase,
        errorMessage: action.message,
      };

    case "RETRY":
      if (state.phase !== "error") {
        return state;
      }
      return {
        ...state,
        phase: state.prevPhase ?? "ready",
        errorMessage: null,
        prevPhase: null,
      };

    // 字幕两条边不碰 phase：识别结果什么时候回来都不该改变流程状态。
    case "CAPTION_INTERIM":
      return { ...state, interimCaption: action.text };

    case "CAPTION_FINAL":
      return {
        ...state,
        captions: state.captions
          ? `${state.captions}\n${action.text}`
          : action.text,
        interimCaption: "",
      };

    default:
      return state;
  }
}

function CenteredLoading({ children }: { children: ReactNode }) {
  return (
    <div className="surface-card flex min-h-[24rem] flex-1 items-center justify-center gap-2 rounded-[1.55rem] px-4 py-4 text-sm leading-6 text-muted">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

type InterviewConsoleProps = {
  project: ProjectRecord;
};

export function InterviewConsole({ project }: InterviewConsoleProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(interviewReducer, INITIAL_STATE);
  const { phase } = state;

  // Step 6 上传用。Blob 不可序列化，不进 reducer。
  const wavBlobRef = useRef<Blob | null>(null);

  const {
    isRecording,
    durationMs,
    permissionError,
    start: startRecording,
    stop: stopRecording,
    pause: pauseRecording,
    resume: resumeRecording,
  } = useSpeechRecorder({
    onCaption: (text, isFinal) => {
      dispatch(
        isFinal
          ? { type: "CAPTION_FINAL", text }
          : { type: "CAPTION_INTERIM", text },
      );
    },
    onWavReady: (blob) => {
      wavBlobRef.current = blob;
    },
  });

  // captions 末尾没有换行，临时字幕直拼会粘成「你好我在说」。
  const captionText =
    state.captions && state.interimCaption
      ? `${state.captions}\n${state.interimCaption}`
      : state.captions || state.interimCaption;

  const outlineItems = useMemo(
    () => extractOutlineItems(project.outlineDraftMarkdown),
    [project.outlineDraftMarkdown],
  );
  const outlinePreview = outlineItems.slice(0, OUTLINE_PREVIEW_COUNT);
  const totalQuestions = outlineItems.length;
  const questionTotal = Math.max(totalQuestions, state.questionIndex + 1);

  // initializing 是「控制台自检态」：项目数据已由服务端取好，
  // Step 3 在此接设备/麦克风权限探测，Step 5 在此读 localStorage 恢复点。
  useEffect(() => {
    if (phase !== "initializing") {
      return;
    }
    dispatch({ type: "INITIALIZED" });
  }, [phase]);

  // done 的副作用只在 effect 里做，reducer 保持纯函数。
  useEffect(() => {
    if (phase !== "done") {
      return;
    }
    router.push(`/projects/${project.id}`);
  }, [phase, project.id, router]);

  // Step 5：崩溃恢复。约定 key = `interview_progress_${projectId}`。
  // 本轮只占坑，不读也不写。
  useEffect(() => {
    const storageKey = `interview_progress_${project.id}`;
    // Step 5: const saved = window.localStorage.getItem(storageKey) → 命中则 dispatch(RESTORE)
    // Step 5: window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
    void storageKey;
  }, [project.id]);

  // 暂停弹窗：Esc 恢复 + 锁滚动，照 project-processing-console.tsx 的既有做法。
  useEffect(() => {
    if (phase !== "paused") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resumeRecording();
        dispatch({ type: "RESUME" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase, resumeRecording]);

  // 每问一次真实请求。首问（START）与后续每一问都走这里。
  const fetchNextQuestion = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${project.id}/interview/next-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIndex: state.questionIndex,
            followUpCount: state.followUpCount,
            coveredItemIds: state.coveredItemIds,
            lastAnswer: state.captions,
          }),
        },
      );

      if (!res.ok) {
        // 路由的失败信封是 { error }，直接 res.text() 会把 JSON 原文糊到 error phase 上。
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        throw new Error(
          payload?.error ?? payload?.message ?? "请求失败，请重试。",
        );
      }

      const data = (await res.json()) as {
        done: boolean;
        question: string;
        isFollowUp?: boolean;
        coveredItemIds?: string[];
      };

      if (data.done) {
        // 提纲聊完，直接进上传。FINISHABLE_PHASES 含 ai_thinking，成立。
        dispatch({ type: "FINISH" });
        return;
      }

      dispatch({
        type: "AI_QUESTION_READY",
        question: data.question,
        isFollowUp: data.isFollowUp ?? false,
        coveredItemIds: data.coveredItemIds ?? [],
      });
    } catch (error) {
      dispatch({
        type: "FAIL",
        message: error instanceof Error ? error.message : "网络错误，请重试",
      });
    }
  }, [
    project.id,
    state.questionIndex,
    state.followUpCount,
    state.coveredItemIds,
    state.captions,
  ]);

  // 不加取消守卫：迟到的回包是安全的——AI_QUESTION_READY 在 reducer 里有 phase
  // 前置判定，用户在请求飞行中结束/暂停时它会被静默丢弃。
  useEffect(() => {
    if (phase !== "ai_thinking") {
      return;
    }

    void fetchNextQuestion();
  }, [phase, fetchNextQuestion]);

  // ⚠️ Step 6 占位：uploading 应改为 await POST /api/projects/{id}/interview/audio。
  useEffect(() => {
    if (phase !== "uploading") {
      return undefined;
    }

    const timer = window.setTimeout(
      () => dispatch({ type: "UPLOAD_DONE" }),
      UPLOAD_PLACEHOLDER_MS,
    );

    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "done") {
    // 不渲染，跳转由上面的 effect 负责。
    return null;
  }

  return (
    <main className="min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5">
      <div className="flex flex-col gap-2">
        <header className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] px-4 py-4 md:px-5">
          {/* 返回链接的位置与 class 与上传页、项目详情页、提纲工作台保持逐字节一致，
              只改文案与 href —— 四处要看起来是同一个控件。 */}
          <div className="flex items-start gap-4">
            <div className="archive-mark hidden sm:grid">
              <span />
              <span />
              <span />
            </div>

            <div>
              <Link
                href={`/projects/${project.id}/outline`}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
              >
                <ArrowLeft className="h-4 w-4" />
                返回提纲
              </Link>
              <p className="section-eyebrow mt-3">Step 02 · AI 访谈</p>
              <h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem]">
                {project.projectName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                受访者 {project.intervieweeName || "未填写"} · AI 逐题提问，
                结束后自动上传录音并启动讯飞归档。
              </p>
            </div>
          </div>
        </header>

        <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-4 rounded-[1.85rem] p-4 md:p-5">
          {phase === "initializing" ? (
            <CenteredLoading>正在准备访谈控制台…</CenteredLoading>
          ) : null}

          {phase === "ready" ? (
            <>
              <div>
                <p className="section-eyebrow">准备就绪</p>
                <h2 className="font-display mt-2 text-[1.5rem] font-semibold text-accent-strong">
                  {project.projectName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  提纲共 {totalQuestions} 条，开始后 AI 会逐题提问。
                </p>
              </div>

              <div className="surface-card rounded-[1.55rem] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-eyebrow">提纲摘要</p>
                  <div className="tape-label">
                    前 {Math.min(OUTLINE_PREVIEW_COUNT, totalQuestions)} 条
                  </div>
                </div>
                {outlinePreview.length > 0 ? (
                  <ol className="mt-3 flex flex-col gap-2">
                    {outlinePreview.map((item, index) => (
                      <li
                        key={`${index}-${item}`}
                        className="flex gap-3 text-sm leading-6 text-foreground"
                      >
                        <span className="font-semibold text-accent-strong">
                          {index + 1}.
                        </span>
                        <span className="min-w-0">{item}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    提纲暂无可解析条目。
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => dispatch({ type: "START" })}
                >
                  <Sparkles className="h-4 w-4" />
                  开始访谈
                </Button>
              </div>
            </>
          ) : null}

          {phase === "ai_asking" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="section-eyebrow">当前问题</p>
                <div className="tape-label">
                  第 {state.questionIndex + 1} / {questionTotal} 题
                </div>
              </div>

              <div className="surface-card rounded-[1.55rem] px-4 py-5 text-base leading-8 text-foreground">
                {state.currentQuestion || "（等待 AI 提问）"}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={async () => {
                    // 权限被拒也进 user_answering，横幅会说明原因。
                    await startRecording();
                    dispatch({ type: "USER_START_ANSWERING" });
                  }}
                >
                  <Mic className="h-4 w-4" />
                  我已听清，开始回答
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    pauseRecording();
                    dispatch({ type: "PAUSE" });
                  }}
                >
                  <Pause className="h-4 w-4" />
                  暂停
                </Button>
              </div>
            </>
          ) : null}

          {phase === "user_answering" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="section-eyebrow">实时字幕</p>
                <div className="tape-label">
                  {isRecording ? `录音中 · ${formatDuration(durationMs)}` : "未录音"}
                </div>
              </div>

              {permissionError ? (
                <div className="rounded-[1.4rem] border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm leading-7 text-accent-strong">
                  {permissionError}
                </div>
              ) : null}

              {/* Step 3 已接入 Web Speech；「暂停滚动 / 清屏（仅视图）」仍待补。 */}
              <div className="surface-card soft-scroll min-h-[14rem] whitespace-pre-wrap rounded-[1.55rem] px-4 py-4 text-sm leading-7 text-foreground">
                {captionText || (
                  <span className="text-muted">
                    点击开始录音后，这里会实时显示对话文字。
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    stopRecording();
                    dispatch({ type: "USER_DONE_SPEAKING" });
                  }}
                >
                  结束回答
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    pauseRecording();
                    dispatch({ type: "PAUSE" });
                  }}
                >
                  <Pause className="h-4 w-4" />
                  暂停
                </Button>
              </div>
            </>
          ) : null}

          {phase === "ai_thinking" ? (
            <CenteredLoading>AI 正在思考…</CenteredLoading>
          ) : null}

          {phase === "paused" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="section-eyebrow">已暂停</p>
                <div className="tape-label">第 {state.questionIndex + 1} 题</div>
              </div>

              <div className="surface-card rounded-[1.55rem] px-4 py-5 text-base leading-8 text-foreground">
                {state.currentQuestion || "（等待 AI 提问）"}
              </div>

              <div className="surface-card soft-scroll min-h-[10rem] rounded-[1.55rem] px-4 py-4 text-sm leading-7 text-muted">
                {state.captions ||
                  "点击开始录音后，这里会实时显示对话文字。"}
              </div>
            </>
          ) : null}

          {phase === "uploading" ? (
            <>
              <CenteredLoading>正在上传录音…</CenteredLoading>
              {/* Step 4: 上传 interview-{projectId}.wav 并显示真实进度。 */}
            </>
          ) : null}

          {phase === "error" ? (
            <>
              <div className="rounded-[1.4rem] border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm leading-7 text-accent-strong">
                {state.errorMessage || "访谈流程出错，请重试。"}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => dispatch({ type: "RETRY" })}
                >
                  <RotateCcw className="h-4 w-4" />
                  重试
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {phase === "paused" ? (
        <div className="fixed inset-0 z-[70] bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px]">
          <div className="flex h-full flex-col items-center justify-center p-2 sm:p-3">
            <div className="paper-panel paper-panel-strong w-full max-w-xl rounded-[2rem] px-4 py-5 md:px-6 md:py-6">
              <p className="section-eyebrow">Step 02 · AI 访谈</p>
              <h2 className="font-display mt-2 text-[1.5rem] font-semibold leading-tight text-accent-strong">
                {state.pauseReason === "emotion"
                  ? "检测到情绪波动，是否暂停访谈？"
                  : "访谈已暂停"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                已录音与已转写内容已保留。按{" "}
                <span className="font-semibold text-accent-strong">Esc</span>{" "}
                也可以继续访谈。
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    resumeRecording();
                    dispatch({ type: "RESUME" });
                  }}
                >
                  <Play className="h-4 w-4" />
                  继续访谈
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    // 先收尾录音再走上传：否则麦克风会一直开着。
                    stopRecording();
                    dispatch({ type: "FINISH" });
                  }}
                >
                  结束并保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
