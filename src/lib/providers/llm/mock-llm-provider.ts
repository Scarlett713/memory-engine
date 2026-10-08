import { getInterviewScenarioLabel } from "@/lib/oral-history";
import {
  normalizeOutlinePlanningContext,
  normalizeOutlineProfile,
} from "@/lib/outline-session";
import type {
  LlmAskResult,
  LlmOutlineChatInput,
  LlmProvider,
  LlmRefineInput,
  LlmRefineResult,
} from "@/lib/providers/llm/types";
import type {
  OutlineChatResult,
  OutlinePlanningContext,
} from "@/lib/types/outline";

// 把「重大事件 / 时间节点」摊成编号问题。
// UI-27 之后提纲是四段式的平铺编号问题列表：事件不再单开 ## 分节，
// 而是各自占专属问题（覆盖要求不变，见 Prompt 规则 10）。
// 没有规划上下文时返回空数组，保证不带事件的输出与加这个功能之前一致。
function buildPlanningQuestions(
  planningContext?: OutlinePlanningContext,
): string[] {
  const { events, timePoints } = normalizeOutlinePlanningContext(planningContext);
  const questions: string[] = [];

  for (const event of events) {
    questions.push(
      `请围绕“${event}”还原当时的时间、地点、在场人物与您的处境。`,
      `“${event}”发生之后，您的生活、家庭或工作发生了哪些变化？`,
    );
  }

  for (const timePoint of timePoints) {
    questions.push(`${timePoint}前后，您的主要经历、人物关系与情绪状态是怎样的？`);
  }

  return questions;
}

// UI-27：四段式提纲 —— 标题 / 引言段 / 编号问题列表（字面「1、」）/ 落款。
// 与 08_访谈提纲与成文稿格式要求 表1 对齐：不再出现 ## 章节、### 子节与 - 条目。
function buildOutlineMarkdown(input: LlmOutlineChatInput) {
  const profile = normalizeOutlineProfile(input.profile);
  const scenarioLabel = getInterviewScenarioLabel(profile.collectionScenario);
  const focus = profile.researchFocus || "待进一步明确研究焦点";
  const subject = profile.intervieweeName || profile.projectName || "受访者";
  const institution = profile.institutionName || "待补充整理机构";

  const questions = [
    `请您先介绍一下自己与这次口述主题“${focus}”之间最直接的关联。`,
    "您最先想到的时间、地点和人物是谁？",
    "当时发生了什么？您当时的生活状态是怎样的？",
    "哪些场景、物件、声音或人物最能代表那段经历？",
    "在关键转折前后，您的家庭、工作或周边环境有什么变化？",
    ...buildPlanningQuestions(input.planningContext),
    "回看这段经历，您觉得最难忘或最想保留的感受是什么？",
    "面向未来，您对这段历史或这件事还有什么建议？",
    "还有哪些内容您觉得需要补充？",
  ];

  return [
    `# ${subject}访谈提纲`,
    "",
    `非常感谢您接受我们的访谈。本次访谈围绕“${focus}”展开，用于${scenarioLabel}的资料整理。访谈过程中如有任何不适，请随时告知，我们可以随时暂停或跳过任何问题；访谈内容仅用于本项目资料整理，涉及姓名、住址等个人信息时会做匿名处理。`,
    "",
    ...questions.map((question, index) => `${index + 1}、${question}`),
    "",
    institution,
    "日期待补",
  ].join("\n");
}

// 13P1-F 的人为失败开关：mock 下唯一能触发 500 的路径。
// 仅 LLM_PROVIDER=mock 时可达；#fail 是刻意选的、不会自然出现在修改说明里的串。
const MOCK_CHAT_FAIL_TOKEN = "#fail";

function findLastUserMessage(input: LlmOutlineChatInput) {
  return [...input.messages].reverse().find((message) => message.role === "user");
}

// 单次生成（messages 为空）时逐字返回既有草稿或模板，行为与加对话前完全一致。
// 对话轮次则把本轮指令落到正文里 —— 否则 mock 下 currentOutline 会被原样退回，
// 验收用例 13P1-A「markdown 变化」永远不成立。
function resolveMockOutlineMarkdown(input: LlmOutlineChatInput) {
  const base = input.currentOutline.trim() || buildOutlineMarkdown(input);
  const lastUser = findLastUserMessage(input);

  if (!lastUser) {
    return base;
  }

  if (lastUser.content.includes(MOCK_CHAT_FAIL_TOKEN)) {
    throw new Error("mock outline chat failure");
  }

  // UI-27：四段式里不能再追加 ## 章节，改动痕迹改成一句纯文本注记。
  return `${base}\n\n（已按「${lastUser.content}」调整）`;
}

