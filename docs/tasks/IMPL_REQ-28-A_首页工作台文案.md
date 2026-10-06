# REQ-28-A 实施任务单 · 首页工作台文案清理

> 伞需求 REQ-28（KIMI 全站文案审查）的 **A 批**：首页三区（新建 / 草稿 / 历史项目）与项目卡片。
>
> - **本文档只写计划**：不改代码、不产生 commit。实施轮按 §1 改 `src/**`、按 §2 改 `tmp/**` 探针（探针不入库）。
> - **关联**：`docs/PRD_REQ-28_文案清理.md` §4 REQ-28-A（15 条）｜`docs/tasks/IMPL_REQ-28_文案清理.md` §0.2-D4 / §2.1 / §3.2 / §3.5 / §5.1 / §5.2
> - **规模**：PRD 15 条 → 合并同点后 **实际改动点 10 处**（A-04＝A-06、A-05＝A-07、A-11＝A-12 各为**同一处 DOM**）＋ 连带 4 处（`:111` 术语回潮、`:118` 注释、`:78` `mt-2`、`:14`/`:127`–`:131` 死代码）
> - **落点文件**：**恰好 3 个**（`home/home-dashboard.tsx`、`home/recent-project-list.tsx`、`ui/status-badge.tsx`）；**`src/lib/**` 与 `projects/project-workflow-board.tsx` 本批零改动**（裁决 ❶ → diff 边界不得出现第 4 个文件）
> - **探针同步**：2 个文件、**5 行必改**（**裁决 ❸ 定稿**：`run-batch1/visual-check.mjs:149` ＋ `verify-phase1.mjs:202/203/216/217`）→ 其中 2 处属 **IMPL §3 漏记项**（见 §2 表内 🔴 / 🟠 行）
> - **行号基线**：2026-10-07 实测（HEAD = `6b777a6`，B 批已入库、工作树干净）→ **实施前须复核行号**
> - **状态**：已裁决（总管 7 点全判）→ 待实施

---

## §0 口径说明

