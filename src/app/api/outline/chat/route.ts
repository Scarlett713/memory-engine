import { NextResponse } from "next/server";

import { interviewScenarioOptions } from "@/lib/oral-history";
import {
  normalizeOutlineMessages,
  normalizeOutlinePlanningContext,
} from "@/lib/outline-session";
import { getLlmProvider } from "@/lib/providers/llm";
import type { OutlineChatMessage } from "@/lib/types/outline";
import type { InterviewScenario } from "@/lib/types/project";

const FIELD_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 1000;
const MESSAGE_MAX_LENGTH = 1000;
const MESSAGE_HISTORY_LIMIT = 10;

type OutlineChatRequest = {
  messages?: Array<Partial<OutlineChatMessage>>;
  currentOutline?: string;
  subject?: string;
  topic?: string;
  institution?: string;
  researchFocus?: string;
  collectionScenario?: string;
  events?: string[];
  timePoints?: string[];
  ethicsNotes?: string;
};

function normalizeText(value: unknown, max = FIELD_MAX_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// 多轮细化：前端传完整 messages（方案 B），带上当前草稿与画像一起喂给
// generateInterviewOutline —— 它与 /generate 共用同一个 provider 入口，
// 区别只在于这里 messages 非空、currentOutline 非空。
export async function POST(request: Request) {
  try {
    // 鉴权由 src/proxy.ts 完成：它校验 cookie 并注入 x-user-id。
    // 注意 proxy 对未登录请求是 302 跳 /login，所以这一支在网上通常走不到，
    // 保留作纵深防御（/generate 同样如此）。
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    let payload: OutlineChatRequest;

    try {
      payload = (await request.json()) as OutlineChatRequest;
    } catch {
      return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
    }

    const subject = normalizeText(payload.subject);
    const topic = normalizeText(payload.topic);

    if (!subject) {
      return NextResponse.json({ error: "请填写受访对象。" }, { status: 400 });
    }

    if (!topic) {
      return NextResponse.json({ error: "请填写访谈主题。" }, { status: 400 });
    }

    // 校验用 trim 判定「有没有」，但传给 provider 的是原串 —— 别把用户的 markdown 改坏。
    const currentOutline =
      typeof payload.currentOutline === "string" ? payload.currentOutline : "";

    if (!currentOutline.trim()) {
      return NextResponse.json(
        { error: "请先生成或粘贴提纲。" },
        { status: 400 },
      );
    }

    // normalizeOutlineMessages 已经做了 role 白名单 / trim / 丢空条目。
    const messages = normalizeOutlineMessages(payload.messages)
      .map((message) => ({
        ...message,
        content: message.content.slice(0, MESSAGE_MAX_LENGTH),
      }))
      .slice(-MESSAGE_HISTORY_LIMIT);

    // 本轮必须有话说；最后一条不是 user 说明前端漏带了本轮输入。
    if (messages[messages.length - 1]?.role !== "user") {
      return NextResponse.json({ error: "请填写修改说明。" }, { status: 400 });
    }

    const collectionScenario = interviewScenarioOptions.some(
      (option) => option.value === payload.collectionScenario,
    )
      ? (payload.collectionScenario as InterviewScenario)
      : "urban_memory";

    const result = await getLlmProvider().generateInterviewOutline({
      messages,
      profile: {
        projectName: topic,
        intervieweeName: subject,
        institutionName: normalizeText(payload.institution),
        collectionScenario,
        researchFocus: normalizeText(payload.researchFocus),
        notes: normalizeText(payload.ethicsNotes, NOTES_MAX_LENGTH),
      },
      currentOutline,
      planningContext: normalizeOutlinePlanningContext({
        events: payload.events,
        timePoints: payload.timePoints,
      }),
    });

    const markdown = result.outlineMarkdown?.trim() ?? "";

    // degraded 那一支不抛异常，只看 markdown 非空会把它当成功。
    if (result.degraded || !markdown) {
      return NextResponse.json(
        { error: "提纲修改失败，请稍后重试。" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      markdown,
      assistantMessage:
        result.assistantMessage?.trim() || "已按你的要求更新提纲。",
    });
  } catch {
    // 不回显 error.message：ark 的 HTTP 错误串里带着接口地址。
    return NextResponse.json(
      { error: "提纲修改失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
