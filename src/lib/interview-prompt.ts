// REQ-14 §3 模块 3 / §4.5：AI 访谈主持人的「下一问」prompt 构建与出参容错解析。
//
// 与既有整理链路的差异：llmProvider.askQuestion(prompt: string) 是单字符串契约，
// 且 ark-llm-provider 的 extractJsonObject 未导出，故本模块自带
// 「花括号切片 + 尾逗号修复 + 逐字段归一化」的容错解析，不依赖 provider 内部实现。
//
// 纯函数：无 IO、无副作用，可被 route 与验收脚本直接引用。

import { getInterviewScenarioDisplayLabel } from "@/lib/oral-history";
import type { InterviewScenario } from "@/lib/types/project";
import { renderTemplate } from "@/lib/writing-rules";

// PRD §12：服务端 15s（前端 10s）超时后自动跳下一问并标注「待补录」。
export const INTERVIEW_QUESTION_TIMEOUT_MS = 15_000;

// PRD §12 上下文切片：checklist ≤40 条、recentTranscript ≤4000 字。
export const CHECKLIST_MAX_ITEMS = 40;
export const RECENT_TRANSCRIPT_MAX_LENGTH = 4000;
export const OUTLINE_MARKDOWN_MAX_LENGTH = 4000;

// PRD §3 模块 3：同一题连续追问上限 2 次，达到后必须推进（硬强制，见 parseInterviewQuestionOutput）。
export const MAX_FOLLOW_UP_COUNT = 2;

// 单轮回答最多认领 3 条提纲覆盖，防模型把整份 checklist 标成已覆盖。
export const MAX_COVERED_ITEM_IDS = 3;

export type InterviewOutlineItem = {
  id: string;
  text: string;
};

export type InterviewQuestionPromptInput = {
  projectName: string;
  intervieweeName: string;
  scenario: InterviewScenario;
  customScenarioLabel?: string;
  researchFocus: string;
  language?: string;
  // 已解析的 checklist（[{id, text}]）；为空时回退 outlineMarkdown。
  checklist: readonly InterviewOutlineItem[];
  outlineMarkdown?: string;
  // 前面各轮已覆盖的提纲 id（会话态，不落库）。
  coveredItemIds: readonly string[];
  recentTranscript: string;
  followUpCount: number;
};

export type InterviewQuestionOutput = {
  question: string;
  isFollowUp: boolean;
  coveredItemIds: string[];
  isComplete: boolean;
};

export type InterviewQuestionParseOptions = {
  followUpCount?: number;
  // 传入时过滤掉模型虚构的 id：提纲覆盖态必须幂等（PRD §6.2）。
  checklistIds?: readonly string[];
};// 定稿原文：占位符由 buildInterviewQuestionPrompt 渲染；顶格书写，缩进会进 prompt。
export const INTERVIEW_QUESTION_PROMPT_TEMPLATE = `你是「记忆引擎」口述史项目的 AI 访谈主持人，正在代替研究员与受访者面对面交谈。你的唯一任务是：依据访谈提纲，用口语提出受访者可以自然回答的下一个问题。

【项目信息】
项目：{{PROJECT_NAME}}
受访者：{{INTERVIEWEE}}
访谈场景：{{SCENARIO_LABEL}}
研究焦点：{{RESEARCH_FOCUS}}
访谈语言：{{LANGUAGE}}（转写语言代码，cn=普通话、cn_cantonese=粤语；提问必须与转写语言一致）

【访谈提纲条目】（JSON 数组，id 为条目标识，text 为提纲问题，已截取 40 条以内）
{{CHECKLIST}}

已覆盖条目 id：{{COVERED_IDS}}
剩余未覆盖条目数：{{REMAINING}}

【最近对话转写（可能为空）】
{{RECENT_TRANSCRIPT}}

【本轮追问状态】
当前题连续追问次数：{{FOLLOW_UP_COUNT}}（达到 2 次时必须推进到下一题，不得再追问）

【主持人守则】
1. 一次只问一个问题，不超过 60 字，口语化、可直接朗读；不使用小标题，不使用「第一个问题」这类序号串场。
2. 提问必须指向剩余未覆盖条目中优先级最高的一条，按提纲顺序推进；受访者正在展开的话题可先顺着问完，再回到提纲；不得重复已覆盖条目的问题。
3. 不使用引导性、评价性、审问式措辞：不问「是不是」「对不对」「你有没有觉得很激动」，不做价值判断，不替受访者总结或归纳。
4. 地名、人名、时间、职业、机构等具体信息缺失时，可自然补问一次以求准确；同一事实不重复追问。
5. 受访者提到亲人去世、伤病、拆迁、灾难、冤屈等负面内容时，立即放慢节奏，用一句共情承接后停下（本轮 question 只写这句承接），不追问细节，不给建议或安抚话术。6. 只使用受访者已经说过的信息，不虚构、不补充研究者观点、不引入提纲与项目背景之外的内容。
7. 提纲条目中形如「（待补充）」「XX」「（待确认）」的占位内容不要念给受访者，请转换为开放式提问。
8. 受访者偏离主题超过两轮时，用一句衔接语把话题带回提纲主题，语气保持尊重。
9. 首轮（最近对话为空）：先用 15 字以内的开场问候，再问提纲第一条。
10. 追问判定：本轮回答只是「是／没有」或明显不完整，且连续追问次数小于 2 → isFollowUp 置 true；回答已基本充分，或追问已达 2 次 → isFollowUp 置 false 并推进下一题。

【输出格式】
只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字，字符串内不得换行：
{"question":"<要念给受访者的一句话>","isFollowUp":false,"coveredItemIds":["<本轮回答已覆盖的提纲 id，最多 3 个>"],"isComplete":false}
isComplete 仅在提纲所有条目均已覆盖、访谈可以收尾时为 true；此时 question 写一句简短的收尾致谢与后续材料约定。`;

