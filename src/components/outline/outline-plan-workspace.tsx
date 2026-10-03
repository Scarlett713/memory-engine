"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  LoaderCircle,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { nanoid } from "nanoid";

import { StringListField } from "@/components/outline/string-list-field";
import { Button } from "@/components/ui/button";
import { interviewScenarioOptions } from "@/lib/oral-history";
import {
  clearOutlineDraftFromSession,
  OUTLINE_FLAG_PARAM,
  saveOutlineDraftToSession,
} from "@/lib/outline-session";
import type { OutlineChatMessage } from "@/lib/types/outline";
import type { InterviewScenario } from "@/lib/types/project";

const MESSAGE_MAX_LENGTH = 1000;
// 与 route 的 MESSAGE_HISTORY_LIMIT 对齐：历史只留最近 10 条。
const MESSAGE_HISTORY_LIMIT = 10;

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

export function OutlinePlanWorkspace() {
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [institution, setInstitution] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [collectionScenario, setCollectionScenario] =
    useState<InterviewScenario>("urban_memory");
  const [events, setEvents] = useState<string[]>([""]);
  const [timePoints, setTimePoints] = useState<string[]>([""]);
  const [ethicsNotes, setEthicsNotes] = useState("");

  const [markdown, setMarkdown] = useState("");
  const [notice, setNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 对话历史只活在页面里：不写 sessionStorage，刷新即丢（本轮约定）。
  const [messages, setMessages] = useState<OutlineChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  // 记住上一次生成的原文，用来判断用户是不是手动改过。
  const lastGeneratedRef = useRef("");
  const canGenerate =
    Boolean(subject.trim() && topic.trim()) && !isGenerating && !isChatting;
  const canChat = Boolean(chatInput.trim()) && !isChatting && !isGenerating;

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 空历史直接 return：生成成功会 setMessages([])，新数组引用照样触发本 effect，
    // 此时若照滚会把页面硬拽到对话区。
    if (!messages.length) {
      return;
    }

    // block: "nearest" 只滚最近的滚动祖先（那个 max-h-48 容器），不连带滚整页。
    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    if (markdown.trim() && markdown !== lastGeneratedRef.current) {
      const confirmed = window.confirm(
        "重新生成将覆盖当前已编辑的提纲，确定继续？",
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
          institution: institution.trim(),
          researchFocus: researchFocus.trim(),
          collectionScenario,
          events: events.map((item) => item.trim()).filter(Boolean),
          timePoints: timePoints.map((item) => item.trim()).filter(Boolean),
          ethicsNotes: ethicsNotes.trim(),
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
    } catch {
      // 这一支不 rethrow，markdown 同样被换成了通用模板，所以一并清历史。
      const fallback = buildFallbackMarkdown(topic);
      setMarkdown(fallback);
      setMessages([]);
      lastGeneratedRef.current = fallback;
      setNotice("LLM 生成失败，已载入通用模板，可手动调整");
    } finally {
      setIsGenerating(false);
    }
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
          institution: institution.trim(),
          researchFocus: researchFocus.trim(),
          collectionScenario,
          events: events.map((item) => item.trim()).filter(Boolean),
          timePoints: timePoints.map((item) => item.trim()).filter(Boolean),
          ethicsNotes: ethicsNotes.trim(),
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
      institutionName: institution.trim(),
      collectionScenario,
      researchFocus: researchFocus.trim(),
      notes: ethicsNotes.trim(),
    });
    router.push(`/upload?${OUTLINE_FLAG_PARAM}=1`);
  }

  function handleSkip() {
    clearOutlineDraftFromSession();
    router.push("/upload");
  }

  const scenarioHint =
    interviewScenarioOptions.find((option) => option.value === collectionScenario)
      ?.description ?? "";

  return (
    <main className="min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5">
      <div className="flex flex-col gap-2">
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

        <div className="grid min-w-0 gap-2 lg:grid-cols-2">
          <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-4 rounded-[1.85rem] p-4 md:p-5">
            <div className="surface-card rounded-[1.55rem] p-4">
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

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="outline-subject">
                    受访者姓名
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    id="outline-subject"
                    className="text-field"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="例如：陈秀兰"
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="outline-topic">
                    访谈主题
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    id="outline-topic"
                    className="text-field"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="例如：老城厢搬迁与邻里记忆"
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="outline-institution">
                    机构 / 单位
                  </label>
                  <input
                    id="outline-institution"
                    className="text-field"
                    value={institution}
                    onChange={(event) => setInstitution(event.target.value)}
                    placeholder="例如：黄浦区档案馆"
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="outline-scenario">
                    采集场景
                  </label>
                  <select
                    id="outline-scenario"
                    className="text-field"
                    value={collectionScenario}
                    onChange={(event) =>
                      setCollectionScenario(event.target.value as InterviewScenario)
                    }
                  >
                    {interviewScenarioOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="field-label" htmlFor="outline-focus">
                    研究焦点
                  </label>
                  <input
                    id="outline-focus"
                    className="text-field"
                    value={researchFocus}
                    onChange={(event) => setResearchFocus(event.target.value)}
                    placeholder="例如：搬迁前后家庭关系与邻里网络的变化"
                  />
                </div>
              </div>

              {scenarioHint ? (
                <p className="mt-3 text-xs leading-5 text-muted">{scenarioHint}</p>
              ) : null}
            </div>

            <div className="surface-card rounded-[1.55rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">事件与时间节点</p>
                  <h2 className="mt-1.5 text-base font-semibold text-foreground">
                    让提纲围绕具体经历展开
                  </h2>
                </div>
                <div className="tape-label">Timeline</div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <StringListField
                  id="outline-event"
                  label="重大事件"
                  values={events}
                  placeholder="例如：1985 年全家搬离老城厢"
                  addLabel="添加事件"
                  onChange={setEvents}
                />

                <StringListField
                  id="outline-timepoint"
                  label="时间节点"
                  values={timePoints}
                  placeholder="例如：1992 年下岗转做个体经营"
                  addLabel="添加时间节点"
                  onChange={setTimePoints}
                />

                <div>
                  <label className="field-label" htmlFor="outline-ethics">
                    伦理备注
                  </label>
                  <textarea
                    id="outline-ethics"
                    className="text-area min-h-[7rem]"
                    value={ethicsNotes}
                    onChange={(event) => setEthicsNotes(event.target.value)}
                    placeholder="例如：涉及已故亲属，需放慢节奏；受访者要求隐去具体门牌号。"
                  />
                </div>
              </div>
            </div>

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
          </section>

          <section className="archive-frame paper-panel paper-panel-strong flex flex-col gap-4 rounded-[1.85rem] p-4 md:p-5">
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
              <textarea
                className="text-area min-h-[24rem] flex-1"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                aria-label="访谈提纲草稿"
              />
            ) : (
              <div className="surface-card flex min-h-[24rem] flex-1 items-center justify-center rounded-[1.55rem] px-4 py-4 text-sm leading-6 text-muted">
                {isGenerating ? "正在生成提纲…" : "填写左侧信息后点击生成"}
              </div>
            )}

            {markdown ? (
              <div className="surface-card flex flex-col gap-3 rounded-[1.55rem] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-eyebrow">多轮对话细化</p>
                  {messages.length ? (
                    <span className="text-xs text-muted">
                      {messages.length} 条记录
                    </span>
                  ) : null}
                </div>

                {messages.length ? (
                  <div className="soft-scroll flex max-h-48 flex-col gap-3 overflow-y-auto pr-1">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`chat-row ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
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
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSkip}
                className="w-full sm:w-auto"
              >
                跳过，直接上传
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!markdown.trim()}
                className="w-full sm:w-auto"
              >
                确认提纲，进入上传
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
