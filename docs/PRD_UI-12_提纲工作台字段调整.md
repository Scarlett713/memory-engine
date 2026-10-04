# UI-12 提纲工作台字段调整 · PRD（精简版）

- 需求编号：UI-12 ｜ 来源：任（产品方）｜ 2026-10-03
- 界面落点：`/projects/new/outline` → `src/components/outline/outline-plan-workspace.tsx`（唯一需要改的前端文件）
- 关联：REQ-21（新建流程统一）、REQ-13（提纲生成链路）、REQ-14（AI 访谈入口）
- 决策依据：`docs/需求登记表.md:490` —— 任拍板：保留「访谈主题」「访谈对象姓名」两个独立字段，其余字段合并为一个自由文本框，供用户自述访谈内容、人物背景、主要事件。

## 0. 一句话概述

把左侧画像表单从「两张卡 8 个控件」收敛为「一张卡 3 个控件」：访谈主题、访谈对象姓名、访谈内容概述。

## 1. 目标与非目标

- 目标：降低填写成本，用一个自由文本框承接「访谈内容、人物背景、主要事件」的自述。
- 非目标：不改上传页三步向导；不给提纲工作台加步骤；不改数据层/存储层 schema；不引入新依赖、不改后端契约。

## 2. 字段清单与处置

现状位置：卡 1「受访者画像 / 必填信息」`:380-473`；卡 2「事件与时间节点」`:475-518`。

| # | 现字段 | 状态变量 | key | 控件 | 必填 | 行号 | 处置 |
|---|---|---|---|---|---|---|---|
| 1 | 访谈主题 | `topic` | `topic` | input | ✱ | `:409-421` | 保留（独立） |
| 2 | 受访者姓名 | `subject` | `subject` | input | ✱ | `:396-407` | 保留（独立，label 改「访谈对象姓名」） |
| 3 | 机构 / 单位 | `institution` | `institution` | input | — | `:423-434` | 合并进自由文本框 |
| 4 | 采集场景 | `collectionScenario` | `collectionScenario` | select | — | `:436-454` | 合并进自由文本框 |
| 5 | 研究焦点 | `researchFocus` | `researchFocus` | input | — | `:456-467` | 合并进自由文本框 |
| 6 | 重大事件 | `events` | `events` | 列表 | — | `:487-494` | 合并进自由文本框 |
| 7 | 时间节点 | `timePoints` | `timePoints` | 列表 | — | `:496-503` | 合并进自由文本框 |
| 8 | 伦理备注 | `ethicsNotes` | `ethicsNotes` | textarea | — | `:505-516` | 合并进自由文本框 |

收敛后：卡 2 整卡删除；卡 1 改为单卡三控件，顺序 = 访谈主题 → 访谈对象姓名 → 访谈内容概述（与 REQ-21 顺序一致）。`StringListField` import 与 `events`/`timePoints`/`ethicsNotes`/`institution`/`researchFocus` 状态退场。

## 3. 自由文本框定义

| 项 | 定稿 |
|---|---|
| label | **访谈内容概述**（备选：「简要介绍」＝ UI-12 原文用词、「背景描述」） |
| placeholder | 介绍受访者的人物背景、本次访谈的主要内容与主要事件。例如：受访者 1940 年生，1992 年下岗后经营裁缝铺；本次主要访谈老城厢搬迁前后的邻里记忆。 |
| 必填 | **选填**（仅「访谈主题」「访谈对象姓名」必填，对齐拍板） |
| 字数 | **≤1000 字**（`maxLength={1000}`，对齐服务端 `NOTES_MAX_LENGTH=1000`） |
| 控件 | `textarea`，沿用 `text-area min-h-[7rem]`；建议 id `#outline-overview` |

## 4. 契约 / schema key / projects.json 处理

**结论：不删任何 key，前端停止采集，自由文本双写。** 保持向后兼容，不触数据层冻结面。

| key | 处置 |
|---|---|
| `subject` / `topic` | 采集、照常发送 |
| `researchFocus` | 保留 key，前端**双写**（自由文本） |
| `ethicsNotes` → `profile.notes` / `ProjectRecord.notes` | 保留 key，前端**双写**（同一自由文本） |
| `institution` | 保留 key，前端不再采集，发送 `""` |
| `collectionScenario` | 保留 key，前端不再采集，发送默认 `urban_memory`（route 侧非法/缺失亦回落 `urban_memory`） |
| `events` / `timePoints` | 保留 key，前端不再采集，发送 `[]`（`normalizeOutlinePlanningContext` 空数组安全，生成不报错） |
| `OutlinePlanningContext` / `OutlineProjectProfile` / 请求体类型 | 不改（不新增字段、不改类型） |

4 条提交链路统一改写：

| 链路 | 行号 | 载荷 |
|---|---|---|
| `handleGenerate` → `/api/outline/generate` | `:139-153` | subject、topic、researchFocus=freeText、ethicsNotes=freeText、institution=""、collectionScenario="urban_memory"、events=[]、timePoints=[] |
| `handleChat` → `/api/outline/chat` | `:202-217` | 同上 |
| `handleConfirm` / `handleSkip` → `saveOutlineDraftToSession` | `:268-296` | profile：projectName=topic、intervieweeName=subject、researchFocus=freeText、notes=freeText、institutionName=""、collectionScenario="urban_memory" |
| `handleEnterAiInterview` → `/api/projects/ai-interview` | `:300-340` | projectName=topic、intervieweeName=subject、researchFocus=freeText、notes=freeText、institutionName=""、collectionScenario="urban_memory" |

