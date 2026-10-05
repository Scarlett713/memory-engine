# REQ-16 首页与新建流程重构 · 实施计划（IMPL）

- **文档定位**：本文是**代码改动计划**，不是 PRD。产品口径见 `docs/PRD_REQ-16_首页与新建流程重构.md`；与 REQ-21 的分工见该 PRD §6。
- **依据**：`docs/PRD_REQ-16_首页与新建流程重构.md`（288 行，commit `2816582`）、`docs/PRD_REQ-21_新建流程统一.md`、`docs/需求登记表.md` v2.0（REQ-16 / REQ-21 = 「已验收（2026-10-05）」）。
- **已裁决（2026-10-05）**：`/upload` 保留为上传链路实现路由、降级为非首页入口；`/projects/new/outline` 重定向到 `/projects/new`（PRD §5）。
- **本批次执行决策**：
  - **D1-A**：REQ-16（首页 IA + 旧路由裁决）与 REQ-21（新建三步流程）**同批交付**，`home-dashboard.tsx` 只改一次（PRD `:201`）。
  - **D2-1**：`/projects/new/outline` → **307 → `/projects/new?step=outline`**，旧书签直接落到「提纲」步骤，CDP 回归面最小。
- **交付物性质**：本文档随 REQ-16 / REQ-21 收口提交一并 commit（2026-10-05）；本轮收口内容与覆盖缺口闭合见 **§9.4**。

---

## 0. 读前须知：三个前置事实与两个已裁决点

### 0.1 F1 · 重定向目标路由当前不存在

`src/app` 现有路由：`/`、`/login`、`/register`、`/upload`、`/projects/new/outline`、`/projects/[projectId]`、`/projects/[projectId]/interview`。

**`/projects/new` 不存在**。因此「重定向到 `/projects/new`」的前置条件是本批次先新建该路由（§1.1、§3）。REQ-21 PRD `:4` 已建议此路由名，两份 PRD 均声明同批实施。

### 0.2 F2 · 三个 CDP 脚本不在 git 中

`.gitignore:54` = `tmp/`；`git ls-files tmp` 返回 0 行。

**影响**：§6 对三脚本的断言迁移改的是工作区本地文件，**不会出现在 `git status` 或任何 commit 中**；三脚本的验收口径只能是「本地跑脚本、退出码 0」，不能靠 diff 评审。

### 0.3 F3 · `cdp-req13-outline.mjs` 当前已是红的（UI-12 遗留，与 REQ-16 无关）

提纲工作台经 UI-12 收敛为「单卡三控件」，现有表单字段 id 仅三个（`outline-plan-workspace.tsx`）：

| 字段 | 行 | id（`idPrefix="outline"`，调用点 `:735`） |
| --- | --- | --- |
| 访谈主题 | `:407` label / `:412` input | `#outline-topic` |
| 访谈对象姓名 | `:421` label / `:426` input | `#outline-subject` |
| 访谈内容概述 | `:435` label / `:439` textarea | `#outline-overview` |

`renderProfileCard(idPrefix)`（`:386`）三个挂载点：`:735`（阶段 1 桌面，`"outline"`）、`:798`（移动端 Tab 副本，`"outline-mobile"`）、`:893`（抽屉副本，`"outline"`）。

脚本中以下写入目标**已随 UI-12 消失**；`__t.set` / `__t.pick` 找不到选择器会直接抛错（脚本 `:55-63`），13-A 必然中断：

| 脚本行 | 目标 | 状态 |
| --- | --- | --- |
| `:211` | `#outline-institution` | 已移除 |
| `:212` | `#outline-scenario` | 已移除 |
| `:213` | `#outline-focus` | 已移除 |
| `:217-228` | 「添加事件」/ `#outline-event-0/1` / `#outline-timepoint-0` | 已移除（并入「访谈内容概述」） |
| `:209-210` | `#outline-subject` / `#outline-topic` | **仍在** |

旁证：`tmp/cdp-req13-crosscut.mjs:160-161` 只写 `#outline-subject` / `#outline-topic`，故该脚本此项**未红**；`#outlineDraftMarkdown` 仍在（`interview-upload-form.tsx:621`），13-B / 13-C 相关断言有效。

> **结论（工作拆分）**：CDP 工作必须拆成两块 —— **(1) 基线修复**（UI-12 遗留失效选择器）、**(2) REQ-16 迁移**（双入口→单入口、旧路由→新入口）。实施时先记录基线（§9 步骤 1），再动生产代码。**不得**把 (1) 冒充成 REQ-16 的回归成本。

### 0.4 已裁决点汇总

| 编号 | 结论 | 出处 |
| --- | --- | --- |
| D1-A | REQ-16 与 REQ-21 同批交付；`home-dashboard.tsx` 只改一次 | PRD `:201` |
| D2-1 | `/projects/new/outline` → 307 → `/projects/new?step=outline` | 本轮拍板（PRD §5.2 的细化解释） |

---

## 1. 涉及文件清单

### 1.1 新增

| 文件 | 职责 | 归属 |
| --- | --- | --- |
| `src/app/projects/new/page.tsx` | 新建流程宿主路由；透传 `searchParams.step` | REQ-21（PRD-21 `:170` 点名；REQ-16 只定路由名口径） |
| `src/components/new-project/new-project-flow.tsx` | 三步流程容器（client component） | REQ-21（自拟命名；PRD-21 `:170` 仅写 `new-project/*-form.tsx`，容器是否拆分由实施判断） |
| `src/components/new-project/basic-info-form.tsx` | 基本信息步（2 必填） | REQ-21 §4 |
| `src/components/new-project/route-chooser.tsx` | 分流步（实时访谈 / 上传音频）；**视拆分需要**，可并入流程容器 | REQ-21 §4（自拟命名；若独立成文件须在 §3.3 登记稳定 id） |
| `src/components/home/home-zone-card.tsx` | 首页三区通用外壳（eyebrow + 标题 + 内容槽）；**视拆分需要（可选）** | REQ-16 |
| `src/components/home/draft-box.tsx` | 草稿区；REQ-15 未到位时仅渲染空态 | REQ-16 §3.3 |

### 1.2 修改

