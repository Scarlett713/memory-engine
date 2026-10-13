# REQ-25 稿件导出重构（成文稿 `.docx` 按 08 表 2 排版）· PRD

> **编号已裁决（2026-10-06，登记表 v2.2 变更记录）**：本条取 **REQ-25**（REQ-22 / REQ-23 / REQ-24 已占用，REQ-25 全表空闲）。编号与格式规范此前由 `docs/系统现状与路线图.md` §5.4（`:227`）/ §10-①（`:274`）**代管**，本 PRD 为**首次正式落字**，同批补登《需求登记表》§三（v2.11）。
> 本轮**只出文档**：不改 `src/**`、不改 `tmp/**`、不产生 commit。

- **文档定位**：产品口径文档（PRD）。代码改动计划另立 `docs/tasks/IMPL_REQ-25_稿件导出重构.md`。
- **依据**：08 号文件《访谈提纲与成文稿格式要求》**表 2**（外置 `D:\Users\25425\Documents\SHSE-Cup\midterm\1.内容\08_访谈提纲与成文稿格式要求(1).docx`，本次逐字实读）；`src/lib/server/project-export.ts`（**516 行**，HEAD `82b6221` 实测）；`docs/需求登记表.md`（**v2.10 基线 → 本批升 v2.11 补登本条**）；**总管九条裁决（2026-10-13）**。
- **状态**：PRD 定稿（待总管审批）。
- **来源**：产品方（总管）2026-10-13 九条裁决；上游触发 = **UI-27**（`a71bbfb` / `b63ed37`，2026-10-08）已把 **08 表 1**（访谈提纲）面收敛为四段式，**表 2**（访谈成文稿）面尚未落地。
- **优先级**：P1（成文稿是交付主产物，导出即最终交付物）。
- **落点**：`src/lib/server/project-export.ts`（主战场）、`src/lib/providers/llm/mock-llm-provider.ts`（mock 五章）、`src/components/projects/project-export-panel.tsx` 与 `src/components/projects/project-processing-console.tsx`（两处出口文案）。
- **关联**：UI-27（08 表 1 ↔ 表 2 分工）、UI-23（未涉及章节口径）、REQ-28（文案伞 / P-4）、REQ-20（PDF 导出）、REQ-14（写作规则与五章骨架）、BUG-05（导出脱敏回归）、BUG-08（时间口径）。
- **硬约束摘要**：不动 `src/lib/writing-rules.ts`、不动脱敏链路（`applyRedactionProfile` / 审校门禁）、不动 `json` / `txt` 结构、不引 npm 包、不改 `export/route.ts` 的门禁与状态置位。

## 0. 一句话概述

把 `.docx` 导出从「全量档案包」（主标题 + 副标题 + 11 行元数据表 + 7 个内部章节段）重构为**单篇成文稿**：按 08 表 2 的**六要素**排版（宋体 / 三号 ~ 五号 / 两端对齐 / 固定值 20 磅 / 首行缩进 2 字符 / 页脚页码「—N—」），正文取人工定稿 `manualDraft`，元数据改为**两行文字**，小标题**去序号并居中**，空章节**跳过**；`json` / `txt` 与导出门禁**零变化**。

## 1. 背景

### 1.1 现状实测（HEAD `82b6221`，工作区 clean）

`.docx` 现有正文顺序（`project-export.ts:307-370`）：

