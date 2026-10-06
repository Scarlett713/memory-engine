# 任老师反馈批次 1 · ⑧「详细介绍」必填 + 透传提纲 prompt · 独立批次任务单（交付 DS）

> **来源**：任老师反馈批次 1 的第 ⑧ 处 —— 「描述信息」改「**详细介绍**」并设为**必填**、placeholder 换新，并把这段文字真正喂进提纲生成 prompt。
> **基线**：`git rev-parse --short HEAD` = **`e38b189`**（`ui: 任老师反馈批次1（①-⑦）文案与表单标题改动`）。①–⑦ 已在该提交落地，**本文件只派 ⑧**。
> **交付面**：生产代码 **5 个文件**；探针 **2 个文件**（`tmp/` 被 `.gitignore` 屏蔽，不入 commit）。
> **行号纪律**：本文所有行号是 **`e38b189` 实测值**。**同一文件内请从大行号往小行号改**；一旦发现文件内容与本文写的不一致，**以内容为准并停下来回报**，不要猜着改。
> **状态**：待实施。落盘日期 2026-10-06。
> **与批次 1 原单的关系**：`docs/tasks/UI改动任务_任老师反馈批次1.md` 的 §2.8 是本处的上一版描述，其行号按旧基线 `57c6ff1` 写、相对 `e38b189` 普遍偏大 4~5 行。**以本文件为准**，原单 §2.1–§2.7（①–⑦）已由 `e38b189` 实现，不要重复派活。

**已确认口径（总管已拍板，不要自行改判）**：

1. `#overview` 的 `<textarea>` **加 `maxLength={1000}`，不加 `required`**。
2. 基本信息步「受访对象」所在格 **加 `xl:col-span-2`**（删掉「选填」说明块后避免 XL 断点留半栏空白）。
3. `tmp/verify-phase3.mjs` 的 H4 段把 `#outline-overview` 的预填值**只写进 `note(...)`，不并进 check 条件** → `verify-phase3.mjs` 仍是 **39 条**。
4. 探针的 6 行与生产代码 **同批执行**（这 6 行向前兼容：⑧ 未落地时跑也不会红）。

---

## 一、背景（一句话）

「基本信息」步的第三个字段要从**选填的「描述信息」**改成**必填的「详细介绍」**，而且这段文字必须**真正进入提纲生成 prompt** —— 现状是只有提纲步自己的文本框会进 prompt，用户在第一步填了什么，AI 完全看不到。

链路：`/projects/new` 第一步（`BasicInfoForm`）→「下一步：生成提纲」→ 提纲步（`OutlinePlanWorkspace`，embedded 形态）→ `POST /api/outline/generate`（`ethicsNotes` → `profile.notes` → prompt）。

为什么单独立单：①–⑦ 是纯文案/标题改动（已提交）；⑧ 是唯一带逻辑的一处 —— 前端三项校验 + 组件层可选 prop 透传 + 两个 route 的长度上限，**改动面、验收面、探针面都不同**，且会让 6 个回归脚本里的 5 段卡在第一步（见 §2.6）。

---

## 二、改动清单（生产 5 个文件 + 探针 2 个文件）

### 2.0 总览与建议执行顺序

| 文件 | 处数 | 关键行号（`e38b189`） | 类型 |
| --- | --- | --- | --- |
| `src/components/outline/outline-plan-workspace.tsx` | 3 | `:99` 后、`:102-107`、`:114` | 新增可选 prop + 初值 |
| `src/components/new-project/new-project-flow.tsx` | 1 | `:180` 后 | 传 prop |
| `src/components/new-project/basic-info-form.tsx` | 7 | `:6` 后、`:8-12`、`:32-35`、`:73`、`:90-95`、`:98-100`、`:101-109`、`:108` | 校验 + 文案 + 常量 + 排版 |
| `src/app/api/projects/route.ts` | 2 | `:16` 后、`:83` | 1000 字上限 |
| `src/app/api/projects/ai-interview/route.ts` | 2 | `:17` 后、`:153` | 1000 字上限 |
| `tmp/verify-phase3.mjs`（探针） | 5 | 在 `:548`、`:626`、`:695`、`:883`、`:923` 之后各插 1 行 | 补齐 `set('#overview')` |
| `tmp/probe-urlsync.mjs`（探针） | 2 | 改 `:39` + `:40` 两行 | 补齐 `set('#overview')`（helper 需先支持 textarea） |

**建议执行顺序**（先立 prop，再改调用方，最后改文案与后端）：

1. `outline-plan-workspace.tsx` —— 先 `:114`，再 `:102-107`，最后 `:99` 后加 prop 声明（文件内自下而上）。
2. `new-project-flow.tsx:180` 后补 `initialOverview={basicInfo.overview}`。
3. `basic-info-form.tsx`（文件内自下而上）：`:101-109`+`:108`（textarea/placeholder）→ `:98-100`（label+星号）→ `:90-95`（删说明块）→ `:73`（add `xl:col-span-2`）→ `:32-35`（校验）→ `:8-12`（注释）→ `:6` 后（常量）。
4. `api/projects/route.ts`：`:83` → `:16` 后（常量）。
5. `api/projects/ai-interview/route.ts`：`:153` → `:17` 后（常量）。
6. 探针 `verify-phase3.mjs`：**从 J2 往 H4 倒着插**（`:923` → `:883` → `:695` → `:626` → `:548`），这样前一处插入不会推挤后一处行号。
7. 探针 `probe-urlsync.mjs`：改 `:39`（helper 支持 textarea）与 `:40`（补 `set('#overview','z')`）两行。

