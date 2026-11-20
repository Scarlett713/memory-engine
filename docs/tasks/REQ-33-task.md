# REQ-33 任务单 · 建项 UI 写作模板选择入口

- 执行人：**DS**（本单由 Cline 出稿，**Cline 不碰 `src/`**；2026-11-20）
- 上游（口径唯一来源）：`docs/PRD_REQ-33_建项UI写作模板选择入口.md` —— **D1~D7 / C1~C8 / AC-1~AC-12 全部以 PRD 为准**，本单只把它拆成可执行步骤
- 前置：总管放行本 PRD；基线 `HEAD = 66159c4`；工作区未跟踪项仅 `_delivery/` 与交付包 zip
- 状态：**待实施**（实施完成 → 按 §6 回报格式回报总管验收）
- 规模：**`src` 1 新增 ＋ 3 修改，≈ +78 / −3**；`src/app/**`、`src/lib/**`、`storage/**`、`globals.css` **0 hunk**
- 行号基线（2026-11-20 实测）：`interview-upload-form.tsx` **1356** · `new-project-flow.tsx` **324** · `project-workspace.ts` **160** · `writing-rules.ts` **267** · `types/project.ts` **261** · `outline-plan-workspace.tsx` **1046**
- 探针基线（2026-11-20 实测）：`verify-req14-prompts` **145/145 exit 0** · `verify-req25-export-format` **31/31 exit 0** · `verify-ui33-format-guard` **9/10 exit 1（预存红，见 S6）** · `verify-phase3` 上次 **42/42** · `cdp-ui06-consent-copy` 上次 **52/52**

---

## 0. 纪律（先读，再看代码）

### 0.1 定位优先：不按行号跳转

```powershell
# 复核四类锚点是否存在、当前行号是多少（只读）
Select-String -LiteralPath 'src\components\upload\interview-upload-form.tsx' -Pattern 'const \[language, setLanguage\] = useState\("cn"\);|\{step === 3 \? \(|const project = await createProject\(\{' | ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }
Select-String -LiteralPath 'src\components\new-project\new-project-flow.tsx' -Pattern 'const \[outlineError, setOutlineError\]|<OutlinePlanWorkspace|body: JSON.stringify\(\{' | ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }
Select-String -LiteralPath 'src\store\project-workspace.ts' -Pattern 'type CreateProjectPayload|formData.set\("language"' | ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }
```

行号与 PRD §2 不符时：**按文本锚点走，不按行号**（`src` 一旦有其他批次在途，行号必漂）。

### 0.2 改动纪律

- **一次一个 hunk**：每处改完立刻 `git diff -U2 -- <file>` 自查，确认只动了该处。
- **注释写「为什么」**：本仓风格是「注释解释决策、不描述代码」（见 `interview-upload-form.tsx:704`、`new-project-flow.tsx:263`）。PRD §3 里的注释可逐字照抄。
- **不新增依赖 / 不改 `package.json` / 不动 `globals.css`**。
- **`src/lib/**` 一行都不改**：需要的东西（`OUTLINE_WRITING_TEMPLATES`、`WRITING_TEMPLATE_KEYS`、`WritingTemplateKey`）全部现成。
- **不得**把 `writingTemplateKey` 塞进 URL / `sessionStorage` / 提纲草稿（C7、N4）。

### 0.3 禁改清单（违反即返工）

| 路径 | 理由 |
| --- | --- |
| `src/app/api/**` | 服务端 0 改动（D2）；改了就破 REQ-32 验收面 |
| `src/lib/**`（含 `writing-rules.ts` / `types/project.ts` / `server/**`） | 常量与白名单唯一真值源；改了连带 REQ-14 / REQ-25 / REQ-32 探针 |
| `src/components/outline/outline-plan-workspace.tsx` | C6；被 REQ-36 / UI-24 / UI-32 探针钉住 |
| `globals.css` | 复用既有类，零新增 |
| `BasicInfoForm` / `RouteChooser` / 上传第 1、2 步 | 模板与步骤顺序无关；放进第 1/2 步违反 C3 |
| `storage/**` | 验收只用临时目录（S5 已隔离） |

