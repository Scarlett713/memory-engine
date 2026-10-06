# 任老师反馈批次 1 · UI 改动任务单（交付 DS）

> **来源**：任老师本轮反馈的 8 处 UI 改动（文案 / 必填 / 一处 prop 透传）。
> **状态**：待实施。生产代码与 `tmp/` 探针**均未改动**；本文件是批次 1 的唯一交付物。落盘日期 2026-10-06。
> **交付面**：生产代码 **9 个文件 / 8 处改动**；探针 **1 个文件 / 1 条断言**（`tmp/cdp-req13-outline.mjs`；`tmp/` 被 `.gitignore` 屏蔽，不入 commit）。
> **基线**：`git rev-parse --short HEAD` = `57c6ff1`（工作区干净）。本文所有行号都是**该基线下的实测行号**。
> **行号纪律**：改动会推挤同文件里的后续行号 —— 请**按文件分组、同文件内从大行号往小行号改**，或按「内容匹配」定位，不要照行号从小到大跳着改。一旦发现文件内容与本文写的不一致，**以内容为准并停下来回报**，不要猜着改。
> **不做**：不动数据层、不动路由、不动 `src/lib/**`、不动上传页与分流步的同名字段（详见 §四）。

## 一、背景

任老师本轮反馈了 8 处 UI 问题（首页/新建流程的标题文案、三处多余说明文字、两处字段文案，以及「描述信息」升级为**必填**的「详细介绍」）。本批次性质是**文案 + 表单校验 + 一处 prop 透传**，不涉及数据结构、接口契约与 prompt 模板的改动。

主线路径：首页 → `/projects/new` 三步流程（基本信息 → 提纲 → 分流）→ 提纲工作台 `OutlinePlanWorkspace`。8 处改动全部落在这一条链路上。

---

## 二、改动清单（共 8 处）

### 2.0 总览与建议执行顺序

| # | 主题 | 文件 · 基线行号 | 类型 | 探针 |
| --- | --- | --- | --- | --- |
| ① | 全站标题改「AI赋能口述式抢救与文化传承」 | `src/app/layout.tsx:8`、`src/app/login/page.tsx:54` | 文案 | 否 |
| ② | 首页入口 / 流程页标题统一为「新建项目」 | `src/components/home/home-dashboard.tsx:97`、`:113`、`src/components/new-project/new-project-flow.tsx:118-121`、`src/components/home/recent-project-list.tsx:115` | 文案 + 删一行 | **是**（`cdp-req13-outline.mjs:196-197`） |
| ③ | 删除流程页顶部说明段 | `new-project-flow.tsx:122-125` | 删文字 | 否 |
| ④ | 删「先说说这次访谈」，「基本信息」升为区块标题 | `src/components/new-project/basic-info-form.tsx:49-53` | 删文字 + 改标题层级 | 否 |
| ⑤ | 删除标题下方说明段 | `basic-info-form.tsx:54-56` | 删文字 | 否 |
| ⑥ | 「受访者姓名」→「受访对象」（**只改流程第一步**） | `basic-info-form.tsx:79`（连带同文件 `:33` 错误文案） | 文案 | 否 |
| ⑦ | 第一步 placeholder「例如：王阿婆」→「例如：受访者姓名」 | `basic-info-form.tsx:90` | 文案 | 否 |
| ⑧ | 「描述信息」→「详细介绍」**必填** + placeholder 换新 + 透传进提纲 prompt | `basic-info-form.tsx:9-12,31-35,94-99,101-114`、`new-project-flow.tsx:182-193`、`src/components/outline/outline-plan-workspace.tsx:95-107,114`、`src/app/api/projects/route.ts:83`、`src/app/api/projects/ai-interview/route.ts:153` | 校验 + prop + 后端上限 | 间接（`cdp-ui24-fixes.mjs` 必须保持全绿） |

**建议执行顺序**（先立 prop，再改调用方，最后改文案与后端）：

