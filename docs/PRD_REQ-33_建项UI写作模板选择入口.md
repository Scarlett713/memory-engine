# REQ-33 建项 UI 写作模板选择入口 · PRD

- 需求编号 / 标题：**REQ-33**｜**访谈稿通用版模板（建项 UI 选择入口）**
- 来源：总管 **2026-10-14** 立号（`docs/需求登记表.md` §1.2 `:162` · §5.1 `:1357`，当时「反馈原文 / 批次待补」）＋ **2026-11-20 口径裁定 A2**（逐条见 §0.2）
- 优先级：**P3**（沿用登记表）
- 状态：**PRD / 任务单已出（2026-11-20）· 待总管放行实施**（实施交 **DS**，见 `docs/tasks/REQ-33-task.md`）
- 界面落点：`/upload` 上传建项（`src/components/upload/interview-upload-form.tsx`）＋ `/projects/new` AI 访谈建项（`src/components/new-project/new-project-flow.tsx`）；multipart 组装在 `src/store/project-workspace.ts`
- 关联：**REQ-31**（第 6 套 `general`「通用访谈类」· 3 章骨架 · 显式键通道）· **REQ-32**（`writingTemplateKey` 项目级字段 ＋ 服务端白名单 ＋ 400 口径 ＋ 回读只留白名单键）· **REQ-36**（步骤序 `basic → route → outline`，AI 建项点在提纲确认）· **BUG-18 / BUG-19**（上传页提交锁与导航窗口）· **UI-33**（同文件已验收面：`accept` 收窄 ＋ 格式白名单）
- 服务端：**0 hunk** —— `src/app/api/**`、`src/lib/**`（含 `server/**`、`providers/**`）一律不改
- 行号基线（**2026-11-20 实测**，`[IO.File]::ReadAllLines` 口径；`HEAD = 66159c4`）：`interview-upload-form.tsx` **1356** 行 · `new-project-flow.tsx` **324** 行 · `project-workspace.ts` **160** 行 · `writing-rules.ts` **267** 行 · `types/project.ts` **261** 行 · `outline-plan-workspace.tsx` **1046** 行。**行号随 `src` 改动必漂移 ⇒ 实施按「区块语义 ＋ 逐字锚点」定位，不按行号跳转**
- 裁决状态：**D1~D7 已裁（§0.2），本 PRD 无剩余待裁决项**；登记表里挂着的「与 REQ-31 / REQ-32 同源与否」由 §0.2-**D6** 答定

---

## 0. 现状与裁决

### 0.1 现状缺口（代码事实，逐条可核）

| # | 事实（代码位置） | 证据 | 后果 |
| --- | --- | --- | --- |
| 0-1 | 两个建项入口**都不发送** `writingTemplateKey` | `interview-upload-form.tsx:731-747`（`createProject({...})` 13 个字段，无模板键）· `new-project-flow.tsx:177-185`（POST body 8 个键，无模板键）· `src/components/**` 全目录检索 `writingTemplateKey` 命中 **0** | 生产上 **100% 走场景派生** |
| 0-2 | 服务端链路已完整，可直接吃键 | `api/projects/route.ts:135-150`（multipart：`formData.get("writingTemplateKey")` ＋ `isWritingTemplateKey` 白名单 ＋ 非空且非法 **400**）· `api/projects/ai-interview/route.ts:127-141`（JSON 同口径） | **服务端零改动**（REQ-32 已验收） |
| 0-3 | 模板键单一真值源已导出 | `writing-rules.ts:257-267`（`WRITING_TEMPLATE_KEYS` / `isWritingTemplateKey`，由 `OUTLINE_WRITING_TEMPLATES` 派生）· `:35-105`（6 套，含 `general` 3 章） | UI 直接复用，**不新增 `src/lib/**` 导出** |
| 0-4 | 显式键优先级最高 | `writing-rules.ts:158-178`：`templateKey` → `custom` 关键词 → 场景映射 → `biography` 兜底 | 传键即压过场景 / 关键词，**无需改写作规则** |
| 0-5 | 类型现成 | `types/project.ts:162-169`（6 值联合 `WritingTemplateKey`）· `:222`（`writingTemplateKey?:`） | store / 组件直接用，不新造类型 |
| 0-6 | 回读只留白名单键、**不补默认** | `src/lib/server/project-store.ts` 建项时仅在 `isWritingTemplateKey(...)` 为真才写入记录 | 不传键 ⇒ 记录无键 ⇒ 派生（与今日逐字等价） |
| 0-7 | 存量数据几乎全无键 | `storage/projects.json` 实测：**51** 条项目 / 带 `writingTemplateKey` 的 **1** 条（REQ-32 验收样本） | 缺省**必须**是「不套模板」；若默认 `general`，一次性改掉 50 条项目的成稿结构 |