### 0.4 探针纪律

- **先红后绿**：S0 的静态探针必须在改 `src` **之前**落盘并跑到红，改完再跑到全绿 —— 否则无法证明「缺口真实、修复有效」（本仓惯例，见 REQ-31 / UI-33 报告）。
- `tmp/**` 已被 `.gitignore` 屏蔽：探针改动**不入 commit**。
- `tmp/verify-ui33-format-guard.mjs` 的 G10 **是预存红**（S6 详述），**不得**为了让它变绿去改 `src` 结构。

---

## 1. 解冻范围（5 个 hunk / 4 个文件）

| 代号 | 文件 | 动作 | 对应 PRD |
| --- | --- | --- | --- |
| **H1** | `src/components/ui/writing-template-select.tsx` | **新增**（≈52 行） | §2.1 / §3.1 |
| **H2** | `src/store/project-workspace.ts` | 3 处（类型 import / payload 字段 / FormData 分支） | §2.3 / §3.3 |
| **H3** | `src/components/upload/interview-upload-form.tsx` | 4 处（import / state / JSX / payload） | §2.2 / §3.2 |
| **H4** | `src/components/new-project/new-project-flow.tsx` | 4 处（import / state / JSX / body） | §2.4 / §3.4 |
| **H5** | `tmp/verify-req33-template-select.mjs` | 新增静态探针（gitignored） | S0 |

> 不含「删文件 / 改接口 / 改 props 签名」—— `OutlinePlanWorkspace` 的 props 一个都不动。


## 2. 分步执行

### S0（**先做**）落静态探针 `tmp/verify-req33-template-select.mjs`

改 `src` 之前先写探针并跑到「红」，用来证明缺口真实存在。逐字照抄：

