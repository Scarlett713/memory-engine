import type {
  CollectionPath,
  CollectionPlan,
  ConfidentialityLevel,
  InterviewScenario,
  PrivacyLevel,
  RedactionRule,
  SensitiveMark,
  StructuredSection,
  TimelineEvent,
} from "@/lib/types/project";

export const interviewScenarioOptions: Array<{
  value: InterviewScenario;
  label: string;
  description: string;
}> = [
  {
    value: "urban_memory",
    label: "城市记忆",
    description: "适合街区变迁、社区生活、城市更新等口述主题。",
  },
  {
    value: "red_memory",
    label: "红色记忆",
    description: "适合革命经历、集体记忆、时代见证类口述访谈。",
  },
  {
    value: "intangible_heritage",
    label: "非遗传承",
    description: "适合技艺传承、师承谱系、工序细节类访谈。",
  },
  {
    value: "family_memory",
    label: "家族记忆",
    description: "适合家庭迁徙、家风传承、代际记忆类访谈。",
  },
  {
    value: "education_memory",
    label: "教育记忆",
    description: "适合校史、教师经历、学习生活口述。",
  },
  {
    value: "custom",
    label: "自定义主题",
    description: "适合其他专题口述，由研究者自行定义重点。",
  },
];

export const privacyLevelOptions: Array<{
  value: PrivacyLevel;
  label: string;
  description: string;
}> = [
  {
    value: "basic",
    label: "基础保护",
    description: "仅根据敏感片段提示做定向脱敏，保留更多原始表达。",
  },
  {
    value: "standard",
    label: "标准保护",
    description: "补充手机号、身份证、地址等规则化脱敏，适合常规归档。",
  },
  {
    value: "strict",
    label: "严格保护",
    description: "扩大对具体日期、联系方式和精确定位信息的处理范围。",
  },
];

export const redactionRuleOptions: Array<{
  value: RedactionRule;
  label: string;
}> = [
  { value: "name", label: "姓名/称谓" },
  { value: "phone", label: "联系电话" },
  { value: "id_card", label: "身份证号" },
  { value: "address", label: "详细住址" },
  { value: "organization", label: "机构/单位" },
  { value: "contact_account", label: "邮箱/社交账号" },
];

export const confidentialityLevelOptions: Array<{
  value: ConfidentialityLevel;
  label: string;
  description: string;
}> = [
  {
    value: "public",
    label: "公开",
    description: "成果可用于公开展示、展览或对外传播。",
  },
  {
    value: "internal",
    label: "内部",
    description: "仅限机构内部研究使用，不对外发布。默认级别。",
  },
  {
    value: "confidential",
    label: "机密",
    description: "含敏感内容，仅授权研究员可调阅，导出需额外审批。",
  },
];

export const collectionPathOptions: Array<{
  value: CollectionPath;
  label: string;
  description: string;
}> = [
  {
    value: "upload",
    label: "本地上传",
    description: "上传已有的音视频文件，进入自动转写与整理流程。",
  },
  {
    value: "ai_interview",
    label: "AI 访谈",
    description: "由系统引导完成访谈采集，无需预先录音。",
  },
];

const scenarioLabelMap: Record<InterviewScenario, string> = Object.fromEntries(
  interviewScenarioOptions.map((option) => [option.value, option.label]),
) as Record<InterviewScenario, string>;

const privacyLabelMap: Record<PrivacyLevel, string> = Object.fromEntries(
  privacyLevelOptions.map((option) => [option.value, option.label]),
) as Record<PrivacyLevel, string>;

const redactionLabelMap: Record<RedactionRule, string> = Object.fromEntries(
  redactionRuleOptions.map((option) => [option.value, option.label]),
) as Record<RedactionRule, string>;

const confidentialityLabelMap: Record<ConfidentialityLevel, string> =
  Object.fromEntries(
    confidentialityLevelOptions.map((option) => [option.value, option.label]),
  ) as Record<ConfidentialityLevel, string>;

const collectionPathLabelMap: Record<CollectionPath, string> =
  Object.fromEntries(
    collectionPathOptions.map((option) => [option.value, option.label]),
  ) as Record<CollectionPath, string>;

const scenarioTemplateMap: Record<
  InterviewScenario,
  {
    outline: string[];
    prompts: string[];
    safetyTips: string[];
  }
