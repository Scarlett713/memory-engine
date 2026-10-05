# REQ-24 分流支路页面统一 · 实施计划（IMPL）

> **依据**：`docs/PRD_REQ-24_分流支路页面统一.md`（下称 PRD）。本文只展开 PRD 未写死的实现细节，不重复 PRD 已定的产品口径与边界。
> **状态**：待实施（本 IMPL 定稿；生产代码与探针均**未**改动）。落盘日期 2026-10-06。
> **交付面**：生产代码 **2 个文件**（`interview-upload-form.tsx`、`interview-console.tsx`）；探针 **3 个**（`tmp/verify-phase3.mjs`、`tmp/cdp-req13-outline.mjs`、`tmp/cdp-req13-crosscut.mjs`；`tmp/` 被 `.gitignore` 屏蔽，不入 commit）。
> **硬约束**：PRD §5（C1–C10）逐条有效；本文 §7 只补 PRD 未写的执行纪律。

**P3 口径被取代 · 三处同记（之一：本文件头）** —— REQ-21 / P3 的「从分流步进入上传页时**隐藏**『上一步』按钮」已被 REQ-24 取代：新版分支下上传页**不再渲染步骤条**，页面里也不存在上传页自己的「上一步」；返回入口改为底栏唯一的「返回上一步」→ `/projects/new?step=route`。三处同记点：① 本 IMPL 文件头（此处）；② `interview-upload-form.tsx` 的代码注释（改法见 §3.2）；③ 本文 §5 修订注记正文（残留痕迹与断言移交清单）。**README / 其他文档不另记**。

## 0. 读前须知：三个前置事实 + 三处与 PRD 字面的偏离（P-1 / P-2 / P-3） + 六项实现裁决

### 0.1 F1 · 生产改动面实测 = 2 文件 / 7 处

| 文件 | 现规模 | 改动处数 | 行号（**改动前**实测值） |
| --- | --- | --- | --- |
| `src/components/upload/interview-upload-form.tsx` | 972 行 | 6 | `:12`（补 `next/link` import）、`:219-239`、`:383-389`、`:475`、`:480-510`、`:911-931` |
| `src/components/interview/interview-console.tsx` | 1357 行 | 1 | `:970-979` |

无新增文件、无删除文件、无路由增删（`src/proxy.ts` 三个常量不动）。

### 0.2 F2 · 探针在 `tmp/`，被 `.gitignore` 第 54 行屏蔽

- `tmp/verify-phase3.mjs`（870 行，**36 条 `check(`**，行号清单见 §6.1）；`tmp/cdp-req13-outline.mjs`（405 行）。
- 两者都不入 commit（实证：当前 `git status --porcelain` 只有未跟踪的 `docs/PRD_REQ-24_….md`；`.gitignore:54` = `tmp/`）。
- 因此「探针改到 39 条全绿」是**本地验收动作**，凭证是运行输出，不是 diff。PRD §6.0 的「终态 39 条」按此口径复核。

### 0.3 F3 · `step === 3` 已天然不渲染步骤一/二 ⇒ PRD §4.2 的「移除」项**零新增条件**

实测 `interview-upload-form.tsx` 三段互斥：`{step === 1 ? … : null}`（`:513`）、`{step === 2 ? … : null}`（`:787`）、`{step === 3 ? … : null}`（`:837`）。各 id 归属：`#projectName`(`:522`)、`#intervieweeName`(`:536`)、`#collectionScenario`(`:550`)、`#customScenarioLabel`(`:576`)、`#notes`(`:648`)、`#outlineDraftMarkdown`(`:670`)、`#institutionName`(`:695`)、`#privacyLevel`(`:710`)、`#researchFocus`(`:730`) **全在 `step === 1` 分支内**；`#language`(`:844`) 在 `step === 3` 内。

⇒ 新版分支落 `step = 3` 之后，步骤一/二主体、折叠区、高级设置**根本不在 DOM**，无需为它们加任何 `flowMode` 条件（逐条对照见 §2.3）。这是「零新增条件」能成立的**唯一依据**，实施时不得顺手给这些块加判断。

### 0.4 与 PRD 字面的偏离（P-1 / P-2 / P-3 均已裁决 = A）

| # | PRD 字面 | 偏离事实 | 裁决 | 落点 |
| --- | --- | --- | --- | --- |
| **P-1** | §6.3 既有断言迁移清单只列 H5 / `enterUploadStep3()` / 13-B / 13-C | `E1`（`:235`/`:240`/`:241`/`:242`）与 `E2`（`:280`/`:285`）共 **6 条**同样以「落步骤三 + 回步骤一读字段」为判据 ⇒ 不迁移必然新增 6 红，与 §6.0「39 全绿」直接冲突 | **A：IMPL 直接执行迁移**，处置与 §6.3 对 13-B/13-C 同法（判据换源：新锚点 + `sessionStorage` 草稿），**断言条数不变**；§6.7 记「PRD §6.3 补遗」，**PRD 不改** | §6.7 |
| **P-2** | §6.2 变异 ①「`flowMode` 恒假」 | 若按字面把 `step` 初始化也一起恒假，落点退回步骤二 ⇒ `input[type="file"]`（仅步骤三渲染）与「创建项目并开始处理」都不存在 ⇒ **I1/I2/I3 连带红**，矩阵第 ① 行「只红 J1」不成立 | **A：操作化为「新版分支条件恒假」**（步骤条条件 + 底栏条件两处置假，`step` 初始化不动）；差异在 §6.5 显式记录，**PRD 不改** | §6.5 / §9 |

> P-1、P-2 都属「PRD 措辞与实测不兼容」，处理方式统一为「IMPL 内记录偏离 + 不改 PRD」，与 `IMPL_REQ-16` §9.4 的收口先例一致。

> **P-3（第三处 · PRD §6.3 补遗二 · 已裁决 = A）**：PRD §6.3 对 `cdp-req13-crosscut.mjs` 判「不受影响、回归跑绿即可」——实测**不成立**，其入口必带就绪草稿落 `/upload?outline=1`（新版分支）⇒ 1 条判据红 + `:286` 抛 `TypeError` 使全脚本终止。处置同 P-1（判据换源 + 载荷改读草稿），**PRD 不改、不回写、不另开需求**，详见 §6.0 / §6.8；§8.1 第 7 步 = **实施前必修**。

### 0.5 六项实现裁决（D-1～D-6，按推荐列执行）

| # | 点 | 裁决 |
| --- | --- | --- |
| D-1 | 判据同源 | 把 `:230-232` 的局部 `ready` 提为组件体常量 `draftReady`；`flowMode = hasOutlineFlag && draftReady`；`:234` 改 `if (flowMode)`；`:238` 改 `draftReady ? 2 : 1`。语义零变化，消除「同一表达式两份」 |
| D-2 | `data-upload-flow` 承载节点 | 根 `<section>`（`:475`）上 `data-upload-flow={flowMode ? "from-route" : undefined}` —— React 对 `undefined` **不输出属性** ⇒ 旧版 DOM 零新增属性，J1/J2 的负向判据才成立 |
| D-3 | `I2` detail 的 `iStep` | `I2` 探针对象增 `flow` 字段（**不进判定**，只进 detail 文案）；`I1_SNAP` 的 `step` 字段原样保留（新版恒 `null`，`:845` 的 `(i1.step === null \|\| …)` 已容忍） |
| D-4 | `backToStep1()`（`cdp-req13-outline` `:281-284`） | **删除**（含 `:295`/`:335` 两处调用）—— 新版分支无步骤一，留着是死代码。它是 **helper 不是断言**，两脚本 `check(` 总数不变（IMPL 注明） |
| D-5 | `UPLOAD_STEP`（`:278`） | **保留**：仍采 `aria-current` 快照，仅进 detail / `note`，**不进判定**（PRD §10「仅留旧版对照用」） |
| D-6 | 13-B 的「提纲已预填」 | `:302` 改为「**提交载荷携带提纲**」：脚本内局部 fetch 桩（口径照抄 `verify-phase3.mjs:747-813` 的 `I_HELPERS`）+ `setFile` 注入假音频 + 勾选「我确认」→ 断言 `body.outlineDraftMarkdown === mdA` 且 `body.projectName` / `body.audio` 正确 |

## 1. 涉及文件清单

### 1.1 修改（生产代码，2 个）

1. `src/components/upload/interview-upload-form.tsx`（现 972 行）—— 6 处，见 §2.1 / §3.1-§3.5。
2. `src/components/interview/interview-console.tsx`（现 1357 行）—— 1 处，见 §2.2 / §3.6。

### 1.2 新增

- `docs/IMPL_REQ-24_分流支路页面统一.md`（本文，纯文档）。

### 1.3 修改（非生产，**3 个**；`tmp/` 被 `.gitignore:54` 屏蔽，见 F2）

- `tmp/verify-phase3.mjs`：H5 改对象（§6.2）、`enterUploadStep3()` 判据迁移（§6.3）、I1 取样去 `aria-current`（§6.4）、新增 J1/J2/J3（§6.5）、E1/E2 迁移（§6.7）。36 → **39** 条。
- `tmp/cdp-req13-outline.mjs`：13-B（§6.6.1）、13-C（§6.6.2）改判据；`backToStep1()` 删除（D-4）；顶部补 `SESSION_KEY` 常量。
- `tmp/cdp-req13-crosscut.mjs`：第 1 节判据换源、第 2 节载荷改读草稿（**原 `:286` `TypeError` 的根因**）、删 `backToStep1()` 及其调用（§6.8；P-3 · **PRD §6.3 补遗二**）。13 条不变。

### 1.4 明确不动（回归红线，抄 PRD §3.2，逐条保留原文口径）

`submitProject()` / `validateStepOne()` / `handleFormSubmit` 与载荷字段名取值路径；`ConsentDialog`；密级默认值（`"internal"`，`:262`）与校验；`src/lib/types/project.ts` / `src/lib/server/project-store.ts` / `src/lib/server/project-export.ts` / `src/lib/outline-session.ts`（不新增第二个 `sessionStorage` key）；`src/proxy.ts` 三个常量；`route-chooser.tsx`；`new-project-flow.tsx`；`upload-workspace.tsx`（顶栏「返回工作台」）；首页组件；`globals.css`；访谈页「退出访谈」语义与二次确认；`interview/page.tsx:26-28` 的 `redirect('/projects/{id}/outline')` 已知遗留。

## 2. 逐文件落点（行号 = **改动前**实测值）

### 2.1 `src/components/upload/interview-upload-form.tsx`

| # | 行 | 现状 | 改动后 | 详见 |
| --- | --- | --- | --- | --- |
| 1 | `:12` | `import { useRouter, useSearchParams } from "next/navigation";`（全文件**无** `next/link`） | 其后新增 `import Link from "next/link";` | §3.5 |
| 2 | `:219-239` | `hasOutlineFlag`(:219) / `prefill`(:220) / `step` 初始化：局部 `ready`(:230-232) → `if (hasOutlineFlag && ready) return 3`(:234-236) → `return ready ? 2 : 1`(:238) | 提出 `draftReady`、`flowMode` 两个组件体常量；`:234` 判 `flowMode`、`:238` 判 `draftReady`；注释整段改写为 REQ-24 口径 | §3.1 |
| 3 | `:383-389` | P3 注释(:383-388) + `const hideBackButton = step === 3 && hasOutlineFlag;`(:389) | **整段替换**：注释改写为 REQ-24 口径（P3 口径被取代的代码侧注记），`hideBackButton` **删除** | §3.2 |
| 4 | `:475` | `<section className="archive-frame … xl:flex-col">` | 追加 `data-upload-flow={flowMode ? "from-route" : undefined}` | §3.3 |
| 5 | `:480-510` | 步骤条注释(:480) + `<ol>…</ol>`(:481-510) | 包成 `{flowMode ? null : (…原样…)}`，注释改写 | §3.4 |
| 6 | `:911-931` | `{step > 1 && !hideBackButton ? <Button …>上一步</Button> : null}`(:921-931) | `{flowMode ? <Link …>返回上一步</Link> : step > 1 ? <Button>上一步</Button> : null}` | §3.5 |