> 编码提示：相关文件是 **UTF-8**，用 PowerShell `Get-Content` 默认编码读中文会显示乱码（不影响文件本身）。请在编辑器里直接改，不要用命令行读写中文字符串。

### 2.1 `src/components/new-project/basic-info-form.tsx`（132 行，7 处）

#### 2.1.1 顶部常量（在 `:6` 之后插入）

现状（`:1-8`）：

```
1 | "use client";
3 | import { useState, type FormEvent } from "react";
4 | import { ArrowRight } from "lucide-react";
6 | import { Button } from "@/components/ui/button";
8 | /**
```

在 `:6` 的 import 之后、`:8` 的类型注释之前插入：

```tsx
// 与服务端 NOTES_MAX_LENGTH 对齐（/api/outline/generate、/api/projects）。
const OVERVIEW_MAX_LENGTH = 1000;
```

（写法对照 `outline-plan-workspace.tsx:39-40` 的既有先例；**各自本地定义，不要新建共享模块**。）

#### 2.1.2 类型注释同步（`:8-12`）

现状：

```
 9 |  * 三步流程「基本信息」的载荷（REQ-21 §4.2）。
10 |  * 只有 projectName / intervieweeName 是必填；overview 选填。
11 |  * 本类型定义在表单侧，流程容器与分流步都从这里取，避免三处各写一份。
```

第 **10 行**改为：

```ts
 * 三项均必填（overview 自任老师反馈批次 1 起改为必填的「详细介绍」）。
```

#### 2.1.3 校验扩到三项（`:32-35`）

现状：

```
32 |     if (!value.projectName.trim() || !value.intervieweeName.trim()) {
33 |       setError("请先填写访谈主题与受访对象。");
34 |       return;
35 |     }
```

改为：

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

- 仍用 `.trim()` 判空：全空白（`'   '`）等同没填 —— 与 `new-project-flow.tsx:83-85` 的既有口径一致。
- `:29` 的注释「前端校验即可，不发网络请求（PRD §9-2）」保留不动。
- 校验失败时**不得**调用 `onNext()`，否则会绕过第一步直接进提纲步。
- 错误条容器（`:113-117`）不改；只改文案与判断条件。

#### 2.1.4 受访对象格补满栏（`:73`）

现状：

```
73 |         <div>
74 |           <label className="field-label" htmlFor="intervieweeName">
```

`:73` 改为：

```tsx
        <div className="xl:col-span-2">
```

（排版项：`受访对象` 原本靠 `:90-95` 那个说明块占掉另一半栏；说明块删掉后不加这一项，XL 断点会留半栏空白。不加也不报错、不影响任何断言。）

#### 2.1.5 删掉「选填」说明块（`:90-95`，整块删除）

```tsx
        {/* 选填，与必填项并排占满另一格；窄屏自然堆叠。 */}
        <div className="flex items-end">
          <p className="text-xs leading-5 text-muted">
            描述信息选填，可以在下一步生成提纲时再补充细节。
          </p>
        </div>
```

字段改必填后这句与事实矛盾，删掉；删后 `:97-110` 的字段块自然上移（二者同属 `:55` 的 grid）。**只删这一块，`:55` 的 `grid` 容器与 `xl:grid-cols-2` 不动。**

#### 2.1.6 字段名 + 必填星号（`:98-100`）

现状：

```
 98 |           <label className="field-label" htmlFor="overview">
 99 |             描述信息
100 |           </label>
```

改为：

```tsx
          <label className="field-label" htmlFor="overview">
            详细介绍
            <span className="ml-1 text-red-500">*</span>
          </label>
```

（星号写法与 `:59`（访谈主题）、`:76`（受访对象）逐字一致。）

#### 2.1.7 textarea 加上限 + placeholder 换新（`:101-109`，placeholder 在 `:108`）

现状：

```
101 |           <textarea
102 |             id="overview"
103 |             className="text-area min-h-[7rem]"
104 |             value={value.overview}
105 |             onChange={(event) =>
106 |               onChange({ ...value, overview: event.target.value })
107 |             }
108 |             placeholder="补充这次访谈的背景、想覆盖的时段或事件，AI 会据此生成提纲。"
109 |           />
```

改为（**只新增 `maxLength` 一行 + 换 `:108` 的 placeholder；不加 `required`**）：

```tsx
          <textarea
            id="overview"
            className="text-area min-h-[7rem]"
            value={value.overview}
            maxLength={OVERVIEW_MAX_LENGTH}
            onChange={(event) =>
              onChange({ ...value, overview: event.target.value })
            }
            placeholder="您可补充说明需要记录的相关事件、人物信息、时间线索等内容，以便我们向您提供个性化访谈提纲"
          />
```

**注意事项**：

- placeholder 必须是**单行字符串**，不要折成多行属性（会引入意外空白）。
- `id="overview"`、`className`、受控 `value/onChange`、提交按钮（`:119-129`，含 `data-step-next="outline"`）**一律不动**。

### 2.2 `src/components/outline/outline-plan-workspace.tsx`（1028 行，3 处）

