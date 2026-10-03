// REQ-14 §6.3 写作规则插槽：把 03 / 05 / 07 三份 docx 的写作规范收敛成一份可注入的纯文本。
//
// 数据来源（逐字核对见 tmp/verify/verify-req14-prompts.ts 第 2 组断言）：
//   07_口述史写作模板.docx      → OUTLINE_WRITING_TEMPLATES（5 类模板的章节骨架，逐字照抄）
//   05_最终交付文本标准...docx  → WRITING_RULES_TEMPLATE 的【内容标准】节（五项内容标准）
//   03_AI语言输出规范.docx      → WRITING_RULES_TEMPLATE 的【语言规范】节（四大原则 + 修正边界）
//
// 纯常量 + 纯函数：无 IO、无副作用，可被 route / server / 验收脚本直接引用。
// 模板字面量一律顶格书写 —— 缩进会成为注入到 prompt 里的正文。

import type { InterviewScenario, ProjectRecord } from "@/lib/types/project";

// 05 要求「书面化、规范化、结构规范」，与档案级（要求保留全部口语特征）和
// 传播级（允许较高强度润色）都冲突，故本期固定学术级。保留参数以便后续按项目放开。
export const OUTPUT_GRADE = "学术级";

export type OutputGrade = "档案级" | "学术级" | "传播级";

export type WritingTemplateKey =
  | "tibet_aid"
  | "local_chronicle"
  | "enterprise_history"
  | "biography"
  | "family_memoir";

export type WritingTemplate = {
  key: WritingTemplateKey;
  name: string;
  chapters: readonly string[];
};

// 07 的 5 类模板，章节标题逐字照抄（注意「产品/业务」用的是半角斜杠）。
export const OUTLINE_WRITING_TEMPLATES: Record<
  WritingTemplateKey,
  WritingTemplate
> = {
  tibet_aid: {
    key: "tibet_aid",
    name: "援藏故事类",
    chapters: [
      "一、进藏背景与初心",
      "二、岗位工作与实绩",
      "三、典型事迹与故事",
      "四、高原生活与感悟",
      "五、精神传承与寄语",
    ],
  },
  local_chronicle: {
    key: "local_chronicle",
    name: "地方史志类",
    chapters: [
      "一、地域概况与历史沿革",
      "二、重大事件与时代变迁",
      "三、民俗风物与文化传承",
      "四、地方发展与建设成就",
      "五、亲历者感悟与记忆",
    ],
  },
  enterprise_history: {
    key: "enterprise_history",
    name: "企业发展史类",
    chapters: [
      "一、创业背景与创立历程",
      "二、核心发展阶段与关键决策",
      "三、产品/业务与市场拓展",
      "四、企业文化与团队建设",
      "五、未来展望与经验总结",
    ],
  },
  biography: {
    key: "biography",
    name: "人物传记类",
    chapters: [
      "一、生平履历与成长背景",
      "二、关键人生节点与抉择",
      "三、主要成就与贡献",
      "四、人际交往与个人特质",
      "五、人生感悟与寄语",
    ],
  },
  family_memoir: {
    key: "family_memoir",
    name: "家族回忆录类",
    chapters: [
      "一、家族渊源与迁徙历程",
      "二、家族成员与代际脉络",
      "三、家族重要往事与节点",
      "四、家风家训与传承故事",
      "五、家族记忆与情感寄语",
    ],
  },
};

// 兜底模板：07 的「人物传记类」骨架最通用（生平 → 节点 → 成就 → 人际 → 感悟）。
export const FALLBACK_WRITING_TEMPLATE_KEY: WritingTemplateKey = "biography";

// 枚举 → 模板：07 只有 5 类，InterviewScenario 有 6 个值，故城市记忆 / 红色记忆 /
// 非遗传承三类落到「地方史志类」—— 07 的「记录主题」原文即含历史变迁、红色记忆、非遗民俗。
export const SCENARIO_WRITING_TEMPLATE: Record<
  InterviewScenario,
  WritingTemplateKey
> = {
  urban_memory: "local_chronicle",
  red_memory: "local_chronicle",
  intangible_heritage: "local_chronicle",
  family_memory: "family_memoir",
  education_memory: "biography",
  custom: "biography",
};

// custom 场景的关键词兜底：07 的「援藏故事类 / 企业发展史类」在枚举里没有对应值，
// 不认关键词这两类模板永远不可达（存量「上海援藏 30 周年」素材即属此类）。
// 只对 custom 生效，不会覆盖枚举映射。
export const CUSTOM_TEMPLATE_KEYWORDS: ReadonlyArray<{
  key: WritingTemplateKey;
  pattern: RegExp;
}> = [
  { key: "tibet_aid", pattern: /援藏|援派|进藏|援青|援疆/ },
  { key: "enterprise_history", pattern: /企业|公司|集团|厂史|工厂|实业|创业/ },
];

export type WritingTemplateInput = {
  scenario: InterviewScenario;
  customScenarioLabel?: string;
  projectName?: string;
  researchFocus?: string;
};

export function matchCustomTemplateKey(
  input: WritingTemplateInput,
): WritingTemplateKey {
  const haystack = [input.customScenarioLabel, input.projectName, input.researchFocus]
    .map((value) => value?.trim() ?? "")
    .join(" ");

  return (
    CUSTOM_TEMPLATE_KEYWORDS.find((entry) => entry.pattern.test(haystack))?.key ??
    FALLBACK_WRITING_TEMPLATE_KEY
  );
}

