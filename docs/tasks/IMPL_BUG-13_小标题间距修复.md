# BUG-13 实施任务单 · 导出成文稿小标题间距修复（段前窄、段后宽）

> 上游：`docs/需求登记表.md` §三 BUG-13（**P1**；总管 2026-10-13 立号 ＋ 裁决）。**本条不出 PRD**（缺陷修复，改动面 = 1 个 `spacing` 对象 / 2 个属性）。
> - **规模**：生产代码 **1 个文件 / 1 处**（`src/lib/server/project-export.ts` 的 `createHeadingParagraph()` `:85-98`，其 `spacing` 在 `:88`）；探针 **1 支文件追加 2 条断言**（`tmp/verify-req25-export-format.mjs`），既有 **28 条零改动**。
> - **前置**：**REQ-25 已于 2026-10-13 验收闭环**（出口断言 **28 / 28** 全绿 ＝ 本单**改动前基线**）⇒ 阻塞解除，可按已裁决实施序开工（**先验收 REQ-25 → 再修 BUG-13 → 再做 REQ-31**）。
> - **行号基线**：2026-10-13 实测，HEAD = `efe0b65`（`master`；工作区 clean）→ 改前须复核（口径见 §0.2-②）。
> - **红线**：不动 `createStyledParagraph()`、**不改行距口径**（`LINE_1_5` / `EXACT_20PT` 保持不变）、不动其它段落工厂（§0.3）。
> - **状态**：**待实施** —— **具体数值待 DS 出方案、任老师实测确认**（本单不预设数值）。

---

## §0 口径说明

### 0.1 三条约束（总管 2026-10-13 裁决，逐字遵守）

| # | 约束（逐字） | 本单落地 | 机器校验 |
| --- | --- | --- | --- |
| ① | 只在 `createHeadingParagraph()` 的 `spacing` 中增加 `before` / `after` | §1.1（唯一改动点） | `git diff --stat` 恰 1 个生产文件；只 2 类 hunk |
| ② | **不动 `createStyledParagraph()`**（改动会连带访谈对象简介 / 信息行 / 正文三类） | §0.3-① 禁改面 | 该函数体（`:72-79`）0 hunk；D-3 / D-4 / D-6 断言守门 |
| ③ | **不改行距口径**（`LINE_1_5` / `EXACT_20PT` 保持不变） | §0.3-② 禁改面 | 常量 `:30-31` 0 hunk；D-2（`w:line="360"` / `auto`）与 STYLED_KEYS（`w:line="400"` / `exact`）守门 |
| ④ | **具体数值由 DS 出方案、任老师实测确认** | §0.4 开口项 ＋ §4.1 S0–S1 | 本单所有数值位置一律写 `{X}` / `{Y}` 占位，**不预设数值** |

### 0.2 三项实施口径（延续 REQ-25 IMPL §0.2）

| # | 口径 | 本批实测（2026-10-13，HEAD `efe0b65`） | 纪律 |
| --- | --- | --- | --- |
| ① | 行尾 | `src/lib/server/project-export.ts` **纯 LF**（CRLF = 0）；`docs/**` 为 CRLF | `src/**` **禁止**把 `\n` 归一为 `\r\n`；本单 CRLF |
| ② | 行号 | 一律 `[IO.File]::ReadAllLines` / `Select-String`；**禁用 `Get-Content`**（PS 5.1 把无 BOM UTF-8 当 GBK 解码 → 行号虚高） | 全单行号即此口径产物；改前须复核 |
| ③ | BOM | `project-export.ts` / `tmp/verify-req25-export-format.mjs` **均无 BOM** | 逐文件原样保留，**不增不删** |

### 0.3 本批硬边界（禁改清单）