#### 2.2.1 新增可选 prop `initialOverview`（在 `:99` 之后插入）

现状：

```
 95 |   /**
 96 |    * 「受访者」输入框的初值。默认 "" —— 不传时与本次改动前的行为逐字一致。
 97 |    * 与 initialTopic 同源，取自基本信息步的受访者姓名。
 98 |    */
 99 |   initialSubject?: string;
100 | };
```

在 `:99` 之后、`:100` 的 `};` 之前插入：

```tsx
  /**
   * 「详细介绍」输入框的初值。默认 "" —— 不传时与本次改动前的行为逐字一致。
   * 三步流程传基本信息步的「详细介绍」；生成 / 改写提纲时该值随
   * researchFocus + ethicsNotes 双写进 prompt（任老师反馈批次 1 ⑧）。
   */
  initialOverview?: string;
```

#### 2.2.2 解构参数补一项（`:102-107`）

现状：

```
102 | export function OutlinePlanWorkspace({
103 |   embedded = false,
104 |   onContinue,
105 |   initialTopic,
106 |   initialSubject,
107 | }: OutlinePlanWorkspaceProps = {}) {
```

改为（只加一行，顺序放在 `initialSubject,` 之后）：

```tsx
export function OutlinePlanWorkspace({
  embedded = false,
  onContinue,
  initialTopic,
  initialSubject,
  initialOverview,
}: OutlinePlanWorkspaceProps = {}) {
```

#### 2.2.3 概述框初值（`:114`）

现状：

```
112 |   // UI-12：六个被合并字段共用这一个自由文本框，提交时双写进
113 |   // researchFocus 与 ethicsNotes / notes（见 PRD §4 决策记录）。
114 |   const [overview, setOverview] = useState("");
```

`:114` 改为：

```tsx
  const [overview, setOverview] = useState(initialOverview ?? "");
```

**注意事项**：

- `:112-113` 的注释**保持原样**（不要顺手改，避免无谓 diff）。
- 写法必须与同文件 `:110`（`useState(initialSubject ?? "")`）、`:111`（`useState(initialTopic ?? "")`）一致。
- 这是**唯一**要动的 state；`markdown` / `notice` / `isGenerating` / 对话历史**都不动**。
- 该值进 prompt 的路径已有、无需新建：`:233`/`:237` 与 `:312`/`:316` 的 `researchFocus` + `ethicsNotes` 双写 → 请求体 `payload.ethicsNotes` → 服务端 `profile.notes`。**不要另加一条独立字段**。

### 2.3 `src/components/new-project/new-project-flow.tsx`（204 行，1 处）

在 `:180`（`initialSubject={basicInfo.intervieweeName}`）之后、`:181`（`onContinue={() => {`）之前插入一行：

现状：

```
177 |               <OutlinePlanWorkspace
178 |                 embedded
179 |                 initialTopic={basicInfo.projectName}
180 |                 initialSubject={basicInfo.intervieweeName}
181 |                 onContinue={() => {
```

改为：

```tsx
              <OutlinePlanWorkspace
                embedded
                initialTopic={basicInfo.projectName}
                initialSubject={basicInfo.intervieweeName}
                initialOverview={basicInfo.overview}
                onContinue={() => {
```

**注意事项**：

- 缩进 **16 空格**（与 `embedded` / `initialTopic` 对齐），不要用 tab。
- `onContinue`（`:181-187`）与 `persistBasicInfo`（`:76-94`）**一字不动**：`persistBasicInfo` 本来就会把 `basicInfo.overview` 写进草稿的 `researchFocus` + `ethicsNotes`，本次不改它的双写逻辑。
- 分流步 `RouteChooser`（`:194-196`）与上传页预填不在本处范围内。

### 2.4 `src/app/api/projects/route.ts`（176 行，2 处）

#### 2.4.1 新增长度常量（在 `:16` 之后插入）

现状（`:16-18`）：

```
16 | import type { RedactionRule, UserType } from "@/lib/types/project";
17 |
18 | function parseCustomRedactionRules(value: FormDataEntryValue | null) {
```

在 `:16` 的 import 之后、`:18` 的 `function parseCustomRedactionRules` 之前插入：

```ts
// 与 /api/outline/generate、/api/projects/ai-interview 保持同口径的 notes 上限。
// route 文件之间不互相 import，各自本地定义；不要新建共享模块。
const NOTES_MAX_LENGTH = 1000;
```

#### 2.4.2 notes 截断（`:83`）

现状：

```
83 |     const notes = formData.get("notes")?.toString().trim() ?? "";
```

改为（在 `.trim()` 之后追加 `.slice(0, NOTES_MAX_LENGTH)`）：

```ts
    const notes =
      formData.get("notes")?.toString().trim().slice(0, NOTES_MAX_LENGTH) ??
      "";
```

**注意事项**：

- **只加长度上限，不加必填**：`/api/projects` 是上传页（`/upload`）与新建流程共用的入口，上传页的 `#notes`（页面标签是「项目说明」）是**选填**；在这里加必填会 400 掉整条上传链路。
- 该 route 的其它字段（`:76-82`、`:84-90`）**一律不动**。
- 断行方式不限（本项目 `lint` 只跑 eslint、不含 prettier），只要语义是 `trim()` 后 `slice(0, 1000)`。