1. `outline-plan-workspace.tsx` —— 新增 `initialOverview` prop（⑧，独立文件，无连带）。
2. `new-project-flow.tsx` —— 同文件内**先** `:182-193`（⑧ 透传）**再** `:118-125`（② 标题 + ③ 删段）。
3. `basic-info-form.tsx` —— 同文件内**从大行号往小行号**改：`:101-114`（⑧）→ `:94-99`（⑧ 删说明）→ `:90`（⑦）→ `:79`（⑥）→ `:49-56`（④⑤）→ `:32-35`（⑧ 校验）→ `:8-12`（⑧ 注释）。
4. `home-dashboard.tsx:97,:113`（②）+ `recent-project-list.tsx:115`（②）。
5. `layout.tsx:8` + `login/page.tsx:54`（①）。
6. `api/projects/route.ts:83` + `api/projects/ai-interview/route.ts:153`（⑧ 后端长度上限）。
7. `tmp/cdp-req13-outline.mjs:196-197`（② 探针同步）。

> 编码提示：`login/page.tsx` 等文件是 **UTF-8**，用 PowerShell `Get-Content` 默认编码读会显示乱码（不影响文件本身）。请在编辑器里直接改，不要用命令行读写中文字符串。

### 2.1 ① 全站标题改为「记忆引擎｜AI赋能口述式抢救与文化传承」

**改什么**：原后缀「口述历史采集与整理工作台」→「AI赋能口述式抢救与文化传承」。全仓（排除 `node_modules/`、`.next-dev/`）实测**只有 2 处**，都要改；`metadata` 只有 `layout.tsx:7` 一处定义，无页面级 `title` 覆盖。

**改哪里**：

- `src/app/layout.tsx:8`
  ```ts
  title: `${appName} | AI赋能口述式抢救与文化传承`,
  ```
  （`appName` 仍取自 `NEXT_PUBLIC_APP_NAME ?? "记忆引擎"`，`:5` 不动，所以 `<title>` 实际渲染为 `记忆引擎 | AI赋能口述式抢救与文化传承`。）
- `src/app/login/page.tsx:54`（登录页副标题，同一串文案）
  ```tsx
  <p className="text-sm text-stone-500">AI赋能口述式抢救与文化传承</p>
  ```

**注意事项**：

- 只改这两处 UI 文案。`docs/**`、`tmp/**` 里的同类表述属文档/工具，**本批不改**。
- 分隔符沿用现有 `|`（前后各一个半角空格），不要换成全角「｜」，避免与既有快照类断言漂移。
- `src/components/home/home-dashboard.tsx`、`src/components/upload/upload-workspace.tsx` 里的「记忆引擎」是品牌 wordmark，**不是标题**，不动。

### 2.2 ② 首页入口与流程页标题统一为「新建项目」

**背景更正（重要）**：需求描述里说「『新建项目』和『新建访谈项目』两个按钮只留一个」——**实测没有这两个按钮**。REQ-16 之后首页只保留**唯一一个** CTA，文案是「新建访谈」（`home-dashboard.tsx:97`），当时页头两个 CTA 已被收敛（`:90-91` 有注释）。所以本处的执行口径是：**把现存的三处不同说法统一成「新建项目」**。

**改哪里**：

| 位置 | 现状 | 改成 |
| --- | --- | --- |
| `home-dashboard.tsx:97` 首页 CTA（`<Link href="/projects/new">`） | `新建访谈` | `新建项目` |
| `new-project-flow.tsx:120` 流程页 `<h1>` | `新建访谈项目` | `新建项目` |
| `new-project-flow.tsx:118` 流程页 eyebrow `<p className="section-eyebrow mt-3">` | `新建项目` | **整行删除**（与上面 h1 同文案，去重） |
| `home-dashboard.tsx:113` 草稿区空态正文 | `新建访谈后未提交的内容会出现在这里，可随时继续填写。` | `新建项目后未提交的内容会出现在这里，可随时继续填写。` |
| `recent-project-list.tsx:115` 空态正文 | `点上方「新建访谈」开始建档，完成后项目会出现在这里。` | `点上方「新建项目」开始建档，完成后项目会出现在这里。` |

`new-project-flow.tsx:118-121` 删 eyebrow 后应保持：

```tsx
<h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem]">
  新建项目
</h1>
```

（`mt-2` 保留：它同时承担与上方「返回首页/返回上一步」按钮的间距。）

