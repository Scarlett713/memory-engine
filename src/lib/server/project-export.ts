import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";

import {
  applyRedactionProfile,
  getCollectionPathLabel,
  getConfidentialityLevelLabel,
  getInterviewScenarioDisplayLabel,
  getPrivacyLevelLabel,
  getRedactionRuleLabel,
} from "@/lib/oral-history";
import type { ProjectRecord } from "@/lib/types/project";
import { formatDateTime } from "@/lib/utils";

export type ProjectExportFormat = "docx" | "txt" | "json";

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "oral-history-project";
}

function splitParagraphLines(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, allLines) => line.length > 0 || allLines.length === 1);

  return lines.length > 0 ? lines : [""];
}

function createPlainParagraphs(
  value: string,
  options?: {
    spacingAfter?: number;
    compactSpacingAfter?: number;
  },
) {
  const spacingAfter = options?.spacingAfter ?? 120;
  const compactSpacingAfter = options?.compactSpacingAfter ?? 60;
  const lines = splitParagraphLines(value);

  return lines.map(
    (line, index) =>
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: {
          after: index === lines.length - 1 ? spacingAfter : compactSpacingAfter,
        },
        children: [new TextRun(line || " ")],
      }),
  );
}

function createMetadataRows(project: ProjectRecord) {
  const rows: Array<[string, string]> = [
    ["项目名称", project.projectName],
    ["受访对象", project.intervieweeName || "未填写"],
    ["整理机构", project.institutionName || "未填写"],
    [
      "口述场景",
      getInterviewScenarioDisplayLabel(
        project.collectionScenario,
        project.customScenarioLabel,
      ),
    ],
    ["研究焦点", project.researchFocus || "未填写"],
    ["保密级别", getConfidentialityLevelLabel(project.confidentialityLevel)],
    ["采集路径", getCollectionPathLabel(project.collectionPath)],
    ["脱敏级别", getPrivacyLevelLabel(project.privacyLevel)],
    [
      "脱敏规则",
      project.customRedactionRules.map(getRedactionRuleLabel).join("、") ||
        "未设置",
    ],
    ["建档时间", formatDateTime(project.createdAt)],
    ["最近更新", formatDateTime(project.updatedAt)],
  ];

  const border = { style: BorderStyle.SINGLE, size: 1, color: "D4C2AE" };
  const borders = { top: border, bottom: border, left: border, right: border };

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2200, 6826],
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 2200, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, bold: true })],
                }),
              ],
            }),
            new TableCell({
              borders,
              width: { size: 6826, type: WidthType.DXA },
              children: createPlainParagraphs(value, {
                spacingAfter: 0,
                compactSpacingAfter: 40,
              }),
            }),
          ],
        }),
    ),
  });
}

function createParagraphs(title: string, contents: string[]) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun(title)],
    }),
    ...contents.flatMap((content) => createPlainParagraphs(content)),
  ];
}

function stripMarkdownInline(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function createMarkdownParagraphs(title: string, markdown: string) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun(title)],
    }),
  ];
  const lines = markdown.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading =
        level <= 1
          ? HeadingLevel.HEADING_3
          : level === 2
            ? HeadingLevel.HEADING_4
            : HeadingLevel.HEADING_5;

      paragraphs.push(
        new Paragraph({
          heading,
          spacing: { before: 180, after: 80 },
          children: [new TextRun(stripMarkdownInline(headingMatch[2]))],
        }),
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 80 },
          numbering: {
            reference: "export-bullets",
            level: 0,
          },
          children: [new TextRun(stripMarkdownInline(bulletMatch[1]))],
        }),
      );
      continue;
    }

    const numberMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberMatch) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 80 },
          numbering: {
            reference: "export-numbers",
            level: 0,
          },
          children: [new TextRun(stripMarkdownInline(numberMatch[1]))],
        }),
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [new TextRun(stripMarkdownInline(line))],
      }),
    );
  }

  if (paragraphs.length === 1) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [new TextRun("未保存提纲草稿。")],
      }),
    );
  }

  return paragraphs;
}

function buildRedactedSegmentText(project: ProjectRecord) {
  return project.transcriptSegments.map((segment) => ({
    ...segment,
    text: applyRedactionProfile({
      text: segment.text,
      level: project.privacyLevel,
      rules: project.customRedactionRules,
      sensitiveMarks: project.sensitiveMarks,
    }),
  }));
}

