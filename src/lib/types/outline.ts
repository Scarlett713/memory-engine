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

// 提纲生成的规划输入：受访者的重大事件与时间节点。
// 刻意不放进 OutlineProjectProfile —— 回填 profile 时会经过模型返回的 JSON，
// 而 schema 里没有这两个字段，放进去会在 round-trip 中被静默丢掉。
export type OutlinePlanningContext = {
  events: string[];
  timePoints: string[];
};

export type OutlineChatResult = {
  assistantMessage: string;
  outlineMarkdown: string;
  profile: OutlineProjectProfile;
  readiness: OutlineReadiness;
  checkpoints: string[];
  // provider 未能解析模型输出、退回中性兜底时为 true。
  // 这种兜底不抛异常，调用方只能靠这个标志把「失败」和「成功」区分开。
  degraded?: boolean;
};

export type StoredOutlineSession = {
  messages: OutlineChatMessage[];
  outlineMarkdown: string;
  profile: OutlineProjectProfile;
  readiness: OutlineReadiness;
  updatedAt: string;
};
