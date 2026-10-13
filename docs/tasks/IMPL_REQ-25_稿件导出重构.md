# REQ-25 实施任务单 · 稿件导出重构（成文稿 `.docx` 按 08 表 2 排版）

> 上游产品口径：`docs/PRD_REQ-25_稿件导出重构.md`（PRD，本轮同批落盘）。本单只写**计划**：不改代码、不产生 commit；实施轮按 §1 改 `src/**`，`tmp/**` **仅新增 1 支探针**（`tmp/verify-req25-export-format.mjs`），其余探针**零改动**。
> - **规模**：生产代码 **4 个文件**（`project-export.ts` 主战场 ＋ `mock-llm-provider.ts` ＋ 2 个出口文案文件）；**删除** 6 个函数 / 7 个章节段 / 1 套 numbering 配置 / 7 项 imports；**新增** 7 个常量 + 1 组段落工厂 + 1 个页脚；**净行数预估 −150 ~ −200**（主战场「删多增少」）。
> - **探针**：新增 1 支（**出口证据主件**，解 `.docx` 的 `word/document.xml` + `word/footer1.xml`）；回归 1 支（`tmp/verify/bug05-redaction.ts`，本单**零改动**）；**经实测，`tmp/**` 全域无任何脚本断言导出 UI 文案或 docx 内容**（§3.3）⇒ 除新增支外零连带。
> - **行号基线**：2026-10-13 实测，HEAD = `82b6221`（`master` = `origin/master`，工作区 clean）→ **实施前须复核行号**（口径见 §0.2-②）。
> - **红线**：不动 `src/lib/writing-rules.ts`、不动脱敏链路、不动 `json` / `txt` 结构、不动 `export/route.ts`（§0.3）。
> - **状态**：**已验收（2026-10-13）**（验收来源：总管 2026-10-13 回执 / 产品方实机导出确认；回归基线：`tmp/verify-req25-export-format.mjs` **28 / 28**，Cline 本批复跑）。
> - **后续（2026-10-13，BUG-13 实施轮）**：该探针随 **BUG-13**（小标题段前 / 段后间距修复）**追加 D-9 / D-10 / D-11** 三条 ⇒ **本节所记「28 条」的口径已扩至 31 条**（既有 28 条**零改动**，本机复跑 31 PASS / 0 FAIL / exit 0），见 `docs/tasks/IMPL_BUG-13_小标题间距修复.md` §1.2 / §3 / §5.2-②。**本单结论与验收基线不变**，仅计数随批前移。

---

## §0 口径说明

### 0.1 九条裁决（总管 2026-10-13，逐字落入）

| # | 开口项 | 裁决（逐字） | 本单落点 |
| --- | --- | --- | --- |
| 1 | 成文稿取值 | 取 `manualDraft`。用户在审校页编辑的是 `manualDraft`，这才是人工定稿，导出给用户的应该是最终确认版，不是中间产物 `redactedAiDraft`。 | §1.2-①、§2.5 |
| 2 | 两行文字模板 | 第一行（访谈对象简介）：`{受访对象姓名}，「{项目名称}」受访者。`；第二行（信息行）：`采集时间：{建档时间} \| 整理机构：{整理机构} \| 保密级别：{保密级别}`。字段取现有 payload 中的对应值；字段缺失时写「待补」，不留空。`建档时间` 沿用 BUG-08 口径（`formatDateTime` 钉 `Asia/Shanghai`）。原 11 行元数据表**整体删除**，两行文字替代。 | §1.1-①（删）、§2.3（增） |
| 3 | 小标题去序号 | **只在导出层剥离**，不动 `writing-rules.ts`（REQ-14 常量被探针锁住）。导出层正则：`replace(/^[一二三四五六七八九十]+、\s*/, '')`，剥离后居中显示。 | §2.4、§0.3-① |
| 4 | 空章节 | **导出层跳过空章节**（与 UI-23「整理稿隐藏未涉及章节」保持一致）。`writing-rules.ts:186` 的「保留标题 + 本节未涉及」是 LLM 生成侧口径，导出侧另行过滤，两层各自独立，不冲突。 | §2.4、§3.1-C |
| 5 | 图片说明 | **本期 N/A**，在任务单里标注「表 2 已列、数据源缺失、留 REQ-N 另批」，不实现，不留占位代码。 | §0.3-⑤、§3.1-D |
| 6 | mock 五章 | **同批补**。改动目标 `mock-llm-provider.ts:230-234`：`aiDraft` 改为五章结构（带「一、…五、」标题 + 各章 2-3 句示例正文）；`structuredSections` headings 同步改为五章标题。 | §1.3、§2.6 |
| 7 | 出口文案 | 按钮文案「导出 Word 档案稿」→「**导出成文稿**」（两处同改：`project-export-panel.tsx:23` + `project-processing-console.tsx:1169`）；`panel:125` 说明文案改为「下载 Word 格式成文稿（.docx）」，删去 txt/json 格式说明；json/txt 格式**保持现有行为不改**。 | §1.4、§1.5、§2.7 |
| 8 | json/txt | **本批不动**（改 json/txt 会红 `bug05-redaction.ts`）。Q3「只下载成文稿」指 **UI 层面只暴露 docx 下载按钮**，json/txt 保留在代码里供调试 / 归档用，不在 UI 上暴露即可。 | §0.3-②、§1.4-②、§1.5-② |
| 9 | BUG-08 / 保密级别 | `建档时间` 移入信息行；`最近更新` 本批**不在信息行显示**（信息行只三字段）；`保密级别` 保留在信息行第二行；文档锚点（`需求登记表.md:542` / `:776`，后者属 **UI-14 资料可见范围**条目）随 REQ-25 同批更新为「已随 REQ-25 重构，原行号失效」。 | §2.3、§6.2（文档回写清单） |

### 0.2 三项实施口径（延续 D 单 / E 单结论；本批 4 文件已实测复核）

| # | 口径 | 本批实测（2026-10-13，HEAD `82b6221`） | 纪律 |
| --- | --- | --- | --- |
| ① | 行尾 | 4 个生产文件**全部纯 LF**（CRLF = 0）；`docs/tasks/*.md` 为 CRLF | `src/**` **禁止**把 `\n` 归一为 `\r\n`；本单 CRLF |
| ② | 行号 | 一律 `[IO.File]::ReadAllLines` / `Select-String`；**禁用 `Get-Content`**（PS 5.1 把无 BOM UTF-8 当 GBK 解码 → 行号虚高） | §1 全表行号即此口径产物；改前须复核 |
| ③ | BOM | `project-export.ts` / `mock-llm-provider.ts` / `project-export-panel.tsx` / `project-processing-console.tsx` **均无 BOM** | 逐文件原样保留，**不增不删** |

### 0.3 本批硬边界（禁改清单）

| # | 禁改面 | 依据 |
| --- | --- | --- |
| ① | `src/lib/writing-rules.ts`（整文件） | 裁决 3；其常量被 `tmp/verify/verify-req14-prompts.ts:131-165` 锁定 |
| ② | `buildArchivePayload`（`project-export.ts:252-286`）、`buildTxt`（`:427-486`）、`createProjectExport` 的三格式返回（`:488-516`，**含文件名**） | 裁决 8；`tmp/verify/bug05-redaction.ts` 断言 json/txt 结构与内容 |
| ③ | `buildRedactedSegmentText`（`:240-250`）与 `applyRedactionProfile` 调用点 | 脱敏链路；BUG-05 回归面 |
| ④ | `src/app/api/projects/[projectId]/export/route.ts`（整文件） | 鉴权 / 门禁 / 状态置位 / 响应头不在本条 |
| ⑤ | 图片说明（`ImageRun` / `<w:drawing>`）：**表 2 已列、数据源缺失、留 REQ-N 另批**，不实现、不留占位代码 | 裁决 5 |
| ⑥ | `src/lib/providers/llm/ark-llm-provider.ts`（生成侧 prompt） | 五章骨架的生成侧口径归 REQ-14 |
| ⑦ | `src/lib/types/project.ts`、`src/lib/server/project-store.ts` | 不改数据层（`manualDraft` 已存在于 `:200`） |
| ⑧ | `tmp/**`（**除新增的 `tmp/verify-req25-export-format.mjs` 外全部零改动**；不新建备份目录、不备份旧探针） | 交付面纪律 |
| ⑨ | `handleExport` / `canExport` / 情绪二次确认 / 文件名解析（两个 UI 文件内） | §3.3 实测：无探针依赖，但属未授权改动面 |