| # | 段 | 行号 | 08 表 2 是否列此要素 |
| --- | --- | --- | --- |
| 1 | 主标题 `${projectName} 档案整理稿`（`bold` / `size: 34` / 居中） | `:308-318` | ✅ 列了，但**属性全不符**（非宋体 / 非三号 / 无 1.5 倍行距） |
| 2 | 副标题「记忆引擎 · 口述历史结构化成果导出」（斜体居中） | `:319-328` | ❌ 表 2 无此要素 |
| 3 | 11 行元数据表（项目名称 / 受访对象 / 整理机构 / 口述场景 / 研究焦点 / 保密级别 / 采集路径 / 脱敏级别 / 脱敏规则 / 建档时间 / 最近更新） | 定义 `:67-123`、调用 `:329` | 应改为**两行文字**（裁决 2） |
| 4 | AI 智能采集辅助 | `:330-334` | ❌ 内部产物 |
| 5 | 访谈提纲草稿 | `:335` | ❌ 内部产物（Q3 明确「不含提纲」） |
| 6 | 口述摘要 | `:336` | ❌ 内部产物 |
| 7 | 结构化档案内容 | `:337-344` | ❌ 内部产物 |
| 8 | 要素标引 | `:345-353` | ❌ 内部产物 |
| 9 | 情绪提示（含「建议：{guidance}」） | `:354-362` | ❌ 内部产物 |
| 10 | 隐私脱敏说明 | `:363-368` | ❌ 内部产物 |
| 11 | 脱敏整理稿（取 `redactedAiDraft`） | `:369` | 应取**成文稿**（裁决 1） |

排版事实（同一文件）：默认样式 `font: "Arial", size: 22`（`:411-420`）；正文一律 `AlignmentType.LEFT`（`:58` / `:220`）；`spacing` 只给 `after`（**无 `line` / `lineRule`**）；无首行缩进；`Footer` / `PageNumber` **全文件 0 命中**；小标题走 `HeadingLevel.HEADING_2` 样式（`:125-134`），非居中、非四号。

### 1.2 三处口径缺口

1. **表 2 从未被任何代码引用** —— 08 号文件在代码中只以**表 1** 身份出现（`mock-llm-provider.ts:43`、`ark-llm-provider.ts:251-252`），排版层是**纯新增面**。
2. **导出稿含 7 个内部章节**（上表 4 ~ 10 项）—— 与「只下载成文稿」的产品口径不符：用户拿到的是「档案包」而不是交付物。
3. **UI-27 的已知副作用尚未清理** —— `createMarkdownParagraphs` 的 `- ` / `1. ` 编号分支（`:186-216`）自 2026-10-08 起**失去生成侧输入**（提纲已改字面「1、」），登记表 v2.8 与 §三 UI-27 均标注「须与 REQ-25 一并处理」。

### 1.3 已确认的产品方向（总管九条裁决，2026-10-13，逐字）

| # | 开口项 | 裁决（逐字） |
| --- | --- | --- |
| 1 | 成文稿取值 | 取 `manualDraft`。用户在审校页编辑的是 `manualDraft`，这才是人工定稿，导出给用户的应该是最终确认版，不是中间产物 `redactedAiDraft`。 |
| 2 | 两行文字模板 | 第一行（访谈对象简介）：`{受访对象姓名}，{项目名称} 受访者。`；第二行（信息行）：`采集时间：{建档时间} \| 整理机构：{整理机构} \| 保密级别：{保密级别}`。字段取现有 payload 中的对应值；字段缺失时写「待补」，不留空。`建档时间` 沿用 BUG-08 口径（`formatDateTime` 钉 `Asia/Shanghai`）。原 11 行元数据表**整体删除**，两行文字替代。 |
| 3 | 小标题去序号 | **只在导出层剥离**，不动 `writing-rules.ts`（REQ-14 常量被探针锁住）。导出层正则：`replace(/^[一二三四五六七八九十]+、\s*/, '')`，剥离后居中显示。 |
| 4 | 空章节 | **导出层跳过空章节**（与 UI-23「整理稿隐藏未涉及章节」保持一致）。`writing-rules.ts:186` 的「保留标题 + 本节未涉及」是 LLM 生成侧口径，导出侧另行过滤，两层各自独立，不冲突。 |
| 5 | 图片说明 | **本期 N/A**，在任务单里标注「表 2 已列、数据源缺失、留 REQ-N 另批」，不实现，不留占位代码。 |
| 6 | mock 五章 | **同批补**。改动目标 `mock-llm-provider.ts:230-234`：`aiDraft` 改为五章结构（带「一、…五、」标题 + 各章 2-3 句示例正文）；`structuredSections` headings 同步改为五章标题。 |
| 7 | 出口文案 | 按钮文案「导出 Word 档案稿」→「**导出成文稿**」（两处同改：`project-export-panel.tsx:23` + `project-processing-console.tsx:1169`）；`panel:125` 说明文案改为「下载 Word 格式成文稿（.docx）」，删去 txt/json 格式说明；json/txt 格式**保持现有行为不改**。 |
| 8 | json/txt | **本批不动**（改 json/txt 会红 `bug05-redaction.ts`）。Q3「只下载成文稿」指 **UI 层面只暴露 docx 下载按钮**，json/txt 保留在代码里供调试 / 归档用，不在 UI 上暴露即可。 |
| 9 | BUG-08 / 保密级别 | `建档时间` 移入信息行；`最近更新` 本批**不在信息行显示**（信息行只三字段）；`保密级别` 保留在信息行第二行；文档锚点（`需求登记表.md:542` / `:776`，后者属 **UI-14 资料可见范围**条目）随 REQ-25 同批更新为「已随 REQ-25 重构，原行号失效」。**注意**：该两处行号按 **v2.10 基线**记录，登记表升 v2.11 补登本条后同区域实测为 **`:598` / `:832`**（+56 行）—— 回写时请用 `Select-String` 按文本定位。 |

