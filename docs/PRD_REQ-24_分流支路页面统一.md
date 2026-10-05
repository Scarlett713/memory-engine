# REQ-24 分流支路页面统一（上传页 / 访谈页）· PRD

> **编号已裁决（2026-10-06）**：本条取 **REQ-24**。`docs/需求登记表.md:345` 的 **REQ-23「文稿修改日志 / 历史版本」保持不动、零迁移**——其 `:64`（总览）、`:714`（§5.1 索引）、`:740`（§5.2 关联）三处引用一并原样保留。
> 本轮**不登记需求登记表、不通知 DS CLI**（按起草指令）。

- **文档定位**：产品口径文档（PRD）。代码改动计划另立 `docs/IMPL_REQ-24_分流支路页面统一.md`（不在本条范围）。
- **依据**：`docs/PRD_REQ-21_新建流程统一.md`、`docs/PRD_REQ-16_首页与新建流程重构.md`、`docs/IMPL_REQ-16_首页与新建流程重构.md` §9.4、`docs/需求登记表.md`、工作区实测（HEAD `66515f5`，`git status` clean）。
- **状态**：草稿（待总管审查）。
- **来源**：产品方（总管）2026-10-06 指令；冲突现象在 REQ-16 / REQ-21 交付后的实机走查中发现。
- **优先级**：P1（认知一致性缺陷，落在「唯一新建入口」主链路上）。
- **落点**：`/upload?outline=1`（上传支路）、`/projects/{id}/interview`（AI 访谈支路）。
- **关联**：REQ-21（新建三步流程；本条改其 P3 口径）、REQ-16（旧路由裁决：`/upload` 保留为链路路由）、REQ-13（提纲会话草稿）、REQ-14（D7=B′ AI 入口 + P8 访谈页顶栏）。
- **硬约束摘要**：不动提交链路 / `ConsentDialog` / 数据层 / 草稿结构 / 路由表 / `globals.css`；不引 npm 包；不新增 `!important`；复用 `hasOutlineFlag`。

## 0. 一句话概述

从新建流程「分流步」（步骤三）进入的两条支路页 —— 上传页与 AI 访谈页 —— 都把「上一步」统一指回**分流步**；上传页在流程入口下**不再暴露上传向导自己的三步步骤条**（只留本步核心操作：选文件 + 提交）；**直接访问 `/upload`（无标记位 / 无草稿）的旧版向导逐字零变化**。

## 1. 背景

### 1.1 现状实测（HEAD `66515f5`，工作区 clean）

1. 分流步「上传音频」恒定带标记位跳转：`route-chooser.tsx` → `/upload?outline=1`（`tmp/cdp-req13-outline.mjs:328-329` 已记录该口径）。
2. 上传页 `interview-upload-form.tsx`（972 行）自带一套**三步向导**：
   - `wizardSteps`（`:77-81`）：01 基础信息 / 02 采集路径 / 03 上传音频；
   - 步骤条渲染区（`:481-509`，当前步 `aria-current="step"` 在 `:492`）；
   - 落点计算（`:229-239`）：`hasOutlineFlag && ready` → **step = 3**，否则 `ready ? 2 : 1`；
   - `hideBackButton = step === 3 && hasOutlineFlag`（`:389`）——**流程入口下把底栏「上一步」藏掉**（渲染条件在 `:921`）。
3. 访谈页顶栏「返回提纲」（`interview-console.tsx:970-979`）→ `/projects/${id}/outline`，**该路由不存在** → 必然 404（PRD-21 §11-4 / `IMPL_REQ-16` §9.4:533 留档）。
4. 旧版裸访问 `/upload`（无标记位、无草稿）仍走完整三步向导（`:238` 的 `return ready ? 2 : 1`）。
5. 上传页顶栏「返回工作台」→ `/`（`upload-workspace.tsx:22-28`），语义 = 放弃新建、回首页。

### 1.2 四个认知冲突（本条要解决的，按用户可见度排序）

