"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MessagesSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ProjectQAPanelProps = {
  projectId: string;
};

export function ProjectQAPanel({ projectId }: ProjectQAPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submitQuestion() {
    const trimmed = question.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "提问失败，请稍后重试。");
      }

      setAnswer(payload.answer ?? "");
    } catch (askError) {
      setAnswer("");
      setError(
        askError instanceof Error ? askError.message : "提问失败，请稍后重试。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter 保持换行；Enter / Ctrl+Enter 触发提交
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void submitQuestion();
  }

  return (
    <section className="surface-card rounded-[1.5rem] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-eyebrow">智能问答</p>
          <h3 className="mt-1.5 flex items-center gap-2 text-base font-semibold text-foreground">
            <MessagesSquare className="h-4 w-4 text-accent-strong" />
            基于整理稿提问
          </h3>
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? (
            <>
              <ChevronDown className="h-4 w-4" />
              收起
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4" />
              展开问答
            </>
          )}
        </Button>
      </div>

      {!isOpen && (
        <p className="mt-2 text-xs text-muted">
          试试问：「受访者提到了哪些关键时间节点？」
        </p>
      )}

      {isOpen ? (
        <>
          <p className="mt-3 text-sm text-muted">
            不建立向量库，直接基于本项目整理稿内容回答。
          </p>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <textarea
              className="text-field min-h-[5rem]"
              placeholder="例如：受访者提到了哪些关键词？"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!question.trim() || isLoading}>
                {isLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    回答中…
                  </>
                ) : (
                  "提问"
                )}
              </Button>
            </div>
          </form>

          {answer ? (
            <div className="mt-3 rounded-[1.2rem] border border-line-strong bg-white/72 px-4 py-3 text-sm leading-7 text-foreground">
              <p className="section-eyebrow mb-1.5">回答</p>
              <p className="whitespace-pre-wrap">{answer}</p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-[1.2rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
              {error}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