### 0.4 五项实现裁决（D-25-1 ~ D-25-5）

| # | 裁决 | 内容 | 理由 |
| --- | --- | --- | --- |
| D-25-1 | 引子保留 | 首个章标题**之前**的非空行 → 作为**独立正文段**排在首个标题前（不丢字、不回填、不丢弃） | 成文稿是交付物，「丢字」是不可接受的缺陷；不为此另立标题 |
| D-25-2 | 取值回退链 | `project.manualDraft.trim()` 非空则用之；否则 `project.redactedAiDraft`；皆空则正文写「暂无成文稿。」 | 裁决 1 取 `manualDraft`；存量项目 / 未手改项目需兼容（`process-project.ts:158-160` 已保证 `manualDraft` 初始化为 `redactedAiDraft`） |
| D-25-3 | 段工厂统一 | 简介行 / 信息行 / 正文三类段落共用同一工厂（宋体 / 小四 / 两端对齐 / 固定值 20 磅 / 首行缩进 2 字符），参数集中在文件头常量 | 表 2 三类要素属性**逐字相同**，避免三处各写一份参数（后续改版只改一处） |
| D-25-4 | 段后距不设 | 全篇不加 `spacing.after`（表 2 未规定） | 不自创参数；固定行距 20 磅本身即提供行间节奏 |
| D-25-5 | UI 只暴露 docx 的实现方式 | **保留** `formatMeta` 三键与 `handleExport` 的三格式签名（供调试 / 归档），**新增渲染白名单常量**（`panel`：`const visibleFormats: ExportFormat[] = ["docx"]`；`console`：`(['docx'] as const)`），渲染处改用白名单 | 裁决 8「保留在代码里、不在 UI 上暴露」；改渲染集合比删常量更小、更可逆，且不动 `handleExport` 逻辑（§0.3-⑨ 禁改面） |

### 0.5 与 PRD 的偏离 · 已追认（2026-10-13，全采推荐值）（P-25-1 ~ P-25-6）

> 本单**已按推荐值写入**，供总管在审批时逐条追认或改判；改判的代价均为 1 ~ 2 行。

| # | 事项 | 本单取值 | PRD |
| --- | --- | --- | --- |
| P-25-1 | 裁决 8 的落地形态：**移除** txt/json 两个 UI 按钮（而不仅改文案） | 移除（D-25-5） | §9 P-25-1 |
| P-25-2 | 主标题文案：保留 `${项目名称} 档案整理稿`，只改排版 | 保留（未授权改字面） | §9 P-25-2 |
| P-25-3 | 导出文件名：保持 `{项目名}-archive.docx` | 保持 | §9 P-25-3 |
| P-25-4 | 正文空态文案：「暂无整理稿。」→「暂无成文稿。」 | 改（与「成文稿」口径一致） | §9 P-25-4 |
| P-25-5 | 段后距：不设 | 不设（D-25-4） | §9 P-25-5 |
| P-25-6 | 副标题「记忆引擎 · 口述历史结构化成果导出」（`:319-328`）：随表 2 重构删除 | 删除（表 2 无此要素；REQ-28 已把「记忆引擎」眉标从界面清理） | §9 P-25-6 |

### 0.6 mock 五章的三条硬约束（改动前必读）

改 `mock-llm-provider.ts` 的 `aiDraft` 会牵动 **BUG-05 探针的语义前提**（`tmp/verify/bug05-redaction.ts` 头部 `:5-7` 明记：mock 把「老城厢」标为敏感片段，而该串同时出现在 `keywords` / `timelineEvents[].title` / `structuredSections[].content` 里）。因此：

| # | 约束 | 依据 |
| --- | --- | --- |
| ① | 五章正文中**必须逐字保留「老城厢」**（`bug05` 的 `SECRET`），保持「标记 → 替换」通道可测 | `bug05:31` / `:104`（mock 内注释「必须逐字出现在本 provider 自己的 aiDraft / summary 中」） |
| ② | `keywords` / `summary` / `emotionalSignals`（含 label「失落与告别」「家庭创伤线索」与 level）/ `timelineEvents` / `sensitiveMarks` **逐字不动** —— 只改 `aiDraft` 与 `structuredSections[].heading`（可选：其 `content` 若改须确保不含新的敏感串） | 同上；`bug05` 断言 txt 的四项字段与情绪等级中文 |
| ③ | 提纲相关部分（`buildOutlineMarkdown` / `buildPlanningQuestions` / 对话注记，`:22-99`）**零改动** | UI-27 已定稿并被多支探针锁定 |

> **登记备查**：`tmp/head-mock-llm-provider.ts` 是 mock 文件的**历史快照副本**（非探针、不被任何脚本 import）。本批改动后它与 `src` 分叉属**预期内**，不得据此判「漂移」或回写快照。

---

## §1 `src/**` 改动清单（逐文件逐行）

> 所有行号为 **HEAD `82b6221` 实测**（`[IO.File]::ReadAllLines` 口径）。`project-export.ts` 内**自下而上**（行号大的先改）以免漂移。**文件级替换预算**：`git diff --stat` 只应出现 §0.2-① 列的 4 个生产文件。

### 1.1 `src/lib/server/project-export.ts` —— 删除清单（516 行 → 约 330 行）

| 行 | 目标 | 说明 |
| --- | --- | --- |
| `:35-65` | `splitParagraphLines` + `createPlainParagraphs` | 仅被 `createParagraphs`（`:132`）与 `createMetadataRows`（`:114`）使用；由新的正文工厂取代（D-25-3） |
| `:67-123` | `createMetadataRows` | 11 行键值表（边框 / 列宽 / `Table` 装配）→ 裁决 2 的**两行文字** |
| `:125-134` | `createParagraphs` | 内部章节段工厂（7 个章节共用） |
| `:136-147` | `stripMarkdownInline` | markdown 行内标记清理，仅被 `createMarkdownParagraphs` 使用 |
| `:149-238` | `createMarkdownParagraphs` | 提纲 markdown 渲染器；其中 **`:186-216` 的两支编号**（`export-bullets` / `export-numbers`）自 **UI-27（2026-10-08）起已无生成侧输入**（登记表 v2.8 / §三 UI-27 留档） |
| `:319-328` | 副标题段「记忆引擎 · 口述历史结构化成果导出」 | 表 2 无此要素（**P-25-6**） |
| `:329` | `createMetadataRows(project)` 调用 | 随函数删除 |
| `:330-369` | 7 个内部章节段 | AI 智能采集辅助 / 访谈提纲草稿 / 口述摘要 / 结构化档案内容 / 要素标引 / 情绪提示 / 隐私脱敏说明 / 脱敏整理稿（共 8 次 `createParagraphs` 调用，含 `createMarkdownParagraphs` 1 次） |
| `:375-410` | `numbering` 配置（两支） | 引用定义已无 `numbering.reference` 使用者 |
| `:2-13` 中的 7 项 | `BorderStyle` / `HeadingLevel` / `LevelFormat` / `Table` / `TableCell` / `TableRow` / `WidthType` | 随上述删除失去引用；**保留** `AlignmentType` / `Document` / `Packer` / `Paragraph` / `TextRun` / `ISectionOptions` |

**保留不动（红线）**：`sanitizeFileName`（`:31-33`）、`buildRedactedSegmentText`（`:240-250`）、`buildArchivePayload`（`:252-286`）、`buildTxt`（`:427-486`）、`createProjectExport`（`:488-516`）。

### 1.2 `src/lib/server/project-export.ts` —— 新增 / 改写清单

