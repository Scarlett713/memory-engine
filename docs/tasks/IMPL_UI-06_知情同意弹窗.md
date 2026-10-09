# UI-06 实施任务单 · 知情同意弹窗文案正式化（2 处 5 行 · 探针零同步）

> **上游**：`docs/PRD_UI-06_知情同意弹窗.md`（**PRD 定稿**，总管 2026-10-09 两项裁决已并入）。本单是它的**实施说明书**，逐字文案与 PRD §4 **必须逐字符一致**（§0.6 ↔ PRD §4.1／§4.2）。
> **本文档只写计划**：不改代码、不产生 commit。实施轮按 §1 改 `src/**`；**`tmp/**` 探针 0 行必改**（§3），另加 1 支只读断言（§4，不入库）。
> **规模**：**恰好 2 处、触及 5 行、1 个文件** —— `:167-169`（正文，＝ REQ-28 的 **D-09**）＋ `:180-182`（勾选句，＝ **D-10**）。**无结构授权项、无样式改动、无新增控件**（§0.3）。
> **授权**：总管 2026-10-09 **明文解冻 D-09 / D-10**（授权原文照录于 §0.4）；范围**仅此 2 处 5 行**。
> **行号基线**：2026-10-09 实测，HEAD ＝ `c6e2066`（`master == origin/master`，工作树干净）→ **实施前须复核行号**（口径见 §0.1）。
> **状态**：**待 DS 实施**（总管放行后执行；执行前必须先复读 §0.4）。

---

## §0 口径说明

### 0.1 行号复核口径（**禁用 `Get-Content` 定位**）

PowerShell 5.1 的 `Get-Content` 把**无 BOM 的 UTF-8** 当 GBK 解码，会吞掉中文标点后的换行 —— 本文件实测会被算成 **927 行**（真值 **998 行**，偏差 71 行，见 `IMPL_REQ-28-D` §0.1③）。**一律用**：

```powershell
$a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
for ($i = 0; $i -lt $a.Length; $i++) {
  if ($a[$i] -match '本平台会对本次口述音频|我确认已获得受访者的|data-upload-modal') { 'L' + ($i + 1) + ': ' + $a[$i].Trim() }
}
```

**开工前置**：`git rev-parse --short HEAD` 应为 `c6e2066` 或其后继；`git status --short` **必须为空**（同文件串行纪律，§0.8）。行号若漂移，**以「逐字锚点」定位、不认行号**：本批两处的定位锚是「本平台会对本次口述音频」（正文）与「我确认已获得受访者的」（勾选句）。

### 0.2 改动纪律（只改字符串字面量）

- 只改 `<p>` / `<span>` **内部文本节点**；不改 JSX 结构、条件分支、props、导出、类型、状态键、`className`、`id`、`data-*`、`aria-*`。不新增依赖、不改配置、不动样式文件。
- **JSX 文本书写规则（本批两条硬规则）**：① 两段文案**各写在一行内**，**不得在句中换行**（JSX 会把「换行 ＋ 缩进」折叠成**一个空格** → 可能凭空造出 `研究 / 归档` 或破坏逐字一致性）；② 文案内**不得出现** `{` `}` `<` `>` `&`（JSX 会当成表达式 / 标签 / 实体）——定稿文案已核，仅有 `/`、`—`、`“”`、`《》`、「」。
- 一行文本过长**无需**担忧：本仓**无 prettier / editorconfig**（`package.json` 的 lint ＝ `eslint` 一项，flat config `eslint.config.mjs`），eslint 不会因 JSX 文本行长度告警，也不会自动回写。

### 0.3 **纯字面批**：无结构授权项

| 类别 | 本批是否触碰 | 说明 |
| --- | --- | --- |
| 字符串字面量 | ✅ **只碰这个** | 2 处 / 5 行 |
| JSX 结构（增删标签、改嵌套、加条件） | ❌ | 弹窗结构进 PRD 时即已定形（`ConsentDialog` `:92-214`） |
| `className` / 样式 | ❌ | 含 `.soft-scroll mt-3 max-h-[min(55vh,24rem)] …`（`:166`）与滚动区上限 —— **REQ-28-D 亦未动此处** |
| 控件数量 / 类型 | ❌ | 保持 **1 个** checkbox ＋ 2 个按钮（**方案 B**；与内部规格「两个承诺项」的偏离已登记于 **PRD §3 A1-s**） |
| props / 状态 / 逻辑 / 门控 | ❌ | `checked` / `onCheckedChange` / `disabled={!checked}` / `onConfirm` / `onCancel` 全不动 |
| 其它文件 | ❌ | `src/lib/**`、`src/app/**`、`src/components/**`（其余）**零改动** |

> 结论：**本批没有需要总管另行授权的结构项**；唯一需要授权的是 **D-09 / D-10 的字面替换**本身（§0.4）。

### 0.4 ⚠ **A5 解冻授权原文**（总管 2026-10-09 · **DS 执行前必须复读**）

