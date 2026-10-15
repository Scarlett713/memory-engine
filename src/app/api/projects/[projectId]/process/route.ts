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
  } catch {
    // 不回显内部 error.message：转写 / LLM / 写盘异常原话含配置名与实现细节。
    // 已知：可读的 provider 文案（如「讯飞转写任务失败（failType=…）。」）本层会被覆盖，
    // 该串仍留在流程内的 lastProcessingError（process-project.ts:216，本批不动）—— §6-Q1 / Q2。
    return NextResponse.json(
      { message: "处理失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