**结论**：缺口只在「两个 UI 入口的选择 ＋ 发送」这一点；类型 → 传输 → 校验 → 落库 → 写作规则 → 导出全链路已就位。

### 0.2 已裁决口径（总管 2026-11-20，逐条落定，不再议）

| 编号 | 裁决项 | 定稿 |
| --- | --- | --- |
| **D1** | 方案 | **A2**：UI 加模板选择器；`general` 作为**独立选项**；另加「**不套模板（自由输出）**」 |
| **D2** | 服务端 | **零改动**（`api/**`、`src/lib/**` 0 hunk；白名单 / 400 / 回读口径沿用 REQ-32） |
| **D3** | 覆盖入口 | **两个建项入口都加**：上传建项（`/upload`）＋ AI 访谈建项（`/projects/new`） |
| **D4** | 缺省值 | 「不套模板」= **不发送该键** ⇒ 请求体与今日**逐字等价** |
| **D5** | 选项来源 | 单一真值源 `WRITING_TEMPLATE_KEYS` / `OUTLINE_WRITING_TEMPLATES`；UI **不另写**键清单与名称 |
| **D6** | 与 REQ-31 / REQ-32 的关系（原「待产品方口径」） | **同源**：REQ-33 = REQ-32 字段的 **UI 入口**，复用 REQ-31 的 `general` 骨架；**不新增模板、不改映射表、不改关键词** |
| **D7** | 交付分工 | **Cline 只出 PRD ＋ 任务单**；`src/**` 实施交 **DS** |

### 0.3 派生约束（实施硬线）

- **C1 不发即缺省**：「不套模板」**不得**发送 `""` / `"null"` / `"undefined"` 字面 —— multipart 发 `"null"` 会命中 `route.ts:141-150` 的 **400**，JSON 发 `"null"` 命中 `ai-interview/route.ts:132-141` 同款 400。
- **C2 单一真值源**：选项由 `WRITING_TEMPLATE_KEYS.map(...)` 渲染、名称取 `OUTLINE_WRITING_TEMPLATES[key].name`；组件内**禁止**出现 6 个键名或 6 个中文名的手写数组（静态探针守门，见任务单 S0-K1）。
- **C3 上传入口必须落在第 3 步**：`flowMode`（自主分流步进入的正式链路）初值 `step = 3` 且**只渲染第 3 步**（`interview-upload-form.tsx:496-507`）；控件放进第 1 / 2 步则主路径看不见。
- **C4 控件 id 不得以 `outline-` 开头**：`tmp/cdp-ui24-fixes.mjs:193-208` 会把 `main` 内 id 前缀 `outline-` 的 `input / textarea / select` 全量填成「验收测试内容 …」，取值非法会污染该探针。
- **C5 新条不得加 `paper-panel`**：`globals.css:103-128` 的 `backdrop-filter` 会给 `fixed` 后代造包含块；`new-project-flow.tsx:263-264` 的注释与 `tmp/verify-phase2.mjs:258-271` 都按此口径钉死。本条虽为工作台**兄弟**（非祖先），仍按同口径收紧 —— 只用 `surface-card`。
- **C6 不碰 `outline-plan-workspace.tsx`**：其 `handleEnterAiInterview` 属非 embedded 死分支（独立路由 `/projects/new/outline` 已 307 跳板），且该文件被 REQ-36 / UI-24 / UI-32 多处探针钉住。
- **C7 初值只能是 `""`**：**不得**从 `sessionStorage` / 提纲草稿 / 项目记录读回（BUG-16 hydration 约束：SSR 与首帧客户端必须同值）。
- **C8 两个入口不共享选择**：各自建项、各自发送；从 AI 提纲步退回分流步改走上传时，AI 侧选择**不带入**上传页（见 §7-R4）。

---

## 1. 目标与非目标

### 1.1 目标

- **G1** 上传建项第 3 步出现「写作模板」选择器：**7 个选项**（6 套模板 ＋「不套模板（自由输出）」），缺省「不套模板」。
- **G2** AI 访谈建项的提纲确认步出现**同一控件**（同 7 选项、同缺省），选择随「确认提纲，开始访谈」发出的 POST 一并提交。
- **G3** 选了即生效：`writingTemplateKey` 落到项目记录；写作规则 / 成稿结构按显式键（`general` ⇒ **3 章**；其余 5 套 ⇒ 各自 5 章）。
- **G4** 不选即零影响：请求体键集与今日**逐字一致**；存量 50 条无键项目的派生结果不变。
- **G5** 选项清单与模板名称**只有一份**（来自 `writing-rules.ts`），UI 不产生第二份白名单。

### 1.2 非目标

