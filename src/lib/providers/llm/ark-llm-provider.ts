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
      const type = typeof mark.type === "string" ? mark.type.trim() : "";
      const excerpt =
        typeof mark.excerpt === "string" ? mark.excerpt.trim() : "";
      const reason = typeof mark.reason === "string" ? mark.reason.trim() : "";

      if (!type || !excerpt) {
        return null;
      }

      return {
        type,
        excerpt,
        reason: reason || "需要人工复核。",
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
      `Privacy level: ${input.privacyLevel}`,
      `Custom redaction rules: ${input.customRedactionRules.join(", ") || "none"}`,
      "Return strict JSON only. No markdown. No commentary.",
      "Use this exact JSON shape:",
      JSON.stringify({
        aiDraft: "",
        summary: "",
        keywords: [""],
        redactionNotes: [""],
        sensitiveMarks: [{ type: "", excerpt: "", reason: "" }],
        emotionalSignals: [
          { label: "", level: "notice", excerpt: "", guidance: "" },
        ],
        structuredSections: [{ heading: "", content: "" }],
        timelineEvents: [{ timeLabel: "", title: "", description: "" }],
      }),
      "Requirements:",
      "1. aiDraft should lightly clean up spoken language into an archival draft, removing filler words such as 嗯、啊、呃 when they do not affect meaning.",
      "2. summary should be concise and accurate.",
      "3. keywords should contain 3 to 6 topical terms.",
      "4. emotionalSignals should identify emotional fluctuation, trauma cues, or safety-sensitive passages.",
      "5. sensitiveMarks should capture names, phone numbers, ID numbers, exact home addresses, institutions, or other sensitive identifiers when present.",
      "6. structuredSections should organize the transcript into academic/archive-friendly sections.",
      "7. timelineEvents should extract key events or life stages in chronological form when possible.",
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
        outlineMarkdown: "# 标题",
      }),
      "Rules:",
      "1. assistantMessage should sound like a conversation partner and ask at most one next question when needed.",
      "2. readiness must be one of collecting, drafting, ready.",
      "3. profile should merge the current known information and infer fields only when strongly supported by the conversation.",
      "4. outlineMarkdown must be a polished markdown outline with headings and bullet points, suitable for direct editing.",
      "5. The outline should cover interview goals, opening questions, deep-dive sections, emotion safety prompts, and on-site note reminders.",
      "Current profile:",
      JSON.stringify(profile),
      "Current outline draft:",
      input.currentOutline || "(empty)",
      "Conversation history:",
      conversation || "(empty)",
    ].join("\n");

    const outputText = await this.requestOutputText(prompt);
    const parsed = extractJsonObject(outputText);

    if (!parsed) {
      return {
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