function getMissingPrompt(input: LlmOutlineChatInput) {
  const profile = normalizeOutlineProfile(input.profile);

  if (!profile.intervieweeName) {
    return "我已经先搭出提纲骨架了。接下来想先确认一下，这次访谈的受访对象是谁？";
  }

  if (!profile.researchFocus) {
    return "我先整理出一版提纲。为了让问题更聚焦，你最希望这次访谈重点挖掘哪条记忆线索？";
  }

  if (!profile.projectName) {
    return "这版提纲已经接近可用。你希望把这个项目命名成什么，方便后续建档？";
  }

  return "我先把提纲整理成可编辑草稿了。你可以继续补充细节，我会按上下文继续细化。";
}

type MockInterviewAnswer = {
  question: string;
  isFollowUp: boolean;
  coveredItemIds: string[];
  isComplete: boolean;
};

// REQ-14：askQuestion 被两条链路共用——/ask 是自由问答（散文契约），
// next-question 是访谈逐问（JSON 契约）。用模板标志串区分。
const INTERVIEW_PROMPT_MARKER = "【访谈提纲条目】";

// 从渲染好的 prompt 里抠出 JSON 数组字面量。
function readPromptJsonArray(
  pattern: RegExp,
  prompt: string,
): unknown[] | null {
  const raw = prompt.match(pattern)?.[1];
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ⚠️ 下面两个正则与 buildInterviewQuestionPrompt 的渲染格式耦合：
//   {{CHECKLIST}}    → JSON.stringify(checklist, null, 2)，跟在标志串那一行之后
//   {{COVERED_IDS}}  → JSON.stringify(coveredItemIds)，单行
// 若 prompt 模板或渲染方式变动，需同步更新此处解析逻辑。判据见函数第 3 步：
// 格式漂移不会静默降级成散文，只会退到通用兜底问题。
const CHECKLIST_BLOCK_PATTERN = /【访谈提纲条目】[^\n]*\n(\[[\s\S]*?\n\])/;
const COVERED_IDS_PATTERN = /已覆盖条目 id：(\[[^\n]*\])/;

function buildMockInterviewAnswer(prompt: string): MockInterviewAnswer | null {
  // 1. 不是访谈 prompt → 交回原来的散文分支（/ask 链路不受影响）。
  if (!prompt.includes(INTERVIEW_PROMPT_MARKER)) {
    return null;
  }

  // 2. 抽 checklist。
  const checklist = (
    readPromptJsonArray(CHECKLIST_BLOCK_PATTERN, prompt) ?? []
  )
    .map((entry) => {
      const item = entry as { id?: unknown; text?: unknown } | null;
      const id = typeof item?.id === "string" ? item.id : "";
      const text = typeof item?.text === "string" ? item.text : "";
      return id && text ? { id, text } : null;
    })
    .filter((item): item is { id: string; text: string } => item !== null);

  // 3. 是访谈 prompt 却一条都没解析出来 = 渲染格式变了。刻意不返回 null：
  //    null 会退到散文分支 → 路由 parse 失败 → 502，整条访谈链路在 mock 下死掉，
  //    且没有任何报错指向格式漂移。回一份合法 JSON 兜底，表现为「问题永远停在
  //    第 1 题」，比整条链路 502 好定位。
  if (checklist.length === 0) {
    return {
      question: "（Mock）请谈谈您印象最深的一段经历。",
      isFollowUp: false,
      coveredItemIds: [],
      isComplete: false,
    };
  }

  // 4. 取第一条未覆盖条目；全问完则收尾（控制台据此走 FINISH）。
  const covered = new Set(
    (readPromptJsonArray(COVERED_IDS_PATTERN, prompt) ?? []).map((id) =>
      String(id),
    ),
  );
  const next = checklist.find((item) => !covered.has(item.id));

  if (!next) {
    return {
      question: "（Mock）今天的访谈就到这里，谢谢您。",
      isFollowUp: false,
      coveredItemIds: [],
      isComplete: true,
    };
  }

  return {
    question: `（Mock）${next.text}`,
    isFollowUp: false,
    coveredItemIds: [next.id],
    isComplete: false,
  };
}

export class MockLlmProvider implements LlmProvider {
  async askQuestion(prompt: string): Promise<LlmAskResult> {
    const interview = buildMockInterviewAnswer(prompt);

    if (interview) {
      return { answer: JSON.stringify(interview) };
    }

    return {
      answer:
        "（Mock 模式）当前为模拟问答环境，暂不基于访谈内容作答。配置 LLM_PROVIDER=ark 与 LLM_API_KEY 后即可获得真实回答。",
    };
  }

  async refineTranscript(input: LlmRefineInput): Promise<LlmRefineResult> {
    return {
      provider: "mock",
      aiDraft: [
        "受访者回忆，自己早年居住于老城厢，后随家人迁入新式里弄。",
        "她重点描述了石库门居住空间、菜场、夏夜乘凉与邻里交往等日常生活场景，认为这些细节构成了城市记忆的重要部分。",
        "谈及搬迁经历时，受访者提到母亲在离开旧居前后情绪波动明显，自己也因与旧邻分离而长期感到失落。",
      ].join("\n"),
      summary:
        "受访者围绕老城厢生活、搬迁经历与邻里记忆展开叙述，并在谈及家庭搬迁时出现明显的情绪波动线索。",
      keywords: ["老城厢", "城市迁移", "邻里关系", "家庭记忆", "情绪波动"],
      redactionNotes: [
        "涉及具体住址、亲属身份或联系方式时，建议在公开稿中使用泛化表述。",
        "如果后续补录到具体年代、门牌号或社交账号，建议进入严格脱敏流程。",
      ],
      sensitiveMarks: [
        {
          type: "address",
          // 必须逐字出现在本 provider 自己的 aiDraft/summary 中，否则「标记→替换」通道
          // 在 mock 模式下测不出来（这里 aiDraft 写的是「早年居住于老城厢」）。
          excerpt: "老城厢",
          reason: "可能指向具体家庭住址，需要公开传播前泛化处理。",
          needsVerify: false,
        },
      ],
      emotionalSignals: [
        {
          label: "失落与告别",
          level: "warning",
          excerpt: "我自己也因为跟老邻居分开，心里一直很难过。",
          guidance: "建议访谈者放慢追问节奏，并先确认受访者是否愿意继续谈搬迁话题。",
        },
        {
          label: "家庭创伤线索",
          level: "notice",
          excerpt: "我母亲很舍不得。",
          guidance: "如果继续追问母亲相关经历，宜提供停顿和情绪安抚选项。",
        },
      ],
      structuredSections: [
        {
          heading: "访谈信息",
          content: `口述场景：${input.scenario}\n研究焦点：${input.researchFocus || "未补充"}\n脱敏级别：${input.privacyLevel}`,
        },
        {
          heading: "关键叙事",
          content:
            "受访者以居住空间和邻里互动为主线，串联起城市更新前后的个人生活经验。",
        },
        {
          heading: "伦理与安全提示",
          content:
            "搬迁与亲属情绪相关内容可能构成脆弱叙述区段，建议人工复核时注意表述方式。",
        },
      ],
      timelineEvents: [
        {
          timeLabel: "青年时期",
          title: "居住于老城厢",
          description: "形成关于石库门、菜场与邻里往来的核心记忆。",
        },
        {
          timeLabel: "后续阶段",
          title: "家庭搬迁",
          description: "搬离旧居时出现明显情绪波动，并影响家庭成员心理状态。",
        },
      ],
    };
  }

  async generateInterviewOutline(
    input: LlmOutlineChatInput,
  ): Promise<OutlineChatResult> {
    const profile = normalizeOutlineProfile(input.profile);
    const outlineMarkdown = resolveMockOutlineMarkdown(input);
    const lastUser = findLastUserMessage(input);
    const readiness =
      profile.projectName && profile.intervieweeName && profile.researchFocus
        ? "ready"
        : input.messages.length > 0
          ? "drafting"
          : "collecting";

    return {
      assistantMessage: lastUser
        ? `已按你的要求更新提纲：${lastUser.content}`
        : getMissingPrompt(input),
      outlineMarkdown,
      profile: {
        ...profile,
        projectName:
          profile.projectName ||
          `${getInterviewScenarioLabel(profile.collectionScenario)}口述访谈`,
      },
      readiness,
      checkpoints: [
        profile.intervieweeName ? "已确认受访对象" : "待确认受访对象",
        profile.researchFocus ? "已明确研究焦点" : "待明确研究焦点",
        outlineMarkdown.trim() ? "已生成提纲草稿" : "待生成提纲草稿",
      ],
    };
  }
}