**不改**（靠 `step === 3` 天然生效，见 F3）：`:513`(`step === 1` 分支) / `:787`(`step === 2`) / `:837`(`step === 3`) 三分支结构；`:912-918` 底栏说明文案三元（`flowMode` 下 `step === 3` ⇒ 自动落到第三支，文案零变化）；`:933-958` 提交按钮；`:206-212` 状态与 store 绑定；`:241-373` 全部字段 state 与 `goNext`/`goToStep`/`goBack`（`goBack` 仍被旧版「上一步」使用，**不得删**）。

### 2.2 `src/components/interview/interview-console.tsx`

| # | 行 | 现状 | 改动后 | 详见 |
| --- | --- | --- | --- | --- |
| 1 | `:970-979` | P8 注释(:970-971) + `<Link href={\`/projects/${project.id}/outline\`} className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong">` + `<ArrowLeft />` + `返回提纲` | `href="/projects/new?step=route"`、新增 `data-interview-back="route-step"`、文案 `返回上一步`；`className` / `ArrowLeft` / `Link` 语义与 `project` 依赖**原样保留**；注释改写 | §3.6 |

**不改**：`:980-989`「退出访谈」按钮（`data-interview-exit="trigger"`）与其 `variant="ghost"` 视觉；`:12` 的 `import Link from "next/link";`（已存在，无需补）。

> 副作用核查（已核，供实施者免猜）：`project` 在同组件内仍被多处使用 —— `:644-645` 的 `router.push`、`:803` 与 `:886` 的 API 路径，故把 `href` 里的 `project.id` 摘掉后**不会**出现「`project` 未使用」的 lint 报错；`ArrowLeft` 仍在本处使用。改完仍按 §6.9 跑一次 `npx eslint` 收口。

### 2.3 PRD §4.2「移除项」逐条对照（为何**零新增条件**）

| PRD §4.2 移除项 | 现状所在行 | 新版为何不在 DOM | 是否需要改 |
| --- | --- | --- | --- |
| ① 步骤条整块 `<ol>` | `:481-510`（在 `<form>` 顶层，**不属于任何 step 分支**） | 它不在 step 分支内 ⇒ **必须显式条件化** | **要改**（§3.4，唯一的「移除」型改动） |
| ② 步骤一主体 `#projectName` / `#intervieweeName` / `#notes` / 密级 | `:513` 分支内：`#projectName`(:522)、`#intervieweeName`(:536)、`#collectionScenario`(:550)、`#customScenarioLabel`(:576)、`#notes`(:648)、`#institutionName`(:695)、`#privacyLevel`(:710)、`#researchFocus`(:730) | `step === 3` ⇒ `:513` 的 `{step === 1 ? … : null}` 渲染 `null` | **不改** |
| ③ 步骤二主体（采集路径卡片） | `:787` 分支内 | 同上（`:787` 的 `{step === 2 ? … : null}`） | **不改** |
| ④ 步骤一内「访谈提纲（选填）」折叠区 `#outlineDraftMarkdown` | `:656-678`（在 `:513` 分支内） | 随步骤一同一块不渲染 | **不改** |

> **精确化两处 PRD 措辞（供核对，不属 P-1/P-2 偏离）**：ⓐ PRD §4.2 ② 写的 `#confidentialityLevel` 在代码里**没有 id** —— 密级是 `:603-621` 的 radio 组，选择器为 `input[name="confidentialityLevel"]`；真正带 id 的同类字段是 `#privacyLevel`(隐私级别, `:710`)。ⓑ PRD §4.2 ④ 说的折叠区就是 `:656-678` 的 `<details>`（`summary` 文案「访谈提纲（选填）」），其 `#outlineDraftMarkdown` 在 `:670`。
> **红线**：不得用 `hidden` / `sr-only` / `disabled` / `className` 隐藏来实现① —— 判据是「不在 DOM」（`button[aria-current="step"]` 与 `ol button` 命中数均为 0）。

## 3. before / after 代码（改动后代码可直接粘贴）

> 缩进口径：与现状一致（组件体 2 空格、JSX 内按现状层级）。`className` 一律从现状**逐字复制**，不得重排类名顺序（避免无意义 diff）。

### 3.1 判据同源：`draftReady` + `flowMode`（`:219-239`，D-1）

**现状（`:229-239`）**

```tsx
  const [step, setStep] = useState<WizardStep>(() => {
    const ready = Boolean(
      prefill?.profile.projectName && prefill?.profile.intervieweeName,
    );

    if (hasOutlineFlag && ready) {
      return 3;
    }

    return ready ? 2 : 1;
  });
```

**改动后（`:219-220` 原样保留，`:222-239` 整段替换）**

```tsx
  // REQ-21 §5.2：基本信息已由新建流程写入草稿的 projectName / intervieweeName，
  // 两项齐了才称得上「从新建流程进来」；缺任一（老书签、手写 URL、清过 sessionStorage）
  // 都维持从步骤一开始，不再要求重复填写。
  const draftReady = Boolean(
    prefill?.profile.projectName && prefill?.profile.intervieweeName,
  );
  // REQ-24 §4.1：新版分支（分流支路）的唯一开关 = 「带标记位」且「草稿就绪」。
  // 必须同时要求标记位：裸 /upload、老书签、?outline=0 时 hasOutlineFlag 为 false，
  // 逐字走下面的原逻辑，旧版行为零变化。
  // 只看标记位不看草稿就绪会造出死路：必填字段没有 UI 可填，提交必被 validateStepOne 弹回
  // （PRD §4.1「反例防护」，规格而非实现细节）。
  const flowMode = hasOutlineFlag && draftReady;

  // REQ-24 §4.2：从分流步进来的用户，采集路径已在上一步选过（点的就是「上传音频」），
  // 画像也已在基本信息步填过，来路是新建流程的三步 —— 直接落到「音频与提交」：
  // 既不重填，也不再渲染步骤条（步骤条会让人以为还要走前两步）。
  const [step, setStep] = useState<WizardStep>(() => {
    if (flowMode) {
      return 3;
    }

    return draftReady ? 2 : 1;
  });
```

**三条不变量（实施后必自查）**

1. `flowMode === false` 时 `step` 取值与改动前**逐字相同**（`draftReady ? 2 : 1`）；
2. `flowMode === true` 时 `step` 恒为 `3`，`setStep` 之后不会被任何 effect 改写（现状无此类 effect）；
3. 判据只有**一份**：不得在别处再写 `hasOutlineFlag && Boolean(prefill?.…)`（旧 `ready` 局部已删除）。

### 3.2 `hideBackButton` 删除 + 注释改写（`:383-389`，P3 口径被取代的代码侧注记）

**现状（`:383-389` 逐字）**

```tsx
  // P3：从新建流程分流步进来的用户没有「upload 内部上一步」的概念 —— 新建流程的步骤
  // 是 SPA 内部 state，刷新即丢，goBack 只会把人带回 upload 自己的步骤一，与用户的
  // 来路再无关系。留个按钮只会误导，藏掉。
  // 只在「步骤三 + 带标记位」这一种组合下藏：用户若自己点步骤条回到步骤二，按钮照常
  // 出现（那是 upload 内部回退，语义正确）；从步骤二点「下一步」回到步骤三后它会再次
  // 隐藏 —— 预期行为，用户始终处在「从新建流程进入」的上下文里。
  const hideBackButton = step === 3 && hasOutlineFlag;
```

**改动后（整段替换为注释，无可执行代码）**

```tsx
  // REQ-24 §3.3（取代 REQ-21 / P3 口径）：新版分支（从分流步进来）不再渲染步骤条，
  // 页面里也就没有「上传页内部上一步」这个概念了 —— 传进去只会把人带回 upload 自己的
  // 步骤一，与用户来路（新建流程 basic → outline → route）再无关系。
  // 回退入口因此只有一个：底栏「返回上一步」→ /projects/new?step=route（见下方底栏区段）。
  // 旧版向导（裸 /upload、?outline=1 但草稿不就绪）逐字不变：step > 1 时「上一步」照常出现。
```

**注记（三处同记之②）**：本段是本条对 P3 口径的**代码侧唯一注记点**。`hideBackButton` 删除后全库零命中，但 `:911-931` 区段不再引用它 —— 实施时须 `grep -n "hideBackButton" src/ tmp/` 复核为 0，且**不得**把 `hideBackButton` 改名为 `flowMode` 一并留下（PRD §10 口径：该标识随分支整体退场）。

### 3.3 根 `<section>` 标记（`:474-478`，D-2）

**现状**

```tsx
  return (
    <section className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] p-5 md:p-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <form
        className="mt-1 flex flex-col gap-4 xl:min-h-0 xl:flex-1"
        onSubmit={handleFormSubmit}
      >
```

**改动后**

```tsx
  return (
    <section
      className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] p-5 md:p-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col"
      data-upload-flow={flowMode ? "from-route" : undefined}
    >
      <form
        className="mt-1 flex flex-col gap-4 xl:min-h-0 xl:flex-1"
        onSubmit={handleFormSubmit}
      >
```

**为什么是 `<section>` 而不是 `<form>`**（PRD §4.6 给了两个候选）：`<form>` 在 `step === 3` 与旧版同样存在，锚点语义「这条落地是分流支路形态」由**外层容器**承载更稳；且 `:466` 的 loading 占位 `<section>` **不带**该属性，锚点只在真正的表单就绪后出现 —— 与探针 `waitFor('[data-upload-flow="from-route"]')` 的等待语义天然对齐。

**为什么旧版 DOM 零新增属性**：React 对值为 `undefined` 的 `data-*` **不输出属性**（不是 `data-upload-flow=""`）。旧版页面里 `document.querySelector('[data-upload-flow]')` 为 `null`；`[data-upload-flow="from-route"]` 亦为 `null`。J1/J2 的负向判据在此成立。

**红线**：不得写成 `data-upload-flow={flowMode ? "from-route" : ""}`（会渲染出空属性，旧版 DOM 多一个节点属性，且 `[data-upload-flow]` 选择器会被旧版命中）。

### 3.4 步骤条条件渲染（`:480-510`）

**现状（`:480-510` 逐字）**

```tsx
        {/* 步骤条：仅支持回退，前进必须走「下一步」校验 */}
        <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {wizardSteps.map(({ step: stepNumber, label }) => {
            const isCurrent = step === stepNumber;
            const isDone = step > stepNumber;
            const canGoBack = stepNumber < step;

            return (
              <li key={stepNumber} className="min-w-0 sm:flex-1">
                <button
                  type="button"
                  disabled={!canGoBack}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => goToStep(stepNumber)}
                  className={`flex w-full items-center gap-2 rounded-[1rem] border px-3 py-2 text-left text-sm transition-colors ${
                    isCurrent
                      ? "border-accent-soft bg-accent-soft/70 text-accent-strong"
                      : isDone
                        ? "border-line/80 bg-white/70 text-foreground"
                        : "border-line/60 bg-white/40 text-muted"
                  } ${canGoBack ? "cursor-pointer hover:border-accent-soft" : "cursor-default"}`}
                >
                  <span className="text-[11px] font-semibold tracking-[0.18em]">
                    {String(stepNumber).padStart(2, "0")}
                  </span>
                  <span className="truncate font-semibold">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
```

**改动后（只包一层条件，`<ol>` 内部 1 字不动）**

```tsx
        {/* 步骤条：仅支持回退，前进必须走「下一步」校验。
            REQ-24 §4.2：新版分支（从分流步进来）不渲染它 —— 「01/02/03」会让人以为
            还要填前两步，而那两步在分流支路里已经走过；判据是「不在 DOM」，
            不是隐藏（hidden / sr-only / disabled 均不合规）。 */}
        {flowMode ? null : (
          <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
            …（`:482-509` 的 map 与 <li> 内容逐字不动，仅整体多缩进 2 格）…
          </ol>
        )}
```

**实施注意**

1. 缩进整体 +2 格是**唯一**允许的格式变化；`aria-current={isCurrent ? "step" : undefined}` 必须原样保留（旧版判据、H5 新旧对照都读它）。
2. `wizardSteps`（`:77`）与 `goToStep` 在旧版分支仍需使用，**不得**因为「新版用不到」而删。
3. 新版下 `document.querySelectorAll("ol button").length === 0` —— J1 的 `stepBar` 判据按此写（不要用 `[aria-current]` 单独判，它同时受步骤条与其它元素影响，双判据更锋利）。