| # | 项 | 位置 | 内容 |
| --- | --- | --- | --- |
| ① | **取值改写** | `buildDocx` 首行（原 `:289`） | 删 `const payload = buildArchivePayload(project);`；改取 `manualDraft`（裁决 1 + D-25-2，见 §2.5）。**docx 全链不再引用 `payload`** |
| ② | imports 新增 | `:1-15` | `Footer` / `LineRuleType` / `PageNumber`（3 项） |
| ③ | 常量 7 项 | 文件头 imports 之后 | `SONG_FONT` / `EXACT_20PT` / `LINE_1_5` / `FIRST_LINE_2CHARS` / `SIZE_TITLE=32`·`SIZE_HEADING=28`·`SIZE_BODY=24` / `CHAPTER_INDEX_PATTERN` / `CHAPTER_HEADING_PATTERN` / `EMPTY_SECTION_PLACEHOLDER` / `EMPTY_DRAFT_TEXT`（见 §2.1） |
| ④ | 段落工厂 4 个 | 原 `:35-65` 位置 | `createTitleParagraph` / `createMetadataParagraphs`（两行文字）/ `createBodyParagraphs` / `createHeadingParagraph`（见 §2.2 / §2.3） |
| ⑤ | 章节解析 3 个 | 紧随 ④ | `parseManualDraftChapters` / `stripChapterIndex` / `isChapterEmpty`（见 §2.4） |
| ⑥ | 页脚 1 个 | 紧随 ⑤ | `createFooter`（见 §2.5） |
| ⑦ | `buildDocx` 装配段 | 原 `:288-425` | children 由 11 段 → **3 类**（主标题 / 两行文字 / 章节块）；`footers.default` 挂载；`styles` 默认 run 改宋体 + 小四；`numbering` 整块删除（见 §2.5） |

**表 2 六要素 ↔ 代码常量对照**（参数**只写一遍**，禁止在段落工厂里再写第二份字面）：

| 要素 | 对齐 | 字号 | 行距 | 缩进 | 加粗 | 常量 |
| --- | --- | --- | --- | --- | --- | --- |
| 主标题 | `CENTER` | 三号 `32` | `LINE_1_5`（360 / auto） | — | ✅ | `SIZE_TITLE` |
| 访谈对象简介 | `BOTH` | 小四 `24` | `EXACT_20PT`（400 / exact） | `firstLine 480` | — | `SIZE_BODY` |
| 信息行 | `BOTH` | 小四 `24` | `EXACT_20PT` | `firstLine 480` | — | `SIZE_BODY` |
| 小标题 | `CENTER` | 四号 `28` | `LINE_1_5` | — | ✅ | `SIZE_HEADING` |
| 正文 | `BOTH` | 小四 `24` | `EXACT_20PT` | `firstLine 480` | — | `SIZE_BODY` |
| 图片说明 | —— | —— | —— | —— | —— | **本期 N/A**（裁决 5） |
| 页码 | 页脚 `CENTER` | 四号 `28` | — | — | — | `SIZE_HEADING` |

### 1.3 `src/lib/providers/llm/mock-llm-provider.ts` —— mock 五章（**329 行**）

| 行 | 目标 | 改动 |
| --- | --- | --- |
| `:2-13` | imports | **新增 1 行** `import { resolveWritingTemplate } from "@/lib/writing-rules";`（按其 `@/` 分组插入） |
| `:230-234` | `aiDraft` | 由「3 句平铺」改为**五章结构**：章标题取自 `resolveWritingTemplate({ scenario: input.scenario }).chapters`（带「一、…五、」），章正文取模块常量 `MOCK_CHAPTER_BODIES`（各章 2-3 句），`join("\n\n")`（裁决 6） |
| `:266-281` | `structuredSections` | 3 条 → **5 条**：`heading` = 五章标题**去序号**（`replace(/^[一二三四五六七八九十]+、\s*/, "")`），`content` = 各章摘要句（与 `aiDraft` 同源语义，**不引入新的敏感串**，§0.6-②） |
| 模块常量区 | 新增 `MOCK_CHAPTER_BODIES` | 5 元素 `string[]`，与 `resolveWritingTemplate` 的章节数**一一对应**（见 §2.6） |
| **不动** | `:22-99`（提纲 / 规划问题 / 对话注记、`:43` 的 08 表 1 引用）、`:235-265`（`summary` / `keywords` / `redactionNotes` / `sensitiveMarks` / `emotionalSignals`）、`:282-293`（`timelineEvents`） | UI-27 已定稿 + §0.6 硬约束 |

### 1.4 `src/components/projects/project-export-panel.tsx` —— 文案 + 暴露面（**167 行**）

| 行 | 现状（逐字） | 改为（逐字） |
| --- | --- | --- |
| `:23` | `label: "导出 Word 档案稿",` | `label: "导出成文稿",` |
| `:125` | `支持 \`.docx\`、\`.txt\` 和结构化 \`.json\` 三种导出格式。` | `下载 Word 格式成文稿（.docx）` |
| `:130` | `{(Object.keys(formatMeta) as ExportFormat[]).map((format) => {` | `{visibleFormats.map((format) => {`（**D-25-5**） |
| `:34` 之后（模块常量区） | —— | 新增 `// REQ-25 裁决 8：UI 只暴露成文稿下载；txt / json 保留在代码中供调试与归档。` + `const visibleFormats: ExportFormat[] = ["docx"];` |

**不动**：`:9`（`ExportFormat` 三值联合）、`:15-34`（`formatMeta` 三键，txt/json 文案留档）、`:36-48`、`:50-58`、`:60-113`（`handleExport` 全链）、`:116-127`（「成果导出 / 档案级输出」标题）、`:154-164`。**观察项**：`:119-122` 的 `section-eyebrow`「成果导出」＋ `h3`「档案级输出」与「成文稿」口径的措辞统一属文案批次，见 §6 观察项 O-25-1。

### 1.5 `src/components/projects/project-processing-console.tsx` —— 文案 + 暴露面（**1319 行**）

| 行 | 现状（逐字） | 改为（逐字） |
| --- | --- | --- |
| `:1168` | `{(['docx', 'txt', 'json'] as const).map((fmt) => {` | `{(['docx'] as const).map((fmt) => {`（**D-25-5**） |
| `:1169` | `const labels = { docx: '导出 Word 档案稿 (.docx)', txt: '导出纯文本 (.txt)', json: '导出结构化数据 (.json)' };` | 仅把 `docx` 值改 `'导出成文稿 (.docx)'`，**三键保留**（txt/json 文案留档） |
| `:1178-1180` | `fmt === 'docx' ? '…主按钮样式…' : '…次按钮样式…'` | **不动**（`docx` 恒真，渲染结果一致） |

**不动**：`:876-911`（`handleExport`，含情绪二次确认与文件名解析）、`:1157-1162`（面板外壳与「审校已完成 · 选择格式导出」标题）、`:1164-1166`（`exportError`）、`:1182-1192`。

> **顺带观察 O-25-2**：`:1162` 的「选择格式导出」在按钮只剩一个后语义偏钝 —— 本批**不改**（未授权字面），登 §6。

---

## §2 before / after 代码（可直接粘贴，`project-export.ts`，LF）

### 2.1 imports 与常量（`project-export.ts:1-33` 位置）

```ts
import {
  AlignmentType,
  Document,
  Footer,          // + REQ-25：页脚「—N—」
  LineRuleType,    // + REQ-25：固定值 20 磅 / 1.5 倍行距
  PageNumber,      // + REQ-25：页码域
  Packer,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";
// 已删（7 项）：BorderStyle / HeadingLevel / LevelFormat / Table / TableCell / TableRow / WidthType

// ── 08 表 2 常量：字面只在这里写一遍 ────────────────────────────────────
// 表 2 只写「宋体」，四键同取，避免 Word 端中西文回退到 Arial（旧默认样式是 Arial）。
const SONG_FONT = { ascii: "宋体", eastAsia: "宋体", hAnsi: "宋体", cs: "宋体" };
// 固定值 20 磅（EXACT 下 1 单位 = 1/20 磅）；1.5 倍行距（AUTO 下 1 单位 = 1/240 行）。
const EXACT_20PT = { line: 400, lineRule: LineRuleType.EXACT };
const LINE_1_5 = { line: 360, lineRule: LineRuleType.AUTO };
// 小四（12pt）首行缩进 2 字符 = 24pt = 480 twips。
const FIRST_LINE_2CHARS = { firstLine: 480 };
// 字号（半磅）：三号 32 / 四号 28 / 小四 24。
const SIZE_TITLE = 32;
const SIZE_HEADING = 28;
const SIZE_BODY = 24;

// REQ-25 裁决 3：只在导出层剥离章标题的中文序号前缀（不动 writing-rules.ts 的常量）。
const CHAPTER_INDEX_PATTERN = /^[一二三四五六七八九十]+、\s*/;
// REQ-25 裁决 3 / PRD §4.1：章标题行判据（带序号才算标题，正文里的「一、」不误判）。
const CHAPTER_HEADING_PATTERN = /^[一二三四五六七八九十]+、\s*\S/;
// REQ-25 裁决 4 / PRD §4.5：生成侧空章节占位句（与 writing-rules.ts:186 同口径）。
const EMPTY_SECTION_PLACEHOLDER = "本节内容在本次访谈中未涉及";
// REQ-25 裁决 2：字段缺失统一占位，不留空。
const MISSING_FIELD_PLACEHOLDER = "待补";
// PRD P-25-4：成文稿整体为空时的正文兜底。
const EMPTY_DRAFT_TEXT = "暂无成文稿。";
```

