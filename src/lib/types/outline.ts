import type { InterviewScenario } from "@/lib/types/project";

export type OutlineReadiness = "collecting" | "drafting" | "ready";

export type OutlineChatRole = "user" | "assistant";

export type OutlineChatMessage = {
  id: string;
  role: OutlineChatRole;
  content: string;
  createdAt: string;
};

export type OutlineProjectProfile = {
  projectName: string;
  intervieweeName: string;
  institutionName: string;
  collectionScenario: InterviewScenario;
  researchFocus: string;
  notes: string;
};

export type OutlineChatResult = {
  assistantMessage: string;
  outlineMarkdown: string;
  profile: OutlineProjectProfile;
  readiness: OutlineReadiness;
  checkpoints: string[];
};

export type StoredOutlineSession = {
  messages: OutlineChatMessage[];
  outlineMarkdown: string;
  profile: OutlineProjectProfile;
  readiness: OutlineReadiness;
  updatedAt: string;
};
