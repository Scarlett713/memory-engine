# REQ-32 任务单｜通用写作模板的项目级接入（项目级字段 ＋ 服务端透传）

**执行人：** DS
**PRD：** `docs/PRD_REQ-32_项目级写作模板字段与服务端透传.md`（v1，2026-11-07）
**前置条件：** PRD 已出 ＋ **总管对 §0 四条裁决放行**
**禁止：** 不得动 `src/components/**` / `src/store/**` / `src/lib/server/project-export.ts` / `src/lib/providers/**` / `src/lib/server/process-project.ts`；不得新增模板键、场景值、关键词；不得为「让 demo 好看」改 mock

---

## 0. 开工前必须先拿到裁决（缺一条不许动 `src/`）

| Q | 问题 | PRD 推荐 | 缺省执行口径（未裁决时） |
| --- | --- | --- | --- |
| **Q1** | 是否同批覆盖 `POST /api/projects/ai-interview`（JSON 入口） | **覆盖** ⇒ 本单 6 处触点 | **按覆盖执行**（不覆盖则 AI 路径永远无法指定模板，见 PRD §4.6） |
| **Q2** | 是否给 `src/lib/server/enum.ts` 新增 `parseOptionalEnumValue` | **不新增**，route 内联 | 按「不新增」执行（不动 `enum.ts`，0 hunk） |
| **Q3** | `isWritingTemplateKey` 守卫落点 | **`writing-rules.ts` 导出** | 按 A 执行；若总管只批「不新增导出」，改放 `project-store.ts` 本地（S3-B 分支） |
| **Q4** | 非法值语义 | **静默丢弃（HTTP 201）** | 按「丢弃」执行；若裁 400，S4/S5 各加一个 400 分支 |

> Q5（是否为模板快照预立编号）/ Q6（`PATCH` 是否支持改模板）**不阻塞本单**（PRD §10 已记）。

## 1. 解冻范围（硬边界 —— 超出即停手回报）

`src/lib/writing-rules.ts` 属 **REQ-14 探针锁定面**（`tmp/verify/verify-req14-prompts.ts` 守门；REQ-25 裁决 3 / REQ-31 先例均要求先裁解冻范围）。本单**只**允许以下四处：

| # | 允许的改动 | 位置 |
| --- | --- | --- |
| ① | 删除 `WritingTemplateKey` 的本地定义，改为 `import type` + `export type { WritingTemplateKey }` | `:22-28` |
| ② | `Pick<ProjectRecord, …>` 字段集追加 `"writingTemplateKey"` | `:241-244` |
| ③ | `buildWritingRules({ … })` 调用体追加 `templateKey: project.writingTemplateKey` | `:246-251` |
| ④ | （仅当 Q3 = A）新增 `WRITING_TEMPLATE_KEYS` ＋ `isWritingTemplateKey` 两个导出 | 文件末尾或模板常量之后 |

**其余任何 hunk（含注释改写、格式化、导入重排）一律不得出现。** `OUTLINE_WRITING_TEMPLATES` 的 6 套模板字面一个字符都不许动。

---

## 2. 实施步骤（S0 → S8）

### S0 探针先行（先红后绿，留证）

**目的**：证明新断言真的在测「透传」，而不是碰巧全绿。

1. `tmp/verify/verify-req14-prompts.ts` 的 import 块（`:27-37`）追加：

```ts
import {
  CUSTOM_TEMPLATE_KEYWORDS,
  OUTLINE_WRITING_TEMPLATES,
  OUTPUT_GRADE,
  SCENARIO_WRITING_TEMPLATE,
  WRITING_RULES_TEMPLATE,
  buildWritingRules,
  buildWritingRulesForProject,      // ← 新增（该函数已存在，可立即导入）
  isWritingTemplateKey,             // ← S0 先**不要**加：函数尚不存在，ESM 链接期会直接崩溃（不是 FAIL）。
                                    //    S2 落地后再补这一行并启用两条「2c.守门」守卫断言。
  resolveWritingTemplate,
  type WritingTemplate,
  type WritingTemplateKey,
} from "../../src/lib/writing-rules.ts";
```

2. 在 `2b` 组末尾（`:619` 的 `checkTrue("2b.守门", "mock 未接显式键（源码级）", …)` 之后、`:621` 的 summary `console.log` **之前**）插入 `2c` 组：

