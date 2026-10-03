import type {
  InterviewScenario,
  PrivacyLevel,
  RedactionRule,
  SensitiveMarkType,
} from "@/lib/types/project";
import type {
  OutlineChatMessage,
  OutlineChatResult,
  OutlinePlanningContext,
  OutlineProjectProfile,
} from "@/lib/types/outline";

export type LlmRefineInput = {
  transcript: string;
  scenario: InterviewScenario;
  researchFocus: string;
  privacyLevel: PrivacyLevel;
  customRedactionRules: RedactionRule[];
};

export type LlmSensitiveMark = {
  type: SensitiveMarkType;
  excerpt: string;
  reason: string;
  // 归一化后的类型，normalizeSensitiveMarks 保证该字段存在（模型没返回时落 false）
  needsVerify: boolean;
};

export type LlmEmotionSignal = {
  label: string;
  level: "notice" | "warning" | "high";
  excerpt: string;
  guidance: string;
};

export type LlmStructuredSection = {
  heading: string;
  content: string;
};

export type LlmTimelineEvent = {
  timeLabel: string;
  title: string;
  description: string;
};

export type LlmRefineResult = {
  aiDraft: string;
  summary: string;
  keywords: string[];
  redactionNotes: string[];
  sensitiveMarks: LlmSensitiveMark[];
  emotionalSignals: LlmEmotionSignal[];
  structuredSections: LlmStructuredSection[];
  timelineEvents: LlmTimelineEvent[];
  provider: string;
};

export type LlmOutlineChatInput = {
  messages: OutlineChatMessage[];
  profile: OutlineProjectProfile;
  currentOutline: string;
  // 单次生成（/api/outline/generate）用，对话式调用可以不传。
  planningContext?: OutlinePlanningContext;
};

export type LlmAskResult = {
  answer: string;
};

export interface LlmProvider {
  refineTranscript(input: LlmRefineInput): Promise<LlmRefineResult>;
  generateInterviewOutline(
    input: LlmOutlineChatInput,
  ): Promise<OutlineChatResult>;
  askQuestion(prompt: string): Promise<LlmAskResult>;
}