> 「裁决二：明文解冻 D-09/D-10（A5）—— 总管授权（本批 UI-06 专用）：REQ-28 P-1『D-09/D-10 逐字不动』冻结对本批 UI-06 解除。DS 可替换 `interview-upload-form.tsx:167-169`（D-09 正文）与 `:180-182`（D-10 勾选句）为 B1 定稿逐字文案。**授权范围仅此 2 处 5 行**，其余 P-1 冻结不变。此授权写进 IMPL §0 A5 条，DS 执行前必须复读。」

**授权边界（越界即判失败）**

| 项 | 状态 |
| --- | --- |
| `:167-169` 正文文本 | ✅ 可替换 |
| `:180-182` 勾选句文本 | ✅ 可替换 |
| `:166` 滚动容器（含 `max-h` / `.soft-scroll`） | ❌ 不动 |
| `:172-183` `<label>` / `<input>` / `<span>` 结构 | ❌ 不动（`<span>` 只换文本） |
| `:156` 眉标 / `:163` 标题 / `:187` 提示 / `:198`、`:206` 按钮 | ❌ 不动 |
| `:138-141`、`:147-152` 的 `data-*` / `role` / `aria-*` | ❌ 不动 |
| REQ-28 其余冻结项（`IMPL_REQ-28-D` §0.7） | ❌ 不动（含 `tmp/cdp-req14-consent.mjs:306` 所钉旧句 **不得复活**） |

### 0.5 探针影响面判定：**0 行必改** ＋ **三条护栏**（不许动）

**结论**：`src/**` 按 §1 改完后，全部 `tmp/**` 探针**无需任何改动**（依据与实测见 §3）。

**三条护栏（改后必须同时成立，任一破坏即回退文案 —— 纪律见 `IMPL_REQ-28-D` §3.6 第 4 条）**

| # | 护栏 | 钉它的断言 |
| --- | --- | --- |
| ① | **正文保留**「研究/归档目的」 | `tmp/cdp-req14-consent.mjs:351`（`hasFixedText === true`） |
| ② | **不得出现**「研究 / 归档」（带空格的斜杠） | 同上 `:352`（`hasSpacedText === false`） |
| ③ | `data-upload-modal="consent"` / `role="dialog"` / `.soft-scroll` / 按钮字面「我确认」「取消」「开始处理」**原样** | `tmp/cdp-req14-consent.mjs:343-352`、`tmp/verify-phase3.mjs:730-741`／`:820-841`、`tmp/cdp-req13-outline.mjs:360-363` |

> 换言之：**护栏全在「结构 ＋ 三个按钮字面 ＋ 一个固定词组」上，没有一个落在正文/勾选句的全文上** —— 这就是本批敢于零改探针的根因。

### 0.6 逐字定稿（**与 PRD §4 逐字符一致**；实施中不得再改，改选须回总管）

**① 正文**（`:167-169` 的 `<p>` 内文本 · **单行**）

```text
本平台会把本次口述音频转写为文字并整理归档，处理结果仅用于研究/归档目的；采集与 AI 处理由系统执行、经人工复核，可定位到个人的字段做不可逆处理，不保留“明文—映射表”；保存期限（原始音视频与可识别身份的文稿默认项目结束后 2 年）、云端服务与受访者的查阅、复制、更正、撤回同意及删除权利，依《个人信息处理说明》（更新日期 2026年10月8日）执行。上传前请确认您已向受访者完整说明上述用途，并已按要求完成知情同意书签署、对签署真实性负责。
```

**② 勾选句**（`:180-182` 的 `<span>` 内文本 · **单行**）

```text
我确认已向受访者说明本次录音的目的、用途与数据处理方式，并已取得其明确同意。
```

**③ 定稿的三条自检（改后逐条验）**：(a) 含「研究/归档目的」；(b) 不含「研究 / 归档」；(c) 不含「脱敏」（**P-4** 术语统一；来源侧用「不可逆处理」而非「完全脱敏」）。
**④ 两段的关系**：原内部规格的**两个承诺项**（`v1.5:129` 告知＋取得同意 ／ `v1.5:130` 完成签署并对真实性负责）语义**不减**，分别落到 **②勾选句**与 **①正文末句**（**PRD §3 A1-s** 已登记该分配方式）。

### 0.7 编码 / 行尾（**按文件现状保持，禁归一**）

| 项 | 现状（2026-10-09 实测） | 本批口径 |
| --- | --- | --- |
| `interview-upload-form.tsx` 行尾 | **纯 LF**（`src/**` 实测纯 LF 73 个；`core.autocrlf=false`、**无 `.gitattributes`**） | **禁止**把 LF 归一为 CRLF（否则整份 998 行 diff，复核失效） |
| 该文件 BOM | **无 BOM** | 不增不删 BOM |
| 本单与 PRD 文档 | `docs/**` ＝ **CRLF** | 两份新文档**须 CRLF**（与 `docs/需求登记表.md`／`docs/tasks/*.md` 一致；校验见 §5.2） |

### 0.8 同文件串行纪律（**本批须为下一手唯一批**）