```js
// REQ-33 静态探针：建项 UI 写作模板选择入口。零依赖、不需要 dev server。
//
// 运行：node tmp/verify-req33-template-select.mjs
// 纪律：先红后绿 —— 改 src 前应有多条 FAIL（缺文件 / 缺控件），改完应 10/10 PASS。
// 守门项 ↔ PRD：K1~K5 功能面（§6 AC-1~AC-6）、K6/K9 约束面（§0.3 C1/C2/C7）、
//               K7 id 前缀（C4）、K8 零改动面（D2 / AC-9 / AC-10）、K10 落点（AC-1）。
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CONTROL = "src/components/ui/writing-template-select.tsx";
const UPLOAD = "src/components/upload/interview-upload-form.tsx";
const FLOW = "src/components/new-project/new-project-flow.tsx";
const STORE = "src/store/project-workspace.ts";

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const count = (t, n) => (n ? t.split(n).length - 1 : 0);
const git = (args) => {
  try {
    return execSync(`git ${args}`, { encoding: "utf8" }).trim();
  } catch (error) {
    return `ERR:${error.message}`;
  }
};

const control = read(CONTROL);
const upload = read(UPLOAD);
const flow = read(FLOW);
const store = read(STORE);

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

// K1 新控件：选项必须由 WRITING_TEMPLATE_KEYS 派生，缺省项必须存在（C2）
check(
  "K1 控件存在，选项由 WRITING_TEMPLATE_KEYS.map 派生且含缺省项",
  control.includes("WRITING_TEMPLATE_KEYS.map(") &&
    control.includes("OUTLINE_WRITING_TEMPLATES[key]") &&
    control.includes('NO_WRITING_TEMPLATE_LABEL = "不套模板（自由输出）"') &&
    control.includes('<option value="">'),
  `file=${existsSync(CONTROL)}`,
);

// K2 两入口各渲染一次（D3 / AC-1 / AC-2）
check(
  "K2 上传 / AI 两入口各渲染一次 <WritingTemplateSelect",
  count(upload, "<WritingTemplateSelect") === 1 && count(flow, "<WritingTemplateSelect") === 1,
  `upload=${count(upload, "<WritingTemplateSelect")} flow=${count(flow, "<WritingTemplateSelect")}`,
);

// K3 两处 state 初值均为空串，且不从存储读回（C7）
const stateRe = /useState<WritingTemplateSelection>\(""\)/;
check(
  "K3 两处 state 初值均为空串",
  stateRe.test(upload) && stateRe.test(flow),
  `upload=${stateRe.test(upload)} flow=${stateRe.test(flow)}`,
);

// K4 两处 payload 都用条件展开：缺省不发键、绝不发空串（C1 / AC-4）
const spread = "...(writingTemplateKey ? { writingTemplateKey } : {})";
check(
  "K4 上传 payload 与 AI body 均用条件展开",
  count(upload, spread) === 1 && count(flow, spread) === 1,
  `upload=${count(upload, spread)} flow=${count(flow, spread)}`,
);

// K5 store 必须有值才写 FormData（C1）
check(
  "K5 store 用 if (payload.writingTemplateKey) 守卫后 set",
  store.includes("if (payload.writingTemplateKey) {") &&
    store.includes('formData.set("writingTemplateKey", payload.writingTemplateKey);'),
  "guard literal missing",
);

// K6 控件内不得手写 6 键 / 6 中文名（C2 单一真值源）
const KEYS = [
  "tibet_aid",
  "local_chronicle",
  "enterprise_history",
  "biography",
  "family_memoir",
  "general",
];
const NAMES = [
  "援藏故事类",
  "地方史志类",
  "企业发展史类",
  "人物传记类",
  "家族回忆录类",
  "通用访谈类",
];
const handKeys = KEYS.filter((key) => count(control, `"${key}"`) > 0);
const handNames = NAMES.filter((name) => count(control, name) > 0);
check(
  "K6 控件内无手写键名 / 中文名",
  handKeys.length === 0 && handNames.length === 0,
  `keys=${handKeys.join(",") || "-"} names=${handNames.join(",") || "-"}`,
);

// K7 id 不得以 outline- 开头（cdp-ui24-fixes.mjs:193-208 会全量填充；C4）
check(
  "K7 两处 id 逐字且非 outline- 前缀",
  upload.includes('id="writingTemplateKey"') &&
    flow.includes('id="writing-template-key"') &&
    !/id="outline-[^"]*"/.test(control),
  "id literal missing",
);

// K8 服务端 / 常量层零改动（D2 / AC-9 / AC-10）
const numstat = git("diff --numstat -- src/app/api src/lib");
const untracked = git("status --porcelain -- src/app/api src/lib");
check(
  "K8 src/app/api 与 src/lib 零改动",
  numstat === "" && untracked === "",
  `numstat=${JSON.stringify(numstat)} untracked=${JSON.stringify(untracked)}`,
);

// K9 控件必须无状态、无副作用（C7）
check(
  "K9 控件不含 use client / useState / useEffect / sessionStorage",
  !/use client|useState|useEffect|sessionStorage/.test(control),
  "state or side-effect literal found",
);

// K10 上传入口落点：step===3 区块内、语言字段之后、音频卡之前（AC-1）
const step3Idx = upload.indexOf("{step === 3 ? (");
const widgetIdx = upload.indexOf("<WritingTemplateSelect");
const audioCardIdx = upload.indexOf("surface-card", widgetIdx);
check(
  "K10 上传入口控件在 step===3 区块内且位于音频卡之前",
  step3Idx !== -1 && widgetIdx > step3Idx && audioCardIdx > widgetIdx,
  `step3=${step3Idx} widget=${widgetIdx} audioCard=${audioCardIdx}`,
);

const failed = results.filter((result) => !result.pass);
console.log(`\nREQ-33 静态探针：${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  console.log("failed: " + failed.map((item) => item.name).join(" | "));
}
process.exitCode = failed.length ? 1 : 0;
```

跑一次确认是红的。**2026-11-20 Cline 在 HEAD（未实施）实测：3/10 通过、exit=1** —— FAIL = K1 / K2 / K3 / K4 / K5 / K7 / K10；PASS = K6 / K8 / K9（这三项是「空文件不含禁词」的假绿，实施后才有意义）：

```powershell
node tmp/verify-req33-template-select.mjs; "exit=$LASTEXITCODE"
```

### S1 · H1 新建共用控件

**文件**：`src/components/ui/writing-template-select.tsx`（新文件，≈52 行）
**依据**：PRD §2.1 / §3.1（**逐字照抄，不要改写注释**）

要点自检：

- 无 `"use client"` —— 不传 `onChange` 的 `onChange={...}` 是 DOM 事件属性，属性名小写，控件自身不持有事件处理器常量，**不需要**客户端指令（本仓 `select` 只在带 `useState` 的宿主里出现，控件本身是纯受控元素）。
- `framed` 必须带 `shrink-0` —— 宿主 `#new-step-outline`（`new-project-flow.tsx:280-283`）是 `flex flex-col`、工作台根节点（`outline-plan-workspace.tsx:489`）是 `flex-1`；漏了就压扁。
- `onChange={(event) => onChange(event.target.value as WritingTemplateSelection)}` —— 受控，宿主给值、宿主收值。
- 默认项 `<option value="">` 必须**第一个**（AC-3 断言顺序）。
- 选项文本 = `template.name`；`（n 章）` 与 `title` 都必须算出来，不许手写。