| 文件 | 改动 | 归属 |
| --- | --- | --- |
| `src/components/home/home-dashboard.tsx` | header 双 CTA 收敛为单入口；标题 / 描述按三区改写；三区容器（§5） | REQ-16 |
| `src/components/home/recent-project-list.tsx` | 下沉为历史项目区；「打开」提升为显式按钮；当前阶段展示；滚动恢复容器适配（§2.2） | REQ-16 |
| `src/components/outline/outline-plan-workspace.tsx` | 仅在需以「流程步骤」形态被宿主渲染时抽外壳（回退链接、宿主 header）；**功能零改动** | REQ-21 |
| `src/components/upload/interview-upload-form.tsx` | 接收基本信息预填、按需跳过步骤一中重复字段（`:464-537`：`#projectName`:473 / `#intervieweeName`:487 / `#collectionScenario`:501 / `#customScenarioLabel`:527） | REQ-21 §8（PRD-21 `:175` 点名必改） |

### 1.3 重定向（改写、不删文件）

| 文件 | 改动 |
| --- | --- |
| `src/app/projects/new/outline/page.tsx` | 5 行 → 服务端 `redirect()` 壳，见 §4 |

### 1.4 明确不动

`src/app/upload/page.tsx`（裁决保留）、`src/proxy.ts`、`next.config.ts`、`src/app/layout.tsx`、`src/app/page.tsx`、`src/lib/**`、`src/app/api/**`、`package.json`、`src/app/globals.css`（仅当三区确需新 token 时才评估，默认不动）。

### 1.5 非生产（gitignored，见 F2）

`tmp/cdp-req13-outline.mjs`、`tmp/cdp-req13-crosscut.mjs`、`tmp/measure-375.mjs`。

三脚本为本地回归资产：**不可删除、不可另建替代脚本、不可删任何断言**（§7-7）。

另有第四个脚本 `tmp/cdp-req13-prefill.mjs`：依赖旧 `#outline-*` id，**已随 UI-12 失效**（PRD `:226` 已登记，同 REQ-21 §8）。它与 REQ-16 无因果关系，**不列入本次必须转绿的清单**；若实施时顺手修复，须单独记录、不得计入 REQ-16 的验收证据。

---

## 2. 逐文件改动要点（行号 = 改动前实测值）

### 2.1 `src/components/home/home-dashboard.tsx`（现 100 行）

**不动**：`:22-23` 骨架（`min-h-dvh … xl:h-dvh xl:overflow-hidden` + `flex flex-col gap-2 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]`）、`:24` header 外框、`:25` header 内 flex、`:11-19` store/auth 依赖、`:27-31` `archive-mark` 徽标块。

| 行 | 现状 | 处置 |
| --- | --- | --- |
| `:36-37` | h1「已建档口述项目」 | 改为三区口径标题（建议「口述项目工作台」，文案最终口径见 UI-11，随 REQ-16 一并定稿） |
| `:38-40` | 描述「全部受访项目的归档入口。打开任一项目即可进入处理台…」 | 改写为覆盖三区（新建 / 草稿 / 历史项目）的描述 |
| `:44` | 右列容器（`flex flex-col gap-3 sm:flex-row … xl:min-w-[420px]`） | **保留容器**；`:45-52` 的 47px 占位推导注释**必须重写**：原推导前提是「本列现在是『槽位 / 新建访谈项目 / 新建访谈（含提纲生成）』三项」，单 CTA 后前提消失 |
| `:53` | `min-h-[47px]` | **先保留数值**，待 §9 步骤 6 用 `measure-375.mjs`（重定目标后）复测 375px / ≥640px 两个断点的实际跳变量后再定（PRD `:127` / §10 ⑥） |
| `:54-75` | 账户槽位（email + 版本 + 退出） | **功能与行为零改动**（PRD `:126`）；按 §3.5 语义归入「账户区」 |
| `:78-84` | CTA1 → `/projects/new/outline`「新建访谈（含提纲生成）」，`sidebar-secondary` | **删除**（旧入口收敛，PRD `:109`） |
| `:86-89` | CTA2 → `/upload`「新建访谈项目」，`sidebar-cta` | **改** `href="/projects/new"`；文案改「新建访谈」；`className` 保留 `sidebar-cta`；`Plus` 图标保留 |
| `:94-96` | `<section className="min-w-0 xl:min-h-0">` 单区包 `RecentProjectList` | 改为**三区容器**，见下 |

**三区容器形态（`:94-96` 替换目标）**：

```
375px   ：flex flex-col gap-2（三区纵向文档流，无横向溢出）
xl 及以上：xl:grid xl:grid-cols-[minmax(0,17rem)_minmax(0,17rem)_minmax(0,1fr)]
           并沿用 xl:min-h-0，三区各自区内滚动
```

- ①「新建」区：`<HomeZoneCard>` + 一个 `Link href="/projects/new"`（主 CTA），本区**无字段、无校验**（PRD `:110`）
- ②「草稿」区：`<HomeZoneCard>` + `<DraftBox />`（REQ-15 未到位 → 仅空态「暂无草稿」）
- ③「历史项目」区：`<HomeZoneCard>` 包裹 `<RecentProjectList projects={projects} isLoading={isLoading} />`

> **注意**：`home-dashboard.tsx` 不新增第二个 `/projects/new` 之外的新建入口（PRD `:109` 唯一性硬约束）。

### 2.2 `src/components/home/recent-project-list.tsx`（现 207 行）