```ts
// ---- 2c. 项目级模板键（REQ-32 新增）-------------------------------------
const chapterLines = (text: string) =>
  text.split("\n").filter((line) => /^[一二三四五六七八九十]+、/.test(line)).length;

const baseProject = {
  projectName: "某市城市记忆采集",
  customScenarioLabel: "",
  collectionScenario: "urban_memory" as const,
  researchFocus: "",
};

const keyedRules = buildWritingRulesForProject({
  ...baseProject,
  writingTemplateKey: GENERAL_KEY,
});
checkTrue("2c.项目级", "透传接通（模板名）", keyedRules.includes("本项目适用模板：通用访谈类。"));
check("2c.项目级", "章数 = 3", chapterLines(keyedRules), 3);

const plainRules = buildWritingRulesForProject(baseProject);
check("2c.项目级", "无键 = 5 章", chapterLines(plainRules), 5);
check(
  "2c.项目级",
  "无键 = 既有链路（逐字等价）",
  plainRules,
  buildWritingRules({ scenario: "urban_memory" }),
);
check(
  "2c.项目级",
  "非法键回落（与无键逐字相同）",
  buildWritingRulesForProject({ ...baseProject, writingTemplateKey: "nope" as never }),
  plainRules,
);
checkTrue(
  "2c.项目级",
  "显式键压过关键词兜底",
  buildWritingRulesForProject({
    projectName: "某公司发展史采集",
    customScenarioLabel: "",
    collectionScenario: "custom",
    researchFocus: "",
    writingTemplateKey: GENERAL_KEY,
  }).includes("本项目适用模板：通用访谈类。"),
);

checkTrue("2c.守门", "守卫识别 general", isWritingTemplateKey("general"));
checkTrue(
  "2c.守门",
  "守卫拒绝非法 / 空 / null",
  !isWritingTemplateKey("nope") && !isWritingTemplateKey("") && !isWritingTemplateKey(null),
);

const storeSource = readFileSync(
  new URL("../../src/lib/server/project-store.ts", import.meta.url),
  "utf8",
);
checkTrue(
  "2c.守门",
  "归一化未补默认模板",
  !/writingTemplateKey\s*\|\|/.test(storeSource),
);
```

3. **先跑一次**（改 `src` 之前）：

```
node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts
```

期望：**FAIL + exit 1**（`2c.项目级` 至少「透传接通」「章数 = 3」两条红 —— 因为 `Pick` 还没有键、`templateKey` 也没递进去）。**把这段红字与 exit code 留档**（REQ-31 的留证惯例），再往下做。

> 注：`2c` 组里用到的 `GENERAL_KEY` 沿用探针既有写法（若文件内已有 `"general"` 常量则复用，没有就 `const GENERAL_KEY = "general" as const;`）。

### S1 `src/lib/types/project.ts` —— 类型下移 ＋ 新增字段

1. 在 `ExpectedOutput` / `InterviewOccasion` 一带（`:152-160` 附近）、**`ProjectRecord` 定义之前**新增：

```ts
export type WritingTemplateKey =
  | "tibet_aid"
  | "local_chronicle"
  | "enterprise_history"
  | "biography"
  | "family_memoir"
  | "general";
```

> 6 个键**逐字搬自** `writing-rules.ts:22-28`，顺序也保持一致（便于人工比对 diff）。

2. `ProjectRecord`（`:161-213`）可选字段区（`:206-211` 一带）追加：

```ts
/** REQ-32：项目级写作模板键，仅建项时写入；缺省 = 不存在该键（走既有场景派生） */
writingTemplateKey?: WritingTemplateKey;
```

**禁止**：在本文件里 `import type { WritingTemplateKey } from "@/lib/writing-rules"`（反向依赖 ⇒ 类型循环，PRD §4.3 / R1）。

### S2 `src/lib/writing-rules.ts` —— 四处解冻，一步都不许多

| 位 | 改法 |
| --- | --- |
| ① `:14` | `import type { InterviewScenario, ProjectRecord, WritingTemplateKey } from "@/lib/types/project";` |
| ① `:22-28` | 删除本地 6 值联合定义 |
| ① 删完位置 | 补 `export type { WritingTemplateKey };`（`isolatedModules: true` 下重新导出类型必须用 `export type`） |
| ② `:241-244` | `Pick<ProjectRecord, "projectName" | "customScenarioLabel" | "collectionScenario" | "researchFocus">` → 末尾追加 `| "writingTemplateKey"` |
| ③ `:246-251` | `buildWritingRules({ … })` 入参追加 `templateKey: project.writingTemplateKey,` |
| ④（Q3=A） | 文件末尾新增下方两个导出 |