改完立刻自查：

```powershell
npx tsc --noEmit
node tmp/verify-req33-template-select.mjs; "exit=$LASTEXITCODE"   # 预期只剩 K2/K3/K4/K5/K7/K10 红
```

### S2 · H2 `src/store/project-workspace.ts`（3 处）

| # | 锚点（基线行号） | 动作 |
| --- | --- | --- |
| S-1 | `import type {`（`:5`）… `RedactionRule,`（`:11`） | 清单里加 `WritingTemplateKey,`（保持字母序：`PrivacyLevel` 之后、`RedactionRule` 之前 —— 以实际相邻项为准） |
| S-2 | `type CreateProjectPayload = {`（`:14`）… `language: string;`（`:28`） | 其后加可选字段 ＋ 注释（PRD §3.3） |
| S-3 | `formData.set("language", payload.language \|\| "cn");`（`:94`） | 其后加 3 行守卫（PRD §3.3） |

**为什么必须「有值才 set」**（C1）：`CreateProjectPayload` 会被 `if (value)` 式循环写进 FormData 吗？**不会** —— 本仓是逐字段手写 `formData.set`。因此缺省时**根本不会出现该键**，服务端 `formData.get("writingTemplateKey")` 得 `null` → `undefined`，走场景派生。这就是「51 个项目里 50 个不被打乱」的技术原因。

自查：

```powershell
git --no-pager diff -U3 -- src/store/project-workspace.ts
node tmp/verify-req33-template-select.mjs; "exit=$LASTEXITCODE"   # K5 应变绿
```

### S3 · H3 `src/components/upload/interview-upload-form.tsx`（4 处）

| # | 锚点（基线行号） | 动作 |
| --- | --- | --- |
| U-1 | `import { Button } from "@/components/ui/button";`（`:25`） | 其后加控件 import（`@/components/ui/*` 组内，`button` 之后） |
| U-2 | `const [language, setLanguage] = useState("cn");`（`:548`） | 其后加 state（初值 `""`） |
| U-3 | `{step === 3 ? (`（`:1209`）区块内：语言字段 `</div>`（`:1227`）之后、音频卡 `surface-card flex flex-col`（`:1229`）之前 | 插入 `<WritingTemplateSelect id="writingTemplateKey" … />` |
| U-4 | `language,`（`:746`，`createProject({ … })` 的最后一个字段） | 其后加条件展开 |

**为什么落在第 3 步**（C3）：`flowMode`（`hasOutlineFlag && draftReady`，`:496`）为真时 `step` 初值直接 `3`、且第 1/2 步**根本不渲染**（`:501-507`）；把控件放第 1/2 步则分流用户永远看不到。放第 3 步两条路径都覆盖（旧版向导 `draftReady ? 2 : 1` 起手，点「下一步」同样会到第 3 步）—— 这是 AC-1 要求「两条路径都可见」的原因。

**缩进**：U-3 的父级是 `<div className="soft-scroll space-y-4 …">`（`:884`）→ 第 3 步是 `<Fragment>` 的兄弟，控件与相邻节点同为 **12 空格**缩进；`space-y-4` 会自动给间距，**不要**再写 `mt-*`。