| # | 现象 | 用户感受 |
| --- | --- | --- |
| A | 新建流程已是「基本信息 → 提纲 → 分流」三步，从分流步进入上传页后**又出现一套 01/02/03 步骤条，且定位在第 02 步** | 「刚选的上传音频，怎么还在第 2 步？是不是少了什么」 |
| B | 上传页底栏「上一步」在流程入口下**被藏掉**（`hideBackButton`），而访谈页却有一个返回入口 | 两条支路行为不一致，无法形成稳定心智 |
| C | 访谈页「返回提纲」文案与落点自相矛盾（点进去 404） | 「上一页」不可信 |
| D | 同一动作「返回上一步」在三条路径下指向三处：工作台（`/`）、提纲工作台、未定义 | 用户靠猜 |

### 1.3 为什么现在做

- 冲突 A/B 落在 REQ-16/21 落地的**唯一新建入口**主链路上，是首屏体验的一部分；
- 冲突 C 是**现存 404 入口**，与该批交付同源，顺手收口成本最低；
- 改动面集中在 2 个生产文件、零数据层风险，且**必须重写的那条断言面（H5 / 13-B / 13-C）范围已实测清楚**（§6.3）——越晚做，迁移成本越高。

### 1.4 已确认的产品方向（总管，2026-10-06）

1. 从分流步进入的上传页 / 访谈页，其返回一律指向**步骤三（分流步）**；
2. 上传页 `?outline=1` 入口：**去掉三步步骤条（不告诉用户第几步）**，只保留核心操作：**选文件 + 提交**（`ConsentDialog` 逻辑不动）；
3. **保留直接访问 `/upload` 的旧版 UI**（零变化）。

## 2. 目标与非目标

**目标**

- G1 认知统一：上传页 / 访谈页在流程入口下都表现为「新建流程的第三步」，返回一律回分流步。
- G2 上传页流程入口下只呈现本步内容（选文件 + 提交），无步骤条、无向导式内部步进。
- G3 旧版零变化：裸 `/upload` 的三步向导（步骤条、步进、校验、文案）逐字不变。
- G4 最小改动：不改提交载荷、`ConsentDialog`、数据层、草稿结构；不新增路由 / 依赖 / `!important`。

**非目标**

- 不把上传能力并入 `/projects/new`（PRD-16 §5.1 未采纳备选仍留档）。
- 不改造分流步本身（`route-chooser.tsx` 不动）。
- 不给访谈页加「步骤条」或「新建流程进度」UI。
- 不做 `/projects/new?step=route` 的草稿回填（属 REQ-15 草稿区，见 §7.2）。

## 3. 范围

### 3.1 改（本条交付面）

| 面 | 改动 |
| --- | --- |
| 上传页 | 新增「流程入口分支」（无步骤条、无步骤一/二表单、底栏「返回上一步」→ 分流步）；裸访问路径逐字不变 |
| 访谈页 | 顶栏返回落点 `/projects/{id}/outline` → `/projects/new?step=route`；文案「返回提纲」→「返回上一步」；补稳定锚点 |
| 探针 | `tmp/verify-phase3.mjs`（H5 改对象 + 新增 J1–J3 + `enterUploadStep3()` 判据迁移）；`tmp/cdp-req13-outline.mjs`（13-B / 13-C 上传页断言改判据） |
| 文档 | 本文；IMPL 另立；`hideBackButton`（P3）口径变更须在 IMPL 记录（原决策只在代码注释里，见 §3.3） |

### 3.2 不改（回归红线）

- **提交链路**：`submitProject()`、`validateStepOne()`、`handleFormSubmit`、载荷字段名与取值路径（`:391-460` 区段）。
- **`ConsentDialog`**（`:85` 起）：portal 到 `body`、遮罩 `fixed` 铺满、`onCancel` 行为、`[data-upload-modal="consent"]` 锚点。
- **密级默认值与校验**（REQ-16/21 遗留修复 I1 的成果）。
- **数据层 / API / 导出 / 草稿结构**：`src/lib/types/project.ts`、`src/lib/server/project-store.ts`、`src/lib/server/project-export.ts`、`src/lib/outline-session.ts`（`OUTLINE_FLAG_PARAM`、`readInitialOutlineDraft` 语义）；**不新增第二个 `sessionStorage` key**（PRD-16 §7）。
- **路由表与鉴权**：不新增 / 删除路由；`src/proxy.ts` 的 `PUBLIC_PATHS` / `STATIC_PREFIXES` / `matcher` 不动。
- **旧版向导**：`/upload`（无标记位，或 `?outline=1` 但草稿不就绪）逐字不变。
- `upload-workspace.tsx`（顶栏「返回工作台」→ `/`）、`route-chooser.tsx`、`new-project-flow.tsx`、首页组件、`globals.css`。
- 访谈页「退出访谈」（`[data-interview-exit="trigger"]`）→ 首页的语义与二次确认。

