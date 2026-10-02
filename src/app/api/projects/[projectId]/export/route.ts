import { NextResponse } from "next/server";

import {
  createProjectExport,
  type ProjectExportFormat,
} from "@/lib/server/project-export";
import {
  getProjectById,
  isProjectOwnedBy,
  updateProject,
} from "@/lib/server/project-store";
import { countPendingSensitiveMarks } from "@/lib/types/project";
import type { WorkflowStep, WorkflowStepKey, WorkflowStatus } from "@/lib/types/project";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

function updateWorkflow(
  workflow: WorkflowStep[],
  patches: Partial<Record<WorkflowStepKey, WorkflowStatus>>,
) {
  return workflow.map((step) => ({
    ...step,
    status: patches[step.key] ?? step.status,
  }));
}

function parseFormat(value: string | null): ProjectExportFormat {
  if (value === "txt" || value === "json") {
    return value;
  }

  return "docx";
}

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ message: "未登录。" }, { status: 401 });
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  if (!isProjectOwnedBy(project, userId)) {
    return NextResponse.json(
      { message: "无权访问该项目。" },
      { status: 403 },
    );
  }

  if (!project.aiDraft && !project.redactedAiDraft) {
    return NextResponse.json(
      { message: "项目尚未生成可导出的整理结果。" },
      { status: 400 },
    );
  }

  // 审校门禁：还有待处理标记时不导出，也不把状态推成 ready_to_export。
  // PATCH 路由有同一判定（共用 countPendingSensitiveMarks），否则点导出就能绕过审校。
  const pendingCount = countPendingSensitiveMarks(project.sensitiveMarks);

  if (pendingCount > 0) {
    return NextResponse.json(
      {
        message: `还有 ${pendingCount} 条敏感标记待处理，无法导出。`,
        pendingCount,
      },
      { status: 400 },
    );
  }

  const format = parseFormat(new URL(request.url).searchParams.get("format"));
  const exported = await createProjectExport(project, format);

  await updateProject(projectId, (current) => ({
    status: "ready_to_export",
    workflow: updateWorkflow(current.workflow, {
      manual_review: "completed",
      export: "completed",
    }),
  }));

  return new NextResponse(exported.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`,
      "Content-Type": exported.contentType,
    },
  });
}
