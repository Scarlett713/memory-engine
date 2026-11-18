# REQ-32 验收报告（只读扫描）

- **需求**：REQ-32 通用写作模板的项目级接入（项目级字段 `writingTemplateKey?` ＋ 服务端透传；UI 入口为下游）
- **验收时间**：2026-11-07
- **验收方式**：**只读扫描** —— `git show / diff / log / status` ＋ `[IO.File]::ReadAllLines` ＋ `Select-String` ＋ 读取 DS 留证日志与脚本源码。**未运行任何探针/脚本**、**未修改任何 `src` / `tmp` / `storage` 文件**。
- **基准链**：`cb3c094`（REQ-36 前基线 = `origin/master`）→ `337a951`（REQ-32 实现）→ `6ea901a`（docs v2.35，HEAD）
- **行号口径**：`[IO.File]::ReadAllLines`。已用 `src/app/api/projects/route.ts:216` 与 `Select-String` 交叉校验一致；**`Get-Content | Select-Object -Skip` 管道计数在本仓库会漂移 8~10 行，不可用于行号引用**。
- **结论**：**代码侧 10 / 10 PASS**（AC-6 为**条件 PASS**、AC-9 为 **PASS 有偏差**）；**探针侧 1 项有日志 ＋ 5 项仅登记表文字**（见 §3），对应遗留项 D-1～D-7（见 §4）。

---

## 1. AC 逐条判定

| # | 验收项 | 判定 | 证据锚点 |
|---|---|---|---|
| AC-1 | `project.ts` 新增 `writingTemplateKey?: WritingTemplateKey` | **PASS** | `src/lib/types/project.ts:161-169`（类型）· `:221-222`（字段） |
| AC-2 | FormData 带 `general` → 201 回包含键；无键 → 201 不带键 | **PASS**（代码级） | `src/app/api/projects/route.ts:135-149` / `:216` / `:222-227` |
| AC-3 | `project-store.ts` 持久化到 JSON | **PASS** | `src/lib/server/project-store.ts:48` / `:259` / `:155-158` / `:280-287` |
| AC-4 | 非法 `templateKey` → `400`（Q4 裁决） | **PASS** | `route.ts:140-149` · `ai-interview/route.ts:131-142` |
| AC-5 | `ai-interview/route.ts` 同样覆盖（Q1 裁决） | **PASS** | `ai-interview/route.ts:7-10` / `:51` / `:127-142` / `:182` / `:207` |
| AC-6 | `writing-rules.ts` 仅新增导出，不改已有逻辑 | **PASS（有条件）** | `git show 337a951 -- src/lib/writing-rules.ts`：3 hunk、`+24 / −9`；**9 行删除全在解冻授权面内** |
| AC-7 | REQ-14 探针不破：**145/145**（含 `2c` 组 9 条） | **PASS** | `tmp/_req32-s6-green.log:13` · `tmp/verify/verify-req14-prompts.ts:623-682` |
| AC-8 | 禁改面 0 hunk | **PASS** | `git diff --name-only cb3c094..HEAD` = 5 `src` ＋ 3 `docs` |
| AC-9 | 通用模板 3 章导出识别正确 | **PASS（有偏差）** | `tmp/_req32-ac9-export.mjs`，7/7；**正文为手工装配、未跑 `processProject`** |
| AC-10 | BUG-12 探针 D10a 豁免（21/22） | **PASS** | `tmp/verify-bug12-sanitize.ts:222-226`（D10a）/ `:227`（D10b） |

**代码侧合计：10 / 10 PASS**（AC-6、AC-9 附条件/偏差）

---

## 2. 逐条证据

### 2.1 AC-1（`src/lib/types/project.ts`）
- `:162-169` 落地 6 值联合：`tibet_aid | local_chronicle | enterprise_history | biography | family_memoir | general` —— 与 `writing-rules.ts:96-104` 的 `OUTLINE_WRITING_TEMPLATES` 键集**逐字一致**（`general` 在 `:96`）。
- `:222` 字段 `writingTemplateKey?: WritingTemplateKey;`，位置在 `estimatedDuration` 之后、`versionHistory` 之前，与既有 5 个可选字段同区。
- 配套：`writing-rules.ts:26` 以 `export type { WritingTemplateKey };` **再导出** ⇒ 老引用面 `import { WritingTemplateKey } from "@/lib/writing-rules"` 不会破（且实测 `src/**` 外部引用 0 处）。