**探针必须同步**（否则该脚本必红）——`tmp/cdp-req13-outline.mjs:196-199`：

```js
check(
  "13-E 首页有唯一新建入口（/projects/new，文案「新建项目」）",
  entries.newProject.length === 1 && entries.newProject[0].text.includes("新建项目"),
  JSON.stringify(entries.newProject),
);
```

即把断言名与 `includes("新建访谈")` 一并换成「新建项目」。**`check(` 条数不变（仍 24 条），判据不变（仍判 `href === '/projects/new'` 的链接唯一且文案匹配）。**

可选同步（不影响判据，只是文案）：`tmp/verify-phase3.mjs:178` 与 `:188` 的 check 名里提到「首页『新建访谈』」——该处点击是按 `[data-home-zone="new"] a` 选择器、判据用 `location.pathname`，所以**改不改都能过**，顺手同步更好。

**注意事项**：

- 首页 CTA 的 `href="/projects/new"`、`data-home-zone="new"`、`className="sidebar-cta …"` 与 `Plus` 图标**一律不动**（探针与样式都挂在它们上）。
- 不要把 h1 改成「新建访谈项目」以外的自由措辞，也不要保留「新建访谈」字样。
- 不要动 `/projects/new` 路由本身、`NEW_PROJECT_STEPS` 步骤条标签（`new-project-flow.tsx` 内），它们不在本批范围。

### 2.3 ③ 删除流程页顶部说明文字

**改什么**：删掉 `src/components/new-project/new-project-flow.tsx:122-125` 整段：

```tsx
<p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
  填好基本信息，生成一版访谈提纲，再选择用 AI
  实时访谈还是上传音频。
</p>
```

**注意事项**：整段删除（含 `<p>` 开闭标签）；它与 `:129` 的步骤条 `<ol className="mt-4 …">` 之间的空行保留一个即可，不要为了让间距好看另加 `mt-*`——`<ol>` 自带 `mt-4`。删完后 h1 与步骤条之间的间距由 `ol` 的 `mt-4` 决定，视觉上标题与步骤条更紧凑，这是预期效果。

### 2.4 ④ 删「先说说这次访谈」，「基本信息」放大为区块标题

**改什么**：`src/components/new-project/basic-info-form.tsx:49-53` 现在是「小号 eyebrow『基本信息』 + 大标题『先说说这次访谈』」两层。改为**单层**：删掉「先说说这次访谈」，把「基本信息」用原来 h2 的字号/字重承载（即字号放大、成为区块标题）。

**改哪里**（`:49-53` 替换为）：

```tsx
<div>
  <h2 className="font-display text-[1.35rem] font-semibold text-accent-strong">
    基本信息
  </h2>
</div>
```

**注意事项**：

- 字号沿用原 h2 的 `text-[1.35rem]` —— 这不是随手取的：它与首页各面板的 h2（`home-dashboard.tsx:106` 等）是同一个字号档，保证改完全站面板标题一致。**不要额外引入新字号档**。
- eyebrow 那个 `<p className="section-eyebrow">基本信息</p>` 一并删除，不要留下空 `<p>`。
- `:48` 的 `<form …>` 与 `:59` 的 `<div className="grid gap-4 xl:grid-cols-2">` 不动；表单外层 `paper-panel` 卡片与 `flex flex-col gap-5` 间距不变。
- 原 `mt-2` 不再需要（上方已无 eyebrow），照上面片段写即可。

### 2.5 ⑤ 删除标题下方说明文字

**改什么**：删掉 `basic-info-form.tsx:54-56` 整段：

```tsx
<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
  访谈主题与受访者姓名是必填的，AI 生成提纲要知道「聊什么」和「关于谁」。描述信息可以留空。
</p>
```

**注意事项**：整段删除。文案里「描述信息可以留空」这句话在本批之后**已不成立**（⑧ 改为必填），所以这处删除同时是口径纠错，不要改写成「三项都必填」之类的替代说明——任老师的要求是本页不再有这段说明。

### 2.6 ⑥ 「受访者姓名」→「受访对象」（只改新建流程第一步）

**改什么**：

