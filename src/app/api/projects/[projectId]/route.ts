import { NextRequest, NextResponse } from "next/server";
import {
  deleteProject,
  getProjectById,
  isProjectOwnedBy,
  updateProject,
} from "@/lib/server/project-store";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

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

  return NextResponse.json({
    project,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
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

  const deleted = await deleteProject(projectId);

  if (!deleted) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;

  try {
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

    const body = await request.json() as Partial<import("@/lib/types/project").ProjectRecord>;
    const { userId: _ownerId, ...safeBody } = body;
    const updated = await updateProject(projectId, safeBody);

    if (!updated) {
      return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
    }

    return NextResponse.json({ project: updated });
  } catch {
    return NextResponse.json({ message: "更新失败，请稍后重试。" }, { status: 500 });
  }
}
