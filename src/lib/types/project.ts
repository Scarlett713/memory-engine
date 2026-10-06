export type ProjectStatus =
  | "uploaded"
  | "transcribing"
  | "ai_refining"
  | "manual_review"
  | "ready_to_export";

// PATCH 状态机白名单：仅允许代码实际执行的顺序流转；ready_to_export 为终态。
// 内部流转（process/export 路由）绕过 PATCH 直写 updateProject，不受此表约束。
export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  uploaded: ["transcribing"],
  transcribing: ["ai_refining"],
  ai_refining: ["manual_review"],
  manual_review: ["ready_to_export"],
  ready_to_export: [],
};

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

// 档案保密级别：面向归档后的可见范围，与脱敏级别（PrivacyLevel）是两个维度。
export type ConfidentialityLevel = "public" | "internal" | "confidential";

// 采集路径：本轮仅 upload 可用，ai_interview 预留。
export type CollectionPath = "upload" | "ai_interview";

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

export type SensitiveMarkStatus = "pending" | "confirmed" | "revoked";

// source 为后续「规则命中项也进审校列表」预留；本轮只有 'ai' 有写入方。
export type SensitiveMarkSource = "ai" | "custom_rule";

// 敏感信息类型受控枚举。数组是为归一化提供运行时白名单，别再手写第二份。
export const sensitiveMarkTypes = [
  "name",
  "phone",
  "id_card",
  "address",
  "organization",
  "contact_account",
  "other",
] as const;

export type SensitiveMarkType = (typeof sensitiveMarkTypes)[number];

export const sensitiveMarkTypeLabel: Record<SensitiveMarkType, string> = {
  name: "姓名",
  phone: "联系电话",
  id_card: "身份证号",
  address: "住址",
  organization: "机构/单位",
  contact_account: "邮箱/账号",
  other: "敏感信息",
};

export type SensitiveMark = {
  id: string;
  type: SensitiveMarkType;
  excerpt: string;
  reason: string;
  // 审校状态：revoked 的标记不再参与脱敏
  status: SensitiveMarkStatus;
  // AI 拿不准是否公开时标 true，交人工判断
  needsVerify: boolean;
  source: SensitiveMarkSource;
  reviewedAt?: string;
};

// 审校门禁：PATCH 与导出路由共用同一判定，避免两处漂移
export function countPendingSensitiveMarks(marks: SensitiveMark[]) {
  return marks.filter((mark) => mark.status === "pending").length;
}

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
  // 可选：存量项目无此字段，读取时由 normalizeProjectRecord 补默认值
  confidentialityLevel?: ConfidentialityLevel;
  collectionPath?: CollectionPath;
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
  language?: string;
  projectCode?: string;
  estimatedDuration?: number;
  versionHistory: VersionSnapshot[];
};

export function createInitialWorkflow(): WorkflowStep[] {
  return [
    {
      key: "upload",
      label: "音频已上传",
      description: "",
      status: "completed",
    },
    {
      key: "transcription",
      label: "转写",
      description: "",
      status: "pending",
    },
    {
      key: "ai_refine",
      label: "整理与隐私处理",
      description: "",
      status: "pending",
    },
    {
      key: "manual_review",
      label: "人工审校",
      description: "",
      status: "pending",
    },
    {
      key: "export",
      label: "成果导出",
      description: "",
      status: "pending",
    },
  ];
}