### 3.3 与相邻需求的口径边界

- **本条显式取代 REQ-21 的 P3 口径**（`interview-upload-form.tsx:383-389`：流程入口下藏掉内部「上一步」）。该决策**此前未进入任何产品文档**——起草前对 `docs/` 全目录逐文件检索：`hideBackButton` **零命中**、「步骤条」**零命中**（仅 `docs/PRD_REQ-21_新建流程统一.md:59` 出现过「步骤三」字样）。因此本条是它的第一次文档化落点；实施时须在该文件注释里同步改写理由，并在 IMPL 里留一条「口径变更」注记。
- **REQ-16 §5.1 的裁决不变**：`/upload` 保留为上传链路实现路由、非首页入口；本条只在**页内形态**上分叉，不动路由与入口数（首页入口计数仍 = 1）。
- **REQ-14 P8 不变**：访谈页「返回（非破坏，进度保留）/ 退出访谈（放弃，回首页）」的**语义二分**保留，只改返回的落点与文案。

## 4. 功能规格

### 4.1 分支判据（本条核心设计）

```
flowMode  =  hasOutlineFlag  &&  ready
             └─ ?outline=1        └─ prefill.profile.projectName && intervieweeName（:230-232）
```

- 该判据**与既有落点判据同源**（`:234-236`）、**与 `hideBackButton` 条件等价**（`:389`）——实施上是「零新增 state、零新增 URL 参数」，只把受控范围从「底栏一个按钮」扩到「步骤条 + 步骤一/二内容 + 底栏返回」。
- `flowMode === false` ⇒ 页面**逐字走原逻辑**（`:238`），旧版零变化。
- 反例防护：**裸 `/upload?outline=1`（无草稿）必须落旧版**。若只看 flag 不看 `ready`，必填字段无 UI 可填 → 提交必被 `validateStepOne()` 弹回 → **死路**。此条为规格，不是实现细节。

### 4.2 新版 UI 形态（`flowMode === true`）

**移除**（不进入 DOM；且**不得**用 `hidden` / `sr-only` / `disabled` 等「仍在 DOM」的方式）：

1. 步骤条整块（`:481-509` 的 `<ol>`）；判据沿用既有读法：`button[aria-current="step"]` **不存在**。
2. 步骤一主体：`#projectName` / `#intervieweeName` / `#confidentialityLevel` / `#notes` 等（值仍由 `prefill` 初始化，**仅不渲染**）。
3. 步骤二主体（采集路径卡片）。
4. 步骤一内的「已带入提纲」折叠区（`#outlineDraftMarkdown`，`:656` 起的 `<details>`）——见 §9 ②。

**保留**（本步核心操作，语义与文案零变化）：

1. 「音频语言 / 方言」选择（与「上传音频材料」同属步骤三内容，且是提交载荷字段之一）；
2. 上传音频材料控件（`input[type="file"]`）；
3. 提交按钮 **「创建项目并开始处理」**（`:904` 口径）→ 仅 `setConsentOpen(true)`；`ConsentDialog` 与提交链路不动；
4. 顶栏「返回工作台」→ `/`（`upload-workspace.tsx`，零改动）：语义 = **放弃新建回首页**，与访谈页「退出访谈」对称；
5. 底栏左侧说明文案（**仅保留步骤三那一支**）。旧版在 step 3 下渲染的正是该支 ⇒ 无新增文案、无文案断言语义变化。

### 4.3 上传页返回落点

- 在**底栏原「上一步」位置**（`:921` 的条件分支处）渲染返回入口：`Link`（**不是** `Button + router.push` —— 需要真实 `a[href]` 以支持断言 / 中键新开 / 无 JS 兜底），`href="/projects/new?step=route"`，文案 **「返回上一步」**（与访谈页、新建流程 header 三处统一；旧版按钮标签「上一步」按 §4.5 保持不动）。
- 不保留 `hideBackButton` 语义：该分支整体被本条取代（§3.3）。
- **往返无损**：返回时不写 / 不清草稿；从分流步再次点「上传音频」→ 仍为 `/upload?outline=1` + 草稿就绪 → 仍进新版。
- 不使用 `router.back()`：浏览器历史不可控（可能来自外链 / 刷新后的空历史），落点必须是**确定 URL**。