### 2.2 AC-2（`src/app/api/projects/route.ts`）
```
:135  // REQ-32 Q4=400：未传 / 空串按缺省处理；传了非白名单值则明确拒绝。
:136  const rawWritingTemplateKey = formData.get("writingTemplateKey");
:137  const writingTemplateKey = isWritingTemplateKey(raw) ? raw : undefined;
:140  if (typeof raw === "string" && raw !== "" && !writingTemplateKey) → 400
:216  createProject({ …, writingTemplateKey, … })
:222  return NextResponse.json({ project }, { status: 201 })
```
- **带 `general`**：守卫命中 ⇒ 落库 ⇒ `{ project }` 201，回包含 `writingTemplateKey: "general"`。
- **无键**：`get()` → `null` ⇒ `typeof !== "string"` ⇒ **不 400**；值为 `undefined` ⇒ `JSON.stringify` 丢键 ⇒ **201 且不带该键**。
- **空串**：`raw !== ""` 短路 ⇒ 视为缺省 201。
- 注：记录对象上该属性**存在但为 `undefined`**（`project-store.ts:158`），HTTP 层不可见，符合 AC 表述。

### 2.3 AC-3（`src/lib/server/project-store.ts`）
- `:48` `CreateProjectInput.writingTemplateKey?: WritingTemplateKey`
- `:259` 建项字面量直传 → `:280-287` `runExclusive` ＋ `writeProjects` 落盘
- `:155-158` `normalizeProjectRecord`：**白名单过滤、不补默认值**（注释明写「补默认会把存量项目写死成某一模板」）⇒ **R2 未犯**
- `:307-311` `updateProject` 用 `{ ...currentProject, ...updatePatch }` ⇒ 后续任何更新**不丢键**

### 2.4 AC-4（Q4 裁决 = `400`）
- FormData 臂：`route.ts:140-149` → `{ message: "写作模板类型不合法。" }, { status: 400 }`
- JSON 臂：`ai-interview/route.ts:131-142` 同文案同码
- **与 PRD 原推荐相反**（PRD 原推荐 A「静默丢弃 201」）⇒ 原为 **D-1**，已于 v2.36 回写 PRD §4.4 / AC-4 / Q4（见 §4 D-1 状态）。

### 2.5 AC-5（`src/app/api/projects/ai-interview/route.ts`）
- `:7-10` import 守卫；`:51` `writingTemplateKey?: unknown`；`:127-142` 三臂（`general` → 201 / `nope` → 400 / 无键 → 201）；`:182` 传入 `createProject`；`:207` `{ project }, 201`。三臂齐备。

### 2.6 AC-6（`src/lib/writing-rules.ts`）—— **有条件 PASS**
`git show 337a951 -- src/lib/writing-rules.ts`：**3 个 hunk**（`@@ -11,7 +11,11`、`@@ -19,13 +23,7`、`@@ -240,11 +238,11`），numstat **+24 / −9**。

| 性质 | 内容 | 是否授权 |
|---|---|---|
| 删 1 行 | 旧 `import type { InterviewScenario, ProjectRecord }`（改为多行含 `WritingTemplateKey`） | ✓ 解冻项① |
| 删 7 行 | 本地 `WritingTemplateKey` 联合（下移）→ `export type { WritingTemplateKey };` | ✓ 解冻项① |
| 删 1 行 | `Pick<>` 四字段单行 → 六字段多行 | ✓ 解冻项② |
| 增 1 行 | `templateKey: project.writingTemplateKey,` | ✓ 解冻项③ |
| 增 2 导出 | `WRITING_TEMPLATE_KEYS`（由 `OUTLINE_WRITING_TEMPLATES` 的 `Object.keys` 派生，**无第二份白名单**）/ `isWritingTemplateKey` | ✓ 解冻项④ |

