import { NextResponse } from "next/server";

import {
  ALLOWED_COLLECTION_SCENARIOS,
  ALLOWED_CONFIDENTIALITY_LEVELS,
  ALLOWED_PRIVACY_LEVELS,
  parseEnumValue,
} from "@/lib/server/enum";
import { createProject, updateProject } from "@/lib/server/project-store";
import type {
  ProjectRecord,
  RedactionRule,
  UserType,
  WorkflowStep,
} from "@/lib/types/project";

// 与 api/projects/route.ts 的默认规则保持一致（route 文件之间不能互相 import）。
const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  "phone",
  "id_card",
  "address",
  "contact_account",
];

const ALLOWED_REDACTION_RULES: readonly string[] = [
  "name",
  "phone",
  "id_card",
  "address",
  "organization",
  "contact_account",
];

type AiInterviewRequest = {
  projectName?: unknown;
  intervieweeName?: unknown;
  institutionName?: unknown;
  customScenarioLabel?: unknown;
  notes?: unknown;
  outlineDraftMarkdown?: unknown;
  collectionScenario?: unknown;
  researchFocus?: unknown;
  privacyLevel?: unknown;
  confidentialityLevel?: unknown;
  customRedactionRules?: unknown;
  language?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// parseEnumValue 收的是 FormDataEntryValue；JSON 侧只把字符串放行，其余当缺失。
function toEnumInput(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseRedactionRules(value: unknown): RedactionRule[] {
  if (!Array.isArray(value)) {
    return DEFAULT_REDACTION_RULES;
  }

  const rules = value.filter(
    (item): item is RedactionRule =>
      typeof item === "string" && ALLOWED_REDACTION_RULES.includes(item),
  );

  return rules.length ? rules : DEFAULT_REDACTION_RULES;
}

// createProject 无条件把 upload 步写成 completed；此刻还没有音频，
// 落 in_progress 并在描述里说清「录音在访谈结束后才归档」才诚实。
function markUploadInProgress(workflow: WorkflowStep[]) {
  return workflow.map((step) =>
    step.key === "upload"
      ? {
          ...step,
          description: "访谈进行中，结束后将自动上传录音并启动归档。",
          status: "in_progress" as const,
        }
      : step,
  );
}

// D7=B：AI 访谈入口在提纲工作台。建项目时音频字段一律置空，
// 等访谈结束由 `.../interview/audio` 回填。错误信封沿用 { message }（与 /api/projects 一致）。
export async function POST(request: Request) {
  try {
    // 鉴权由 src/proxy.ts 完成：它校验 cookie 并注入 x-user-id。
    const userId = request.headers.get("x-user-id");
    const userType: UserType =
      request.headers.get("x-user-type") === "org" ? "institution" : "personal";

    if (!userId) {
      return NextResponse.json({ message: "未登录。" }, { status: 401 });
    }

    let payload: AiInterviewRequest;

    try {
      payload = (await request.json()) as AiInterviewRequest;
    } catch {
      return NextResponse.json(
        { message: "请求格式不正确。" },
        { status: 400 },
      );
    }

    const projectName = normalizeText(payload.projectName);
    const intervieweeName = normalizeText(payload.intervieweeName);
    // D5=B：AI 访谈强制带提纲，只 trim 判空，正文原样落库。
    const outlineDraftMarkdown =
      typeof payload.outlineDraftMarkdown === "string"
        ? payload.outlineDraftMarkdown
        : "";
    const customScenarioLabel = normalizeText(payload.customScenarioLabel);
    const collectionScenario = parseEnumValue(
      toEnumInput(payload.collectionScenario),
      ALLOWED_COLLECTION_SCENARIOS,
      "urban_memory",
    );

    if (!projectName) {
      return NextResponse.json(
        { message: "请填写口述项目名称。" },
        { status: 400 },
      );
    }

    if (!intervieweeName) {
      return NextResponse.json(
        { message: "请填写受访对象姓名或称谓。" },
        { status: 400 },
      );
    }

    if (!outlineDraftMarkdown.trim()) {
      return NextResponse.json({ message: "请提供访谈提纲。" }, { status: 400 });
    }

    if (collectionScenario === "custom" && !customScenarioLabel) {
      return NextResponse.json(
        { message: "请选择“自定义主题”后填写具体口述场景。" },
        { status: 400 },
      );
    }

    const created = await createProject({
      projectName,
      institutionName: normalizeText(payload.institutionName),
      intervieweeName,
      customScenarioLabel,
      notes: normalizeText(payload.notes),
      outlineDraftMarkdown,
      audioFileName: "",
      audioStoragePath: "",
      audioSourceUrl: "",
      // 占位 mime：访谈结束产出真实 WAV 后，由 .../interview/audio 覆写为 audio/wav。
      audioMimeType: "application/octet-stream",
      audioSize: 0,
      collectionScenario,
      researchFocus: normalizeText(payload.researchFocus),
      privacyLevel: parseEnumValue(
        toEnumInput(payload.privacyLevel),
        ALLOWED_PRIVACY_LEVELS,
        "standard",
      ),
      confidentialityLevel: parseEnumValue(
        toEnumInput(payload.confidentialityLevel),
        ALLOWED_CONFIDENTIALITY_LEVELS,
        "internal",
      ),
      collectionPath: "ai_interview",
      language: normalizeText(payload.language) || "cn",
      customRedactionRules: parseRedactionRules(payload.customRedactionRules),
      userId,
      userType,
    });

    // 二次写入只改 workflow；store 是冻结约束，不动 createProject 的硬编码 status。
    const project: ProjectRecord =
      (await updateProject(created.id, (current) => ({
        workflow: markUploadInProgress(current.workflow),
      }))) ?? created;

    return NextResponse.json({ project }, { status: 201 });
  } catch {
    // 不回显内部 error.message，避免泄漏路径与堆栈。
    return NextResponse.json(
      { message: "创建项目失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