### 1.4 为什么现在做

- 成文稿是**最终交付物**。当前导出稿把提纲、摘要、要素标引、情绪提示、脱敏说明一并塞给用户 —— 既暴露内部产物，也与登记表 §1.0「成文稿才是交付物」的分层方向相反。
- 表 2 是外置基准文件里**已经写好**的规范，落地成本集中在 1 个文件的 docx 装配段（`:288-425`），属「口径已定、只差实施」。
- UI-27 的编号分支死代码（`:186-216`）挂在同一函数上，**同批清理**最省事，越晚做越容易与后续探针纠缠。

## 2. 目标与非目标

**目标**

- **G1 交付物单一**：`.docx` 只含**成文稿**（主标题 + 简介行 + 信息行 + 章节正文 + 页码），不含提纲 / 摘要 / 要素标引 / 情绪提示 / 脱敏说明等内部产物。
- **G2 版式合规**：表 2 六要素逐项落地（字体 / 字号 / 对齐 / 行距 / 缩进 / 页码）。
- **G3 文案口径统一**：UI 两处入口改「导出成文稿」；UI 只暴露 docx 下载（裁决 8）。
- **G4 零回归**：`json` / `txt` 结构与内容零变化；导出门禁（`countPendingSensitiveMarks`）与状态置位（`ready_to_export`）零变化；脱敏链路零变化。

**非目标**

- 不做 PDF 导出（属 REQ-20）。
- 不做图片说明（裁决 5：本期 N/A）。
- 不改生成侧 prompt / 写作规则（`src/lib/writing-rules.ts` 零 diff）。
- 不改 `json` / `txt` 两种格式的输出结构（裁决 8）。
- 不做封面、目录、页眉、修订记录（表 2 未列）。

## 3. 范围

### 3.1 改（本条交付面）

| 面 | 改动 |
| --- | --- |
| `project-export.ts` | `buildDocx` 装配段整体重写为表 2 版式（六要素 + 页脚页码 + 默认样式）；删除 4 个死函数（`createMetadataRows` / `createParagraphs` / `stripMarkdownInline` / `createMarkdownParagraphs`）、7 个内部章节段、numbering 配置 |
| `mock-llm-provider.ts` | `aiDraft` 改五章结构；`structuredSections` headings 改五章标题（去序号） |
| `project-export-panel.tsx` | 按钮文案 →「导出成文稿」；说明文案改单格式；UI 只暴露 docx |
| `project-processing-console.tsx` | 按钮文案 →「导出成文稿 (.docx)」；UI 只暴露 docx |
| 探针 | **新增** `tmp/verify-req25-export-format.mjs`（解 docx XML 断言表 2 六要素 + 页码）；**回归** `tmp/verify/bug05-redaction.ts`（json/txt 不动 ⇒ 应全绿） |
| 文档 | 本文；`docs/tasks/IMPL_REQ-25_稿件导出重构.md`；`docs/需求登记表.md` v2.11（§1.2 / §三 / §5.1 / §5.2 + 变更记录） |