| # | 口径 | 依据 → 后果 |
| --- | --- | --- |
| 0.1 | **A-11 / A-12 是同一处 DOM**（`recent-project-list.tsx:145`–`150` 一条组合式说明条同时承载两个编号的现状字面）→ 本批**删除整行**（方案 a），**不得**写两套替换 | **总管裁决 ①（2026-10-07）**；PRD A-11 原文即「或删除，合并进状态标签」→ 连带删 3 处死代码（§1.3） |
| 0.2 | **A-01 / A-03 取 PRD 首选「整段删除」**；两条的「保留则替换」分支（`创建项目并生成访谈提纲` / `进行中的项目会显示在这里`）**本批不采用**，备查见 §4-8 | PRD §4-A 处置列均为「删除（保留则替换）」→ 与 B 批 B-04 同处置口径 |
| 0.3 | **同词副本一律不动**（0.2-D4）：「建档时间」2 处（`app/projects/[projectId]/page.tsx:87`、`lib/server/project-export.ts:88`）、「受访音频」8 处、「待处理」8 处（`status-badge.tsx` 之外）、「已完成」步骤态（`project-workflow-board.tsx:24`） | `IMPL §0.2-D4` → 验收时这些字面**仍在**，属**预期原状**，不得判红（除 §3.1 明列范围） |
| 0.4 | **A-09 跨页连带**：`status-badge.tsx` 是状态胶囊的**唯一出口** → 改 `:27` 后**首页卡片与项目详情页**（`app/projects/[projectId]/page.tsx:68`）同步生效 | IMPL §2.1 L102 → 本批只改一处字面，但**影响面含详情页**，§3.7 须复视 |
| 0.5 | **A-13 授权一处最小条件表达式**：`{project.audioFileName ? "音频：已上传" : "音频：待上传"}` | **总管裁决 ⑤**（写法逐字采用）→ 例外于 0.8「只改字面量」，但**不新增字段、不改函数签名、不改父容器结构**；`audioFileName` 空串即「待上传」（AI 访谈链路建项目时音频字段一律置空，见 `api/projects/ai-interview/route.ts:74`–`86`） |
| 0.6 | **A-08 按 PRD 原样**：`{projects.length} 个项目` → `{projects.length} 个`（**不加「共」**） | **总管裁决 ③** |
| 0.7 | 选词定稿：**A-09 →「待审核」**、**A-10 →「整理中」** | **总管裁决（补充）＋ ④**；A-10 不取「处理中」是为避让同文件既有术语「转写处理中」（`:19`）/「整理处理中」（`:23`）的语义撞车 |
| 0.8 | 只改**字符串字面量**：不改 JSX 结构、条件分支、props 名、导出、类型定义、状态键；不新增依赖、不改配置、不动样式文件。**例外两处**＝ 0.5 的 A-13 表达式 ＋ A-04 删除后 h2 的 `mt-2`（必要 className 最小改动） | IMPL §5.2 → 状态键 `uploaded` / `manual_review` 与 `ProjectStatus` 联合类型**严禁改动** |
| 0.9 | 编码 / 换行：一律 UTF-8 **无 BOM**；`src/**` 与 `docs/tasks/*.md` 均为 **CRLF** | IMPL §5.1 → 若某次编辑整文件重写，须先把 `\n` 归一为 `\r\n` 再落盘，否则产生整份 diff |
| 0.10 | 探针纪律：改探针前先备份 → `tmp\_backup_REQ28A\`；只改**定位 / 断言方向 / 字段名**，不改断言语义的覆盖面；`tmp/` 受 `.gitignore:54` 屏蔽 → **不入库**；漂移时优先回退**文案** | IMPL §3.6 纪律 4 |

---

## §1 改动清单（15 条 → 10 处改动点 · 行号＝本轮实测）

### 1.1 首页三区之一 · 新建卡片（`src/components/home/home-dashboard.tsx`）

| 编号 | 落点（行） | 现状字面 | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **A-01** | `:87`–`:89`（整个 `<p>`） | `填写受访者与访谈主题，生成个性化提纲后进入建档流程。` | ——（**删除整段**） | 父容器 `:81` 是 `flex flex-col gap-3`、CTA `:92`–`:98` 自带 `mt-auto` → **删后无布局连带**，`className` 不需改（对照 B-04 的反例） |
| **A-02** | `:105` ＋ `:107` | eyebrow `草稿` ＋ h2 `未完成的草稿` | `进行中` ＋ `未完成的访谈` | 同一卡片内两处字面**同改**；`:83` 的「新建」eyebrow、`:85` 的标题**不动** |
| **A-03** | `:112`–`:114`（整个 `<p>`） | `新建项目后未提交的内容会出现在这里，可随时继续填写。` | ——（**删除整段**） | 🟠 **探针硬耦合**（§2-1）；父容器 `:110` 是 `surface-card … p-5`，删后仅剩标题行 → 无布局连带 |
| **连带 ⑥** | `:111` | `暂无草稿` | `暂无进行中的项目` | **总管裁决 ⑥**：A-02 把「草稿」术语换掉后，同卡片这句构成**术语回潮**，属必要连带（非「顺手改」） |
| **连带 注释** | `:118` | `{/* 历史项目区：外壳只出面板与内边距，区头（eyebrow + 「历史项目」+ 计数 pill）` | 注释中「历史项目」→「我的项目」 | 注释不改界面，但不改会让「历史项目」在 `src/**` **残留 1 处**，击穿 §3.1 组⑤ 的全局归零口径（纯注释、无功能风险） |

### 1.2 首页三区之三 · 历史项目区头（`src/components/home/recent-project-list.tsx`）

> 区头由本组件自渲染；`home-dashboard.tsx` 只出外壳（`:118` 注释已说明）。仓库**无独立列表页路由**（`src/app/projects/page.tsx` 不存在）→ PRD 分列的「首页」与「历史项目列表」两个位置，实测为**同一渲染点**。

| 编号 | 落点（行） | 现状字面 | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **A-04 ＝ A-06** | `:77` | `<p className="section-eyebrow">项目索引</p>` | ——（**删除整行**） | 一处 DOM 覆盖两个编号；删后 `:75` 的 `sm:justify-between` 仍成立（左块剩 h2、右块是计数 pill） |
| **A-05 ＝ A-07** | `:78`–`:80`（文本行 `:79`） | `<h2 …>历史项目</h2>` | `我的项目` | 一次改净两编号；目标取 A-07 定稿「我的项目」（A-05 的两个备选中取前者，与 A-07 统一） |
| **连带** | `:78` 同一 `<h2>` | `className="font-display mt-2 text-[1.35rem] …"` | 去掉 `mt-2` | eyebrow 删除后 `mt-2` 使 h2 多出 8px 顶部外边距（`sm:items-end` 下）→ **必要连带**（**B-04 同口径**：删除相邻元素后调整容器内间距，属必要最小布局修正，**非顺手改**）；**总管裁决 ❷ 授权** |
| **A-08** | `:85` | `{projects.length} 个项目` | `{projects.length} 个` | 改**模板字面**（数字由 `projects.length` 拼接）；`:83` 的 `meta-pill` 容器、`:84` 的 `FolderArchive` 图标**不动** |

### 1.3 卡片说明条删除 ＋ 死代码清理（A-11 / A-12 · `recent-project-list.tsx`）

> **A-11 与 A-12 是同一处 DOM**：`:145`–`:150` 一条组合式说明条同时承载两个编号的现状字面（`人工审校 · 待您审校` 与 `受访音频建档 · 进行中`）。按裁决 ① **整行删除**，并连带清理 **2 处**因删除而失效的代码（原表第 ④ 项「workflow-board 注释」已按**裁决 ❶ 本批跳过**：保留原注释、不纳入本批）。

| 步骤 | 落点（行） | 内容 | 处置 |
| --- | --- | --- | --- |
| ① | `:145`–`:150` | `{activeStep ? (<span className="meta-pill text-xs font-medium text-muted">当前阶段：{activeStep.label} ·{" "}{getWorkflowStatusLabel(activeStep)}</span>) : null}` | **删除整块**（6 行）→ A-11 ＋ A-12 同时归零 |
| ② | `:127`–`:131` | `// 当前阶段：优先「进行中」的那一步…` ＋ `// 全部完成时不显示——此时 StatusBadge 已经在说结果了。` ＋ `const activeStep = project.workflow.find(…) ?? project.workflow.find(…)` | **删除**（3 行代码 ＋ 2 行注释）→ ①后 `activeStep` 成死变量，否则 `@typescript-eslint/no-unused-vars` 报错 |
| ③ | `:14` | `import { getWorkflowStatusLabel } from "@/components/projects/project-workflow-board";` | **删除整行** → ①后该导入在本文件无引用（`project-workflow-board.tsx:83` 是该函数自身用法，不受影响） |
| ④ | `src/components/projects/project-workflow-board.tsx:29` | 注释 `// 首页卡片（recent-project-list）也要展示同一条「当前阶段」文案。` | ——（**本批跳过**，不改）；**裁决 ❶**：该注释留在原处，归零口径据此收窄（§3.1 组⑦ 仅限 `src/components/home/**`）；与 IMPL L799 注释同口径，留 chore 批次清理。此行保留供追溯 |

**保留（严禁改动）**：`project-workflow-board.tsx:31`–`37` 的 `getWorkflowStatusLabel()` 本体、`:34`–`:36` 的 `manual_review + in_progress → "待您审校"` 特判（**详情页**经 `:83` 仍在用，且是 REQ-16 验收项 5 的口径，见 §4-3）、`:23`–`:27` 的 `statusMap`（含 `:25` `in_progress: "进行中"`）。

### 1.4 卡片字段（`recent-project-list.tsx`）

| 编号 | 落点（行） | 现状字面 | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **A-13** | `:155`–`:157`（文本行 `:156`） | `受访音频：{project.audioFileName}` | `{project.audioFileName ? "音频：已上传" : "音频：待上传"}` | 0.5 授权的最小表达式（裁决 ⑤ 写法逐字采用）；容器 `<p className="mt-1 truncate text-sm text-muted">`**不动** |
| **A-14** | `:188` | `建档时间` | `创建时间` | 同词副本 2 处**不动**（0.3）；图标 `Clock3`（`:187`）与时间值 `formatDateTime(project.createdAt)`（`:191`）不动 |
| **A-15** | `:201` | `{completedSteps} / {project.workflow.length} 已完成` | `已完成 {completedSteps}/{project.workflow.length}` | 只改模板字面；`:198` 的「**进度**」**保留**（探针 `verify-phase1.mjs:204/217` 依赖该词）；`:206`–`:211` 进度条不动 |

**A-13 双分支覆盖面**：AI 访谈链路建项目时 `audioFileName` 为 `""`（`api/projects/ai-interview/route.ts` 的 `markUploadInProgress()`，`:74`–`:86`）→「待上传」分支在首页**可复现**；上传链路建的项目该字段非空 → 走「已上传」。

### 1.5 状态胶囊（`src/components/ui/status-badge.tsx`）

| 编号 | 落点（行） | 现状字面 | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **A-09** | `:27` | `label: "待人工审校",` | `label: "待审核",` | 状态键 `manual_review`（`:26`）**不动**、`className`（`:28`）**不动**；影响面含**详情页**（0.4） |
| **A-10** | `:15` | `label: "待处理",` | `label: "整理中",` | 状态键 `uploaded`（`:14`）**不动**；同文件 `:19`「转写处理中」、`:23`「整理处理中」**不动** |
### 1.6 不动清单（防「顺手改」）

- `home-dashboard.tsx`：`:80` `data-home-zone="new"`、`:83`「新建」eyebrow、`:85`「开始一个新项目」、`:94` CTA `className`（含 `mt-auto`）、`:97`「新建项目」、`:102` `data-home-zone="draft"`、`:109` REQ-15 注释、`:110` 卡片容器 `className`、`:121` `data-home-zone="projects"`。
- `recent-project-list.tsx`：`:104`「正在加载项目列表...」、`:112`「暂无项目」（`verify-phase1.mjs:192` 以它为等待条件）、**`:114`–`:116`「点上方「新建项目」开始建档，完成后项目会出现在这里。」（总管内明确「不动」：未入任何批次，不顺手改）**、`:133` 起 `article` 结构与 `:160`–`:181` 打开/删除按钮、`:184`–`:204` 两格信息区（A-14/A-15 之外的图标与取值）、`:206`–`:211` 进度条、`:152`–`:154`「受访对象：」。
- `status-badge.tsx`：`:14`/`:26` 状态键、`:10`–`:12` 类型、`:16`/`:20`/`:24`/`:28`/`:32` `className`、`:18`/`:22`/`:30`/`:34` 其余四态 label。
- `projects/project-workflow-board.tsx`：**本批零改动**（**裁决 ❶**）—— `:29` 注释（跳过，留 chore 批次）、`:23`–`:27` `statusMap`（含 `:25` `in_progress: "进行中"`）、`:31`–`:37` `getWorkflowStatusLabel()` 本体。
- 全站性：`AI 访谈`、`新建项目`、`.tape-label`、`text-transform: uppercase`、任何 `Step 0N`（B 批已归零，A 批**不得**新引入编号前缀）。
- 探针契约：`data-*`、`id`、`aria-label`（含 `textarea[aria-label="访谈提纲草稿"]`）、`aria-current`、`name`、`href`。

### 1.7 落点纠偏（对 IMPL §2.1 / §3.5 的三处更正 · 新登记）

| # | IMPL 记载 | 实测 | 本单处置 |
| --- | --- | --- | --- |
| ⑧ | §2.1 L98：A-05 落点写 `home-dashboard.tsx ＋ recent-project-list.tsx` | `home-dashboard.tsx` 的「历史项目」**仅在注释**（`:118`）；UI 字面只在 `recent-project-list.tsx:79` | A-05 主落点 ＝ 列表件标题；`home-dashboard.tsx` 只同步**注释**（§1.1 连带行） |
| ⑨ | §2.1 L108：A-15 落点写 `recent-project-list.tsx ＋ project-workflow-board.tsx`；并提示复核 `project-processing-console.tsx` 的「当前阶段」类同词 | `project-workflow-board.tsx` **无**进度计数模板（其 `:24`「已完成」是**步骤态**）；`project-processing-console.tsx:706`「当前阶段不可审校」属**详情页处理台**语义、非首页说明条 | A-15 ＝ **单文件落点**；`:706` **不动**（本批范围外，§3.1 组⑦ 明列豁免） |
| ⑩ | §3.2 需同步探针 5 支 ／ §3.5 判 `verify-phase1` 「本批文案零命中」 | `verify-phase1.mjs:202/203/216` **正是** A-11/A-12 的断言面；`tmp/run-batch1/visual-check.mjs:149` 另有 A-03 的硬耦合，且该脚本**未被 §3 收录**（§3.5 的 34 个清单不含 `run-batch1/` 子目录） | §2 同步清单按实测**补 2 支**（见 🔴 / 🟠 行） |

---

## §2 探针同步清单（2 文件 · 5 行必改）

**纪律**：① 改前先备份 → `Copy-Item tmp\<探针> tmp\_backup_REQ28A\<探针>`（脚本见 §6）；② `tmp/` 受 `.gitignore:54` 屏蔽 → **探针改动不入库**；③ 本批只改**断言方向、字段名、check 标题**，不改断言语义的覆盖面；④ 漂移时优先回退**文案**（IMPL §3.6 纪律 4）。

| # | 探针文件 | 行号 | 现状 | 改为 | 关联 |
| --- | --- | --- | --- | --- | --- |
| 1 | `tmp/run-batch1/visual-check.mjs` | 🟠 `149`–`151` | ``check("② 草稿区空态已改「新建项目后未提交…」", home.draftText.includes("新建项目后未提交的内容会出现在这里"), `含旧文案=${…includes("新建访谈后未提交")}`);`` | ``check("② 草稿区旧空态说明已删除", home.draftText.includes("新建项目后未提交的内容会出现在这里") === false, `draftText="${home.draftText.replace(/\n/g, " / ")}"`);`` | **A-03**（正向 → **负向**）；**IMPL §3 漏记项**（子目录脚本未收录） |
| 2 | `tmp/verify-phase1.mjs` | 🔴 `202` | `hasStage: arts.some((a) => a.innerText.includes('当前阶段：')),` | `stagePhraseCount: arts.filter((a) => a.innerText.includes('当前阶段：')).length,` | **A-11/A-12**；**IMPL §3.5 漏记项**（被误判「本批文案零命中」） |
| 3 | 同上 | 🔴 `203` | `stageText: (arts[0]?.innerText.match(/当前阶段：[^\n]*/) ?? [null])[0],` | `stageSample: (arts[0]?.innerText.match(/当前阶段：[^\n]*/) ?? [null])[0],` | 同 #2（仅字段改名；正则保留，作**失败证据串**） |
| 4 | 同上 | 🔴 `216` | `check("卡片显示「当前阶段」", cards.hasStage === true, String(cards.stageText));` | ``check("卡片已无「当前阶段」说明条", cards.stagePhraseCount === 0, `仍命中 ${cards.stagePhraseCount} 张 · 样例=${String(cards.stageSample)}`);`` | 同 #2（**负向断言**，字段名随 #2/#3 同步） |
| 5 | 同上 | 🔴 `217` | `check("「打开」仍指向处理台且与阶段并存", /^\/projects\//.test(cards.openHref …) && cards.hasBadgeProgress === true, String(cards.openHref));`（原式在 `cards.openHref` 后用逻辑或 ＋ 空串兜底；此处略写，以免竖线被当作表格分隔符） | **仅改标题** → `check("「打开」仍指向处理台", …)`；**断言体不动** | **裁决 ❸ 纳入必改**（取 5 行方案）：`:216` 与其 check 标题语义同时失效，标题不同步会让探针阅读者困惑 → `hasBadgeProgress`（`:204`）依赖 A-15 **保留**的「进度」→ 仍应 PASS |

> **必改行数（裁决 ❸）**：2 文件 **5 行** —— `run-batch1/visual-check.mjs:149` ＋ `verify-phase1.mjs:202 / 203 / 216 / 217`（其中 `:217` 仅因 **check 标题**含「与阶段并存」而失效 → **只改标题、断言体不动**）。「严格 4 行」回退选项已按裁决 ❸ **删除**，实施时不得自行缩回。

**豁免（确认不动）**：

| 探针 | 行 | 字面 / 断言 | 原因 |
| --- | --- | --- | --- |
| `tmp/verify-phase1.mjs` | `:192` | 等待条件 `includes('暂无项目')` | 打的是 `recent-project-list.tsx:112` 的**空列表**文案，非 A-02 的「草稿」空态 → A 批不动 |
| `tmp/verify-phase1.mjs` | `:204` | `hasBadgeProgress: arts.some((a) => a.innerText.includes('进度'))` | A-15 **保留**「进度」标签 → 改后仍应 PASS |
| `tmp/verify-phase1.mjs` | `:197`–`:201` / `:205` / `:212`–`:215` | 卡片数量、`group` 类、`onclick`、光标、`openHref` | 与文案无关，应保持 PASS |
| `tmp/cdp-req28-labels.mjs` | 19 个 `check` | F 批标签回归 | 全域实测**不触 A 批任何字面** → A 批后应保持 **17/17** |
| `tmp/reformat-arch-doc.mjs` | `:94`/`:95` | 架构文档表格正文含「待人工审校」 | 文档生成工具、**非回归集** → 不动（§3.1 字面归零**限定 `src/**`**，故不受影响） |

> **源码侧豁免备案（裁决 ❶）**：`src/components/projects/project-workflow-board.tsx:29` 注释含「当前阶段」，**本批跳过** → §3.1 组⑦ 检索范围已收窄为 `src/components/home/**`；验收时该处**不得**判红。

**A 批字面在 `tmp/**` 的实测总览**：`项目索引` / `历史项目` / `未完成的草稿` / `暂无草稿` / `建档时间` / `受访音频：` / `个已完成` / `我的项目` / `创建时间` **全域 0 命中**（「草稿」142 处经逐行判读，全为 `aria-label="访谈提纲草稿"` 红线、注释、sessionStorage 语义、`tmp/_backup_REQ28B/` 副本）→ **仅上表 2 支探针受影响**。

---

## §3 验收

> 顺序不可颠倒：先改 `src/**` → 再改探针（§2）→ 再跑验收。

- [ ] **3.0 复核基线**：`git rev-parse --short HEAD` 记录（应为 `6b777a6`）；`npm run lint`、`npx tsc --noEmit` **各跑一次留基线**（只允许改后「无新增错误」）。
- [ ] **3.1 字面归零**（脚本见 §6）：

  | 组 | 待归零字面 | 检索范围 | 期望 |
  | --- | --- | --- | --- |
  | ① | `填写受访者与访谈主题，生成个性化提纲后进入建档流程。` | `src/**` | 0 |
  | ② | `草稿`（裸字） | `src/components/home/home-dashboard.tsx` | 0（**不得**全域检索：`aria-label="访谈提纲草稿"` 是红线） |
  | ③ | `未完成的草稿` ＋ `暂无草稿` ＋ `新建项目后未提交的内容会出现在这里` | `src/**` | 0 |
  | ④ | `项目索引` | `src/**` | 0 |
  | ⑤ | `历史项目` | `src/**`（含注释） | 0 |
  | ⑥ | `} 个项目`（计数胶囊模板字面，**须带前导 `}`**） | `src/**` | 0（裸字 `个项目` 会误报 `这个项目` / `整个项目库`，实测 2 处 → 必须用精确字面） |
  | ⑦ | `当前阶段` | `src/components/home/**`（**仅此**，**裁决 ❶**） | 0；另两处**预期原状**：`project-workflow-board.tsx:29`（注释，本批跳过）、`project-processing-console.tsx:706`（详情页文案，范围外） |
  | ⑧ | `受访音频：` | `src/**` | 0 |
  | ⑨ | `建档时间` | `src/components/home/recent-project-list.tsx` | 0（另 2 处副本按 0.3 **预期原状**） |
  | ⑩ | `待人工审校` | `src/**` | 0 |
  | ⑪ | `label: "待处理"` | `src/components/ui/status-badge.tsx` | 0（另 8 处副本按 0.3 **预期原状**） |
  | ⑫ | `} 已完成`（旧语序） | `src/**` | 0（裸字 `已完成` 会误报 `审校已完成` / `statusMap.completed` 等，实测 7 处 → 必须用精确字面） |

- [ ] **3.2 新文案就位**（各 ≥1 命中）：`进行中`（草稿区 eyebrow）、`未完成的访谈`、`暂无进行中的项目`、`我的项目`、`projects.length} 个`、`待审核`、`整理中`、`音频：已上传` ＋ `音频：待上传`、`创建时间`、`已完成 {completedSteps}/{project.workflow.length}`。
- [ ] **3.3 类型 / 静态检查**：`npx tsc --noEmit`（重点确认 §1.3 三处删净后**无未使用变量 / 未使用导入**）＋ `npm run lint` 无新增错误。
- [ ] **3.4 探针跑通**（按 §2 同步后）：
  - `node tmp/verify-phase1.mjs` ✔（卡片区需 ≥1 项目，否则 `:209` 走 SKIP 分支 → **建议保留探针项目**）
  - `node tmp/run-batch1/visual-check.mjs` ✔（② 组 4 条 check；需 dev server ＋ 登录态）
- [ ] **3.5 回归**：`node tmp/cdp-req28-labels.mjs` **保持 17/17**；`node tmp/cdp-req13-crosscut.mjs` ✔（A 批无耦合，用作出库证明）。
- [ ] **3.6 diff 审查**：`git status --short` **只应出现 3 个 `src/**` 文件**（`home-dashboard.tsx`、`recent-project-list.tsx`、`status-badge.tsx`）；`src/lib/**`、`src/app/**`、`projects/project-workflow-board.tsx`（**裁决 ❶**）**零改动**；`tmp/**` 不得入库。
- [ ] **3.7 视觉复核（人工）**：首页三区同屏 —— 新建卡片只剩 eyebrow ＋ 标题 ＋ CTA；草稿卡片显示「进行中 / 未完成的访谈 / 暂无进行中的项目」；历史项目区头只剩「我的项目」＋ `N 个`；卡片无「当前阶段」说明条，字段为「音频：已上传 / 待上传」「创建时间」「进度 已完成 x/y」；**项目详情页**状态胶囊同步显示「待审核」。

---

## §4 注意事项

1. **探针契约禁改**：`data-*`（含 `data-home-zone`）、`id`、`aria-label`、`aria-current`、`name`、`href`、`#route-chooser-*`、`#outline-profile-drawer`、`textarea[aria-label="访谈提纲草稿"]`。
2. **A-11/A-12 删除必须三处连带同步**：`:145`–`:150` 渲染块 ＋ `:127`–`:131` 变量与注释 ＋ `:14` 导入。漏任一处 → `tsc` / `lint` 报错（死变量、未使用导入）。
3. **`getWorkflowStatusLabel` 本体禁改**：只删**首页调用点**；`project-workflow-board.tsx` 的 `statusMap` 与 `manual_review → "待您审校"` 特判仍服务**详情页**，且是 `docs/需求登记表.md:460`（REQ-16 验收项 5）的口径 —— 本批不得触碰，否则两条需求对同一 DOM 出现两套验收语。
4. **A-09 详情页连带备案**：改 `status-badge.tsx:27` 后详情页胶囊同步变「待审核」。属**预期效果**（0.4），§3.7 须一并复视；若产品要求详情页保留旧词，须回总管重新裁决（不可在本批内分叉）。
5. **A-13 表达式约束**（裁决 ⑤）：不得新增字段、不改函数签名、不改父容器结构；两分支文案逐字为 `音频：已上传` / `音频：待上传`。
6. **A-04 的 `mt-2` 是裁决 ❷ 授权的必要连带**（与 B-04 的 `sm:justify-between → sm:justify-end` 同口径，属删除相邻元素后的最小布局修正）；**除此之外本批不得再做任何 `className` 调整** —— §3.6 diff 审查据此判定。
7. **选词已定稿**（0.6 / 0.7）：`个`（不加「共」）、`待审核`、`整理中`。实施中**不得再改选**，改选须回总管。
8. **0.2-D4 副本一律不动**：`建档时间`×2、`受访音频`×8、`待处理`×8、「已完成」步骤态×1 —— §3.1 已按范围限定，验收时不得把「副本仍在」判为失败。
9. **A-01 / A-03 保留分支备查**（本批不采用）：若产品要求保留，A-01 用 `创建项目并生成访谈提纲`、A-03 用 `进行中的项目会显示在这里`；此时代码保留 `<p>` 只换文字，且 **A-03 的探针断言须改回正向**并同步新句（§2-1 反向操作）。
10. **`:114`–`:116`「点上方「新建项目」开始建档…」不动**（总管内明确）：未入任何批次，不含在 §3.1 任一组。
11. **`projects/project-workflow-board.tsx` 本批零改动**（裁决 ❶）：`:29` 注释留 chore 批次清理；`git status` 中若出现该文件即判失败（§3.6）。
12. **编码 / 换行**：UTF-8 无 BOM；如发生整文件重写，落盘前把 `\n` 归一为 `\r\n`（IMPL §5.1）。

---

## §5 交付边界

- `tmp/**` 受 `.gitignore:54` 屏蔽 → 探针改动**不入库**；`docs/tasks/` 已纳管，本单新建即入库。
- 实施轮建议**单 commit**，范围仅含 3 个 `src/**` 文件（＋ A-13 表达式与 `mt-2` 两处最小改动；**`projects/project-workflow-board.tsx` 不得入本 commit**，裁决 ❶，否则击穿 §3.6 diff 边界），message：`文案清理(REQ-28-A): 首页工作台文案清理`。
- 回滚：纯文案 ＋ 一处表达式 ＋ 一处 className，`git revert` 即可；探针漂移优先回退**文案**（IMPL §3.6 纪律 4）。
- 本单**不涉及**：`docs/**` 其它文件、帮助入口批次、UI-xx、C/D/E/F 批。若实施后发现 `docs/需求登记表.md` 等文档仍以「待人工审校」描述状态胶囊（A-09 的连带面），作为**文档侧后续**单独登记，不在本批内改。

---

## §6 附：字面归零脚本 ＋ 探针备份脚本（无 ripgrep，PowerShell 内存扫描）

```powershell
cd (git rev-parse --show-toplevel)   # 仓库根（或手动：cd <仓库根>）

function Hits([string]$scope, [string]$pat) {
  $items = if (Test-Path -LiteralPath $scope -PathType Container) {
    Get-ChildItem -LiteralPath $scope -Recurse -Include '*.ts','*.tsx' -File
  } else { Get-Item -LiteralPath $scope }
  $n = 0
  foreach ($f in $items) {
    $c = (Select-String -LiteralPath $f.FullName -SimpleMatch -Pattern $pat | Measure-Object).Count
    if ($c -gt 0) {
      $n += $c
      '      {0} ({1} 行)' -f $f.FullName.Replace((Get-Location).Path + '\', ''), $c
    }
  }
  return $n
}

# 组号 / 检索范围（目录或单文件）/ 待归零字面
$cases = @(
  @('①',  'src',                                                 '填写受访者与访谈主题，生成个性化提纲后进入建档流程。'),
  @('②',  'src\components\home\home-dashboard.tsx',              '草稿'),
  @('③a', 'src',                                                 '未完成的草稿'),
  @('③b', 'src',                                                 '暂无草稿'),
  @('③c', 'src',                                                 '新建项目后未提交的内容会出现在这里'),
  @('④',  'src',                                                 '项目索引'),
  @('⑤',  'src',                                                 '历史项目'),
  @('⑥',  'src',                                                 '} 个项目'),
  @('⑦',  'src\components\home',                                 '当前阶段'),
  @('⑧',  'src',                                                 '受访音频：'),
  @('⑨',  'src\components\home\recent-project-list.tsx',         '建档时间'),
  @('⑩',  'src',                                                 '待人工审校'),
  @('⑪',  'src\components\ui\status-badge.tsx',                  'label: "待处理"'),
  @('⑫',  'src',                                                 '} 已完成')
)

foreach ($c in $cases) {
  $hits = Hits $c[1] $c[2]
  '{0,-4} {1,-52} => {2}' -f $c[0], $c[2], $(if ($hits -eq 0) { '0 命中 OK' } else { "$hits 行 ✗" })
}
```

> 组②必须**限定单文件**（`aria-label="访谈提纲草稿"` 为探针红线，全域检索必然误报）；组⑨/⑪同理限定（0.2-D4 副本属预期原状）。
>
> 组⑦已按**裁决 ❶** 收窄为 `src\components\home`（`project-workflow-board.tsx:29` 注释本批跳过 → 该文件不得入库 diff）。
>
> 组⑥/⑫必须用**精确字面**（带前导 `}`）：裸字 `个项目` 实测 2 处误报（`这个项目` / `整个项目库`），裸字 `已完成` 实测 7 处误报（`审校已完成` / `statusMap.completed`）—— 脚本已按精确字面写入，**改宽即失真**。

```powershell
# 探针改动前备份（§2）
New-Item -ItemType Directory -Force -Path 'tmp\_backup_REQ28A' | Out-Null
'run-batch1\visual-check.mjs','verify-phase1.mjs' | ForEach-Object {
  $src = Join-Path 'tmp' $_
  $dst = Join-Path 'tmp\_backup_REQ28A' ($_.Replace('\', '_'))
  Copy-Item -LiteralPath $src -Destination $dst -Force
  "backed up: $src -> $dst"
}
```

**依据来源**：PRD `§4 REQ-28-A`（L48–66，15 条含处置列）；IMPL `§0.2-D4 / §2.1`（L90–108）/ `§3.2 / §3.5`（L288–299）/ `§5.1 / §5.2`；**总管 2026-10-07 七点裁决**（A-11/A-12 删除、同点合并、A-08 原样、A-10「整理中」、A-13 最小表达式、`:111` 连带、`建档时间` 副本不动、A-09「待审核」）；**总管 2026-10-07 条件放行三点**（❶ `project-workflow-board.tsx:29` 注释本批跳过 ／ ❷ `:78` `mt-2` 授权为必要连带 ／ ❸ `verify-phase1.mjs:217` 纳入必改 ＝ 5 行方案）；行号为本轮对 `src/**` 与 `tmp/**` 的全量只读实测（HEAD `6b777a6`，2026-10-07）。