import { NextResponse } from "next/server";

import { processProject } from "@/lib/server/process-project";
import {
  getProjectById,
  isProjectOwnedBy,
} from "@/lib/server/project-store";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
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

    const processed = await processProject(projectId);

    return NextResponse.json({
      project: processed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "处理失败，请稍后重试。";

    return NextResponse.json({ message }, { status: 500 });
  }
}