自查：

```powershell
git --no-pager diff -U2 -- src/components/upload/interview-upload-form.tsx
node tmp/verify-req33-template-select.mjs; "exit=$LASTEXITCODE"   # K3/K7/K10 应变绿
```

### S4 · H4 `src/components/new-project/new-project-flow.tsx`（4 处）

| # | 锚点（基线行号） | 动作 |
| --- | --- | --- |
| A-1 | `import { OutlinePlanWorkspace } from "@/components/outline/outline-plan-workspace";`（`:12`） | 其后加控件 import |
| A-2 | `const [outlineError, setOutlineError] = useState("");`（`:67`） | 其后加 state（初值 `""`） |
| A-3 | `{step === "outline" ? (`（`:279`）内：`embedded` 注释两行（`:284-285`）之后、`<OutlinePlanWorkspace`（`:286`）之前 | 插入 `<WritingTemplateSelect framed … />` |
| A-4 | `outlineDraftMarkdown: markdown,`（`:184`） | 其后加条件展开 |

**为什么带 `framed`**：提纲步没有「字段组」容器，控件裸放会与工作台视觉粘连；`framed` 只叠 `surface-card`（`globals.css:182-186`，无 `backdrop-filter`）。**绝不能**用 `paper-panel`（C5：`backdrop-filter` 会给 `fixed` 定位后代造包含块，把提纲步底部输入条顶出视口 —— `verify-phase2.mjs:258-271` 就是抓这个）。

**为什么在 `<OutlinePlanWorkspace>` 之外**（C6）：工作台内部有 `soft-scroll` 滚动区与 `fixed` 输入条；控件放进 props 就得改它的签名（`outline-plan-workspace.tsx` 一行不能动）。放容器侧零侵入。

自查：

```powershell
git --no-pager diff -U2 -- src/components/new-project/new-project-flow.tsx
node tmp/verify-req33-template-select.mjs; "exit=$LASTEXITCODE"   # 预期 10/10
```


### S5 · 离线自检（不需要 dev server）

```powershell
# 1) 类型
npx tsc --noEmit

# 2) 只 lint 改过的四个文件（避免把存量告警当新问题）
npx eslint src/components/ui/writing-template-select.tsx src/components/upload/interview-upload-form.tsx src/components/new-project/new-project-flow.tsx src/store/project-workspace.ts

# 3) 静态探针：应 10/10
node tmp/verify-req33-template-select.mjs; "exit=$LASTEXITCODE"

# 4) 只应改 4 个 src 文件
git --no-pager diff --numstat -- src
```

**AC-8（写作规则真吃到键）离线复现**：新建 `tmp/verify-req33-rule.mjs`，逐字：

```js
// REQ-33 AC-8：显式 writingTemplateKey 必须压过场景派生，且章标题逐字进规则。
const { buildWritingRulesForProject } = await import("../src/lib/writing-rules.ts");

const text = buildWritingRulesForProject({
  projectName: "探针项目",
  customScenarioLabel: "",
  collectionScenario: "urban_memory",
  researchFocus: "",
  writingTemplateKey: "general",
});

console.log(text.includes("本项目适用模板：通用访谈类。") ? "AC8-a PASS" : "AC8-a FAIL");
console.log(text.includes("一、生平履历与成长背景") ? "AC8-b FAIL" : "AC8-b PASS");
console.log(text.includes("三、认识、评价与展望") ? "AC8-c PASS" : "AC8-c FAIL");
```

```powershell
node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify-req33-rule.mjs; "exit=$LASTEXITCODE"
```

> 2026-11-20 **Cline 已实测该命令链路可用**（`AC8-a/b/c` 三条均 PASS、`exit=0`）：`urban_memory` 派生本应是 `local_chronicle`（5 章），显式 `general` 后规则里出现 3 章标题、且**不出现** `biography` 的「一、生平履历与成长背景」—— 这正是「显式键压过派生」的证据（AC-7 / AC-8 同源）。

### S6 · 探针回归（哪些必须绿、哪些本来就是红）