| # | 禁改面 | 依据 |
| --- | --- | --- |
| ① | `createStyledParagraph()`（`project-export.ts:72-79`） | 约束 ②；D-25-3（简介 / 信息行 / 正文三类共用同一工厂） |
| ② | 常量 `EXACT_20PT` / `LINE_1_5`（`:30-31`） | 约束 ③；REQ-25 表 2 参数（固定值 20 磅 / 1.5 倍行距）；D-2 断言 |
| ③ | `createTitleParagraph()`（`:56-69`，主标题） | 主标题 1.5 倍行距由 D-2 锁定；本 bug 现象只在**小标题** |
| ④ | `createFooter()`（`:168-183`）与页脚断言 | PRD §4.6 |
| ⑤ | 章拆分 / 去序号 / 空章节跳过（`:40-48` 常量 ＋ `parseManualDraftChapters` / `stripChapterIndex` / `isChapterEmpty` / `buildDocumentParagraphs`） | REQ-25 裁决 3 / 4 |
| ⑥ | `buildArchivePayload` / `buildTxt` / `createProjectExport` 的 json / txt 返回与文件名；脱敏链路（`applyRedactionProfile` / `buildRedactedSegmentText`） | BUG-05 回归面 |
| ⑦ | `tmp/verify-req25-export-format.mjs` 的**既有 28 条断言**（只允许**追加**） | REQ-25 验收基线不得回退 |
| ⑧ | `src/lib/writing-rules.ts`（整文件） | REQ-14 探针锁定 ＋ REQ-25 裁决 3 |
| ⑨ | UI 侧（`project-export-panel.tsx` / `project-processing-console.tsx`） | 与本 bug 无关（间距由导出层装配决定） |

### 0.4 开口项（待 DS 出方案）

| # | 开口项 | 本单取值 | 说明 |
| --- | --- | --- | --- |
| Q1 | `before` / `after` 的**具体数值** | **待定**（`{X}` / `{Y}`） | 单位 = **twips（1/20 磅）**，与既有 `line: 400`（＝ 20 磅）同尺度；docx v9.6.1 的 `ISpacingProperties` 支持 `before` / `after`（`node_modules/docx/dist/index.d.ts:1713-1714`） |
| Q2 | 两值是否**相等** | 待定 | 验收口径是「段前段后视觉一致」⇒ 若取 `before = after`，「一致」由同一数值保证，人眼只需复核一次 |
| Q3 | 数值载体：**新常量** vs `:88` 内联展开 | 本单推荐**新常量**（与 REQ-25 文件头常量风格一致） | 两种写法均不越界（都只影响 `createHeadingParagraph` 的 `spacing`）；最终由 DS / 总管在方案中指定 |
| Q4 | 断言落点：**纳入既有探针** vs 另立新探针 | 本单推荐**纳入既有探针**（＋2 条） | 既有探针已是本条出口证据主件；另立新探针会产生第二份文档事实源 |

### 0.5 事实依据（只读根因扫描，2026-10-13，`src` 零改动）

| # | 事实 | 实测口径 |
| --- | --- | --- |
| ① | 全文件 `spacing` 仅 **3 处**（`:59` 主标题 / `:75` 正文工厂 / `:88` 小标题），**`before` / `after` 0 处** | `Select-String` 全文件 |
| ② | 实测导出产物 `word/document.xml`：全段 **`w:before` 0 次 / `w:after` 0 次**；标题段 `<w:spacing w:line="360" w:lineRule="auto"/>`、正文段 `<w:spacing w:line="400" w:lineRule="exact"/>` | 内存解包（`inflateRawSync`），未落盘 |
| ③ | `word/styles.xml` 的 `<w:pPrDefault/>` **为空**（无默认段前 / 段后可继承）、无 `Normal` 样式、`Title` / `Heading*` 样式仅 rPr（无 spacing） | 同上 |
| ④ | ⇒ 登记时初步假设（标题 `spacing.after` ＋ 正文 `spacing.before` **叠加**）**不成立**；两类段落唯一差异 = **行距口径**（`AUTO × 1.5` ↔ `EXACT 20 磅`） | 同上 |
| ⑤ | **渲染侧余量落位（AUTO 多倍行盒 vs EXACT 固定行盒）离线无法判定** ⇒ 修复后的**视觉一致性必须由任老师实测闭环** | 本机无 Word / WPS 量距链路；仓库无 `.docx` 样本 |

---

## §1 改动清单（唯一文件 · 唯一改动点）

### 1.1 `src/lib/server/project-export.ts`（**唯一生产文件**）