`src/components/upload/interview-upload-form.tsx` 为**多批共用热点文件**：UI-05（隐私模块）／UI-14（保密级别）／UI-30（上传页字段标签变体）／BUG-11／REQ-28-D 后续均落此文件。

- 开工前：`git status --short` **必须干净**、`git rev-parse HEAD` 与 §0.1 基线一致（或已知后继）。
- 实施中：**不得**「顺手」改动其它段落（哪怕发现可疑文案 → 记录、另开单）。
- 收工后：`git status --short` 只允许出现 **1 个** `src/**` 文件（`interview-upload-form.tsx`）。

---

## §1 改动清单（**2 处 · 5 行 · 1 文件** · 行号＝本轮实测 `c6e2066`）

### 1.1 D-09 正文（`:167-169`）

| 项 | 内容 |
| --- | --- |
| 落点 | `:167` `<p>`｜**`:168` 文本行**｜`:169` `</p>`（`:166` 为 `.soft-scroll` 容器开标签） |
| 现状（`:168` 逐字） | `本平台会对本次口述音频进行本地转写、AI 整理与隐私脱敏处理，处理结果仅用于研究/归档目的。上传前，请确认您已向受访者完整说明上述用途。` |
| 目标（`:168` 逐字） | 见 §0.6 ①（**单行、不换行**） |
| 操作 | **只替换 `:168` 这一行的文本节点**；`:167` / `:169` 标签行**零改动** |
| 净行数变化 | **0**（替换而非增删） |
| 关联 | REQ-28 **D-09**（`PRD_REQ-28` L132，P-1 冻结 → A5 解冻） |

### 1.2 D-10 勾选句（`:179-182`）

| 项 | 内容 |
| --- | --- |
| 落点 | `:179` `<span>` 开标签｜**`:180` ＋ `:181` 两行 JSX 文本**｜`:182` `</span>`（外层 `<label>` `:172`、`<input>` `:173-178`） |
| 现状（`:180-181` 逐字，跨两行） | `我确认已获得受访者的口头或书面知情同意，受访者已了解本次口述内容将被录音、转写、AI` ＋ `整理，并同意在脱敏处理后用于研究/归档目的。`（JSX 折叠后渲染为「…AI 整理，并同意…」） |
| 目标 | 见 §0.6 ②（**单行、不换行**） |
| 操作 | 用**新单行**替换 `:180-181` 两行 ⇒ **净行数变化 −1**（其后所有行号 **−1**；`:182` 起 `</span>` 上移一行） |
| 关联 | REQ-28 **D-10**（`PRD_REQ-28` L133，同上解冻） |

> ⚠ **行号位移提示**：因 1.2 净减 1 行，改动后**同一文件后续行号整体 −1**（例如 `</span>` 由 `:182` → `:181`；「请先勾选知情同意」由 `:187` → `:186`；「我确认」按钮由 `:206` → `:205`）。**复核一律按逐字锚点，不按旧行号**。若 DS 选择「保留两行书写」，必须断在**逗号后**且**不得**让断点落入「研究/归档目的」中间（否则折叠出空格 → 破护栏 ②），**仍须**保证渲染文本与 §0.6 ② 逐字一致。

### 1.3 diff 形态（`git diff --stat` 预期）

```text
 src/components/upload/interview-upload-form.tsx | 4 +-   （1 处 1 行替换 ＋ 1 处 2 行 → 1 行）
 1 file changed, 2 insertions(+), 3 deletions(-)
```

**判失败形态**：`git status --short` 出现第 2 个 `src/**` 文件；diff 中出现任何 `className` / `data-*` / `aria-*` / `<input` / `<label` / `<Button` 行；`src/lib/**` 或 `src/app/**` 出现改动。

---

## §2 不动清单（防「顺手改」）

### 2.1 同文件（`interview-upload-form.tsx`）

| 区段 | 行 | 内容 | 为何不动 |
| --- | --- | --- | --- |
| 弹窗构件与 portal | `:92-145` | `ConsentDialog` 定义、`createPortal`、挂 body 的两条理由注释 | REQ-14 交付物；结构已定形 |
| 遮罩 / 对话框 | `:138-142`、`:147-152` | `data-upload-modal="consent"`、`role="dialog"`、`aria-*`、点遮罩取消 | 护栏 ③（`verify-phase3.mjs` I2_PROBE 按此定位） |
| 眉标 / 标题 | `:154-164` | `知情同意确认`（eyebrow）＋ `知情同意书`（`id="consent-dialog-title"`） | REQ-28 未列改；非本批范围 |
| 滚动容器 | `:166` | `.soft-scroll mt-3 max-h-[min(55vh,24rem)] overflow-y-auto …` | 护栏 ③（`:347-349` 判上限与 `auto`） |
| 勾选控件结构 | `:172-179`、`:182-183` | `<label>` / `<input type="checkbox">` / `checked`/`onChange` / `<span>` 标签 | 只换 `<span>` 内文本 |
| 未勾提示 | `:185-189` | `请先勾选知情同意` | D-11 已落地文本（**保持**） |
| 按钮区 | `:191-208` | 「取消」`取消` / 「我确认」`我确认` / `disabled={!checked}` | 护栏 ③ |
| 逻辑与行为 | `:108-125`、`:297-299`、`:464-484` | Esc 取消；关闭即卸载；每次重弹重置勾选态；`handleFormSubmit` 的 `setConsentOpen(true)` 分支 | 行为契约（PRD §4.4） |
| 其它文案（非弹窗） | `:403` 等 | 「请先选择一段受访音频。」等 | REQ-28 已收口或另批范围 |