| 探针 / 命令 | 期望 | 备注 |
| --- | --- | --- |
| `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | **145/145 · exit 0** | `writing-rules.ts` 0 hunk；若掉分说明误改了常量 |
| `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | **31/31 · exit 0** | 导出层 0 hunk |
| `node tmp/verify-req33-template-select.mjs` | **10/10 · exit 0** | 本批新增 |
| `node tmp/verify-ui33-format-guard.mjs` | **9/10 · exit 1（预存红，G10）** | **红线在 HEAD 就存在**：G10 断言 `git diff` 的 hunk 数 === 3，而 HEAD 已提交 ⇒ diff 恒空。**不修、不计门禁**；若要复跑，先按 UI-33 报告重设 G10 基线 |
| `node tmp/verify-phase3.mjs`（需 `npm run dev` ＋ Chrome 9222） | 42/42 | 建议整跑一次（它覆盖上传建项主链路） |
| `node tmp/cdp-ui06-consent-copy.mjs`（同上） | 52/52 | 只数复选框与按钮文案 |
| `node tmp/verify-phase2.mjs`（同上） | 全绿 | 两条硬判据：提纲步祖先链无 `backdrop-filter`、`.fixed` 输入条贴视口（C5 的守门人） |

### S7 · 文档回写（**只写状态，不写实现细节**）

按 PRD §11 的五条改 `docs/需求登记表.md`（v2.43 → v2.44）：
1. §1.2 REQ-33 行状态 →「实施完成（2026-11-20）· 待总管验收」；
2. 备注「同源」口径保持；
3. §5.1 同编号行状态同步；
4. 文件头版本号 + 变更记录一行；
5. 编号水位不变。

回写后自查：

```powershell
Select-String -LiteralPath 'docs\需求登记表.md' -Pattern 'REQ-33' | ForEach-Object { 'L' + $_.LineNumber + ': ' + $_.Line.Trim() }
```

### S8 · 提交

```powershell
git --no-pager diff --stat -- src
git add src/components/ui/writing-template-select.tsx src/components/upload/interview-upload-form.tsx src/components/new-project/new-project-flow.tsx src/store/project-workspace.ts docs/需求登记表.md
git commit -m "feat(REQ-33): 两个建项入口增加写作模板选择（服务端零改动）"
```

- **不要** `git add tmp/**`（已 gitignore，探针不入库）。
- 提交前再跑一次 `node tmp/verify-req33-template-select.mjs` 与 `npx tsc --noEmit`。


---

## 3. 验收对照（AC → 怎么验）

| AC | 验法 | 门禁类型 |
| --- | --- | --- |
| AC-1 | 静态：探针 K2 / K7 / K10；人工：`/upload` 走完第 1-2 步到第 3 步，看控件在「音频语言/方言」下方、上传音频卡上方 | 静态 ＋ 手测 |
| AC-2 | 静态：探针 K2 / K7；人工：`/projects/new` → 基本信息 → 选 AI → 提纲步 | 静态 ＋ 手测 |
| AC-3 | 手测 + 控制台：`document.querySelector('#writingTemplateKey').options.length === 7`；逐个 `textContent` 与 PRD §3.5 一致 | 手测 |
| AC-4 | 手测：不改控件直接建项 → DevTools Network 里 multipart 的 `FormData` 无 `writingTemplateKey` 行；AI 路径 `JSON` 无该键 | 手测（可 CDP） |
| AC-5 | 选「通用访谈类」→ 建项成功 → 打开项目详情：写作规则档显示「本项目适用模板：通用访谈类。」 | 手测 ＋ S5-AC8 |
| AC-6 | 同 AC-5，AI 路径 | 手测 |
| AC-7 | 手测：`custom` 场景 + 自定义名含「公司」+ 选「地方史志类」→ 记录 `writingTemplateKey === "local_chronicle"` | 手测 |
| AC-8 | `tmp/verify-req33-rule.mjs` 三条 PASS（S5 已给命令与实测结论） | 脚本 |
| AC-9 | `git --no-pager diff --numstat -- src/app/api src/lib` 输出为空 | 脚本（探针 K8） |
| AC-10 | `verify-req14-prompts` 145/145 ＋ `git diff -- src/lib/writing-rules.ts src/lib/types/project.ts` 为空 | 脚本 |
| AC-11 | 手测四档视口（375×667 / 390×844 / 1280×800 / 1440×900）：控件不溢出、`scrollWidth <= innerWidth`、底部输入条仍贴底 | 手测 |
| AC-12 | S6 全表 | 脚本 |