### 4.4 访谈页返回落点

- `interview-console.tsx:970-979`：`href` 改为 `/projects/new?step=route`，文案改为 **「返回上一步」**，保留 `Link` 语义、`ArrowLeft` 图标与 `className`（视觉零变化）。
- 同步更新该处注释：仍为「非破坏，进度保留」；「退出访谈」不动。
- 副带收口：本条**移除了 `/projects/{id}/outline`（不存在）在 UI 上的最后一处入口**；`interview/page.tsx:26-28` 的 `redirect('/projects/{id}/outline')` 目标仍为 404，**保持已知遗留**（PRD-21 §11-4 / `IMPL_REQ-16` §9.4:533），不在本条范围。

### 4.5 旧版零变化（回归红线，逐条可验）

- 无标记位（`/upload`）、`?outline=1` 但草稿不就绪、`?outline=0` ⇒ 走 `:238` 原逻辑；
- 步骤条三步可见、当前步 `aria-current="step"` 正常、点步骤条回退（`canGoBack`）正常、「上一步」按 `step > 1 && !hideBackButton` 原样出现（`flowMode` 为假时 `hideBackButton` 恒为假）、校验与错误文案不变；
- **不得**为「统一观感」给旧版做任何可见改动（标题 / 图标 / 顶栏 / 文案）。

### 4.6 稳定锚点登记（新增，供 CDP 断言）

| 锚点 | 位置 | 用途 |
| --- | --- | --- |
| `[data-upload-flow="from-route"]` | 上传页新版分支根节点（`<section>` 或 `<form>`） | J1：分支存在性 |
| `[data-upload-back="route-step"]` | 新版底栏「返回上一步」`Link` | J2：返回落点 |
| `[data-interview-back="route-step"]` | 访谈页顶栏返回 `Link` | J3：返回落点 |

- 命名沿用既有 `data-*` 约定（`data-step-next` / `data-upload-modal` / `data-route` / `data-interview-exit`）。
- **锚点只加在新增 / 改动节点上；旧版节点不得加标记**——否则 J1 的负向判据（旧版无此标记）失效。

### 4.7 响应式

- 视口口径：**375×667 为下限**、**390×844 为主力**，另跑 1440×900 桌面。
- 底栏保持现有 `flex-col gap-3 sm:flex-row`（小屏纵向堆叠、按钮全宽）；无横向溢出。
- 新版移除两块内容后**只应更矮**；375×667 下不得出现提交按钮被推出视口。

## 5. 技术约束（硬约束，实施与审查共同适用）

| # | 约束 |
| --- | --- |
| C1 | **不改提交链路**：`submitProject()` / `validateStepOne()` / `handleFormSubmit` 与载荷字段名、取值路径不变（由 M4 验）。 |
| C2 | **不改 `ConsentDialog`**（结构 / portal / 遮罩）；I2 / I3 断言面保持绿。 |
| C3 | 不改密级默认值与校验（I1 断言面保持绿）。 |
| C4 | 不改数据层 / API / 导出 / 草稿结构；不新增 `sessionStorage` key；`outline-session.ts` 零字段改动。 |
| C5 | 不新增 / 删除路由；`src/proxy.ts` 三个常量不动。 |
| C6 | **不引入任何 npm 依赖**；探针保持零依赖（Node 内置 WebSocket 直连 CDP）。 |
| C7 | **不新增 `!important`**；`globals.css` 的 `!important` 计数维持 **0**；不改其布局 token。 |
| C8 | 任何 `fixed` 定位元素都**不得**以 `paper-panel`（或其祖先链）为父 —— 沿用既有约束与 I2 的 `escaped` 断言口径。 |
| C9 | 复用既有判据：`hasOutlineFlag`（`OUTLINE_FLAG_PARAM`）+ 草稿就绪；不新增 query 参数、不改 `?outline=1` 语义。 |
| C10 | 既有可定位标识**不得改名**：`创建项目并开始处理`、`input[type="file"]`、`[data-upload-modal="consent"]`、`#route-chooser-upload`、`#route-chooser-realtime`、`#new-step-route`、`#outlineDraftMarkdown`（旧版对照仍读）、`[data-interview-exit]`。 |