### 3.2 不改（回归红线）

- **`src/lib/writing-rules.ts`**（整文件）—— REQ-14 常量被 `tmp/verify/verify-req14-prompts.ts`（`:131-165`）锁住；去序号只在导出层做（裁决 3）。
- **`json` / `txt` 输出**：`buildArchivePayload`（`:252-286`）与 `buildTxt`（`:427-486`）**零 diff**；docx 也不经 `buildArchivePayload` 取正文（避免顺带改动 json/txt 结构，见 §4.1）。
- **脱敏链路**：`buildRedactedSegmentText`（`:240-250`）、`applyRedactionProfile` 调用点、审校门禁 `countPendingSensitiveMarks`。
- **`src/app/api/projects/[projectId]/export/route.ts`**：鉴权 / 归属 / 门禁（`:60-79`）/ 状态置位（`:84-90`）/ `Content-Type` / `Content-Disposition` 全部不动。
- **数据层**：`src/lib/types/project.ts`、`src/lib/server/project-store.ts`；**不新增字段**（成文稿取值复用既有 `manualDraft`，`types/project.ts:200`）。
- **`src/lib/providers/llm/ark-llm-provider.ts`**：生成侧 prompt 零改动（五章骨架的**生成侧**口径归 REQ-14）。
- **`project-export-panel.tsx` / `console.tsx` 的逻辑**：`handleExport`、`canExport`、情绪二次确认、下载与文件名解析逐字不动（只动文案与按钮集合）。
- 除新增的 1 支探针外，`tmp/**` 全部零改动（`tmp/` 被 `.gitignore` 屏蔽、不入 commit）。

### 3.3 与相邻需求的口径边界

- **UI-27（已完成）**：其**表 1**（提纲）面已收敛为四段式；本条承接其**表 2**（成文稿）面，并清理其登记在案的导出侧副作用（`:186-216`）。UI-27 的生成侧 prompt 与 mock 提纲部分**本批零改动**。
- **UI-23（候选）**：「整理稿隐藏未涉及章节」为 **Web 侧**口径，本条为**导出侧**口径；两层**各自实现、判据同源**（§4.5），互不替代 —— 本条不把 UI-23 判为完成。
- **REQ-28 / P-4（术语）**：导出侧键名「保密级别」等**保持现状**（登记表 **UI-14 资料可见范围**条目 `:776`（v2.11 实测 `:832`）已裁键名口径）；「脱敏 → 隐私处理」的收口**不在本条**。
- **REQ-20（PDF）**：本条不实现 PDF；登记表 §1.0「导出 PDF = 付费能力」的分层不受影响。
- **REQ-14（写作规则）**：五章骨架的**生成侧**约束（`writing-rules.ts:183-186`、`:188-189`）继续有效；本条只在**导出层**做去序号与空章节过滤（裁决 3 / 4）。

## 4. 功能规格

### 4.1 成文稿正文取值与章节拆分

- **取值**：`project.manualDraft`（trim 后非空）；为空则回退 `project.redactedAiDraft`；两者皆空则正文写空态「暂无成文稿。」（**D-25-2** / **P-25-4**）。取值**不走** `buildArchivePayload`（避免顺带影响 json/txt，见 §3.2）。
- **章节拆分**：按行扫描成文稿；行匹配 `/^[一二三四五六七八九十]+、\s*\S/` 者为**小标题行**（其文本即章标题），其后至下一小标题之间的非空行为该章正文。
- **无章节标题时**：全文按普通正文段落逐行输出（**不产出小标题、不报错、不造标题**）。
- **小标题之前的非空行**（引子）：作为**独立正文段**排在第一小标题之前，保留内容、不回填、不丢弃（**D-25-1**）。