- `basic-info-form.tsx:79` label 文本：`受访者姓名` → `受访对象`（保留下面的 `<span className="ml-1 text-red-500">*</span>`，`:80`）。
- `basic-info-form.tsx:33` 校验错误文案里的同一称呼，随 ⑧ 一起改写为「请先填写访谈主题、受访对象与详细介绍。」（最终形态见 §2.8）。

**注意事项**：

- **只改新建流程第一步**。以下同义字段与本批范围无关，**一律不动**：
  - 上传页 `interview-upload-form.tsx:549-550`「受访对象姓名」+ `:558` placeholder「例如：王阿婆」；
  - 分流步 `route-chooser.tsx` 内提示语（如「AI 实时访谈需要访谈主题与受访者姓名」）;
  - 提纲步 `outline-plan-workspace.tsx` 的「访谈对象姓名」label 与 `例如：陈秀兰` placeholder。
- `<label htmlFor="intervieweeName">`、`id="intervieweeName"`、`value`/`onChange` 全不动。

### 2.7 ⑦ 第一步受访对象 placeholder 换文案

**改什么**：`basic-info-form.tsx:90`：

```tsx
placeholder="例如：王阿婆"
```

改为：

```tsx
placeholder="例如：受访者姓名"
```

**注意事项**：

- **只改新建流程第一步**（`:90`）。上传页 `interview-upload-form.tsx:558` 有一模一样的「例如：王阿婆」，那是**另一个页面的字段**，本批不动（与 ⑥ 同一口径）。
- 该 placeholder 出现在 `#intervieweeName` 上，id 不动。

### 2.8 ⑧ 「描述信息」→「详细介绍」（必填）+ placeholder 换新 + 透传进提纲 prompt

这是本批**唯一有逻辑含量**的一处，拆成 4 个子动作：前端字段改造（2.8.1）、前端必填校验（2.8.2）、`initialOverview` 透传（2.8.3）、后端长度上限（2.8.4）。

#### 2.8.1 前端字段改造（`basic-info-form.tsx`）

**a. 字段中文名与必填标记**（`:101-104`）：

```tsx
<div className="xl:col-span-2">
  <label className="field-label" htmlFor="overview">
    详细介绍
    <span className="ml-1 text-red-500">*</span>
  </label>
```

**b. placeholder 换新文案**（`:112`，**单行字符串**，不要写成多行属性以免出现意外空白）：

```tsx
placeholder="您可补充说明需要记录的相关事件、人物信息、时间线索等内容，以便我们向您提供个性化访谈提纲"
```

**c. 三方对齐的 1000 字上限**：在文件顶部 `import` 之后新增本地常量（写法对照 `outline-plan-workspace.tsx:39-40` 的既有先例）：

```ts
// 与服务端 NOTES_MAX_LENGTH 对齐（/api/outline/generate、/api/projects）。
const OVERVIEW_MAX_LENGTH = 1000;
```

并在 `:105-113` 的 `<textarea>` 上加 `maxLength={OVERVIEW_MAX_LENGTH}`（可选再加 `required` —— 与主题/受访对象两个输入框保持一致；因表单上有 `noValidate`，它只作语义标注、不会抢走中文错误条）：

```tsx
<textarea
  id="overview"
  className="text-area min-h-[7rem]"
  value={value.overview}
  required
  maxLength={OVERVIEW_MAX_LENGTH}
  onChange={(event) =>
    onChange({ ...value, overview: event.target.value })
  }
  placeholder="您可补充说明需要记录的相关事件、人物信息、时间线索等内容，以便我们向您提供个性化访谈提纲"
/>
```

**d. 删掉 `:94-99` 的说明块**（含 `:94` 的注释）：这块原本是「与必填项并排占满另一格」的辅助说明，字段改必填后它没有存在意义，留着还会让那半栏空着：

```tsx
{/* 选填，与必填项并排占满另一格；窄屏自然堆叠。 */}
<div className="flex items-end">
  <p className="text-xs leading-5 text-muted">
    描述信息选填，可以在下一步生成提纲时再补充细节。
  </p>
</div>
```