- **「不改已有逻辑」成立**：三个 hunk 全部落在 `:1-17` / `:19-31` / `:238-250`；`OUTLINE_WRITING_TEMPLATES`（`:30-105`）、两张映射表、`resolveWritingTemplate`、`buildWritingRules` 正文 **0 hunk**。
- **但「无删除 / 修改已有行」字面不成立**（实删 9 行、改 2 处既有行）⇒ 故判 **条件 PASS**，条件 = 上述改动是否在 S1 解冻范围被点名（登记表 v2.34 已记「仅解冻面四处」，与实测一致）。

### 2.7 AC-7（探针 145 / 145）
- **红单**：`tmp/_req32-s0-red.log`（1234 B，21:28:35）—— 3 条 FAIL（`2c.项目级` 透传接通 / 章数 = 3 / 显式键压过关键词兜底），汇总 **140 / 143**（应为 exit 1）。
- **绿单**：`tmp/_req32-s6-green.log`（1004 B，21:29:45）`:13` —— **145 / 145**。
- `2c` 组实测 **9 条**：`2c.项目级` 6 条（`:638` 透传接通 / `:639` 章数=3 / `:642` 无键=5 章 / `:643` 无键=既有链路逐字等价 / `:650` 非法键回落 / `:653` 显式键压过关键词兜底）＋ `2c.守门` 3 条（`:667` 守卫识别 `general` / `:668` 守卫拒绝非法·空·null / `:678` 归一化未补默认模板）。
- **算术自洽**：136 ＋ 9 = **145**；S0 时点 136 ＋ 7 = **143** ⇒ 2 条守门断言按任务单 §0「ESM 链接陷阱」口径延后补入，与任务单一致。
- **正面发现**：`:678-682` 用 `!/writingTemplateKey\s*\|\|/.test(storeSource)` 把 **R2（禁止补默认值）固化为源码级断言**。
- 备注：`tmp/` 被 `.gitignore:54` 忽略 ⇒ 这 9 条断言增量**不进版本库**（既有惯例，见 D-7）。

### 2.8 AC-8（禁改面 0 hunk）
`git diff --name-only cb3c094..HEAD` = 5 个 `src` ＋ 3 个 `docs`：
```
src/app/api/projects/ai-interview/route.ts    +18 / −0
src/app/api/projects/route.ts                 +18 / −0
src/lib/server/project-store.ts                +8 / −0
src/lib/types/project.ts                      +11 / −0
src/lib/writing-rules.ts                      +24 / −9
```
`process-project.ts` / `ark-llm-provider.ts` / `mock-llm-provider.ts` / `project-export.ts` / `[projectId]/route.ts` / `enum.ts` / `src/components/**` / `src/store/**` —— **8 项 0 命中**。
工作区 `git status --short`：仅 `?? _delivery/`、`?? fangtan-demo-final_交付包_20261021.zip`（既有未跟踪物，非本批）。

### 2.9 AC-9（3 章导出识别，7 / 7）—— **PASS 但有性质偏差**
脚本 `tmp/_req32-ac9-export.mjs`（5033 B）实际路径：`createProject({ writingTemplateKey: "general" })` → `updateProject(manualDraft)` → **`createProjectExport(record, "docx")` 真链路** → 解 zip 读 `word/document.xml` → 按 REQ-25 D-5 特征（`w:sz=28` ＋ `<w:b/>` ＋ `jc=center`）筛章标题。

7 条 = `:84` 落库键 / `:93` 读回键（2 prereq）＋ `:106` 章标题数 = 3 ＋ `:108` 逐章识别 ×3 ＋ `:111-114` 三章正文都在。
章标题真值源 `writing-rules.ts:99-103`：「一、背景与缘起 / 二、主要经历与关键事实 / 三、认识、评价与展望」—— 与登记表引述一致。

