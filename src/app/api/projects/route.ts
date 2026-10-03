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
import { saveInterviewAudio } from "@/lib/server/upload-store";
import type { RedactionRule, UserType } from "@/lib/types/project";

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

    const formData = await request.formData();

    const audio = formData.get("audio");
    const projectName = formData.get("projectName")?.toString().trim() ?? "";
    const intervieweeName =
      formData.get("intervieweeName")?.toString().trim() ?? "";
    const institutionName =
      formData.get("institutionName")?.toString().trim() ?? "";
    const customScenarioLabel =
      formData.get("customScenarioLabel")?.toString().trim() ?? "";
    const notes = formData.get("notes")?.toString().trim() ?? "";
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

    const savedAudio = await saveInterviewAudio(audio);
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传失败，请稍后重试。";

    return NextResponse.json({ message }, { status: 500 });
  }
}