> **imports 复核**：`@/lib/oral-history` 的 6 个 label 函数**全部保留**（`getCollectionPathLabel` 仍用于 `:268`/`:438`、`getConfidentialityLevelLabel` `:265`/`:437`、`getEmotionLevelLabel` `:472`、`getInterviewScenarioDisplayLabel` `:259`/`:435`、`getPrivacyLevelLabel` `:269`/`:439`、`getRedactionRuleLabel` `:270`/`:440`）；`applyRedactionProfile` 保留（`:243`）；`formatDateTime`（`:27`）保留——其在本文件的唯一使用点原为 `:88`/`:89`（元数据表），重构后由 §2.3 的信息行承接。实施后以 `npx eslint` 的未使用变量报错为准复核。

### 2.2 段落工厂（替代 `:35-65` 的 `splitParagraphLines` + `createPlainParagraphs`）

```ts
function createTitleParagraph(project: ProjectRecord) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: LINE_1_5,
    children: [
      new TextRun({
        text: `${project.projectName} 档案整理稿`,
        bold: true,
        size: SIZE_TITLE,
        font: SONG_FONT,
      }),
    ],
  });
}

// 08 表 2 的「访谈对象简介 / 信息行 / 正文」三类要素属性逐字相同 → 共用一个工厂（D-25-3）。
function createStyledParagraph(text: string) {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: EXACT_20PT,
    indent: FIRST_LINE_2CHARS,
    children: [new TextRun({ text, size: SIZE_BODY, font: SONG_FONT })],
  });
}

function createBodyParagraphs(lines: string[]) {
  return lines.map(createStyledParagraph);
}

function createHeadingParagraph(title: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: LINE_1_5,
    children: [
      new TextRun({
        text: stripChapterIndex(title),
        bold: true,
        size: SIZE_HEADING,
        font: SONG_FONT,
      }),
    ],
  });
}
```

### 2.3 两行文字（替代 `:67-123` 的 11 行元数据表）

```ts
// REQ-25 裁决 2：元数据表整体删除，改为逐字模板两行；字段缺失写「待补」。
function createMetadataParagraphs(project: ProjectRecord) {
  const interviewee = project.intervieweeName.trim() || MISSING_FIELD_PLACEHOLDER;
  const projectName = project.projectName.trim() || MISSING_FIELD_PLACEHOLDER;
  const institution = project.institutionName.trim() || MISSING_FIELD_PLACEHOLDER;
  const confidentiality = getConfidentialityLevelLabel(project.confidentialityLevel);

  return [
    `${interviewee}，「${projectName}」受访者。`,
    // 建档时间沿用 BUG-08 口径（formatDateTime 钉 Asia/Shanghai）；
    // 裁决 9：最近更新本批不进信息行（信息行只三字段）。
    `采集时间：${formatDateTime(project.createdAt)} | 整理机构：${institution} | 保密级别：${confidentiality}`,
  ].map(createStyledParagraph);
}
```

> 类型已核：`projectName` / `institutionName` / `intervieweeName` 均为**必填 `string`**（`types/project.ts:163-165`）；`confidentialityLevel` 为**可选**（`:184`），而 `getConfidentialityLevelLabel(value?: ConfidentialityLevel)`（`oral-history.ts:276`）本就接受 `undefined` —— 与旧 `:80` 的写法逐字一致。

### 2.4 章节拆分 / 去序号 / 空章节跳过（替代 `:125-238` 的 `createParagraphs` + `stripMarkdownInline` + `createMarkdownParagraphs`）

```ts
// REQ-25 裁决 3：只在导出层剥离中文序号前缀；不匹配则原样返回（不补序号、不改其它编号形态）。
function stripChapterIndex(title: string) {
  return title.replace(CHAPTER_INDEX_PATTERN, "").trim();
}

// REQ-25 裁决 4 / PRD §4.5：正文为空、或即生成侧占位句 → 该章整段跳过（标题也不输出）。
function isChapterEmpty(body: string[]) {
  const text = body.join("").trim();
  return text.length === 0 || text === EMPTY_SECTION_PLACEHOLDER;
}

type ManualDraftChapter = { title: string; body: string[] };

// PRD §4.1：按行拆分；带序号的短行＝章标题；首个标题之前的非空行为「引子」（D-25-1，保留不丢字）。
function parseManualDraftChapters(value: string) {
  const lead: string[] = [];
  const chapters: ManualDraftChapter[] = [];
  let current: ManualDraftChapter | null = null;

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (CHAPTER_HEADING_PATTERN.test(line)) {
      current = { title: line, body: [] };
      chapters.push(current);
      continue;
    }

    if (current) {
      current.body.push(line);
    } else {
      lead.push(line);
    }
  }

  return { lead, chapters };
}

function createManualDraftBlocks(value: string) {
  const { lead, chapters } = parseManualDraftChapters(value);
  const blocks: Paragraph[] = createBodyParagraphs(lead);

  for (const chapter of chapters) {
    if (isChapterEmpty(chapter.body)) continue; // 裁决 4：空章节整段跳过
    blocks.push(createHeadingParagraph(chapter.title));
    blocks.push(...createBodyParagraphs(chapter.body));
  }

  return blocks;
}
```

> **本函数即 UI-27 副作用的清理点**：旧 `createMarkdownParagraphs` 的 `- ` / `1. ` 两支（`:186-200` / `:202-216`）与编号配置（`:375-410`）随本函数上场而整体消失。

### 2.5 `createFooter` + `buildDocx`（替代 `:288-425`）

```ts
// PRD §4.6：页脚居中「—N—」（宋体 / 四号）。
function createFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: ["—", PageNumber.CURRENT, "—"],
            size: SIZE_HEADING,
            font: SONG_FONT,
          }),
        ],
      }),
    ],
  });
}

async function buildDocx(project: ProjectRecord) {
  // REQ-25 裁决 1：成文稿取人工定稿 manualDraft；为空回退 redactedAiDraft（D-25-2）。
  // 刻意不经 buildArchivePayload —— json / txt 结构本批零改动（裁决 8）。
  const manualDraft = project.manualDraft.trim()
    ? project.manualDraft
    : project.redactedAiDraft;

  const draftBlocks = createManualDraftBlocks(manualDraft);

  const sections: ISectionOptions[] = [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      footers: { default: createFooter() },
      children: [
        createTitleParagraph(project),
        ...createMetadataParagraphs(project),
        ...(draftBlocks.length > 0
          ? draftBlocks
          : [createStyledParagraph(EMPTY_DRAFT_TEXT)]),
      ],
    },
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: SONG_FONT, size: SIZE_BODY },
        },
      },
    },
    sections,
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
```

> **返回类型**：`buildDocx` 的契约（`Buffer`）与 `createProjectExport`（`:488-516`）零改动；`Content-Type` / 文件名仍由 `route.ts` 决定。

### 2.6 `mock-llm-provider.ts` 五章（裁决 6）

