import { NextResponse } from "next/server";

import { interviewScenarioOptions } from "@/lib/oral-history";
import { normalizeOutlinePlanningContext } from "@/lib/outline-session";
import { getLlmProvider } from "@/lib/providers/llm";
import type { InterviewScenario } from "@/lib/types/project";

const FIELD_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 1000;

type OutlineGenerateRequest = {
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

// 单次生成（非对话）：复用 generateInterviewOutline，把画像与规划上下文一次性喂进去。
// 失败的统一出口是 500 { error }（本 route 按 REQ-13 的信封走；其他 route 仍是 { message }）。
export async function POST(request: Request) {
  try {
    // 鉴权由 src/proxy.ts 完成：它校验 cookie 并注入 x-user-id。
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    let payload: OutlineGenerateRequest;

    try {
      payload = (await request.json()) as OutlineGenerateRequest;
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

    const collectionScenario = interviewScenarioOptions.some(
      (option) => option.value === payload.collectionScenario,
    )
      ? (payload.collectionScenario as InterviewScenario)
      : "urban_memory";

    const result = await getLlmProvider().generateInterviewOutline({
      messages: [],
      profile: {
        projectName: topic,
        intervieweeName: subject,
        institutionName: normalizeText(payload.institution),
        collectionScenario,
        researchFocus: normalizeText(payload.researchFocus),
        notes: normalizeText(payload.ethicsNotes, NOTES_MAX_LENGTH),
      },
      currentOutline: "",
      planningContext: normalizeOutlinePlanningContext({
        events: payload.events,
        timePoints: payload.timePoints,
      }),
    });

    const markdown = result.outlineMarkdown?.trim() ?? "";

    // degraded 表示 provider 没能解析模型输出、退回了中性兜底 —— 那一支不抛异常，
    // 只看 markdown 非空会把它当成功，前端就会展示两行残骸而不是模板。
    if (result.degraded || !markdown) {
      return NextResponse.json(
        { error: "生成提纲失败，请稍后重试。" },
        { status: 500 },
      );
    }

    return NextResponse.json({ markdown });
  } catch {
    // 不回显 error.message：ark 的 HTTP 错误串里带着接口地址。
    return NextResponse.json(
      { error: "生成提纲失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
