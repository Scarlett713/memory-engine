"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Download,
  FileText,
  FolderArchive,
  LoaderCircle,
  MessageSquareDashed,
  NotebookPen,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { MarkdownSheet } from "@/components/ui/markdown-sheet";
import {
  OUTLINE_SESSION_STORAGE_KEY,
  createEmptyOutlineProfile,
  createEmptyOutlineSession,
  getOutlineReadinessLabel,
  normalizeOutlineProfile,
  normalizeOutlineSession,
} from "@/lib/outline-session";
import { getInterviewScenarioLabel, interviewScenarioOptions } from "@/lib/oral-history";
import type {
  OutlineChatMessage,
  OutlineProjectProfile,
  OutlineReadiness,
} from "@/lib/types/outline";
import { buildPrintableMarkdownDocument } from "@/lib/markdown-print";
import { formatDateTime } from "@/lib/utils";
import { useProjectWorkspaceStore } from "@/store/project-workspace";

const quickPrompts = [
  "我要做一场关于老城厢生活变迁的口述访谈，请帮我先搭一个提纲。",
  "受访者是一位非遗手艺人，我希望问题既能问出技艺细节，也不让访谈太生硬。",
  "我担心访谈会触及创伤记忆，想让提纲里包含更稳妥的情绪安抚问题。",
];

