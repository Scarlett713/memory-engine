import { NextResponse } from "next/server";

import {
  createProjectExport,
  type ProjectExportFormat,
} from "@/lib/server/project-export";
import { getProjectById, updateProject } from "@/lib/server/project-store";
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
  const project = await getProjectById(projectId);

  if (!project) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  if (!project.aiDraft && !project.redactedAiDraft) {
    return NextResponse.json(
      { message: "项目尚未生成可导出的整理结果。" },
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