### 4.2 表 2 六要素 → docx 参数映射

表 2 原文（08 号文件逐字）：主标题＝宋体+加粗 / 三号 / 居中 / 1.5倍 / —；访谈对象简介＝宋体 / 小四 / 两端对齐 / 固定值20磅 / 首行缩进2字符；信息行＝同上；小标题＝宋体+加粗 / 四号 / 居中 / 1.5倍 / **无序号**；正文＝宋体 / 小四 / 两端对齐 / 固定值20磅 / 首行缩进2字符；图片说明＝宋体 / 五号 / 居中 / 固定值20磅 / —；页码＝宋体 / 四号 / 页脚居中 / — /「—N—」。

| 要素 | docx 参数（`docx@^9.6.1`） |
| --- | --- |
| 主标题 | `alignment: CENTER`；`TextRun({ bold: true, size: 32, font: 宋体 })`；`spacing: { line: 360, lineRule: LineRuleType.AUTO }` |
| 访谈对象简介 | `alignment: BOTH`；`TextRun({ size: 24, font: 宋体 })`；`spacing: { line: 400, lineRule: LineRuleType.EXACT }`；`indent: { firstLine: 480 }` |
| 信息行 | 同上 |
| 小标题 | `alignment: CENTER`；`TextRun({ bold: true, size: 28, font: 宋体 })`；`spacing: { line: 360, lineRule: AUTO }`；文本＝去序号后的章标题 |
| 正文 | `alignment: BOTH`；`TextRun({ size: 24, font: 宋体 })`；`spacing: { line: 400, lineRule: EXACT }`；`indent: { firstLine: 480 }` |
| 图片说明 | **本期 N/A**（裁决 5）：不实现、不留占位代码 |
| 页码 | `sections[0].footers.default`；`Footer` 内 `Paragraph({ alignment: CENTER })`；`TextRun({ children: ["—", PageNumber.CURRENT, "—"], size: 28, font: 宋体 })` |

**磅值换算（供实施直接取用，避免二次换算）**：三号 = 16pt = `size: 32`；四号 = 14pt = `size: 28`；小四 = 12pt = `size: 24`；五号 = 10.5pt = `size: 21`。固定值 20 磅 = `line: 400`（`EXACT` 下单位为 1/20 磅）；1.5 倍 = `line: 360`（`AUTO` 下单位为 1/240 行）；首行缩进 2 字符（小四）= `firstLine: 480`（twips）。

**字体写法**：表 2 只写「宋体」，故 `font` 的四个键（`ascii` / `eastAsia` / `hAnsi` / `cs`）统一取 `"宋体"`，避免 Word 端中西文回退到 Arial（现状 `:415` 即 `Arial`）。文档默认样式同步改 `{ font: 宋体, size: 24 }`。

**段后距**：表 2 未规定 ⇒ **一律不设** `spacing.after`（**D-25-4** / **P-25-5**；若产品方要段间距须另给数值）。

### 4.3 两行文字（访谈对象简介 + 信息行）

按裁决 2 的模板**逐字执行，只替换占位符**；任何字段缺失统一写「待补」（不留空、不省略整句）：

| 行 | 逐字模板 | 取值 | 缺失时 |
| --- | --- | --- | --- |
| 第一行 | `{受访对象姓名}，{项目名称} 受访者。` | `project.intervieweeName` / `project.projectName` | 「待补」 |
| 第二行 | `采集时间：{建档时间} \| 整理机构：{整理机构} \| 保密级别：{保密级别}` | `formatDateTime(project.createdAt)` / `project.institutionName` / `getConfidentialityLevelLabel(project.confidentialityLevel)` | 「待补」 |

- `最近更新`（`project.updatedAt`）**不在信息行显示**（裁决 9）；其 docx 展示面随元数据表删除而消失。BUG-08 的时区修复保留在 `src/lib/utils.ts:9-12`，其余三处调用不受影响。
- 分隔符为**半角竖线 + 两侧各一空格**（` | `），全行**单段**输出（不换行、不拆段）。