### 3.5 底栏返回（`:911-931`，含新增模块常量）

**3.5.1 新增模块常量**（插在 `wizardSteps`（`:77-81`）与 `:83` 的 `ConsentDialog` 注释之间）

```tsx
// REQ-24 §4.3：新版分支底栏「返回上一步」的落点 —— 新建流程的分流步。
// 用常量而非内联字面量：探针 J2/J3 与访谈页（同名常量，各自文件内声明）按同一字符串断言。
// 必须是真实 a[href]（Link，不是 Button + router.push）—— 中键新开、无 JS 兜底、
// href 属性可断言，且历史栈语义确定（不用 router.back()，见 PRD §4.3）。
const ROUTE_STEP_HREF = "/projects/new?step=route";
```

**3.5.2 返回控件（`:921-931`）**

现状（`:921-931` 逐字）

```tsx
            {step > 1 && !hideBackButton ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center sm:w-auto"
                onClick={goBack}
              >
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            ) : null}
```

改动后（外层 `<div className="flex flex-col gap-3 sm:flex-row sm:items-center">`（`:920`）与 `:933-958` 的提交按钮**不动**）

```tsx
            {flowMode ? (
              <Link
                href={ROUTE_STEP_HREF}
                data-upload-back="route-step"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-white/72 px-5 py-3 text-sm font-semibold tracking-[0.02em] text-accent-strong transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/92 sm:w-auto"
              >
                <ChevronLeft className="h-4 w-4" />
                返回上一步
              </Link>
            ) : step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center sm:w-auto"
                onClick={goBack}
              >
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            ) : null}
```

**类名来源（视觉零变化的依据）**：`Button`（`src/components/ui/button.tsx:26-30`）合并 `base`（`:27`）+ `variantMap.secondary`（`:12-13`）+ 调用点 `className`。上面的 `Link` 类名按同一顺序拼出，仅去掉 `<button>` 专属的 `disabled:*`（`disabled:cursor-not-allowed`、`disabled:bg-white/60`）—— `Link` 无 `disabled` 概念，句法上不可能命中，去掉不影响渲染。`ChevronLeft` 已 import（`:16`），`Link` 由 §2.1 的 `:12` 新增 import 提供。

**行为差异登记（有意为之）**：旧版是 `<button onClick={goBack}>`（SPA 内部回退），新版是 `<a href>`（跨页跳转到新建流程）。因此新版下 `goBack` 只服务旧版分支 —— **不得**因为「新版不用」而删 `goBack`（`:375-381`），H5 的旧版对照会点它。

### 3.6 访谈页顶栏（`interview-console.tsx:970-979`）

现状（`:970-979` 逐字）

```tsx
              {/* P8：顶栏左「返回提纲」（非破坏，进度保留）右「退出访谈」（放弃，回首页）。
                  两者语义不同，视觉上也要分得开 —— 退出用 ghost + 弱化色，不与返回抢视线。 */}
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/projects/${project.id}/outline`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回提纲
                </Link>
```

改动后（`<Button …退出访谈…>` `:980-989` 不动；`className` / `ArrowLeft` / `Link` 逐字保留）

```tsx
              {/* REQ-24 §4.4（取代 REQ-16 / P8 的落点口径）：顶栏左「返回上一步」= 回新建流程的
                  分流步（/projects/new?step=route）—— 仍是「非破坏，进度保留」，只是不再指向
                  /projects/{id}/outline（REQ-24 后 UI 已无该页，目标 404）。
                  右「退出访谈」（放弃，回首页）语义与视觉都不变：退出用 ghost + 弱化色，不与返回抢视线。 */}
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/projects/new?step=route"
                  data-interview-back="route-step"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回上一步
                </Link>
```

**实施注意**

1. 本处**不用**常量（该文件与上传页不共享模块；为一个字面量新建 lib 文件违反 C5/C6 的最小改动精神）。IMPL 明确登记这处「双份字面量」为**有意重复**：J2 与 J3 用同一字符串 `"/projects/new?step=route"` 断言，两份字面量必须逐字一致。
2. `<a href>` 与同级 `<Button>` 在 `flex items-center justify-between` 下对齐关系不变（两者都是 inline-flex 基线块），无需补 `className`。
3. 「返回上一步」四字与新建流程 header、上传页底栏**三处统一**；旧版上传页按钮标签「上一步」**保持不动**（PRD §4.5），因此全库会出现「上一步」与「返回上一步」并存 —— **这是预期**，探针用精确 `===` 全等匹配，不用 `includes`。

## 4. 锚点契约（新增 3 个 + 复用清单）

### 4.1 新增锚点

| 锚点 | 承载节点（改后行号） | 取值 | 旧版是否出现 | 引用它的断言 |
| --- | --- | --- | --- | --- |
| `[data-upload-flow="from-route"]` | 上传页根 `<section>`（`:475` 区段） | `"from-route"`（`flowMode` 真）／属性**不存在**（假） | **否** | J1①（`flow`+`flowOn`）、J2④、E1①、E2①、13-B②、13-C、crosscut 入口 |
| `[data-upload-back="route-step"]` | 新版底栏 `Link`（`:921` 区段） | `"route-step"` | **否**（旧版此处是 `<Button>上一步</Button>`） | J2①③ |
| `[data-interview-back="route-step"]` | 访谈页顶栏 `Link`（`interview-console.tsx:973` 区段） | `"route-step"` | —（访谈页无新旧分支） | J3① |

### 4.2 复用的既有锚点（本次**零改动**，但被新断言引用）

`#route-chooser-upload` / `#route-chooser-realtime` / `#new-step-route` / `[data-step-next="outline"]` / `input[type="file"]`（仅 `step === 3` 渲染）/ `[data-upload-modal="consent"]` / `[data-interview-exit="trigger"]`；**旧版判据保留**：`ol button` 与 `button[aria-current="step"]`、`#projectName` / `#intervieweeName` / `#notes` / `#outlineDraftMarkdown`（仅 `step === 1` 渲染）；**草稿口径新增读取**：`sessionStorage["memory-engine-outline-session"]`（键名权威来源 `src/lib/outline-session.ts`；`verify-phase3.mjs:11` 已有 `SESSION_KEY` 常量，`cdp-req13-outline.mjs` 需新增，见 §6.6）。

### 4.3 用法纪律

1. 新增 `data-*` **只允许**加在新增 / 改动节点上；旧版节点（裸 `/upload` 的步骤条、步骤一字段、旧版「上一步」按钮）**不得**加任何标记 —— 否则 J1/H5 的负向判据失效（PRD §4.6）。
2. 新版分支判据统一写 `[data-upload-flow="from-route"]`，**不写** `[data-upload-flow]`：后者在新版为真、旧版为 `null`，两者恰好等价，但前者表达「我就是这条支路」的意图，且为将来扩展留位。
3. 三个锚点的值刻意统一为 `"route-step"`（与 `#new-step-route`、`?step=route` 同名）—— 便于 `grep -rn 'route-step' tmp/ src/` 一次列全「所有回分流步的入口」。

## 5. P3 口径被取代 · 修订注记（三处同记之③：正文）

### 5.1 口径对照

| 维度 | REQ-21 / P3 原口径 | REQ-24 §3.3 新口径 |
| --- | --- | --- |
| 触发条件 | `step === 3 && hasOutlineFlag`（`:389`） | `flowMode === true`（`hasOutlineFlag && draftReady`，`flowMode` 定义见 §3.1） |
| 动作 | **隐藏**上传页内部「上一步」按钮（`hideBackButton`） | **不渲染步骤条**（内部「上一步」、步骤一/二内容随之一并退场） |
| 回退入口 | 无 —— 藏掉后页面内**没有任何**回退入口 | 底栏「返回上一步」→ `/projects/new?step=route`（J2） |
| 步骤条 | 保留（用户仍可点回步骤二） | 不渲染（`aria-current` 命中数 = 0） |
| 能否回到步骤一 | 能（点步骤条） | 不能（无步骤条、无步骤一） |
| 自动化证据 | `verify-phase3.mjs` H5 后半（按钮 `null`） | **J2**（有 `href`、落分流步、往返闭合）；H5 改为旧版对照 |

### 5.2 残留痕迹清单（实施后逐条 grep 复核）

| 痕迹 | 现状位置 | 处置 |
| --- | --- | --- |
| `hideBackButton` | `interview-upload-form.tsx:389`（定义）、`:921`（引用） | 全删；`grep -rn "hideBackButton" src/ tmp/` 应为 **0** |
| P3 注释块 | `interview-upload-form.tsx:383-388` | 改写为 REQ-24 口径（§3.2 给全文），不保留原文 |
| `goBack()` | `interview-upload-form.tsx:375-381` | **保留**（旧版「上一步」仍调它；§3.5 已登记） |
| `UPLOAD_STEP` | `cdp-req13-outline.mjs:278` | 保留，仅进 detail / note（D-5） |
| `backToStep1()` | `cdp-req13-outline.mjs:281-284`（+ 调用点 `:295`/`:335`）、`cdp-req13-crosscut.mjs:209-213`（+ 调用点 `:273`） | 两处**全删**（D-4 / §6.8） |
| 「返回提纲」文案 | `interview-console.tsx:968`（注释）、`:970`（注释）、`:978`（UI） | 三处随 §3.6 一并改写；改后全库 `返回提纲` 归零 |
| 文档 | `docs/` 内 `hideBackButton` 仅出现在 `PRD_REQ-24_…md` 与本文 | **不改**旧文档（PRD §3.3 已记「该决策此前未进入任何产品文档」，本条是它的第一次文档化落点） |

### 5.3 三处同记点（最终清单）

1. **本 IMPL 文件头**（页面顶端引用块下方那段）；2. **代码注释** `interview-upload-form.tsx` `:383` 区段（改后文本见 §3.2）；3. **本节 §5**。
   README / PRD / 其他 `docs/*.md` **不记**（PRD 仅新增本条链接与本文，不改正文）。

## 6. 探针实现

### 6.0 探针清账（`tmp/` 全量扫描结果）

扫描口径：`Get-ChildItem -Path tmp -Filter *.mjs | Select-String -Pattern '/upload'`、`'#projectName|#intervieweeName|aria-current'`、`'#outlineDraftMarkdown'`。

| 脚本 | 行数 | `check(` | 是否进 `/upload` | REQ-24 影响 | 处置 |
| --- | --- | --- | --- | --- | --- |
| `verify-phase3.mjs` | 870 | **36** | 是（E1/E2/G/H5/I1-I3） | 7 条判据失效（E1×4、E2×2、H5×1）+ 2 处 helper/取样失效 | 迁移 + 新增，§6.1–§6.5、§6.7 → **39** |
| `cdp-req13-outline.mjs` | 405 | 24 | 是（13-B / 13-C / 不串味段） | 13-B 2 条 + 13-C 1 条判据失效 + `backToStep1()` 变死代码 | 改判据，§6.6 → 仍 24 |
| `cdp-req13-crosscut.mjs` | 399 | 13 | 是（确认提纲 → 分流步 → `/upload`） | **`:275` 判据失效 + `:286` 抛异常使全脚本崩（P-3）** | 改判据 + 载荷改读草稿，§6.8 → 仍 13 |
| `cdp-req14-consent.mjs` | 433 | 28 | 是（`:279` **裸** `goto('/upload')`） | **无**（裸访问 ⇒ 旧版逐字不变） | 不动 |
| `cdp-req13-prefill.mjs` | 344 | 19 | 是 | **无新影响**：自 UI-12 起已不可运行（`:203-206` 用已删的四个 `#outline-*` id，`__t.set` 直接 throw；`:290` 用旧按钮文案「跳过，直接上传」） | **不在本轮范围**，只登记不修（与 `verify-phase2.mjs` 同类：已退役） |
| `measure-375.mjs` | 113 | — | **否**（零 `/upload` 命中） | 无 | 不动 |
| `cdp-ui24-fixes.mjs` | 525 | — | **否** | 无（REQ-16 期 UI-24 验收脚本，走提纲步新 id） | 不动 |
| `verify-phase1.mjs` / `verify-phase2.mjs` | 263 / 439 | — | 是 | 无新影响（REQ-16 收口时已退役，本轮不跑） | 不动 |
| 其余（`diag-*` / `probe-*` / `fill-*` / `cdp-flash-*` / `cdp-frames-*` / `cdp-narrow-trace` / `cdp-scroll-test` / `cdp-header-height` / `cleanup-*` / `reformat-arch-doc` / `alias-loader` / `register-alias` / `*.bak` / `*.log`） | — | — | 部分 | 无（一次性诊断 / 备份 / 日志，不在验收链上） | 不动 |