**偏差（须转告人工测试）**：正文字段是**手工写死的 `manualDraft`**（章节取自模板真值源），**未跑 `processProject`**（讯飞不可用）⇒ 已证「导出侧能正确识别这 3 个章标题」，**未证「AI 生成的成文稿里确实出现这 3 个章标题」**。

### 2.10 AC-10（D10a 豁免）
- `tmp/verify-bug12-sanitize.ts`（465 行）：`:206-210` 取 `git diff --numstat`；`:222-226` `check("D10a git diff --numstat 恰 3 文件", files.length === 3, …)`；`:227` `check("D10b 禁改面 0 hunk", touched.length === 0, …)`。**登记表引用的 `:222-226` 与实测一致**。
- REQ-32 轮工作区 = **6 文件** ⇒ D10a 必红、D10b 绿 ⇒ 21/22 成立。
- 旁证：`tmp/_bug12_R5.log`（10-15，BUG-12 单批）为 **22 / 22**，D10a 当轮「3 文件」通过 ⇒ 该断言是**批次快照**而非行为断言。
- BUG-17 已立号：登记表 §1.2 / §三 详述 / §5.1 三处齐备（P3 · 候选（待 PRD））。

---

## 3. 探针基线比对

| 探针 | 预期基线 | 本轮结论 | 依据 |
|---|---|---|---|
| `verify-req14-prompts.ts` | 145 / 145 | **PASS 145 / 145** | `tmp/_req32-s6-green.log:13`（红单 `_req32-s0-red.log` ＝ 140 / 143） |
| `verify-req25-export-format.mjs` | 31 / 31 | **未复核** | 仅登记表 v2.34 文字，无日志 |
| `verify-phase2.mjs` | 32 / 32 | **未复核** | 同上 |
| `verify-phase3.mjs` | 42 / 42 | **未复核** | 同上 |
| `verify-bug09-next-question-timeout.mjs` | 23 / 23 | **未复核** | 同上 |
| `verify-bug12-sanitize.ts` | 21 / 22 | **未复核**（登记 21/22，D10a 豁免） | 同上；`_bug12_R5.log` 是 10-15 旧档 |
| `tsc -p tmp/tsconfig.src-only.json` | 0 error | **未复核**（间接证据：`tmp/tsconfig.src-only.tsbuildinfo` 时间戳 21:29:34） | 登记表文字 |

> 本轮按要求**不跑探针**，故 6 项「未复核」**不等于 FAIL**；但**可追溯性不足**（见 D-2）。

---

## 4. 偏差与瑕疵清单

| # | 类型 | 内容 | 处置 |
|---|---|---|---|
| **D-1** | **文档冲突** | PRD 原 `:195 / :199 / :332 / :393` 写「非法值**静默丢弃 201**」，实现与 Q4 裁决为 **400** | ✅ **已于 v2.36 回写**（§4.4 方案表 + 同段加注「Q4 改裁」＋ AC-4 ＋ §10 Q4） |
| **D-2** | 留证缺口 | 5 个基线探针 ＋ `tsc` **无日志**，仅登记表文字；`_req32-s6-green.log` 只有 req14 一个探针的 13 行 | ⏳ 待 DS 补 `_req32-s6-{req25,p2,p3,b9,b12,tsc}.log` |
| **D-3** | 文字矛盾 | 登记表 v2.34 条标题「**六文件**」vs 实测 **5 文件**（正文②已写「5 文件」） | ✅ **已于 v2.36 改为「五文件 / 六触点」**；PRD 全文 0 命中，无需改 |
| **D-4** | 口径不对称 | FormData 臂判据 `typeof === "string"`（非字符串静默忽略）；JSON 臂判据 `!= null`（数字 / 布尔 → 400） | 可接受，登记为已知差异 |
| **D-5** | 脚本强度 | `_req32-ac2-ac4.mjs` / `_req32-ai-interview-check.mjs` 为 `console.log` **观察式**，无 PASS/FAIL、无退出码 | 结论来自人工转录；转「已验收」前建议补断言 |
| **D-6** | 验证性质 | AC-9 未跑 `processProject`，正文为手工装配 | 真链路验收须人工 / 联调补（见 §5 第 5 条） |
| **D-7** | 版本留痕 | `tmp/` 被 `.gitignore:54` 忽略 ⇒ 9 条探针断言 ＋ 3 个 AC 脚本**不入库** | 既有惯例，仅提示 |
| — | 既有 nit（非本批） | `writing-rules.ts` 末**缺尾换行**（`git diff` 的 `\ No newline at end of file` 落在 **context 行** ⇒ 旧 blob 亦然） | 可选清理，不计入本条 |

