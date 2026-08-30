export type ProjectStatus =
  | "uploaded"
  | "transcribing"
  | "ai_refining"
  | "manual_review"
  | "ready_to_export";

export type WorkflowStatus = "pending" | "in_progress" | "completed";

export type WorkflowStepKey =
  | "upload"
  | "transcription"
  | "ai_refine"
  | "manual_review"
  | "export";

export type WorkflowStep = {
  key: WorkflowStepKey;
  label: string;
  description: string;
  status: WorkflowStatus;
};

export type InterviewScenario =
  | "red_memory"
  | "intangible_heritage"
  | "family_memory"
  | "urban_memory"
  | "education_memory"
  | "custom";

export type PrivacyLevel = "basic" | "standard" | "strict";

export type RedactionRule =
  | "name"
  | "phone"
  | "id_card"
  | "address"
  | "organization"
  | "contact_account";

export type CollectionPlan = {
  outline: string[];
  livePrompts: string[];
  safetyTips: string[];
};

export type SensitiveMark = {
  id: string;
  type: string;
  excerpt: string;
  reason: string;
};

export type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  speaker: string;
  text: string;
  confidence?: number;
};

export type EmotionSignalLevel = "notice" | "warning" | "high";

export type EmotionSignal = {
  id: string;
  label: string;
  level: EmotionSignalLevel;
  excerpt: string;
  guidance: string;
};

export type StructuredSection = {
  id: string;
  heading: string;
  content: string;
};

export type TimelineEvent = {
  id: string;
  timeLabel: string;
  title: string;
  description: string;
};

export type VersionSnapshot = {
  id: string;
  label: string;
  content: string;
  createdAt: string;
};


export type UserType = "institution" | "personal";

export type InterviewOccasion =
  | "daily_chat"
  | "birthday"
  | "anniversary"
  | "family_gathering"
  | "other";

export type ExpectedOutput = "text" | "audio" | "both";

export type ProjectRecord = {
  id: string;
  projectName: string;
  institutionName: string;
  intervieweeName: string;
  customScenarioLabel: string;
  notes: string;
  outlineDraftMarkdown: string;
  audioFileName: string;
  audioStoragePath: string;
  audioSourceUrl: string;
  audioMimeType: string;
  audioSize: number;
  createdAt: string;
  updatedAt: string;
  // 项目归属用户；无 userId 的存量项目视为公共项目
  userId?: string;
  status: ProjectStatus;
  workflow: WorkflowStep[];
  collectionScenario: InterviewScenario;
  researchFocus: string;
  privacyLevel: PrivacyLevel;
  customRedactionRules: RedactionRule[];
  collectionPlan: CollectionPlan;
  summary: string;
  keywords: string[];
  transcriptRaw: string;
  transcriptSegments: TranscriptSegment[];
  transcriptionProvider: string;
  aiDraft: string;
  redactedTranscript: string;
  redactedAiDraft: string;
  llmProvider: string;
  structuredSections: StructuredSection[];
  timelineEvents: TimelineEvent[];
  emotionalSignals: EmotionSignal[];
  manualDraft: string;
  redactionNotes: string[];
  sensitiveMarks: SensitiveMark[];
  lastProcessingError: string | null;
  userType: UserType;
  consentFormPath: string;
  intervieweeRelation?: string;
  interviewOccasion?: InterviewOccasion;
  expectedOutput?: ExpectedOutput;
  projectCode?: string;
  estimatedDuration?: number;
  versionHistory: VersionSnapshot[];
};

export function createInitialWorkflow(): WorkflowStep[] {
  return [
    {
      key: "upload",
      label: "上传受访音频",
      description: "受访音频已上传归档，系统准备进入自动整理流程。",
      status: "completed",
    },
    {
      key: "transcription",
      label: "高精度语音转写",
      description: "调用语音识别服务，输出可回溯的分段转写结果。",
      status: "pending",
    },
    {
      key: "ai_refine",
      label: "结构化整理与脱敏",
      description: "完成摘要、结构化整理、情绪识别与隐私脱敏。",
      status: "pending",
    },
    {
      key: "manual_review",
      label: "人工审校",
      description: "研究员进行复核，并决定是否进入成果导出。",
      status: "pending",
    },
    {
      key: "export",
      label: "档案级成果导出",
      description: "生成可归档的 docx、txt 和结构化 JSON 成果。",
      status: "pending",
    },
  ];
}