### 2.2 其它文件 / 目录

- `src/lib/**`、`src/app/**`、`src/components/**`（除本文件）、`projects/**`：**零改动**。
- `docs/**`：本批**只新增**两份文档（本单 ＋ PRD）；**不改** `docs/需求登记表.md`（其同步放**放行后另批**，见 §6）。
- `tmp/**`：**0 行必改**（§3）；仅**新增** 1 支只读断言（§4）。`tmp/**` 被 `.gitignore:54` 屏蔽、不入库。
- 外部依据两份 `.docx`（`1.内容\`）：**只读**，本批与再批均**不得改动**（指纹唯一真值）。

---

## §3 探针影响面：**0 行必改**（四条实测依据）

### 依据 ① `tmp/cdp-req14-consent.mjs` —— 唯一直接锚在弹窗上的探针，逐行核过

| 行 | 现状（逐字） | 与本批关系 |
| --- | --- | --- |
| `:146-158` | `scrollBox()`：`const el = d.querySelector('.soft-scroll')` → `:155 hasFixedText: el.textContent.includes('研究/归档目的')`、`:156 hasSpacedText: el.textContent.includes('研究 / 归档')` | **护栏 ①②**；作用域 ＝ **正文容器**，**不含** `<label>` / `<span>`（勾选句） |
| `:166` | `bodyHas(t) { return document.body.textContent.includes(t); }` | 页面级取值工具 |
| `:167-169` | `placeholderHint()` 判「占位文案」/「待姚婷婷提供」 | 新文案**不含**这两个词 ⇒ 仍 `false` |
| `:170-172` | `inPageCard()`（`bodyHas('知情同意确认') && !dialog()`） | **全脚本未被任何 `check()` 调用**（`inPageCard` 仅出现在定义处）⇒ 无判定力 |
| `:299-309` | step3 · 弹窗**关闭态**：`cardCopy = bodyHas('本平台会对本次口述音频')` 期望 **false**；`checkboxes === 0`；`fixedLabel`/`spacedLabel`；`placeholders === false` | 新正文首句为「本平台会**把**本次口述音频」⇒ 旧串**恒不命中**；弹窗关闭时无 checkbox；其余两项与本批无关 |
| `:315-319` | `__t.info('开始处理')` / `__t.click('开始处理')` | 按钮字面（REQ-28-D 的 D-08 已落地）→ 与本批无关 |
| `:340-352` | `:343-345` 弹窗内 checkbox 数 ＝ 1 且初始未勾；`:346` 弹窗高度 ≤ 视口；`:347-349` `.soft-scroll` `overflowY === 'auto'` 且 `maxHeight` 为 px 且 ≤ 385；`:351-352` `hasFixedText === true && hasSpacedText === false` | 结构/容器未动；正文加长只在该滚动区内滚动 ⇒ `:346` 不受影响；`:351-352` ＝ **护栏 ①②**，定稿已满足 |
| `:354-360` | 「取消」关闭且 `posts === 0` | 按钮字面 + 行为，未动 |
| `:363-379` | 重开弹层（勾选态重置）／勾选 ＋「我确认」→ 发 POST | 同上 |

**依据 ① 结论**：**0 行必改**。

### 依据 ② `tmp/verify-phase3.mjs`（I2 / I3 段）

| 行 | 现状 | 与本批关系 |
| --- | --- | --- |
| `:714` | `const OPEN_CONSENT = \`window.__p3.clickText('开始处理')\`;` | **已是 REQ-28-D 换代后的字面**（`clickText` 只扫 `<button>`）→ 与本批无关 |
| `:727`、`:730-741` | 按 `[data-upload-modal="consent"]` 判 `position: fixed`、逃出 `.paper-panel`、铺满视口 | 结构锚点 → 未动 |
| `:820-841` | `I_HELPERS`：按 `[data-upload-modal="consent"]` 内 `input[type="checkbox"]` 与按钮 `innerText.trim() === '我确认'` 定位，只做 `cb.click()` / `btn.click()` | **不读正文 / 勾选句文本** → 未动 |

**依据 ② 结论**：**0 行必改**。

### 依据 ③ `tmp/cdp-req13-outline.mjs`（13-B 提交路径）

| 行 | 现状 | 与本批关系 |
| --- | --- | --- |
| `:359` | `find((x) => x.innerText.includes('开始处理'))` | 按钮字面 → 未动 |
| `:360-363` | 按 `[data-upload-modal="consent"]` 等弹窗出现；`:361` `cb.click()`；`:362-363` 按「我确认」等按钮可用并点击 | **不读正文 / 勾选句文本** → 未动 |