```ts
// ── 模块常量区（与既有 mock 常量并列）───────────────────────────────────
// REQ-25 裁决 6：mock 同步补五章骨架，否则演示链路导出看不到 08 表 2 的效果。
// index 与 resolveWritingTemplate({ scenario }).chapters 的顺序一一对应；
// `?? ""` 兜底：万一章节数变化也不崩（此时该章仅有标题）。
const MOCK_CHAPTER_DRAFTS = [
  {
    body: "受访者出生于上海老城厢，家族在此居住多年。她回忆了旧居周边的街巷格局、居住条件与早年的生活状况。",
    summary: "受访者出生于上海，家族在老城一带居住多年，回忆了旧居周边的街巷格局与生活条件。",
  },
  {
    body: "受访者重点讲述搬迁前后的家庭经历：母亲在离开旧居前后情绪波动明显，她自己也曾因与老邻居分离而长期感到失落。",
    summary: "搬迁前后的家庭经历构成本章主线，其中包含明显的情绪波动线索。",
  },
  {
    body: "她描述了石库门居住空间、菜场、夏夜乘凉与邻里交往等民俗细节，并认为这些细节构成了城市记忆的重要部分。",
    summary: "石库门居住空间、菜场与邻里交往等民俗细节，被受访者视为城市记忆的重要部分。",
  },
  {
    body: "受访者谈到旧区改造后居住条件的改善，也提到新社区人情往来较少。她认为变化既带来了便利，也带走了熟悉的生活节奏。",
    summary: "受访者对比了改造前后的居住条件与社区关系，对变化持两面评价。",
  },
  {
    body: "受访者表示愿意继续讲述这段记忆，希望后人了解普通人的生活变迁。她认为记忆需要通过讲述与记录传递下去。",
    summary: "受访者表达了继续讲述的意愿，并强调记忆需要借助讲述与记录传递。",
  },
];

// REQ-25 裁决 3 的同一正则；mock 内只用于把标题还原成「无序号」形态。
const MOCK_CHAPTER_INDEX_PATTERN = /^[一二三四五六七八九十]+、\s*/;
```

```ts
// ── refineTranscript 内（原 :230-234）───────────────────────────────────
      aiDraft: resolveWritingTemplate({ scenario: input.scenario })
        .chapters.map(
          (chapter, index) => `${chapter}\n${MOCK_CHAPTER_DRAFTS[index]?.body ?? ""}`,
        )
        .join("\n\n"),

// ── structuredSections（原 :266-281，3 条 → 5 条）──────────────────────
      structuredSections: resolveWritingTemplate({ scenario: input.scenario }).chapters.map(
        (chapter, index) => ({
          heading: chapter.replace(MOCK_CHAPTER_INDEX_PATTERN, ""),
          content: MOCK_CHAPTER_DRAFTS[index]?.summary ?? "",
        }),
      ),
```

> **三条硬约束（§0.6）在此逐条兑现**：① 第 1 章 `body` **逐字保留「老城厢」**（`bug05` 的 `SECRET`，且 mock 内 `:245-246` 的注释正是指这句）；② `summary` / `keywords` / `emotionalSignals` / `timelineEvents` / `sensitiveMarks` **未出现在本节 diff 中**（其摘要句刻意用「老城一带」而非敏感串）；③ 提纲相关函数零改动。

### 2.7 出口文案两处（裁决 7 + D-25-5）

```diff
# src/components/projects/project-export-panel.tsx
-  docx: {
-    label: "导出 Word 档案稿",
-    icon: Download,
-  },
+  docx: {
+    label: "导出成文稿",
+    icon: Download,
+  },
```

```diff
# src/components/projects/project-export-panel.tsx（说明文案 :124-126）
-        <p className="text-sm text-muted">
-          支持 `.docx`、`.txt` 和结构化 `.json` 三种导出格式。
-        </p>
+        <p className="text-sm text-muted">
+          下载 Word 格式成文稿（.docx）
+        </p>

# src/components/projects/project-export-panel.tsx（暴露面 :129-130）
+      {/* REQ-25 裁决 8：UI 只暴露成文稿下载；txt / json 保留在代码中供调试与归档。 */}
+      const visibleFormats: ExportFormat[] = ["docx"];   // ← 模块常量区（:34 之后）
...
-        {(Object.keys(formatMeta) as ExportFormat[]).map((format) => {
+        {visibleFormats.map((format) => {
```

```diff
# src/components/projects/project-processing-console.tsx（:1168-1169）
-                {(['docx', 'txt', 'json'] as const).map((fmt) => {
+                {(['docx'] as const).map((fmt) => {
                   const labels = {
-                    docx: '导出 Word 档案稿 (.docx)',
+                    docx: '导出成文稿 (.docx)',
                     txt: '导出纯文本 (.txt)',
                     json: '导出结构化数据 (.json)',
                   };
```

---

## §3 探针

### 3.1 新增 `tmp/verify-req25-export-format.mjs`（出口证据主件）

**定位**：本条的**唯一新增探针**，也是「表 2 六要素 + 页码」的唯一出口证据。**非破坏性**：`LOCAL_STORAGE_DIR` 指向 `tmp/verify-storage-req25`（**刻意与 `bug05` 的 `tmp/verify-storage` 分开**——`bug05` 起手/收尾各 `rm -rf` 一次自己的目录，共用会互删）。

```js
// REQ-25 出口证据：成文稿 .docx 是否满足 08 表 2（六要素 + 页脚「—N—」）。
//
// 非破坏性：LOCAL_STORAGE_DIR 指向 tmp/verify-storage-req25，不触碰 storage/projects.json。
// 不跑 processProject：手工写入 manualDraft / redactedAiDraft，使断言与 mock 语料解耦；
// 两句独占标记句（MANUAL_ONLY_ / REDACTED_ONLY_）用于反证「取的是 manualDraft」（裁决 1）。
//
// 运行：node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs
process.env.LOCAL_STORAGE_DIR = "tmp/verify-storage-req25";

import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const { createProject, getProjectById, updateProject } = await import(
  "../src/lib/server/project-store.ts"
);
const { createProjectExport } = await import(
  "../src/lib/server/project-export.ts"
);

const ROOT = path.join(process.cwd(), "tmp/verify-storage-req25");
let failures = 0;

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  → ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// ── 最小 ZIP 读取（docx = zip；不引第三方包）───────────────────────────
function readZipEntries(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let index = 0; index < count; index += 1) {
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);

    entries.set(name, (method === 0 ? raw : inflateRawSync(raw)).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// ── XML 断言小工具 ─────────────────────────────────────────────────────
const paragraphsOf = (xml) =>
  xml.split(/<w:p[ >]/).slice(1).map((chunk) => chunk.split("</w:p>")[0]);
const textOf = (fragment) => fragment.replace(/<[^>]+>/g, "");
const allText = (xml) => textOf(xml);
```

### 3.1（续）夹具与断言

```js
await rm(ROOT, { recursive: true, force: true });
await mkdir(ROOT, { recursive: true });

const PROFILES = {
  projectName: "REQ-25 导出验证项目",
  institutionName: "", // ← 刻意留空：验证「待补」
  intervieweeName: "验证受访者",
  customScenarioLabel: "",
  notes: "",
  outlineDraftMarkdown: "",
  audioFileName: "verify-req25.mp3",
  audioStoragePath: "uploads/verify-req25.mp3",
  audioSourceUrl: "",
  audioMimeType: "audio/mpeg",
  audioSize: 32,
  collectionScenario: "urban_memory",
  researchFocus: "格式验证",
  privacyLevel: "standard",
  customRedactionRules: ["phone"],
  confidentialityLevel: "internal",
  collectionPath: "ai_interview",
  language: "cn",
  userId: "verify-user-req25",
  userType: "personal",
};

// 五章 + 引子；第 3 章只有占位句 → 应被整段跳过（裁决 4）。
const MANUAL_DRAFT = [
  "本稿依据口述访谈整理，仅供内部研究使用。",
  "一、地域概况与历史沿革",
  "MANUAL_ONLY_SENTENCE 受访者早年居住于城厢旧里，回忆了街巷格局与生活条件。",
  "二、重大事件与时代变迁",
  "搬迁前后的家庭经历构成本章主线，情绪波动线索明显。",
  "三、民俗风物与文化传承",
  "本节内容在本次访谈中未涉及",
  "四、地方发展与建设成就",
  "旧区改造后居住条件改善，新社区人情往来较少。",
  "五、亲历者感悟与记忆",
  "受访者希望后人了解普通人的生活变迁，并愿意继续讲述。",
].join("\n\n");

const created = await createProject({ ...PROFILES });
await updateProject(created.id, (current) => ({
  ...current,
  manualDraft: MANUAL_DRAFT,
  redactedAiDraft: "REDACTED_ONLY_SENTENCE 这是不应出现在成文稿里的中间产物。",
  status: "ready_to_export",
}));

const record = await getProjectById(created.id);
const exported = await createProjectExport(record, "docx");
const entries = readZipEntries(Buffer.from(exported.body));

const documentXml = entries.get("word/document.xml") ?? "";
const stylesXml = entries.get("word/styles.xml") ?? "";
const footerXml =
  [...entries].find(([name]) => /^word\/footer\d*\.xml$/.test(name))?.[1] ?? "";
const paras = paragraphsOf(documentXml);
const bodyText = allText(documentXml);
const has = (xml, needle) => xml.includes(needle);
```