### 4.4 小标题去序号与居中

- 正则按裁决 3 逐字：`replace(/^[一二三四五六七八九十]+、\s*/, "")`，**只剥离行首**的「中文数字 + 、」（含「、」后可能存在的空格）。
- 剥离**只作用于小标题段**，不触碰正文。
- 标题**本无序号**时（历史数据 / mock 的「访谈信息」式标题）正则不匹配，**原样输出**（不补序号）。
- 其它编号形态（如「第 1 章」「1.」）**不处理**（最小干预）。

### 4.5 空章节跳过

- **跳过条件**（二者之一）：① 该章正文 trim 后为空；② 该章正文 trim 后等于生成侧占位句「本节内容在本次访谈中未涉及」。
- 命中时**小标题与正文都不输出**；若全部章节被跳过或整篇无正文段 ⇒ 正文落空态「暂无成文稿。」（**P-25-4**）。
- **与 UI-23 的关系**：同源判据、各自实现（UI-23 在 Web 侧隐藏、本条在导出侧过滤）；UI-23 实施时须与本条判据逐字对齐。

### 4.6 页脚页码

- 单 section 页脚（`footers.default`），内容为居中一行「—N—」，其中 `N` 为 `PageNumber.CURRENT`（Word 域），字体宋体、四号（`size: 28`）。
- 页面参数保持现状（A4 `11906 × 16838`、四边 `1440`，`:293-305`），本条不动。

### 4.7 图片说明（本期 N/A）

- 表 2 已列「图片说明」，但**数据源缺失**（`ProjectRecord` 无图片字段、docx 装配面未 import `ImageRun`）⇒ **不实现、不留占位代码**，登记为「留 REQ-N 另批」（裁决 5）。
- 验收侧以**负向断言**兜底：`word/document.xml` 不含 `<w:drawing>` / `<w:pict>`。

### 4.8 出口文案与 UI 暴露面

| 位置 | 现状（逐字） | 目标（逐字） |
| --- | --- | --- |
| `project-export-panel.tsx:23` | `label: "导出 Word 档案稿",` | `label: "导出成文稿",` |
| `project-export-panel.tsx:125` | `支持 \`.docx\`、\`.txt\` 和结构化 \`.json\` 三种导出格式。` | `下载 Word 格式成文稿（.docx）` |
| `project-processing-console.tsx:1169` | `docx: '导出 Word 档案稿 (.docx)'` | `docx: '导出成文稿 (.docx)'` |
| UI 按钮集合 | `panel` 渲染 3 个按钮（docx/txt/json）；`console` 渲染 3 个按钮（`['docx','txt','json']`） | **只渲染 docx 按钮**（裁决 8；`txt` / `json` 的 label 常量与 `handleExport` 分支**保留在代码里**供调试 / 归档） |

- **接口层不变**：`GET /api/projects/{id}/export?format=docx|txt|json` 三种格式**继续可用**（裁决 8），仅 UI 不再暴露 `txt` / `json` 入口。
- 文件名规则不变（`${sanitizeFileName(projectName)}-archive.docx`，`:514`）；若需改「成文稿」字样须另裁（**P-25-3**）。

## 5. 技术约束（硬约束，实施与审查共同适用）

1. **不引 npm 包**：探针需要解 `.docx`（zip）时，用 `node:zlib` 的最小 ZIP 读取实现，不装 `jszip` / `fflate`。
2. **单文件行尾**：`src/**` 为纯 LF；改动时**禁止**把 `\n` 归一为 `\r\n`（否则整份 diff，复核失效）。
3. **交付面纪律**：`git diff --stat` 只应出现 §10 列的 **4 个生产文件**（+ 文档；`tmp/**` 被 `.gitignore` 屏蔽、不入 commit）。
4. **不改 route**：`export/route.ts` 的门禁、状态置位、响应头零 diff。
5. **不改数据层**：不新增 / 不改 `ProjectRecord` 字段；成文稿取值复用既有 `manualDraft`（`types/project.ts:200`）。
6. **不改生成侧**：`writing-rules.ts`、`ark-llm-provider.ts` 零 diff。
7. **脱敏不放松**：手工编辑过的 `manualDraft` 仍受**审校门禁**约束（敏感标记全部确认才可导出）；本条不引入任何绕过门禁的通路。

