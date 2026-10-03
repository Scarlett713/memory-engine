import type {
  OutlineChatMessage,
  OutlinePlanningContext,
  OutlineProjectProfile,
  OutlineReadiness,
  StoredOutlineSession,
} from "@/lib/types/outline";

export const OUTLINE_SESSION_STORAGE_KEY = "memory-engine-outline-session";

// 上传页靠这个 query 标记决定要不要读 sessionStorage 里的提纲草稿。
// 用标记位而不是把全文塞进 URL：提纲常有 2-4KB，含中文与换行。
export const OUTLINE_FLAG_PARAM = "outline";

const PLANNING_LIST_ITEM_MAX_LENGTH = 200;
const PLANNING_LIST_MAX_ITEMS = 20;

export function normalizePlanningList(value: unknown, max = PLANNING_LIST_MAX_ITEMS): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, PLANNING_LIST_ITEM_MAX_LENGTH))
    .filter(Boolean)
    .slice(0, max);
}

export function normalizeOutlinePlanningContext(
  value?: Partial<OutlinePlanningContext> | null,
): OutlinePlanningContext {
  return {
    events: normalizePlanningList(value?.events),
    timePoints: normalizePlanningList(value?.timePoints),
  };
}

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

// —— 提纲草稿跨页传递（/projects/new/outline → /upload?outline=1）——
// 读写都吞掉异常：Safari 隐私模式 setItem 会抛，配额也可能满；
// 任何一种都不能挡住页面跳转，最差退化成「上传页提纲框是空的」。

export function saveOutlineDraftToSession(
  markdown: string,
  profile?: Partial<OutlineProjectProfile> | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const session: StoredOutlineSession = {
      ...createEmptyOutlineSession(),
      outlineMarkdown: markdown,
      profile: normalizeOutlineProfile(profile),
      readiness: markdown.trim() ? "drafting" : "collecting",
      updatedAt: new Date().toISOString(),
    };

    window.sessionStorage.setItem(
      OUTLINE_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  } catch {
    // 写不进去就写不进去，跳转照常。
  }
}

export function readOutlineDraftFromSession(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const raw = window.sessionStorage.getItem(OUTLINE_SESSION_STORAGE_KEY);

    if (!raw) {
      return "";
    }

    return normalizeOutlineSession(
      JSON.parse(raw) as Partial<StoredOutlineSession>,
    ).outlineMarkdown;
  } catch {
    return "";
  }
}

export function clearOutlineDraftFromSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(OUTLINE_SESSION_STORAGE_KEY);
  } catch {
    // 清理失败不影响主流程。
  }
}