export function resolveWritingTemplate(
  input: WritingTemplateInput,
): WritingTemplate {
  if (input.scenario === "custom") {
    return OUTLINE_WRITING_TEMPLATES[matchCustomTemplateKey(input)];
  }

  // 运行时兜底：collectionScenario 在 hardening 完成前可能是枚举外的非法值。
  const key = SCENARIO_WRITING_TEMPLATE[input.scenario] ?? FALLBACK_WRITING_TEMPLATE_KEY;
  return OUTLINE_WRITING_TEMPLATES[key];
}

// 只替换 {{大写字母与下划线}} 形式的占位符；未提供的键原样保留，
// 让「占位符漏填」在验收脚本里以残留形式暴露，而不是静默变成 undefined。
export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => values[key] ?? match);
}

// 注入到整理 system prompt 的规则正文。三段结构刻意用【】而不是「一、二、三」，
// 避免与写作模板的章标题（一、/二、/…）争用同一套序号，误导模型。
export const WRITING_RULES_TEMPLATE = `【写作规则｜记忆引擎口述史整理规范】
以下规则约束 aiDraft、summary、structuredSections、timelineEvents 的全部文本写法，与前述 JSON 结构要求同时生效。

【内容标准】
1. 事实准确：人物、时间、地点、事件四要素只按转写原文陈述；原文前后矛盾或不合常识的，不修正，标记【待人工核实】。
2. 原意忠实：不改变受访者原意、观点与态度，直接引语保持原貌。
3. 信息完整：关键事件、关键人物、关键时间点不遗漏；不得为通顺而删除完整信息点。
4. 脱敏合规：严格遵守「严禁自行脱敏」，只标记、不替换、不删除。
5. 结构规范：aiDraft 必须按本项目写作模板的章节结构组织。

【语言规范】
四大原则：忠实原意、最小干预、分级适配（本项目输出等级＝{{OUTPUT_GRADE}}）、可溯可审。
可直接修正：① 同音／近音造成的转写偏差（地名、人名、专有名词）；② 明显成分残缺且不新增信息；③ 无意义重复与口语倒装造成的语序混乱；④ 无实义发语词「嗯、啊、那个、就是说」（按输出等级处理）。
禁止修正、只能标记：① 个性化表达与地域口语句式（不得统一为标准书面语）；② 事实存疑（时间、数字、事件经过矛盾）→ 标【待人工核实】并注明疑点；③ 带强烈情感或个人立场的表述；④ 比喻、夸张、委婉等修辞表达。
人称与称谓：第一人称保留「我／我们」，「我们」指代模糊时标注说明不擅改；同一人物称呼前后不一致时，统一为受访者最常用的称谓，不替换为官方全称；亲属称谓保留原生表达；涉密单位与敏感岗位职务按脱敏标准泛化。
专业术语：政策文件、工程项目等通用专有名词可在首次出现时用括号补标准全称，正文保留受访者原表述；有权威依据的历史事件、行业术语偏差可修正并同步标注说明；方言、非遗、民俗专属称谓一律保留原表述，生僻词可补注释，无权威释义的标【待人工核实】。
口语特征：本项目为 {{OUTPUT_GRADE}}，保留影响语义的语气词与情绪性语气（感叹、迟疑、哽咽等一律保留）；不删减受访者的插话、补充与自我纠正；提问者引导语不得混入受访者正文。

【章节结构】
本项目适用模板：{{TEMPLATE_NAME}}。aiDraft 按下列章节顺序组织，章节标题逐字使用，不增删章节：
{{TEMPLATE_CHAPTERS}}
章节内按原文叙述顺序书写，不调整事件先后，不为填满章节而编造内容；某章节原文无对应内容时，保留该章节标题并写「本节内容在本次访谈中未涉及」。

【结构化要素】
structuredSections 必须与上述章节一一对应：heading 使用章节标题（去掉「一、」等序号前缀），content 为该章节整理正文摘要；不得输出模板之外的章节。
timelineEvents 只提取原文明确出现的时间及其事件。
summary 用 200 字以内概括，不使用评价性词语。

【标记与留痕】
【待人工核实】标记必须同时出现在 aiDraft 的对应位置；修正说明写入 redactionNotes（原表述 → 修正后 + 依据），依据不得写成推测。`;

export type WritingRulesInput = WritingTemplateInput & {
  // 默认 OUTPUT_GRADE（学术级）；预留为参数，便于后续按项目等级放开。
  outputGrade?: OutputGrade;
};

export function buildWritingRules(input: WritingRulesInput): string {
  const template = resolveWritingTemplate(input);

  return renderTemplate(WRITING_RULES_TEMPLATE, {
    OUTPUT_GRADE: input.outputGrade ?? OUTPUT_GRADE,
    TEMPLATE_NAME: template.name,
    TEMPLATE_CHAPTERS: template.chapters.join("\n"),
  });
}

// process-project.ts 的接入点：只取 4 个字段，调用侧保持一行。
export function buildWritingRulesForProject(
  project: Pick<
    ProjectRecord,
    "projectName" | "customScenarioLabel" | "collectionScenario" | "researchFocus"
  >,
): string {
  return buildWritingRules({
    scenario: project.collectionScenario,
    customScenarioLabel: project.customScenarioLabel,
    projectName: project.projectName,
    researchFocus: project.researchFocus,
  });
}