## 6. 验证规格

### 6.1 新增探针（出口证据主件）

`tmp/verify-req25-export-format.mjs`（Node ≥ 22，`node --import ./tmp/verify/register-alias.mjs` 起）：构造**确定可复现**的成文稿 fixture（含 5 章：4 章有内容 + 1 章为空章节），调用 `createProjectExport(project, "docx")`，解 zip 后对 `word/document.xml` 与 `word/footer1.xml` 逐项断言表 2 六要素与负向条件（**≥ 20 条**，清单见 IMPL §3.1）。

### 6.2 回归探针

`tmp/verify/bug05-redaction.ts`（现有，**只跑不改**）：`json` 四要素字段无原文泄露 / 含占位符、`txt` 情绪等级中文化 —— 本条不动 json/txt ⇒ **应全绿**。

### 6.3 静态检查与交付面

`npx tsc --noEmit` 0 error；`npx eslint` 0 problem；`git diff --stat` 恰好 4 个 `src/**` 文件（§10）。

### 6.4 人工测试（M1 ~ M3）

- **M1**：审校完成 → 详情页点「导出成文稿」→ 打开 `.docx`，目视核对主标题 / 两行文字 / 小标题居中无序号 / 正文排版 / 页脚「—N—」。
- **M2**：在审校页手工修改成文稿（加一章、删一章文字）→ 再导出，导出稿与手工版**一致**（验证取 `manualDraft`）。
- **M3**：处理台状态 `ready_to_export` 时，该处 UI 只出现**一个**导出按钮。

## 7. 边界（本条不做）

- 不做 PDF（REQ-20）、不做图片说明（裁决 5）、不做封面 / 目录 / 页眉 / 修订记录。
- 不改 `json` / `txt` 结构与其 API 可用性（裁决 8）、不改文件名规则。
- 不改生成侧 prompt 与写作规则（裁决 3）；不改 mock 的提纲生成部分（UI-27 已定稿）。
- 不把 UI-23 判为完成（UI-23 是 Web 侧条目，本条只保证判据同源）。
- 不做 `manualDraft` 的编辑体验改造（审校页本轮零改动）。

## 8. 风险

| # | 风险 | 对策 |
| --- | --- | --- |
| ① | **导出与演示分叉**：mock 不产五章 ⇒ 演示链路看不到表 2 效果 | 裁决 6 同批补 mock 五章；mock 的 `keywords` / `timelineEvents` / `emotionalSignals` / `summary` **逐字不动**，否则 `bug05-redaction.ts` 必红（见 IMPL §0.6-②） |
| ② | **改 mock `aiDraft` 打断 BUG-05 语义**：`bug05` 依赖「敏感串逐字出现在 mock 自身 aiDraft / summary」 | 五章正文**必须保留「老城厢」**（IMPL §0.6-①） |
| ③ | **手工编辑可能重新引入敏感内容** | 不放松门禁：标记未全部确认则导出被拒（现状语义保持）；本条不新增绕过通路 |
| ④ | **取 `manualDraft` 后，`manualDraft` 为空的老项目导出空白** | 回退链 `manualDraft → redactedAiDraft → 「暂无成文稿。」`（D-25-2） |
| ⑤ | **固定值 20 磅 + 首行缩进在 Word / WPS / LibreOffice 渲染差异** | 断言只校验 `w:line` / `w:lineRule` / `w:ind` 的 XML 属性，不做像素级比对；人工测试 M1 兜底 |
| ⑥ | **`json` / `txt` 误改** | `buildArchivePayload` / `buildTxt` 列入禁改面 + `bug05-redaction.ts` 回归 |
| ⑦ | **文档行锚点漂移** | 实施轮同批更新登记表 `:542` / `:776`（裁决 9；后者属 UI-14 条目）、`docs/tasks/IMPL_REQ-28-E_项目详情页文案与UI-08-17.md` 的行锚点引用（`:245` / `:440` / `:489` / `:640`）与 `docs/PRD_REQ-14_AI辅助访谈.md:28`（其 `project-export.ts:359` 落在本批删除段内，`:474` 在 `txt` 侧保留）——清单见 IMPL §6.2。**行号基线**：上述登记表锚点为 **v2.10** 基线，登记表升 v2.11 补登本条后整体 **+56 行**（`:542/:546/:776/:958` → `:598/:602/:832/:1014`），回写一律按文本 `Select-String` 定位 |