**双写是过渡方案（决策记录）**：现有请求契约中没有任何一个字段能完整、语义准确地承载「访谈内容 + 人物背景 + 主要事件」，故本批用 `researchFocus` + `ethicsNotes`/`notes` 双写。后续若数据层新增 `overview` 字段，应把自由文本框收敛为 `overview` 单写、`researchFocus`/`notes` 退出该链路；**本批不做**（触数据层，且需动 `ProjectRecord` / 归一化 / 导出）。

**已知边界**：两个 outline 路由对 `researchFocus` 走 `FIELD_MAX_LENGTH=200` 截断，`ethicsNotes` 走 `NOTES_MAX_LENGTH=1000`；故 >200 字部分只保留在 `notes` 侧，prompt 的 Research focus 只拿前 200 字。本批接受、不改路由常量（维持「唯一前端文件」）。`/api/projects/ai-interview` 侧 `normalizeText` 不截断，双写全文入档。

## 5. 表单步骤结构

- 提纲工作台现状是**单页两栏**（左表单 / 右提纲），**无步骤**。
- 你问的「现在是三步」是**上传页**（`interview-upload-form.tsx:76-80` `wizardSteps`），**不属 UI-12，本批不动**。
- 本批结论：**不改步骤结构**，仍单页；仅左侧两卡收敛为一卡。

## 6. 存量数据影响

- 旧 `projects.json` 的 `institutionName` / `researchFocus` / `notes` / `collectionScenario` / `outlineDraftMarkdown` **原样保留**，详情页 / 处理台 / 导出 / AI 访谈控制台照常读取展示（本批不改展示层）。
- 旧 `sessionStorage` 草稿仍走 `normalizeOutlineProfile` 归一化，缺字段走默认值，不丢不崩。
- 合并字段未被「删除能力」：机构/单位、采集场景、研究焦点在上传页仍可填写（Step 1 / 高级设置），只是提纲页不再重复采集。

## 7. 涉及文件

**改（唯一前端文件）**：`src/components/outline/outline-plan-workspace.tsx`（删 6 控件、加自由文本框、改 4 条载荷、清理 import/状态）

**不改**：`src/lib/types/outline.ts`、`src/lib/outline-session.ts`、`src/lib/types/project.ts`、`src/lib/server/project-store.ts`、`storage/`、三个 API route、`src/components/upload/interview-upload-form.tsx`

**需同步更新的既有断言（非生产代码）**：
- `tmp/cdp-req13-outline.mjs`：13-A 依赖 `#outline-event-0/1`、`#outline-timepoint-0`、「添加事件」按钮与两条分节断言（`:219-252`）
- `tmp/cdp-req13-prefill.mjs`：依赖 `#outline-subject/topic/institution/scenario/focus/ethics`（`:199-207`）
- `tmp/verify-outline-planning.ts`（planningContext 分节）、`tmp/verify/verify-outline-chat.ts`、`tmp/verify/verify-skip-prefill.ts`（构造体含 events/timePoints/ethicsNotes）

**文档**：新建本 PRD；并更新 `docs/需求登记表.md` 的 UI-12 状态为「PRD 已出，待实现」。

## 8. 验收要点

1. 左侧仅 3 控件，顺序 访谈主题 → 访谈对象姓名 → 访谈内容概述；6 个被合并字段文案与该卡不再出现。
2. DOM 不再有 `#outline-institution/scenario/focus/event*/timepoint*/ethics`；自由文本框有稳定 id（建议 `#outline-overview`）。
3. 4 条链路（生成 / 对话 / 确认带入上传 / 进入 AI 访谈）均不报错；events/timePoints 空数组、collectionScenario 回落 `urban_memory` 正常。
4. 自由文本框为空不影响生成（`canGenerate` 仍只看 subject + topic）。
5. 输入 500 字 → 生成成功；prompt 的 Research focus 只取前 200 字（预期行为）。
6. 375px 与桌面无溢出；删卡 2 后栅格自动收拢。
7. 旧项目详情页 / 导出展示与改动前一致（回归）。

## 9. 不做 / 后续

- 不做：上传页向导调整；提纲工作台步骤化；数据层新增 `overview`；删除历史 key；清理 `events`/`timePoints` 的 prompt 约束（`ark-llm-provider.ts:414`、`mock-llm-provider.ts:20-42` 保持现状，空数组不生效）。
- 后续：数据层加 `overview` 后把双写收敛为单写 `overview`（见 §4 决策记录）。

## 10. 风险

- 双写语义重叠：`researchFocus` 与 `notes` 同值，详情/导出可能出现两处相似文案；过渡期接受。
- 200 字截断：prompt 的 Research focus 只拿前 200 字（见 §4）。
- 生成质量：events/timePoints 不再结构化，prompt「每条须单独成节」约束失效，属预期。
- 断言维护：4 个 tmp 脚本依赖旧 id/文案，须同步更新，否则验收脚本变红。