import { NextResponse } from "next/server";

import { processProject } from "@/lib/server/process-project";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const project = await processProject(projectId);

    return NextResponse.json({
      project,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "处理失败，请稍后重试。";

    return NextResponse.json({ message }, { status: 500 });
  }
}