**现状（HEAD `efe0b65` 实测；LF / 无 BOM）**

```
:30  const EXACT_20PT = { line: 400, lineRule: LineRuleType.EXACT };   // 禁改（约束 ③）
:31  const LINE_1_5   = { line: 360, lineRule: LineRuleType.AUTO };    // 禁改（约束 ③）
:85  function createHeadingParagraph(title: string) {
:86    return new Paragraph({
:87      alignment: AlignmentType.CENTER,
:88      spacing: LINE_1_5,                                            // ← 唯一改动点
:89      children: [
:90        new TextRun({ text: stripChapterIndex(title), bold: true, size: SIZE_HEADING, font: SONG_FONT }),
:91      ],
:92    });
:93  }
```

**改法（示意；`{X}` / `{Y}` ＝ DS 定值，单位 twips）** —— 推荐形态（新增 1 个常量 ＋ 只换 `spacing` 一行）：

```ts
// :31 之下新增（示例名；与文件头常量风格一致）
// BUG-13：小标题段前 / 段后显式固定值（单点控制；行距口径不变 —— 仍复用 LINE_1_5）。
const HEADING_SPACING = { ...LINE_1_5, before: {X}, after: {Y} };
```

```ts
// :88 仅此一行变化
     spacing: HEADING_SPACING,
```

**等价的备选形态**（同样不越界，若 DS / 总管偏好零新增常量）：`:88` 直接写 `spacing: { ...LINE_1_5, before: {X}, after: {Y} }`。**两形态择一**，不得同时存在。

**改动后自检（验收级）**：

1. `git diff src/lib/server/project-export.ts` —— 只应出现**两类 hunk**（新增常量 / `:88` 换引用），**无其它 hunk**；
2. `createStyledParagraph`（`:72-79`）与常量 `:30-31` **零改动**；
3. 导出产物中 `w:before` / `w:after` **只出现在小标题段落**（正文 / 简介 / 信息行 / 主标题 / 页脚均 0 次）—— 即约束 ① 的「**单点控制**」。

### 1.2 `tmp/verify-req25-export-format.mjs` —— 仅**追加** 2 条断言（既有 28 条零改动）

**落点**：D 组（表 2 六要素参数）内、`D-5`（小标题四号 / 加粗 / 居中）之后 —— 变量 `headingPara` 已在 `:182` 定义、`bodyPara` / `introPara` / `infoPara` / `titlePara` 均已在 D 组内定义，**直接复用，不新增解包逻辑**。

```js
// BUG-13：小标题段前 / 段后显式固定值。
// 注：既有 D-5 只断言小标题的字号 / 加粗 / 居中，**未断言 spacing** ⇒ 追加 D-9 / D-10 即可闭环，不改 D-5。
check("D-9 小标题：段前距 w:before = {X}", has(headingPara, 'w:before="{X}"'), headingPara.slice(0, 200));
check("D-10 小标题：段后距 w:after = {Y}", has(headingPara, 'w:after="{Y}"'));
```

**建议同时补 1 条反证（可选，D-11）** —— 约束 ①「单点控制」的唯一机器证据：

```js
check(
  "D-11 段前 / 段后只出现在小标题（正文 / 简介 / 信息行 / 主标题 0 处）",
  !has(bodyPara, "w:before=") && !has(bodyPara, "w:after=") &&
  !has(introPara, "w:before=") && !has(infoPara, "w:before=") &&
  !has(titlePara, "w:before=") && !has(titlePara, "w:after="),
);
```

**断言数口径**：既有 **28** ＋ 必加 **2**（D-9 / D-10）＝ **30**；若采纳 D-11 则为 **31**。**以实施轮实际落地数为准**，§3-R1 按「30 或 31」判定。

> **零连带实测（2026-10-13）**：`tmp/**` 全域仅本探针与 `tmp/verify/verify-req14-prompts.ts` 读 `word/document.xml`（后者只做「取纯文本」的辅助，无 spacing 断言）；**无任何脚本断言 `w:before` / `w:after`**（实测 0 命中）⇒ 新增属性不会连带既有断言。

---

## §2 验收口径（总管 2026-10-13 裁决）