| 行 | 现状 | 处置 |
| --- | --- | --- |
| `:23-26` | props 定义 | 不变 |
| `:28-30` | `getCompletedStepCount` | 保留（`:189` 的 x/y 计数继续用） |
| `:41` | `scrollContainerRef` | 保留 |
| `:43-49` | `useScrollRestoration(ref, { storageKey: HOME_SCROLL_STORAGE_KEY, persistPath: "/", ready: !isLoading })` | **载体语义变更**：容器从「整页列表容器」变为「历史项目区容器」；`storageKey` 与 `persistPath` 均不变（PRD `:134` 用户可见行为不变） |
| `:72-73` | 面板 `<section className="paper-panel … xl:flex xl:h-full xl:min-h-0 xl:flex-col">` | 下沉为「历史项目」区内容：外层面板样式改由 `HomeZoneCard` 承担，本组件不再自带整屏高度类（去掉 `xl:h-full`，保留 `xl:min-h-0 xl:flex xl:flex-col`） |
| `:74-86` | 区头「项目索引 / 已建档项目」+ 「{n} 个项目」pill | 标题改为「历史项目」（eye brow 与 pill 保留）；避免与三区外壳标题重复 |
| `:88-92` | 错误条 | 不变 |
| `:94-97` | 滚动容器 `soft-scroll mt-4 pr-1 … xl:overflow-auto` | 保留（滚动恢复的新载体） |
| `:99-105` | 加载占位块 | 不变（注释里的「返回首页不抖动」前提仍成立） |
| `:107-117` | 空态「暂无项目」 | 保留；**文案可微调**以指向新入口（「点上方『新建访谈』开始建档」） |
| `:128-131` | `<article className="group surface-card rounded-[1.45rem] p-4">` | **去掉 `group`**（§4.3 禁止可点暗示），其余不变 |
| `:138` | `<StatusBadge status={project.status} />` | 保留（项目维度状态） |
| `:149-155` | 「打开」`meta-pill` 链接，`:151` 含 `group-hover:-translate-y-0.5` | **提升为显式按钮**：去掉 `group-hover:*` 位移；改用现有按钮 token（建议 `sidebar-secondary` 的小尺寸形态 + 图标），`href` 不变；保持可聚焦（PRD `:140`/`:154`） |
| `:156-168` | 删除按钮 | **不变**（交互与确认文案不变，PRD `:158`） |
| `:172-192` | 两格：建档时间 / 进度 x/y | **保留**；新增「当前阶段」展示见下 |
| `:194-199` | 进度条 | 保留 |

**新增：当前阶段展示（PRD §4.2）**

- 数据源：`project.workflow` 中 `status === "in_progress"` 的那一步（无则回退到第一个 `pending`）。
- 文案口径：复用 `src/components/projects/project-workflow-board.tsx:23-27` 的 `statusMap`（`completed` 已完成 / `in_progress` 进行中 / `pending` 待处理），并沿用 `:73-76` 的特判 —— `manual_review` 且 `in_progress` → 显示「待您审校」。
- 建议落点：`:134-139` 名称 + `StatusBadge` 一行的右侧（或 `:140` 下方新增一行），展示为 `meta-pill`（如「当前阶段：整理 · 进行中」）。与 `StatusBadge` **并存、不互相替代**（PRD `:147`）。
- 展示粒度（仅当前一步 / 当前步骤 + x/y 并列）属 PRD §10 ④ 待定项，实施时取「仅当前一步」，x/y 已由 `:189` 承担。

**卡片禁止项（验收即断言，PRD §4.3）**：无整卡 `click` 热区、无 `cursor-pointer`、无整卡 hover 上浮（含 `group-hover:*`）、处理台入口必须是可聚焦控件。

### 2.3 `src/components/home/home-zone-card.tsx`（新增）

三区通用外壳，避免三处复制粘贴。建议 props：`eyebrow`、`title`、`description?`、`children`、`className?`。

- 样式沿用现有 token：`paper-panel` + `archive-frame` + `section-eyebrow`（对齐 `:24`/`:73`/`:76` 既有体例），**不新增色值**。
- xl 断点需支持 `flex flex-col min-h-0`，以便子内容（历史项目列表）内部滚动。

### 2.4 `src/components/home/draft-box.tsx`（新增）

- 仅实现**空态**：「暂无草稿」+ 一行说明；不做存储读写（PRD `:116`、`:207`）。
- REQ-15 PRD 未出，本区不阻塞三区结构落地。
- **禁止**自建第二套 `sessionStorage`。

### 2.5 `src/app/projects/new/outline/page.tsx`（现 5 行）

改写为服务端重定向壳，见 §4。

### 2.6 `src/components/outline/outline-plan-workspace.tsx`（改动面待检）

- **功能零改动**：`handleConfirm`（`:304-318`，`:317` → `/upload?outline=1`）、`handleSkip`（`:320-332`，`:331` 同）、`handleEnterAiInterview`（`:336+`）、`actionRow`（`:476-515`）全部保留。
- 仅在「需以流程步骤形态被宿主渲染」时，把 `:715-729` 的返回链接（`返回工作台`）与 `:720-726` 的标题块改为可配置（props 传入），避免新流程内出现「返回工作台」的越级跳转。
- 若 REQ-21 决定保留独立页面形态，则本文件**零改动**。

### 2.7 其余

- `src/app/upload/page.tsx`：**零改动**（裁决保留；不加首页入口）。
  - ⚠️ 本页「零改动」**不含其子组件**：`src/components/upload/interview-upload-form.tsx` 已在 §1.2 修改清单内（REQ-21 §8 点名必改）。
- `src/app/page.tsx`：**零改动**（仍渲染 `<HomeDashboard />`）。
- `src/proxy.ts` / `next.config.ts` / `src/lib/**` / `src/app/api/**` / `package.json`：**零改动**（§7）。

> 本节是生产代码改动的**唯一清单**；未列出的文件一律不动。

---

## 3. 新增路由 `/projects/new` 页面结构草案

### 3.1 组件树

```
src/app/projects/new/page.tsx            server component（无 "use client"）
 └─ <NewProjectFlow step={searchParams.step} />   "use client"，步骤容器
     ├─ #new-step-basic    <BasicInfoForm />      REQ-21 §4
     ├─ #new-step-outline  <OutlinePlanWorkspace />（复用现有组件，阶段 1 表单形态）
     └─ #new-step-route    <RouteChooser />       实时访谈 / 上传音频
```

### 3.2 `src/app/projects/new/page.tsx`（server）

```tsx
import { NewProjectFlow } from "@/components/new-project/new-project-flow";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  return <NewProjectFlow initialStep={step ?? "basic"} />;
}
```

> Next 16 的 `searchParams` 为 Promise，须 `await`（与现有 `src/app/projects/[projectId]/page.tsx` 体例保持一致）。`step` 白名单校验放在 `NewProjectFlow` 内：非法值一律回落到 `"basic"`。

### 3.3 字段与选择器约定（供上传页预填与 CDP 断言）