删掉之后，XL 断点下 `受访对象` 只剩半栏宽度。**建议给 `:77` 那个 `<div>`（受访对象所在格）加 `xl:col-span-2`**，让「访谈主题 / 受访对象 / 详细介绍」三个字段纵向通栏：

```tsx
<div className="xl:col-span-2">
  <label className="field-label" htmlFor="intervieweeName">
```

（这一项是排版建议：不加不报错、不影响任何断言，但会留下半栏空白。）

**e. 类型注释同步**（`:8-12`）：`只有 projectName / intervieweeName 是必填；overview 选填。` 这句在本批之后已失效，改为：

```ts
/**
 * 三步流程「基本信息」的载荷（REQ-21 §4.2）。
 * 三项均必填（overview 自任老师反馈批次 1 起改为必填的「详细介绍」）。
 * 本类型定义在表单侧，流程容器与分流步都从这里取，避免三处各写一份。
 */
```

#### 2.8.2 前端必填校验（`basic-info-form.tsx:31-35`）

由两项判断扩到三项，并同步 ⑥ 的称呼改动：

```ts
if (
  !value.projectName.trim() ||
  !value.intervieweeName.trim() ||
  !value.overview.trim()
) {
  setError("请先填写访谈主题、受访对象与详细介绍。");
  return;
}
```

**注意事项**：

- 用 `.trim()` 判空：全空白（`'   '`）等同没填 —— 与 `new-project-flow.tsx:82-85` 的既有口径一致。
- `:29` 的注释「前端校验即可，不发网络请求（PRD §9-2）」保留不动。
- 校验失败时**不得**调用 `onNext()`，否则会绕过第一步直接进提纲步。
- 错误条容器（`:117-121`）不改。

#### 2.8.3 `initialOverview` 透传：为什么这步**不能省**（本批最关键的一处）

**问题**：用户被要求**必填**「详细介绍」，但填完之后这段文字**根本没进 AI 生成提纲的 prompt**。实测链路：

1. 提纲 prompt 的入参只有一个来源 —— **提纲步自己的表单**。`/api/outline/generate` 把请求体里的 `ethicsNotes` 映射为 `profile.notes`（`src/app/api/outline/generate/route.ts:19`、`:70`），`ark-llm-provider.ts` 再把整个 profile 直接 `JSON.stringify` 进 prompt（`"Current profile:" + JSON.stringify(profile)`，约 `:416-417`）。**空值时没有「未提供」兜底**（对比同文件 `refineTranscript` 那一路有 `|| "未提供"`）—— 空着就是**静默丢失**，用户完全看不出来。
2. 而 `ethicsNotes` 的唯一界面来源，是 `outline-plan-workspace.tsx` 的 `overview` state（`:233` 与 `:237` 双写 `researchFocus` + `ethicsNotes`；`:316`、`:378-379` 同理）。
3. **这个 state 的初值恒为 `""`**（`outline-plan-workspace.tsx:114`），且 workspace **从不读 sessionStorage**（它只 import 了 `saveOutlineDraftToSession`）。基本信息步的「详细介绍」只被写进草稿的 `profile.notes`（`new-project-flow.tsx:85-92`），既不进提纲 prompt、也不会回填到提纲步的文本框。

⇒ **只改前端字段与校验，等于让用户填一段「必填但无人消费」的文字。** 必须把基本信息步的值**作为初值传进提纲步**。

**怎么改**（与已有的 `initialTopic` / `initialSubject` 完全同源同法，不引入新机制）：

1. `src/components/outline/outline-plan-workspace.tsx:95-100` 之后新增 prop 声明（接在 `initialSubject` 后）：

```ts
  /**
   * 「访谈内容概述」输入框的初值。默认 "" —— 不传时与本次改动前的行为逐字一致。
   * 三步流程传基本信息步的「详细介绍」；生成 / 改写提纲时该值随
   * researchFocus + ethicsNotes 双写进 prompt（任老师反馈批次 1）。
   */
  initialOverview?: string;
```

2. `:102-107` 的解构参数列表里加 `initialOverview,`（放在 `initialSubject,` 之后）。
3. `:114` 改为：

```ts
  const [overview, setOverview] = useState(initialOverview ?? "");
```

4. `src/components/new-project/new-project-flow.tsx:182-186`，给嵌入的 workspace 补一个 prop（其余 props 一字不动）：

