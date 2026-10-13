import {
  AlignmentType,
  Document,
  Footer, // + REQ-25：页脚「—N—」
  LineRuleType, // + REQ-25：固定值 20 磅 / 1.5 倍行距
  PageNumber, // + REQ-25：页码域
  Packer,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";
// 已删（7 项）：BorderStyle / HeadingLevel / LevelFormat / Table / TableCell / TableRow / WidthType

import {
  applyRedactionProfile,
  getCollectionPathLabel,
  getConfidentialityLevelLabel,
  getEmotionLevelLabel,
  getInterviewScenarioDisplayLabel,
  getPrivacyLevelLabel,
  getRedactionRuleLabel,
} from "@/lib/oral-history";
import type { ProjectRecord } from "@/lib/types/project";
import { formatDateTime } from "@/lib/utils";

// ── 08 表 2 常量：字面只在这里写一遍 ────────────────────────────────────
// 表 2 只写「宋体」，四键同取，避免 Word 端中西文回退到 Arial（旧默认样式是 Arial）。
const SONG_FONT = { ascii: "宋体", eastAsia: "宋体", hAnsi: "宋体", cs: "宋体" };
// 固定值 20 磅（EXACT 下 1 单位 = 1/20 磅）；1.5 倍行距（AUTO 下 1 单位 = 1/240 行）。
const EXACT_20PT = { line: 400, lineRule: LineRuleType.EXACT };
const LINE_1_5 = { line: 360, lineRule: LineRuleType.AUTO };
// 小四（12pt）首行缩进 2 字符 = 24pt = 480 twips。
const FIRST_LINE_2CHARS = { firstLine: 480 };
// 字号（半磅）：三号 32 / 四号 28 / 小四 24。
const SIZE_TITLE = 32;
const SIZE_HEADING = 28;
const SIZE_BODY = 24;

// REQ-25 裁决 3：只在导出层剥离章标题的中文序号前缀（不动 writing-rules.ts 的常量）。
const CHAPTER_INDEX_PATTERN = /^[一二三四五六七八九十]+、\s*/;
// REQ-25 裁决 3 / PRD §4.1：章标题行判据（带序号才算标题，正文里的「一、」不误判）。
const CHAPTER_HEADING_PATTERN = /^[一二三四五六七八九十]+、\s*\S/;
// REQ-25 裁决 4 / PRD §4.5：生成侧空章节占位句（与 writing-rules.ts:186 同口径）。
const EMPTY_SECTION_PLACEHOLDER = "本节内容在本次访谈中未涉及";
// REQ-25 裁决 2：字段缺失统一占位，不留空。
const MISSING_FIELD_PLACEHOLDER = "待补";
// PRD P-25-4：成文稿整体为空时的正文兜底。
const EMPTY_DRAFT_TEXT = "暂无成文稿。";

export type ProjectExportFormat = "docx" | "txt" | "json";

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "oral-history-project";
}

function createTitleParagraph(project: ProjectRecord) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: LINE_1_5,
    children: [
      new TextRun({
        text: `${project.projectName} 档案整理稿`,
        bold: true,
        size: SIZE_TITLE,
        font: SONG_FONT,
      }),
    ],
  });
}

// 08 表 2 的「访谈对象简介 / 信息行 / 正文」三类要素属性逐字相同 → 共用一个工厂（D-25-3）。
function createStyledParagraph(text: string) {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: EXACT_20PT,
    indent: FIRST_LINE_2CHARS,
    children: [new TextRun({ text, size: SIZE_BODY, font: SONG_FONT })],
  });
}

function createBodyParagraphs(lines: string[]) {
  return lines.map(createStyledParagraph);
}

function createHeadingParagraph(title: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: LINE_1_5,
    children: [
      new TextRun({
        text: stripChapterIndex(title),
        bold: true,
        size: SIZE_HEADING,
        font: SONG_FONT,
      }),
    ],
  });
}

// REQ-25 裁决 2：元数据表整体删除，改为逐字模板两行；字段缺失写「待补」。
function createMetadataParagraphs(project: ProjectRecord) {
  const interviewee = project.intervieweeName.trim() || MISSING_FIELD_PLACEHOLDER;
  const projectName = project.projectName.trim() || MISSING_FIELD_PLACEHOLDER;
  const institution = project.institutionName.trim() || MISSING_FIELD_PLACEHOLDER;
  const confidentiality = getConfidentialityLevelLabel(project.confidentialityLevel);

  return [
    `${interviewee}，「${projectName}」受访者。`,
    // 建档时间沿用 BUG-08 口径（formatDateTime 钉 Asia/Shanghai）；
    // 裁决 9：最近更新本批不进信息行（信息行只三字段）。
    `采集时间：${formatDateTime(project.createdAt)} | 整理机构：${institution} | 保密级别：${confidentiality}`,
  ].map(createStyledParagraph);
}

// REQ-25 裁决 3：只在导出层剥离中文序号前缀；不匹配则原样返回（不补序号、不改其它编号形态）。
function stripChapterIndex(title: string) {
  return title.replace(CHAPTER_INDEX_PATTERN, "").trim();
}

// REQ-25 裁决 4 / PRD §4.5：正文为空、或即生成侧占位句 → 该章整段跳过（标题也不输出）。
function isChapterEmpty(body: string[]) {
  const text = body.join("").trim();
  return text.length === 0 || text === EMPTY_SECTION_PLACEHOLDER;
}

type ManualDraftChapter = { title: string; body: string[] };

// PRD §4.1：按行拆分；带序号的短行＝章标题；首个标题之前的非空行为「引子」（D-25-1，保留不丢字）。
function parseManualDraftChapters(value: string) {
  const lead: string[] = [];
  const chapters: ManualDraftChapter[] = [];
  let current: ManualDraftChapter | null = null;

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (CHAPTER_HEADING_PATTERN.test(line)) {
      current = { title: line, body: [] };
      chapters.push(current);
      continue;
    }

    if (current) {
      current.body.push(line);
    } else {
      lead.push(line);
    }
  }

  return { lead, chapters };
}

function createManualDraftBlocks(value: string) {
  const { lead, chapters } = parseManualDraftChapters(value);
  const blocks: Paragraph[] = createBodyParagraphs(lead);

  for (const chapter of chapters) {
    if (isChapterEmpty(chapter.body)) continue; // 裁决 4：空章节整段跳过
    blocks.push(createHeadingParagraph(chapter.title));
    blocks.push(...createBodyParagraphs(chapter.body));
  }

  return blocks;
}

// PRD §4.6：页脚居中「—N—」（宋体 / 四号）。
function createFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: ["—", PageNumber.CURRENT, "—"],
            size: SIZE_HEADING,
            font: SONG_FONT,
          }),
        ],
      }),
    ],
  });
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
  // REQ-25 裁决 1：成文稿取人工定稿 manualDraft；为空回退 redactedAiDraft（D-25-2）。
  // 刻意不经 buildArchivePayload —— json / txt 结构本批零改动（裁决 8）。
  const manualDraft = project.manualDraft.trim()
    ? project.manualDraft
    : project.redactedAiDraft;

  const draftBlocks = createManualDraftBlocks(manualDraft);

  const sections: ISectionOptions[] = [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      footers: { default: createFooter() },
      children: [
        createTitleParagraph(project),
        ...createMetadataParagraphs(project),
        ...(draftBlocks.length > 0
          ? draftBlocks
          : [createStyledParagraph(EMPTY_DRAFT_TEXT)]),
      ],
    },
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: SONG_FONT, size: SIZE_BODY },
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
          `${signal.label}（${getEmotionLevelLabel(signal.level)}）`,
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