**依据 ③ 结论**：**0 行必改**。

### 依据 ④ 全域字面普查（`tmp/**` 全量 ＋ `src/**` 全量）

- **`src/**` 内「研究/归档目的」** 改前 **2 处**（`:168` 正文 ＋ `:181` 勾选句）→ 改后 **1 处**（只剩正文）⇒ 护栏 ① 的作用域是**正文容器**，仍为真；`:300` 那条「页面不含旧句」的断言也仍为真（旧句彻底消失）。
- **`tmp/**` 探针中对弹窗**文案**的字面引用**只有 4 处**，且**全部是「存在 / 不存在」判定**：`cdp-req14-consent.mjs:155`、`:156`、`:167-168`（占位词）、`:300`（旧句）——**没有一处**比对正文或勾选句的**全文 / 后缀 / 关键短语**。
- 其余脚本（含 `cdp-req28-labels.mjs`、`verify-ui29-docs-pos.mjs`、`verify-ui06-extref.mjs` 等）**零**引用本弹窗文案：`cdp-req28-labels.mjs` 的作用域是**访谈页**与上传页 `Audio` / `Confidentiality` 标签；`verify-ui06-extref.mjs` 只读 `docs/需求登记表.md` 字面 ＋ 外置文件指纹（本批**不改登记表** ⇒ 不受影响）。
- 复现命令（只读）：

```powershell
Select-String -Path 'tmp\*.mjs' -Pattern '研究/归档目的','研究 / 归档','本平台会对本次口述音频','我确认已获得受访者的' |
  ForEach-Object { '{0}:{1}  {2}' -f $_.Filename, $_.LineNumber, $_.Line.Trim() }
```

### §3 小结

| 探针 | 必改行数 | 依据 |
| --- | --- | --- |
| `tmp/cdp-req14-consent.mjs` | **0** | 依据 ① |
| `tmp/verify-phase3.mjs` | **0** | 依据 ② |
| `tmp/cdp-req13-outline.mjs` | **0** | 依据 ③ |
| `tmp/cdp-req13-prefill.mjs`、`tmp/cdp-req28-labels.mjs`、`tmp/verify-ui06-extref.mjs`、`tmp/verify-ui29-docs-pos.mjs` 等其余全部 | **0** | 依据 ④ |
| **合计** | **0 行** | —— |

> 本批**不做**「备份探针」动作（无探针改动即无需备份）；若实施中发现需要改动任一探针 ⇒ **立即停手、回总管**（说明 §3 论证有误，不得自行改探针）。

---

## §4 新增只读断言：`tmp/cdp-ui06-consent-copy.mjs`（**不入库**）

**目的**：把本批「逐字定稿」从**人工比对**升级为**机器断言**，同时覆盖「文档 ↔ 代码」一致性与三条护栏。**只读**（不改 DOM、不提交、不打桩 POST；仅导航 ＋ 点按钮开弹窗）。

**做法**：CDP 连接 / 导航 / `ev()` / `waitFor()` / `inject()` 等管道**直接照搬** `tmp/cdp-req14-consent.mjs`（同一登录 → 分流「上传音频」→ step3 → 选音频的路径），只替换断言段。

### 4.1 文档侧断言（先跑，不依赖浏览器）

```js
const EXPECT = {
  body: '本平台会把本次口述音频转写为文字并整理归档，处理结果仅用于研究/归档目的；采集与 AI 处理由系统执行、经人工复核，可定位到个人的字段做不可逆处理，不保留“明文—映射表”；保存期限（原始音视频与可识别身份的文稿默认项目结束后 2 年）、云端服务与受访者的查阅、复制、更正、撤回同意及删除权利，依《个人信息处理说明》（更新日期 2026年10月8日）执行。上传前请确认您已向受访者完整说明上述用途，并已按要求完成知情同意书签署、对签署真实性负责。',
  tick: '我确认已向受访者说明本次录音的目的、用途与数据处理方式，并已取得其明确同意。',
};

// 每份文档里，定稿所在行应「≥1 且逐字一致」（IMPL 内 §0.6 与 §4.1 常量会出现两处，同值即可）
for (const [tag, p] of [
  ['PRD', 'docs/PRD_UI-06_知情同意弹窗.md'],
  ['IMPL', 'docs/tasks/IMPL_UI-06_知情同意弹窗.md'],
]) {
  const md = fs.readFileSync(p, 'utf8');
  const lines = md.split(/\r?\n/).map((l) => l.trim());
  for (const [k, head] of [['body', '本平台会把本次口述音频'], ['tick', '我确认已向受访者说明本次录音']]) {
    const hits = lines.filter((l) => l.startsWith(head));
    check(`U6-D ${tag} 定稿 ${k} ≥1 且逐字一致`,
      hits.length >= 1 && hits.every((l) => l === EXPECT[k]), `命中 ${hits.length}`);
  }
  check(`U6-D ${tag} 为 CRLF 且无 BOM`,
    !md.startsWith('\uFEFF') && (md.match(/(?<!\r)\n/g) || []).length === 0);
}
```