```tsx
<OutlinePlanWorkspace
  embedded
  initialTopic={basicInfo.projectName}
  initialSubject={basicInfo.intervieweeName}
  initialOverview={basicInfo.overview}
  onContinue={() => {
```

**兼容性与风险控制**：

- `initialOverview` 是**可选** prop，默认语义 = 现状：不传时 `useState(initialOverview ?? "")` 与现在的 `useState("")` **逐字等价**。独立提纲路由（冷启动直达 `/projects/new?step=outline`）与 `tmp/cdp-ui24-fixes.mjs`（43 条几何/布局断言）因此**零回归**。
- 不改 `src/lib/**`：`initialTopic` / `initialSubject` 的先例就是这么做的（IMPL §7.1.3 冻结 `src/lib/**`），本处沿用同一做法。
- **prompt 模板不用改**：`ark-llm-provider.ts` 已经把整个 profile 喂进 prompt，值非空即生效；改模板反而会动到 provider（冻结面）。
- 已知边界（沿用 UI-12 记录，本批不处理）：`researchFocus` 在两处 outline 路由走 `FIELD_MAX_LENGTH=200` 截断，`ethicsNotes` 走 `NOTES_MAX_LENGTH=1000`；即 >200 字的部分只在 `notes` 侧完整保留。

#### 2.8.4 后端：只加 1000 字长度上限，**不加必填**

**为什么服务端不加必填**：`/api/projects` 是**共用入口** —— 上传页三步向导也走它。上传页的同一 DB 字段叫「项目说明」（`interview-upload-form.tsx:662-670`，`id="notes"`），label **没有 `*`**、无 `required`、无校验，是**选填**。服务端若把 `notes` 设为必填，会把「上传页 → /api/projects」整条链路 400 掉，并打红既有回归（`tmp/verify-phase3.mjs` 的 F 段 / H 段等）。同理 `/api/projects/ai-interview` 也不加必填（AI 分支已由第一步前端拦截）。

**改哪里**：

1. `src/app/api/projects/route.ts`：文件顶部常量区新增

```ts
// 与 /api/outline/generate 的 NOTES_MAX_LENGTH 同口径。
const NOTES_MAX_LENGTH = 1000;
```

原 `:83` 改为：

```ts
const notes =
  formData.get("notes")?.toString().trim().slice(0, NOTES_MAX_LENGTH) ?? "";
```

（可选链会短路整条链：`formData.get("notes")` 为 `null` 时不会执行 `.trim().slice()`，`?? ""` 仍成立。）

2. `src/app/api/projects/ai-interview/route.ts:153`：该 route 的 `normalizeText` **不截断**（文件内定义，只 `trim`），而它承接的是同一个「详细介绍」源字段，所以同样加上限：

```ts
notes: normalizeText(payload.notes).slice(0, NOTES_MAX_LENGTH),
```

并在该文件常量区加同一条 `const NOTES_MAX_LENGTH = 1000;`。两个 route **各自本地定义**，不要新建共享常量模块 —— 那会动到 `src/lib/**` 冻结面。

**注意事项**：

- 两个 outline 路由（`generate` / `chat`）**不用改**：它们对 `ethicsNotes` 已有 `NOTES_MAX_LENGTH=1000`（`generate/route.ts:9,70`、`chat/route.ts:13,105`），透传后自动生效。
- 不要把 `notes` 的校验提升为「必填」；也不要顺手把 `researchFocus` 改成 200 截断（超出本批范围，且会改变 AI 分支落库口径）。
- 上传页的 `#notes` 与第一步的 `#overview` 是**两个不同页面的字段**，任何情况下都不要把 `id="overview"` 改名。

#### 2.8.5 ⑧ 的验收观察点（人工）

