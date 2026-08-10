"use client";

import type { ReactNode } from "react";

type MarkdownSheetProps = {
  markdown: string;
  emptyMessage?: string;
  className?: string;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function MarkdownSheet({
  markdown,
  emptyMessage = "暂无提纲内容",
  className = "",
}: MarkdownSheetProps) {
  const lines = markdown.split("\n");
  const elements: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${index}`} className="mt-4 text-sm font-semibold text-foreground">
          {line.slice(4)}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${index}`} className="mt-5 text-base font-semibold text-accent-strong">
          {line.slice(3)}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${index}`} className="font-display text-xl font-semibold text-accent-strong">
          {line.slice(2)}
        </h1>,
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      elements.push(
        <ul key={`ul-${index}`} className="mt-3 space-y-2 pl-5 text-sm leading-7 text-muted">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="list-disc">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      elements.push(
        <ol key={`ol-${index}`} className="mt-3 space-y-2 pl-5 text-sm leading-7 text-muted">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="list-decimal">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    elements.push(
      <p key={`p-${index}`} className="mt-3 text-sm leading-7 text-muted">
        {renderInline(line)}
      </p>,
    );
    index += 1;
  }

  return (
    <div className={`markdown-sheet ${className}`}>
      {elements.length > 0 ? (
        elements
      ) : (
        <p className="text-sm leading-7 text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}
