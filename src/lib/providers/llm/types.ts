import type {
  InterviewScenario,
  PrivacyLevel,
  RedactionRule,
} from "@/lib/types/project";
import type {
  OutlineChatMessage,
  OutlineChatResult,
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
  type: string;
  excerpt: string;
  reason: string;
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