1. 第一步三项都空着点「下一步：生成提纲」→ 停在原页，出现「请先填写访谈主题、受访对象与详细介绍。」；只填主题+受访对象、留言介绍为空 → 同样拦住。
2. 三项填齐 → 进提纲步；**提纲步「访谈内容概述」文本框里应该已经带着刚填的详细介绍**（这是 2.8.3 生效的直接证据；不传 `initialOverview` 时该框必定为空）。
3. 点「生成提纲」→ 网络面板里 `/api/outline/generate` 请求体的 `ethicsNotes` 与 `researchFocus` 都应等于这段详细介绍（>200 字时 `researchFocus` 被服务端截断，属既有边界）。
4. 输入 1500 字 → 文本框只接住 1000 字（`maxLength`）；后端接口不会因此 400（只截断不拒绝）。

---

## 三、验收标准

### 3.1 lint

**全量 `npm run lint` 在当前基线就是红的**（1 error + 5 warnings，全在本次**不触及**的文件里）。实测基线：

| 文件 | 位置 | 级别 | 规则 |
| --- | --- | --- | --- |
| `src/hooks/useAuth.ts` | `33:5` | **error** | `react-hooks/set-state-in-effect` |
| `src/app/api/auth/register/route.ts` | `3:22` | warning | `@typescript-eslint/no-unused-vars` |
| `src/app/api/projects/[projectId]/route.ts` | `210:15` | warning | `@typescript-eslint/no-unused-vars` |
| `src/components/projects/project-processing-console.tsx` | `919:6` | warning | `react-hooks/exhaustive-deps` |
| `src/lib/providers/transcription/xfyun-transcription-provider.ts` | `19:10`、`46:10` | warning ×2 | `@typescript-eslint/no-unused-vars` |

⇒ **验收口径（两条，都要满足）**：

1. **本次触及的 9 个文件单独 lint 必须 0 error 0 warning**（实测现状是干净的，别把它弄脏）：

   ```powershell
   npx eslint src/components/new-project/basic-info-form.tsx src/components/new-project/new-project-flow.tsx src/components/home/home-dashboard.tsx src/components/home/recent-project-list.tsx src/components/outline/outline-plan-workspace.tsx src/app/layout.tsx src/app/login/page.tsx src/app/api/projects/route.ts src/app/api/projects/ai-interview/route.ts
   ```

2. **全量 `npm run lint` 的问题数不得高于基线**（仍为 1 error + 5 warnings，且逐条位置与规则名一致）。**不要去修上面这 6 条历史问题** —— 不在本批范围，混进 diff 会被打回。

### 3.2 回归脚本

前置：`npm run dev` 起在 `http://localhost:3000`（各脚本自己 spawn headless Chrome，零依赖 Node 22）。**建议串行跑**，跑完看每个脚本末尾的 PASS/FAIL 汇总；任一条 FAIL 都要在回报里贴原始 detail。

| 脚本 | 基线 check 数 | 本批为什么要跑 |
| --- | --- | --- |
| `tmp/verify-phase2.mjs` | 37 | 直接吃基本信息步：`:170` 判 `#overview` 存在、`:238` 写 `#overview`、`:261` 判「填过基本信息后 AI 卡解禁」 —— ⑧ 改完不许红 |
| `tmp/verify-phase3.mjs` | 39 | 首页入口 → 基本信息 → 提纲 → 分流/上传 全链路；`:215/:222/:246/:274` 判草稿 `notes` 来自 `#overview`（⑧ 的字段映射不许变） |
| `tmp/cdp-req13-outline.mjs` | 24 | `:196-199` 首页入口文案断言（② 必须同步改这条，改完仍 24 条、全绿） |
| `tmp/cdp-req13-crosscut.mjs` | 13 | 跨切面：基本信息 → 提纲 → 分流链路与草稿写入 |
| `tmp/cdp-req14-consent.mjs` | 28 | 知情同意/上传链路，确认「上传页不受本批影响」 |
| `tmp/cdp-ui24-fixes.mjs` | 43 | 提纲工作台两阶段布局与几何断言；`initialOverview` 不传时必须零回归 |

运行示例：

```powershell
npm run dev            # 另开一个终端，等 3000 就绪
node tmp/verify-phase2.mjs
node tmp/verify-phase3.mjs
node tmp/cdp-req13-outline.mjs
node tmp/cdp-req13-crosscut.mjs
node tmp/cdp-req14-consent.mjs
node tmp/cdp-ui24-fixes.mjs
```