> **P-3（PRD §6.3 补遗二）**：PRD §6.3 对 `cdp-req13-crosscut.mjs` 的判断是「不受影响，回归跑绿即可」。实测**不成立** —— 其入口（`:224-268`：`enterOutlineStep()` 填基本信息 → `makeDraft()` → `confirmOutlineAndGoUpload()`）必然带上就绪草稿落到 `/upload?outline=1` ⇒ 新版分支 ⇒ `backToStep1()` 15s 空等、`:275` 红、`:286` 抛 `TypeError` 直接终止脚本。处置与 13-B/13-C 同法（判据换源 + 载荷证据改读草稿），**13 条断言不变**，改法见 §6.8。

### 6.1 `verify-phase3.mjs` 总账：36 → 39

| 段 | `check(` 所在行 | 条数 | REQ-24 影响 | 处置 |
| --- | --- | --- | --- | --- |
| 前置段（A–F：登录 / 旧路由 307 / 草稿写入 / 步骤跳转 / 裸 `/upload` 不串味 / 改动C / 修复A） | `:141,148,149,152,156,171,182,184,188,194,200,201,202,215,222` | 15 | 不涉及新版分支 | 不动 |
| **E1** | `:235,240,241,242` | 4 | 步骤条 + 步骤一字段 ⇒ 全失效 | **迁移**（§6.7） |
| **E2** | `:270,280,285` | 3 | `:270` 在提纲步（不受影响）；`:280`/`:285` 失效 | 迁 2 条（§6.7）；`:270` 不动 |
| G（建项目主链路） | `:345` | 1 | 不涉及 | 不动 |
| H8 / H9（REQ-16 期 R7） | `:392,426` | 2 | 不涉及 | 不动 |
| H1 / H2 / H3（新建流程 header 返回） | `:461,489,520` | 3 | 不涉及（改的是 `/upload` 与访谈页） | 不动 |
| H4（embedded 自动生成） | `:557` | 1 | 不涉及 | 不动 |
| **H5** | `:594` | 1 | 断言对象消失 | **改对象**（§6.2，条数不变） |
| H6 / H7（outline-required 弹窗） | `:645,666` | 2 | 不涉及 | 不动 |
| I2 / I3（ConsentDialog portal） | `:714,733` | 2 | 判定不受影响；`I2` detail 增 `flow` | 只改取样（§6.4，D-3） |
| I1（密级默认值） | `:840` | 1 | 判定不受影响（`:845` 已容忍 `step === null`） | 只改取样（§6.4，D-3） |
| B（未登录旧路由） | `:857` | 1 | 不涉及 | 不动 |
| **新增 J1 / J2 / J3** | 插入 `:850` 与 `:852` 之间 | **+3** | 新版分支 / 底栏返回 / 访谈页返回 | 新增（§6.5） |
| **合计** | | 36 − 0 + 3 = **39** | | |

**插入点**：J 段整体插在 I1 的 `check(...)`（`:840-850`，以 `);` 结束）之后、B 段注释 `// ── B：未登录访问旧路由`（`:852`）之前。理由：I1 结束时会 `router.push('/projects/probe-noop?autostart=1')` 离开 `/upload`，J1 反正要重新 `goto`；且 J 段必须在 B 段**清 cookie** 之前（B 段之后所有页面都会跳 `/login`）。

### 6.2 H5 改对象：`隐藏上一步` → `旧版向导完整性`（`:563-599`）

**现状断言**：`h5Step.includes("音频与提交") && h5BackOnStep3 === null && h5Step2.includes("采集路径") && h5BackOnStep2 === "上一步"`。

**改动后（整段替换；`UPLOAD_BACK` 常量与「精确文案」的理由逐字保留）**

```js
  // ── H5：旧版向导完整性（REQ-24 改对象，不删条）──
  // REQ-24 前这条断言「经分流步落步骤三 + 上一步按条件隐藏」。新版分支已不渲染步骤条、
  // 也没有上传页内部「上一步」，那条断言失去对象 —— 但**不得删**：它是「旧版零变化」（M3）
  // 在自动化侧的唯一条目，改对象为「裸 /upload 三步向导完整 + 逐级回退保留输入」。
  //
  // 选按钮用精确文案 '上一步'（trim 后全等），不用 includes：新版底栏是「返回上一步」
  // （a[href]，且根本不是 button），旧版是「上一步」（button）；全等匹配把两者分得干干净净。
  const UPLOAD_BACK = `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === '上一步'); return b ? b.innerText.trim() : null; })()`;
  // 先清草稿再重载：裸 /upload 也会清（interview-upload-form.tsx:301-307 的 effect），
  // 但那是挂载之后的事 —— 第一跳的步骤可能已按残留草稿落在步骤二/三，所以先跳一次再清再跳。
  await goto(`${BASE}/upload`, `Boolean(document.querySelector('form'))`);
  await ev(`sessionStorage.removeItem(${JSON.stringify(SESSION_KEY)})`);
  await goto(`${BASE}/upload`, `Boolean(document.querySelector('#projectName'))`);
  await inject();
  const h5S1 = await ev(`({
    step: window.__p3.upStep(),
    olButtons: document.querySelectorAll('ol button').length,
    flowAnchor: Boolean(document.querySelector('[data-upload-flow]')),
    pn: window.__p3.val('#projectName'),
    back: ${UPLOAD_BACK},
  })`);
  await ev(`window.__p3.set('#projectName', 'H5-旧版项目名')`);
  await ev(`window.__p3.set('#intervieweeName', 'H5-旧版受访者')`);
  await ev(`window.__p3.clickText('下一步')`);
  // 步骤条只允许回退（canGoBack = stepNumber < step），故等 aria-current 真的挪到步骤二，不靠 sleep。
  await waitFor(`(() => { const b = document.querySelector('button[aria-current="step"]'); return Boolean(b && b.innerText.includes('采集路径')); })()`, 20, 150);
  await inject();
  const h5S2 = await ev(`({ step: window.__p3.upStep(), back: ${UPLOAD_BACK} })`);
  // 逐级回退：点步骤二的「上一步」回步骤一 —— 旧版是 SPA 内部 state，值必须保留。
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === '上一步'); if (b) b.click(); return Boolean(b); })()`);
  await waitFor(`(() => { const b = document.querySelector('button[aria-current="step"]'); return Boolean(b && b.innerText.includes('基础信息')); })()`, 20, 150);
  await inject();
  const h5Back = await ev(`({ step: window.__p3.upStep(), pn: window.__p3.val('#projectName'), back: ${UPLOAD_BACK} })`);
  check(
    "H5 旧版对照（REQ-24 改对象）：裸 /upload 三步向导完整 —— 步骤条三步、上一步按 step>1 出现、逐级回退保留输入",
    h5S1.step?.includes("基础信息") === true && h5S1.olButtons === 3 && h5S1.flowAnchor === false &&
      h5S1.pn === "" && h5S1.back === null &&
      h5S2.step?.includes("采集路径") === true && h5S2.back === "上一步" &&
      h5Back.step?.includes("基础信息") === true && h5Back.pn === "H5-旧版项目名" && h5Back.back === null,
    `步骤一：${h5S1.step}／步骤条按钮=${h5S1.olButtons}／新版锚点=${h5S1.flowAnchor}／项目名=${JSON.stringify(h5S1.pn)}／上一步=${h5S1.back ?? "无"} ‖ ` +
      `步骤二：${h5S2.step}／上一步=${h5S2.back ?? "无"} ‖ 回退后：${h5Back.step}／项目名=${JSON.stringify(h5Back.pn)}／上一步=${h5Back.back ?? "无"}`,
  );
```

**判据依据（实施前复核这三条事实）**

1. `validateStepOne()`（`interview-upload-form.tsx:332-345`）只要求 `projectName` / `intervieweeName`（+ `custom` 时的自定义场景名）；`collectionScenario` 初值 `"urban_memory"`（`:251`）、`confidentialityLevel` 初值 `"internal"`（`:262`）⇒ 填两项后点「下一步」必进步骤二。
2. 步骤一不渲染「上一步」（条件是 `step > 1`）⇒ `h5S1.back === null`；步骤二渲染且文案 `上一步` ⇒ `h5S2.back === "上一步"`。
3. 裸 `/upload` 下 `flowMode === false` ⇒ 根 `<section>` **不输出** `data-upload-flow` ⇒ `[data-upload-flow]` 为 `null`。

### 6.3 `enterUploadStep3()` 判据迁移（`:676-690`）

**现状（末两行）**

```js
    await waitFor(`location.pathname === '/upload'`, 60, 250);
    await waitFor(`Boolean(document.querySelector('button[aria-current="step"]'))`, 40, 150);
    await inject();
```

**改动后（只换等待判据；函数名不改 —— 它仍准确描述「落到步骤三内容」）**

```js
    await waitFor(`location.pathname === '/upload'`, 60, 250);
    // REQ-24：经分流步落地即新版分支，步骤条已不渲染 —— 等新锚点，不再等 aria-current。
    // 该锚点同时保证 step === 3 已生效：旧版分支不输出这个属性，属性出现 = 新版形态就绪。
    await waitFor(`Boolean(document.querySelector('[data-upload-flow="from-route"]'))`, 40, 150);
    await inject();
```

### 6.4 I 段取样（D-3，**判定一条不改**）

**I1 的落地快照（`:697`）**

```js
  await enterUploadStep3();
  const iStep = await ev(`(() => {
    const b = document.querySelector('button[aria-current="step"]');
    return {
      step: b ? b.innerText.trim().replace(/\\s+/g, ' ') : null,
      flow: Boolean(document.querySelector('[data-upload-flow="from-route"]')),
    };
  })()`);
