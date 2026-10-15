import { NextResponse } from "next/server";

import {
  ALLOWED_COLLECTION_PATHS,
  ALLOWED_COLLECTION_SCENARIOS,
  ALLOWED_CONFIDENTIALITY_LEVELS,
  ALLOWED_PRIVACY_LEVELS,
  parseEnumValue,
} from "@/lib/server/enum";
import {
  createProject,
  isProjectOwnedBy,
  listProjects,
} from "@/lib/server/project-store";
import {
  saveInterviewAudio,
  type SavedInterviewAudio,
} from "@/lib/server/upload-store";
import type { RedactionRule, UserType } from "@/lib/types/project";

// 与 /api/outline/generate、/api/projects/ai-interview 保持同口径的 notes 上限。
// route 文件之间不互相 import，各自本地定义；不要新建共享模块。
const NOTES_MAX_LENGTH = 1000;

function parseCustomRedactionRules(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return ["phone", "id_card", "address", "contact_account"] as RedactionRule[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return ["phone", "id_card", "address", "contact_account"] as RedactionRule[];
    }

    return parsed.filter(
      (item): item is RedactionRule =>
        typeof item === "string" &&
        [
          "name",
          "phone",
          "id_card",
          "address",
          "organization",
          "contact_account",
        ].includes(item),
    );
  } catch {
    return ["phone", "id_card", "address", "contact_account"] as RedactionRule[];
  }
}

export async function GET(request: Request) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ message: "未登录。" }, { status: 401 });
  }

  const projects = (await listProjects()).filter((project) =>
    isProjectOwnedBy(project, userId),
  );

  return NextResponse.json({
    projects,
  });
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userType: UserType =
      request.headers.get("x-user-type") === "org" ? "institution" : "personal";

    if (!userId) {
      return NextResponse.json({ message: "未登录。" }, { status: 401 });
    }

    let formData: FormData;

    // BUG-11：proxy 克隆请求体的上限（next.config.ts 的 proxyClientMaxBodySize）被击穿时
    // 请求体会被截断，formData() 抛 undici 的 "Failed to parse body as FormData."。
    // 不接住这一层，下面 catch 的兜底会把那句英文原文当 message 回给用户。
    // 与 [projectId]/interview/audio/route.ts 同形：只回人话，不回显内部错误。
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { message: "请求格式不正确。" },
        { status: 400 },
      );
    }

    const audio = formData.get("audio");
    const projectName = formData.get("projectName")?.toString().trim() ?? "";
    const intervieweeName =
      formData.get("intervieweeName")?.toString().trim() ?? "";
    const institutionName =
      formData.get("institutionName")?.toString().trim() ?? "";
    const customScenarioLabel =
      formData.get("customScenarioLabel")?.toString().trim() ?? "";
    const notes =
      formData.get("notes")?.toString().trim().slice(0, NOTES_MAX_LENGTH) ??
      "";
    const outlineDraftMarkdown =
      formData.get("outlineDraftMarkdown")?.toString() ?? "";
    const collectionScenario = parseEnumValue(
      formData.get("collectionScenario"),
      ALLOWED_COLLECTION_SCENARIOS,
      "urban_memory",
    );
    const researchFocus =
      formData.get("researchFocus")?.toString().trim() ?? "";
    const privacyLevel = parseEnumValue(
      formData.get("privacyLevel"),
      ALLOWED_PRIVACY_LEVELS,
      "standard",
    );
    const language = formData.get("language")?.toString().trim() ?? "";
    const confidentialityLevel = parseEnumValue(
      formData.get("confidentialityLevel"),
      ALLOWED_CONFIDENTIALITY_LEVELS,
      "internal",
    );
    const collectionPath = parseEnumValue(
      formData.get("collectionPath"),
      ALLOWED_COLLECTION_PATHS,
      "upload",
    );
    const customRedactionRules = parseCustomRedactionRules(
      formData.get("customRedactionRules"),
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

    if (collectionScenario === "custom" && !customScenarioLabel) {
      return NextResponse.json(
        { message: "请选择“自定义主题”后填写具体口述场景。" },
        { status: 400 },
      );
    }
    if (!(audio instanceof File)) {
      return NextResponse.json(
        { message: "请上传受访音频文件。" },
        { status: 400 },
      );
    }

    let savedAudio: SavedInterviewAudio;

    try {
      savedAudio = await saveInterviewAudio(audio);
    } catch (error) {
      // 这里的 throw 全是入参校验（空文件 / 超 100MB / 非音频格式）：原话直出回 400，
      // 与 audio 路由 :86-101 同形同码。已知取舍同其注释：writeFile 失败也会落到这里
      // （区分它须改 upload-store.ts，而那是 BUG-11 铁律不动的文件）。
      return NextResponse.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "音频文件校验未通过，请重新选择。",
        },
        { status: 400 },
      );
    }

    const project = await createProject({
      audioFileName: savedAudio.fileName,
      audioMimeType: savedAudio.mimeType,
      audioSize: savedAudio.size,
      audioSourceUrl: "",
      audioStoragePath: savedAudio.relativePath,
      institutionName,
      intervieweeName,
      customScenarioLabel,
      notes,
      outlineDraftMarkdown,
      projectName,
      collectionScenario,
      researchFocus,
      privacyLevel,
      confidentialityLevel,
      collectionPath,
      language: language || "cn",
      customRedactionRules,
      userId,
      userType,
    });

    return NextResponse.json(
      {
        project,
      },
      { status: 201 },
    );
  } catch {
    // 不回显内部 error.message：写盘 / 存储层异常串可能含绝对路径与系统错误码
    // （EACCES / ENOSPC 等）。形状对齐 [projectId]/interview/audio/route.ts:122-127。
    return NextResponse.json(
      { message: "上传失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