- **N1** 不改服务端（路由 / 校验 / 落库 / 派生 / 写作规则构造）。
- **N2** 不新增第 7 套模板；不改 `SCENARIO_WRITING_TEMPLATE` / `CUSTOM_TEMPLATE_KEYWORDS` / `FALLBACK_WRITING_TEMPLATE_KEY`。
- **N3** 不支持建项后**改**模板（无 PATCH 入口；登记为已知局限 §10-L2）。
- **N4** 不把选择写进 `sessionStorage` / 提纲草稿 / URL（刷新即回缺省）。
- **N5** 不改导出层（`project-export.ts` 按「中文数字、」识别章标题，`general` 3 章可导出已由 REQ-32 AC-9 验过）。
- **N6** 不改 mock / 演示链路的 5 章输出（REQ-31 §0.4-Q4 已知局限，本批继承）。

---

## 2. 落点与逐字锚点

> 所有锚点行号为 **2026-11-20** 基线；实施时先按文本 `grep` 复核，再落刀（任务单 §0.1 给了命令）。

### 2.1 新增共用控件（1 个新文件）

`src/components/ui/writing-template-select.tsx`（**新建**；与 `button.tsx` / `status-badge.tsx` 同目录、同形态；**不加 `"use client"`** —— 无 hook、无事件源，只被 client 组件引用）。

**为什么抽控件**：两个入口若各写一段 12 行 `<option>` 派生，必然漂移 —— REQ-32 的核心教训就是「白名单只有一份」。抽出来后：选项清单、文案、章数后缀、`title` 章节提示**只有一处**，且两处 UI **数据同源、形态同构**。

### 2.2 上传建项 `src/components/upload/interview-upload-form.tsx`（4 处）

| # | 落点 | 逐字锚点（基线行号） | 动作 |
| --- | --- | --- | --- |
| U-1 | import | `import { Button } from "@/components/ui/button";`（`:25`） | 其后加控件 import（含 `type WritingTemplateSelection`） |
| U-2 | state | `// ── Step 3 音频与提交` 区块内 `const [language, setLanguage] = useState("cn");`（`:548`） | 其后加 1 条 state，初值 `""` |
| U-3 | UI | `{step === 3 ? (`（`:1209`）区块内：语言字段 `<div>` 收尾 `</div>`（`:1227`）之后、音频卡 `<div className="surface-card ...">`（`:1229`）之前 | 插入 `<WritingTemplateSelect />` |
| U-4 | payload | `const project = await createProject({`（`:731`）… `language,`（`:746`） | 在 `language,` 之后加条件展开 |

### 2.3 store `src/store/project-workspace.ts`（3 处）

| # | 落点 | 逐字锚点（基线行号） | 动作 |
| --- | --- | --- | --- |
| S-1 | 类型 import | `import type {`（`:5`）… `RedactionRule,`（`:11`） | 清单加 `WritingTemplateKey,` |
| S-2 | payload 类型 | `type CreateProjectPayload = {`（`:14`）… `language: string;`（`:28`） | 其后加可选字段 ＋ 注释 |
| S-3 | FormData | `formData.set("language", payload.language \|\| "cn");`（`:94`） | 其后加「有值才 set」的 3 行 |

### 2.4 AI 访谈建项 `src/components/new-project/new-project-flow.tsx`（4 处）

| # | 落点 | 逐字锚点（基线行号） | 动作 |
| --- | --- | --- | --- |
| A-1 | import | `import { OutlinePlanWorkspace } from "@/components/outline/outline-plan-workspace";`（`:12`） | 其后加控件 import |
| A-2 | state | `const [outlineError, setOutlineError] = useState("");`（`:67`） | 其后加 1 条 state，初值 `""` |
| A-3 | UI | `{step === "outline" ? (`（`:279`）内：`embedded` 注释两行（`:284-285`）之后、`<OutlinePlanWorkspace`（`:286`）之前 | 插入 `<WritingTemplateSelect framed />` |
| A-4 | payload | `body: JSON.stringify({`（`:177`）… `outlineDraftMarkdown: markdown,`（`:184`） | 在 `outlineDraftMarkdown` 之后、`}),` 之前加条件展开 |

---

## 3. 定稿形态（逐字代码）

### 3.1 新控件 `src/components/ui/writing-template-select.tsx`

