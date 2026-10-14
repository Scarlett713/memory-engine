# REQ-31 实施任务单 · 新增通用写作模板（非口述史 / 非史志类访谈；不强制五章结构）

> 上游：`docs/需求登记表.md` §三 REQ-31（**P2**；总管 2026-10-13 立号 × 优先级补录）＋ §5.2「REQ-31 ↔ REQ-14 / REQ-25（`writing-rules.ts` 的「锁定面」）」；**方向 B 已定**：新增一套通用模板、不强制五章。
> - **规模**：生产代码 **1 个文件 / 5 处 hunk**（`src/lib/writing-rules.ts`）；探针 **1 支文件**（`tmp/verify/verify-req14-prompts.ts`：`:182` **表达式等价改写** ＋ 新增 `2b.通用模板` 组 **20 条**）；既有 **116 条**中 **115 条逐字零改动**。
> - **前置**：实施序第 3 位（REQ-25 已验收 2026-10-13 → BUG-13 已闭环 `d080ca3` → **本条**）。**本单出稿后须总管裁决方可开工**（REQ-14 探针锁定面）。
> - **行号基线**：2026-10-13 实测，HEAD = `42229f4`（`master`，工作区 clean）；改前须按 §0.2-② 复核。
> - **红线**：不动既有 5 套模板章节字面 / 不动场景映射与关键词兜底 / 不动 mock（§0.1 三条约束）。
> - **状态**：**已完成（2026-10-13，`3279536`）**（实施轮同批落盘：生产 `src/lib/writing-rules.ts` **1 文件 / 5 hunk** ＋ 探针 `tmp/verify/verify-req14-prompts.ts` **1 文件 / 5 处** ＋ 本单回写；验收 **V1 136 / 136 · exit 0**、**R2 31 / 31 不回退**）。

---

## §0 口径说明

### 0.1 三条约束（逐字遵守）

| # | 约束（逐字） | 本单落地 | 机器校验 |
| --- | --- | --- | --- |
| ① | **不改既有 5 套模板的章节字面** | 只在 `OUTLINE_WRITING_TEMPLATES`（`:33-92`）**追加**第 6 键 `general`；既有 5 个块内**零字符变动** | `git diff src/lib/writing-rules.ts` 中 5 个既有块 **0 hunk**；探针第 **2** 组 25 条（含 docx 直读）逐条仍绿；组 4 体积实测 **1296 / 1305 / 1310 / 1302 / 1307** 字符不变 |
| ② | **不改场景映射 / 关键词兜底** | `SCENARIO_WRITING_TEMPLATE`（`:99-109`）与 `CUSTOM_TEMPLATE_KEYWORDS`（`:114-120`）**0 hunk**；新模板**不进**这两张表 | `git diff` 两张表 0 hunk；探针 `2b.守门` 第 18 / 19 条（两表均不含 `general`）；组 1 既有 **6 ＋ 5 ＋ 1 ＋ 1 = 13 条**仍绿 |
| ③ | **不改 mock** | `src/lib/providers/llm/mock-llm-provider.ts` **0 hunk**；mock 仍调 `resolveWritingTemplate({ scenario: input.scenario })`（不传 `templateKey`） | `git diff` 该文件**空**；探针 `2b.守门` 第 20 条（源码不含 `templateKey`） |

### 0.2 三项实施口径（延续 REQ-25 / BUG-13 IMPL §0.2）

| # | 口径 | 本批实测（2026-10-13，HEAD `42229f4`） | 纪律 |
| --- | --- | --- | --- |
| ① | 行尾 | `src/lib/writing-rules.ts` **纯 LF**（10433 B / LF 223 / CRLF **0**）；`tmp/verify/verify-req14-prompts.ts` **纯 LF**（21085 B / LF 520 / CRLF **0**）；`docs/**` 为 **CRLF** | `src/**` / `tmp/**` **禁止**把 `\n` 归一为 `\r\n`；本单 **CRLF** |
| ② | 行号 | 一律 `[IO.File]::ReadAllLines` / `Select-String`；**禁用 `Get-Content`**（PS 5.1 把无 BOM UTF-8 当 GBK 解码 → 行号虚高） | 全单行号即此口径产物；改前须复核 |
| ③ | BOM | `writing-rules.ts` / `verify-req14-prompts.ts` **均无 BOM** | 逐文件原样保留，**不增不删** |

### 0.3 本批硬边界（禁改清单）

