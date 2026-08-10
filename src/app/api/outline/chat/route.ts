import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import {
  normalizeOutlineMessages,
  normalizeOutlineProfile,
} from "@/lib/outline-session";
import { getLlmProvider } from "@/lib/providers/llm";
import type { OutlineChatMessage, StoredOutlineSession } from "@/lib/types/outline";

type OutlineChatRequest = {
  messages?: Array<Partial<OutlineChatMessage>>;
  profile?: Partial<StoredOutlineSession["profile"]>;
  currentOutline?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as OutlineChatRequest;
    const messages = normalizeOutlineMessages(payload.messages);
    const profile = normalizeOutlineProfile(payload.profile);
    const currentOutline =
      typeof payload.currentOutline === "string" ? payload.currentOutline : "";

    const latestUserMessage = [...messages].reverse().find(
      (message) => message.role === "user",
    );

    if (!latestUserMessage) {
      return NextResponse.json(
        { message: "请先输入访谈背景或你的需求。" },
        { status: 400 },
      );
    }

    const llmProvider = getLlmProvider();
    const result = await llmProvider.generateInterviewOutline({
      messages,
      profile,
      currentOutline,
    });

    return NextResponse.json({
      assistantMessage: {
        id: nanoid(8),
        role: "assistant",
        content: result.assistantMessage,
        createdAt: new Date().toISOString(),
      },
      outlineMarkdown: result.outlineMarkdown,
      profile: result.profile,
      readiness: result.readiness,
      checkpoints: result.checkpoints,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "提纲生成失败，请稍后重试。";

    return NextResponse.json({ message }, { status: 500 });
  }
}