```tsx
import type { WritingTemplateKey } from "@/lib/types/project";
import {
  OUTLINE_WRITING_TEMPLATES,
  WRITING_TEMPLATE_KEYS,
} from "@/lib/writing-rules";

/**
 * REQ-33：写作模板选择控件（两个建项入口共用一份，避免选项清单出现第二份）。
 *
 * - 选项来源唯一：OUTLINE_WRITING_TEMPLATES（writing-rules.ts:35-105）/ WRITING_TEMPLATE_KEYS（:257-260）。
 *   顺序 = 常量声明顺序（援藏 → 地方史志 → 企业发展史 → 人物传记 → 家族回忆录 → 通用）。
 * - 空串 = 「不套模板（自由输出）」⇒ 调用方**不发送** writingTemplateKey ⇒ 服务端按采集场景派生，
 *   与 REQ-33 之前逐字等价（API 对缺省 / 空串都按缺省处理：route.ts:135-150）。
 * - 章数写进选项文本、章标题进 title：不额外占高度，也不复制模板字面（逐字照抄由 writing-rules 负责）。
 */
export type WritingTemplateSelection = WritingTemplateKey | "";

type WritingTemplateSelectProps = {
  id: string;
  value: WritingTemplateSelection;
  onChange: (next: WritingTemplateSelection) => void;
  /** true：外包一层 surface-card（AI 提纲步，悬在工作台之上）；false：裸字段（上传第 3 步）。
   *  shrink-0：宿主 `#new-step-outline` 是 flex 纵列且工作台 flex-1 —— 不写 shrink 时
   *  视口偏矮会把这一条压扁（select 变 40px 高），AC-11 的 1280×800 档就会抖。 */
  framed?: boolean;
};

export const NO_WRITING_TEMPLATE_LABEL = "不套模板（自由输出）";

export function WritingTemplateSelect({
  id,
  value,
  onChange,
  framed = false,
}: WritingTemplateSelectProps) {
  return (
    <div
      className={framed ? "surface-card shrink-0 rounded-[1.4rem] px-3 py-3 sm:px-4" : undefined}
    >
      <label className="field-label" htmlFor={id}>
        写作模板
      </label>
      <select
        id={id}
        className="text-field"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as WritingTemplateSelection)
        }
      >
        <option value="">{NO_WRITING_TEMPLATE_LABEL}</option>
        {WRITING_TEMPLATE_KEYS.map((key) => {
          const template = OUTLINE_WRITING_TEMPLATES[key];

          return (
            <option key={key} value={key} title={template.chapters.join(" / ")}>
              {`${template.name}（${template.chapters.length} 章）`}
            </option>
          );
        })}
      </select>
    </div>
  );
}
```

> 约束：不引入 `lucide-react` 图标、不新增 CSS 类、不读 `sessionStorage`、不 `useState`（受控靠宿主）。

### 3.2 上传建项四处改动（U-1 ~ U-4）

**U-1 import**（`:25` 的 `Button` import 之后）

```tsx
import {
  WritingTemplateSelect,
  type WritingTemplateSelection,
} from "@/components/ui/writing-template-select";
```

**U-2 state**（`:548` `const [language, setLanguage] = useState("cn");` 之后）

```tsx
    // REQ-33：缺省「不套模板」= 不发送 writingTemplateKey（服务端按采集场景派生）。
    // 初值只能是空串：不从 sessionStorage / 草稿读回（BUG-16：SSR 与首帧客户端必须同值）。
    const [writingTemplateKey, setWritingTemplateKey] =
      useState<WritingTemplateSelection>("");
```

**U-3 UI**（`:1227` 语言字段的收尾 `</div>` 之后、`:1229` 音频卡之前）

```tsx
            <WritingTemplateSelect
              id="writingTemplateKey"
              value={writingTemplateKey}
              onChange={setWritingTemplateKey}
            />
```

**U-4 payload**（`:746` `language,` 之后）

```tsx
        language,
        ...(writingTemplateKey ? { writingTemplateKey } : {}),
      });
```

### 3.3 store 三处改动（S-1 ~ S-3）

**S-1 / S-2**

```ts
import type {
  CollectionPath,
  ConfidentialityLevel,
  InterviewScenario,
  PrivacyLevel,
  ProjectRecord,
  RedactionRule,
  WritingTemplateKey,
} from "@/lib/types/project";

type CreateProjectPayload = {
  // …（既有 13 个字段不动）
  language: string;
  /** REQ-33：缺省 = 不套模板（不写 FormData 键 ⇒ 服务端按场景派生）。 */
  writingTemplateKey?: WritingTemplateKey;
};
```

**S-3**（`:94` `formData.set("language", ...)` 之后）

```ts
      // REQ-33：缺省不发键。空串 / 非法值都不写 —— 服务端只对「非空且非白名单」返回 400。
      if (payload.writingTemplateKey) {
        formData.set("writingTemplateKey", payload.writingTemplateKey);
      }
```

### 3.4 AI 访谈建项四处改动（A-1 ~ A-4）

**A-1 import**（`:12` `OutlinePlanWorkspace` import 之后）

```tsx
import {
  WritingTemplateSelect,
  type WritingTemplateSelection,
} from "@/components/ui/writing-template-select";
```

**A-2 state**（`:67` `const [outlineError, setOutlineError] = useState("");` 之后）

```tsx
  // REQ-33：缺省「不套模板」= 不发送 writingTemplateKey。初值只能是空串 ——
  // 渲染期读 sessionStorage 会让首帧客户端与 SSR 不同值（BUG-16 hydration 陷阱）。
  const [writingTemplateKey, setWritingTemplateKey] =
    useState<WritingTemplateSelection>("");