```

- `iStep` 只在 **I2 的 detail 文案**（`:718`）里出现：把 `落地步骤="${iStep}"` 改成 `落地 flow=${iStep.flow}／step=${iStep.step ?? "—（新版无步骤条）"}`。
- `I2_PROBE`（`:702-712`）**加** `flow: Boolean(document.querySelector('[data-upload-flow="from-route"]'))`，同样**只进 detail**。
- `I1_SNAP`（`:827-837`）与判定（`:840-850`）**一个字不改**：新版下 `i1.step === null`，`:845` 的 `(i1.step === null || !i1.step.includes("基础信息"))` 原本就为此留了口子；真正的负向护栏是 `posts === 1` + `confidentialityLevel === "internal"` + `!err.includes("请选择保密级别")`，与步骤条无关。
- `patchFetch` 写进 `probe-i` 的 `stepAtFetch`（`:766-770`）在新版恒为 `null`，只进 detail，**不改**。

### 6.5 新增 J1 / J2 / J3

**J1 · 新版分支形态**

```js
  // ── J1：REQ-24 流程入口 → 上传页新版分支（无步骤条、不渲染步骤一字段、提交控件在位）──
  // 入口四步与 H5/I 段同法：/projects/new → 基本信息 → 跳过提纲 → 分流步 →「上传音频」。
  await goto(`${BASE}/projects/new`, `Boolean(document.querySelector('#projectName'))`);
  await inject();
  await ev(`window.__p3.set('#projectName', 'J-新版项目名')`);
  await ev(`window.__p3.set('#intervieweeName', 'J-新版受访者')`);
  await ev(`window.__p3.click('[data-step-next="outline"]')`);
  await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
  await ev(`window.__p3.clickText('跳过提纲，下一步')`);
  await waitFor(`Boolean(document.querySelector('#new-step-route'))`);
  await inject();
  await ev(`window.__p3.click('#route-chooser-upload')`);
  await waitFor(`location.pathname === '/upload'`, 60, 250);
  const j1FlowWait = await waitFor(`Boolean(document.querySelector('[data-upload-flow="from-route"]'))`, 40, 150);
  await inject();
  const J1_PROBE = `(() => {
    const flow = document.querySelector('[data-upload-flow="from-route"]');
    return {
      flow: Boolean(flow),
      flowTag: flow ? flow.tagName : null,
      ariaSteps: document.querySelectorAll('button[aria-current="step"]').length,
      stepBarButtons: document.querySelectorAll('ol button').length,
      hasProjectName: Boolean(document.querySelector('#projectName')),
      hasIntervieweeName: Boolean(document.querySelector('#intervieweeName')),
      hasNotes: Boolean(document.querySelector('#notes')),
      hasFile: Boolean(document.querySelector('input[type="file"]')),
      hasSubmit: [...document.querySelectorAll('button')].some((b) => b.innerText.includes('创建项目并开始处理')),
      url: location.pathname + location.search,
    };
  })()`;
  const j1 = await ev(J1_PROBE);
  check(
    "J1 REQ-24：经分流步进上传页 → 新版分支（无步骤条、无步骤一字段、提交控件在位）",
    j1FlowWait === true && j1.flow === true && j1.ariaSteps === 0 && j1.stepBarButtons === 0 &&
      j1.hasProjectName === false && j1.hasIntervieweeName === false && j1.hasNotes === false &&
      j1.hasFile === true && j1.hasSubmit === true && j1.url === "/upload?outline=1",
    `flow=${j1.flow}<${j1.flowTag}> 步骤条按钮=${j1.stepBarButtons} aria-current=${j1.ariaSteps} ` +
      `#projectName=${j1.hasProjectName} #intervieweeName=${j1.hasIntervieweeName} #notes=${j1.hasNotes} ` +
      `文件输入=${j1.hasFile} 提交按钮=${j1.hasSubmit} URL=${j1.url}`,
  );
```

- `#notes` 一并断言是刻意的：它同属步骤一（`:648`），能同时证伪「只把 `#projectName` 挪走」这种半吊子实现。
- `url === "/upload?outline=1"`：RouteChooser 的上传入口恒定带 flag（`route-chooser.tsx:136-138` 的 router.push 带 ${OUTLINE_FLAG_PARAM}=1），此断言把「入口链路未被改动」也钉住。
  > 探针里沿用的注释写的是 `route-chooser.tsx` 的 `:119-123` —— 那是 stale 行号（`:119-123` 实为分流步引导弹窗的尾部）。实施时**改判据的同时把行号一并订正为 `:136-138`**，不要让 stale 引用继续扩散。

**J2 · 新版底栏返回（自带入口，不依赖 J1 残留状态）**

```js
  // ── J2：REQ-24 新版底栏「返回上一步」→ 分流步；再点「上传音频」往返闭合 ──
  await goto(`${BASE}/projects/new`, `Boolean(document.querySelector('#projectName'))`);
  await inject();
  await ev(`window.__p3.set('#projectName', 'J2-往返项目名')`);
  await ev(`window.__p3.set('#intervieweeName', 'J2-往返受访者')`);
  await ev(`window.__p3.click('[data-step-next="outline"]')`);
  await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
  await ev(`window.__p3.clickText('跳过提纲，下一步')`);
  await waitFor(`Boolean(document.querySelector('#new-step-route'))`);
  await inject();
  await ev(`window.__p3.click('#route-chooser-upload')`);
  await waitFor(`location.pathname === '/upload'`, 60, 250);
  await waitFor(`Boolean(document.querySelector('[data-upload-back="route-step"]'))`, 40, 150);
  await inject();
  const j2Ctrl = await ev(`(() => {
    const a = document.querySelector('[data-upload-back="route-step"]');
    return {
      tag: a ? a.tagName : null,
      label: a ? a.innerText.trim().replace(/\\s+/g, ' ') : null,
      href: a ? a.getAttribute('href') : null,
      oldBack: [...document.querySelectorAll('button')].some((x) => x.innerText.trim() === '上一步'),
      stepBarButtons: document.querySelectorAll('ol button').length,
    };
  })()`);
  await ev(`window.__p3.click('[data-upload-back="route-step"]')`);
  await waitFor(`location.pathname === '/projects/new'`, 60, 250);
  await inject();
  const j2Land = await ev(`({ search: location.search, up: Boolean(document.querySelector('#route-chooser-upload')), live: Boolean(document.querySelector('#route-chooser-realtime')) })`);
  await ev(`window.__p3.click('#route-chooser-upload')`);
  await waitFor(`location.pathname === '/upload'`, 60, 250);
  const j2Second = await waitFor(`Boolean(document.querySelector('[data-upload-flow="from-route"]'))`, 40, 150);
  await inject();
  const j2Round = await ev(`({ url: location.pathname + location.search, back: Boolean(document.querySelector('[data-upload-back="route-step"]')) })`);
  check(
    "J2 REQ-24：新版底栏「返回上一步」→ 分流步（可再进上传支路，往返无损）",
    j2Ctrl.tag === "A" && j2Ctrl.label === "返回上一步" && j2Ctrl.href === "/projects/new?step=route" &&
      j2Ctrl.oldBack === false && j2Ctrl.stepBarButtons === 0 &&
      j2Land.search === "?step=route" && j2Land.up === true && j2Land.live === true &&
      j2Second === true && j2Round.url === "/upload?outline=1" && j2Round.back === true,
    `控件=<${j2Ctrl.tag}>"${j2Ctrl.label}" href=${j2Ctrl.href} 旧版上一步=${j2Ctrl.oldBack} 步骤条=${j2Ctrl.stepBarButtons} ‖ ` +
      `落点=${j2Land.search} 两卡=上传${j2Land.up}/实时${j2Land.live} ‖ 往返后=${j2Round.url} 返回控件=${j2Round.back}`,
  );
```

- `j2Ctrl.oldBack === false` 与 `j2Ctrl.tag === "A"` 是一对**互斥对照**：既要有 `a[href]`，又**不能**再出现 `button` 文案「上一步」—— 把「顺手把旧版按钮也塞进新版」的实现挡在门外。
- `j2Second === true` 证「往返无损」：返回分流步**不写不清草稿**，再点上传仍进新版（PRD §4.3）。
- 用 Link 的真实 `href` 导航（`click()` 走 Next 客户端路由），**不用** `history.back()`：断言可重复、与用户操作同路径。

**J3 · 访谈页返回（复用 G 段建项目契约；独立建、独立删）**

```js
  // ── J3：REQ-24 访谈页顶栏「返回上一步」→ 分流步 ──
  // 入口复用 G 段的建项目契约（同一 payload、同走 UI 的 #route-chooser-realtime）：
  // 注入提纲草稿后点「AI 实时访谈」→ POST /api/projects/ai-interview 得 201 → 落
  // /projects/{id}/interview。**不依赖 LLM**（提纲由 seed 直接给出）。
  // 独立建、独立删：不复用 gPid，避免与 G 段清理耦合（G 段的 DELETE 在 :434-440，早于此段）。
  await goto(`${BASE}/projects/new`, `Boolean(document.querySelector('#projectName'))`);
  await inject();
  await ev(`window.__p3.set('#projectName', 'A-基本步项目名')`);
  await ev(`window.__p3.set('#intervieweeName', 'A-基本步受访者')`);
  await ev(`window.__p3.set('#overview', 'A-基本步描述')`);
  await ev(`window.__p3.click('[data-step-next="outline"]')`);
  await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
  await ev(`window.__p3.clickText('跳过提纲，下一步')`);
  await waitFor(`Boolean(document.querySelector('#new-step-route'))`);
  await inject();
  await ev(`sessionStorage.setItem(${JSON.stringify(SESSION_KEY)}, ${JSON.stringify(AI_SEED)})`);
  apiLog = [];
  await ev(`window.__p3.click('#route-chooser-realtime')`);
  let j3Path = "";
  for (let i = 0; i < 60; i += 1) {
    const p = await ev(`location.pathname`).catch(() => null);
    if (typeof p === "string" && /^\/projects\/[^/]+\/interview$/.test(p)) { j3Path = p; break; }
    await sleep(500);
  }
  // 清理只认响应体里的 id —— 绝不从路径正则取（`/projects/new` 的 "new" 会被误当 id，见 G 段注释 :435）。
  const j3Hit = apiLog[0] ?? null;
  if (j3Hit && j3Hit.body === null) {
    try {
      const b = await send("Network.getResponseBody", { requestId: j3Hit.requestId }, S);
      j3Hit.body = b.base64Encoded ? Buffer.from(b.body, "base64").toString("utf8") : b.body;
    } catch { /* 拿不到响应体就只按路径清理 */ }
  }
  const j3Pid = (() => { try { return JSON.parse(j3Hit?.body ?? "null")?.project?.id ?? null; } catch { return null; } })();
  await inject();
  const j3Ctrl = await ev(`(() => {
    const a = document.querySelector('[data-interview-back="route-step"]');
    return {
      tag: a ? a.tagName : null,
      label: a ? a.innerText.trim().replace(/\\s+/g, ' ') : null,
      href: a ? a.getAttribute('href') : null,
      hasOutlineReturn: [...document.querySelectorAll('a')].some((x) => x.innerText.includes('返回提纲')),
      exit: Boolean(document.querySelector('[data-interview-exit="trigger"]')),
      path: location.pathname,
    };
  })()`);
  await ev(`(() => { const a = document.querySelector('[data-interview-back="route-step"]'); if (!a) return false; a.click(); return true; })()`);
  await waitFor(`location.pathname === '/projects/new'`, 60, 250);
  await inject();
  const j3Land = await ev(`({ search: location.search, up: Boolean(document.querySelector('#route-chooser-upload')), live: Boolean(document.querySelector('#route-chooser-realtime')) })`);
  // 清理（与 G 段 :436 同法：只认响应体 id）。PRD 写「finally 内」，G 段先例是段末 inline ——
  // IMPL 取 inline（收口效果相同），并把状态码打进 detail。
  let j3Del = "未创建（无 id）";
  if (j3Pid) {
    j3Del = await ev(`fetch('/api/projects/${j3Pid}',{method:'DELETE',credentials:'include'}).then(r=>r.status)`);
    note(`J3 段探针项目 ${j3Pid} 已清理 → DELETE status=${j3Del}`);
  } else if (j3Path) {
    note(`J3 段未取到响应体 id（path=${j3Path}），跳过清理 —— 请用 tmp/cleanup-probe-projects.mjs 复核残留`);
  }
  check(
    "J3 REQ-24：访谈页顶栏「返回上一步」→ 分流步（退出访谈入口仍在）",
    j3Ctrl.tag === "A" && j3Ctrl.label === "返回上一步" && j3Ctrl.href === "/projects/new?step=route" &&
      j3Ctrl.hasOutlineReturn === false && j3Ctrl.exit === true && j3Ctrl.path === j3Path && j3Path !== "" &&
      j3Land.search === "?step=route" && j3Land.up === true && j3Land.live === true,
    `控件=<${j3Ctrl.tag}>"${j3Ctrl.label}" href=${j3Ctrl.href} 残留「返回提纲」=${j3Ctrl.hasOutlineReturn} 退出入口=${j3Ctrl.exit} ` +
      `落地=${j3Ctrl.path} 返回后=${j3Land.search} 两卡=上传${j3Land.up}/实时${j3Land.live} 清理=${j3Del}`,
  );
```

- `j3Ctrl.path === j3Path && j3Path !== ""` 把「这条断言真的在访谈页上跑」钉住：入口失灵时 `j3Path` 为空串、`path` 仍是 `/projects/new`，断言必红而非假绿。
- `hasOutlineReturn === false` 同时覆盖 §5.2 的「`返回提纲` 文案归零」。
- 与 G 段的分工：G 段证「建项目契约 + 落访谈页」；J3 只证「访谈页返回控件的形态与落点」。两者共用 `AI_SEED`（`:292-299`）与 `apiLog`，不新增 seed。

### 6.6 `cdp-req13-outline.mjs`：13-B / 13-C（PRD §6.3 主体）