function buildArchivePayload(project: ProjectRecord) {
  return {
    project: {
      id: project.id,
      projectName: project.projectName,
      intervieweeName: project.intervieweeName,
      institutionName: project.institutionName,
      collectionScenario: getInterviewScenarioDisplayLabel(
        project.collectionScenario,
        project.customScenarioLabel,
      ),
      researchFocus: project.researchFocus,
      notes: project.notes,
      confidentialityLevel: getConfidentialityLevelLabel(
        project.confidentialityLevel,
      ),
      collectionPath: getCollectionPathLabel(project.collectionPath),
      privacyLevel: getPrivacyLevelLabel(project.privacyLevel),
      customRedactionRules: project.customRedactionRules.map(getRedactionRuleLabel),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    collectionPlan: project.collectionPlan,
    outlineDraftMarkdown: project.outlineDraftMarkdown,
    summary: project.summary,
    keywords: project.keywords,
    emotionalSignals: project.emotionalSignals,
    redactionNotes: project.redactionNotes,
    structuredSections: project.structuredSections,
    timelineEvents: project.timelineEvents,
    redactedTranscript: project.redactedTranscript,
    redactedAiDraft: project.redactedAiDraft,
    transcriptSegments: buildRedactedSegmentText(project),
  };
}

async function buildDocx(project: ProjectRecord) {
  const payload = buildArchivePayload(project);

  const sections: ISectionOptions[] = [
    {
      properties: {
        page: {
          size: {
            width: 11906,
            height: 16838,
          },
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [
            new TextRun({
              text: `${project.projectName} 档案整理稿`,
              bold: true,
              size: 34,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: "记忆引擎 · 口述历史结构化成果导出",
              italics: true,
            }),
          ],
        }),
        createMetadataRows(project),
        ...createParagraphs("AI 智能采集辅助", [
          ...payload.collectionPlan.outline.map((item, index) => `${index + 1}. ${item}`),
          ...payload.collectionPlan.livePrompts.map((item) => `现场提示：${item}`),
          ...payload.collectionPlan.safetyTips.map((item) => `安全建议：${item}`),
        ]),
        ...createMarkdownParagraphs("访谈提纲草稿", payload.outlineDraftMarkdown),
        ...createParagraphs("口述摘要", [payload.summary || "暂无摘要。"]),
        ...createParagraphs(
          "结构化档案内容",
          payload.structuredSections.length > 0
            ? payload.structuredSections.map(
                (section) => `${section.heading}\n${section.content}`,
              )
            : ["暂无结构化内容。"],
        ),
        ...createParagraphs(
          "要素标引",
          payload.timelineEvents.length > 0
            ? payload.timelineEvents.map(
                (event) =>
                  `${event.timeLabel} - ${event.title}\n${event.description}`,
              )
            : ["暂无时间线内容。"],
        ),
        ...createParagraphs(
          "情绪提示",
          payload.emotionalSignals.length > 0
            ? payload.emotionalSignals.map(
                (signal) =>
                  `${signal.label}（${signal.level}）\n片段：${signal.excerpt}\n建议：${signal.guidance}`,
              )
            : ["未识别到需要重点提示的情绪风险片段。"],
        ),
        ...createParagraphs(
          "隐私脱敏说明",
          payload.redactionNotes.length > 0
            ? payload.redactionNotes
            : ["当前项目未生成额外脱敏提示。"],
        ),
        ...createParagraphs("脱敏整理稿", [payload.redactedAiDraft || "暂无整理稿。"]),
      ],
    },
  ];

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "export-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
        {
          reference: "export-numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22,
          },
        },
      },
    },
    sections,
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function buildTxt(project: ProjectRecord) {
  const payload = buildArchivePayload(project);

  return [
    `${project.projectName} 档案整理稿`,
    "",
    `受访对象：${project.intervieweeName || "未填写"}`,
    `整理机构：${project.institutionName || "未填写"}`,
    `口述场景：${getInterviewScenarioDisplayLabel(project.collectionScenario, project.customScenarioLabel)}`,
    `研究焦点：${project.researchFocus || "未填写"}`,
    `保密级别：${getConfidentialityLevelLabel(project.confidentialityLevel)}`,
    `采集路径：${getCollectionPathLabel(project.collectionPath)}`,
    `脱敏级别：${getPrivacyLevelLabel(project.privacyLevel)}`,
    `脱敏规则：${project.customRedactionRules.map(getRedactionRuleLabel).join("、") || "未设置"}`,
    "",
    "【AI 智能采集辅助】",
    ...payload.collectionPlan.outline.map((item, index) => `${index + 1}. ${item}`),
    ...payload.collectionPlan.livePrompts.map((item) => `现场提示：${item}`),
    ...payload.collectionPlan.safetyTips.map((item) => `安全建议：${item}`),
    "",
    "【访谈提纲草稿】",
    payload.outlineDraftMarkdown || "未保存提纲草稿。",
    "",
    "【口述摘要】",
    payload.summary || "暂无摘要。",
    "",
    "【结构化档案内容】",
    ...(payload.structuredSections.length > 0
      ? payload.structuredSections.flatMap((section) => [
          section.heading,
          section.content,
          "",
        ])
      : ["暂无结构化内容。", ""]),
    "【要素标引】",
    ...(payload.timelineEvents.length > 0
      ? payload.timelineEvents.flatMap((event) => [
          `${event.timeLabel} - ${event.title}`,
          event.description,
          "",
        ])
      : ["暂无时间线内容。", ""]),
    "【情绪提示】",
    ...(payload.emotionalSignals.length > 0
      ? payload.emotionalSignals.flatMap((signal) => [
          `${signal.label}（${signal.level}）`,
          `片段：${signal.excerpt}`,
          `建议：${signal.guidance}`,
          "",
        ])
      : ["未识别到需要重点提示的情绪风险片段。", ""]),
    "【隐私脱敏说明】",
    ...(payload.redactionNotes.length > 0
      ? payload.redactionNotes
      : ["当前项目未生成额外脱敏提示。"]),
    "",
    "【脱敏整理稿】",
    payload.redactedAiDraft || "暂无整理稿。",
  ].join("\n");
}

export async function createProjectExport(
  project: ProjectRecord,
  format: ProjectExportFormat,
) {
  const baseFileName = sanitizeFileName(project.projectName);

  if (format === "json") {
    return {
      body: JSON.stringify(buildArchivePayload(project), null, 2),
      contentType: "application/json; charset=utf-8",
      fileName: `${baseFileName}-archive.json`,
    };
  }

  if (format === "txt") {
    return {
      body: buildTxt(project),
      contentType: "text/plain; charset=utf-8",
      fileName: `${baseFileName}-archive.txt`,
    };
  }

  return {
    body: await buildDocx(project),
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileName: `${baseFileName}-archive.docx`,
  };
}