```

**A-3 UI**（`:284-285` embedded 注释之后、`:286` `<OutlinePlanWorkspace` 之前）

```tsx
              {/* REQ-33：模板选择放在提纲步、工作台**之外** —— 不碰 outline-plan-workspace.tsx，
                  也不进它的滚动区；framed 只加 surface-card（不加 paper-panel，见 :263 注释）。 */}
              <WritingTemplateSelect
                id="writing-template-key"
                framed
                value={writingTemplateKey}
                onChange={setWritingTemplateKey}
              />
```

**A-4 payload**（`:184` `outlineDraftMarkdown: markdown,` 之后）

```tsx
          outlineDraftMarkdown: markdown,
          ...(writingTemplateKey ? { writingTemplateKey } : {}),
        }),
```

### 3.5 选项与文案（唯一一份，随控件走）

| 顺序 | `value` | 下拉显示文本 | `title`（桌面悬停） |
| --- | --- | --- | --- |
| 1（缺省） | `""` | 不套模板（自由输出） | —（无 title） |
| 2 | `tibet_aid` | 援藏故事类（5 章） | 一、进藏背景与初心 / 二、岗位工作与实绩 / … |
| 3 | `local_chronicle` | 地方史志类（5 章） | 一、地域概况与历史沿革 / 二、重大事件与时代变迁 / … |
| 4 | `enterprise_history` | 企业发展史类（5 章） | 一、创业背景与创立历程 / … |
| 5 | `biography` | 人物传记类（5 章） | 一、生平履历与成长背景 / … |
| 6 | `family_memoir` | 家族回忆录类（5 章） | 一、家族渊源与迁徙历程 / … |
| 7 | `general` | **通用访谈类（3 章）** | 一、背景与缘起 / 二、主要经历与关键事实 / 三、认识、评价与展望 |

- 字段标签（两处同一文案）：**写作模板**
- 名称给用户看（`name`）；键给传输（`value`）—— 两者都取自 `OUTLINE_WRITING_TEMPLATES`，**手写零处**。
- `（n 章）` 由 `chapters.length` 计算；`title` 由 `chapters.join(" / ")` 计算 —— 顺带把「`general` 只有 3 章」这一关键差异前置暴露，避免用户以为所有模板都是 5 章。

### 3.6 样式取值理由

| 取值 | 理由 |
| --- | --- |
| `field-label` + `text-field` | 与全站表单一致（`globals.css:188-216`；`basic-info-form.tsx:64-77`、`interview-upload-form.tsx:1212-1227` 同款）。**不新增 CSS 类** |
| `framed` 用 `surface-card`（`globals.css:182-186`，无 `backdrop-filter`） | 提纲步需要一层容器把控件与工作台分开；**不能用 `paper-panel`**（`globals.css:103-128` 的 `backdrop-filter` 会给 `fixed` 后代造包含块 —— C5） |
| `rounded-[1.4rem] px-3 py-3 sm:px-4` | 与 `new-project-flow.tsx:300` 的错误条同半径族（`1.4rem`）；`py-3` 让整条高度 ≈ **104px**（label 14 ＋ mb 12 ＋ select 54 ＋ 上下 padding 24），§8 有高度预算 |
| `shrink-0`（仅 `framed`） | 宿主 `#new-step-outline`（`:280-283`）是 `flex flex-col`、工作台是 `flex-1`：不加 `shrink-0` 时矮视口会把控件压扁，`AC-11` 的 1280×800 / 375×667 两档直接抖 |
| `text-field` 在 flex 行内不再加 `flex-1` | 控件是竖排字段（label 在 select 上方），宽度直接 `100%`；不加 breakpoint 变体 ⇒ 375 宽度下也不会横向溢出 |

---

## 4. 数据流与契约

### 4.1 三条路径（上传入口）

| 用户选择 | FormData 键 | 服务端 | 落库 | 成稿结构 |
| --- | --- | --- | --- | --- |
| **不套模板（自由输出）**（缺省） | **无 `writingTemplateKey`** | `route.ts:136-139` → `undefined`；`:141-150` 的 400 分支**不触发**（`raw === null`） | 记录无该键（`project-store.ts` 只在 `isWritingTemplateKey` 时写） | 场景派生：`urban_memory / red_memory / intangible_heritage → local_chronicle`（5 章）、`family_memory → family_memoir`、`education_memory → biography`；`custom` 走关键词兜底 |
| 选了某套模板 | `writingTemplateKey=<key>` | 白名单通过 → 201 | 记录带该键（REQ-32 已验） | **显式键压过一切**：`resolveWritingTemplate` 第一分支（`writing-rules.ts:163-169`） |
| 手改请求 / 脏值（仅反证用） | `writingTemplateKey=xxx` | **400**「写作模板类型不合法。」 | — | — |