沿用 REQ-21 §3 的字段口径，**稳定 id 必须落地**：

| 步骤 | 控件 | id / 选择器 | 必填 |
| --- | --- | --- | --- |
| basic | 访谈主题 | `#projectName` | ✱ |
| basic | 受访者姓名 | `#intervieweeName` | ✱ |
| basic | 描述信息 | `#overview` → 预填 upload 页 `#notes`（`:599`，见下方裁决） | — |
| basic | 下一步按钮 | `[data-step-next="outline"]` | — |
| outline | 访谈主题 | `#outline-topic`（现成，`outline-plan-workspace.tsx:412`） | ✱ |
| outline | 受访者姓名 | `#outline-subject`（现成，`:426`） | ✱ |
| outline | 访谈内容概述 | `#outline-overview`（现成，`:439`） | — |
| outline | 提纲草稿 | `textarea[aria-label="访谈提纲草稿"]`（现成） | — |
| route | 实时访谈 / 上传音频 | `[data-route="live"]` / `[data-route="upload"]`；若 `route-chooser.tsx` 独立成文件，须同时提供 `#route-chooser-realtime` / `#route-chooser-upload` | — |

- 步骤容器 id：`#new-step-basic` / `#new-step-outline` / `#new-step-route`，供 CDP 判定当前步骤（无需解析 URL）。
- `data-*` 属性是**面向回归脚本的稳定锚点**，比中文文案更耐改；新增控件时按此约定补锚点。
- **route-chooser 的 id 登记要求**：分流步若**并入流程容器**（不单独成文件），沿用现有 `[data-route="*"]` 锚点即可；若**独立成文件**，其稳定 id（建议 `#route-chooser-realtime` / `#route-chooser-upload`）**必须补登到本表**，CDP 断言才有据可查。该文件是否拆分由实施时判断（§1.1 标注「视拆分需要」）。
- **跨页同名 id 注意项**：`#projectName` / `#intervieweeName` 在基本信息页与 upload 页**同名**（upload 页 `interview-upload-form.tsx:473` / `:487`）。CDP 测这两个 id 时**须先确认当前 URL / 当前步骤容器**（`#new-step-*`）再取值，避免跨页误取。**不需要改断言结构**，只在脚本内加当前页判定。

**裁决（2026-10-05）：「描述信息」的预填映射**

- `BasicInfoForm` 的「描述信息」（`#overview`）预填目标 = upload form 的 `#notes`（`interview-upload-form.tsx:599`）；
- `#researchFocus`（`:681`）**不由基本信息表单写入**（语义偏研究场景，不做通用预填）；
- `OutlinePlanWorkspace` 既有写入 `researchFocus` 的逻辑**不动**（`outline-plan-workspace.tsx:314-315` 把同一份概述同时写入 `researchFocus` 与 `notes`，属提纲链路的既有口径，不在本批次改动范围）。

### 3.4 步骤跳转与状态传递

| 动作 | 落点 | 说明 |
| --- | --- | --- |
| basic「下一步」 | `?step=outline` | `router.replace`（不污染历史栈） |
| basic 表单内容 | 与提纲步共用 React state | **不下沉存储** |
| outline「确认提纲，下一步」 | `?step=route` | **2026-10-05 修订**：流程内按钮（独立页时代为「确认提纲，进入上传」→ `/upload?outline=1`）；`router.replace` 不污染历史栈 |
| outline「跳过提纲，下一步」 | `?step=route` | **2026-10-05 修订**：空提纲 + 画像照带（先 `trim` 判空再写草稿，见 §9.4 BUG-07） |
| ~~outline「进入 AI 访谈」~~ | —— | **2026-10-05 退役**：`embedded` 下不渲染（`outline-plan-workspace.tsx:530/532`），建项目入口改由下行 route 承担（D7=B′） |
| route「上传音频」 | `/upload?outline=1` | 承接 `outlineDraftMarkdown` 预填；`OUTLINE_FLAG_PARAM` 标志位不能省（`route-chooser.tsx:120-122`） |
| route「实时访谈」 | `/projects/{id}/interview` | D7=B′ **唯一入口**（`#route-chooser-realtime`，`route-chooser.tsx:125-174`）；无提纲 → 弹 `[data-route-modal="outline-required"]` 引导回填 |

- **持久化只用一处**：`saveOutlineDraftToSession` / `OUTLINE_SESSION_STORAGE_KEY`（`src/lib/outline-session.ts:10-14`）。本流程**不得**引入第二个 key（PRD `:207`）。
- 直接访问 `/projects/new?step=outline`（无 basic 输入）须可用：提纲步的三个字段是可填的，与 basic 步不构成强依赖。

### 3.5 路由保护

- `/projects/new` 落在 `src/proxy.ts:71-72` matcher 覆盖范围内，未登录 → 302 `/login`（含 `redirect` 参数），**无需新增代码**。

---

## 4. `/projects/new/outline` 重定向实现（D2-1）

### 4.1 目标文件内容

`src/app/projects/new/outline/page.tsx`（现 5 行，整体替换）：

```tsx
import { redirect } from "next/navigation";

// REQ-16 §5.2 裁决（2026-10-05）：提纲已成为新建流程内的一步（可跳过），
// 本路由仅用于兼容旧书签与旧链接，不做独立渲染。
// 必须保持 server component：redirect() 在 RSC 渲染期返回 307，属服务端重定向。
export default function LegacyOutlinePage() {
  redirect("/projects/new?step=outline");
}
```

### 4.2 实现要点