**口径（逐字）**：**段前段后视觉一致，单点控制间距** —— 修复方向为「**只在 `createHeadingParagraph()` 的 `spacing` 中显式增加 `before` / `after` 固定值**，不改动正文侧」。

| # | 判据 | 判定方 | 方式 |
| --- | --- | --- | --- |
| V1 | 小标题段前 / 段后各为**显式固定值**（小标题段出现 `w:before` / `w:after`） | 机器 | 探针 **D-9 / D-10** |
| V2 | **单点控制**：全篇 `w:before` / `w:after` 只出现在小标题段 | 机器 | 探针 **D-11**（建议）＋ §1.1 自检 3 |
| V3 | **视觉一致**：小标题上、下两侧空白目视相等 | 人（任老师） | 导出一份**真实项目** → Word / WPS 打开比对（**唯一终判**） |
| V4 | 行距口径**未变**（小标题仍 360 / auto；正文仍 400 / exact ＋ 480 缩进） | 机器 | 既有 **D-2 / D-3 / D-4 / D-6**（回归即证） |
| V5 | 08 表 2 其余要素**零回归** | 机器 | 既有 **28 条**全绿（§3-R1） |

**明令不做**：不得以「改正文侧参数」或「改行距口径（AUTO ↔ EXACT）」达成 V3；不得改主标题 / 页脚间距；不引入 `beforeAutoSpacing` / `afterAutoSpacing`（属**自动**间距，与「固定值」口径不符）。

---

## §3 回归要求（REQ-25 出口断言 —— 硬门）

> **改动前基线（2026-10-13，本批复跑）**：`tmp/verify-req25-export-format.mjs` = **28 PASS / 0 FAIL / exit 0**（临时目录无残留）。本案改动后**不得低于**此基线。

