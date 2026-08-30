import { NextResponse } from "next/server";

import { getLlmProvider } from "@/lib/providers/llm";
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

    const body = (await request.json()) as { question?: unknown };
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { message: "请输入要咨询的问题。" },
        { status: 400 },
      );
    }

    const draft =
      project.redactedAiDraft || project.aiDraft || project.transcriptRaw;

    if (!draft) {
      return NextResponse.json(
        { message: "项目尚未生成可咨询的整理内容。" },
        { status: 400 },
      );
    }

    const prompt = [
      "以下是一段口述史访谈的整理稿。请基于内容回答用户的问题。",
      "如果内容中没有相关信息，请如实告知。",
      "",
      `【摘要】${project.summary || "（无）"}`,
      `【关键词】${project.keywords.join(", ") || "（无）"}`,
      `【整理稿】${draft}`,
      "",
      `用户问题：${question}`,
    ].join("\n");

    const result = await getLlmProvider().askQuestion(prompt);

    return NextResponse.json({
      answer: result.answer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "问答失败，请稍后重试。";

    return NextResponse.json({ message }, { status: 500 });
  }
}