## 6. 验证规格

### 6.0 计数口径

现状 `tmp/verify-phase3.mjs` 实测 **36 条 `check(`**；H5 **保留为 1 条但更换断言对象**（§6.3）；新增 **J1 / J2 / J3** ⇒ 终态 **39 条**，全绿（脚本以「存在 FAIL 即退出码 1」收口）。

### 6.1 新增断言（J 段；插入位置：I1 之后、B 段（清 cookie）之前）

**J1 · 流程入口下上传页不渲染步骤条（第 37 条）**

- 入口：`/projects/new` → 填 `#projectName` / `#intervieweeName` → `[data-step-next="outline"]` → 「跳过提纲，下一步」→ 分流步点 `#route-chooser-upload` → 落 `/upload?outline=1`。
- 断言：① `[data-upload-flow="from-route"]` 存在；② `button[aria-current="step"]` **为 null**（步骤条不在 DOM）；③ `#projectName`、`#intervieweeName` **不渲染**（步骤一内容已移除）；④ 本步核心控件在位：`input[type="file"]` 存在，且 `clickText('创建项目并开始处理')` 可命中。
- 灵敏度变异：**① `flowMode` 恒假（新版退回向导）** ⇒ ②③ 红；**② 步骤条整块从组件删除（旧版也删）** ⇒ 由 H5（旧版对照）红、J1 不红 —— **这正是 H5 必须保留为 1 条的原因**。
- 观察点：`flowMode` 落地值、`aria-current` 命中数（应为 0）、文件输入与提交按钮文案。

**J2 · 流程入口下「返回上一步」→ 分流步（第 38 条）**

- 入口：接 J1 同一次落地页面；**若独立运行则自行重跑入口**（不得依赖 J1 的页面残留，见 §6.2）。
- 断言：① 返回控件存在且文案为「返回上一步」（`[data-upload-back="route-step"]` 的 `innerText.includes('返回上一步')`，与 J3 ① 同法）；② 点击后 `location.pathname === '/projects/new'` 且 `search.includes('step=route')`；③ 落地页 `#route-chooser-upload` 与 `#route-chooser-realtime` **同时可见**（证明落的是分流步，不是提纲步 / 首页）；④ 再点 `#route-chooser-upload` 能回到 `/upload?outline=1`（往返闭合、草稿未丢）。
- 灵敏度变异：`href` 改成 `/projects/new?step=outline`（或 `/`）⇒ ② 红；返回入口删掉 ⇒ ① 红；文案改回「上一步」⇒ ① 红（新增文案断言的对应变异）。
- 观察点：点击前后 URL、分流步两张卡存在性、往返后的 URL 与 `[data-upload-flow]` 存在性。

**J3 · 访谈页「返回上一步」→ 分流步（第 39 条）**

- 入口：复用 G 段的建项目契约（`POST /api/projects/ai-interview`，payload 口径同 G 段）→ 落 `/projects/{id}/interview`；**不依赖 LLM**。探针项目 `finally` 内 `DELETE` 清理（200），与 G 段同做法；若排在 G 段清理之前可复用其项目 id，但**建议独立建、独立删**以避免耦合。
- 断言：① 返回控件文案为「返回上一步」且 `href === '/projects/new?step=route'`（`[data-interview-back="route-step"]`）；② 点击后落 `/projects/new?step=route`；③ 「退出访谈」（`[data-interview-exit="trigger"]`）**仍在**且语义未变（只改返回、不改退出）。
- 灵敏度变异：`href` 改回 `/projects/{id}/outline`（现状 404 目标）⇒ ① 红；删掉退出按钮 ⇒ ③ 红。
- 观察点：`href`、落点 URL、退出按钮存在性、项目清理状态码。

### 6.2 变异-影响矩阵（每条变异只允许红一条）