### 4.2 页面侧断言（弹窗打开态）

```js
const copy = await ev(`(() => {
  const d = document.querySelector('[data-upload-modal="consent"]');
  if (!d) return null;
  const scroll = d.querySelector('.soft-scroll');
  const label = d.querySelector('input[type="checkbox"]')?.closest('label');
  const body = scroll ? scroll.textContent.trim() : null;
  const tick = label?.querySelector('span')?.textContent?.trim() ?? null;
  const cs = scroll ? getComputedStyle(scroll) : null;
  return {
    body, tick,
    fixed: body ? body.includes('研究/归档目的') : null,
    spaced: body ? body.includes('研究 / 归档') : null,
    mask: body ? body.includes('脱敏') : null,
    tickFixed: (tick ?? '').includes('研究/归档目的'),
    boxes: d.querySelectorAll('input[type="checkbox"]').length,
    confirm: window.__t.info('我确认'),
    overflowY: cs?.overflowY ?? null,
    maxHeight: cs?.maxHeight ?? null,
    sidebarKept: Boolean(d.querySelector('.soft-scroll')) &&
      d.getAttribute('data-upload-modal') === 'consent' && d.getAttribute('role') === 'dialog',
  };
})()`);

check('U6-1 正文逐字 === 定稿', copy?.body === EXPECT.body, JSON.stringify(copy?.body));
check('U6-2 勾选句逐字 === 定稿', copy?.tick === EXPECT.tick, JSON.stringify(copy?.tick));
check('U6-3 护栏① 正文含「研究/归档目的」', copy?.fixed === true);
check('U6-4 护栏② 正文不含「研究 / 归档」', copy?.spaced === false);
check('U6-5 正文不含「脱敏」（P-4）', copy?.mask === false);
check('U6-6 勾选句不含「研究/归档目的」（允许，记档）', copy?.tickFixed === false);
check('U6-7 弹窗内 checkbox 数 === 1', copy?.boxes === 1, `count=${copy?.boxes}`);
check('U6-8 未勾时「我确认」禁用', copy?.confirm?.disabled === true);
check('U6-9 滚动区仍 auto 且 maxHeight ≤ 385px',
  copy?.overflowY === 'auto' && parseFloat(copy?.maxHeight) <= 385, `${copy?.maxHeight}`);
check('U6-10 护栏③ 结构锚点原样', copy?.sidebarKept === true);
```

### 4.3 弹窗**关闭态**断言（进入 step3、点「开始处理」**之前**取值）

```js
const closed = await ev(`(() => ({
  oldBody: window.__t.bodyHas('本平台会对本次口述音频'),
  oldTick: window.__t.bodyHas('我确认已获得受访者的'),
  placeholders: window.__t.placeholderHint(),
}))()`);
check('U6-11 页面无旧正文句（`:300` 同源）', closed.oldBody === false);
check('U6-12 页面无旧勾选句', closed.oldTick === false);
check('U6-13 页面无占位词', closed.placeholders === false);
```

> **判定项**：文档侧 **8 项**（U6-D 每份文档 4 项：`body`／`tick` 各 1 ＋ CRLF/BOM 1 …… 实际按脚本输出）＋ 页面侧 **13 项**（U6-1 ~ U6-13）。本单**只固定判定项**，不固定总数。**放行闸口**：全部 `ok`；任一 `FAIL` ⇒ 按 §6 回退**文案**（**不改断言** —— `IMPL_REQ-28-D` §3.6 第 4 条）。

---

## §5 验收（顺序不可颠倒：先改 `src/**` → 再跑静态 → 再跑探针 → 再人工复核）

- [ ] **5.0 基线**：`git rev-parse --short HEAD`（应含 `c6e2066` 或已知后继）；`npm run lint`、`npx tsc --noEmit` **各跑一次留基线**（只允许改后「无新增错误」）。
- [ ] **5.1 字面归零 / 就位**（用法同 `IMPL_REQ-28-D` §6：`[IO.File]::ReadAllLines` ＋ `Select-String -SimpleMatch`，**禁用** `Get-Content` 定位）：

| 组 | 字面 | 范围 | 期望 |
| --- | --- | --- | --- |
| ① | `本平台会对本次口述音频` | `src/**` | **0**（旧正文句消失） |
| ② | `我确认已获得受访者的` | `src/**` | **0**（旧勾选句消失） |
| ③ | `在脱敏处理后用于研究/归档目的` | `src/**` | **0** |
| ④ | `研究/归档目的` | `src/**` | **1**（只余正文；勾选句不再含） |
| ⑤ | `研究 / 归档`（带空格斜杠） | `src/**` | **0** |
| ⑥ | `本平台会把本次口述音频转写为文字并整理归档` | `src/**` | **1**（新正文就位） |
| ⑦ | `我确认已向受访者说明本次录音的目的、用途与数据处理方式` | `src/**` | **1**（新勾选句就位） |
| ⑧ | `脱敏` | **弹窗区段**（`interview-upload-form.tsx:92-214` 内） | **0**（P-4；同文件其它区段的 `脱敏` 属 UI-05 / P-4 余项，**不计入**本组） |