### 4.2 两条路径（AI 入口）

| 用户选择 | JSON body | 服务端 | 备注 |
| --- | --- | --- | --- |
| 不套模板（缺省） | 8 个键（与 HEAD 逐字一致） | `ai-interview/route.ts:128-130` → `undefined`；`:132-141` 不触发 | AI 路径的 `collectionScenario` 由提纲工作台写进草稿、恒为 `DEFAULT_COLLECTION_SCENARIO = "urban_memory"`（`outline-plan-workspace.tsx:38`；`new-project-flow.tsx:182` 只是透传草稿 profile）⇒ 派生结果 = `local_chronicle` 5 章 |
| 选了模板 | 9 个键（+ `writingTemplateKey`） | 白名单通过 → 201 | 落 `interview` 页，写作规则在整篇处理时读该键 |

### 4.3 读回口径（不改，仅确认）

`project-store.ts` 建项时对 `writingTemplateKey` 做白名单后才写；`GET /api/projects/:id` 原样返回（键可为缺省）。因此前端**不需要**任何「补默认」逻辑：`undefined` 就是「不套模板」的持久化形态。

---

## 5. 不触碰面（0 hunk 清单）

| 面 | 证据 / 理由 |
| --- | --- |
| `src/app/api/**`（含 `projects/route.ts`、`projects/ai-interview/route.ts`） | REQ-32 已把读键 / 白名单 / 400 做全（§0.1-0-2）；本批只从 UI 侧喂键 |
| `src/lib/**`（`writing-rules.ts`、`types/project.ts`、`server/project-store.ts`、`server/project-export.ts`、`providers/**`、`oral-history.ts`、`outline-session.ts`） | 常量、类型、白名单、派生、导出全部现成；改任一处都会连带 REQ-14 / REQ-25 / REQ-32 探针 |
| `src/components/outline/outline-plan-workspace.tsx` | C6：非 embedded 死分支 ＋ 被 REQ-36 / UI-24 / UI-32 探针钉住；模板选择放在容器侧（A-3）即可 |
| `storage/**` | 数据层不动（验收用临时 storage 目录，见任务单 S5） |
| `globals.css` | 复用 `field-label` / `text-field` / `surface-card`，零新增类 |
| 上传第 1 / 2 步、`BasicInfoForm`、`RouteChooser` | 模板与步骤顺序、采集场景无关；放进第 1 / 2 步反而违反 C3 |

---

## 6. 验收标准（AC-1 ~ AC-12）

> 前 8 条为功能面，9~12 为「零改动面 ＋ 回归面」。探针口径见 §9。

| # | 验收项 | 判据 |
| --- | --- | --- |
| **AC-1** | 上传页第 3 步出现控件 | `#writingTemplateKey` 存在、`value === ""`、首项文本含「不套模板」；**`flowMode`（分流步进入）与旧版向导两条路径都可见** |
| **AC-2** | AI 提纲步出现控件 | `#writing-template-key` 存在、`value === ""`；页面内该 id 唯一；控件在 `#new-step-outline` 内且在 `<OutlinePlanWorkspace>` **之外** |
| **AC-3** | 选项清单正确 | 两处 `select.options.length === 7`；顺序 = 「不套模板」＋ `WRITING_TEMPLATE_KEYS` 声明序；第 7 项文本 = `通用访谈类（3 章）`，其余 5 套文本含「（5 章）」；选中项 `title` 含「一、」 |
| **AC-4** | 缺省不发键 | multipart 拦截到的键集合与 HEAD **逐字一致**（无 `writingTemplateKey`）；AI 路径 JSON 的 `Object.keys` 与 HEAD 一致（8 键） |
| **AC-5** | 上传路径生效 | 选「通用访谈类」→ 请求含 `writingTemplateKey=general` → **201** → `GET /api/projects/:id` 的 `writingTemplateKey === "general"` |
| **AC-6** | AI 路径生效 | 同上，走 JSON 链路（`POST /api/projects/ai-interview`） |
| **AC-7** | 显式键压过关键词兜底 | 场景 `custom` ＋ 自定义名含「公司」（本会命中 `enterprise_history`），选「地方史志类」后记录仍为 `local_chronicle` |
| **AC-8** | 写作规则真吃到键 | 离线：`buildWritingRulesForProject({ ..., writingTemplateKey: "general" })` 含「本项目适用模板：通用访谈类。」且**不含**「一、生平履历与成长背景」；3 条 `general` 章标题逐字出现 |
| **AC-9** | 服务端零改动 | `git diff --numstat -- src/app/api src/lib` 为空；`git status --porcelain -- src/app/api src/lib` 为空 |
| **AC-10** | 写作规则常量零改动 | `writing-rules.ts` / `types/project.ts` 的 `git diff` 为空；`verify-req14-prompts` 保持 **145/145**（2026-11-20 实测基线） |
| **AC-11** | 布局 | 375×667 / 390×844 / 1280×800 / 1440×900：控件完整可见、`documentElement.scrollWidth <= innerWidth`；AI 提纲步底部 `fixed` 输入条仍贴视口（`verify-phase2` 第 9 节判据）；1440×900 下提纲预览可视高 ≥ `24rem` |
| **AC-12** | 回归 | `verify-phase3` **42/42**、`cdp-ui06-consent-copy` **52/52**、`cdp-req14-consent` 全绿、`verify-bug18-live` / `verify-bug19-navigation-window` 全绿、`verify-req25-export-format` **31/31**、`npx tsc --noEmit` 0 error、`npx eslint src` 仅存量项 |

