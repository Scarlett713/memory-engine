import {
  collectionPathOptions,
  confidentialityLevelOptions,
  interviewScenarioOptions,
  privacyLevelOptions,
} from "@/lib/oral-history";
import type {
  CollectionPath,
  ConfidentialityLevel,
  InterviewScenario,
  PrivacyLevel,
} from "@/lib/types/project";

// FormData / JSON 里的枚举值一律白名单校验，非法值退回 fallback（与 parseCustomRedactionRules 同一防御风格）。
// 原为 `src/app/api/projects/route.ts` 的私有实现，迁到此处供各 route 共用（route 文件之间不能互相 import）。
export function parseEnumValue<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = typeof value === "string" ? value.trim() : "";

  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

// 允许值统一从 `oral-history.ts` 的 *Options 派生，避免出现第二份真值来源（PRD §4.1）。
export const ALLOWED_COLLECTION_SCENARIOS: readonly InterviewScenario[] =
  interviewScenarioOptions.map((option) => option.value);

export const ALLOWED_PRIVACY_LEVELS: readonly PrivacyLevel[] =
  privacyLevelOptions.map((option) => option.value);

export const ALLOWED_CONFIDENTIALITY_LEVELS: readonly ConfidentialityLevel[] =
  confidentialityLevelOptions.map((option) => option.value);

export const ALLOWED_COLLECTION_PATHS: readonly CollectionPath[] =
  collectionPathOptions.map((option) => option.value);

// REQ-14 预留：AI 访谈模式。当前无取值，`types/project.ts` 亦无 InterviewMode
// （数据层为冻结约束），先用 string 占位，定稿后再收紧为联合类型。
export const ALLOWED_INTERVIEW_MODES: readonly string[] = [];