| # | 禁改面 | 依据 |
| --- | --- | --- |
| ① | 既有 5 套模板的 `key` / `name` / `chapters` 字面（`:37-91`） | 约束 ①；探针第 2 组 25 条 ＋ `EXPECTED_TEMPLATES`（探针 `:129-180`） |
| ② | `WRITING_RULES_TEMPLATE`（`:165-194`）**整段**（含 `:184` 的「不增删章节」与 `:186` 的空章占位句） | 约束 ①；探针 `:275-277` / `:482-484` / `:489` / `:494` ＋ `2b` 第 17 条（插槽保留） |
| ③ | `SCENARIO_WRITING_TEMPLATE`（`:99-109`）、`CUSTOM_TEMPLATE_KEYWORDS`（`:114-120`） | 约束 ②；探针组 1 ＋ `2b` 第 18 / 19 条 |
| ④ | `FALLBACK_WRITING_TEMPLATE_KEY`（`:95`）与 `matchCustomTemplateKey()`（`:129-140`） | 约束 ②；探针 `:121` / `:128` |
| ⑤ | `renderTemplate()`（`:156-161`）、`buildWritingRules()`（`:201-209`） | 约束 ①（既有 5 类 Prompt B 逐字不变）；探针组 3 / 4 / 7 |
| ⑥ | `buildWritingRulesForProject()`（`:212-224`）与 `Pick<...>` 字段集 | 本单**不含**项目级字段（§0.4-Q2）；探针 `:513-517` |
| ⑦ | `src/lib/providers/llm/mock-llm-provider.ts`（整文件） | 约束 ③ |
| ⑧ | `src/lib/server/project-export.ts`（整文件，含 `:45` / `:47` 正则与 `:49` 占位句） | REQ-25 已验收基线（31 / 31）不得回退 |
| ⑨ | `src/lib/interview-prompt.ts`、`src/lib/oral-history.ts`（`interviewScenarioOptions` / `scenarioTemplateMap`） | 与本案无交集（探针组 1 `:84` 锁场景数 6） |
| ⑩ | 探针 `tmp/verify/verify-req14-prompts.ts` 的既有 **115 条**断言 | 只允许「**追加**」＋ `:182` 一条**表达式等价改写**（§1.2-①） |
| ⑪ | `tmp/verify-req25-export-format.mjs`（31 条）、`tmp/verify/bug05-redaction.ts` | 回归基线只读 |
| ⑫ | 数据层（`storage/**`、`src/lib/types/project.ts`、`src/lib/server/project-store.ts`、`src/app/api/projects/route.ts`）与 UI 侧 | 本单**不含**（§0.4-Q2 / Q3） |

### 0.4 开口项（本单**不含**；须总管裁决后另批，不在本单 diff 内）

| # | 开口项 | 本单取值 | 说明（若采纳时须追加的触点） |
| --- | --- | --- | --- |
| Q1 | 通用模板骨架形态 | **仍给一套默认骨架**（3 章，见 §1.1-hunk2） | 登记表 §三 REQ-31「待确认①」的两条候选之一；**完全自由 / 允许空章**须另批（会改 `WRITING_RULES_TEMPLATE` 的「不增删章节」口径 ＝ 触碰约束 ① 之外的规则正文） |
| Q2 | 项目级字段 ＋ 服务端透传 | **不含** | 若采纳：`types/project.ts` 增 `writingTemplateKey?` ＋ `project-store.ts` 归一化 ＋ `api/projects/route.ts` 读表单 ＋ `process-project.ts:93` 透传 ＋ `writing-rules.ts` 的 `Pick<...>` 增该键（**5 处新增触点**，且须加旧 JSON 兼容断言） |
| Q3 | UI 入口（新建 / 上传页「写作模板」选择器） | **不含**（无 PRD） | 若采纳：`src/components/upload/interview-upload-form.tsx` ＋ 新建页组件 ＋ 验收需任老师实机确认（本单 §2 的验收面**不含 UI**） |
| Q4 | `general` 模板在 mock 演示链路的表现 | **不会出现**（mock 不传 `templateKey`） | 约束 ③ 的直接后果：mock / 演示环境仍显五章骨架 ⇒ 已知局限，须与 Q2 / Q3 一并裁决是否需要演示覆盖 |

### 0.5 事实依据（只读扫描，2026-10-13，`src` 零改动）

| # | 事实 | 实测口径 |
| --- | --- | --- |
| ① | 全仓**唯一**模板注册表 = `src/lib/writing-rules.ts` 的 `OUTLINE_WRITING_TEMPLATES` | 全仓搜索仅 `writing-rules.ts` 定义、探针引用、`.next-dev/**` 编译产物 |
| ② | 探针**改前基线** = **116 / 116 通过**（exit 0） | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` |
| ③ | 模板键类型闭环：`WritingTemplateKey`（`:19-24`）↔ `Record<WritingTemplateKey, WritingTemplate>`（`:33-36`） | 新增键**必须同补两处**，否则 `tsc --noEmit` 报缺键（探针 `:321-327` 的 `renderCase: Record<WritingTemplateKey, () => string>` 同受约束） |
| ④ | 探针为 `--experimental-strip-types` 运行（探针 `:3`）＝**不做类型检查** ⇒ 类型级破口只在 `tsc` 暴露 | §2-V2 |
| ⑤ | 导出侧按「中文数字、」识别章标题（`project-export.ts:45` `CHAPTER_INDEX_PATTERN` / `:47` `CHAPTER_HEADING_PATTERN`） | 通用模板 3 章仍带同形序号 ⇒ 导出侧**无需改动**（Q1 取「默认骨架」的前提） |
| ⑥ | mock 五章语料 `MOCK_CHAPTER_DRAFTS`（`mock-llm-provider.ts:83-104`）按 index 对齐模板章序，取不到时 `?? ""` 兜底（`:262` / `:299`） | 通用模板 3 章 ≤ 5 ⇒ 即便未来 mock 接入也不会越界；本单 mock 保持 0 hunk |
| ⑦ | 项目数据无模板字段：`storage/projects.json` 仅 `collectionScenario` / `customScenarioLabel`；`ProjectRecord`（`types/project.ts:161+`）无模板键 | 模板当前**只能由场景派生** ⇒ §1 的显式键通道是本单唯一接入口（可达性边界见 §1.4） |

---

## §1 改动清单

### 1.1 `src/lib/writing-rules.ts` —— 生产代码唯一改动文件（**5 处 hunk**，净增 **28 行**：224 → **252** 行）

| hunk | 位置（改前行号） | 动作 | 净增 |
| --- | --- | --- | --- |
| 1 | `:5` 之后（文件头「数据来源」注释块内） | 追加 3 行注释（记录第 6 套模板与接入形态） | +3 |
| 2 | `:19-24` `WritingTemplateKey` | 联合类型末尾追加 `\| "general"` | +1 |
| 3 | `:91-92` 之间（`family_memoir` 块 `},` 之后、容器 `};` 之前） | 插入 `general` 条目（2 行注释 ＋ 9 行对象） | +11 |
| 4 | `:122-127` `WritingTemplateInput` | 追加 2 行注释 ＋ `templateKey?: WritingTemplateKey;` | +3 |
| 5 | `:142-144` `resolveWritingTemplate` 函数体顶部 | 插入显式键分支（2 行注释 ＋ 8 行代码） | +10 |

**hunk-1**（文件头注释；`:3-6` 的数据来源四行**逐字不动**，只在 `:5` 之后追加）

```
//   REQ-31                      → OUTLINE_WRITING_TEMPLATES 新增第 6 套「通用访谈类」（3 章默认
//                                 骨架、不沿用五章结构）；仅经 WritingTemplateInput.templateKey
//                                 显式键可达，不进 SCENARIO_WRITING_TEMPLATE / CUSTOM_TEMPLATE_KEYWORDS。
```

**hunk-2**（`:19-24`）

```ts
// 改前
  | "family_memoir";