**断言清单（31 条／A–J 十组）**

> **计数说明**：本单原始清单为 **28** 条（原文标题误记为「27 条」，本版按实数更正）；**D-9 / D-10 / D-11** 三条由 **BUG-13**（小标题段前 / 段后间距修复）于 **2026-10-13** 追加，载体 = `HEADING_SPACING`，见 `docs/tasks/IMPL_BUG-13_小标题间距修复.md` §1.2 / §3。**既有 28 条零改动。**

| # | 断言 | 依据 | 变异（改坏了会红） |
| --- | --- | --- | --- |
| A-1 | `word/document.xml` 存在且非空 | 包完整性 | 装配失败即抛 |
| A-2 | 存在 `word/footer*.xml` part | PRD §4.6 | 删 `footers` |
| B-1 | `bodyText` 含 `MANUAL_ONLY_SENTENCE` | 裁决 1 | 改回任何其它草稿源 |
| B-2 | `bodyText` **不含** `REDACTED_ONLY_SENTENCE` | 裁决 1（反证） | 起手写回退句 → 红 |
| C-1 | 某段文本恰为 `验证受访者，「REQ-25 导出验证项目」受访者。` | PRD §4.2（D-25-3） | 改分隔符／语序 |
| C-2 | 某段文本含 `采集时间：` 且含 `整理机构：` 且含 `保密级别：` | 裁决 2 | 拆行／删键 |
| C-3 | `bodyText` **不含** `最近更新` | 裁决 2 | 加回第三项 |
| C-4 | `bodyText` **不含** `项目名称` / `研究焦点` / `受访者姓名` | 裁决 2 / 9 | 元信息表复活 |
| C-5 | 两行文字段文本含 `整理机构：待补` | P-25-1 | 空值漏渲染 |
| D-1 | 首页段落文本 = `REQ-25 导出验证项目`，且该段含 `<w:sz w:val="32"/>` / `<w:b/>` / `<w:jc w:val="center"/>` | 表 2 ① | 字号／对齐漂移 |
| D-2 | 首页段落含 `w:line="360"` 与 `w:lineRule="auto"` | 表 2 ① | 行距漂移 |
| D-3 | C-1 段含 `<w:sz w:val="24"/>` / `<w:jc w:val="both"/>` / `w:line="400"` / `w:lineRule="exact"` / `w:firstLine="480"` | 表 2 ②③ | 任一参数漂移 |
| D-4 | C-2 段（信息行）`<w:jc w:val="both"/>` 且无 `w:firstLine` | 表 2 ② | 缩进误加到信息行 |
| D-5 | 小标题段（`地域概况与历史沿革`）含 `<w:sz w:val="28"/>` / `<w:b/>` / `<w:jc w:val="center"/>` | 表 2 ④ | 层级字号漂移 |
| D-6 | 正文段（`MANUAL_ONLY_SENTENCE` 所在段）含 `<w:sz w:val="24"/>` / `<w:jc w:val="both"/>` / `w:line="400"` / `w:lineRule="exact"` / `w:firstLine="480"` | 表 2 ②③ | 正文参数漂移 |
| D-7 | `documentXml` 中 `w:ascii="宋体"` 出现且 `w:ascii="Arial"` **0 次** | 表 2 ⑥ | 字体回退到旧值 |
| D-8 | `stylesXml` 中 `w:ascii="Arial"` **0 次**，且 `w:ascii="宋体"` 出现 | 表 2 ⑥（默认样式） | 删 `styles.default` |
| D-9 | 小标题段含 `w:before="180"`（段前显式固定值） | **BUG-13 追加**（任务单 §1.2 / §3；载体 `HEADING_SPACING`） | 删 / 改 `before` |
| D-10 | 小标题段含 `w:after="0"`（段后 0；`docx` 的属性过滤只丢 `undefined`，**0 会如实写出**） | **BUG-13 追加**（同上） | 删 `after` / 改成非 0 值 |
| D-11 | `documentXml` 中 `w:before=` / `w:after=` **各恰等于小标题段数**，且每个小标题段各 1 处（＝ 段前 / 段后只出现在小标题 ⇒ 约束① **单点控制**） | **BUG-13 追加**（任务单 §1.2 约束①） | 把 `before` / `after` 误加到正文 / 简介行 / 信息行 |
| E-1 | 存在段落文本恰为 `地域概况与历史沿革`（无序号） | 裁决 3 | 去掉 `replace` |
| E-2 | `bodyText` 不匹配 `/^[一二三四五六七八九十]+、/m` 且不含 `一、地域概况` | 裁决 3 | 序号回落到正文 |
| F-1 | 不存在文本为 `民俗风物与文化传承` 的段落 | 裁决 4 | 不跳过空章节 |
| F-2 | `bodyText` 不含 `本节内容在本次访谈中未涉及` | 裁决 4 | 占位句被输出 |
| F-3 | 其余四章标题与正文各自出现（`重大事件与时代变迁` / `地方发展与建设成就` / `亲历者感悟与记忆` / `搬迁前后的家庭经历构成本章主线`） | 裁决 4 反向（勿误删） | 过滤过宽 |
| G-1 | 页脚段文本 = `——` 且 `footerXml` 含 `PAGE` | PRD §4.6 | 删页码域 |
| G-2 | 页脚段含 `<w:jc w:val="center"/>` 且 `<w:sz w:val="28"/>` | PRD §4.6 | 字号／对齐漂移 |
| H-1 | `documentXml` 不含 `<w:drawing` / `<w:pict` | 裁决 5 | 图片说明复活 |
| I-1 | 空草稿项目（`manualDraft` / `redactedAiDraft` 均空）导出含 `暂无成文稿。` 且主标题 + 两行文字仍在 | P-25-4 | 空态抛错或丢骨架 |
| J-1 | `exported.fileName === "REQ-25 导出验证项目-archive.docx"` | P-25-3 | 文件名口径漂移 |
| J-2 | `exported.contentType` 为 docx MIME | P-25-3 | route 契约破坏 |

**收尾**：`await rm(ROOT, { recursive: true, force: true })` → 打印 `\n共 N 条断言，FAIL x` → `failures === 0 ? exitCode 0 : 1`（与 `bug05` 同口径）。

### 3.2 回归探针（既有，须**重跑**）