| # | 命令 | 期望 |
| --- | --- | --- |
| R1 | `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | **30（或 31）条全 PASS / FAIL 0 / exit 0** —— 含既有 **28 条逐条仍绿**（尤须盯 **D-2** 主标题 360 / auto、**STYLED_KEYS** 正文 400 / exact / 480、**H-1** 无 drawing） |
| R2 | `node --import ./tmp/verify/register-alias.mjs tmp/verify/bug05-redaction.ts` | 全绿（json / txt 与本案零交叉，「未误伤」证据） |
| R3 | `npx tsc --noEmit` | 无新增错误 |
| R4 | `npx eslint src` | 无新增告警 |
| R5 | `git diff --stat` | **恰 1 个生产文件**（`src/lib/server/project-export.ts`）；`tmp` 侧仅 1 支探针追加断言 |
| R6 | `git diff src/lib/server/project-export.ts` 逐 hunk 复核 | 只 2 类 hunk；**`createStyledParagraph` 与 `:30-31` 无 hunk** |

**命令陷阱（PS 5.1，本批实测）**：探针把 `MODULE_TYPELESS_PACKAGE_JSON` 警告写到 **stderr**，在 PowerShell 里直接 `>` 重定向会被判为 `NativeCommandError` 而中断 ⇒ 用 `cmd /c "node ... > %TEMP%\req25_probe.txt 2>&1"` 包一层，再读文件并核 `exit code`。

---

## §4 实施顺序 · 风险 · 回滚

### 4.1 步骤序列（S0 → S5）

| 步 | 动作 | 产物 / 判据 |
| --- | --- | --- |
| S0 | **DS 出数值方案**：`before` / `after` 取值（换算依据、是否相等、载体形态） | 对 §0.4 的 Q1 ~ Q4 逐条答复 |
| S1 | **任老师预确认**（可先看数值，也可直接进 S2 看实物） | 确认记录 |
| S2 | 改 `createHeadingParagraph()`（§1.1，1 处） | `git diff` 2 类 hunk |
| S3 | 追加 D-9 / D-10（＋ D-11），跑 **R1** | 30（或 31）全绿 |
| S4 | 跑 **R2 / R3 / R4 / R5 / R6** | 全绿；改动面 = 1 文件 |
| S5 | 导出一份**真实项目**交任老师实测（**V3 终判**） | 通过 ⇒ 按 §5.2 回写收口；不通过 ⇒ 回 **S0** 调数值（仅 1 处属性，重跑成本极低） |

**实施序纪律**：本条**不得**与 REQ-31（其新增模板会改变导出侧章数假设）或任何其它 `project-export.ts` 改动合并为一批 —— REQ-25 验收基线不得回退。

### 4.2 风险与对策

| # | 风险 | 对策 |
| --- | --- | --- |
| ① | **数值不当**（视觉仍不一致，或过大导致标题与上下文「断开」） | 改动面仅 1 处 / 2 个属性；S5 不通过回 S0 调值 |
| ② | 误以为「段后距会把下一段推到下页」 | 段前 / 段后是**间距**不是分页控制（分页属性是 `pageBreakBefore`，与本案无关）⇒ 不影响 F / G / I 组断言 |
| ③ | 顺手改了正文侧或行距口径 | 约束 ②③ ＋ D-2 / D-3 / D-4 / D-6 守门；R6 逐 hunk 复核 |
| ④ | 把既有 28 条「顺手改绿」 | R6 ＋ 明令**既有断言零改动**（只允许追加）；登记表 §三 BUG-13 与 §5.2 已同批写入该约束 |
| ⑤ | 渲染端行为无法离线验证（§0.5-⑤） | 承认边界：V3 由任老师实测终判，本单不预写「已修好」的机器结论 |

### 4.3 回滚

- 单文件、单常量 / 单行 ⇒ `git revert <commit>`（或删 `before` / `after` 两属性）即回到 **REQ-25 已验收基线（28/28）**；
- 回滚后须**复跑 R1** 确认回到 28/28（回滚同样要有证据）。

---

## §5 文档回写与交接

### 5.1 本轮（文档批，已完成）

- `docs/需求登记表.md` **v2.14**：REQ-25 状态 →「**已验收（2026-10-13）**」（§1.2 / §三 / §5.1 ＋ 变更记录，四处同步；§5.2 同批解除基线约束）；BUG-13 状态 →「**待实施**」（§1.2 / §三 / §5.1 ＋ §5.2 注）并引用本单；§三 UI-02 追加任老师 2026-10-13 备注；行号锚点按 v2.14 实测更新。
- `docs/tasks/IMPL_REQ-25_稿件导出重构.md`：顶部状态行 →「已验收（2026-10-13）」＋ 回归基线（28/28）。
- `docs/系统现状与路线图.md` §4.1：条目状态同步。
- 本轮 **`src` / `tmp` / `storage` 零改动**（纯文档批）。

### 5.2 实施轮回写清单（**必须与代码同批**）

| # | 文件 | 回写内容 |
| --- | --- | --- |
| ① | `docs/需求登记表.md` | §三 BUG-13：状态 →「**已完成（日期，`commit`）**」；「修复方向」补 **DS 定值（`before` / `after` 具体数值）** 与探针断言数（30 / 31）；§1.2 ＋ §5.1 同步；§5.2 的 BUG-13 ↔ REQ-25 条补「已闭环」；**变更记录新增版本条目**（commit、断言数、基线对比） |
| ② | `docs/tasks/IMPL_REQ-25_稿件导出重构.md` | §3.1 断言数 **28 → 30（或 31）**，并注明 D-9 / D-10（/ D-11）为 **BUG-13 追加** |
| ③ | `tmp/verify-req25-export-format.mjs` | 文件头注释补一行「D-9 ~ D-11 由 BUG-13 追加（小标题 `before` / `after`）」—— 探针自述与登记表口径对齐 |

### 5.3 明令不做（本轮与实施轮共同边界）

- 不改 `createStyledParagraph()` / 行距口径 / 主标题 / 页脚 / 章节拆分与去序号逻辑；
- 不动 `buildArchivePayload` / `buildTxt` / json / txt 文件名 / 脱敏链路 / `export/route.ts`；
- 不动 `writing-rules.ts`（REQ-14 红线）、不动数据层、不引 npm 包、不改 UI 文案；
- 不把本条与 REQ-31 合批；不在 REQ-25 基线之外另起一套排版口径。