// 改后
  | "family_memoir"
  | "general";
```

**hunk-3**（`:91` 的 `},` 之后、`:92` 的 `};` 之前插入；既有 5 个块**零字符变动**）

```ts
  // REQ-31：第 6 套「通用访谈类」（非口述史 / 非史志类访谈）。默认骨架刻意取 3 章、
  // 不沿用五章结构；章标题仍带「中文数字、」序号 —— 导出侧按该序号识别章标题（REQ-25）。
  general: {
    key: "general",
    name: "通用访谈类",
    chapters: [
      "一、背景与缘起",
      "二、主要经历与关键事实",
      "三、认识、评价与展望",
    ],
  },
```

**hunk-4**（`:122-127`）

```ts
export type WritingTemplateInput = {
  scenario: InterviewScenario;
  customScenarioLabel?: string;
  projectName?: string;
  researchFocus?: string;
  // REQ-31：显式指定模板（优先级高于场景映射与关键词兜底）。
  // 缺省 / 非法值时不进入该分支，既有两条解析分支逐字不变（REQ-14 第 1 组守门）。
  templateKey?: WritingTemplateKey;
};
```

**hunk-5**（`:142-144`；`:145-152` 的既有两条分支**零字符变动**）

```ts
export function resolveWritingTemplate(
  input: WritingTemplateInput,
): WritingTemplate {
  // REQ-31：显式键通道 —— 新模板的唯一接入口；不改场景映射与关键词兜底。
  // 声明为可缺省类型：运行时传入非法键时同样回落既有链路，不抛错。
  const explicit: WritingTemplate | undefined = input.templateKey
    ? OUTLINE_WRITING_TEMPLATES[input.templateKey]
    : undefined;

  if (explicit) {
    return explicit;
  }

  if (input.scenario === "custom") {
    ...（既有代码逐字不动）
```

> **零连带核对（改前必做）**：`:165-194` `WRITING_RULES_TEMPLATE`、`:95` `FALLBACK_WRITING_TEMPLATE_KEY`、`:99-109` `SCENARIO_WRITING_TEMPLATE`、`:114-120` `CUSTOM_TEMPLATE_KEYWORDS`、`:129-140` `matchCustomTemplateKey`、`:156-161` `renderTemplate`、`:201-209` `buildWritingRules`、`:212-224` `buildWritingRulesForProject` —— **上述 8 处 0 hunk**；`WritingTemplate`（`:26-30`）亦 **0 hunk**（不新增字段 ⇒ 全仓 `WritingTemplate` 消费点无类型波及）。

### 1.2 `tmp/verify/verify-req14-prompts.ts` —— 探针拆组方式（**1 条等价改写 ＋ 1 组新增 20 条**）

#### 1.2-① 拆组方式（唯一被改写的既有断言，逐字如下）

`:182` 改前：

```ts
check("2.模板逐字", "模板数量", Object.keys(OUTLINE_WRITING_TEMPLATES).length, 5);
```

`:182` 改后（**语义等价**）：

```ts
check(
  "2.模板逐字",
  "既有五类齐全（总数见 2b 组）",
  Object.keys(EXPECTED_TEMPLATES).filter((key) => key in OUTLINE_WRITING_TEMPLATES).length,
  5,
);
```

- **为何必须改**：第 6 键落地后 `Object.keys(OUTLINE_WRITING_TEMPLATES).length === 6`，旧表达式必红 —— 不改则「新增模板」与「REQ-14 探针基线」二者不可同时成立。
- **为何等价**：改前判据 =「表内键数 = 5」；改后判据 =「探针内 5 个既有键**全部在表内**」⇒ 两版实测值同为 **5**、**改前改后均 PASS**，不构成基线回退。
- **为何守门不降**：旧断言的「总数」语义**原样转移**到 `2b` 第 1 条（`=== 6`），总数区间由「恰好 5」收紧为「恰好 6」。
- **位置约束**：`:182` 处**只能用** `EXPECTED_TEMPLATES`（定义于 `:129`）；`templateKeys`（`:185`）在其后，不得前向引用。
- **组 2 的其余 27 条**（25 条逐字 ＋ docx 直读 2 条）与组 3 / 4 / 5 / 6 / 7 **全部零改动**：组 2 循环按 `EXPECTED_TEMPLATES` 的 5 键（`:185`）遍历，天然不含新键。

#### 1.2-② import 块（`:26-33`）追加 2 项（按既有字母序）

```ts
import {
  CUSTOM_TEMPLATE_KEYWORDS,
  OUTLINE_WRITING_TEMPLATES,
  OUTPUT_GRADE,
  SCENARIO_WRITING_TEMPLATE,
  WRITING_RULES_TEMPLATE,
  buildWritingRules,
  resolveWritingTemplate,
  type WritingTemplate,
  type WritingTemplateKey,
} from "../../src/lib/writing-rules.ts";
```

#### 1.2-③ `renderCase`（`:321-327`）追加 1 行（`tsc` 必需）

```ts
const renderCase: Record<WritingTemplateKey, () => string> = {
  tibet_aid: () => buildWritingRules({ scenario: "custom", projectName: "援藏故事采集" }),
  enterprise_history: () => buildWritingRules({ scenario: "custom", projectName: "某公司发展史" }),
  local_chronicle: () => buildWritingRules({ scenario: "urban_memory" }),
  family_memoir: () => buildWritingRules({ scenario: "family_memory" }),
  biography: () => buildWritingRules({ scenario: "education_memory" }),
  general: () => buildWritingRules({ scenario: "custom", templateKey: "general" }),
};
```

- **必要性**：`Record<WritingTemplateKey, …>` 缺键 ⇒ `tsc --noEmit` 报对象字面量缺属性（TS2739 族），违反 §2-V2 的 0 error 口径。
- **不加断言**：组 4 的循环（`:336`）按 `templateKeys`（`EXPECTED_TEMPLATES` 的 5 键）遍历，**不遍历** `renderCase` 的键集（实测 `:336-349`）⇒ 组 4 断言数保持 20 不变。

#### 1.2-④ 文件头注释（`:1-12`）追加 1 行（组 2b 自述）

```
// 2b.通用模板    REQ-31 第 6 键（3 章默认骨架）＋ 显式键通道；既有 5 类 / 两张映射表 / mock 守门
```

#### 1.2-⑤ 新增组落点

区块插入于 `:517`（第 7 组最后一条断言 `);`）之后、`:519` 收尾 `console.log` 之前 —— 该区块只用文件顶部已 import 的符号与探针内局部量，与第 1 ~ 7 组无交叉引用。

```ts
// ---- 2b. 通用模板（REQ-31 新增 20 条）-----------------------------------
const GENERAL_KEY = "general" as const;
const generalTemplate: WritingTemplate =
  OUTLINE_WRITING_TEMPLATES[GENERAL_KEY as WritingTemplateKey];

check("2b.通用模板", "模板总数", Object.keys(OUTLINE_WRITING_TEMPLATES).length, 6);
checkTrue("2b.通用模板", "general 键存在", Boolean(generalTemplate));
check("2b.通用模板", "general.key 自洽", generalTemplate.key, GENERAL_KEY);
check("2b.通用模板", "general.name", generalTemplate.name, "通用访谈类");
check("2b.通用模板", "默认骨架章数", generalTemplate.chapters.length, 3);
checkTrue("2b.通用模板", "不强制五章", generalTemplate.chapters.length !== 5);
checkTrue(
  "2b.通用模板",
  "章标题无重复",
  new Set(generalTemplate.chapters).size === generalTemplate.chapters.length,
);
check(
  "2b.通用模板",
  "章序号顺序",
  generalTemplate.chapters.map((chapter) => chapter.slice(0, 2)),
  ["一、", "二、", "三、"],
);

check(
  "2b.显式键",
  "覆盖枚举映射",
  resolveWritingTemplate({ scenario: "family_memory", templateKey: GENERAL_KEY }).name,
  "通用访谈类",
);
check(
  "2b.显式键",
  "覆盖关键词兜底",
  resolveWritingTemplate({
    scenario: "custom",
    projectName: "某公司发展史采集",
    templateKey: GENERAL_KEY,
  }).name,
  "通用访谈类",
);
check(
  "2b.显式键",
  "既有键同样可用",
  resolveWritingTemplate({ scenario: "custom", projectName: "x", templateKey: "tibet_aid" }).name,
  "援藏故事类",
);
check(
  "2b.显式键",
  "非法键回落既有链路",
  resolveWritingTemplate({ scenario: "urban_memory", templateKey: "nope" as never }).name,
  "地方史志类",
);

const generalRules = buildWritingRules({ scenario: "custom", templateKey: GENERAL_KEY });

check("2b.通用模板", "模板名注入", generalRules.includes("本项目适用模板：通用访谈类。"), true);
checkTrue(
  "2b.通用模板",
  "3 条章标题全部注入",
  generalTemplate.chapters.every((chapter) => generalRules.includes(chapter)),
);
checkTrue("2b.通用模板", "Prompt B ≤ 2400 字符", generalRules.length <= 2400, `${generalRules.length} 字符`);
checkTrue(
  "2b.通用模板",
  "Prompt B 无 {{}} 残留",
  !generalRules.includes("{{") && !generalRules.includes("}}"),
);
checkTrue(
  "2b.通用模板",
  "章节插槽保留（规则正文未改）",
  WRITING_RULES_TEMPLATE.includes("\n{{TEMPLATE_CHAPTERS}}\n"),
);

check(
  "2b.守门",
  "场景映射未接入 general",
  (Object.values(SCENARIO_WRITING_TEMPLATE) as string[]).includes(GENERAL_KEY),
  false,
);
check(
  "2b.守门",
  "关键词兜底未接入 general",
  CUSTOM_TEMPLATE_KEYWORDS.some((entry) => (entry.key as string) === GENERAL_KEY),
  false,
);

const mockSource = readFileSync(
  new URL("../../src/lib/providers/llm/mock-llm-provider.ts", import.meta.url),
  "utf8",
);

checkTrue("2b.守门", "mock 未接显式键（源码级）", !mockSource.includes("templateKey"));
```

> 计数核对：`2b.通用模板` **13 条**（总数 / general 键存在 / key 自洽 / name / 默认骨架章数 / 不强制五章 / 章标题无重复 / 章序号顺序 / 模板名注入 / 3 条章标题全部注入 / ≤2400 字符 / 无 `{{}}` 残留 / 章节插槽保留）＋ `2b.显式键` **4 条** ＋ `2b.守门` **3 条** = **20 条**。

#### 1.2-⑥ 20 条新断言明细（实际值 / 期望 / 变异即红）

| # | 组 · 名称 | 实际值（改后） | 期望 | 变异即红（示例） |
| --- | --- | --- | --- | --- |
| 1 | `2b.通用模板` · 模板总数 | `Object.keys(OUTLINE_WRITING_TEMPLATES).length` | `6` | 多塞第 7 键 / 新键未注册（承接 `:182` 的总数守门） |
| 2 | `2b.通用模板` · general 键存在 | `Boolean(OUTLINE_WRITING_TEMPLATES["general"])` | `true` | hunk-3 未落地 |
| 3 | `2b.通用模板` · general.key 自洽 | `generalTemplate.key` | `"general"` | 键名与对象内 `key` 不一致 |
| 4 | `2b.通用模板` · general.name | `generalTemplate.name` | `"通用访谈类"` | 改名（组 4 同形断言亦红） |
| 5 | `2b.通用模板` · 默认骨架章数 | `generalTemplate.chapters.length` | `3` | 骨架改成 5 章（＝退化回既有口径） |
| 6 | `2b.通用模板` · 不强制五章 | `generalTemplate.chapters.length !== 5` | `true` | 同上（形态级守门，与 #5 互补） |
| 7 | `2b.通用模板` · 章标题无重复 | `new Set(chapters).size === chapters.length` | `true` | 复制粘贴串章 |
| 8 | `2b.通用模板` · 章序号顺序 | `chapters.map((c) => c.slice(0, 2))` | `["一、","二、","三、"]` | 去掉序号 / 改「1.」形态 ⇒ 导出侧 `CHAPTER_INDEX_PATTERN`（`project-export.ts:45`）失配 |
| 9 | `2b.显式键` · 覆盖枚举映射 | `resolveWritingTemplate({ scenario: "family_memory", templateKey: "general" }).name` | `"通用访谈类"` | 显式键分支落到场景映射之后 |
| 10 | `2b.显式键` · 覆盖关键词兜底 | `resolveWritingTemplate({ scenario: "custom", projectName: "某公司发展史采集", templateKey: "general" }).name` | `"通用访谈类"` | 显式键分支落到关键词之后（同时是约束 ② 的第二重证据：关键词仍指 `enterprise_history`） |
| 11 | `2b.显式键` · 既有键同样可用 | `resolveWritingTemplate({ scenario: "custom", projectName: "x", templateKey: "tibet_aid" }).name` | `"援藏故事类"` | 通道只认新键 |
| 12 | `2b.显式键` · 非法键回落既有链路 | `resolveWritingTemplate({ scenario: "urban_memory", templateKey: "nope" as never }).name` | `"地方史志类"` | 非法键抛错 / 误落 `FALLBACK`（`:150` 既有分支被绕过） |
| 13 | `2b.通用模板` · 模板名注入 | `generalRules.includes("本项目适用模板：通用访谈类。")` | `true` | `renderTemplate` 值映射漏填 `TEMPLATE_NAME`（与 `:342` 同形） |
| 14 | `2b.通用模板` · 3 条章标题全部注入 | `chapters.every((c) => generalRules.includes(c))` | `true` | `TEMPLATE_CHAPTERS` 未 join 新骨架（与 `:343-347` 同形） |
| 15 | `2b.通用模板` · Prompt B ≤ 2400 字符 | `generalRules.length` | `<= 2400`（**实测 2026-10-13 = 1277 字符**，已回填本行） | 章标题过长（既有 5 类实测 1296 / 1305 / 1310 / 1302 / 1307） |
| 16 | `2b.通用模板` · Prompt B 无 `{{}}` 残留 | `!generalRules.includes("{{")` | `true` | 新增占位符未在 `buildWritingRules` 填充（与 `:284` 同形） |
| 17 | `2b.通用模板` · 章节插槽保留（规则正文未改） | `WRITING_RULES_TEMPLATE.includes("\n{{TEMPLATE_CHAPTERS}}\n")` | `true` | 顺手改 `:184-186` 的规则正文（约束 ①） |
| 18 | `2b.守门` · 场景映射未接入 general | `(Object.values(SCENARIO_WRITING_TEMPLATE) as string[]).includes("general")` | `false` | 把新键写进 `SCENARIO_WRITING_TEMPLATE`（约束 ②） |
| 19 | `2b.守门` · 关键词兜底未接入 general | `CUSTOM_TEMPLATE_KEYWORDS.some((e) => (e.key as string) === "general")` | `false` | 给新键加关键词（约束 ②） |
| 20 | `2b.守门` · mock 未接显式键（源码级） | `!mockSource.includes("templateKey")` | `true` | mock 内透传 `templateKey`（约束 ③） |

### 1.3 改动面统计（预期 `git diff --stat`）

| 文件 | hunk | 行数变化 | 说明 |
| --- | --- | --- | --- |
| `src/lib/writing-rules.ts` | 5 | **+29 / −1**（**净 +28**；224 → 252 行；**实测 `git diff --stat`**） | 生产代码唯一改动文件（唯一一行替换 = `WritingTemplateKey` 联合类型末行加 `| "general"`） |
| `tmp/verify/verify-req14-prompts.ts` | 5（`:182` 改写 / import / `renderCase` / 头注释 / 末尾区块） | **+102 / −1**（521 → **623 行**；**实测 `[IO.File]::ReadAllLines`**） | 断言 **116 → 136**（`2b` 组 20 条经字面计数实测：13 / 4 / 3） |
| `src/lib/providers/llm/mock-llm-provider.ts` | **0** | 0 | 约束 ③；`git diff` 必须为空 |
| `src/lib/server/project-export.ts`、`src/lib/interview-prompt.ts`、`src/lib/oral-history.ts`、`src/lib/types/project.ts`、`src/lib/server/project-store.ts`、`src/app/api/**`、`src/components/**`、`storage/**`、`.next*` | **0** | 0 | §0.3-⑧⑨⑫ / §0.4 |

### 1.4 可达性与不变性（本单后的事实边界）

| # | 面 | 本单后的事实 |
| --- | --- | --- |
| ① | 函数级可达 | `resolveWritingTemplate({ …, templateKey: "general" })` / `buildWritingRules({ …, templateKey: "general" })` 可达（纯函数，无 IO） |
| ② | 项目链路可达性 | `buildWritingRulesForProject(project)`（`:212-224`）仍只取 `projectName` / `customScenarioLabel` / `collectionScenario` / `researchFocus` ⇒ **UI 与服务端链路本期拿不到新模板**（§0.4-Q2 / Q3，须另批） |
| ③ | mock 链路 | `mock-llm-provider.ts:260` / `:296` 均为 `resolveWritingTemplate({ scenario: input.scenario })` ⇒ 永远 5 章；`MOCK_CHAPTER_DRAFTS`（5 条）无需扩列，`?? ""` 兜底（`:262` / `:299`）亦不触发 ⇒ 约束 ③ 成立 |
| ④ | 导出链路 | `project-export.ts` 仅按「中文数字、」识别章标题 ⇒ 3 章骨架产物照常拆章 / 去序号 / 空章跳过，**无需改动**（REQ-25 31 条基线不受影响） |
| ⑤ | 既有 5 类输出 | `WRITING_RULES_TEMPLATE` 与 `buildWritingRules` 0 hunk ⇒ 5 类 Prompt B **逐字不变**（组 3 / 4 / 7 全绿） |

---

## §2 验收口径（**出口证据**：V1 主件 ＋ V2 / V3 硬指标）

### 2.1 断言总数算式

```
改前基线            116 / 116（2026-10-13 实测，exit 0）
＋ 2b 组新增          20 条（13 ＋ 4 ＋ 3，见 §1.2-⑥）
────────────────────────────────────────────
改后验收口径        136 / 136（exit 0）
```

- 既有 **116** 条构成不变：**115 条逐字零改动** ＋ `:182` **1 条表达式等价改写**（改前改后均 PASS，见 §1.2-①）。
- 组 2 ~ 组 7 的断言**条数**与**期望值**全部不变；新增只发生在 `2b` 组。
- **实测收口（2026-10-13 实施轮）**：**V1 = 136 / 136 通过 · FAIL 0 · exit 0**；V2 `tsc --noEmit` **0 error**；V3 `eslint src` **存量 6 项（1 error ＋ 5 warning）不变**（`eslint src/lib/writing-rules.ts` 单测 **0 problem / exit 0**）；V5 改动面 = 生产 **1 文件**（5 hunk）＋ 探针 **1 文件**，mock / `project-export.ts` diff **均空**；**V6 红灯先行留证** = 生产未改时 `2b.通用模板 · general 键存在` **FAIL ＋ TypeError / exit 1**；R2 = **31 / 31 PASS · FAIL 0 · exit 0**；R3 = bug05 **基线 6 FAIL 不变**；R8（非硬验收）未跑实件冒烟 —— mock 链路仍为 5 章已由 `2b` 第 20 条（源码级）＋ mock **0 hunk** 双重坐实。

### 2.2 验收矩阵

| # | 验收项 | 命令 | 通过判据 |
| --- | --- | --- | --- |
| **V1** | REQ-14 探针（**主件**） | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts`（**仓库根目录**执行） | 末行打印 `REQ-14 prompt 验收：136/136 通过`、**FAIL 0**、**exit 0** |
| **V2** | TypeScript | `npx tsc --noEmit` | **0 error**（含探针 `renderCase` 的 `Record<WritingTemplateKey, …>` 已补 `general` 键；禁以 `@ts-expect-error` / 新增 `any` 掩盖类型缺口） |
| **V3** | ESLint | `npx eslint src`（全仓口径：`npm run lint`） | **不新增**告警 / 错误（改前先跑一次记基线） |
| V4 | 输出字符数留痕 | V1 同批输出 | 打印 `[4.体积] Prompt B（…）` 既有 5 行数值 **1296 / 1305 / 1310 / 1302 / 1307 不变**；`2b` 第 15 条的 `generalRules.length` 实测值回填本单 §1.2-⑥ 第 15 行 —— **实测（2026-10-13）**：既有 5 行 **1296 / 1305 / 1310 / 1302 / 1307 逐值不变**；`generalRules.length` = **1277 字符**（≤ 2400，已回填 §1.2-⑥ 第 15 行）；Prompt A 骨架 **1232** / Prompt A 全量 **3722** 不变 |
| V5 | 改动面 | `git diff --stat` ＋ `git diff src/lib/providers/llm/mock-llm-provider.ts` | 恰 **2 个文件**（`writing-rules.ts` ＋ 探针）；mock diff **为空** |
| V6 | 红灯先行（**建议留证**） | 先落 `2b` 组、后落生产改动，分两次跑 V1 | 第一次：`2b` 组多数 FAIL（证明缺口真实存在）；第二次：136/136 ⇒ 证据链完整（不强制作硬验收） |

**命令陷阱（PS 5.1，与 BUG-13 同）**：`--experimental-strip-types` 会把 `MODULE_TYPELESS_PACKAGE_JSON` 警告写到 **stderr**，直接 `>` 重定向会被 PS 判为 `NativeCommandError` 而中断 ⇒ 用 `cmd /c "node … > %TEMP%\req14_probe.txt 2>&1"` 包一层，再读文件并核 exit code。

---

## §3 回归要求（并批必跑）

| # | 回归项 | 命令 | 判据 |
| --- | --- | --- | --- |
| **R1** | REQ-14 探针（本条主件） | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | **136 / 136 通过**、exit 0 |
| **R2** | **REQ-25 导出探针（不得回退）** | `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | **31 / 31 全 PASS / FAIL 0 / exit 0** —— 既有 **28 条零改动** ＋ BUG-13 追加 3 条（D-9 / D-10 / D-11）；本案 **0 hunk 触及 `project-export.ts`**，回退即视为实现越界 |
| **R3** | 脱敏链路 | `node --import ./tmp/verify/register-alias.mjs tmp/verify/bug05-redaction.ts` | 全绿（json / txt 口径与本案零交叉） |
| **R4** | `tsc` | `npx tsc --noEmit` | 0 error |
| **R5** | `eslint` | `npx eslint src` | 不新增告警 |
| **R6** | 逐 hunk 复核 | `git diff src/lib/writing-rules.ts` | **恰 5 hunk**；§0.3-①②③④⑤⑥ 的禁改面（既有 5 个模板块 / `WRITING_RULES_TEMPLATE` / 两张映射表 / 兜底键 / `matchCustomTemplateKey` / `renderTemplate` / `buildWritingRules` / `buildWritingRulesForProject`）**0 hunk** |
| **R7** | 工作面隔离 | `git diff --stat`；`git diff src/lib/providers/llm/mock-llm-provider.ts`；`git diff src/lib/server/project-export.ts`；`git status --short` | 生产 **1 文件** ＋ 探针 **1 文件**；mock 与 `project-export.ts` diff **均空**；`storage/**`、`src/components/**`、`src/app/api/**` 零改动 |
| R8 | 链路冒烟（建议，非硬验收） | mock 模式生成一份成文稿 → 导出 `.docx` | 仍是 5 章骨架（约束 ③ 的链路级证据；`general` 不会出现在 mock 链路，见 §1.4-③） |

---

## §4 实施顺序 · 风险 · 回滚

### 4.1 步骤序列（S0 → S6）

| 步 | 动作 | 产物 / 判据 |
| --- | --- | --- |
| S0 | **总管裁决**：本单（含 §0.4-Q1 取「默认 3 章骨架」）签发开工许可 | 裁决记录；Q2 / Q3 / Q4 明确「本批不做 / 另批」 |
| S1 | **复核基线**：`git log --oneline -1` = `42229f4`、工作区 clean；`[IO.File]::ReadAllLines` 复核 `writing-rules.ts` **224 行** / 探针 **521 行**；跑 **V1** 记 **116 / 116** | 基线证据（行号 / 行数 / 断言数三项对得上才开工） |
| S2 | 改 `src/lib/writing-rules.ts`（§1.1 五处 hunk，**+28 / −0**） | `git diff` 恰 5 hunk；224 → 252 行 |
| S3 | 改探针（§1.2-①~⑤）→ **先只跑 V1**（红灯留证） | `2b` 组多数 FAIL（V6）；既有 116 条仍全绿 |
| S4 | 跑 **V1**（主件） | `136 / 136 通过`、exit 0 |
| S5 | 跑 **R2 / R3 / R4 / R5 / R7**；**R6** 逐 hunk 复核 | 全绿；**R2 = 31 / 31 不得回退**；改动面恰 2 文件 |
| S6 | 提交（生产 ＋ 探针 ＋ 文档**同批**）→ 按 **§5.1** 回写 → 报总管 | commit hash ＋ 断言数 136/136 ＋ R2 31/31 |

**实施序纪律**：本条**不得**与 `project-export.ts`（REQ-25 / BUG-13 基线）或 mock 的任何改动合批；**不得**把 §0.4-Q2（项目级字段）/ Q3（UI 入口）顺手塞进本批。

### 4.2 风险与对策

| # | 风险 | 对策 |
| --- | --- | --- |
| ① | 顺手把 `general` 写进 `SCENARIO_WRITING_TEMPLATE` 或 `CUSTOM_TEMPLATE_KEYWORDS`（「顺手接上就好用」的诱惑） | 约束 ② ＋ 探针 `2b` 第 18 / 19 条 ＋ R6 逐 hunk |
| ② | 顺手改既有 5 套字面，或为「通用」二字改 `WRITING_RULES_TEMPLATE:184-186` | 约束 ① ＋ 组 2 的 25 条（含 docx 直读） ＋ `2b` 第 17 条 ＋ R6 |
| ③ | 类型闭环漏补：只改 union 未补 `Record`，或探针 `renderCase` 未补 `general` | V2 兜底；§1.1-hunk2/3 与 §1.2-③ 为**成对**改动，不可只做一半 |
| ④ | 断言总数从 116 变 136 被误判为「基线回退」 | §1.2-① 的等价性论证 ＋ §2.1 算式（115 零改动 ＋ 1 等价改写 ＋ 20 新增）；R2 的 31 / 31 是**另一支**探针，零回退 |
| ⑤ | 「UI 里选不到通用模板」被当成功能未完成 | §1.4-② ＋ §0.4-Q2 / Q3 明记；§2 验收面**不含 UI**（本单为「模板库 ＋ 显式通道」批次） |
| ⑥ | mock / 演示链路看不到通用模板 | §0.4-Q4 已知局限（约束 ③ 的直接后果），R8 冒烟的目的正是**确认没被改** |
| ⑦ | 3 章骨架被导出侧漏判 / 误判 | `2b` 第 8 条锁序号形态；R2 31 / 31 锁导出侧零回退 |

### 4.3 回滚

- 改动面 = 2 文件 / 6 处（生产 5 hunk ＋ 探针 5 处中的 `:182` 改写）⇒ **单 commit `git revert <commit>`** 即可回到改前形态；
- 回滚后必须**复跑 V1**确认回到 **116 / 116**，并复跑 **R2** 确认仍 **31 / 31**（回滚同样要有证据）；
- 探针的 `:182` 改写与 `2b` 组须**同批**回滚（否则会出现「旧总数断言 ＋ 第 6 键」互相矛盾的中间态）。

---

## §5 文档回写与交接

### 5.0 本单出稿轮（**已完成**）

- **新增** `docs/tasks/IMPL_REQ-31_通用模板.md`（本单，CRLF / 无 BOM，与 `docs/**` 行尾口径一致）；
- 本单为**独立出稿件**：`src` / `tmp` / `storage` **零改动**；`docs/需求登记表.md` 本轮**未代改**（避免与实施批重复改动版本号 ⇒ 统一在裁决 / 实施批同批回写，见 §5.1-①）。

### 5.1 实施轮回写清单（**必须与代码同批**）

| # | 文件 | 回写内容 |
| --- | --- | --- |
| ① | `docs/需求登记表.md` | §三 REQ-31（现 `:1078`）：状态 →「**已完成（日期，`commit`）**」；「目标范围」补**实现形态** = 新增第 6 键 `general`（`通用访谈类`，**3 章默认骨架**）＋ `WritingTemplateInput.templateKey` 显式键通道；**明记**「既有 5 套字面 / 两张映射表 / mock / 导出层 0 hunk」；「风险提示」补「锁定面解冻范围 = `OUTLINE_WRITING_TEMPLATES` **追加 1 键** ＋ `WritingTemplateInput` **追加 1 个可选键**，其余 0 hunk」；「待确认②」→「显式键通道（`templateKey`），未新增场景值 / 未加关键词」；「待确认③」→「解冻范围见上；探针断言 **116 → 136**」；「待确认①」→「取『仍给一套默认骨架』（3 章）；完全自由 / 空章另批」 |
| ② | `docs/需求登记表.md` §1.2（现 `:129`）＋ §5.1（现 `:1171`） | 两项同批同步（状态 / 优先级 / 实施序 / 断言数）；§1.2「依赖」列补「REQ-14 探针断言数 136」 |
| ③ | `docs/需求登记表.md` §5.2（现 `:1207`，REQ-31 ↔ REQ-14 / REQ-25 条） | 补：「REQ-31 已落地：`OUTLINE_WRITING_TEMPLATES` 追加第 6 键（3 章骨架）＋ 显式键通道；REQ-14 探针 **116 → 136**（既有 115 条零改动 ＋ `:182` 等价改写 ＋ `2b` 组 20 条）；`project-export.ts` **0 hunk** ⇒ REQ-25 基线 **31 / 31 无回退**」；并写明「`CHAPTER_HEADING_PATTERN` / 去序号正则的假设面**未被触碰**（新模板沿用『中文数字、』序号）」 |
| ④ | `docs/需求登记表.md` 变更记录 | 新增版本条目（下一可用版本号 **v2.17**）：本批性质（生产 1 文件 ＋ 探针 1 文件）、断言数 116 → 136、R2 = 31 / 31、commit hash；**行号锚点**按 `[IO.File]::ReadAllLines` **重新实测**（不套用历史值；§三 之前若有增行，四锚点位移须实测） |
| ⑤ | `docs/tasks/IMPL_REQ-31_通用模板.md`（本单） | 顶部状态行 →「**已完成（日期，`commit`）**」；§1.2-⑥ 第 15 行回填 `generalRules.length` 实测值；§2.2-V4 补实测输出 |
| ⑥ | `docs/系统现状与路线图.md` | **本批不动**（实测该文件无 REQ-31 命中；按 BUG-13 先例「附表属历史存档、不追改」）⇒ 待路线图整体更新时补列；若总管要求，只允许在 §4.1 表格**新增一行**，不动附表 1 本体 |
| ⑦ | `tmp/verify/verify-req14-prompts.ts` 文件头注释 | 组 2b 自述已随 §1.2-④ 落地；**不再追加第二次改动**（一项事实一个落点） |

### 5.2 明令不做（本轮与实施轮共同边界）

- 不改既有 5 套模板的 `name` / `chapters` 字面与 `WRITING_RULES_TEMPLATE` 规则正文；
- 不改 `SCENARIO_WRITING_TEMPLATE` / `CUSTOM_TEMPLATE_KEYWORDS` / `FALLBACK_WRITING_TEMPLATE_KEY` / `matchCustomTemplateKey`；
- 不改 mock、不改 `project-export.ts`、不改数据层（`types` / `project-store` / `storage` / `api`）、不改任何 UI 组件；
- 不新增 npm 依赖、不改 `package.json` / `tsconfig.json` / `eslint.config.*`；
- 不在本批处理「通用模板 UI 入口」「完全自由章节 / 空章」「mock 演示覆盖」三件事（§0.4 开口项，须总管另批）。

---

> **出单信息**：`docs/tasks/IMPL_REQ-31_通用模板.md`｜2026-10-13 出稿｜基线 HEAD `42229f4`（`master`，工作区 clean）｜上游 = `docs/需求登记表.md` §三 REQ-31（P2）＋ §5.2 `:1207`（锁定面条目）｜实施轮基线 HEAD = `408b6af`（`master`，工作区 clean）｜本单**已完成（2026-10-13，`3279536`；生产 ＋ 探针 ＋ 文档同批）**。

