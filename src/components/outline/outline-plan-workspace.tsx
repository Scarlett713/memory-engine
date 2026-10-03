"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles } from "lucide-react";

import { StringListField } from "@/components/outline/string-list-field";
import { Button } from "@/components/ui/button";
import { interviewScenarioOptions } from "@/lib/oral-history";
import {
  clearOutlineDraftFromSession,
  OUTLINE_FLAG_PARAM,
  saveOutlineDraftToSession,
} from "@/lib/outline-session";
import type { InterviewScenario } from "@/lib/types/project";

type OutlineGenerateResponse = {
  markdown?: string;
  error?: string;
  // 老 route 用的是 message 信封，读的时候两个都认。
  message?: string;
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

  // 记住上一次生成的原文，用来判断用户是不是手动改过。
  const lastGeneratedRef = useRef("");
  const canGenerate = Boolean(subject.trim() && topic.trim()) && !isGenerating;

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

      setMarkdown(generated);
      lastGeneratedRef.current = generated;
      setNotice("");
    } catch {
      const fallback = buildFallbackMarkdown(topic);
      setMarkdown(fallback);
      lastGeneratedRef.current = fallback;
      setNotice("LLM 生成失败，已载入通用模板，可手动调整");
    } finally {
      setIsGenerating(false);
    }
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