#### 6.6.0 顶部与 helper（D-4 / D-5）

1. **新增常量**（插在 `:15` `const PASSWORD` 之后）

```js
// REQ-24 §6.6：草稿判据改读 sessionStorage（键名与 src/lib/outline-session.ts 一致；
// verify-phase3.mjs:11 已有同名常量，此处补齐）。
const SESSION_KEY = "memory-engine-outline-session";
```

2. **`UPLOAD_STEP`（`:278`）保留**（D-5）：仍按 `aria-current` 取快照，字符不改，只把它的用途限制在 detail / note。
3. **`backToStep1()`（`:281-284`）删除**（D-4），同步删除 `:295` 与 `:335` 两处调用；`:279-280` 的注释（「提纲折叠区与 `#outlineDraftMarkdown` 只在步骤一渲染」）一并删除 —— 新版分支根本没有步骤一可回。

#### 6.6.1 13-B（`:286-302`，4 条断言一条不减）

**改动后**

```js
  // 草稿快照（新增）：REQ-24 把「带入是否生效」的证据从 DOM 移到 sessionStorage ——
  // 新版分支不渲染步骤一，字段值不再可读。
  const DRAFT_SNAP = `(() => {
    const raw = sessionStorage.getItem(${JSON.stringify(SESSION_KEY)});
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      return {
        pn: s.profile?.projectName ?? null,
        in2: s.profile?.intervieweeName ?? null,
        notes: s.profile?.notes ?? null,
        md: s.outlineMarkdown ?? null,
      };
    } catch { return 'PARSE_ERROR'; }
  })()`;

  const atUpload = await ev(`(() => ({
    url: location.pathname + location.search,
    step: ${UPLOAD_STEP},
    flow: Boolean(document.querySelector('[data-upload-flow="from-route"]')),
    ariaSteps: document.querySelectorAll('button[aria-current="step"]').length,
  }))()`);
  const atUploadDraft = await ev(DRAFT_SNAP);

  check("13-B 经分流步落到 /upload?outline=1", atUpload.url === "/upload?outline=1", atUpload.url);
  // REQ-24 §6.3：旧判据读步骤条（`step` 含「采集路径」）。新版分支不渲染步骤条，
  // 判据换源为「新版锚点存在 + aria-current 命中数 0」；旧值只进 detail。
  check("13-B 落新版分支（步骤条与步骤一都不渲染）",
    atUpload.flow === true && atUpload.ariaSteps === 0,
    `flow=${atUpload.flow} aria-current 命中=${atUpload.ariaSteps}（旧判据 step="${atUpload.step ?? "null"}"：仅记录）`);
  check("13-B 提纲与画像已写进草稿（profile 两项齐 + 提纲非空）",
    typeof atUploadDraft === "object" && atUploadDraft !== null &&
      atUploadDraft.pn === "REQ13 探针项目" && atUploadDraft.in2 === "陈秀兰" &&
      typeof atUploadDraft.md === "string" && atUploadDraft.md.trim().length > 0,
    `草稿项目名=${JSON.stringify(atUploadDraft?.pn)} 受访者=${JSON.stringify(atUploadDraft?.in2)} ` +
      `草稿提纲=${(atUploadDraft?.md ?? "").length} 字（13-A 的 mdA=${mdA?.length ?? 0} 字，逐字相同=${atUploadDraft?.md === mdA}）`);
  // D-6：端到端证据 —— 提交载荷里必须带着提纲。桩掉 POST /api/projects（口径照抄
  // verify-phase3.mjs:747-813 的 I_HELPERS），零副作用、不建真项目。
  // 假音频注入照抄 verify-phase3.mjs:782-790 的 setFile。
  await ev(`(() => {
    window.__r24 = { hit: null };
    const real = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String((init && init.method) || (typeof input === 'string' ? 'GET' : input && input.method) || 'GET').toUpperCase();
      if (method === 'POST' && /\\/api\\/projects$/.test(url)) {
        const body = {};
        try { if (init && init.body instanceof FormData) { for (const [k, v] of init.body.entries()) body[k] = (v instanceof File) ? 'FILE:' + v.name : v; } } catch { /* ignore */ }
        try { sessionStorage.setItem('probe-r24-13b', JSON.stringify({ url, body })); } catch { /* ignore */ }
        return Promise.resolve(new Response(JSON.stringify({ project: { id: 'probe-noop' } }), {
          status: 201, headers: { 'Content-Type': 'application/json' },
        }));
      }
      return real(input, init);
    };
    const el = document.querySelector('input[type="file"]');
    if (el) {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0])], 'probe-r24.wav', { type: 'audio/wav' }));
      el.files = dt.files;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  })()`);
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('创建项目并开始处理')); if (b) b.click(); return true; })()`);
  await waitFor(`Boolean(document.querySelector('[data-upload-modal="consent"]'))`);
  await ev(`(() => { const d = document.querySelector('[data-upload-modal="consent"]'); const cb = d ? d.querySelector('input[type="checkbox"]') : null; if (cb && !cb.checked) cb.click(); return true; })()`);
  await waitFor(`(() => { const d = document.querySelector('[data-upload-modal="consent"]'); if (!d) return false; const b = [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === '我确认'); return Boolean(b && !b.disabled); })()`, 20, 150);
  await ev(`(() => { const d = document.querySelector('[data-upload-modal="consent"]'); const b = d ? [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === '我确认') : null; if (b && !b.disabled) b.click(); return true; })()`);
  await waitFor(`Boolean(sessionStorage.getItem('probe-r24-13b')) || location.pathname !== '/upload'`, 20, 150);
  const b13 = await ev(`(() => { const raw = sessionStorage.getItem('probe-r24-13b'); try { return raw ? JSON.parse(raw) : null; } catch { return 'PARSE_ERROR'; } })()`);
  check("13-B 提交载荷携带提纲（新版分支的端到端证据）",
    typeof b13 === "object" && b13 !== null &&
      b13.body?.outlineDraftMarkdown === atUploadDraft?.md &&
      typeof b13.body?.outlineDraftMarkdown === "string" && b13.body.outlineDraftMarkdown.trim().length > 0 &&
      b13.body?.audio === "FILE:probe-r24.wav" && b13.body?.projectName === "REQ13 探针项目",
    `POST 命中=${b13 !== null} 载荷提纲=${(b13?.body?.outlineDraftMarkdown ?? "").length} 字（草稿=${(atUploadDraft?.md ?? "").length} 字，逐字相同=${b13?.body?.outlineDraftMarkdown === atUploadDraft?.md}） ` +
      `audio=${b13?.body?.audio} projectName=${JSON.stringify(b13?.body?.projectName)}`);
```

**两条判据取舍说明**：都不与 13-A 的 `mdA` 做逐字相等（草稿/载荷可能被上游 trim 或轻量规范化），而是判「**草稿 → 预设 → 载荷**这条链逐字一致且非空」，把 13-A 的 `mdA` 长度放进 detail 供人眼比对 —— 避免把 LLM 输出的无关差异算成红。

#### 6.6.2 13-C（`:315-337`，3 条断言一条不减）

**改动后**

```js
  // ── 13-C 跳过 ───────────────────────────────────────────
  await enterOutlineStep();
  await ev(`__t.btn('跳过提纲，下一步')`);
  await waitFor(`Boolean(document.querySelector('#new-step-route'))`);
  await ev(`(() => { document.querySelector('#route-chooser-upload').click(); return true; })()`);
  await waitFor(`location.pathname === '/upload'`);
  await sleep(800);
  await ev(HELPERS);
  const afterSkip = await ev(`(() => ({
    url: location.pathname + location.search,
    step: ${UPLOAD_STEP},
    flow: Boolean(document.querySelector('[data-upload-flow="from-route"]')),
    canSubmit: Boolean(document.querySelector('form')),
    draft: ${DRAFT_SNAP},
  }))()`);
  // RouteChooser 的上传入口恒定带 outline=1（route-chooser.tsx:136-138），
  // 与旧独立页「跳过 → 裸 /upload」的口径不同 —— flag 用于阻止上传页清掉草稿。
  check("13-C 跳过 → 仍经分流步落到 /upload?outline=1", afterSkip.url === "/upload?outline=1", afterSkip.url);
  // REQ-24 §6.3：旧判据读步骤条成分。新版分支无步骤条，改判「新锚点 + 向导表单在位」。
  check("13-C 跳过 → 落新版分支且向导表单正常",
    afterSkip.flow === true && afterSkip.canSubmit === true,
    `flow=${afterSkip.flow} canSubmit=${afterSkip.canSubmit}（旧判据 step="${afterSkip.step ?? "null"}"：仅记录）`);
  // 原「点回步骤一 → 读 #outlineDraftMarkdown 为空」：新版无步骤一可回，判据换源为草稿里没有提纲。
  // 注意跳过路径下草稿**不是空的**（persistBasicInfo 已写 profile），空的只是提纲字段。
  check("13-C 跳过 → 草稿里没有提纲（不串味）",
    typeof afterSkip.draft === "object" && afterSkip.draft !== null &&
      (afterSkip.draft.md ?? "").length === 0 && afterSkip.draft.pn === "REQ13 探针项目",
    `草稿提纲=${JSON.stringify(afterSkip.draft?.md)} 草稿项目名=${JSON.stringify(afterSkip.draft?.pn)}`);
```

**判据说明**：最后一条同时钉住「提纲为空」与「profile 在位」两面 —— 只看 `md === ""` 会与「草稿整个丢了」混淆（那同样是空提纲，但是另一种 bug）。

> **口径修正（并入 §6.0 清账表）**：13-C 受影响的是 **2 条**（`:331-333` 步骤条成分、`:337` 折字段），不是 1 条；13-B 受影响的是 **3 条**（`:293`、`:301`、`:302`）。`cdp-req13-outline.mjs` 总计受影响 **5 条**，均在 §6.6.1-6.6.2 内改判据，总数仍 24。

### 6.7 E1 / E2 迁移（P-1 · **PRD §6.3 补遗一**）

**受影响清单（PRD §6.3 未列，实测必红）**：`E1` 的 `:235`（`aria-current` 读步骤三）、`:236-238`（点回步骤一 + 等 `#projectName`）、`:240`/`:241`/`:242`（读步骤一三字段）与 `E2` 的 `:280`/`:285`。迁移后**条数不变**（E1 仍 4 条、E2 仍 3 条），`.includes("音频与提交")`「点步骤条回步骤一」等步骤条相关动作**全部删除**。

**E1 改动后（`:224-242` 整段替换）**

```js
  await ev(`window.__p3.click('#route-chooser-upload')`);
  await waitFor(`location.pathname === '/upload'`, 60, 250);
  // 路径到了 /upload 不等于 React 已渲染：useSearchParams 让整棵上传表单在最近的 Suspense
  // 边界内退化成客户端渲染（interview-upload-form.tsx:214-217 的注释）。
  // REQ-24 §6.3 补遗一：新版分支不渲染步骤条，等待判据与取样口径一并换源。
  await waitFor(`Boolean(document.querySelector('[data-upload-flow="from-route"]'))`, 40, 150);
  await inject();
  const e1Land = await ev(`(() => {
    const s = window.__p3.profile();
    return {
      flow: Boolean(document.querySelector('[data-upload-flow="from-route"]')),
      ariaSteps: document.querySelectorAll('button[aria-current="step"]').length,
      pn: s && s.profile ? s.profile.projectName : null,
      in2: s && s.profile ? s.profile.intervieweeName : null,
      notes: s && s.profile ? s.profile.notes : null,
    };
  })()`);
  check("E1 跳过提纲→上传：落新版分支（步骤一、二不在 DOM，无步骤条）",
    e1Land.flow === true && e1Land.ariaSteps === 0,
    `flow=${e1Land.flow} aria-current 命中=${e1Land.ariaSteps}`);
  check("E1 跳过提纲→上传：草稿 projectName 来自基本信息步", e1Land.pn === "A-基本步项目名", `实际="${e1Land.pn}"`);
  check("E1 跳过提纲→上传：草稿 intervieweeName 来自基本信息步", e1Land.in2 === "A-基本步受访者", `实际="${e1Land.in2}"`);
  check("E1 跳过提纲→上传：草稿 notes 来自基本信息步（#overview 映射）", e1Land.notes === "A-基本步描述", `实际="${e1Land.notes}"`);
```