```ts
/** REQ-32：模板键的唯一真值源（由 OUTLINE_WRITING_TEMPLATES 派生，避免第二份白名单） */
export const WRITING_TEMPLATE_KEYS = Object.keys(
  OUTLINE_WRITING_TEMPLATES,
) as WritingTemplateKey[];

export function isWritingTemplateKey(value: unknown): value is WritingTemplateKey {
  return (
    typeof value === "string" &&
    (WRITING_TEMPLATE_KEYS as readonly string[]).includes(value)
  );
}
```

> 若只批 1 个新导出，则内联白名单、只导出 `isWritingTemplateKey`，并在交付说明里注明「白名单来自 `OUTLINE_WRITING_TEMPLATES` 的 `Object.keys`，未复制字面量」。

**出口检查**：`npx tsc --noEmit` = 0 error；`git diff src/lib/writing-rules.ts` 只有上表四处。

### S3 `src/lib/server/project-store.ts` —— 入参 / 字面量 / 归一化

1. `CreateProjectInput`（`:25-46`）追加：

```ts
writingTemplateKey?: WritingTemplateKey;
```

（`types/project` 的 import（`:8-23`）按字母序补 `WritingTemplateKey`。）

2. `createProject` 对象字面量（`:228-278`）追加一行（**透传，不写默认值**）：

```ts
writingTemplateKey: input.writingTemplateKey,
```

> `undefined` 会被 `JSON.stringify` 丢弃 ⇒ 不传就不落键，符合 AC-4 / AC-5。

3. `normalizeProjectRecord`（`:67-153`）追加守卫，**写到 `return` 的对象字面量里**：

```ts
// A（Q3=A，守卫从 lib 导入）
writingTemplateKey: isWritingTemplateKey(project.writingTemplateKey)
  ? project.writingTemplateKey
  : undefined,
```

```ts
// B（Q3=本地守卫，0 新导出）
...(isWritingTemplateKey(project.writingTemplateKey)
  ? { writingTemplateKey: project.writingTemplateKey }
  : {}),
```

B 分支需在本文件顶部加本地守卫（白名单从 `OUTLINE_WRITING_TEMPLATES` 派生，**不要手写 6 个字面量**）：

```ts
const TEMPLATE_KEY_SET: ReadonlySet<string> = new Set(Object.keys(OUTLINE_WRITING_TEMPLATES));
const isWritingTemplateKey = (v: unknown): v is WritingTemplateKey =>
  typeof v === "string" && TEMPLATE_KEY_SET.has(v);
```

**硬禁令**：任何形式的 `|| "biography"` / `?? "biography"` —— 会把全库存量项目**写回并永久锁死**为 biography（PRD §4.5 / R2）。

### S4 `src/app/api/projects/route.ts` —— 上传入口（FormData）

1. 枚举解析段之后（`:131-133` `customRedactionRules` 之后、`:135` 的 `if (!file …)` 之前）插入：

```ts
const rawWritingTemplateKey = formData.get("writingTemplateKey");
const writingTemplateKey = isWritingTemplateKey(rawWritingTemplateKey)
  ? rawWritingTemplateKey
  : undefined;
```

> 守卫入参是 `unknown`，`formData.get` 返回的 `File` / `null` 会被 `typeof === "string"` 拦掉，无需额外判断。

2. `createProject({ … })`（`:181` 起）入参追加：

```ts
writingTemplateKey,
```

**不动**：`formData()` 的 try/catch（BUG-11）、`:135-152` 的 400 分支、`NOTES_MAX_LENGTH` 截断、`:189` 起的外层 catch（BUG-12）。

### S5 `src/app/api/projects/ai-interview/route.ts` —— AI 访谈入口（JSON）

1. `AiInterviewRequest`（`:37-50`）追加：

```ts
writingTemplateKey?: unknown;
```

2. 枚举解析段之后（`:120-124` 之后）插入：

```ts
const writingTemplateKey = isWritingTemplateKey(payload.writingTemplateKey)
  ? payload.writingTemplateKey
  : undefined;
```

> **不要再套 `toEnumInput`**（`:56-58`）：那是给 `parseEnumValue` 收窄 `FormDataEntryValue` 用的；守卫本身接受 `unknown`，多套一层只会把「非字符串」判两次。

3. `createProject({ … })`（`:151` 起）入参追加：

```ts
writingTemplateKey,
```

**不动**：提纲必填校验（`:140-142`）、custom 场景校验（`:144-149`）、二次写 workflow（`:183` 起）。

### S6 回归（四项同屏）

