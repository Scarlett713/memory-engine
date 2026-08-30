import { getInterviewScenarioLabel } from "@/lib/oral-history";
import { normalizeOutlineProfile } from "@/lib/outline-session";
import type {
  LlmAskResult,
  LlmOutlineChatInput,
  LlmProvider,
  LlmRefineInput,
  LlmRefineResult,
} from "@/lib/providers/llm/types";
import type { OutlineChatResult } from "@/lib/types/outline";

function buildOutlineMarkdown(input: LlmOutlineChatInput) {
  const profile = normalizeOutlineProfile(input.profile);
  const scenarioLabel = getInterviewScenarioLabel(profile.collectionScenario);
  const focus = profile.researchFocus || "待进一步明确研究焦点";
  const subject = profile.intervieweeName || "待确认受访对象";
  const projectName = profile.projectName || `${scenarioLabel}口述访谈提纲草案`;

  return [
    `# ${projectName}`,
    "",
    "## 访谈概况",
    `- 口述场景：${scenarioLabel}`,
    `- 受访对象：${subject}`,
    `- 整理机构：${profile.institutionName || "待补充"}`,
    `- 研究焦点：${focus}`,
    "",
    "## 访谈目标",
    `1. 明确与“${focus}”相关的个人记忆主线与关键事件。`,
    "2. 补充时间、地点、人物关系和场景细节，便于后续结构化整理。",
    "3. 关注情绪波动区段，保证提问节奏平稳、尊重受访者感受。",
    "",
    "## 核心提问路径",
    "### 第一阶段：进入记忆",
    `- 请您先介绍一下自己与这次口述主题“${focus}”之间最直接的关联。`,
    "- 您最先想到的时间、地点和人物是谁？",
    "",
    "### 第二阶段：展开关键经历",
    "- 当时发生了什么？您当时的生活状态是怎样的？",
    "- 哪些场景、物件、声音或人物最能代表那段经历？",
    "- 在关键转折前后，您的家庭、工作或周边环境有什么变化？",
    "",
    "### 第三阶段：情感与影响",
    "- 回看这段经历，您觉得最难忘或最想保留的感受是什么？",
    "- 有没有哪些片段在讲述时会让您感到不适，需要我们放慢节奏？",
    "",
    "## 现场提示",
    "- 重点记录明确年份、地点、身份关系与事件顺序。",
    "- 对涉及隐私的姓名、住址、联系方式即时做标记。",
    "- 受访者出现长时间停顿或情绪波动时，优先安抚再继续提问。",
    "",
    "## 待补充信息",
    "- 受访对象的基本背景",
    "- 关键历史阶段或时间节点",
    "- 是否存在需重点保护的隐私边界",
  ].join("\n");
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

export class MockLlmProvider implements LlmProvider {
  async askQuestion(prompt: string): Promise<LlmAskResult> {
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
          type: "家庭住址",
          excerpt: "老城厢某条石库门弄堂",
          reason: "可能指向具体家庭住址，需要公开传播前泛化处理。",
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
    const outlineMarkdown =
      input.currentOutline.trim() || buildOutlineMarkdown(input);
    const readiness =
      profile.projectName && profile.intervieweeName && profile.researchFocus
        ? "ready"
        : input.messages.length > 0
          ? "drafting"
          : "collecting";

    return {
      assistantMessage: getMissingPrompt(input),
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