**E2 改动后（`:277-285` 整段替换；`:245-276` 与 `:270` 的断言**不动**）**

```js
    // 同 E1：等新版分支锚点；判据换源为草稿（REQ-24 / PRD §6.3 补遗一）。
    await waitFor(`Boolean(document.querySelector('[data-upload-flow="from-route"]'))`, 40, 150);
    await inject();
    const e2Land = await ev(`(() => {
      const s = window.__p3.profile();
      return {
        flow: Boolean(document.querySelector('[data-upload-flow="from-route"]')),
        ariaSteps: document.querySelectorAll('button[aria-current="step"]').length,
        pn: s && s.profile ? s.profile.projectName : null,
        in2: s && s.profile ? s.profile.intervieweeName : null,
        notes: s && s.profile ? s.profile.notes : null,
      };
    })()`);
    check("E2 确认提纲→上传：落新版分支（步骤条不渲染）",
      e2Land.flow === true && e2Land.ariaSteps === 0,
      `flow=${e2Land.flow} aria-current 命中=${e2Land.ariaSteps}`);
    check("E2 确认提纲→上传：草稿仍是基本信息步的 A 值（进上传页后未被二次覆盖）",
      e2Land.pn === "A-基本步项目名" && e2Land.in2 === "A-基本步受访者" && e2Land.notes === "A-基本步描述",
      `实际 pn="${e2Land.pn}" in2="${e2Land.in2}" notes="${e2Land.notes}"（基本步是 A-基本步项目名／A-基本步受访者／A-基本步描述；提纲步填的是 B-提纲步主题／B-提纲步受访者）`);
```

**为什么不删而改**：（1）PRD §6.0 的「终态 39 全绿」要求条数守恒；（2）这三条是「草稿 → 上传页」这条链在**跳过**路径下的唯一机器证据，删掉等于把 13-C 的机器证据孤悬在另一个脚本里；（3）改动面与 §6.3 对 13-B/13-C 完全同构（判据换源 + 取样换源），不引入新口径。

**证据链登记（诚实记录弱化点）**：迁移后 E1/E2 证的是**草稿里有什么**，不再是**页面字段里显示什么**（新版根本没有字段）。「草稿 → 表单 state → 提交载荷」这条后半链由 J1（表单不渲染，故无需预填）+ §6.6.1 的载荷断言（提纲字段）合成覆盖；`projectName` 在跳过路径下的载荷证据由 I1 的 `probe-i` 桩顺带记录（`body` 含全部 FormData 字段），但**本条不把 `projectName` 加进 I1 判定**（D-3：I1 判定不动）。

### 6.8 `cdp-req13-crosscut.mjs` 迁移（P-3 · **PRD §6.3 补遗二**）

> **裁决（P-3 = A，2026-10-06 确认）**：与 P-1 同法 —— **只在本 IMPL 记「PRD §6.3 补遗二」，PRD §6.3 正文保持原文（不改、不回写、不另开需求）**。本节迁移是**实施前必修**（§8.1 第 7 步，出口 = 13/13 且不再抛 `TypeError`），断言条数守恒，**13 条一条不增不减**。

#### 6.8.1 顶部常量（插在 `:23` `const SENTINEL` 之后）

```js
// REQ-24 §6.8：草稿判据改读 sessionStorage（键名与 src/lib/outline-session.ts 一致）。
const SESSION_KEY = "memory-engine-outline-session";
```

#### 6.8.2 删除 `backToStep1()`（`:206-213`）与调用（`:273`）

`:206-208` 的注释（「提纲折叠区与 `#outlineDraftMarkdown` 只在步骤一渲染」）与 `:209-213` 的函数体一并删除；`:273` 的 `await backToStep1();` 一并删除。**不保留**「兼容式空调用」—— 新版没有步骤一可回，留着只会误导。

#### 6.8.3 第 1 节（`:270-277`）判据换源

```js
  const stored = await ev(`(() => ({ keys: __t.keys(), url: location.pathname + location.search }))()`);
  // 草稿键在基本信息步就已建（persistBasicInfo），所以「键存在」不再能证明提纲被写入。
  // REQ-24：新版分支不渲染步骤一（#outlineDraftMarkdown 不存在），判据换源为 sessionStorage 草稿。
  const draft = await ev(`(() => {
    const raw = sessionStorage.getItem(${JSON.stringify(SESSION_KEY)});
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return 'PARSE_ERROR'; }
  })()`);
  const draftMd = typeof draft === "object" && draft !== null ? (draft.outlineMarkdown ?? "") : "";
  check("确认后 sessionStorage 草稿带上了哨兵文本",
    stored.keys.length > 0 && draftMd.includes(SENTINEL),
    `keys=${JSON.stringify(stored.keys)} url=${stored.url} 草稿提纲=${draftMd.length} 字（含哨兵=${draftMd.includes(SENTINEL)}）`);
```

#### 6.8.4 第 2 节（`:280-290`）载荷来源换源（**这是原 `TypeError` 的根因**）

```js
  const projectId = await ev(`(async () => {
    const wav = new Uint8Array(44);
    const fd = new FormData();
    fd.set('audio', new File([wav], 'probe.wav', { type: 'audio/wav' }));
    fd.set('projectName', 'REQ13 横切探针项目');
    fd.set('intervieweeName', '陈秀兰');
    // REQ-24：原来读 document.querySelector('#outlineDraftMarkdown').value —— 新版分支没有这个节点，
    // 会在页面内抛 TypeError 把整个脚本带崩。改从同一份草稿取（与上传页 submitProject 同源）。
    fd.set('outlineDraftMarkdown', ${JSON.stringify(draftMd)});
    const res = await fetch('/api/projects', { method: 'POST', body: fd });
    const payload = await res.json();
    return res.ok ? (payload.id ?? payload.project?.id ?? null) : ('ERR ' + res.status + ' ' + JSON.stringify(payload));
  })()`);
  check("带草稿创建项目成功", typeof projectId === "string" && !projectId.startsWith("ERR"),
    String(projectId));
```

> `JSON.stringify(draftMd)` 由 Node 侧求值后**字面量内联**进页面表达式（与脚本既有的 `JSON.stringify(SENTINEL)` 同法），不新增页内依赖。

**不受影响的部分（逐节点名，实施后比照）**：`:294-312`（项目页概览 2 条 + 探针项目清理 1 条）、`:314-335`（375px 首页不横向溢出 + 唯一新建入口）、`:337-349`（已认证直连旧提纲路由 → 307 落地）、`:351-369`（登出清空 sessionStorage 草稿）、`:371-377`（未登录 → /login）—— 全都不读步骤一字段、不受新版分支影响，**一个字不改**。其中 `:353-355` 会经 enterOutlineStep/makeDraft/confirmOutlineAndGoUpload 再进一次 /upload（新版分支），但它不读任何 DOM 字段，与 §6.8.3 / §6.8.4 同因、已被覆盖。**13 条断言总数不变**。另注：13-D（LLM 失败兜底）与 13-E（首页入口）在 `cdp-req13-outline.mjs`（`:339-383`），**不在本脚本**。

> **顺带订正（同一 stale 源）**：`:181-182` 的注释把 RouteChooser 的 flag 归属写成 `route-chooser.tsx` 的 `:119-123`，实为 `:136-138` —— 既有 stale 注释，建议本次一并订正。

### 6.9 静态检查与交付面复核（落盘后逐条跑）

| # | 命令（PowerShell，工作目录 = 仓库根） | 期望 |
| --- | --- | --- |
| 1 | `npx tsc --noEmit` | 0 error（`package.json` 无 typecheck script，直接调 `tsc`） |
| 2 | `npx eslint src/components/upload/interview-upload-form.tsx src/components/interview/interview-console.tsx` | 0 error / 0 warning（注意 `react-hooks/exhaustive-deps`：`flowMode` 只做渲染判据，不进任何依赖数组） |
| 3 | `npm run build` | 通过（`next build --webpack`） |
| 4 | `Select-String -Path src\** -Pattern hideBackButton` → `Get-ChildItem -Recurse` | **0** |
| 5 | `返回提纲` 全库（`src/`） | **0**（§5.2：「返回提纲」三处随 §3.6 归零） |
| 6 | `返回上一步`（`src/`） | **2**（`interview-upload-form.tsx` 底栏 1 + `interview-console.tsx` 顶栏 1） |
| 7 | `data-upload-flow` / `data-upload-back` / `data-interview-back`（`src/`） | 各 **1** 处，且都在「改动后」的节点上 |
| 8 | `data-upload-flow={flowMode ? "from-route" : undefined}` 的字面形态 | 不得出现 `: ""`（§3.3 红线） |
| 9 | `(?<![A-Za-z_.])check\(` 计数：`verify-phase3.mjs` / `cdp-req13-outline.mjs` / `cdp-req13-crosscut.mjs` | **39 / 24 / 13**（36＋3；后两者守恒） |
| 10 | `flowMode` 出现次数（`interview-upload-form.tsx`） | **6**（定义 1 + `step` 初始化 1 + 根 section 1 + 步骤条条件 1 + 底栏条件 1 + 注释里 1；实施后按实际复核，**若 `hasOutlineFlag` 在组件体内不再被别处使用，不得顺手删它** —— 它仍是 `flowMode` 的组成项） |
| 11 | `redirect('/projects/{id}/outline')` | 仍在 `interview/page.tsx:26-28`（已知遗留，**不得**顺手改成 `?step=route`） |
| 12 | `git status --porcelain` | 仅 `?? docs/IMPL_REQ-24_….md` 与 `?? docs/PRD_REQ-24_….md`；`src/` 下只有上述 2 个**已跟踪**文件为 ` M`；`tmp/`、`docs/需求登记表.md` 零变化 |
| 13 | `git --no-pager diff --stat` | 生产 diff 只落在 2 文件，行数控制在「增 ≤ 60 行、删 ≤ 20 行」量级（§3 给的代码就是全部） |

> 第 7 条的实施口径：`data-upload-flow` 的**属性名**只出现 1 次（JSX 上）+ 探针里的选择器不计入 `src/`。

> **口径修正（覆盖 §6.0 表格中 `cdp-req13-outline.mjs` 那一格）**：受影响断言为 **5 条** —— 13-B `:293`（`step` 含「采集路径」）、`:301`（折叠区 `open`）、`:302`（`#outlineDraftMarkdown` 字数），13-C `:331-333`（`step` 含「采集路径」）、`:337`（`#outlineDraftMarkdown` 字数），不是「2＋1」。总数仍 24。

## 7. 边界（执行纪律，PRD §5 硬约束之外）

1. **交付面**：生产只改 §2.1 / §2.2 列的 2 个文件；除本文档外**不新增任何文件**（不新建 lib / hook / 组件）；不新增依赖；`globals.css` 的 `!important` 数量必须保持 **0**（当前实测 0）。
2. **路由与数据层零改动**：`src/proxy.ts` 三个常量、`src/lib/outline-session.ts`、`src/store/project-workspace.ts`、`src/app/api/**` 全不动；**不新增第二个 `sessionStorage` key**。
3. **不顺手修的东西**：`interview/page.tsx:26-28` 的 `redirect('/projects/{id}/outline')`（已知遗留 404）；`route-chooser.tsx`；`upload-workspace.tsx` 顶栏「返回工作台」；`new-project-flow.tsx` 的 header 返回（它已是「返回上一步」文案，**不要**改）。
4. **不得为省事删的东西**：`goBack()`（`:375-381`，旧版用）、`wizardSteps`（`:77-81`）、`goToStep()`、`UPLOAD_STEP`（探针 D-5）、`hasOutlineFlag`（`flowMode` 的组成项）。
5. **移除项的实现红线**：步骤条/步骤一/二/折叠区一律靠「**不渲染**」；禁止 `hidden` / `sr-only` / `disabled` / 空 `className` 变体（PRD §4.2 明文）。
6. **探针不入 commit**（`.gitignore:54`）；`tmp/` 下的 `*.bak`（`upload-form.bak.tsx`、`route-chooser.bak.tsx`、`npf-r2.bak`）与 `*.log` 一律不动。
7. **需求登记表**：**2026-10-06 已按指令补登 REQ-24**（登记表 v2.1，§1.2 / §三 / §5.1 / §5.2 四处；状态「实施中」）；仍**不通知 DS CLI**；PRD 正文**不改**（P-1/P-3 以「补遗」形式记在本 IMPL 内，见 §0.4 / §6.7 / §6.8）。
8. **提交口径（建议）**：单次提交，标题 `feat(REQ-24): 分流支路页面统一（上传页新版分支 + 返回落点统一）`，正文列 3 点 —— ① 上传页新增 `flowMode` 分支（无步骤条 / 无步骤一二手填 / 底栏返回分流步）；② 访谈页返回落点改 `/projects/new?step=route`；③ P3 `hideBackButton` 口径被取代（三处同记）。**探针改动不体现在 diff 里**，故提交正文里注明「`tmp/` 三脚本已同步迁移，本地 39+24+13 全绿」。