```powershell
npx tsx tmp/verify/verify-req14-prompts.ts      # 期望 ≥136 / 0 failed / exit 0
npx tsx tmp/verify-req25-export-format.mjs      # 期望 31 / 31
npx tsc --noEmit                                # 期望 0 error
npx eslint src                                  # 期望存量 6 项，不新增
```

补两项手工（无脚本）：

- **AC-2**：`POST /api/projects`（multipart，带 `writingTemplateKey=general`）⇒ 201，`storage/projects.json` 新记录含 `"writingTemplateKey": "general"`；
- **AC-4**：同接口带 `writingTemplateKey=nope` ⇒ 201，记录里**没有**该键；
- **AC-9**：该 `general` 项目跑一次整理 → 导出 `.docx`，确认 3 个章标题都被识别为章（无跳章）。若失败：**停手回报**，不得改 `project-export.ts`。

### S7 文档回写

`docs/需求登记表.md`：

1. §1.2 总表 REQ-32 行：状态 / 优先级 / 触点列改「已交付（待验收）」，触点写 **6 处**（原记 5 处，`process-project.ts` 实为 0 hunk，补 `ai-interview` 入口）；
2. §5.1 触点表：按 PRD §6 的 6 文件重列，并加一行「`process-project.ts:93` —— **0 hunk**（探针 `:526` 硬断言）」；
3. §5.2 验证记录：追加 S6 四条命令的实际输出摘要（计数 + exit code）；
4. 修订记录：版本号 +1，注明「REQ-32 落地；触点 5→6 修正；AC-9 实件结论」。

### S8 git（两笔，便于回滚）

```powershell
git add -A
git commit -m "feat(req-32): 项目级写作模板键 writingTemplateKey 与服务端透传"
```

- 第 1 笔：`src/**` 五文件（S1–S5，含探针 `2c` 组）；
- 第 2 笔：`docs/需求登记表.md`（S7 回写）。

> 若 S0 的「红」留档要求进仓库，则第 1 笔前单独提交一次探针（`test(req-32): 2c 组先行（当前应为红）`），共 3 笔。

---

## 3. 0 hunk 清单（交付时须能证明「未改」）

| 文件 | 证明方式 |
| --- | --- |
| `src/lib/server/process-project.ts` | `git diff --stat` 不含该文件；探针 `:526` 仍绿 |
| `src/lib/providers/llm/ark-llm-provider.ts` | `git diff` 为空；探针 `:517-522` 仍绿 |
| `src/lib/providers/llm/mock-llm-provider.ts` | `git diff` 为空；探针 `:619` 仍绿（**给 mock 接键会直接红**） |
| `src/lib/server/project-export.ts` | `git diff` 为空；`verify-req25-export-format.mjs` 31 / 31 |
| `src/app/api/projects/[projectId]/route.ts` | `git diff` 为空（`PATCH` 仍只做状态机） |
| `src/components/**`、`src/store/**` | `git diff --stat` 不含 |
| `src/lib/server/enum.ts` | 仅当 Q2 裁「新增 `parseOptionalEnumValue`」才允许改；否则 0 hunk |
| `storage/projects.json` | 除手工验收产生的测试记录外，无批量改写 |

## 4. 交付物

1. 代码 diff（5 文件）+ 探针 `2c` 组新增块；
2. S0 红 / S6 绿 的**同屏证据**（命令 + 计数 + exit code）；
3. AC-9 导出实件截图或 docx 章标题清单；
4. 登记表回写 diff；
5. 一段「偏差说明」：若最终裁决与 PRD 推荐不同（Q1 不覆盖 / Q3 本地守卫 / Q4 改 400），逐条写明改了哪里、影响哪条 AC。

## 5. 待 DS 扫描确认（本单未能离线证实的点）

| # | 点 | 影响 |
| --- | --- | --- |
| 1 | 「`WritingTemplateKey` 在 `src/**` 无外部引用」为 2026-11-07 本机检索结论，落地前请 `rg -n "WritingTemplateKey" src` 复核 | 若不成立，S1/S2 的类型下移会牵出额外 hunk ⇒ **停手回报** |
| 2 | 导出侧章标题识别口径（登记表记 `project-export.ts:186-216` 一带）未逐行核实 | 只影响 AC-9 的判定阈值，不影响代码改动 |
| 3 | 既有探测脚本的**精确启动命令**（`tsx` 直跑 vs `--experimental-strip-types` + alias 注册）请按仓库 `package.json` / `tmp` 既有用法执行 | 只影响命令写法，不影响断言本身 |