## 9. 待确认（本轮**已按推荐值落入任务单**，供总管追认）

| # | 待确认项 | 推荐值（任务单已按此写） | 影响面 |
| --- | --- | --- | --- |
| P-25-1 | 裁决 8「UI 只暴露 docx」是否即**移除** `txt` / `json` 两个按钮（而不仅是改文案） | **移除 UI 入口、保留代码分支与 API** | `panel` / `console` 各 1 处渲染集合 |
| P-25-2 | 主标题文案是否随口径改「成文稿」字样（现为 `${项目名称} 档案整理稿`） | **保留现文案、只改排版**（未授权改字面）；若改属 1 行 | docx 主标题 |
| P-25-3 | 导出**文件名**是否同步改（现 `{项目名}-archive.docx`） | **不改**（改文件名会扩散到下载约定） | `createProjectExport` 返回值 |
| P-25-4 | 正文空态文案（现「暂无整理稿。」） | 改「**暂无成文稿。**」以与「成文稿」口径一致 | docx 正文空态 |
| P-25-5 | 段后距（表 2 未规定） | **不设**（`spacing.after` 一律不加） | 全篇段落 |
| P-25-6 | 副标题「记忆引擎 · 口述历史结构化成果导出」是否随重构删除 | **删除**（表 2 无此要素；REQ-28 已把「记忆引擎」眉标从界面清理，导出产物保留会与之打架） | docx 副标题 |

## 10. 涉及文件清单

**生产代码（4 个）**

| 文件 | 行数（HEAD `82b6221`） | 改动性质 |
| --- | --- | --- |
| `src/lib/server/project-export.ts` | 516 | docx 装配段重写 + 死代码删除（主战场） |
| `src/lib/providers/llm/mock-llm-provider.ts` | 329 | `aiDraft` 五章 + `structuredSections` headings |
| `src/components/projects/project-export-panel.tsx` | 167 | 文案 + UI 暴露面 |
| `src/components/projects/project-processing-console.tsx` | 1319 | 文案 + UI 暴露面 |

**探针（`tmp/`，被 `.gitignore` 屏蔽、不入 commit）**

| 文件 | 性质 |
| --- | --- |
| `tmp/verify-req25-export-format.mjs` | **新增**（出口证据主件） |
| `tmp/verify/bug05-redaction.ts` | 回归，**零改动** |

**文档（3 个）**：本文、`docs/tasks/IMPL_REQ-25_稿件导出重构.md`、`docs/需求登记表.md`（v2.11）。

## 11. 裁决 → 章节对照（可追溯）

| 裁决 | 落点 |
| --- | --- |
| 1 成文稿取 `manualDraft` | §4.1、§3.2 |
| 2 两行文字模板 | §4.3（逐字模板 + 取值表）、§4.2（排版参数） |
| 3 导出层去序号 | §4.4、§3.2（`writing-rules.ts` 红线） |
| 4 跳过空章节 | §4.5、§3.3（与 UI-23 边界） |
| 5 图片说明 N/A | §4.7、§7 |
| 6 mock 五章 | §8-① / ②、§10 |
| 7 出口文案 | §4.8 |
| 8 json/txt 不动 | §4.8、§3.2、§6.2 |
| 9 建档时间 / 保密级别 / 文档锚点 | §4.3、§8-⑦ |