1. **不得加 `"use client"`**。加 `'use client'` 后 `redirect()` 仍需在渲染期抛出才成立，且会引入客户端边界；服务端重定向是 PRD `:183` 的硬要求（非 `useEffect`）。
2. **不用 `next.config.ts` 的 `redirects()`**：PRD `:183` 要求「服务端 / Next 路由层重定向」，`redirect()` 满足且改动面最小；`next.config.ts` 列入 §1.4 不动清单。
3. **鉴权顺序**：`src/proxy.ts` 先于 page 执行 → 未登录访问旧路由仍 302 `/login`，PRD `:182` 满足，crosscut `:276-282` 断言口径**不变**。
4. **内部引用清理**：已核实 `outline-plan-workspace.tsx` 内**无** `Link` / `router.push` 指向 `/projects/new/outline`（仅 `:317`/`:331` → `/upload?outline=1`、`:336+` → 创建后进控制台）。全库检索旧路由字符串后，**预期仅剩本重定向文件自身**；若另有引用，一并改为新入口。
5. **重定向状态码**：`redirect()` 默认 307（临时），语义正确（旧书签兼容期）。**不用 308**（避免浏览器永久缓存后无法回退到独立页形态）。
6. **D2-2 备选**：若总管后续改为 `/projects/new`（不带 query），只需删掉 `?step=outline`；届时 §6 中 13-A~13-D 的入口断言需重写为「先点『下一步』」，回归面显著放大。

---

## 5. `home-dashboard.tsx`：双 CTA → 单入口（before / after）

### 5.1 改造前（`:44-90` 现状）

```
右列（:44）  flex flex-col gap-3 sm:flex-row … xl:min-w-[420px] xl:justify-end
 ├─ :53  <div className="min-h-[47px]">        ← 账户槽位（email + 版本 + 退出）
 ├─ :78  <Link href="/projects/new/outline" className="sidebar-secondary">  ← CTA1 ✱删
 │        新建访谈（含提纲生成）
 └─ :86  <Link href="/upload" className="sidebar-cta">                      ← CTA2 ✱改
          新建访谈项目
```

### 5.2 改造后

```
右列（:44，容器与 xl:min-w-[420px] 保留）
 ├─ :53  <div className="min-h-[47px]">        ← 账户区，行为零改动
 └─ <Link href="/projects/new" className="sidebar-cta w-full px-5 sm:w-auto">
      <Plus className="h-4 w-4" />
      新建访谈
```

### 5.3 逐条硬约束

| 项 | 要求 |
| --- | --- |
| 入口数量 | 首页「新建」入口**恰好 1 个**，`href === "/projects/new"`（PRD `:109`） |
| `/upload` | 首页**不得**再出现指向 `/upload` 的链接（crosscut `:250-252` 将翻转为此断言） |
| 样式 token | 只复用 `sidebar-cta` / `sidebar-secondary` 等既有类，**不新增色值** |
| 47px 占位 | 数值先保留；`measure-375.mjs` 复测后再定（PRD §10 ⑥） |
| 注释 | `:45-52` 推导注释必须重写为「账户区 + 单 CTA」构成下的新推导，否则注释与代码不符 |
| 文案 | 「新建访谈」为建议口径，最终文案属 PRD §10 ② 待定项；改文案时须同步 §6 的 CDP 文案断言 |
| 分区 | 主 CTA 归属「新建」区（§3.2 / §3.5）；header 内**不**再放 CTA1 的等价物 |

---

## 6. 三个 CDP 脚本的断言迁移

### 6.1 通用原则

1. **保留一切断言**：只允许「改判定源」「改目标 URL」「翻转语义」，**不得删除断言**（登记表 `:218`）。断言总数只增不减。
2. **归属标注**：每条改动标 `[基线]`（UI-12 遗留失效，与 REQ-16 无关）或 `[REQ-16]`（本次重构引起），便于验收区分回归责任。
3. **不改脚本框架**：`__t` 帮助函数、`report()`、退出码语义、端口/账号约定一律不动。
4. **优先用稳定锚点**：新断言尽量用 `#new-step-*` / `data-*`，避免绑定中文文案。
5. 三脚本均被 `.gitignore` 屏蔽（F2），改动**不进 commit**，验收靠本地执行结果。

### 6.2 `tmp/cdp-req13-outline.mjs`（363 行）

| 行 | 现状 | 处置 | 归属 |
| --- | --- | --- | --- |
| `:209` | `__t.set('#outline-subject', …)` | 不变（id 仍在 `:426`） | — |
| `:210` | `__t.set('#outline-topic', …)` | 不变（id 仍在 `:412`） | — |
| `:211` | `__t.set('#outline-institution', …)` | **删该行**，机构字段已随 UI-12 移除 | `[基线]` |
| `:212` | `__t.pick('#outline-scenario', …)` | **删该行**，场景选择已移除 | `[基线]` |
| `:213` | `__t.set('#outline-focus', …)` | **删该行**，研究焦点已并入概述 | `[基线]` |
| `:216-228` | 「添加事件」+ `#outline-event-0/1` + `#outline-timepoint-0` | **改写**：事件 / 时间节点文本改写入 `#outline-overview` | `[基线]` |
| `:246` | 断言「事件进了分节」 | **换判定源**：改为「概述内容进了分节」（断言位保留） | `[基线]` |
| `:247` | 断言「时间节点进了分节」 | 同上，并入概述判定 | `[基线]` |
| `:250-253` | 换一组事件重新生成 | **改写**：改换 `#outline-overview` 内容后重生成 | `[基线]` |
| `:188-189` | 采集首页 `href === '/projects/new/outline'` 与 `'/upload'` 两个链接 | **改写**：采集 `href === '/projects/new'` | `[REQ-16]` |
| `:192-196` | 断言「首页有『新建访谈（含提纲生成）』入口」 | **改写**：断言唯一入口文案（随 §5.2 定稿文案） | `[REQ-16]` |
| `:197-201` | 断言「原『新建访谈项目』入口仍在」 | **翻转语义**：断言首页**不存在**第二新建入口（`/upload` 链接计数 = 0）；断言位保留 | `[REQ-16]` |
| `:204` | `goto('/projects/new/outline')` | **改目标**：`/projects/new?step=outline` | `[REQ-16]` |
| `:205` | 断言「准备页可访问」（body 含「生成个性化访谈提纲」） | 若提纲步仍渲染 `:721-723` 的 h1 → 不变；否则换判定源为 `#new-step-outline` | `[REQ-16]` |
| `:277` | 断言确认后落 `/upload?outline=1` | **不变**（`handleConfirm` 未改） | — |
| `:289` | 无标记位直连 `/upload` 不串味 | **不变**（`/upload` 保留） | — |
| `:294` | 13-C 入口 `goto('/projects/new/outline')` | **改目标**：新入口 | `[REQ-16]` |
| `:296-306` | 「跳过，直接上传」→ `/upload` | 若「跳过」按钮仍在提纲步（`:478-485`）→ 不变；若移入分流步 → 改目标为分流步 + `[data-route="upload"]` | `[REQ-16]` |
| `:309` | 13-D 入口 `goto('/projects/new/outline')` | **改目标**：新入口 | `[REQ-16]` |
| `:322-324` | 13-D 写 `#outline-topic`/`#outline-subject` | **不变**（id 仍在） | — |
| `:345-352` | 断言 LLM 500 → 模板兜底（「LLM 生成失败，已载入通用模板」`outline-plan-workspace.tsx:199`） | **不变** | — |

