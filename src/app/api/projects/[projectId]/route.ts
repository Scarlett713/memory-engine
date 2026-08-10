import { NextResponse } from "next/server";

import { deleteProject, getProjectById } from "@/lib/server/project-store";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const project = await getProjectById(projectId);

  if (!project) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  return NextResponse.json({
    project,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const deleted = await deleteProject(projectId);

  if (!deleted) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