| 探针 | 运行命令 | 与本条的关系 | 期望 |
| --- | --- | --- | --- |
| `tmp/verify/bug05-redaction.ts` | `node --import ./tmp/verify/register-alias.mjs tmp/verify/bug05-redaction.ts` | **必跑**。① 它 `createProjectExport(..., "json"/"txt")` → 直接验证「裁决 8 零改动」；② 它整条链路走 mock，会吃到本批次 mock 五章改动 | 8 组断言全绿（`全部通过（临时目录已清理）`，exit 0） |
| `tmp/verify/verify-req14-prompts.ts` | `node --import ./tmp/verify/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | 提纲 5 类 25 条 + 章标题逐字。本批**零改动** `writing-rules.ts` / mock 提纲函数 → 若红即误伤 | 与改前**逐字同输出**（本机若无外置 `07_口述历史写作模板.docx`，则「2.模板逐字(docx)」一项按既有行为跳过） |
| `npx tsc --noEmit` | — | `docx@9.6.1` 类型面（`AlignmentType.BOTH` / `LineRuleType` / `TextRun.children` 收 `PageNumber.CURRENT` / `styles.default`） | 0 error（**新增的 `.mjs` 探针不在 tsc 范围**，故探针内不做类型校验） |
| `npx eslint src` | — | 未用导入残留（§1.1 删 7 个 docx 导入） | 0 problem（改动的 4 文件） |

**bug05 逐条核对（已推演，实施轮仍须实跑）**：① `keywords` / ② `timelineEvents[0].title === "居住于[已脱敏-家庭住址]"` / ③ `structuredSections` / ④ `emotionalSignals` / ⑤ 人名去重 / ⑥ `createFallbackTimeline` / ⑦ json 四字段 blob / ⑧ txt 中文等级 —— **没有一条依赖章节数量或 `manualDraft`**；③ 只影响日志里列出的标题（3 条 → 5 条）；⑦ 的 blob 中 `structuredSections[].content` 用本批新摘要句，**刻意避开「老城厢」**（§2.6 用「老城一带」），故 ⑦ 仍绿。

### 3.3 零连带基线

| 面 | 事实（HEAD 实测） | 结论 |
| --- | --- | --- |
| 导出按钮文案 | 全仓 `tmp/**` **无一条断言**出现过 `导出 Word 档案稿` / `导出成文稿`；`tmp/verify/compiled-console/**` 是**改动前的编译快照**（`…console.js:452` 仍是旧文案），属历史产物，非断言 | 改文案**无探针连带**；顺带说明：快照目录不参与校验，不必同步 |
| docx 版式 | 全仓仅 `bug05`（json/txt）与 `verify-req14-prompts.ts`（**读外置 07 docx**，与本条产出的 docx 无关）触及 docx | 版式改动**无既有断言**，故 §3.1 是唯一证据源 |
| mock 语料 | `tmp/render-console.mjs:72` 等仅构造 `manualDraft: ""` 夹具，不跑导出；`tmp/head-mock-llm-provider.ts` 是 HEAD 快照（可能与本批次 mock 分叉，**不读不改**） | 无连带 |
| `writing-rules.ts` | 本批**零 diff**（裁决 3 的 `replace` 只在导出层） | REQ-14 / UI-27 既有断言不受影响 |
| route / 类型 / store | `src/app/api/projects/[projectId]/export/route.ts`、`types/project.ts`、`project-store.ts` **零 diff**；`process-project.ts:158-160` 既有的「`manualDraft` 空则回落 `redactedAiDraft`」与本批 §2.5 的兜底**同口径**（双保险，非重复逻辑：前者在生成期、后者在导出期） | 无连带 |

### 3.4 变异自检矩阵（证明 §3.1 断言真能红）

| # | 注入变异 | 期望变红的断言 |
| --- | --- | --- |
| M1 | `SIZE_BODY` 24 → 22 | D-3 / D-6 / D-8 |
| M2 | 删正文 `indent.firstLine` | D-3 / D-6 |
| M3 | 正文 `lineRule` `EXACT` + `line 400` → `AUTO` + `360` | D-3 / D-6 |
| M4 | 草稿源改回 `project.redactedAiDraft` | B-1（且 B-2 仍绿 → 单独 B-1 红即定位） |
| M5 | `isChapterEmpty` 恒 `false` | F-1 / F-2 |
| M6 | `stripChapterIndex` 改 `identity` | E-1 / E-2 |
| M7 | 删 `footers` | A-2 / G-1 / G-2 |
| M8 | `SONG_FONT` → `Arial` | D-7 / D-8 |
| M9 | 元信息改回 11 行表格 | C-2 / C-4 |

> **执行纪律**：变异自检**在本地临时改、验证红、随即还原**，绝不进入 commit；`git status` 收尾必须只剩 4 个生产文件 + 1 个新探针。

---

## §4 实施顺序 · 风险 · 回滚

### 4.1 步骤序列（S0 → S7）

| 步 | 动作 | 产出／证据 |
| --- | --- | --- |
| **S0** | 基线实测：`git rev-parse --short HEAD`、`git status --porcelain`、`npx tsc --noEmit`、`npx eslint src`、`node … bug05`、`node … verify-req14-prompts` 全量留档（改前快照） | 基线六条输出（供 S7 逐条对照） |
| **S1** | 改 `src/lib/server/project-export.ts`：**自下而上**（`:288-425` 装配段 → `:149-238` → `:136-147` → `:125-134` → `:67-123` → `:35-65` → `:1-33` imports/常量），每段删完即 `npx tsc --noEmit` | `:516 → 约 330` 行；0 error |
| **S2** | 改 `mock-llm-provider.ts`（§2.6 两处 + 常量区） | mock 五章；`tsc` 0 error |
| **S3** | 改两处 UI 文案 + `visibleFormats`（§2.7，3 个 diff hunk） | `eslint` 0 problem |
| **S4** | 新建 `tmp/verify-req25-export-format.mjs`（§3.1），**先跑一次期望全红／部分红**（此时 src 已改完，应全绿；若在 S1 之前跑则可作红基线） | 28 条断言输出 + exit code（**BUG-13 后同一支探针为 31 条**，见顶部「后续」行） |
| **S5** | 静态门 + 回归：`npx tsc --noEmit`、`npx eslint src`、`bug05`、`verify-req14-prompts` | 与 S0 对照，**只允许** `bug05` ③ 日志标题数 3→5 一处差异 |
| **S6** | 变异自检 §3.4（临时改 → 验红 → 还原），至少跑 M1 / M4 / M5 / M6 四条 | 每次还原后 `git diff` 回到 S5 状态 |
| **S7** | 收尾：`git status --porcelain`、`git diff --stat` | **恰 5 条**：4 生产文件 + 1 新探针；**不 commit、不 push** |

### 4.2 风险与对策

| # | 风险 | 对策 |
| --- | --- | --- |
| R1 | **行号漂移**：删除段与新增段交织，按行号改易错行 | 严格**自下而上**；每完成一段即 `tsc`；最终以 `git diff --stat` 的净行数（≠ −186）反查是否漏删 |
| R2 | **误伤 txt / json**：`buildArchivePayload` / `buildTxt` 被顺手改 | 本批这两函数**零 diff**（`bug05` 出口断言守门）；`createProjectExport` 只允许 docx 分支的调用点被 `buildDocx` 内部变化影响 |
| R3 | **mock 连带 bug05** | §3.2 逐条推演 + 实跑；摘要句避开敏感串；`keywords` / `timelineEvents` / `emotionalSignals` 绝不改 |
| R4 | **章标题识别过窄／过宽**：用户手写「1. 章节」「第一节」等形态被当正文 | 已裁决（判决 9 / P-25-2）：只认 `/^[一二三四五六七八九十]+、\s*/`；**未识别形态按正文原样保留 → 只多不少**（宁可版式欠一层，也不丢字）。列为已知边界写进 PRD §7 |
| R5 | **空章节误判**：正文为「无」「无补充」等非空文本时按占位句比对不到 → 该章照常输出 | 可接受（P-25-2 口径：只跳「空 + 已知占位句」两种），不引入模糊匹配 |
| R6 | **UI 暴露面收窄引发用户困惑**：面板只剩一个下载按钮 | 文案同步改为「下载 Word 格式成文稿（.docx）」；txt / json **保留在代码与 API**（`route.ts` 未动，直接请求 URL 仍可用），仅 UI 不暴露 |

### 4.3 回滚

- **粒度**：4 个生产文件各自独立可回滚（`git checkout -- <file>`）；`project-export.ts` 是**唯一**有耦合的文件（新常量 ↔ 新函数 ↔ 删旧函数必须同进同退），故**必须整文件回滚**，不做部分回退。
- **顺序**：先回滚 UI（可见面最小）→ mock（影响探针语料）→ `project-export.ts`（主战场）。
- **残留物**：`tmp/verify-req25-export-format.mjs`（未入 commit）、`tmp/verify-storage-req25/`（探针自删；若中途崩溃须手工 `rm -rf`）。
- **无数据面风险**：不迁移、不改存储结构、不改既有项目记录（`manualDraft` 等字段语义不变），回滚后**历史项目导出即时恢复旧版式**。

---

## §5 验收矩阵与命令

### 5.1 验收矩阵（交付判据）

| # | 判据 | 证据 | 类型 |
| --- | --- | --- | --- |
| V-1 | 导出 docx 满足 08 表 2 六要素（主标题／简介段／正文段／小标题／段落缩进／字体） | §3.1 探针 D 组 8 条全绿 | 自动 |
| V-2 | 页脚页码「—N—」居中、四号宋体 | §3.1 A-2 / G-1 / G-2 | 自动 |
| V-3 | 元信息表（11 行）被两行文字取代，两行文字默认不出现在正文流 | §3.1 C-1…C-5 | 自动 |
| V-4 | 草稿源 = `manualDraft`（空则回落 `redactedAiDraft`，全空出「暂无成文稿。」） | §3.1 B-1 / B-2 / I-1 | 自动 |
| V-5 | 章节序号在导出层剥离；空章节整段跳过 | §3.1 E 组 / F 组 | 自动 |
| V-6 | txt / json 导出**逐字不变** | `bug05` ⑦⑧ + S0/S5 输出对比 | 自动（回归） |
| V-7 | 类型与 lint 干净，无未用导入 | `npx tsc --noEmit`、`npx eslint src` | 静态 |
| V-8 | 影响面恰为 4 个生产文件 + 1 个新探针 | `git diff --stat` | 静态 |
| V-9 | mock 五章可见（演示链路导出的成文稿有 5 个小标题） | §3.1 E-1 / F-3 ＋ `bug05` ③ 日志 3→5 | 自动 |
| V-10 | 出口文案统一为「导出成文稿」 | 人工核对 2 处（`project-export-panel.tsx` / `project-processing-console.tsx`）；**无探针覆盖**（§3.3） | 人工 |

### 5.2 命令清单（可直接照跑）

```powershell
# ① 静态门
npx tsc --noEmit
npx eslint src

