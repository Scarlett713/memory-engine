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
      label: "涓婁紶鍙楄闊抽",
      description: "鍙楄闊抽宸蹭笂浼犲綊妗ｏ紝绯荤粺鍑嗗杩涘叆鑷姩鏁寸悊娴佺▼銆?,
      status: "completed",
    },
    {
      key: "transcription",
      label: "楂樼簿搴﹁闊宠浆鍐?,
      description: "璋冪敤璇煶璇嗗埆鏈嶅姟锛岃緭鍑哄彲鍥炴函鐨勫垎娈佃浆鍐欑粨鏋溿€?,
      status: "pending",
    },
    {
      key: "ai_refine",
      label: "缁撴瀯鍖栨暣鐞嗕笌鑴辨晱",
      description: "瀹屾垚鎽樿銆佺粨鏋勫寲鏁寸悊銆佹儏缁瘑鍒笌闅愮鑴辨晱銆?,
      status: "pending",
    },
    {
      key: "manual_review",
      label: "浜哄伐瀹℃牎",
      description: "鐮旂┒鍛樿繘琛屽鏍革紝骞跺喅瀹氭槸鍚﹁繘鍏ユ垚鏋滃鍑恒€?,
      status: "pending",
    },
    {
      key: "export",
      label: "妗ｆ绾ф垚鏋滃鍑?,
      description: "鐢熸垚鍙綊妗ｇ殑 docx銆乼xt 鍜岀粨鏋勫寲 JSON 鎴愭灉銆?,
      status: "pending",
    },
  ];
}