### 6.3 `tmp/cdp-req13-crosscut.mjs`（296 行）

| 行 | 现状 | 处置 | 归属 |
| --- | --- | --- | --- |
| `:160-161` | 写 `#outline-subject`/`#outline-topic` | **不变**（id 仍在） | — |
| `:186` | `goto('/projects/new/outline')` | **改目标**：`/projects/new?step=outline` | `[REQ-16]` |
| `:188-199` | 确认后 sessionStorage 出现草稿键 | **不变**（键名 `OUTLINE_SESSION_STORAGE_KEY` 未改） | — |
| `:202-230` | 带草稿建项目 → 概览出现提纲 | **不变** | — |
| `:235-249` | 375px 不横向溢出 | **不变**（三区布局后仍须通过，是本次的关键回归项） | — |
| `:243-244` | 采集 outline + upload 两个 href | **改写**：采集 `/projects/new` | `[REQ-16]` |
| `:250-252` | 断言「375px 两个入口都在且可见」 | **翻转语义**：断言「375px 恰好一个新建入口且可见」（`href === '/projects/new'` 计数 = 1，`/upload` 计数 = 0） | `[REQ-16]` |
| `:256` | 未登录 `goto('/projects/new/outline')` | **改目标**：新入口 | `[REQ-16]` |
| `:276-282` | 断言未登录 → `/login` | **不变**（proxy 先命中，目标路由按 D2-1 更新后仍成立） | `[REQ-16]` |
| — | （新增断言） | **新增**：登录态访问 `/projects/new/outline` → 最终落在 `/projects/new`（验证 307 重定向真的生效，而不只是「没 404」） | `[REQ-16]` |

### 6.4 `tmp/measure-375.mjs`（41 行）

| 行 | 现状 | 处置 | 归属 |
| --- | --- | --- | --- |
| `:28-31` | 量 header 高度 + 列出 header 内所有 `<a>`（含每个 CTA 高度） | 保留；CTA 由 2 → 1，输出条目减少属预期 | `[REQ-16]` |
| `:35` | `find(a => a.getAttribute('href') === '/projects/new/outline')` 后 `.remove()` | **必改**：链接已不存在 → `null.remove()` 抛 TypeError；改抓 `href === '/projects/new'` | `[REQ-16]` |
| `:39-40` | 输出摘除前后 header 高度 delta | **语义更新**：由「摘掉新 CTA 的跳变量」改为「**复测账户区 47px 占位是否仍抵得掉徽标异步到货的跳变量**」（PRD §10 ⑥ / `:127`） | `[REQ-16]` |

**measure-375 复测口径（写进脚本输出注释）**：

- 场景 A：375px（槽位未被 CTA 撑高）—— 期望摘除账户区后 header 高度增量 = 47px + `gap-3` 的 12px = **59px** 量级；
- 场景 B：≥640px（槽位被 CTA 撑到 54px）—— 期望 `min-h` 不再生长；
- 结论落到 `home-dashboard.tsx:53` 的数值与 `:45-52` 注释重写上。

### 6.5 三脚本职责与本次定位

| 脚本 | 本次定位 |
| --- | --- |
| `cdp-req13-outline.mjs` | 提纲链路端到端（13-A/13-B/13-C/13-D）；重定向目标 + 入口断言的**主要迁移对象** |
| `cdp-req13-crosscut.mjs` | 跨切面（草稿续跑 + 375px 不溢出 + 未登录保护）；**入口唯一性的第二道验收闸** |
| `measure-375.mjs` | 度量工具（非断言脚本）；重定目标后用于 47px 占位复测 |

### 6.6 第四个脚本（不在本次范围）

`tmp/cdp-req13-prefill.mjs`：依赖旧 `#outline-*` id，已随 UI-12 失效（§1.5）。**不列入本次转绿清单**，避免把 UI-12 的欠账算进 REQ-16。

---

## 7. 禁止项

### 7.1 代码层（硬禁止）

1. **不改数据层**：`src/lib/types/project.ts`、`src/lib/server/project-store.ts`（PRD `:230`）。
2. **不改 API 契约**：`src/app/api/**` 全部路由（含 `POST /api/projects`、`GET /api/projects`、`DELETE /api/projects/[projectId]`、`/api/projects/ai-interview`、`/api/outline/*`、`/api/auth/*`）的入参 / 出参 / 状态码一律不动（PRD `:232`）。
3. **不扩展会话层**：`src/lib/outline-session.ts` 不动（除 REQ-21 明确要求扩展为通用「新建草稿会话」，且须同批记录）。
4. **不新增依赖**：`package.json` / lockfile 不改，不引入 UI 库、图标库、状态库。
5. **不新增色值**：`src/app/globals.css` 默认不动；只复用既有 token（`paper-panel`、`archive-frame`、`surface-card`、`meta-pill`、`section-eyebrow`、`sidebar-cta`、`sidebar-secondary`、`soft-scroll`、`text-field`、`text-area`、`field-label` 等）。
6. **不改鉴权与构建**：`src/proxy.ts`、`next.config.ts`、`src/app/layout.tsx` 不动。
7. **不新建第二套会话存储**：`sessionStorage` 只允许经 `outline-session.ts` 的既有 key 读写（PRD `:207`）。
8. **不改 `src/app/upload/page.tsx`**：裁决为「保留实现路由」，本轮只做「首页入口摘除」，不做路由改造。其子组件 `interview-upload-form.tsx` 的「基本信息预填 + 步骤一字段去重」属 **REQ-21 §8** 点名改动（已在 §1.2 登记）：即 **page 不动、form 按 REQ-21 口径改**，两者不冲突。