| 变异 | 预期红 | 预期不红 |
| --- | --- | --- |
| ① `flowMode` 恒假（新版回到向导） | J1 | H5、I1、I2、I3 |
| ② 步骤条整块删除（含旧版） | H5 | J1、J2、J3、I1–I3 |
| ③ 新版返回 `href` 改错 | J2 | J1、J3、H5 |
| ④ 返回控件删除 | J2 | 其余 |
| ⑤ 访谈页 `href` 改回旧目标 | J3 | 其余 |
| ⑥ 退出访谈按钮删除 | J3 | 其余 |
| ⑦ 新版返回文案改回「上一步」 | J2 | 其余 |

> 变异 ① 是本条唯一需要显式处理的隔离成本：J2 **不得**写成「依赖 J1 的页面残留」，须自带入口步骤（与 I1–I3 共用 `enterUploadStep3()` 的既有先例一致）。

### 6.3 既有断言迁移（不得删断言）

| 断言 | 现状 | 迁移后 |
| --- | --- | --- |
| `verify-phase3` **H5** | 「经分流步落步骤三 + 内部『上一步』隐藏 + 回步骤二」 | 改对象为**旧版对照**：「裸 `/upload` 三步向导完整：步骤条三步可见、`aria-current` 正确、`step > 1` 时『上一步』可用且逐级回退正确」。原「隐藏上一步」半条被本条推翻（§3.3），其反向语义由 J2 接管。**仍 1 条**。 |
| `verify-phase3` `enterUploadStep3()` `:688` | `waitFor('button[aria-current="step"]')` | 改为 `waitFor('[data-upload-flow="from-route"]')`；I1 `:697` 的 `upStep()` 取样移除（仅用于 detail 文案，不影响判定）。I1 / I2 / I3 **仍各 1 条**。 |
| `cdp-req13-outline` **13-B** `:293` | `atUpload.step.includes('采集路径')`（读步骤条） | 改为断言 `[data-upload-flow="from-route"]` 存在 + 落点仍为 `/upload?outline=1`（「不经步骤一」在新形态下等价于「步骤一不渲染」）。 |
| `cdp-req13-outline` **13-B** `:301-302`、**13-C** `:331-337` | 读步骤一折叠区 `#outlineDraftMarkdown`（`backToStep1()` 点步骤条回步骤一） | 新版面已不渲染步骤一 ⇒ 改为**旧版对照 + 草稿持久性**判据：「流程入口落地后 `sessionStorage` 草稿完整（`profile` 两项齐、提纲非空；跳过时为空）」，并以裸 `/upload` 对照（「不串味」段 `:304-313` 保持原样——**旧版仍读 `#outlineDraftMarkdown`**）。「提纲带入是否生效」的端到端证据改由**提交载荷**承担（与 I1 的 fetch 桩同法），实现细节在 IMPL 定稿。 |
| `verify-phase2.mjs` | 已退役 | 不动（`IMPL_REQ-16` §9.4:530 先例：失去对象的旧探针可退役，但须写明「非产品回归」）。 |
| `cdp-req13-crosscut.mjs` / `measure-375.mjs` | 未登录直连 / 首页高度 | 不受影响，回归跑绿即可（`/upload` 路由与首页均未动）。 |

### 6.4 人工测试（M1–M5）

| # | 场景 | 前置 | 期望 | 失败判据 |
| --- | --- | --- | --- | --- |
| M1 | 全链路 | 已登录，空草稿 | 首页「新建」→ 基本信息 →（生成或跳过）提纲 → 分流步「上传音频」→ 上传页：**无步骤条**，只有选文件 + 语言/方言 + 提交；选文件 → 提交 → 弹窗 →「我确认」→ 建项目并进处理链路 | 页面出现 01/02/03；提交后未建项目 / 未跳转 |
| M2 | 返回一致性 | 接 M1 的上传页 | 上传页「返回上一步」→ 分流步（步骤三）；访谈页「返回上一步」→ 分流步；两处落点 URL 相同，且两次都可再进另一条支路 | 任一落点 ≠ `/projects/new?step=route`；返回后草稿丢失（再进上传页为空） |
| M3 | 旧版零变化 | 清空 `sessionStorage` | 裸 `/upload` → 三步向导完整（步骤条 3 步、全字段、上一步、校验文案与改造前逐字一致）；`/upload?outline=1`（草稿为空）→ **落步骤一**且不死路 | 裸 `/upload` 缺步骤条；`?outline=1` 无草稿落新版，或提交被弹回却无字段可填 |
| M4 | 数据与提交等价 | 同一份草稿 | 提交载荷与改造前逐字段一致（`projectName` / `intervieweeName` / `confidentialityLevel` / `notes` / `outlineMarkdown` / 音频文件）；`ConsentDialog` 遮罩仍铺满视口、portal 到 `body`；点遮罩取消 → 不跳转、不提交 | 任一字段变空 / 改名；遮罩未铺满；点遮罩触发提交或跳转 |
| M5 | 响应式与静态检查 | — | 375×667 与 390×844 无横向溢出、提交按钮在视口内可达；`npx tsc --noEmit` **0 error**；改动文件 eslint **0 problem**；`globals.css` `!important` 计数 **0** | 溢出 / 按钮不可达 / tsc 或 eslint 报错 / `!important` ≥ 1 |