### 2.5 `src/app/api/projects/ai-interview/route.ts`（194 行，2 处）

#### 2.5.1 新增长度常量（在 `:15` 之后插入）

现状（`:15-18`）：

```
15 | } from "@/lib/types/project";
16 |
17 | // 与 api/projects/route.ts 的默认规则保持一致（route 文件之间不能互相 import）。
18 | const DEFAULT_REDACTION_RULES: RedactionRule[] = [
```

在 `:16`（空行）之后、`:17` 的注释之前插入：

```ts
// 与 /api/outline/generate、/api/projects 保持同口径的 notes 上限。
const NOTES_MAX_LENGTH = 1000;
```

（放在 `:17` 注释**上面**，让那条注释继续贴着 `DEFAULT_REDACTION_RULES`。）

#### 2.5.2 notes 截断（`:153`）

现状：

```
153 |       notes: normalizeText(payload.notes),
```

改为：

```ts
      notes: normalizeText(payload.notes).slice(0, NOTES_MAX_LENGTH),
```

**注意事项**：

- **只加长度上限，不加必填**：`:123-146` 里已有的 `projectName` / `intervieweeName` / `outlineDraftMarkdown` 三处 400 判定**一行都不改**；「详细介绍」的必填由前端第一步拦截（服务端保持宽松，避免把老客户端与上传链路打红）。
- `:148-160` 的 `createProject({...})` 其它入参**一律不动**。

### 2.6 探针 `tmp/verify-phase3.mjs`（5 处，各插 1 行）

#### 2.6.0 为什么必须动它（不改必红）

- `BasicInfoForm` 的三项校验见 §2.1.3：⑧ 落地后，只要「详细介绍」为空就点不动「下一步：生成提纲」，`waitFor('#new-step-outline')` 会一直等到超时。
- 探针的 `__p3.set` **本来就能写 textarea** —— `tmp/verify-phase3.mjs:109-116` 的 helper 已按 `el.tagName === 'TEXTAREA'` 挑 prototype：

  ```
  110 |         const el = document.querySelector(sel);
  112 |         const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  113 |         Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
  114 |         el.dispatchEvent(new Event('input', { bubbles: true }));
  ```

  所以问题是「**没调**」，不是「调了没用」；修法就是补一次 `__p3.set('#overview', ...)`。
- 全文共 11 个「点 `[data-step-next="outline"]`」的位置：**6 个已写**（`:210`、`:254`、`:315`、`:484`、`:511`、`:972`，**不要动**），**5 个漏了**（下表）。漏的这 5 个会卡在第一步，连带 **H4、H6/H7、I1–I3、J1、J2** 五段全红。
- 这 5 行**向前兼容**：⑧ 未落地时给选填字段写值同样成立，所以先落探针也不会把当前基线跑红（这也是「④同批执行」的前提）。

#### 2.6.1 五处位置一览

| # | 段 | 插在 | 该处点击前的三行 |
| --- | --- | --- | --- |
| 1 | H4（embedded 自动生成） | `:548` 之后 | `:547` set 主题 / `:548` set 受访者 / `:549` click |
| 2 | H6·H7（outline-required 弹窗） | `:626` 之后 | `:625` / `:626` / `:627` click |
| 3 | I1·I2·I3（共用入口 `enterUploadStep3`） | `:695` 之后 | `:694` / `:695` / `:696` click |
| 4 | J1（新版分支） | `:883` 之后 | `:882` / `:883` / `:884` click |
| 5 | J2（底栏往返闭合） | `:923` 之后 | `:922` / `:923` / `:924` click |

#### 2.6.2 逐处片段（**从下往上改**：先 `:923`，最后 `:548`）

**① H4（`:546-550`）**

```js
 547 |   await ev(`window.__p3.set('#projectName', 'H-自动生成主题')`);
 548 |   await ev(`window.__p3.set('#intervieweeName', 'H-自动生成受访者')`);
     |   ← 插入下面这行
 549 |   await ev(`window.__p3.click('[data-step-next="outline"]')`);
 550 |   await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
```

插入（`:548` 之后）：

```js
  await ev(`window.__p3.set('#overview', 'H-自动生成描述')`);
```

**② H6·H7（`:624-628`）** —— 注意 `:623` 刚清过 `sessionStorage`，要插在同一个 set 序列里：

```js
 625 |   await ev(`window.__p3.set('#projectName', 'H-弹窗项目名')`);
 626 |   await ev(`window.__p3.set('#intervieweeName', 'H-弹窗受访者')`);
     |   ← 插入下面这行
 627 |   await ev(`window.__p3.click('[data-step-next="outline"]')`);
 628 |   await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
```

插入（`:626` 之后）：

```js
  await ev(`window.__p3.set('#overview', 'H-弹窗描述')`);
```

**③ I1·I2·I3 共用入口 `enterUploadStep3()`（`:692-697`）** —— 只改这一处就覆盖三条断言，注意缩进是 **4 空格**：

```js
 694 |     await ev(`window.__p3.set('#projectName', 'I-上传页项目名')`);
 695 |     await ev(`window.__p3.set('#intervieweeName', 'I-上传页受访者')`);
     |       ← 插入下面这行
 696 |     await ev(`window.__p3.click('[data-step-next="outline"]')`);
 697 |     await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
```