### 7.2 交互层（验收即断言，PRD §4.3）

9. 历史项目卡片**不做整卡可点**：无整卡 `click` 热区、无 `cursor-pointer`、无整卡 hover 上浮（含 `group-hover:*`）。
10. 处理台入口必须是可聚焦的显式控件（提升后的「打开」按钮）。
11. 删除能力与确认文案不变（`recent-project-list.tsx:156-168`）。

### 7.3 回归资产（不得破坏）

12. **不删三脚本任何断言**：只允许改判定源 / 改目标 / 翻转语义（§6.1）。
13. **不把 `/upload` 暴露为首页第二入口**（PRD `:109`）。
14. 三脚本框架（`__t`、`report()`、退出码）不动。

### 7.4 流程层

15. **本轮不 commit**：只落盘本文档，等总管验收后再决定提交。
16. 不在本批次内为 REQ-17（后台管理入口）预留任何入口位（PRD `:254` / §3.5）。

---

## 8. 验收矩阵（PRD §9 十一条 → 检查手段）

| # | PRD §9 验收条目 | 检查手段 | 通过判据 |
| --- | --- | --- | --- |
| 1 | 三区 + 账户区；平铺列表已下沉 | 人工 + DOM 断言 | 首页存在「新建 / 草稿 / 历史项目」三区；账户区在 header |
| 2 | 全站无第二新建入口 | `cdp-req13-outline.mjs:197-201`（翻转断言）+ `cdp-req13-crosscut.mjs:250-252` | 首页 `href='/projects/new'` 计数 = 1，`/upload` 计数 = 0 |
| 3 | 旧路由按裁决执行；未登录仍 → `/login` | `cdp-req13-crosscut.mjs:276-282`（不变）+ **新增**登录态旧路由落点断言 | 未登录 `/projects/new/outline` → `/login`；登录态 → 落在 `/projects/new` |
| 4 | 卡片显式按钮、无整卡热区 | DOM 断言（`article` 无 `onClick`、无 `cursor-pointer`、无 `group-hover:*`）+ `cdp-req13-outline.mjs` 进入处理台链路 | 「打开」为可聚焦控件；卡片本体点击无跳转 |
| 5 | 卡片展示 workflow 当前阶段 | DOM 断言（当前阶段文案存在，`manual_review + in_progress` → 「待您审校」） | 与 `StatusBadge` 并存且不冲突 |
| 6 | 375px 无横向溢出；xl 分区内滚动正常 | `cdp-req13-crosscut.mjs:235-249`（不变）+ `measure-375.mjs` | `scrollWidth <= clientWidth + 1` |
| 7 | 滚动位置可恢复 | 人工（滚动历史项目区 → 进项目 → 返回首页）+ `HOME_SCROLL_STORAGE_KEY` 载体检查 | 恢复行为与改造前一致 |
| 8 | 账户区功能不变；header 无跳变 | `measure-375.mjs`（重定目标后复测 375 / ≥640） | 徽标到货前后 header 高度增量 ≈ 0 |
| 9 | 三 CDP 脚本全部通过 | 本地依次执行三脚本 | 退出码 0，无 FAIL |
| 10 | 文案与能力一致（UI-11） | 人工对照（h1 / 描述 / `recent-project-list.tsx:76-79` 副标题） | 无未提供功能的承诺 |
| 11 | 草稿区空态；无第二套会话存储 | 人工 + 全库检索 `sessionStorage` | 仅 `outline-session.ts` 一处 |

**补充回归项（PRD 未列但必须自测）**：

| # | 项 | 依据 |
| --- | --- | --- |
| R1 | `/projects/new` 未登录 → `/login` | §3.5 |
| R2 | `/projects/new?step=outline` 可直接访问并生成提纲 | §3.4 |
| R3 | 旧书签 `/projects/new/outline` 最终落到提纲步（非 404） | §4.2 |
| R4 | 提纲 → 上传的草稿预填不掉（`/upload?outline=1`） | 裁决 `:167` 的代价项 |
| R5 | `outline-plan-workspace.tsx` 功能零改动（确认 / 跳过两条链路；**2026-10-05 修订**：「进入 AI 访谈」链路在 `embedded` 下不渲染（`:530/532`），随独立页退役成为不可达分支 —— 已登记，见 §9.4） | §2.6 |

---

## 9. 实施顺序、风险与回滚

### 9.1 实施顺序（8 步）

| 步 | 动作 | 产物 / 判据 |
| --- | --- | --- |
| 1 | 起 dev（:3000），**跑三脚本记录基线** | 预期：outline 脚本在 13-A 因 `#outline-institution` 抛错而红（印证 F3）；crosscut / measure 记录现状 |
| 2 | 修 UI-12 遗留失效选择器（`[基线]` 项） | outline 脚本恢复可跑通 13-A |
| 3 | REQ-16 生产改动：首页 IA（三区 + 单入口 + 卡片） | §2.1 / §2.2 / §2.3 / §2.4 落地 |
| 4 | REQ-21 同批：新建 `/projects/new` 三步流程 | §3 落地 |
| 5 | 重定向 + 内部引用清理 | §4 落地 |
| 6 | 三脚本断言迁移（`[REQ-16]` 项）+ `measure-375` 重定目标复测 47px | §6 全部落地；三脚本退出码 0（2026-10-05 实测：23/23、12/12、10/10） |
| 7 | Phase 4：账户区槽位注释定稿（47px 三视口实测回填） | `home-dashboard.tsx:45-52` 注释（本次改 `:52` 末行）+ `:53` 数值 `min-h-[47px]`；`measure-375.mjs` **10/10**（375/640/1440 均 47px） |
| 8 | Phase 5 A3：`persistBasicInfo` 空值覆盖修复 + `verify-phase3` 补 G 段（D7=B′ 主链路断言） | `new-project-flow.tsx:66-84`（**+11 / -3**）；`verify-phase3.mjs` **24/24** |

> 步 3 与步 4 **必须同批**（D1-A）：`home-dashboard.tsx` 只改一次，避免两次改动同一文件（PRD `:201`）。

### 9.2 主要风险与对策