export function buildInterviewQuestionPrompt(
  input: InterviewQuestionPromptInput,
): string {
  const checklist = normalizeChecklist(input.checklist);
  const coveredItemIds = normalizeCoveredItemIds(
    input.coveredItemIds,
    checklist.map((item) => item.id),
  );
  const recentTranscript = input.recentTranscript.trim();
  const outlineMarkdown = (input.outlineMarkdown ?? "").trim();

  return renderTemplate(INTERVIEW_QUESTION_PROMPT_TEMPLATE, {
    PROJECT_NAME: input.projectName.trim() || "未命名访谈项目",
    INTERVIEWEE: input.intervieweeName.trim() || "受访者",
    SCENARIO_LABEL:
      getInterviewScenarioDisplayLabel(
        input.scenario,
        input.customScenarioLabel,
      ) || "未指定场景",
    RESEARCH_FOCUS:
      input.researchFocus.trim() || "（未填写，请围绕受访者经历本身提问）",
    LANGUAGE: input.language?.trim() || "cn",
    CHECKLIST:
      checklist.length > 0
        ? JSON.stringify(checklist, null, 2)
        : outlineMarkdown
          ? "（提纲 checklist 解析为空，以下是提纲 markdown 原文）\n" +
            outlineMarkdown.slice(0, OUTLINE_MARKDOWN_MAX_LENGTH)
          : "（本次访谈没有可用提纲条目：请围绕研究焦点提出开放式问题）",
    COVERED_IDS: JSON.stringify(coveredItemIds),
    REMAINING:
      checklist.length > 0
        ? String(checklist.length - coveredItemIds.length)
        : "未知（本次无提纲条目）",
    RECENT_TRANSCRIPT: recentTranscript
      ? recentTranscript.slice(-RECENT_TRANSCRIPT_MAX_LENGTH)
      : "（访谈刚开始，暂无对话）",
    FOLLOW_UP_COUNT: String(normalizeFollowUpCount(input.followUpCount)),
  });
}// 出参解析：askQuestion 契约只回字符串，模型不一定守 JSON 格式，
// 故按「切片 → 宽松解析 → 逐字段归一化」三步处理；任何异常一律返回 null，
// 由调用方按 §7 兜底（本地兜底问题 + 「待补录」标注），不抛异常。
export function parseInterviewQuestionOutput(
  raw: unknown,
  options: InterviewQuestionParseOptions = {},
): InterviewQuestionOutput | null {
  const slice = extractJsonObjectSlice(raw);
  if (!slice) return null;

  const parsed = parseJsonObjectLoose(slice);
  if (!parsed) return null;

  const question = toTrimmedString(parsed.question);
  if (!question) return null;

  return {
    question,
    // 硬强制：达到追问上限后，无论模型返回什么都必须推进（D2 拍板）。
    isFollowUp:
      coerceBoolean(parsed.isFollowUp) &&
      normalizeFollowUpCount(options.followUpCount) < MAX_FOLLOW_UP_COUNT,
    coveredItemIds: normalizeCoveredItemIds(
      parsed.coveredItemIds,
      options.checklistIds,
    ),
    isComplete: coerceBoolean(parsed.isComplete),
  };
}

// 去掉 ```json 围栏与前后解释文字，只保留最外层 { ... }。
function extractJsonObjectSlice(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const text = raw.replace(/```(?:json)?/gi, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  return text.slice(start, end + 1);
}

// 先直接解析，失败再去掉尾逗号重试：模型最常见的两种坏格式。
function parseJsonObjectLoose(slice: string): Record<string, unknown> | null {
  for (const candidate of [slice, slice.replace(/,\s*([}\]])/g, "$1")]) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 换下一种候选形式重试
    }
  }

  return null;
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// 模型既可能回布尔，也可能回 "true" / "是" / 1，统一归一化。
function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const text = toTrimmedString(value).toLowerCase();
  return (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "y" ||
    text === "是"
  );
}export function normalizeFollowUpCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}

// checklist 运行时归一化：空 id / 空文本条目丢弃，并截到 CHECKLIST_MAX_ITEMS 条。
export function normalizeChecklist(value: unknown): InterviewOutlineItem[] {
  if (!Array.isArray(value)) return [];

  const items: InterviewOutlineItem[] = [];
  for (const entry of value) {
    const candidate = entry as { id?: unknown; text?: unknown } | null;
    const id = toTrimmedString(candidate?.id);
    const text = toTrimmedString(candidate?.text);
    if (!id || !text) continue;

    items.push({ id, text });
    if (items.length >= CHECKLIST_MAX_ITEMS) break;
  }

  return items;
}

// 覆盖态归一化：去重 + 只认字符串/数字 id + 最多 MAX_COVERED_ITEM_IDS 条；
// 传 checklistIds 时过滤模型虚构的 id（覆盖态必须幂等）。
export function normalizeCoveredItemIds(
  value: unknown,
  checklistIds?: readonly string[],
): string[] {
  if (!Array.isArray(value)) return [];

  const allowed = checklistIds ? new Set(checklistIds) : null;
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const entry of value) {
    const id =
      typeof entry === "string"
        ? entry.trim()
        : typeof entry === "number"
          ? String(entry)
          : "";
    if (!id || seen.has(id)) continue;
    if (allowed && !allowed.has(id)) continue;

    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_COVERED_ITEM_IDS) break;
  }

  return ids;
}