## 8. 实施顺序、风险与回滚

### 8.1 顺序（8 步）

| 步 | 动作 | 出口判据 |
| --- | --- | --- |
| 1 | 改 `interview-upload-form.tsx` §3.1 → §3.2 → §3.3 → §3.4 → §3.5.1 → §3.5.2（**按此顺序**：先判据、后结构、最后控件；`Link` import 与常量同时补） | 文件内 6 处全落，`hideBackButton` 归零 |
| 2 | 改 `interview-console.tsx` §3.6 | `返回提纲` 在 `src/` 归零 |
| 3 | §6.9 的第 1–3 条静态检查 + 起 `npm run dev` | 0 error / build 过 / dev 在 3000 |
| 4 | 改 `tmp/verify-phase3.mjs`：§6.2 → §6.3 → §6.4 → §6.5 → §6.7 | `check(` 计数 = **39** |
| 5 | 跑 `node tmp/verify-phase3.mjs` | **39/39 通过** |
| 6 | 改 `tmp/cdp-req13-outline.mjs`（§6.6）→ 跑 | **24/24 通过** |
| 7 | 改 `tmp/cdp-req13-crosscut.mjs`（§6.8）→ 跑 | **13/13 通过**（关键：不再抛 `TypeError`） |
| 8 | 手验 + 收口：375×667 / 390×844 两视口走「新建流程 → 分流步 → 上传 → 返回 → 再进」，再跑 §6.9 全表 + `git status` | §6.9 全绿；`tmp/` 与需求登记表零 diff |

### 8.2 风险与对策

| # | 风险 | 触发信号 | 对策 |
| --- | --- | --- | --- |
| R1 | `flowMode` 写反（漏 `hasOutlineFlag`）⇒ 裸 `/upload` 也进新版 | 旧版无步骤条、`#projectName` 消失 | §6.9-8 的形态检查 + H5（`flowAnchor === false`）与 `cdp-req14-consent`（裸 `/upload` 28 条）双兜底 |
| R2 | `data-upload-flow` 写成 `: ""` | 旧版 DOM 多出空属性 | H5 的 `flowAnchor` 判据（用 `[data-upload-flow]` 无值匹配，能抓到空属性） |
| R3 | `draftReady` 未提为常量、两处判据不同源 ⇒ 裸 `?outline=1`（无草稿）落新版 ⇒ **死路**（必填字段无 UI） | 手验：`/upload?outline=1` 清过 sessionStorage 后应落步骤一 | §3.1 的不变量 3 + M3 手验项（**必做**，探针未覆盖此路径） |
| R4 | 13-B 的 fetch 桩未复位污染后续段 | 13-C/13-D 异常 | 桩只截 `POST /api/projects`（其余透传），且 13-B 段末提交后会整页导航到 `/projects/probe-noop?autostart=1` ⇒ 桩自然消失；13-C 段首 `enterOutlineStep()` 又走全量 `goto` |
| R5 | J3 每次跑残留一条探针项目 | 项目列表出现「A-基本步项目名」 | 清理按响应体 id（§6.5 J3）；残留可用 `tmp/cleanup-probe-projects.mjs` 兜底 |
| R6 | dev server 未起 / 端口占用 | 探针全红、`WARN 就绪等待超时` | F2 前置：先 `npm run dev` 并在 3000 就绪后再跑 |
| R7 | LLM 慢导致 13-A/H4 超时红（与本条无关） | 13-A「生成出提纲」超时 | 既有已知抖动，**不得**为它改判据；重跑即可 |

### 8.3 回滚

- 生产：`git checkout -- src/components/upload/interview-upload-form.tsx src/components/interview/interview-console.tsx` ⇒ 回到 REQ-21/P3 口径（`hideBackButton` 与「返回提纲」一并回来）。
- 探针：在 `tmp/` 内，未跟踪亦未提交；如需回到旧版本，从本次会话前的备份（`tmp/upload-form.bak.tsx` 之类**不含**探针）无法恢复 —— 因此 **实施前先手动复制一份 `verify-phase3.mjs` / `cdp-req13-outline.mjs` / `cdp-req13-crosscut.mjs` 到 `*.bak`**（`tmp/` 已被忽略，bak 也不会入 commit）。
- 文档：删除 `docs/IMPL_REQ-24_分流支路页面统一.md` 即回到「只有 PRD」的状态。

## 9. 验收矩阵（自动化 → 断言落点）

| 验收项（按 PRD §6.4 顺序，编号以 PRD 原文为准） | 自动化手段 | 断言落点 |
| --- | --- | --- |
| 分流支路落新版分支（无步骤条、不渲染步骤一/二、提交控件在位） | J1 | `verify-phase3.mjs` J1（③④⑤⑥⑦） |
| 新版底栏「返回上一步」→ 分流步（往返无损） | J2 | J2（①②③④） |
| 旧版零变化（裸 `/upload` 三步向导） | H5 + `cdp-req14-consent`（裸 `/upload` 28 条）+ **手验 `?outline=1` 无草稿** | H5 单条全判据 |
| 提交载荷不变（字段名 / 取值路径 / 提纲带入） | 13-B 载荷断言 + I1 | 13-B 第 4 条；I1 `:840` |
| 访谈页「返回上一步」→ 分流步 | J3 | J3 单条全判据 |
| 草稿不被清 / 不串味 | 13-B 第 3 条 + 13-C 第 3 条 + 原「不串味」段（`:304-313`，未改动） | 三处 |
| 静态质量（0 error / lint / build） | §6.9 第 1–3 条 | — |
| P3 口径三处同记 | §5.3 清单 | 文件头 / §3.2 注释 / §5 |

### 9.1 变异测试（灵敏度自检；跑完正样本后逐条做，做完必须还原）

| # | 变异 | 预期红（且**只**该红这些） | 抓它的判据 |
| --- | --- | --- | --- |
| **①** | **新版分支条件恒假**（P-2 操作化：步骤条条件与底栏条件两处置假，`step` 初始化**不动**） | J1、J2 | J1 的 `stepBarButtons === 0` → 变 3、`#projectName` 由 false 变 true；J2 的 `[data-upload-back]` 缺失 |
| ①′ | PRD §6.2 字面版（连 `step` 初始化一起恒假） | J1、J2 **＋ I1/I2/I3** | **不作验收项**：这正是 §0.4 P-2 记录偏离的原因（落点退回步骤二 ⇒ 文件输入与提交按钮都不存在） |
| ② | `data-upload-flow` 恒不输出 | J1、J2、E1、E2、13-B、13-C | 各处 `flow === true` |
| ③ | 底栏改用 `Button + router.push` | J2 | `tag === "A"` 与 `href` 属性 |
| ④ | 访谈页只改文案、不改 `href` | J3 | `href === "/projects/new?step=route"` |
| ⑤ | 步骤条用 `hidden` 隐藏而非不渲染 | J1 | `ol button` 命中数 = 3（不是 0） |
| ⑥ | 旧版「上一步」被顺带改文案 / 删除 | H5 | `h5S2.back === "上一步"` |
| ⑦ | 旧版被顺带加上新锚点 / 条件化 | H5 | `h5S1.flowAnchor === false` |

> 变异②–⑦为 IMPL 追加（PRD §6.2 只给到 ① 一例）；它们与 ① 一起构成「断言确实在测行为」的最小证据集。

## 10. 待办与交接

### 10.1 明确不做（登记备查）

1. **PRD 回写**：P-1（E1/E2 迁移）与 P-3（crosscut 迁移）只记在本 IMPL（§6.7 / §6.8 / §0.4），PRD §6.3 正文**未改** ⇒ 后续只读 PRD 的人会漏这两条。**风险已知、接受**（与 §6.3 对 13-B/13-C 的处置同法，不开先例）。**裁决确认（2026-10-06）：PRD 不回写** —— PRD 是产品规格文档，P-1 / P-3 属实施探查发现的技术细节，归 IMPL 补遗（§6.7「补遗一」/ §6.8「补遗二」）即可；§6.3 那句「不受影响」的错判保持原文，由 §6.8 覆盖并说明原因。
2. **`cdp-req13-prefill.mjs`（已退役）**：自 UI-12 起不可运行（§6.0），本轮**只登记不修、不另开需求**（维持 §6.0 的「已退役」登记，P-4）。
3. **`verify-phase1.mjs` / `verify-phase2.mjs`**：已退役，本轮不跑不改。
4. **`interview/page.tsx:26-28`** 的 `redirect('/projects/{id}/outline')` → 404：已知遗留，不在本条范围（PRD §4.4 明文）。
5. **需求登记表**：**已登记 REQ-24**（2026-10-06，登记表 v2.1；状态「实施中」）；**DS CLI 仍不通知**。

### 10.2 交接清单（落盘时点）

| 类 | 路径 | 状态 |
| --- | --- | --- |
| 生产 | `src/components/upload/interview-upload-form.tsx` | 6 处改动（§3.1–§3.5） |
| 生产 | `src/components/interview/interview-console.tsx` | 1 处改动（§3.6） |
| 探针 | `tmp/verify-phase3.mjs` | 36 → 39；H5 改对象、I 段取样换源、E1/E2 迁移、J1–J3 新增 |
| 探针 | `tmp/cdp-req13-outline.mjs` | 判据换源 5 条（§6.6），总数 24 |
| 探针 | `tmp/cdp-req13-crosscut.mjs` | 判据换源 1 条 + 载荷换源 1 处 + 删 `backToStep1()`（§6.8），总数 13 |
| 文档 | `docs/IMPL_REQ-24_分流支路页面统一.md` | 本文 |
| 文档 | `docs/PRD_REQ-24_分流支路页面统一.md` | **零改动**（未跟踪状态） |

### 10.3 验收命令速查

```powershell
# 前置：dev server
npm run dev            # 3000 端口就绪

# 生产静态
npx tsc --noEmit
npx eslint src/components/upload/interview-upload-form.tsx src/components/interview/interview-console.tsx
npm run build

# 三支探针（依次，互不并行 —— 都用 Chrome 调试端口）
node tmp/verify-phase3.mjs        # 期望 39/39
node tmp/cdp-req13-outline.mjs    # 期望 24/24
node tmp/cdp-req13-crosscut.mjs   # 期望 13/13（不得出现「测试脚本异常」）

# 交付面
git status --porcelain            # 仅两个 docs 未跟踪 + 两个 src 为 M
```

### 10.4 已知抖动（与本条无关，不得用来改判据）

- `13-A`（LLM 生成提纲）与 `H4`（embedded 自动生成）依赖真实/打桩链路，超时属既有抖动；`13-A` 的 `waitMd` 已有 120s 上限、`H4` 有 25s 上限。
- `E1/E2` 侧此前出现过的 hydration 竞态（`verify-phase3.mjs:226-229` 的注释记录了「5 次运行里 E2 翻红 2 次」）—— 迁移后仍以 `waitFor(新锚点)` 取代固定 `sleep`，写法与既有先例一致。

---

**与 PRD 的关系**：本 IMPL 与 PRD 正文冲突时以 PRD 为准；**三处例外**已在 §0.4 / §6.0 逐条登记（P-1、P-3 为 §6.3 的补遗；P-2 是 §6.2 变异 ① 的操作化），本文档是它们的第一落点。