---


## 7. 风险与缓解

| # | 风险 | 评级 | 缓解 |
| --- | --- | --- | --- |
| **R1** | AI 提纲步新增一条 ≈104px 的容器，挤压工作台 | 中 | 高度预算见 §8（1440×900 段剩 ≈637px，工作台自身最小需求 ≈512px）；AC-11 要求四档视口实测；不达标时**只降容器内边距**（`py-3 → py-2`），不改结构 |
| **R2** | UI-33 探针 `tmp/verify-ui33-format-guard.mjs` 的 G10（`hunk 数 === 3`）跨批恒红 | 高（会误判） | 今日实测已 **9/10 · exit 1**（HEAD 已提交 ⇒ `git diff` 恒空；BUG-19 轮 `hunks=[10,564,726,753,772,1325,1327,1347]` 同样红）⇒ **预存红单，不计门禁**；任务单 S5 规定「复跑前先重设 G10 基线」，未重设前不得当门禁 |
| **R3** | `tmp/cdp-ui24-fixes.mjs:193-208` 全量填充 `main` 内 `outline-` 前缀控件 | 中 | 控件 id 取 `writingTemplateKey` / `writing-template-key`（C4），静态探针 S0-K8 守门 |
| **R4** | 两入口选择不共享，用户以为「选了就全局生效」 | 低 | 各入口独立建项本就是产品语义（两条链路建的是不同项目）；§10-L4 登记为已知局限 |
| **R5** | 用户把「不套模板（自由输出）」理解成「无写作规范」 | 低 | 选项文本保留「自由输出」但 §10-L1 明确：写作规范（03/05 docx）照旧全量注入，只是不锁章节骨架 |
| **R6** | 未来第 7 套模板上线时两处 UI 未同步 | 低 | 由共用控件消除：新增键只需改 `writing-rules.ts`，UI 自动出现（这也是 D5 的收益） |

---

## 8. 规模与高度预算

| 文件 | 动作 | 估行 | 说明 |
| --- | --- | --- | --- |
| `src/components/ui/writing-template-select.tsx` | **新增** | ≈52 | 控件 ＋ 类型 ＋ 常量 |
| `src/store/project-workspace.ts` | 改 3 处 | +5 / −1 | 类型 import、payload 字段、FormData 分支 |
| `src/components/upload/interview-upload-form.tsx` | 改 4 处 | +11 / −1 | import、state、JSX、payload |
| `src/components/new-project/new-project-flow.tsx` | 改 4 处 | +10 / −1 | import、state、JSX、body |
| `tmp/verify-req33-template-select.mjs` | 新增（gitignored、不入库） | ≈90 | 静态探针 |
| **合计（`src`）** | **1 新增 ＋ 3 修改** | **≈ +78 / −3** | 无 `src/lib/**`、无 `src/app/**` |

**高度预算（AI 提纲步，1440×900）**：视口 900 − main 内边距 12 − 流程头 ≈143（返回 20 ＋ h1 ≈35 ＋ 步骤条 44 ＋ 上下 padding ≈44）− 栏间距 8 ≈ **737**；新条 ≈104 ⇒ 工作台剩 **≈633**，其自身最小需求（标签行 ＋ 预览 `min-h-[24rem]`=384 ＋ 操作行 ≈60 ＋ 间距 ≈24）≈ **470** ⇒ 余量 ≈160px。1280×800 同法得 ≈533，仍 > 470（AC-11 兜底）。

---

## 9. 探针影响（2026-11-20 实测口径）