> = {
  urban_memory: {
    outline: [
      "请受访者回忆最具代表性的街区空间、住居环境与日常路线。",
      "追问城市更新前后的生活变化、邻里关系和公共空间体验。",
      "记录具体时间节点、地标、职业和家庭生活如何交织在城市变迁中。",
    ],
    prompts: [
      "出现地名、街巷名、年代时及时标记，方便后续建立时间线。",
      "遇到涉及拆迁、灾害或失去重要亲友的叙述时放慢节奏，确认受访者状态。",
    ],
    safetyTips: [
      "优先让受访者完整讲述记忆脉络，再补问具体地名与年份。",
      "涉及创伤性搬迁或生活变故时，避免连续追问细节。",
    ],
  },
  red_memory: {
    outline: [
      "围绕时代背景、参与经历、关键事件和个人角色逐步展开。",
      "关注个人记忆与集体记忆的交汇点，补足地点、组织、人物关系。",
      "对口号、称呼和历史事件名称进行复述确认，减少后续误录。",
    ],
    prompts: [
      "出现革命组织、行动节点和文献线索时即时标记。",
      "面对沉重记忆时先做情绪安抚，再继续提问。",
    ],
    safetyTips: [
      "避免带有评价倾向的问题，尽量保持叙述开放性。",
      "遇到烈士、伤亡或失联话题时给予暂停和休息选项。",
    ],
  },
  intangible_heritage: {
    outline: [
      "先追问技艺源流、师承关系和学习过程。",
      "再按工序、工具、材料、节庆场景等整理细节。",
      "补充技艺传承中的家庭角色、市场变化和当代挑战。",
    ],
    prompts: [
      "记录术语、方言说法和工序顺序，便于后续结构化整理。",
      "对作品名称、代表作和传承节点进行即时标记。",
    ],
    safetyTips: [
      "尊重受访者对核心技艺细节的公开边界。",
      "如涉及家传秘方或商业秘密，提前说明使用范围。",
    ],
  },
  family_memory: {
    outline: [
      "按家族成员、迁徙经历、重要事件和代际关系展开。",
      "梳理家庭职业、教育、婚姻与居住变化的时间顺序。",
      "补记家风、家训和家庭内部对重大事件的不同记忆。",
    ],
    prompts: [
      "遇到亲属姓名、年代和迁移地点时实时标记。",
      "涉及逝者、疾病或家庭冲突时，优先确认受访者情绪状态。",
    ],
    safetyTips: [
      "避免用单一视角替代复杂的家庭记忆。",
      "涉及未成年人或仍在世第三方时，提醒后续脱敏处理。",
    ],
  },
  education_memory: {
    outline: [
      "从校园环境、师生关系和制度背景切入。",
      "追问入学、毕业、工作分配等关键教育节点。",
      "整理个体教育经历与社会时代变化的关联。",
    ],
    prompts: [
      "记录校名、院系、班级和关键年份，为结构化入档做准备。",
      "涉及体罚、创伤事件或校园事故时给出安全提示。",
    ],
    safetyTips: [
      "对受访者的学校评价保持中性，优先确认事实。",
      "如果谈及未公开事件，及时提示保密和脱敏边界。",
    ],
  },
  custom: {
    outline: [
      "先确认本次访谈核心主题、背景与目标成果形式。",
      "围绕人物、事件、时间线和关键证据逐步追问。",
      "在访谈尾声复核遗漏事项，并约定后续补充材料。",
    ],
    prompts: [
      "随时标记人名、地名、机构名与时间点。",
      "如果话题进入创伤区段，优先提供暂停和情绪安抚。",
    ],
    safetyTips: [
      "保持非引导式追问，避免替受访者组织答案。",
      "敏感信息在现场即做标记，方便后续快速脱敏。",
    ],
  },
};

export function getInterviewScenarioLabel(value: InterviewScenario) {
  return scenarioLabelMap[value];
}

export function getInterviewScenarioDisplayLabel(
  value: InterviewScenario,
  customScenarioLabel?: string,
) {
  if (value === "custom") {
    return customScenarioLabel?.trim() || scenarioLabelMap[value];
  }

  return scenarioLabelMap[value];
}

export function getPrivacyLevelLabel(value: PrivacyLevel) {
  return privacyLabelMap[value];
}

// 入参可选：字段类型上是 optional，但 readProjects() 必经 normalizeProjectRecord，
// 运行时值恒存在，这里再兜一层默认值，调用方就不必写 ?? "internal"。
export function getConfidentialityLevelLabel(value?: ConfidentialityLevel) {
  return confidentialityLabelMap[value ?? "internal"];
}