插入（`:695` 之后）：

```js
    await ev(`window.__p3.set('#overview', 'I-上传页描述')`);
```

**④ J1（`:881-885`）**

```js
 882 |   await ev(`window.__p3.set('#projectName', 'J-新版项目名')`);
 883 |   await ev(`window.__p3.set('#intervieweeName', 'J-新版受访者')`);
     |   ← 插入下面这行
 884 |   await ev(`window.__p3.click('[data-step-next="outline"]')`);
 885 |   await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
```

插入（`:883` 之后）：

```js
  await ev(`window.__p3.set('#overview', 'J-新版描述')`);
```

**⑤ J2（`:921-925`）**

```js
 922 |   await ev(`window.__p3.set('#projectName', 'J2-往返项目名')`);
 923 |   await ev(`window.__p3.set('#intervieweeName', 'J2-往返受访者')`);
     |   ← 插入下面这行
 924 |   await ev(`window.__p3.click('[data-step-next="outline"]')`);
 925 |   await waitFor(`Boolean(document.querySelector('#new-step-outline'))`);
```

插入（`:923` 之后）：

```js
  await ev(`window.__p3.set('#overview', 'J2-往返描述')`);
```

**注意事项**：

- 值的前缀（`H-` / `I-` / `J-` / `J2-`）刻意与各段既有命名一致，方便红的时候一眼定位是谁写进去的。
- 每处只加 **1 行 `await ev(...)`**，不要顺手改其它 set 的值、不要合并成多字段一行（这几处本来就是一行一字段的写法）。
- ⚠️ **`:596` 的 `clickText('下一步')` 不要动**：那是上传页（H5 段）自己三步向导的按钮，与新建流程的基本信息步无关。

### 2.7 探针 `tmp/probe-urlsync.mjs`（1 处，但要动 **2 行**）

**⚠️ 关键差异（必须照做，否则脚本直接崩）**：这个脚本的内联 `set` 只认 input —— `:39` 硬编码 `HTMLInputElement.prototype`；而 `:33` 的 `ev` 在页面内抛异常时会 **throw**：

```
33 | const ev = async (expr) => { const r = await send("Runtime.evaluate", ...); if (r.exceptionDetails) throw new Error(...); return r.result.value; };
39 | ... const el=document.querySelector(s); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v); ...
```

直接在 `:40` 加 `set('#overview','z')` 会在 `<textarea>` 上抛 `TypeError: Illegal invocation`（HTMLInputElement 的 value setter 有 brand check，`this` 是 textarea 时不匹配），脚本**当场崩**、不是静默跳过。所以这里必须**两步都做**：

1. 把 `set` 改成按 `tagName` 挑 prototype（照抄 `tmp/verify-phase3.mjs:112` 的既有写法）；
2. 再在 `:40` 的调用里补 `set('#overview','z')`。

现状（`:38-41`）：

```
38 |   await goto(`${BASE}/projects/new`);
39 |   await ev(`(() => { const set = (s,v) => { const el=document.querySelector(s); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); };
40 |     set('#projectName','x'); set('#intervieweeName','y'); return true; })()`);
41 |   await sleep(200);
```

改为（`:39` 的 helper 里插入 `const proto = ...`，`:40` 的调用里追加一次 set）：

```js
  await ev(`(() => { const set = (s,v) => { const el=document.querySelector(s); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); };
    set('#projectName','x'); set('#intervieweeName','y'); set('#overview','z'); return true; })()`);
```

（保持该脚本既有的「长单行 + 一行调用」风格与 `'x'`/`'y'` 占位命名 —— 这个脚本只记录 URL 变迁，不看具体值。）

**不要动**：`:49` 的 `document.querySelector('[data-step-next="outline"]').click()`、`:44-47` 的 URL 变更记录器、`:51` 之后的采样点。

### 2.8 为什么这 6 处不需要连带动任何**断言**（已逐个核过，不要「顺手加固」）

| 可能被怀疑的地方 | 实际情况 |
| --- | --- |
| `verify-phase3.mjs:306` 的 `researchFocus: ""` | G 段 `:303-309` 注入 AI 会话**种子**时的取值，`:322` 附近会整体覆盖 → 不是期望值，不用改 |
| G 段断言 `:357`（`gSent.researchFocus/notes === 'A-基本步描述'`） | AI 分支载荷由 `route-chooser.tsx:168`/`:170` **直接读 `basicInfo.overview`**（React state），**不读**草稿 → 与新增的 5 个 set 无关 |
| E1 `:246` / E2 `:294`（`notes === 'A-基本步描述'`） | 这两段在 `:209`/`:253` 已经写过 `#overview`，只认自己写进去的值 |
| H2 `:498`（`val('#overview')` 回填断言） | 同上，H 段在 `:483`/`:510` 已写 `H-返回步描述` |
| H4 prefill 快照 `:552` | 只取 `#outline-topic` / `#outline-subject`；即使 overview 也预填了，判定不变 |
| 文案断言 | 全量 grep `tmp/*.mjs`：**没有任何断言引用「描述信息」「详细介绍」「选填」或旧 placeholder**（命中的 `描述` 全是 set 进去的**值**，如 `verify-phase2.mjs:238` 的 `'探针描述信息'`）；grep `请先填写` 也**零命中** → ⑧ 改标签/placeholder/错误文案**不需要同步任何断言** |

