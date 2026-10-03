import { NextResponse } from "next/server";

import {
  buildInterviewQuestionPrompt,
  INTERVIEW_QUESTION_TIMEOUT_MS,
  normalizeChecklist,
  normalizeFollowUpCount,
  parseInterviewQuestionOutput,
  type InterviewOutlineItem,
} from "@/lib/interview-prompt";
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

// 与 interview-console.tsx 的 extractOutlineItems 同形的粗解析（那份文件自己注明
// 只是占位，真实解析器留给 PRD §3 模块 7 的 interview-outline-checklist.tsx）。
const OUTLINE_ITEM_PREFIX = /^\s*(?:#{1,6}|[-*+]|\d+[.、)])\s*/;

/**
 * 提纲 markdown → checklist。
 *
 * id 由下标派生（c-0 / c-1 …）：提纲 markdown 在访谈期间不会变，所以每次请求重新
 * 解析得到的 id 是稳定的。id 对前端完全不透明——前端只把上一轮回包的 id 原样带回。
 */
function parseOutlineChecklist(markdown: string): InterviewOutlineItem[] {
  return markdown
    .split("\n")
    .map((line) => line.replace(OUTLINE_ITEM_PREFIX, "").trim())
    .filter((line) => line.length > 0)
    .map((text, index) => ({ id: `c-${index}`, text }));
}

/**
 * PRD §4.5 / §12：服务端 15s 超时。
 *
 * provider 接口是 askQuestion(prompt) 单参契约，没有 timeout 选项也没有 AbortSignal，
 * 所以只能用 Promise.race 兜；race 输掉的那个 promise 不会因此取消，属已知取舍
 * （ark 那条 fetch 会自己跑完，只是结果被丢弃）。
 */
async function askWithTimeout(prompt: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("INTERVIEW_QUESTION_TIMEOUT")),
      INTERVIEW_QUESTION_TIMEOUT_MS,
    );
  });

  try {
    const result = await Promise.race([
      getLlmProvider().askQuestion(prompt),
      timeout,
    ]);

    return result.answer ?? "";
  } finally {
    // 竞速赢了也要清：挂着的 timer 会拖住实例退出。
    if (timer) {
      clearTimeout(timer);
    }
  }
}

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

    let body: {
      questionIndex?: unknown;
      followUpCount?: unknown;
      coveredItemIds?: unknown;
      lastAnswer?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "请求参数不正确。" },
        { status: 400 },
      );
    }

    // 空 body 或字面量 null 也能过 request.json()，取字段前先挡一道。
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "请求参数不正确。" },
        { status: 400 },
      );
    }

    // questionIndex 目前不参与提问决策（prompt 模板没有题号槽位，下一问由
    // coveredItemIds + recentTranscript 决定），但仍校验类型，避免前端传错
    // 却一路静默通过。
    if (
      typeof body.questionIndex !== "number" ||
      !Number.isFinite(body.questionIndex)
    ) {
      return NextResponse.json(
        { message: "请求参数不正确。" },
        { status: 400 },
      );
    }

    if (
      body.followUpCount !== undefined &&
      typeof body.followUpCount !== "number"
    ) {
      return NextResponse.json(
        { message: "请求参数不正确。" },
        { status: 400 },
      );
    }

    const followUpCount = normalizeFollowUpCount(body.followUpCount);
    const lastAnswer =
      typeof body.lastAnswer === "string" ? body.lastAnswer.trim() : "";

    // normalizeChecklist 会丢弃空条目并截到 CHECKLIST_MAX_ITEMS(40)；
    // 同一份结果既喂 prompt 也当 coveredItemIds 的白名单，避免两处口径漂移。
    const checklist = normalizeChecklist(
      parseOutlineChecklist(project.outlineDraftMarkdown),
    );
    const checklistIds = checklist.map((item) => item.id);

    const prompt = buildInterviewQuestionPrompt({
      projectName: project.projectName,
      intervieweeName: project.intervieweeName,
      scenario: project.collectionScenario,
      customScenarioLabel: project.customScenarioLabel,
      researchFocus: project.researchFocus,
      language: project.language,
      checklist,
      outlineMarkdown: project.outlineDraftMarkdown,
      // 不在这里过 normalizeCoveredItemIds：它按 MAX_COVERED_ITEM_IDS(3) 截断，
      // 那是给「模型单轮回包」用的上限，套在累积态上会砍掉历史覆盖。
      coveredItemIds: Array.isArray(body.coveredItemIds)
        ? body.coveredItemIds
        : [],
      recentTranscript: lastAnswer,
      followUpCount,
    });

    let raw = "";

    try {
      raw = await askWithTimeout(prompt);
    } catch {
      // 不回显 error.message：ark 的 HTTP 错误串里带着接口地址。
      return NextResponse.json(
        { error: "AI 响应超时，请重试" },
        { status: 502 },
      );
    }

    // 传 followUpCount 是必须的：达到 MAX_FOLLOW_UP_COUNT(2) 时这里会硬强制
    // isFollowUp = false，即「同一题最多追问 2 次」的落点。
    const parsed = parseInterviewQuestionOutput(raw, {
      followUpCount,
      checklistIds,
    });

    if (!parsed) {
      return NextResponse.json(
        { error: "AI 响应超时，请重试" },
        { status: 502 },
      );
    }

    if (parsed.isComplete) {
      return NextResponse.json({ done: true, question: parsed.question });
    }

    return NextResponse.json({
      done: false,
      question: parsed.question,
      isFollowUp: parsed.isFollowUp,
      coveredItemIds: parsed.coveredItemIds,
    });
  } catch {
    return NextResponse.json(
      { message: "生成下一问失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