export function getCollectionPathLabel(value?: CollectionPath) {
  return collectionPathLabelMap[value ?? "upload"];
}

export function getRedactionRuleLabel(value: RedactionRule) {
  return redactionLabelMap[value];
}

export function buildCollectionPlan(input: {
  scenario: InterviewScenario;
  projectName: string;
  intervieweeName: string;
  researchFocus: string;
}): CollectionPlan {
  const template = scenarioTemplateMap[input.scenario];
  const subject = input.intervieweeName.trim() || "受访者";
  const focus = input.researchFocus.trim();

  return {
    outline: template.outline.map((item, index) =>
      index === 0
        ? `${item} 访谈对象聚焦：${subject}。`
        : focus && index === 1
          ? `${item} 当前研究重点：${focus}。`
          : item,
    ),
    livePrompts: [
      `项目“${input.projectName.trim() || "未命名口述项目"}”建议优先核对时间、地点和人物关系。`,
      ...template.prompts,
    ],
    safetyTips: template.safetyTips,
  };
}

export function createFallbackStructuredSections(input: {
  summary: string;
  aiDraft: string;
  notes: string;
  researchFocus: string;
}): StructuredSection[] {
  const sections = [
    {
      id: "section-overview",
      heading: "口述概览",
      content: input.summary || "暂无概览内容。",
    },
    {
      id: "section-focus",
      heading: "研究焦点",
      content:
        input.researchFocus || input.notes || "当前项目未补充明确研究焦点。",
    },
    {
      id: "section-record",
      heading: "整理稿",
      content: input.aiDraft || "暂无整理稿内容。",
    },
  ];

  return sections.filter((section) => section.content.trim());
}

export function createFallbackTimeline(summary: string): TimelineEvent[] {
  if (!summary.trim()) {
    return [];
  }

  return [
    {
      id: "timeline-1",
      timeLabel: "待人工补充",
      title: "口述历史关键事件",
      description: summary.trim(),
    },
  ];
}

function replaceAllSafe(text: string, search: string, replacement: string) {
  if (!search) {
    return text;
  }

  return text.split(search).join(replacement);
}

function maskByRules(text: string, rules: RedactionRule[], level: PrivacyLevel) {
  let nextText = text;
  const activeRules = new Set(rules);

  if (activeRules.has("phone")) {
    nextText = nextText.replace(
      /(?<!\d)(1[3-9]\d{9})(?!\d)/g,
      "[已脱敏-手机号]",
    );
  }

  if (activeRules.has("id_card")) {
    nextText = nextText.replace(
      /(?<!\d)(\d{17}[\dXx]|\d{15})(?!\d)/g,
      "[已脱敏-身份证号]",
    );
  }

  if (activeRules.has("contact_account")) {
    nextText = nextText
      .replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        "[已脱敏-邮箱]",
      )
      .replace(/(微信|vx|VX|QQ)[:：]?\s*([A-Za-z0-9_-]{5,20})/g, "$1：[已脱敏]");
  }

  if (activeRules.has("address")) {
    nextText = nextText.replace(
      /(住址|地址|家庭住址|现住地)[:：]?\s*([^\n，。；;]{4,40})/g,
      "$1：[已脱敏-地址]",
    );
  }

  if (activeRules.has("organization")) {
    nextText = nextText.replace(
      /(工作单位|所在机构|学校|单位名称)[:：]?\s*([^\n，。；;]{2,30})/g,
      "$1：[已脱敏-机构]",
    );
  }

  if (level === "strict") {
    nextText = nextText
      .replace(
        /(?<!\d)(19|20)\d{2}年\d{1,2}月\d{1,2}日/g,
        "[已脱敏-具体日期]",
      )
      .replace(/(?<!\d)(19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}(?!\d)/g, "[已脱敏-具体日期]");
  }

  return nextText;
}

export function applyRedactionProfile(input: {
  text: string;
  level: PrivacyLevel;
  rules: RedactionRule[];
  sensitiveMarks: SensitiveMark[];
}) {
  let nextText = input.text.trim();

  const sortedMarks = [...input.sensitiveMarks].sort(
    (left, right) => right.excerpt.length - left.excerpt.length,
  );

  for (const mark of sortedMarks) {
    const fallbackLabel = mark.type.trim() || "敏感信息";
    nextText = replaceAllSafe(nextText, mark.excerpt, `[已脱敏-${fallbackLabel}]`);
  }

  return maskByRules(nextText, input.rules, input.level);
}