**因此**：本批次探针改动 = 正好 **6 行**（`verify-phase3.mjs` 5 行 + `probe-urlsync.mjs` 1 行 set 调用；`probe-urlsync.mjs` 的 helper 行另算 1 行同批改）。多改一行都要在回报里说明理由。

### 2.9 本批次规模

| 面 | 文件 | 处数 | 说明 |
| --- | --- | --- | --- |
| 生产 | 5 | 15 | `basic-info-form` 7 + `outline-plan-workspace` 3 + `new-project-flow` 1 + `api/projects/route` 2 + `api/projects/ai-interview/route` 2 |
| 探针 | 2 | 7 | `verify-phase3.mjs` 新增 5 行；`probe-urlsync.mjs` 改 2 行（helper 支持 textarea + 补 `set('#overview','z')`） |

`tmp/` 被 `.gitignore` 屏蔽，**不入 commit**；生产代码请只改上面 5 个文件。

---

## 三、验收标准

### 3.1 静态检查（三条，必须与基线「一字不差」）

#### 3.1.1 定向 lint（5 个生产文件）

```powershell
npx eslint src/components/new-project/basic-info-form.tsx src/components/outline/outline-plan-workspace.tsx src/components/new-project/new-project-flow.tsx src/app/api/projects/route.ts src/app/api/projects/ai-interview/route.ts
```

**期望：没有任何输出、`exit code 0`**（改动前实测就是 0 problem、exit 0）。

#### 3.1.2 类型检查

```powershell
npx tsc --noEmit
```

**期望：没有任何输出、`exit code 0`**（改动前实测 exit 0）。这一条专门兜住 lint 抓不到的错 —— 比如 `initialOverview` 传了但 prop 名/类型写错、`basicInfo.overview` 拼错。

#### 3.1.3 全量 lint 基线（不得新增）

```powershell
npm run lint
```

改动前实测：`✖ 6 problems (1 error, 5 warnings)`、**exit 1**（这是仓库既有基线，不是本批次引入）：

| # | 位置 | 级别 | 规则 |
| --- | --- | --- | --- |
| 1 | `src/app/api/auth/register/route.ts:3:22` | warning | `@typescript-eslint/no-unused-vars` |
| 2 | `src/app/api/projects/[projectId]/route.ts:210:15` | warning | `@typescript-eslint/no-unused-vars` |
| 3 | `src/components/projects/project-processing-console.tsx:919:6` | warning | `react-hooks/exhaustive-deps` |
| 4 | `src/hooks/useAuth.ts:33:5` | **error** | `react-hooks/set-state-in-effect` |
| 5 | `src/lib/providers/transcription/xfyun-transcription-provider.ts:19:10` | warning | `@typescript-eslint/no-unused-vars` |
| 6 | `src/lib/providers/transcription/xfyun-transcription-provider.ts:46:10` | warning | `@typescript-eslint/no-unused-vars` |

**验收**：改动后**仍是这 6 条**（数量、文件、行号、规则逐条一致）→ 结论写「与基线一致」。**不要顺手修这 6 条**，它们不在本批次范围。

### 3.2 六个回归脚本（探针 6 行落地后跑）

**前置三件**：

1. `npm run dev` 起在 **3000**（脚本里 `BASE = "http://localhost:3000"` 硬编码）。
2. Chrome 装在 **`C:/Program Files/Google/Chrome/Application/chrome.exe`**（脚本里硬编码，路径不同要先问，别自己改）。
3. **Node 22**：脚本零依赖、用内置 `WebSocket` 直连 CDP、headless 起浏览器。**串行跑**（每个脚本自己起/杀 Chrome 与临时 profile，并行会抢端口/抢登录态）。

| 脚本 | 命令 | 期望汇总行 | 本批次最相关的段 |
| --- | --- | --- | --- |
| `verify-phase2.mjs` | `node tmp/verify-phase2.mjs` | `37/37 通过` | `:170`/`:176` 三字段 id 齐全；`:238` 写 overview；`:364` AI 直传 |
| `verify-phase3.mjs` | `node tmp/verify-phase3.mjs` | `39/39 通过` | **A / E1 / E2 / G / H2 / H3–H4 / H6–H7 / I1–I3 / J1 / J2**（H4·H6·I·J1·J2 是本次补 set 的入口） |
| `cdp-req13-outline.mjs` | `node tmp/cdp-req13-outline.mjs` | `24/24 通过` | `:221` 入口已写 overview；提纲步文案 |
| `cdp-req13-crosscut.mjs` | `node tmp/cdp-req13-crosscut.mjs` | `13/13 通过` | `:174` 入口已写 overview；老/新流程跨切面 |
| `cdp-req14-consent.mjs` | `node tmp/cdp-req14-consent.mjs` | `REQ-14 28/28 passed` | 上传页自己的三步向导（与本批次无交集，回归即可） |
| `cdp-ui24-fixes.mjs` | `node tmp/cdp-ui24-fixes.mjs` | `43/43 通过` | `:257`/`:415` 直入 `?step=outline`（不经过基本信息步，理论零回归） |
| `probe-urlsync.mjs`（辅助，无断言） | `node tmp/probe-urlsync.mjs` | —— | **只要求「不崩、跑完」**（改了 `:39`/`:40` 两行后；另外它顺带证明基本信息步的 URL 变迁没被 ⑧ 改动影响） |