| 风险 | 出处 | 对策 |
| --- | --- | --- |
| 回归面最大（首页是三脚本公共断言面） | PRD §11-1 | 步 1 先落基线，步 6 逐条对照 §6 表；区分 `[基线]` / `[REQ-16]` |
| 与 REQ-21 双写 `home-dashboard.tsx` | PRD §11-2 | D1-A 同批一次到位 |
| 旧路由搬迁牵连 REQ-14「D7=B 入口唯一」 | PRD §11-3 | 唯一性由入口计数 = 1 保证：Phase 2 落地后分流步承载流程内唯一入口（#route-chooser-realtime），独立页形态随 §4.1 重定向退役，AI 入口最终收敛为 1 个。D7=B′ 已裁决（2026-10-05）。 |
| REQ-15 未定稿致草稿区返工 | PRD §11-4 | 草稿区只落空态 + 接口注释，不预设存储形态 |
| 滚动恢复载体变更致返回首页跳动 | PRD §11-5 | 沿用 `ready: !isLoading` 钳位；`recent-project-list.tsx:99-105` 的「不插占位块」注释前提不得破坏 |
| 47px 占位前提失效致 header 跳高 | PRD §11-6 / §10 ⑥ | 步 6 用 `measure-375.mjs` 复测后回填 `:53` 数值与 `:45-52` 注释 |

### 9.3 回滚点

- **单一回滚单元**：`home-dashboard.tsx` + `recent-project-list.tsx` + `src/app/projects/new/**` 三项构成 IA 改造的回滚边界；`outline-plan-workspace.tsx` 未被改动，天然可回退。
- `upload` 链路中 `interview-upload-form.tsx` 的改动属 **REQ-21**（§1.2），与本节 REQ-16 IA 改造的回滚边界**解耦**：回滚 IA 改造无需回滚该 form 改动，反之亦然。
- 重定向为独立文件（§4.1 全文替换），回滚只需还原原 5 行 page。
- 三脚本改在 gitignore 区，回滚不影响仓库状态。

---

### 9.4 收口登记（2026-10-05）

**本轮收口的代码改动（Phase 4 / Phase 5-A3）**：

| # | 文件 | 改动 | 依据 / 断言 |
| --- | --- | --- | --- |
| P4 | `src/components/home/home-dashboard.tsx:52` | 账户区槽位注释定稿（注释块 `:45-52` 的末行；徽标槽位数值 `min-h-[47px]` 在 `:53` 未变）—— 47px 经 `measure-375.mjs` 三视口复测确认，含徽标到货不撑高 | PRD §10 ⑥；`measure-375.mjs` 10/10 |
| P5-A3 | `src/components/new-project/new-project-flow.tsx:66-84` | `persistBasicInfo` 先 `trim` 再判空、只写用户真填的字段（**+11 / -3**），修 BUG-07 冷启动空值覆盖 | 登记表 BUG-07；`verify-phase3.mjs`「A3 修复」断言 |

**覆盖缺口的补记与闭合（方案 D）**：

- **缺口**：Phase 3 把 AI 入口从提纲页移入分流步后，`tmp/verify-phase2.mjs` §13 原「提纲页点 AI → 建项目 → 落 `/projects/{id}/interview`」断言失去对象（`embedded` 下 AI 按钮不渲染），**D7=B′ 主链路一度零断言覆盖**。
- **闭合**：`tmp/verify-phase3.mjs` 新增 **G 段**（第 24 条断言）——「有提纲 + 已填基本信息 → 点 `#route-chooser-realtime` → `POST /api/projects/ai-interview` **201** → 落 `/projects/{id}/interview`」，并校验 payload 契约（`researchFocus` / `notes` 直传 `#overview`、`outlineDraftMarkdown` 原样直传）与探针项目清理（id 只取响应体，`DELETE` 200）。不依赖 LLM：进分流步后直接注入提纲草稿；「确认提纲 → 分流步」的过渡由 E2 段覆盖。
- **`tmp/verify-phase2.mjs` 的处置**：其 6 条 FAIL 中 4 条属「旧口径已被 Phase 3 取代」（旧独立页 h1 / eyebrow / 三按钮、首页指向旧路由），2 条系**旧探针自身缺陷**（`:985` 用 `/\/projects\/([^/]+)/` 把 `/projects/new` 的 `new` 当项目 id；`click()` 不检查 `disabled`，落在早退分支即静默无操作且无报错）。**不列入转绿清单**，其有效断言已被 `verify-phase3` 覆盖 —— 判定为「Phase 2 历史探针、已退役」，**非产品回归**。
- **环境注意（实测结论）**：dev server 的 HMR 全量重载会冲掉 CDP 流程的中间态，表现为「POST 200/201 但路径未变、且无报错」；跑探针前须等重建安定，否则结论不可用。

**上游欠账（不在本轮范围）**：`interview/page.tsx:26-28` 在项目无提纲时 `redirect('/projects/{id}/outline')`，而该路由不存在（PRD-21 §10 ⑤ / §11-4）。正常路径不命中（AI 分支经 API 强制提纲），保持「已知遗留」。

## 10. 待办与交接清单

| 项 | 归属 | 说明 |
| --- | --- | --- |
| 首页新建 CTA 文案定稿（「新建访谈」） | 产品方 | PRD §10 ②；改文案须同步 §6 文案断言 |
| 卡片当前阶段展示粒度 | 产品方 | PRD §10 ④；本计划取「仅当前一步」 |
| 47px 占位最终取值 | 实施 | PRD §10 ⑥；**✅ 已回填（2026-10-05）**：三视口实测均为 47px，见 §9 步 7 / §9.4 |
| 草稿区能力（列表 / 摘要 / 继续填写 / 更新时间） | REQ-15 | PRD §7 接口契约；本批次只落空态 |
| `cdp-req13-prefill.mjs` 失效修复 | 实施（`[基线]`） | PRD `:226`；与 §6 的 UI-12 遗留修复**建议同批**，但**不计入 REQ-16 功能验收证据** |
| REQ-17 管理入口是否需首页占位 | 产品方 | PRD §10 ⑤；本批次明确不占位 |

---

**本计划状态**：待总管验收。文中 `[基线]` 项为 UI-12 遗留欠账，与 REQ-16 验收证据须分开计列。