### 6.5 静态检查与交付面

- `npx tsc --noEmit` **0 error**；改动文件 eslint **0 problem**。
- `globals.css` 的 `!important` 计数 = **0**（可复算）；无新增 npm 依赖（`package.json` 不变）。
- `git diff --stat`：生产代码 **2 个文件**（`interview-upload-form.tsx`、`interview-console.tsx`）；探针 2 个（`tmp/`，gitignored，不入 commit）。

## 7. 边界

### 7.1 本条不做

- 不把上传能力并入 `/projects/new`；不改分流步形态与卡片文案；
- 不给访谈页加流程进度 UI；不动「退出访谈」（放弃）语义；
- 不统一两条支路页的**版式**（上传页在 `upload-workspace` 内、访谈页独立全屏，属既有结构，本条只统一「返回」口径）；
- 不改首页、不改历史项目卡片。

### 7.2 已知遗留（明确记录，本条不复修）

1. `interview/page.tsx:26-28`：无提纲时 `redirect('/projects/{id}/outline')`，目标路由不存在（PRD-21 §11-4 / `IMPL_REQ-16` §9.4:533 保持「已知遗留」）。本条只移除 UI 入口。
2. `/projects/new?step=route` 冷启动 / 从支路返回时不回填 `basicInfo` ⇒ 分流步「AI 实时访谈」会因缺基本信息而禁用（需再点一次「返回上一步」到提纲步，由提纲步从草稿读回）。归 **REQ-15 草稿区**（PRD-21 §9-9 已声明不阻塞），见 §9 ①。
3. `tmp/cdp-req13-prefill.mjs` 因 UI-12 字段 id 变更失效（PRD-16 `:226`），与本条无关。

### 7.3 冻结约束（继续有效）

数据层（`types/project.ts` / `project-store.ts`）、导出 API（`project-export.ts`）、provider（`ark-llm-provider` / `mock-llm-provider`）、`globals.css` 的 `!important` 禁令 —— 本条**不触任何一条**。

## 8. 风险

1. **断言面牵连**（最高）：J 段与 H5 / I1–I3 / 13-B / 13-C 共用同一条页面链路，迁移须**一次到位**，否则「改绿一条、红三条」；迁移清单以 §6.3 为唯一依据，IMPL 逐条落点。
2. **证据降级**：新版不再渲染步骤一折叠区 ⇒ 13-B / 13-C 的「提纲预填」由 UI 证据降级为「草稿持久性 + 提交载荷」证据。必须在 IMPL 写明**为什么这不是产品回归**（否则复现 `IMPL_REQ-16` §9.4 的「零断言覆盖」隐患）。
3. **判据同源陷阱**：`flowMode` 必须与 `ready` 强绑。若实现只看 `hasOutlineFlag`，无草稿访问 `/upload?outline=1` 将进入**必被弹回且无字段可填**的死路（M3 专测）。
4. **口径再次沉底**：本条推翻的 P3（`hideBackButton`）当初只写在代码注释里 —— 本次口径变更必须同时进 PRD（§3.3）、IMPL 与代码注释三处，避免第三轮「决策只在注释里」。
5. **旧版被顺手「优化」**：旧版是历史直链与内部兜底的唯一完整入口，任何「顺手统一观感」都会扩大回归面（§4.5 为红线）。

## 9. 待确认