**判据**：每个脚本末尾都会打印 `x/y 通过`（`cdp-req14-consent.mjs:414` 是 `REQ-14 x/y passed`），失败时 `process.exitCode = 1`、异常时 `= 2` → **汇总行 + exit code 双看**，两个都要对。条数必须与上表**一模一样**。

**三条规矩**：

1. 本批次**不允许**把断言期望值改绿 —— ⑧ 不改任何期望值（理由见 §2.8），探针只允许 §2.6/§2.7 的那 6 行 + `probe-urlsync` helper 的 1 行 diff。
2. 若某条红在**你没碰过的地方**（LLM 超时、prefill 段、`G 段`的真接口），先原样复跑一次；仍红就**原样回报**，不要靠改探针「消红」。
3. 这些脚本会真的建项目、真打 LLM 接口（`verify-phase3` G 段、`verify-phase2` AI 段）：跑前确认 dev server 用的 `.env`/额度正常；跑后确认没有残留探针项目（脚本自带清理，`cdp-req13-crosscut.mjs:308` 有明确规程：POST 出来的项目无条件删掉）。

### 3.3 人工对照表（⑧ 专项 8 条，必须逐条做，脚本绿不等于完成）

> 在 1440×900 与 375×812 两个宽度各走一遍第 1–4 条；「同一步骤要顺手确认的反向项」也要写进回报。

| # | 操作 | 期望（正向） | 顺手确认（反向） |
| --- | --- | --- | --- |
| 1 | `/projects/new`，三项**全空**点「下一步：生成提纲」 | 出现中文错误条「请先填写访谈主题、受访对象与详细介绍。」，**不跳步**（URL 仍在 `/projects/new`，DOM 里没有 `#new-step-outline`） | 只缺「详细介绍」时同样被拦（说明第三项真进了校验）；清空某一项后重试能正常放行 |
| 2 | 看「详细介绍」前的标签 | 标签是「**详细介绍**」+ 红色 `*`（与「访谈主题」「受访对象」的长相一致） | 页面上**不再出现**「描述信息」四个字，也**不再出现**「描述信息选填，可以在下一步生成提纲时再补充细节。」这句话 |
| 3 | 读 placeholder | 一字不差：`您可补充说明需要记录的相关事件、人物信息、时间线索等内容，以便我们向您提供个性化访谈提纲` | 输入框自身行为不变：可换行、受控输入不错位、`id="overview"` 仍在（探针依赖） |
| 4 | XL 断点（≥1280）看版面 | 「受访对象」整行通栏，三字段**没有半栏空白**；窄屏（375）自然纵向堆叠 | 主题/受访对象两格的对齐、间距与改动前一致 |
| 5 | 粘一段 >1000 字 | 输入框停在 1000 字（`maxLength`），光标还在末尾、没有报错弹窗 | 三项都填好后点下一步，草稿里的 `notes`（DevTools → `sessionStorage`）也是被截到 ≤1000 的那段 |
| 6 | **透传核心**：三项填好 → 点「下一步：生成提纲」 | 提纲步的「详细介绍」框里**已经带着**第一步那段文字（`#outline-overview` 有值） | `#outline-topic` / `#outline-subject` 仍分别带着第一步的主题/受访者（原来的两个 prefill 没被弄坏） |
| 7 | **回归**：直接开 `/projects/new/outline`，以及老流程 `/projects/new?step=outline` | 三个框都是**空的**、无报错（`initialOverview` 缺省 `""` 的保护） | 生成/改写提纲、确认、跳过四条按钮行为与改动前一致 |
| 8 | 端到端：走「确认提纲」或「跳过提纲」到分流步 → 项目页 | 项目详情里的 `notes` / `researchFocus` 就是第一步填的那段文字（`/api/outline/generate` 与 `/api/projects` 两路一致） | 从分流步「返回上一步」回到基本信息步能看到原文、再进提纲步文字不丢；上传页 `/upload` 的「项目说明」仍是**选填**、不填也能建项目 |

### 3.4 红了怎么办

1. **回报格式**：脚本名 + 末尾汇总行 + 第一条失败断言的原文 + 你判断的根因（若已定位到行）。
2. **不许**把断言期望值改绿、不许放宽超时/条数来「过」。本批次探针只许有 §2.6/§2.7 的 diff。
3. **改探针之前先备份**：`tmp/` 不在 git 里、**没有 `git checkout` 可回滚** —— 动 `tmp/verify-phase3.mjs` 与 `tmp/probe-urlsync.mjs` 之前，先各复制一份 `*.bak`（或把原始 `:39`/`:40` 两行贴进回报）。这是本批次唯一的回滚手段。
4. 静态检查（3.1.1/3.1.2）若报错，先修到 0 再跑脚本，别带着类型错跑 6 个脚本浪费一轮。

---

## 四、不要动的边界

### 4.1 对外契约（动了探针就全崩）

一律**不改名、不删**：`#projectName`、`#intervieweeName`、`#overview`、`[data-step-next="outline"]`、`[id^="new-step-"]`（`new-step-basic` / `new-step-outline` / `new-step-route`）、`#outline-topic`、`#outline-subject`、`#outline-overview`、`sessionStorage` 的草稿 key。