function createMessage(
  role: OutlineChatMessage["role"],
  content: string,
): OutlineChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function OutlineWorkspace() {
  const router = useRouter();
  const fetchProjects = useProjectWorkspaceStore((state) => state.fetchProjects);
  const deleteProject = useProjectWorkspaceStore((state) => state.deleteProject);
  const projects = useProjectWorkspaceStore((state) => state.projects);
  const isLoadingProjects = useProjectWorkspaceStore((state) => state.isLoading);

  const [messages, setMessages] = useState<OutlineChatMessage[]>([]);
  const [outlineMarkdown, setOutlineMarkdown] = useState("");
  const [profile, setProfile] = useState<OutlineProjectProfile>(
    createEmptyOutlineProfile(),
  );
  const [readiness, setReadiness] = useState<OutlineReadiness>("collecting");
  const [checkpoints, setCheckpoints] = useState<string[]>([
    "先告诉我访谈主题、受访对象或你最在意的研究问题。",
  ]);
  const [draftInput, setDraftInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OUTLINE_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const session = normalizeOutlineSession(parsed);

        setMessages(session.messages);
        setOutlineMarkdown(session.outlineMarkdown);
        setProfile(session.profile);
        setReadiness(session.readiness);
      }
    } catch {
      // ignore invalid localStorage data
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const session = normalizeOutlineSession({
      messages,
      outlineMarkdown,
      profile,
      readiness,
      updatedAt: new Date().toISOString(),
    });

    window.localStorage.setItem(
      OUTLINE_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  }, [hasHydrated, messages, outlineMarkdown, profile, readiness]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isPending]);

  const hasConversation = messages.length > 0;
  const stageLabel = getOutlineReadinessLabel(readiness);
  const recentProjects = useMemo(() => projects.slice(0, 5), [projects]);

  function handleReset() {
    const empty = createEmptyOutlineSession();

    setMessages(empty.messages);
    setOutlineMarkdown(empty.outlineMarkdown);
    setProfile(empty.profile);
    setReadiness(empty.readiness);
    setCheckpoints(["新的访谈会话已创建。先告诉我这场访谈想聊什么。"]);
    setDraftInput("");
    setError(null);
    window.localStorage.removeItem(OUTLINE_SESSION_STORAGE_KEY);
  }

  function handleSend(override?: string) {
    const content = (override ?? draftInput).trim();

    if (!content || isPending) {
      return;
    }

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraftInput("");
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/outline/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: nextMessages,
            profile,
            currentOutline: outlineMarkdown,
          }),
        });

        const payload = (await response.json()) as {
          message?: string;
          assistantMessage?: OutlineChatMessage;
          outlineMarkdown?: string;
          profile?: Partial<OutlineProjectProfile>;
          readiness?: OutlineReadiness;
          checkpoints?: string[];
        };

        if (!response.ok || !payload.assistantMessage) {
          throw new Error(payload.message ?? "提纲生成失败，请稍后重试。");
        }

        setMessages((current) => [...current, payload.assistantMessage!]);
        setOutlineMarkdown(
          (current) => (payload.outlineMarkdown ?? "").trim() || current,
        );
        setProfile((current) => normalizeOutlineProfile({ ...current, ...payload.profile }));
        setReadiness(payload.readiness ?? "drafting");
        setCheckpoints(
          payload.checkpoints && payload.checkpoints.length > 0
            ? payload.checkpoints
            : ["AI 已更新提纲，你可以继续补充信息。"],
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "提纲生成失败，请稍后重试。",
        );
      }
    });
  }

  function handleGoToUpload() {
    const session = normalizeOutlineSession({
      messages,
      outlineMarkdown,
      profile,
      readiness,
      updatedAt: new Date().toISOString(),
    });

    window.localStorage.setItem(
      OUTLINE_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
    router.push("/upload");
  }

  function handleExportOutlinePdf() {
    const markdown = outlineMarkdown.trim();

    if (!markdown) {
      setError("????????????????");
      return;
    }

    const title =
      profile.projectName.trim() ||
      profile.intervieweeName.trim() ||
      "????";
    const subtitle = [
      profile.intervieweeName.trim()
        ? `?????${profile.intervieweeName.trim()}`
        : "",
      getInterviewScenarioLabel(profile.collectionScenario),
    ]
      .filter(Boolean)
      .join(" ? ");
    const html = buildPrintableMarkdownDocument({
      title,
      markdown,
      subtitle,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const printWindow = window.open(objectUrl, "_blank");

    if (!printWindow) {
      setError("????????????????????");
      URL.revokeObjectURL(objectUrl);
      return;
    }

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }

  function handleDeleteProject(projectId: string) {
    setPendingDeleteId(projectId);

    startDeleteTransition(async () => {
      try {
        await deleteProject(projectId);
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "删除项目失败，请稍后重试。",
        );
      } finally {
        setPendingDeleteId(null);
      }
    });
  }

  return (
    <main className="h-[100dvh] overflow-hidden px-1 py-1 sm:px-1.5 sm:py-1.5">
      <div className="outline-shell grid h-full gap-2 lg:grid-cols-[246px_minmax(0,1.5fr)_470px] xl:grid-cols-[256px_minmax(0,1.8fr)_540px]">
        <aside className="paper-panel paper-panel-strong flex min-h-0 flex-col rounded-[1.85rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-eyebrow">记忆引擎</p>
              <h1 className="font-display mt-1 text-2xl font-semibold text-accent-strong">
                提纲工作台
              </h1>
            </div>
            <button
              type="button"
              className="mini-icon-button"
              onClick={handleReset}
              aria-label="新建提纲"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="sidebar-cta"
              onClick={handleReset}
            >
              <MessageSquareDashed className="h-4 w-4" />
              新建提纲对话
            </button>
            <Link href="/upload" className="sidebar-secondary">
              <FileText className="h-4 w-4" />
              直接进入上传页
            </Link>
          </div>

          <section className="mt-5 min-h-0">
            <div className="flex items-center justify-between">
              <p className="section-eyebrow">访谈模版</p>
              <span className="text-xs text-muted">场景预设</span>
            </div>
            <div className="soft-scroll mt-3 grid max-h-[34dvh] gap-2 overflow-auto pr-1">
              {interviewScenarioOptions.map((scenario) => (
                <button
                  key={scenario.value}
                  type="button"
                  className={`sidebar-chip ${
                    profile.collectionScenario === scenario.value
                      ? "sidebar-chip-active"
                      : ""
                  }`}
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      collectionScenario: scenario.value,
                    }))
                  }
                >
                  <span className="font-semibold">{scenario.label}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {scenario.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 min-h-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="section-eyebrow">最近项目</p>
              <span className="text-xs text-muted">
                {isLoadingProjects ? "读取中" : `${projects.length} 个`}
              </span>
            </div>
            <div className="soft-scroll mt-3 h-[calc(100%-1.8rem)] space-y-2 overflow-auto pr-1">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <div key={project.id} className="sidebar-project">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {project.projectName}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {project.intervieweeName || "未填写受访对象"}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {formatDateTime(project.updatedAt)}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line/70 bg-white/72 text-muted transition-colors hover:border-danger/20 hover:bg-danger/8 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isDeleting && pendingDeleteId === project.id}
                        onClick={() => handleDeleteProject(project.id)}
                        aria-label={`删除项目 ${project.projectName}`}
                      >
                        {isDeleting && pendingDeleteId === project.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="surface-card rounded-[1.2rem] px-4 py-4 text-sm leading-6 text-muted">
                  暂无项目记录。你可以先在中间用聊天整理出访谈提纲，再继续上传音频。
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="paper-panel relative flex min-h-0 flex-col overflow-hidden rounded-[1.85rem]">
          <div className="outline-stage-header flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3 md:px-5">
            <div className="flex items-center gap-3">
              <div className="archive-mark hidden min-h-[4.4rem] min-w-[4rem] sm:grid">
                <span />
                <span />
                <span />
              </div>
              <div>
                <p className="section-eyebrow">Step 01</p>
                <h2 className="font-display mt-1 text-[1.7rem] font-semibold text-accent-strong">
                  访谈提纲智能生成
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="meta-pill text-sm text-muted">
                <Sparkles className="h-4 w-4 text-accent-strong" />
                {stageLabel}
              </div>
              <div className="meta-pill text-sm text-muted">
                <FolderArchive className="h-4 w-4 text-accent-strong" />
                {getInterviewScenarioLabel(profile.collectionScenario)}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 md:px-5">
            {!hasConversation ? (
              <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center text-center">
                <p className="section-eyebrow">对话式采集辅助</p>
                <h3 className="font-display mt-3 max-w-3xl text-[2rem] font-semibold leading-tight text-accent-strong md:text-[2.6rem]">
                  先和 AI 把这场访谈聊清楚
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted md:text-base">
                  你可以直接描述受访对象、访谈主题、担心的伦理风险或想重点追问的历史片段。系统会持续记住上下文，逐轮生成更完整的访谈提纲。
                </p>

                <div className="mt-5 grid w-full max-w-4xl gap-3 md:grid-cols-3">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-card text-left"
                      onClick={() => handleSend(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="outline-composer mt-6 w-full max-w-4xl">
                  <textarea
                    className="outline-input"
                    value={draftInput}
                    onChange={(event) => setDraftInput(event.target.value)}
                    placeholder="例如：我想做一场关于上海老城厢迁居经历的口述访谈，受访者是 78 岁的王阿婆……"
                    rows={3}
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      <span className="meta-pill">聊天生成提纲</span>
                      <span className="meta-pill">可继续编辑 Markdown</span>
                    </div>
                    <button
                      type="button"
                      className="send-pill"
                      onClick={() => handleSend()}
                      disabled={!draftInput.trim() || isPending}
                    >
                      {isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      开始构建提纲
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 pt-1">
                <div
                  ref={chatScrollRef}
                  className="soft-scroll min-h-0 flex-1 space-y-4 overflow-auto px-1 pb-4 pt-2"
                >
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

                  {error ? (
                    <div className="rounded-[1.4rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
                      {error}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 pb-1">
                  <div className="outline-composer">
                    <textarea
                      className="outline-input"
                      value={draftInput}
                      onChange={(event) => setDraftInput(event.target.value)}
                      placeholder="继续补充背景、追问方向、情绪风险或你希望提纲增加的部分…"
                      rows={3}
                    />
                    <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {checkpoints.map((checkpoint) => (
                          <span key={checkpoint} className="checkpoint-pill">
                            {checkpoint}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="send-pill"
                        onClick={() => handleSend()}
                        disabled={!draftInput.trim() || isPending}
                      >
                        {isPending ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        继续完善
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="paper-panel paper-panel-strong flex min-h-0 flex-col rounded-[1.85rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-eyebrow">提纲编辑</p>
              <h2 className="font-display mt-1 text-[1.55rem] font-semibold text-accent-strong">
                Markdown 编辑器
              </h2>
            </div>
            <span className="editor-badge">实时预览</span>
          </div>

          <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-rows-[1.05fr_0.95fr]">
            <div className="editor-sheet min-h-0">
              <div className="flex items-center justify-between">
                <p className="section-eyebrow">Markdown 编辑器</p>
                <span className="text-xs text-muted">
                  {outlineMarkdown.trim() ? "已生成草稿" : "等待 AI 生成"}
                </span>
              </div>
              <textarea
                className="outline-editor mt-3"
                value={outlineMarkdown}
                onChange={(event) => setOutlineMarkdown(event.target.value)}
                placeholder="# 访谈提纲草案"
              />
            </div>

            <div className="editor-sheet min-h-0">
              <div className="flex items-center justify-between">
                <p className="section-eyebrow">预览</p>
                <span className="text-xs text-muted">Notion 风格排版</span>
              </div>
              <div className="soft-scroll mt-3 h-[280px] overflow-auto rounded-[1.1rem] border border-line/60 bg-white/58 p-4">
                <MarkdownSheet
                  markdown={outlineMarkdown}
                  emptyMessage="聊天后会在这里形成一版可编辑的访谈提纲。"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-line/70 pt-4">
            <button
              type="button"
              className="sidebar-secondary w-full"
              onClick={handleExportOutlinePdf}
              disabled={!outlineMarkdown.trim()}
            >
              <Download className="h-4 w-4" />
              导出访谈提纲 PDF
            </button>
            <button
              type="button"
              className="send-pill justify-center"
              onClick={handleGoToUpload}
              disabled={!outlineMarkdown.trim()}
            >
              下一步：上传访谈音频
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-sm leading-6 text-muted">
              进入下一步后，项目名称、受访对象、场景和提纲草稿会自动带入上传页。
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
