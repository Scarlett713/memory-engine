import { normalizeOutlineProfile } from "@/lib/outline-session";
import type {
  LlmAskResult,
  LlmEmotionSignal,
  LlmOutlineChatInput,
  LlmProvider,
  LlmRefineInput,
  LlmRefineResult,
  LlmSensitiveMark,
  LlmStructuredSection,
  LlmTimelineEvent,
} from "@/lib/providers/llm/types";
import {
  sensitiveMarkTypes,
  type SensitiveMarkType,
} from "@/lib/types/project";
import type { OutlineChatResult } from "@/lib/types/outline";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable ${name} for Ark LLM.`);
  }

  return value;
}

function extractOutputText(payload: {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}) {
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

function extractJsonObject(text: string) {
  const direct = text.trim();

  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    // noop
  }

  const fencedMatch = direct.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1]) as Record<string, unknown>;
    } catch {
      // noop
    }
  }

  const firstBrace = direct.indexOf("{");
  const lastBrace = direct.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = direct.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced) as Record<string, unknown>;
    } catch {
      // noop
    }
  }

  return null;
}

function normalizeStringArray(value: unknown, limit = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

const sensitiveMarkTypeSet = new Set<string>(sensitiveMarkTypes);

// 模型可能返回约定枚举值、旧词表英文拼写（institution / personal_name …）
// 或中文自由文本，统一归到枚举；无法识别落 "other"。
// 注意：白名单必须放在正则之前——中文正则匹配不了 "name"，
// 否则所有合法枚举值都会被判成 "other"。
export function normalizeMarkType(raw: unknown): SensitiveMarkType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return "other";
  if (sensitiveMarkTypeSet.has(s)) return s as SensitiveMarkType;

  // 旧词表 / 英文别名
  if (/personal_?name/.test(s)) return "name";
  if (/personal_(history|experience)/.test(s)) return "other";
  if (/institution/.test(s)) return "organization";

  // 中文自由文本
  if (/姓名|称谓|名字|人名/.test(s)) return "name";
  if (/电话|手机|联系方式/.test(s)) return "phone";
  if (/身份证/.test(s)) return "id_card";
  if (/地址|住址/.test(s)) return "address";
  if (/单位|机构|组织|学校/.test(s)) return "organization";
  if (/邮箱|账号|社交/.test(s)) return "contact_account";
  return "other";
}

function normalizeSensitiveMarks(value: unknown): LlmSensitiveMark[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const mark = item as Record<string, unknown>;
      const type = normalizeMarkType(mark.type);
      const excerpt =
        typeof mark.excerpt === "string" ? mark.excerpt.trim() : "";
      const reason = typeof mark.reason === "string" ? mark.reason.trim() : "";
      // 严格等值判断：字段缺失、null、字符串 "true" 一律落 false
      const needsVerify = mark.needsVerify === true;

      if (!excerpt) {
        return null;
      }

      return {
        type,
        excerpt,
        reason: reason || "需要人工复核。",
        needsVerify,
      };
    })
    .filter((item): item is LlmSensitiveMark => Boolean(item));
}

function normalizeEmotionSignals(value: unknown): LlmEmotionSignal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const signal = item as Record<string, unknown>;
      const label = typeof signal.label === "string" ? signal.label.trim() : "";
      const excerpt =
        typeof signal.excerpt === "string" ? signal.excerpt.trim() : "";
      const guidance =
        typeof signal.guidance === "string" ? signal.guidance.trim() : "";
      const level = signal.level;

      if (!label || !excerpt) {
        return null;
      }

      return {
        label,
        excerpt,
        guidance: guidance || "建议人工复核当前情绪片段。",
        level:
          level === "high" || level === "warning" || level === "notice"
            ? level
            : "notice",
      };
    })
    .filter((item): item is LlmEmotionSignal => Boolean(item));
}

function normalizeStructuredSections(value: unknown): LlmStructuredSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const section = item as Record<string, unknown>;
      const heading =
        typeof section.heading === "string" ? section.heading.trim() : "";
      const content =
        typeof section.content === "string" ? section.content.trim() : "";

      if (!heading || !content) {
        return null;
      }

      return {
        heading,
        content,
      };
    })
    .filter((item): item is LlmStructuredSection => Boolean(item));
}

function normalizeTimelineEvents(value: unknown): LlmTimelineEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const event = item as Record<string, unknown>;
      const timeLabel =
        typeof event.timeLabel === "string" ? event.timeLabel.trim() : "";
      const title = typeof event.title === "string" ? event.title.trim() : "";
      const description =
        typeof event.description === "string"
          ? event.description.trim()
          : "";

      if (!title || !description) {
        return null;
      }

      return {
        timeLabel: timeLabel || "时间待补充",
        title,
        description,
      };
    })
    .filter((item): item is LlmTimelineEvent => Boolean(item));
}

type ArkResponsePayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class ArkLlmProvider implements LlmProvider {
  private readonly apiUrl =
    process.env.LLM_API_URL?.trim() ||
    "https://ark.cn-beijing.volces.com/api/v3/responses";

  private readonly apiKey = getRequiredEnv("LLM_API_KEY");

  private readonly model =
    process.env.LLM_MODEL?.trim() || "deepseek-v3-2-251201";

  private async requestOutputText(prompt: string) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ark LLM request failed: ${errorText}`);
    }

    const payload = (await response.json()) as ArkResponsePayload;
    return extractOutputText(payload);
  }

  async askQuestion(prompt: string): Promise<LlmAskResult> {
    return { answer: await this.requestOutputText(prompt) };
  }

  async refineTranscript(input: LlmRefineInput): Promise<LlmRefineResult> {
    const prompt = [
      "You are an oral-history editing assistant for the Memory Engine project.",
      "Your task is specialized for oral history archives, not general chat.",
      "Work from the transcript and return archival-grade structured JSON only.",
      "Do not invent facts. Do not significantly add or remove content.",
      "Keep all output in the same language as the transcript.",
      `Interview scenario: ${input.scenario}`,
      `Research focus: ${input.researchFocus || "未提供"}`,
      `Privacy level: ${input.privacyLevel}（仅供你判断哪些内容需要标记，不是要你据此改写文本）`,
      `Custom redaction rules: ${input.customRedactionRules.join(", ") || "none"}（仅供你判断哪些内容需要标记）`,
      "Return strict JSON only. No markdown. No commentary.",
      "Use this exact JSON shape:",
      JSON.stringify({
        aiDraft: "",
        summary: "",
        keywords: [""],
        redactionNotes: [""],
        sensitiveMarks: [
          {
            type: "name | phone | id_card | address | organization | contact_account | other",
            excerpt: "",
            reason: "",
            needsVerify: false,
          },
        ],
        emotionalSignals: [
          { label: "", level: "notice", excerpt: "", guidance: "" },
        ],
        structuredSections: [{ heading: "", content: "" }],
        timelineEvents: [{ timeLabel: "", title: "", description: "" }],
      }),
      "Requirements:",
      "1. 严禁自行脱敏。aiDraft、summary、structuredSections、timelineEvents、emotionalSignals 中的任何文本都必须原样保留受访者所述内容——姓名、住址、电话、身份证号、工作单位一律照写，不要替换成 [已脱敏]、[住址已脱敏]、[手机号已脱敏]、*** 等任何占位符，也不要直接删去该内容。脱敏由系统在你返回之后统一执行；你若提前替换，原文将永久丢失。",
      "2. 你唯一的脱敏职责是输出 sensitiveMarks：逐条列出需要脱敏的原文片段。excerpt 必须是 transcript 中逐字连续出现的原文，不得改写、概括或提前替换，否则系统无法定位。",
      "3. aiDraft should lightly clean up spoken language into an archival draft, removing filler words such as 嗯、啊、呃 when they do not affect meaning. 允许删语气词；不允许删改敏感信息。",
      "4. summary should be concise and accurate, and follows the same no-redaction rule as aiDraft.",
      "5. keywords should contain 3 to 6 topical terms.",
      "6. emotionalSignals should identify emotional fluctuation, trauma cues, or safety-sensitive passages.",
      "7. 标记私人敏感信息：普通个人姓名、联系方式、家庭住址、私人身份信息。以下不标记：政府机关、公共机构、知名企业、公开地名、以公共身份被提及的历史人物和公众人物。同名私人、单位内部非公开部门、非公开个人经历细节仍须标记。无法确定是否公开时仍输出标记但带 needsVerify: true。AI 不自行决定跳过。type 字段必须是以下值之一：name / phone / id_card / address / organization / contact_account / other，不得输出其他字符串。",
      "8. structuredSections should organize the transcript into academic/archive-friendly sections.",
      "9. timelineEvents should extract key events or life stages in chronological form when possible.",
      ...(input.writingRules ? [input.writingRules] : []),
      "Transcript:",
      input.transcript,
    ].join("\n");

    const outputText = await this.requestOutputText(prompt);
    const parsed = extractJsonObject(outputText);

    if (!parsed) {
      return {
        provider: `ark-${this.model}`,
        aiDraft: outputText || input.transcript,
        summary: "模型已返回结果，但结构化 JSON 解析失败，建议人工复核。",
        keywords: ["口述历史", "人工复核"],
        redactionNotes: [
          "模型返回结果未成功结构化解析，请重点检查敏感信息与情绪风险内容。",
        ],
        sensitiveMarks: [],
        emotionalSignals: [],
        structuredSections: [
          {
            heading: "模型原始输出",
            content: outputText || input.transcript,
          },
        ],
        timelineEvents: [],
      };
    }

    const aiDraftRaw =
      typeof parsed.aiDraft === "string" ? parsed.aiDraft.trim() : "";
    const summaryRaw =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";

    return {
      provider: `ark-${this.model}`,
      aiDraft: aiDraftRaw || input.transcript,
      summary: summaryRaw || "模型未返回摘要，请人工补充。",
      keywords: normalizeStringArray(parsed.keywords, 6),
      redactionNotes: normalizeStringArray(parsed.redactionNotes, 8),
      sensitiveMarks: normalizeSensitiveMarks(parsed.sensitiveMarks),
      emotionalSignals: normalizeEmotionSignals(parsed.emotionalSignals),
      structuredSections: normalizeStructuredSections(parsed.structuredSections),
      timelineEvents: normalizeTimelineEvents(parsed.timelineEvents),
    };
  }

  async generateInterviewOutline(
    input: LlmOutlineChatInput,
  ): Promise<OutlineChatResult> {
    const profile = normalizeOutlineProfile(input.profile);
    const conversation = input.messages
      .slice(-10)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
      .join("\n");

    const prompt = [
      "You are an oral-history interview planning copilot.",
      "Help the researcher build an interview outline through a natural conversation.",
      "You should ask focused follow-up questions when information is missing, but also keep updating a usable outline draft.",
      "The output will be displayed directly to the user in Chinese.",
      "Return strict JSON only. No markdown fences. No extra commentary.",
      "Use this exact JSON shape:",
      JSON.stringify({
        assistantMessage: "",
        readiness: "collecting",
        checkpoints: [""],
        profile: {
          projectName: "",
          intervieweeName: "",
          institutionName: "",
          collectionScenario: "urban_memory",
          researchFocus: "",
          notes: "",
        },
        outlineMarkdown: "## 访谈目标\n- 了解受访者的搬迁经历",
      }),
      "Rules:",
      "1. assistantMessage should sound like a conversation partner and ask at most one next question when needed.",
      "2. readiness must be one of collecting, drafting, ready.",
      "3. profile should merge the current known information and infer fields only when strongly supported by the conversation.",
      "4. outlineMarkdown must follow this exact heading hierarchy: use ## for major sections (访谈目标、开场问题、核心议题、情绪安全提示、现场记录提醒), use ### for subsections or specific topics within each section, use - for bullet points under subsections. Do not use # (h1) at all. Do not use bold (**text**) as a substitute for headings.",
      "5. The outline should cover interview goals, opening questions, deep-dive sections, emotion safety prompts, and on-site note reminders.",
      "6. Every event listed in planning context events, and every entry in timePoints, must be covered by its own dedicated subsection or bullet. Do not merge them into one generic section.",
      "7. Section titles must be in Chinese. Use ## 访谈目标, ## 开场问题, ## 核心议题（可按事件/时期分 ### 子节）, ## 情绪安全提示, ## 现场记录提醒. Bullets under 开场问题 and 核心议题 must each be a complete, natural Chinese question ending with 「？」. Bullets under 情绪安全提示 and 现场记录提醒 are reminders, not questions — write them as plain Chinese statements without 「？」.",
      "Current profile:",
      JSON.stringify(profile),
      "Planning context (events / time points the outline must cover):",
      JSON.stringify(input.planningContext ?? { events: [], timePoints: [] }),
      "Current outline draft:",
      input.currentOutline || "(empty)",
      "Conversation history:",
      conversation || "(empty)",
    ].join("\n");

    const outputText = await this.requestOutputText(prompt);
    const parsed = extractJsonObject(outputText);

    if (!parsed) {
      return {
        // 这一支不抛异常，调用方只能靠 degraded 区分「模型没给出可用提纲」和「真的生成了」。
        degraded: true,
        assistantMessage:
          "我先根据已有信息整理出一版可编辑提纲。你可以继续补充背景，我会继续细化。",
        readiness: input.currentOutline.trim() ? "drafting" : "collecting",
        checkpoints: ["模型输出未完全结构化，建议人工继续完善"],
        profile,
        outlineMarkdown: input.currentOutline.trim() || "# 访谈提纲草案\n\n- 待补充访谈背景",
      };
    }

    const nextProfile = normalizeOutlineProfile(
      parsed.profile as Partial<typeof profile> | null | undefined,
    );
    const readiness =
      parsed.readiness === "ready" ||
      parsed.readiness === "drafting" ||
      parsed.readiness === "collecting"
        ? parsed.readiness
        : "drafting";
    const assistantMessage =
      typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
        ? parsed.assistantMessage.trim()
        : "我先整理出一版访谈提纲，你可以继续补充细节。";
    const outlineMarkdown =
      typeof parsed.outlineMarkdown === "string" && parsed.outlineMarkdown.trim()
        ? parsed.outlineMarkdown
        : input.currentOutline || "# 访谈提纲草案\n\n- 待补充访谈背景";

    return {
      assistantMessage,
      readiness,
      checkpoints: normalizeStringArray(parsed.checkpoints, 6),
      profile: nextProfile,
      outlineMarkdown,
    };
  }
}