### 4.2 明确划出本批次之外的（每一条都有原因）

| 不碰的东西 | 原因 |
| --- | --- |
| 上传页 `/upload` 的 `#notes`（「项目说明」）及其校验 | 与新建流程的第一步不是同一个字段语义，它是**选填**；改它会连带 400 掉整条上传链路 |
| `/api/projects/route.ts` 的必填判定 | 同上：该 route 是上传页与新建流程共用入口，服务端保持宽松 |
| `/api/projects/ai-interview/route.ts:123-146` 现有的三处 400（`projectName` / `intervieweeName` / `outlineDraftMarkdown`） | 本批次不加第四条必填（必填由前端第一步拦） |
| `route-chooser.tsx:168`/`:170` 的 `basicInfo.overview` 用法 | 已经在用，是透传链路的正解，只需它继续成立 |
| `outline-plan-workspace.tsx:233`/`:237`、`:312`/`:316` 的 `researchFocus` + `ethicsNotes` 双写 | 透传靠它；不要「顺便」加第三条独立字段 |
| `outline-plan-workspace.tsx:520` 的 `maxLength={OVERVIEW_MAX_LENGTH}` | 提纲步**本来就有**上限，本批次只是把第一步的框也对齐 |
| `persistBasicInfo`（`new-project-flow.tsx:76-94`）与 `saveOutlineDraftToSession` | 草稿字段集合不动，避免把「基本信息步写回」与「提纲步覆盖」的既有顺序打乱 |
| `src/lib/**`（含 prompt 模板与任何既有常量所在处） | 本批次**不新建共享模块**：`NOTES_MAX_LENGTH` 在两个 route 里各自本地定义（与 `DEFAULT_REDACTION_RULES` 的既有做法一致） |
| ①–⑦ 已落地文案（首页 / 分流步 / 上传页 / 提纲步 header 等） | 已在 `e38b189` 定稿；本批次除 ⑧ 的三处文案外不回头改 |
| `npm run lint` 里那 6 条既有问题 | 不在本批次范围，修了会让「与基线一字不差」这条验收失效 |
| `docs/tasks/UI改动任务_任老师反馈批次1.md`（批次 1 原单） | 它是存档；行号已过期，本文件取代其 ⑧ 部分，但**不要回头改原单** |
| `tmp/` 下除这两个探针以外的任何文件 | 未列入本批次 |

### 4.3 流程边界

- **不 commit**（改完只回报，等总管放行）；`tmp/` 本来就不入版本库。
- 不改动本任务单本身（`docs/tasks/UI改动任务_任老师反馈批次1_⑧独立批次.md`）。

---

## 五、交付回报模板（DS 按这个格式回，缺项算没交付）

```
## ⑧ 独立批次 · 回报
基线：e38b189（改动前 git status 干净，只有 ?? docs/tasks/）

### 生产 diff（5 文件 / 15 处）
- outline-plan-workspace.tsx：+7 / -1（:114 初值、:102-107 解构、:99 后 prop）
- new-project-flow.tsx：+1（:180 后 initialOverview）
- basic-info-form.tsx：+? / -?（:6 后常量、:10 注释、:32-35 校验、:73 col-span、:90-95 删块、:98-100 标签、:101-109 maxLength、:108 placeholder）
- api/projects/route.ts：:16 后常量、:83 截断
- api/projects/ai-interview/route.ts：:16 后常量、:153 截断
（每处写「行号 + 一行说明」，不要贴整文件）

### 探针 diff（2 文件 / 7 行）
- verify-phase3.mjs：+5（:548/:626/:695/:883/:923 之后各 1 行 set('#overview', ...)，值分别 H-自动生成描述 / H-弹窗描述 / I-上传页描述 / J-新版描述 / J2-往返描述）
- probe-urlsync.mjs：改 2 行（:39 helper 加 `tagName === 'TEXTAREA'` 分支、:40 追加 set('#overview','z')）
- 备份：tmp/verify-phase3.mjs.bak、tmp/probe-urlsync.mjs.bak（跑完确认后是否保留由总管定）

### 静态检查
- 定向 eslint（5 文件）：0 problem，exit 0
- npx tsc --noEmit：无输出，exit 0
- npm run lint：仍 6 problems（1 error, 5 warnings），逐条与基线一致

### 脚本（各自的末尾汇总行 + exit code）
- verify-phase2：x/37 通过（期望 37/37）
- verify-phase3：x/39 通过（期望 39/39，重点 H4/H6/I/J1/J2 不再超时）
- cdp-req13-outline：x/24 通过（期望 24/24）
- cdp-req13-crosscut：x/13 通过（期望 13/13）
- cdp-req14-consent：REQ-14 x/28 passed（期望 28/28）
- cdp-ui24-fixes：x/43 通过（期望 43/43）
- probe-urlsync：跑完不崩（无断言）

### 人工对照（§3.3 八条）
逐条一句话证据；1440 与 375 各一遍；异常/偏差单独列。

### 残留与未做
- 探针项目残留：无（列出清理证据）
- 未 commit、未改原单、未修 6 条既有 lint、未动其它 tmp 脚本
```

---

**落盘信息**：本文件由总管于 2026-10-06 落盘，基线 `e38b189`，交 DS 执行；执行结果按 §五 回报，**总管确认后再决定是否 commit**。