- [ ] **5.2 文档一致性**：两份新文档 **CRLF ＋ 无 BOM**；`node tmp/check-ui06-docs.mjs`（**新建**只读校验，断言 PRD §4 ↔ IMPL §0.6 逐字同源、定稿行不含「研究 / 归档」与「脱敏」、A1/A5 裁决与授权原文在位、两文档双向互引）→ **全绿（起草时实测 24/24）**；`node tmp/verify-ui06-extref.mjs` 仍 **32/32**（本批**不改** `docs/需求登记表.md`）。<br>※ `node tmp/verify-doc01.mjs` **不纳入本批放行判定**：其基线是 DOC-01 轮的 v2.6，现已过期（现存 4 条 FAIL ＝ `A1 版本号` ＋ 三项行数增长，**均属既有、与本批无关**；本批只要求「失败数不新增」）。
- [ ] **5.3 静态检查**：`npx tsc --noEmit` **无新增**；`npm run lint` **无新增**（本仓 lint ＝ `eslint`，无 prettier 回写）。
- [ ] **5.4 既有探针回归**（全部应绿，且**其脚本本身不得被改动**）：
  - `node tmp/cdp-req14-consent.mjs` ✔ —— 重点看 `step3: consent card removed from page`（`:306`）、`checkbox lives inside dialog only`（`:343-345`）、`dialog fits viewport`（`:346`）、`scroll region capped & scrollable`（`:347-349`）、**`dialog copy uses cleaned slash`（`:351-352` ⇒ 护栏 ①②）**；
  - `node tmp/cdp-req13-outline.mjs` ✔（`:359-363` 路径）；
  - `node tmp/verify-phase3.mjs` ✔ —— **须确认 `OPEN_CONSENT` 步骤真实点击成功**（`clickText` 静默 false 风险，见 `IMPL_REQ-28-D` §2 末）；
  - `node tmp/cdp-req13-prefill.mjs` ✔（回归）；`node tmp/cdp-req28-labels.mjs` 全绿（作用域不在本弹窗）。
- [ ] **5.5 新增断言**：`node tmp/cdp-ui06-consent-copy.mjs` → **全绿**（§4；含文档侧 8 项）。
- [ ] **5.6 diff 审查**：`git status --short` → 只有 **1 个** `src/**` 文件 ＋ **2 个**新增 `docs/**` 文件；`git diff --stat` 与 §1.3 形态一致；`src/lib/**`、`src/app/**` 零改动；`tmp/**` 不入库。
- [ ] **5.7 人工视觉复核**：`/projects/new` → 分流「上传音频」→ 步骤 3 → 选音频 → 点「开始处理」→ 弹窗：**正文一段（约 215 字，滚动区不溢出）**、**勾选句一行**、未勾时「我确认」灰、未勾提示「请先勾选知情同意」；勾选后可确认；Esc ／ 点遮罩 ／「取消」三路关闭；重开弹窗勾选态重置。
- [ ] **5.8 文档留痕**：PRD §4 与 IMPL §0.6 的逐字文案**逐字符一致**（由 5.5 的 U6-D* 组自动断言）。
- [ ] **5.9 越界复核**：PRD §3 A3／A4／§5 的「不做清单」逐条确认未被顺手实现（无第二 checkbox、无留痕字段、无模板下载入口）。

---

## §6 交付边界

### 6.1 本批 commit 范围（**恰好 3 个文件**）

| # | 文件 | 变更 |
| --- | --- | --- |
| ① | `src/components/upload/interview-upload-form.tsx` | **2 处 / 5 行**（`:167-169` 正文、`:180-182` 勾选句） |
| ② | `docs/PRD_UI-06_知情同意弹窗.md` | **新增**（本批文档） |
| ③ | `docs/tasks/IMPL_UI-06_知情同意弹窗.md` | **新增**（本单） |

- `tmp/**` 受 `.gitignore:54` 屏蔽 ⇒ 新增断言脚本**不入库**（与既有探针一致）。
- 建议 message：`UI-06: 知情同意弹窗文案正式化（D-09/D-10 摘要替换）`（如总管要求与 REQ-28 关联，可加脚注 `REQ-28 P-1 解冻执行`）。

### 6.2 判失败条件

| # | 触发 | 说明 |
| --- | --- | --- |
| ① | `git status --short` 出现**第 2 个** `src/**` 文件 | 越界（§0.3） |
| ② | diff 中出现 `className` / `data-*` / `aria-*` / `<input` / `<label` / `<Button` 行 | 结构越界（A5 只授权字面） |
| ③ | 5.1 组 ① ② ③ ⑤ 任一 ≠ 0，或组 ④ ≠ 1 | 替换不彻底 / 空格斜杠混入 |
| ④ | 5.4 任一探针变红 | 护栏被破 ⇒ **回退文案**（不改探针） |
| ⑤ | `src/lib/**` / `src/app/**` 出现改动 | 越界 |

### 6.3 回滚