# ② 本批新增证据
node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs

# ③ 既有回归
node --import ./tmp/verify/register-alias.mjs tmp/verify/bug05-redaction.ts
node --import ./tmp/verify/register-alias.mjs tmp/verify/verify-req14-prompts.ts

# ④ 影响面
git status --porcelain
git diff --stat
```

---

## §6 文档回写与交接

### 6.1 本轮（文档批）已落盘

| 文件 | 动作 |
| --- | --- |
| `docs/PRD_REQ-25_稿件导出重构.md` | **新增**（§0–§11；含裁决表、表 2 对照、参数表、边界、风险、待确认 P-25-1…P-25-6、裁决 → 章节对照） |
| `docs/tasks/IMPL_REQ-25_稿件导出重构.md` | **新增**（本单：§0 口径／§1 逐文件行清单／§2 代码／§3 探针／§4 顺序 · 风险 · 回滚／§5 验收／§6 交接） |
| `docs/需求登记表.md` | **升版 v2.11**：新增 REQ-25 条目 + §1.2 / §5.1 / §5.2 同步 + 变更记录行 |

### 6.2 实施轮回写清单（**必须与代码同批**，全部属 `docs/**`）

| # | 位置 | 现状（HEAD 实测） | 回写为 |
| --- | --- | --- | --- |
| 1 | `需求登记表.md:542`（BUG-08 ④） | `src/lib/server/project-export.ts:88-89`（docx 元信息表，表由 `:329` 塞入；`txt` `:427-440` 不含时间项、`json` `:271-272` 为原始 ISO） | 「**已随 REQ-25 重构，原行号失效**：11 行元信息表删除，`建档时间` 移入信息行的「采集时间：」；`txt` / `json` 口径不变」 |
| 2 | `需求登记表.md:546`（BUG-08 验收要点） | 「docx 导出元信息表时间同步为北京时间」 | 「docx 导出信息行「采集时间：」同步为北京时间」 |
| 3 | `需求登记表.md:776`（**UI-14 资料可见范围** · 导出锚点） | `src/lib/server/project-export.ts:80`、`:265-267`、`:437` | 「**已随 REQ-25 重构，原行号失效**：`保密级别` 保留在信息行；`txt` 侧锚点以实施后实测行号为准」 |
| 4 | `需求登记表.md:958`（UI-27 风险①，导出面外溢） | 「…（本批不改，须与 REQ-25 导出格式规范一并处理）」 | 追加「—— 2026-10-XX **REQ-25 已闭环**：导出层不再消费 `- ` / `1. ` 形态，编号引用分支随旧装配段一并删除」 |
| 5 | `docs/tasks/IMPL_REQ-28-E_项目详情页文案与UI-08-17.md:245` / `:440` | `project-export.ts:336/338/369/450/453/483`（导出文档术语零 diff 面） | 标注「原行号随 REQ-25 重构失效（`:336-369` 段已删）」，**零 diff 结论不变**（改由 REQ-25 单独承担） |
| 6 | `docs/tasks/IMPL_REQ-28-E_项目详情页文案与UI-08-17.md:489` | 「`timeline-panel.tsx`、`project-export.ts`、`oral-history.ts` **零 diff**」 | 追加「（`project-export.ts` 的零 diff 已由 REQ-25 于 2026-10-XX 解除，属另批） |
| 7 | `docs/tasks/IMPL_REQ-28-E_项目详情页文案与UI-08-17.md:640` | 计数行含 `project-export.ts:343/460` 两处锚点 | 「`project-export.ts` 侧两处随 REQ-25 消失，须**按实施后实测重数**并更新该行」 |
| 8 | `docs/PRD_REQ-14_AI辅助访谈.md:28` | 存量「建议：{guidance}」（`project-processing-console.tsx:239`、`project-export.ts:359` / `:474`） | 「`:359` 属本批删除段；**仅 `:474`（`txt` 侧）保留**」→ 锚点收敛为 `:474` |

> **口径**：以上 8 处**只改锚点与「已随 REQ-25 重构」措辞，不改任何既有结论**；改完须逐条 `Select-String` 复核（禁用 `Get-Content`，§0.2-②）。
> **行号基线（重要）**：表中 `需求登记表.md` 的 4 处行号均为**行号基线 v2.10**；本轮（文档批）登记表升 **v2.11** 并补登 REQ-25 条目后，同区域行号**整体 +56**，实测对应关系为 `:542 → :598`、`:546 → :602`、`:776 → :832`、`:958 → :1014`（**只增不删**，故基线值恒 ≤ 现址）。实施轮**一律按文本 `Select-String` 定位、勿按行号跳转**，并在回写时顺带把行号更新为实施轮实测值。另：`IMPL_REQ-28-E` 全名为 `docs/tasks/IMPL_REQ-28-E_项目详情页文案与UI-08-17.md`，`PRD_REQ-14` 全名为 `docs/PRD_REQ-14_AI辅助访谈.md`（两者本轮**未改动**，实施轮回写）。

### 6.3 已追认（2026-10-13，全采推荐值）（同批已按推荐值写入，改判成本 1–2 行）

**P-25-1**（移除 txt/json 两个 UI 按钮）｜**P-25-2**（主标题保留 `${项目名称} 档案整理稿`）｜**P-25-3**（文件名保持 `{项目名}-archive.docx`）｜**P-25-4**（空态文案改「暂无成文稿。」）｜**P-25-5**（不设段后距）｜**P-25-6**（删副标题）。逐条见 §0.5。

### 6.4 明令不做（本轮与实施轮共同边界）

- **不 commit、不 push**：本轮仅落盘文档；实施轮收尾留工作区改动待总管验收。
- **不改 `src/**`**（本轮）；实施轮**只**改 §0.2-① 列出的 4 个生产文件。
- **不改 `tmp/**`**（除新增 1 支探针）、**不新建备份目录**（`tmp/_backup_*` 属他人批次纪律，本批不沿用）。
- **不重排既有文档结构**、不顺手改口径文案、不把 P-25-x 当已批准事项对外宣称（一律标「建议」）。