---

## 5. 交人工测试清单（建议顺序）

1. **AC-2 正路**：登录后 `POST /api/projects`（multipart，`writingTemplateKey=general` ＋ wav）⇒ 期望 `201`，且 `project.writingTemplateKey === "general"`。
2. **AC-2 缺省**：同上不带该字段 ⇒ `201` 且响应**不含**该键；详情页 / 导出行为与现状一致。
3. **AC-4 拒绝**：`writingTemplateKey=nope` ⇒ `400`「写作模板类型不合法。」，列表无新项目落库。
4. **AC-5 AI 入口**：`POST /api/projects/ai-interview`（JSON）三臂：`general` → 201 带键 / `nope` → 400 / 省略 → 201 不带键。
5. **AC-9 真链路（关键，DS 未覆盖）**：`general` 项目在讯飞可用时跑 `processProject` → 看 `aiDraft` / `manualDraft` 是否按「一、背景与缘起 / 二、主要经历与关键事实 / 三、认识、评价与展望」成章 → 导出 `.docx` 看三条是否被识别为章（`sz=28` ＋ 加粗 ＋ 居中），有无跳章 / 并入正文。
6. **存量兼容**：打开任一 `storage/projects.json` 里的旧项目（无该键）→ 详情页、AI 问答、导出均正常（走原「关键词 → 场景 → `biography`」链路，仍 5 章）。
7. **持久性**：建带键项目后做一次 PATCH / 重命名 / 重跑 → 复核 `storage/projects.json` 中该键仍在（`updateProject` spread 保留）。

---

## 6. 结论与后续动作

- **代码面**：`337a951` 落地 **5 个 `src` 文件**（`+79 / −9`），字段 / 两入口 / 持久化 / 守卫**全部按裁决实现**；6 处代码触点中 `process-project.ts` **0 hunk**；R2（禁补默认值）已由探针 `verify-req14-prompts.ts:678-682` 源码级固化 ⇒ **可进入人工测试**。
- **验收判定**：**AC-1…AC-10 全部 PASS**（AC-6 条件 PASS、AC-9 有偏差）。
- **未闭环项**：**D-2**（5 项基线无日志留证 —— 需 DS 补跑补档；本报告按约束未运行探针）、**D-4 / D-5**（口径与脚本强度，可接受但须登记）、**D-6**（AC-9 真链路须人工补）、**D-7**（留痕提示）。
- **登记表状态**：§三 REQ-32 →「**已验收（待人工测试）**」；版本 → **v2.36**。
- **下一步**：① 人工按 §5 七条走测（重点第 5 条）；② DS 补 D-2 日志；③ 全部通过后把状态改为「已验收（2026-11-07）」并结案。

---

### 附：本报告生成轮的文档改动（v2.36，`src` 零改动、探针未运行）

| 文件 | 改动 |
|---|---|
| `docs/PRD_REQ-32_项目级写作模板字段与服务端透传.md` | §4.4 方案表（A 标作废 / B 标现行 400）＋ 同段「Q4 改裁」加注；§7 `AC-4` 改为 400 ＋ 不落库；§10 `Q4` 推荐列改为 400。**总行数 417 不变** |
| `docs/需求登记表.md` | 版本 `v2.35 → v2.36`；修订记录新增 v2.36 行；v2.34 条「六文件」→「五文件 / 六触点」；§1.2 / §三 / §5.1 三处 REQ-32 状态 →「已验收（待人工测试）」 |
| `docs/tasks/REQ-32-验收报告.md` | **新建**（本文件） |