纯字面替换 ⇒ `git revert <commit>` 即可完全复原（无数据迁移、无状态残留）。若仅探针变红：**先回退文案**（保持旧句），再回总管复核 §3 论证。

### 6.4 本批**不涉及**

- `docs/需求登记表.md` 的同步（见 6.5）；REQ-28 其余冻结项（含 D-11 已落地文本）；UI-05 / UI-14 / UI-30 / BUG-11 等共用本文件的批次；帮助入口批次；`src/lib/**`（含 `oral-history.ts`、`server/project-store.ts`）；外部两份 `.docx`（只读）。
- **不做**「顺手」修正：发现其它可疑文案 → **只记录、另开单**（§0.8）。

### 6.5 放行后**另批**：登记表同步清单（**不与本批混 commit**）

| # | 位置 | 现文 | 待改为 |
| --- | --- | --- | --- |
| ① | `docs/需求登记表.md` §1.2 UI-06 行（L87） | `候选（待 PRD）` | `**已完成**（commit <hash>，2026-10-XX）`（按全表口径） |
| ② | §三 UI-06「落地状态」（L680） | 「弹窗现仍为占位文案…替换动作在 UI-06 PRD 批执行」 | 「**已落地**：正文／勾选句替换为 `06 知情同意书.docx` ＋ `个人信息处理说明.docx` 摘要，见 `docs/PRD_UI-06_知情同意弹窗.md`；commit `<hash>`」 |
| ③ | §三 UI-06 现状锚点（L679） | `:167-169` / `:180-182` / `:92` | 复核行号（勾选句替换后**同文件后续行号 −1**，见 §1.2） |
| ④ | §5.1（L1046）UI 组行备注 | 「文案来源（同意书 ← …）」 | 追加「UI-06 **已落地**（`<hash>`）」 |
| ⑤ | §5.2 关联条（L1107） | 「后续任何批次改动弹窗文案，须同批更新指纹或注明沿用原文件」 | 追加「本批为**首例执行**：沿用原文件、指纹不变」 |
| ⑥ | 登记表版本头 / 变更记录 | v2.9 | v2.10（含本次同步摘要） |

> 另：`docs/PRD_UI-06_知情同意弹窗.md` §8 的 5 条「待确认」**不阻塞**本批；其中 ②③ 若总管改判，属**文案变更**（须重走 §0.6 与 §5）。

---

## 附：依据来源

- **总管 2026-10-09 两项裁决**：裁决 ①（正文取 B1 ＋ 来源三方分项标注）／裁决 ②（明文解冻 D-09/D-10，范围 2 处 5 行）—— 原文照录于 **§0.4** 与 `docs/PRD_UI-06_知情同意弹窗.md` §3 A1／A5。
- `docs/PRD_UI-06_知情同意弹窗.md`（**PRD 定稿**）：§2 来源与指纹／§2.4 06 号两套文本结构／§3 裁决 A1–A7／§4 逐字定稿与来源列／§4.4 行为契约／§6 互引边界／§7 验收要点／§9 风险。
- `docs/需求登记表.md` v2.9：§三 UI-06（L657-680：外部依据、指纹、唯一真值声明、现状锚点、落地状态）／§1.2 L87／§5.1 L1046／§5.2 L1107。
- `docs/PRD_REQ-28_文案清理.md`：L132／L133（D-09／D-10）、L193（P-1）、L196（P-4）、L38（R4）。
- `docs/tasks/IMPL_REQ-28-D_上传音频文案与UI-05.md`：§0.1（行号口径）、§0.7（红线冻结 L62-66）、§1.6（红线块抄录 L141-145）、§2（探针纪律与静默 false 风险）、§3.6（文案 vs 断言的回退纪律）、§4.6（diff 边界）、§6（字面归零脚本）。
- 内部规格（仓库内）：`docs/记忆引擎_产品使用流程说明文档_v1.5.md:128-133`、`docs/记忆引擎_产品设计与技术规格文档_v2.1.md:232-244`。
- 外部依据（外置、不入 git，指纹见 PRD §2.3）：`06 知情同意书.docx`（个人 / 家庭版）、`个人信息处理说明.docx`。
- 代码与探针实测（HEAD `c6e2066`，2026-10-09，只读）：`src/components/upload/interview-upload-form.tsx:92-214`；`tmp/cdp-req14-consent.mjs:140-177 / 290-360`；`tmp/verify-phase3.mjs:700-745 / 820-841`；`tmp/cdp-req13-outline.mjs:340-370`；`tmp/verify-ui06-extref.mjs`；**`tmp/**` 全量字面普查：48 支脚本、67 行命中**（依据 ④）。

**变更记录**

| 日期 | 版本 | 变更 |
| --- | --- | --- |
| 2026-10-09 | 初稿 | 起草本单：§0 口径（行号/纪律/纯字面批/A5 授权原文/探针 0 行必改＋三护栏/逐字定稿/行尾/串行纪律）；§1 改动清单（2 处 5 行）；§2 不动清单；§3 探针影响面四条实测依据；§4 新增只读断言（含文档一致性）；§5 验收；§6 交付边界与登记表另批清单 |