---

## 4. 手测清单（按顺序做，做完打勾）

1. `npm run dev` → `/upload`。
2. 第 1 步：填项目名 / 机构 / 受访者 → 选保密级别 → 下一步。
3. 第 2 步：选采集方式「上传」→ 下一步。
4. 第 3 步：确认控件文案为「写作模板」+ 首项「不套模板（自由输出）」。
5. 选「通用访谈类（3 章）」→ 悬停看 `title` 是否列 3 个章标题。
6. 选一段音频 → 提交 → 同意弹窗 → 确认。
7. 项目详情：写作规则档出现「本项目访谈模板」相关章节（3 章骨架，无「生平履历」类 5 章标题）。
8. 回 `/upload` 重做一次，第 4 步不改控件 → Network 里确认**没有** `writingTemplateKey` → 建项后写作规则是 5 章（场景派生 = `local_chronicle`）。
9. `/projects/new` → 基本信息 → 选「AI 访谈」→ 提纲步：控件在工作台上方、有 `surface-card` 外框；底部输入条仍贴底、不被顶出视口。
10. 输入提纲 → 选「人物传记类」→ 生成 → 检查 AI 路径建出的项目 `writingTemplateKey === "biography"`。
11. 375 宽（DevTools 设备模式）重复第 4、9 步：无横向滚动条、控件不挤压相邻元素。

---

## 5. 风险与回滚

| # | 风险 | 处理 |
| --- | --- | --- |
| T1 | 提纲步高度不够，工作台被压（PRD R1） | 只把容器 `py-3` 降为 `py-2`；**不改**结构、不动 `outline-plan-workspace.tsx` |
| T2 | 探针 K10 因缩进/写法差异误判 | K10 只看「位置先后 + 是否在 `step === 3` 之后」，不比对格式；仍失败就用 `git diff -U2` 人工确认落点 |
| T3 | `verify-ui33-format-guard` G10 红被误当回归 | 它 **HEAD 就红**（PRD R2 / S6）；先重设基线再看数字 |
| T4 | 有人顺手在服务端「补默认 `general`」 | 明令禁止：会让 51 个存量项目里 50 个从 5 章变 3 章（PRD §0.3 C1） |
| T5 | 改动落在 `outline-plan-workspace.tsx` 里 | 明令禁止（C6）；控件放容器侧（A-3）已足够 |
| **回滚** | — | 单批可整体回滚：`git revert <sha>`；四个文件互相独立，删控件文件 + 回退三处 import/JSX 即恢复到 REQ-33 之前（服务端与数据层从未改，无迁移负担） |

---

## 6. 交付物与回报

**代码**：4 个 `src` 文件（1 新增 + 3 修改），见 §1。
**探针**：`tmp/verify-req33-template-select.mjs`（10 项）、`tmp/verify-req33-rule.mjs`（AC-8 三条）—— 均 gitignored。
**文档**：`docs/需求登记表.md` 回写（S7）。

**回报格式**（发给总管）：

```
REQ-33 实施完成（2026-11-20）
- src: 4 文件 / +78 −3（实测 numstat 粘贴）
- 探针: K1~K10 10/10 exit 0；AC8-a/b/c PASS
- 回归: req14 145/145 · req25 31/31 · phase3 42/42 · ui06 52/52 · tsc 0 error
- 预存红: verify-ui33-format-guard 9/10（G10，HEAD 既有）
- 手测: 清单 11 项全过（附 375 / 1440 两张截图）
```

**禁止事项（再强调一次）**：不改 `src/app/api`、不改 `src/lib`、不改 `outline-plan-workspace.tsx`、不改 `globals.css`、不默认 `general`、不发空串、不把键写进 URL / sessionStorage。

