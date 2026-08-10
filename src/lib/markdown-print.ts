function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string) {
  let html = escapeHtml(text);

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  return html;
}

function renderMarkdownToHtml(markdown: string) {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    blocks.push(`<p>${renderInline(trimmed)}</p>`);
    index += 1;
  }

  return blocks.join("");
}

export function buildPrintableMarkdownDocument(input: {
  title: string;
  markdown: string;
  subtitle?: string;
}) {
  const body = input.markdown.trim()
    ? renderMarkdownToHtml(input.markdown)
    : "<p>?????????????</p>";

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 16mm 18mm 16mm;
      }

      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #201913;
        background: #f6efe6;
        font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      }

      .page {
        width: min(210mm, 100%);
        margin: 0 auto;
        padding: 18mm 16mm 22mm;
        background: #fffdfa;
      }

      .header {
        border-bottom: 1px solid rgba(100, 55, 36, 0.16);
        margin-bottom: 18px;
        padding-bottom: 14px;
      }

      .eyebrow {
        color: #9a5b3b;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.22em;
        margin: 0 0 10px;
        text-transform: uppercase;
      }

      .title {
        color: #643724;
        font-family: "Noto Serif SC", "Source Han Serif SC", serif;
        font-size: 28px;
        font-weight: 700;
        line-height: 1.25;
        margin: 0;
      }

      .subtitle {
        color: #6e5c4d;
        font-size: 13px;
        line-height: 1.7;
        margin: 10px 0 0;
      }

      .content {
        color: #201913;
      }

      .content h1,
      .content h2,
      .content h3 {
        color: #643724;
        font-family: "Noto Serif SC", "Source Han Serif SC", serif;
        line-height: 1.35;
        page-break-after: avoid;
      }

      .content h1 {
        font-size: 24px;
        margin: 0 0 14px;
      }

      .content h2 {
        font-size: 19px;
        margin: 24px 0 10px;
      }

      .content h3 {
        font-size: 16px;
        margin: 18px 0 8px;
      }

      .content p,
      .content li {
        font-size: 13px;
        line-height: 1.85;
      }

      .content p {
        margin: 10px 0;
      }

      .content ul,
      .content ol {
        margin: 10px 0 10px 22px;
        padding: 0;
      }

      .content li + li {
        margin-top: 4px;
      }

      .content code {
        background: rgba(234, 213, 194, 0.45);
        border-radius: 6px;
        font-family: "Cascadia Code", "Consolas", monospace;
        font-size: 12px;
        padding: 1px 5px;
      }

      .print-hint {
        color: #6e5c4d;
        font-size: 12px;
        line-height: 1.7;
        margin-top: 20px;
        padding-top: 12px;
        border-top: 1px dashed rgba(100, 55, 36, 0.18);
      }

      @media print {
        body {
          background: #ffffff;
        }

        .page {
          margin: 0;
          padding: 0;
          width: auto;
          background: transparent;
        }
      }
    </style>
    <script>
      window.addEventListener("load", () => {
        window.setTimeout(() => {
          window.print();
        }, 200);
      });
    </script>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <p class="eyebrow">Outline Export</p>
        <h1 class="title">${escapeHtml(input.title)}</h1>
        ${
          input.subtitle
            ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>`
            : ""
        }
      </header>
      <section class="content">${body}</section>
      <p class="print-hint">???????????? PDF????? PDF ???</p>
    </main>
  </body>
</html>`;
}