| 探针 | 今日实测 | 与 REQ-33 的关系 |
| --- | --- | --- |
| `tmp/verify-req33-template-select.mjs`（**本批新增**，任务单 S0；Cline 已落盘并跑通） | **3/10 · exit 1**（未实施基线） | 红 = 缺口真实：K1~K5 / K7 / K10 FAIL；K6 / K8 / K9 假绿（控件文件不存在 ⇒ 不含禁词）。实施后应 **10/10 · exit 0**（AC-1~AC-4 / AC-9） |
| `tmp/verify/verify-req14-prompts.ts`（`node --experimental-strip-types --import ./tmp/register-alias.mjs …`） | **145/145 · exit 0** | `writing-rules.ts` 0 hunk ⇒ 应保绿（AC-10） |
| `tmp/verify-req25-export-format.mjs`（`node --import ./tmp/verify/register-alias.mjs …`） | **31 条 / FAIL 0 · exit 0** | 导出层 0 hunk ⇒ 应保绿（AC-12） |
| `tmp/verify-ui33-format-guard.mjs` | **9/10 · exit 1（G10 红）** | **预存红**（R2），不计门禁；复跑前须重设 G10 |
| `tmp/verify-phase3.mjs`（需 dev server + Chrome） | 上次全绿 **42/42**（`tmp/_bug18_reg_phase3.log`） | 其 E2 / G 段只断言 `projectName / intervieweeName / researchFocus / notes / outlineDraftMarkdown` 等**具体字段**，不做键集等值 ⇒ 加键安全；控件 id 不与其任何选择器冲突 |
| `tmp/cdp-ui06-consent-copy.mjs` | 上次全绿 **52/52**（`tmp/_bug18_reg_ui06.log`） | 只数 `input[type="checkbox"]` 与按钮文案 ⇒ 新增 `<select>` 不影响 |
| `tmp/cdp-req14-consent.mjs` | 未在本轮复跑 | payload 断言是「**包含**」式（`Boolean(payload?.audio)` 等），非键集等值 ⇒ 加键安全 |
| `tmp/verify-phase2.mjs` | 未在本轮复跑 | 两条硬判据需保绿：`#new-step-outline` 的**祖先链**无 `backdrop-filter`（`:258-271`）、`#new-step-outline .fixed` 输入条贴视口（`:278-293`） ⇒ C5 / AC-11 |
| `tmp/cdp-ui24-fixes.mjs` | 未在本轮复跑 | 见 R3（`outline-` 前缀全量填充） |
| `tmp/verify-bug18-live.mjs` / `tmp/verify-bug19-navigation-window.mjs` | 未在本轮复跑 | 判据锚在「开始处理」按钮 + `#language` 就绪信号，不数控件 ⇒ 不受影响 |

> `tmp/**` 已被 `.gitignore` 屏蔽，新写探针不入库；**不得**把探针改动混进 `src` commit。

---

## 10. 已知局限（接受，不在本批修）

- **L1** 「不套模板（自由输出）」≠ 无写作规范：`WRITING_RULES_TEMPLATE`（03 语言规范 ＋ 05 内容标准）照旧全量注入，只是不锁章节骨架。
- **L2** 建项后不能改模板：无 `PATCH` 入口（要改须删项目重建）；如需支持另立号。
- **L3** mock / 演示链路仍输出 5 章（`writing-rules.ts:157-178` 的键只作用于真实规则构造；mock 语料固定）。继承 REQ-31 §0.4-Q4。
- **L4** 选择不落草稿 / 不写 URL / 两入口不共享：刷新即回「不套模板」。
- **L5** `outline-plan-workspace.tsx` 自带的 `handleEnterAiInterview` 非 embedded 分支不发键 —— 独立路由 `/projects/new/outline` 已 307 到分流步，该分支不可达（C6）。
- **L6** 无「模板预览」页：章节骨架只在选项 `title` 里露一行，不做图形化预览。

---

## 11. 文档回写清单（**v2.44，本批不执行**）

| # | 文件 / 位置 | 改法 |
| --- | --- | --- |
| 1 | `docs/需求登记表.md` §1.2 REQ-33 行（基线 `:162`） | 状态「候选（待 PRD）」→「**PRD / 任务单已出（2026-11-20）· 待总管放行实施**」；备注把「与 REQ-31 / REQ-32 同源与否待口径」改为「**同源**（REQ-33 = REQ-32 字段的 UI 入口，复用 REQ-31 `general`）」 |
| 2 | 同表 §三 REQ-33 条目（登记为「详述待补」） | 以本 PRD §0.2 / §1 / §6 摘要回填（A2 口径、服务端零改动、双入口、AC 12 条） |
| 3 | 同表 §5.1 REQ-33 行（基线 `:1357`） | 状态列同步为 #1 的文本 |
| 4 | 同表文件头 `- 版本：` | v2.43 → **v2.44** ＋ 变更记录 1 行（本批纯文档：PRD ＋ 任务单） |
| 5 | 编号水位 | **不变**（REQ-33 早已立号，本批不消耗新号） |