补充：`cdp-req13-*` / `cdp-ui24-*` / `cdp-req14-*` 用固定账号 `scrolltest@example.com` 登录；跑完会留下探针项目，必要时用 `tmp/cleanup-probe-projects.mjs` 清理（可选）。

### 3.3 逐条人工对照（改完对着这 8 条看一遍）

| # | 观察点 | 期望 |
| --- | --- | --- |
| ① | 浏览器 tab 标题 / 登录页副标题 | `记忆引擎 \| AI赋能口述式抢救与文化传承`、登录页副标题同串文案 |
| ② | 首页「新建」区 CTA 文案；`/projects/new` 页头 | 两处都是「新建项目」；流程页标题上方**没有**重复的小字「新建项目」 |
| ③ | `/projects/new` 页头标题与步骤条之间 | 没有任何说明段落 |
| ④ | 第一步卡片顶部 | 只有「基本信息」一行大标题；**没有**「先说说这次访谈」 |
| ⑤ | 「基本信息」标题下方 | 没有任何灰色说明文字 |
| ⑥ | 第一步第二个输入框 label | 「受访对象 *」（传输到上传页的字段名不受影响） |
| ⑦ | 第一步 `受访对象` 输入框内 | 灰字提示 `例如：受访者姓名` |
| ⑧ | 第一步第三个字段 | label「详细介绍 *」；placeholder 为「您可补充说明需要记录的相关事件、人物信息、时间线索等内容，以便我们向您提供个性化访谈提纲」；留空点「下一步：生成提纲」被中文错误条拦住；填齐后进提纲步，**提纲步「访谈内容概述」已带着这段文字**（§2.8.5） |

---

## 四、不要动的边界

| 边界 | 具体 | 理由 |
| --- | --- | --- |
| **元素 id 一律不改** | `#projectName`、`#intervieweeName`、`#overview`、`#new-step-basic`、`#new-step-outline`、`#new-step-route`、`#outline-overview`、`[data-step-next="outline"]`、`[data-home-zone="new"]` | 6 个回归脚本都按这些锚点驱动输入与判定；改名 = 大面积假红 |
| **上传页同名字段不动** | `interview-upload-form.tsx:549-558`（「受访对象姓名」+ `例如：王阿婆`）、`:662-670`（「项目说明」/ `#notes`，选填） | 本批只针对新建流程第一步；上传页字段是另一个页面的语义 |
| **分流步与提纲步的同义文案不动** | `route-chooser.tsx` 内「受访者姓名」提示语；`outline-plan-workspace.tsx` 的「访谈对象姓名」label 与「例如：陈秀兰」placeholder | 同上，超范围 |
| **`src/lib/**` 不动** | 含 `outline-session.ts`、`providers/llm/ark-llm-provider.ts`（prompt 模板）等 | IMPL §7.1.3 冻结面；本批用组件层可选 prop 解决，不需要动机 |
| **接口不加必填** | `/api/projects`、`/api/projects/ai-interview` 的 `notes` 只加上限不设必填 | 这两个 route 是上传页与 AI 分支的共用入口，加必填会 400 掉上传链路（见 §2.8.4） |
| **不顺手改历史 lint** | `useAuth.ts` 等 6 条基线问题 | 混进本批 diff 会被打回 |
| **文档/工具面** | `docs/**` 其他文件、`tmp/**` 其他脚本不改（本次只动 `tmp/cdp-req13-outline.mjs` 那 1 条断言） | 控制 diff 面 |
| **不 commit** | 不要 `git add` / `git commit` / `git push` | 改完等总管放行 |

---

## 五、交付动作

1. 按 §2.0 的执行顺序改完 8 处。
2. 跑 §3.1 的**定向 lint** + §3.2 的**6 个脚本**（串行），记录每条输出。
3. 回报内容（三件套）：
   - **改动清单**：逐处 `文件:行号（改动后）→ 改了什么`；
   - **验收输出**：定向 lint 结果 + 6 个脚本的 PASS/FAIL 汇总（含各自 check 总数）；
   - **视觉描述**：§3.3 表格逐条对照的实际观察结果（哪一条与期望不符，附截图或 DOM 片段）。
4. **不 commit**，等总管放行后再提交。

