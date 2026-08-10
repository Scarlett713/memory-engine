import type {
  OutlineChatMessage,
  OutlineProjectProfile,
  OutlineReadiness,
  StoredOutlineSession,
} from "@/lib/types/outline";

export const OUTLINE_SESSION_STORAGE_KEY = "memory-engine-outline-session";

export function createEmptyOutlineProfile(): OutlineProjectProfile {
  return {
    projectName: "",
    intervieweeName: "",
    institutionName: "",
    collectionScenario: "urban_memory",
    researchFocus: "",
    notes: "",
  };
}

export function normalizeOutlineProfile(
  profile?: Partial<OutlineProjectProfile> | null,
): OutlineProjectProfile {
  const base = createEmptyOutlineProfile();

  return {
    projectName: profile?.projectName?.trim() ?? base.projectName,
    intervieweeName: profile?.intervieweeName?.trim() ?? base.intervieweeName,
    institutionName: profile?.institutionName?.trim() ?? base.institutionName,
    collectionScenario:
      profile?.collectionScenario ?? base.collectionScenario,
    researchFocus: profile?.researchFocus?.trim() ?? base.researchFocus,
    notes: profile?.notes?.trim() ?? base.notes,
  };
}

export function normalizeOutlineMessages(
  messages?: Array<Partial<OutlineChatMessage>> | null,
): OutlineChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message, index) => {
      if (!message || (message.role !== "user" && message.role !== "assistant")) {
        return null;
      }

      const content = typeof message.content === "string" ? message.content.trim() : "";

      if (!content) {
        return null;
      }

      return {
        id: message.id || `msg-${index + 1}`,
        role: message.role,
        content,
        createdAt: message.createdAt || new Date().toISOString(),
      };
    })
    .filter((message): message is OutlineChatMessage => Boolean(message));
}

export function createEmptyOutlineSession(): StoredOutlineSession {
  return {
    messages: [],
    outlineMarkdown: "",
    profile: createEmptyOutlineProfile(),
    readiness: "collecting",
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeOutlineSession(
  value?: Partial<StoredOutlineSession> | null,
): StoredOutlineSession {
  return {
    messages: normalizeOutlineMessages(value?.messages),
    outlineMarkdown:
      typeof value?.outlineMarkdown === "string" ? value.outlineMarkdown : "",
    profile: normalizeOutlineProfile(value?.profile),
    readiness:
      value?.readiness === "drafting" || value?.readiness === "ready"
        ? value.readiness
        : "collecting",
    updatedAt: value?.updatedAt || new Date().toISOString(),
  };
}

export function getOutlineReadinessLabel(value: OutlineReadiness) {
  if (value === "ready") {
    return "可进入上传";
  }

  if (value === "drafting") {
    return "提纲成形中";
  }

  return "继续采集信息";
}