⓪ **【已裁决（2026-10-06）】本条编号**：取 **REQ-24**；既有 REQ-23「文稿修改日志 / 历史版本」保持不动（`需求登记表.md:64/345/714/740` 四处零改动）。本轮**不登记需求表、不通知 DS CLI**。

① **返回后是否回填基本信息**：从支路返回分流步时，「AI 实时访谈」会因 `basicInfo` 为空而禁用（§7.2-2）。**本稿默认不做**（归 REQ-15）；若要求做，须在 §4.3 追加「`?step=route` 时自草稿回填 `basicInfo`」并新增对应断言。

② **新版是否保留只读的「已带入提纲（N 字）」摘要行**：按方向 2「只保留核心操作」，**本稿默认不保留**（代价见 §8 风险 2）。若要求保留（保住 13-B / 13-C 的 UI 证据、让用户确认带入内容），按「一行只读摘要 + 无编辑态」回填 §4.2。

③ **访谈页返回文案**：落点改为分流步后，保留旧文案「返回提纲」会自相矛盾。**本稿默认改为「返回上一步」**；若需保留「提纲」字样（如「返回提纲步骤」），请裁决文案。

④ **P3 口径的文档化落点**：是否随本条在 IMPL 内补一条「REQ-21 P3 口径被取代」修订注记（并同步 `interview-upload-form.tsx:383-389` 注释）？**本稿默认：是。**

⑤ **顶栏「返回工作台」（→ `/`）是否与新版「返回上一步」并存**：**本稿默认并存**（放弃新建 vs 回上一步，与访谈页「退出 / 返回」对称），`upload-workspace.tsx` 零改动。若要求藏掉，请裁决。

## 10. 涉及文件清单

**修改（生产代码，2 个）**

- `src/components/upload/interview-upload-form.tsx`：新增 `flowMode` 分支（步骤条 + 步骤一/二内容受控移除）；底栏返回改为 `Link → /projects/new?step=route`（`data-upload-back="route-step"`）；根节点加 `data-upload-flow="from-route"`；`hideBackButton` 分支与 `:383-389` 注释同步改写。
- `src/components/interview/interview-console.tsx`：`:974` 的 `href` → `/projects/new?step=route`；文案 →「返回上一步」；加 `data-interview-back="route-step"`；`:970-971` 注释同步。

**修改（探针，`tmp/`，gitignored 不入 commit）**

- `tmp/verify-phase3.mjs`：H5 改对象；新增 J1–J3；`enterUploadStep3()` 判据迁移。
- `tmp/cdp-req13-outline.mjs`：13-B / 13-C 上传页断言改判据（`UPLOAD_STEP` 仅留旧版对照用）。

**新增（文档）**

- `docs/PRD_REQ-24_分流支路页面统一.md`（本文）。
- `docs/IMPL_REQ-24_分流支路页面统一.md`（另立；含 §6.3 迁移实现与 P3 口径修订注记）。

**明确不改**

- `src/lib/types/project.ts`、`src/lib/server/project-store.ts`、`src/lib/server/project-export.ts`、`src/lib/outline-session.ts`、`src/components/new-project/route-chooser.tsx`、`src/components/new-project/new-project-flow.tsx`、`src/components/upload/upload-workspace.tsx`、`src/app/upload/page.tsx`、`src/app/projects/[projectId]/interview/page.tsx`、`src/proxy.ts`、`src/app/globals.css`、首页组件、`package.json`。

## 11. 产品方向 → 章节对照（可追溯）

| 已确认方向（2026-10-06） | 落点 |
| --- | --- |
| 从分流步进入的上传页 / 访谈页返回指向步骤三 | §4.3、§4.4、J2、J3、M2 |
| `?outline=1` 去掉步骤条、只留选文件 + 提交（`ConsentDialog` 不动） | §4.1、§4.2、J1、C1–C3、M1、M4 |
| 保留直接访问 `/upload` 的旧版 UI | §3.2、§4.5、H5（改对象）、M3 |
| 硬约束（不改提交 / 数据层 / 不引包 / 不加 `!important` / 复用 `hasOutlineFlag` / 375·390 视口） | §5 C1–C10、§4.7、M5 |

---

**本文状态**：草稿，待总管审查（未登记需求表、未通知 DS CLI）。



