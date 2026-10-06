# REQ-28-D 实施任务单 · 上传音频文案清理 ＋ UI-05 隐私模块（同批划界）

> 伞需求 REQ-28（KIMI 全站文案审查）的 **D 批**：上传音频全流程（上传页页头 → 上传卡片 → 知情同意弹层），并**同批完成 UI-05 的划界**。
>
> - **本文档只写计划**：不改代码、不产生 commit。实施轮按 §1 改 `src/**`、按 §2 改 `tmp/**` 探针（探针不入库）。
> - **关联**：`docs/PRD_REQ-28_文案清理.md` §3 R1–R5（L28–38）｜§4 REQ-28-D 12 条（L120–135）｜§5 P-1／P-4（L193／L196）｜`docs/tasks/IMPL_REQ-28_文案清理.md` §0.2-D3／D4（L39–40）、§2.4（L144–159）、§3.2（L245–259）、§3.4（L276–286）、§3.6（L301–307）、§4.5（L377–389）、§5.1／§5.2／§5.3／§5.6／§5.7｜`docs/需求登记表.md` UI-05（L561–569）。
> - **规模**：PRD 12 条 → **可执行 9 条**（D-01 ~ D-08、D-11）＋ **红线 2 条**（D-09／D-10，P-1 逐字不动）＋ **无代码落点 1 条**（D-12，随帮助批次）。9 条共 **10 处落点**（删除整行 ×2、替换 ×6、删句 ×1、结构守卫 ×1）＋ **授权连带 1 处**（❶ `:30` `mt-2` → `mt-3`）；**实际触及 14 行**（含守卫占 3 行）。
> - **落点文件**：**恰好 2 个** —— `src/components/upload/upload-workspace.tsx`、`src/components/upload/interview-upload-form.tsx`；**`src/lib/**`、`src/app/**`、`projects/project-workflow-board.tsx` 本批零改动**（裁决 ❺①；§4.6 diff 边界：`git status` 出现第 3 个 `src/**` 文件即判失败）。
> - **探针同步**：3 个文件、**7 行必改** ＋ **2 行注释（可选）** —— 与 IMPL §3.2（L251／L255／L258）**逐行吻合，无漏记项**（对照 A 批曾漏记 2 行）。
> - **行号基线**：2026-10-07 实测，HEAD = `15d6db2`（A 批已入库、工作树干净）→ **实施前须复核行号**（口径见 0.1③）。
> - **状态**：已裁决并放行（总管 **7 点**全判：6 点 ＋ ❼ `IMPL §4.5 L380` ＋ `§2.4 L149` 回写授权，2026-10-07；任务单全文放行）→ 待 DS 实施

> ✅ **两处均已确认（总管 2026-10-07）**：**0.2** D-05 ＝「删眉标 ＋ 改标题」（与 A 批裁决 ① 同口径，§4-9 备选保留供追溯、不切换）；**0.3** D-02 取「音频处理」，且 `IMPL §4.5 L380`／`§2.4 L149` 已授权回写（❼，与本单同 commit）。

---

## §0 口径说明

### 0.1 基线纠偏：IMPL §5.1 文字与实测不符（三处）

| # | IMPL §5.1 原文（L435–440） | 2026-10-07 实测（HEAD `15d6db2`） | 本批口径 |
| --- | --- | --- | --- |
| ① | 换行：「源文件与 `docs/tasks/*.md` 均为 **CRLF**」 | `src/**` 实测 **纯 LF 73 个**（含本批两文件）、**纯 CRLF 1 个**（`src/lib/server/enum.ts`）、**混合 3 个**（`src/app/not-found.tsx`、`src/components/ui/button.tsx`、`src/lib/server/upload-store.ts`）；`core.autocrlf=false`、**无 `.gitattributes`**、`git ls-files --eol` = `i/lf w/lf`。`docs/tasks/*.md` 确为 CRLF ✓ | **按文件现状保持原行尾**：本批两文件为纯 LF → **禁止**把 `\n` 归一为 `\r\n`（否则 998 行整份 diff，复核失效） |
| ② | BOM：「**`src/lib/types/project.ts` 带 BOM**；其余源文件无 BOM」 | 带 BOM 的源文件共 **9 个**：`app/layout.tsx`、`app/not-found.tsx`、`components/projects/project-workflow-board.tsx`、`components/ui/button.tsx`、`components/ui/status-badge.tsx`、`lib/server/storage.ts`、`lib/server/upload-store.ts`、`lib/types/project.ts`、`lib/utils.ts` | 逐文件原样保留，**不增不删 BOM**；本批两文件均无 BOM |
| ③ | 行号「以当前实测为准」（未给口径） | PS 5.1 `Get-Content` 把无 BOM 的 UTF-8 当 **GBK** 解码，会吞掉中文标点后的换行 → `interview-upload-form.tsx` 被算成 **927 行**（真值 **998**），偏差 **71 行** | 行号一律用 `[IO.File]::ReadAllLines` / `Select-String`；**禁用 `Get-Content` 定位** |

> 回写授权（裁决 ❻）：本单 §0.1 ＋ `IMPL_REQ-28_文案清理.md` §5.1 同 commit 回写（纯 docs，不触发重启）。

### 0.2 ⚠ D-05 落地形态 ＝ **「删眉标 ＋ 改标题」**（R5 去重）

- R5 原文（PRD L36）：**「标题 / 按钮已表达的信息不再重复；同一语义只出现一次」**，其现状反例正是 **「历史项目 ＋ 项目索引」**（eyebrow ＋ 标题同屏重复）→ A 批依 **裁决 ①** 落地为 **删除 eyebrow**（A 单 §1.2「A-04 ＝ A-06」）。
- D-05 现状 `受访音频`（eyebrow `:878`）＋ `上传音频材料`（标题 `:880`）与 A-04 / A-05 **同构** → 本单落地为 **`:878` 删除整行** ＋ **`:880` → `上传音频`**（两处同词会在同一卡片内重复「上传音频」，违反 R5）。
- **备选**（若总管原意为保留眉标）：`:878` 保留并替换为 `上传音频`（不改结构，一行）→ 见 §4-9；本单不采用（**总管 2026-10-07 确认：按裁决 ① 同口径照办**）。

### 0.3 ⚠ D-02 取「音频处理」（偏离 IMPL §4.5 L380 字面，以本单为准）

- PRD D-02 建议列为「上传音频（或 音频处理）」；**裁决 ❷** 定：D-02 → **`音频处理`**、D-05 → `上传音频` —— 因二者**同屏**（页面 h1 与上传卡片标题同屏），同词即撞 R5。
- **IMPL §4.5 L380 原写「D-02 / D-03 主标题为『上传音频』」与本单冲突，另 §2.4 L149 亦为二选一** → **均已授权回写（裁决 ❼，2026-10-07）**：L380 →「D-02 h1 →『音频处理』；D-03 副标题 →『上传录音后自动转写整理』（PRD 目标字面）」、L149 →「音频处理」＋备注注明未取备选；回写与 §5.1 同 commit（纯 docs，见 §5）。
- 佐证：`音频处理` 改前全域 **0 命中**（无术语撞车）；`上传音频` 已是分流卡既有术语（`src/components/new-project/route-chooser.tsx:238`）→ D-05 与之同词（R4 同词表）。

### 0.4 UI-05 同批的 4 条硬边界（裁决 ❺）

| # | 硬边界 |
| --- | --- |
| ① | 只动 `interview-upload-form.tsx`；**不入 `src/lib/**`** —— `lib/oral-history.ts` 的 `redactionRuleOptions` / `privacyLevelOptions` / `applyRedactionProfile` / `maskByRules` **禁止改动** |
| ② | 提交的 `customRedactionRules` 默认值**逐字不变**（`defaultRules` `:49–54` 与 `:285–286` 不动；服务端兜底 `lib/server/project-store.ts:92–96` 不动） |
| ③ | 「一键最强脱敏」**本批不做** → 登记为 UI-05 后续项（§3.3①），待独立 PRD 开单 |
| ④ | `cdp-req13-prefill.mjs:94 / :108 / :248`（返回工作台、高级设置自动展开）与 `cdp-req14-consent.mjs:407`（`customRedactionRules` 存在性）**须保持绿** |

> **UI-05 本批实际改动量 ＝ 0**（结构已成立，其剩余增量属交互 / 功能设计而非文案）→ §3 以「现状确认 ＋ 后续项登记 ＋ 零改动证明」收尾，**不强求凑改动点**。

### 0.5 改动纪律

- 只改**字符串字面量**（IMPL §5.2）：不改 JSX 结构、条件分支、props 名、导出、类型定义、状态键；不新增依赖 / 不改配置 / 不动样式文件。
- **本批仅 2 处例外（均已裁决）**：**❶** `upload-workspace.tsx:30` 的 `mt-2` → `mt-3`（删 eyebrow 后的必要间距连带，**A 批裁决 ❷ 同口径**）；**❸** `interview-upload-form.tsx:903–905` 加**最小守卫**（不留空 `<p>`，IMPL §5.2 明文）。
- 除此之外任何 `className` / 结构改动**判失败**（§4.6 据此审 diff）。

### 0.6 探针纪律（IMPL §3.6 五条）

文案与探针**同批同 commit**；只改 §2 清单内的定位字面；**红线断言零改动**（IMPL §3.4）；红线因文案变红 → **回退文案**、不改断言；改前备份到 `tmp/_backup_REQ28D/`（脚本见 §6）。

### 0.7 红线冻结（P-1）

- **D-09** `:165`（整段正文）／**D-10** `:177–178`（跨两行 JSX 文本）**逐字不动** —— 原文抄录见 §1.6。
- `cdp-req14-consent.mjs:300`（`bodyHas('本平台会对本次口述音频')`）改后**必须继续通过**。
- P-4「脱敏 → 隐私处理」**不回溯**这两条（PRD L38 要求口径一致，但因 P-1 暂不动 → 现文本中的「隐私脱敏」保持原样）。

### 0.8 同词副本一律不动（IMPL §0.2-D4）

| 字面 | 全域改前实测 | 本批只动 | 其余（**预期原状，不得判红**） |
| --- | --- | --- | --- |
| `记忆引擎` | 8 文件各 1 处 | `upload-workspace.tsx:29` | `app/layout.tsx`、`app/login/page.tsx`、`app/register/page.tsx`、`components/home/home-dashboard.tsx`、`lib/interview-prompt.ts`、`lib/writing-rules.ts`、`lib/server/project-export.ts`（共 7 处） |
| `受访音频` | 5 文件 8 处 | `interview-upload-form.tsx:878` | 同文件 `:403`「请先选择一段受访音频。」／`:901`「更换受访音频」；`app/not-found.tsx`、`app/api/projects/route.ts`、`app/projects/[projectId]/page.tsx`、`lib/types/project.ts`（共 7 处） |
| `普通话` | 2 文件 | `interview-upload-form.tsx:58` | `lib/interview-prompt.ts:67`（生成侧） |
| `上传音频` | 2 文件 3 处 | 新增 `interview-upload-form.tsx:880` | `route-chooser.tsx:238`（分流卡）、`interview-upload-form.tsx:242`（代码注释） |

### 0.9 编码 / 换行（纠正版）

UTF-8 **无 BOM**；**按文件现状保持 LF**（本批两文件），**不做 CRLF 归一**（0.1①）；`docs/tasks/*.md` 为 CRLF（本单同规格）。

### 0.10 选词定稿（**逐字**，实施中不得再改；改选须回总管）

| 编号 | 目标字面 | 编号 | 目标字面 |
| --- | --- | --- | --- |
| D-01 | ——（删除，无替换） | D-07 | `提交后开始处理` |
| D-02 | `音频处理` | D-08 | `开始处理` |
| D-03 | `上传录音后自动转写整理` | D-09 | ——（**逐字不动**，P-1） |
| D-04 | `普通话` | D-10 | ——（**逐字不动**，P-1） |
| D-05 | `上传音频` | D-11 | `请先勾选知情同意` |
| D-06 | ——（删除：`return "";`） | D-12 | ——（无代码落点，随帮助批次） |

---

## §1 改动清单（9 条 · 10 处落点 · 实际触及 14 行 · 2 文件 · 行号＝本轮实测）

### 1.1 上传页页头（`src/components/upload/upload-workspace.tsx` · D-01 / D-02 / D-03 ＋ ❶）

| 编号 | 落点（行） | 现状字面（逐字） | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **D-01** | `:29` | `<p className="section-eyebrow mt-3">记忆引擎</p>`（**整行**） | ——（**删除整行**） | 该行是独立整元素 → 删后不留空标签；探针 **0 断言**（全域 `记忆引擎` 在 35 支 live 探针中仅出现于 `convert-deerlight` / `fill-ch1` / `fill-ch4` / `fill-deepseek` / `insert-ch7-status` / `reformat-arch-doc` 等**文档生成工具**，无界面断言） |
| **❶** | `:30` | `className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem] md:text-[2.35rem]"` | `mt-2` → **`mt-3`** | 删 `:29` 后 h1 的上邻元素变为 `:22–28` 的「返回工作台」`<Link>`（同处 `:21` 的 `<div>`）→ 间距补偿；**裁决 ❶**，与 A 批 ❷ 同口径，**本批唯一授权的 className 改动** |
| **D-02** | `:31` | `音频建档与处理` | `音频处理` | 页面 h1；为何不取「上传音频」见 **0.3** |
| **D-03** | `:34` | `填写受访人基础信息，上传本地音视频文件，进入自动转写与整理流程。` | `上传录音后自动转写整理` | `:33` 的 `<p className="mt-2 max-w-4xl …">` 容器不动 |

**不动**：`:22–28`「返回工作台」`<Link>`（`cdp-req13-prefill.mjs:94`、`verify-phase2.mjs:217` 断言其存在）、`:18–19` 装饰 `<span />` 与收尾 `</div>`、`:40` 起 `<section>` 与 Suspense 包裹。

### 1.2 上传卡片标题（`src/components/upload/interview-upload-form.tsx:875–883` · D-05）

| 编号 | 落点（行） | 现状字面（逐字） | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **D-05a** | `:878` | `<p className="section-eyebrow">受访音频</p>`（**整行**） | ——（**删除整行**） | R5 去重 → **0.2**（A-04 / A-05 同构先例；探针 0 断言，见 §2 末「无子串冲突」） |
| **D-05b** | `:880` | `上传音频材料` | `上传音频` | `<h3>` 内文本行；与分流卡 `route-chooser.tsx:238` 同词（R4 同词表） |

**不动**：`:876` 外层 `flex items-center justify-between gap-3`（F 批已移除右侧英文标签，现仅剩单子元素 → 不改结构）、`:879` h3 的 `mt-1.5`（**本批 className 改动上限 2 处**，且该行位于块级 `<div>` 内、上方无相邻元素，6px 属可接受 → **若须调整须回总管**）、`:885–917` 拖放按钮 / 隐藏 `input`、`:901`「更换受访音频 / 选择音频文件」。

### 1.3 语言选择默认值（同文件 · D-04）

| 编号 | 落点（行） | 现状字面（逐字） | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **D-04** | `:58` | `{ value: "cn", label: "普通话（默认）" },` | `{ value: "cn", label: "普通话" },` | **只改 `label`**；`value: "cn"` 不动（`:56` 注释说明 `languageOptions` 是转写 `language` 参数取值 → 改 value 会改行为）；`:59–62` 其他选项不动；`普通话` 另一处 `lib/interview-prompt.ts:67` 属生成侧 → 不动 |

### 1.4 底部说明与主按钮（同文件 · D-11 / D-07 / D-08）

| 编号 | 落点（行） | 现状字面（逐字） | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| **D-11** | `:184` | `请先勾选知情同意确认，才能创建项目并开始处理。` | `请先勾选知情同意` | 弹层内未勾选提示；`:182` 条件 `{!checked ? (…) : null}` 与 `:183` `<p>` 容器不动；探针 **0 断言** |
| **D-07** | `:934` | `提交后将直接开始本地音频转写、AI 整理与隐私脱敏处理。` | `提交后开始处理` | `:930–934` 三元式的**第三分支**；`:931`（step 1）与 `:933`（step 2）两分支不动 |
| **D-08** | `:979` | `创建项目并开始处理` | `开始处理` | 提交按钮文案；`:972–982` 的「上传中… / 静态」两态中**只改 `:979`**；`:975`「上传中…」、`:970` `disabled`、`:980` 图标不动 |

### 1.5 上传区格式句（同文件 · D-06 ＋ ❸ 守卫）

| 步骤 | 落点（行） | 内容 | 处置 |
| --- | --- | --- | --- |
| ① | `:322–324` | `if (!audioFile) { return "支持 mp3、wav、m4a、aac、flac、ogg 等常见音频格式。"; }` | **只把返回字面改为 `return "";`** → 保留早退分支，`useMemo` 返回类型仍为 `string`，**不新增变量 / 不改依赖 `[audioFile]`** |
| ② | `:903–905` | `<p className="mt-1.5 text-sm leading-6 text-muted">{helperText}</p>` | 包为 **`{helperText ? (<p className="mt-1.5 text-sm leading-6 text-muted">{helperText}</p>) : null}`** —— **裁决 ❸** 授权的最小守卫（`className` 不变；`:899` 包裹 `<div>` 与父容器不动） |
| ③ | `:327` | 模板字面 `已选择：${audioFile.name}，${sizeInMb} MB` | **不动**（选文件后仍有反馈；`cdp-req14-consent.mjs:313` 断言 `bodyHas('probe-req14.wav')` 依赖此分支） |

**不动**：`:48` `acceptedAudioExtensions` 与 `:913` `accept={acceptedAudioExtensions}`（**非界面文案** → 格式能力保留）、`:885–917` 拖放结构、`:891–898` 图标三态、`:922–926` `error` 区块。
> 同屏 `<details>`（`:698–801`，含隐私保护模块）属 **UI-05 面** → 本批不动（IMPL §2.4 L153 / §4.5 L389）。

### 1.6 红线块（**逐字不动**，抄录留档）

- `:163–167` 滚动容器内正文 `<p>`（文案在 `:165` 单行）：`本平台会对本次口述音频进行本地转写、AI 整理与隐私脱敏处理，处理结果仅用于研究/归档目的。上传前，请确认您已向受访者完整说明上述用途。`
- `:169–180` 勾选 `<label>` → `:176–179` `<span>`（**跨 `:177` ＋ `:178` 两行 JSX 文本**）：`我确认已获得受访者的口头或书面知情同意，受访者已了解本次口述内容将被录音、转写、AI 整理，并同意在脱敏处理后用于研究/归档目的。`
- 弹层构件：`ConsentDialog` 定义起点 `:92`、portal 渲染 `:134`、`data-upload-modal="consent"` `:136`、按钮「我确认」→ **零改动**。

### 1.7 不动清单（防「顺手改」）

- `interview-upload-form.tsx`：`:56` 注释（含供应商名）、`:242` 注释（含「上传音频」）、`:403`「请先选择一段受访音频。」、`:901` 触发按钮文案、`:931` / `:933` 其余两分支、`:975`「上传中…」、`:946` 起「返回上一步」、**全部 `data-*`**（`:487` `data-upload-flow`、`:941` `data-upload-back` …）、全部 `id`（`#language` / `#privacyLevel` / `#institutionName` / `#researchFocus` / `#outlineDraftMarkdown` …）与 `aria-label`。
- 全域同词副本 → **0.8** 表（`记忆引擎` 另 7 处、`受访音频` 另 7 处、`普通话` 另 1 处、`上传音频` 另 2 处）。
- 其它文件：`src/lib/**`、`src/app/**`、`projects/project-workflow-board.tsx`、`docs/**`（除 §5 授权的 `IMPL §5.1` 回写）。

---

## §2 探针同步（3 文件 · 7 行必改 ＋ 2 行注释可选）

> **读前必读（定位语义，决定改法）**：
> - `cdp-*.mjs` 的 `window.__t.find(t)` ＝ `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)` → **只在 `<button>` 内精确相等**；找不到时 `__t.click` **throw**、`__t.info` 返回 `null`。
> - `verify-phase3.mjs:118–121` 的 `__p3.clickText(t)` ＝ `[...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes(t))` → **只在 `<button>` 内子串**；找不到时**返回 false、不报错**。
> - 两者**都只扫 `button`** → 页面上的同名 `<p>` / `<span>` 文案不会误命中。
> - 下表「现状」列中的 JS **模板字面外层反引号已从略**，其余逐字照抄。

| 探针 | 行 | 现状（逐字） | 同步改法 | 关联 |
| --- | --- | --- | --- | --- |
| `tmp/verify-phase3.mjs` | `714` | `const OPEN_CONSENT = window.__p3.clickText('创建项目并开始处理');` | `'开始处理'` | D-08 |
| 同上 | `908` | `hasSubmit: [...document.querySelectorAll('button')].some((b) => b.innerText.includes('创建项目并开始处理')),` | `'开始处理'` | D-08 |
| `tmp/cdp-req13-outline.mjs` | `347` | `await ev((() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('创建项目并开始处理')); if (b) b.click(); return true; })());` | `'开始处理'` | D-08 |
| `tmp/cdp-req14-consent.mjs` | `315` | `const submitInfo = await ev(__t.info('创建项目并开始处理'));` | `'开始处理'` | D-08 |
| 同上 | `319` | `await ev(__t.click('创建项目并开始处理'));` | `'开始处理'` | D-08 |
| 同上 | `363` | 同上（重开弹层 · 勾选态重置路径） | `'开始处理'` | D-08 |
| 同上 | `379` | 同上（勾选 ＋「我确认」→ 发 POST 路径） | `'开始处理'` | D-08 |
| 同上（**注释，可选** ❹） | `2` | `//   1) Step 3 点「创建项目并开始处理」→ 弹窗出现，且此刻不发 POST /api/projects` | 「开始处理」 | D-08 |
| 同上（**注释，可选** ❹） | `311` | `// ── 选音频后点「创建项目并开始处理」 ─────` | 「开始处理」 | D-08 |

- **与 IMPL §3.2 对账**：`L251`（verify-phase3 `714` / `908`）、`L255`（cdp-req13-outline `347`）、`L258`（cdp-req14-consent `315` / `319` / `363` / `379` ＋ 注释 `2` / `311`）→ **7 行 ＋ 2 注释，逐行吻合，无漏记项** ✓
- **不动**：`tmp/_backup_REQ28A/**`、`tmp/_backup_REQ28B/**`（备份快照）、`tmp/run-batch1/**`、`tmp/verify/**`；`cdp-req28-labels.mjs`（见下条）。
- **红线行（改后必须仍绿，不得跟随改名）**：`cdp-req14-consent.mjs:300`（`bodyHas('本平台会对本次口述音频')` → D-09）、`:382`（`__t.info('我确认')`）、`:386`；`cdp-req13-outline.mjs:350`（`innerText.trim() === '我确认'` 精确相等）、`:348`（`[data-upload-modal="consent"]`）；`verify-phase3.mjs` 的「我确认」断言（`L830` / `L836`，IMPL §3.4 L281）。
- **无子串冲突（本轮实测结论）**：改造后 `开始处理` 在 `src` 内出现 2 处 —— 按钮 `:979` 与 D-07 句 `:934`「提交后开始处理」；但 `__t.find`（按钮内精确相等）与 `__p3.clickText`（只扫 `button`）**都不受 `<p>` 影响** → 探针可直接用 `'开始处理'`，**无需**加 `data-*`（IMPL §3.2 L243 的短词警示在本批不触发）。
- **REQ-28 专用探针无耦合（本轮实测）**：`cdp-req28-labels.mjs` 的 `eyebrows()` / `labels()` 断言只作用于**访谈页**（`:303–341`：ready 态与退出弹窗的「AI 访谈」计数、`.tape-label ≥ 1`）与上传页 `Audio` / `Confidentiality` 标签（REQ-28-F 面）→ D-01 / D-05 所删的「上传页 section-eyebrow」**不在其断言面**。`verify-phase2.mjs:215–216 / :226` 断言的是**独立提纲路由**首个 `.section-eyebrow` ＝「访谈准备」，与上传页无涉。
- **风险注**：`__p3.clickText` 找不到目标时**静默返回 false** → 若改了按钮文案却漏改探针，`verify-phase3` 会表现为「弹窗未出现」而**不是**显式报错；§4.4 须确认 `OPEN_CONSENT` 步骤真实点击成功。

---

## §3 UI-05 段（同批 · 现状确认 ＋ 后续项登记 · **零改动**）

### 3.1 结构现状（HEAD `15d6db2` 实测）

| 项 | 实测落点 |
| --- | --- |
| 模块位置 | `interview-upload-form.tsx:759–800` —— `:760` `<p className="section-eyebrow">隐私保护</p>` ＋ `:762` `<h3>自定义脱敏规则</h3>` ＋ `:766–798` 逐项复选（`redactionRuleOptions.map`：`:780` 隐藏 `input` ＋ `:786` 标签文本 ＋ `:787–795` 选中勾标） |
| 折叠状态 | **已在**「高级设置（选填）」`<details>` 内：`:698` 开标签、`:700` `open={advancedOpen}`、`:704` summary 文案「高级设置（选填）」、`:801` 闭标签 |
| 预设选择器 | `:723–741`：`<label htmlFor="privacyLevel">脱敏级别</label>` ＋ `<select id="privacyLevel">` 遍历 `privacyLevelOptions`（3 档，定义在 `lib/oral-history.ts`） |
| 默认值 | `privacyLevel` 默认 `"standard"`（`:284`）；`customRedactionRules` 默认 `defaultRules = ["phone","id_card","address","contact_account"]`（`:49–54` → `:285–286`） |
| 服务端兜底 | `lib/server/project-store.ts:92`（`privacyLevel` 兜底 `"standard"`）／`:95–96`（`customRedactionRules` 非数组兜底） |
| 提交链路 | `store/project-workspace.ts:91 / :96–97` → `app/api/projects/route.ts:99–101 / :115–116`（`ALLOWED_PRIVACY_LEVELS` 白名单 ＋ `parseCustomRedactionRules`） |

> **结论**：登记表 UI-05 的诉求「收敛为少量预设 ＋ 高级选项折叠」**结构上已成立**（预设选择器 ＋ `<details>` 折叠 ＋ 高级规则逐项复选均在）。其剩余增量属**交互 / 功能设计**（预设是否提到主界面、是否加「一键最强」、预设 ↔ 规则集是否联动），**不是文案**，且**无 PRD** → 本批**不实现**（裁决 ❺）。

### 3.2 本批对 UI-05 的处置

**零改动**。模块本体 `:759–800`、其默认值与提交链路**逐字不动**（4 条硬边界见 0.4）；仅在**同文件**内与 §1.5 D-06（`:322` / `:903`，上传区）相邻，互不影响。

### 3.3 登记为 UI-05 后续项（待独立 PRD 开单）

| # | 后续项 | 说明 |
| --- | --- | --- |
| ① | 「一键最强脱敏」 | 登记表「待确认」项；**本批不做**。开单时须先定关系：与 `privacyLevel = "strict"` 是否等价、是否复用 `applyRedactionProfile` / `maskByRules`（`lib/oral-history.ts` → **REQ-28 白名单外**） |
| ② | 预设 ↔ 规则集联动 | 现状 `privacyLevel`（`:284`）与 `customRedactionRules`（`:285`）**互不联动**（两组独立 state）。做联动＝改默认值 → 触登记表红线「默认值变动影响既有脱敏结果」，须独立 PRD ＋ 数据影响评估 |
| ③ | 折叠态窄屏复核 | 375 / 768px 下「高级设置」展开后的表单排布（`:707` `grid gap-4 md:grid-cols-2`）；本批未动结构 → **现状即基线** |
| ④ | 登记表陈旧行号修正 | UI-05 背景记 `:613–617`，实测落在 **UI-14「保密级别 / 档案可见范围」块**（`:606–659`，`Confidentiality` 在 `:617`）；隐私模块实为 `:759–800`。同批发现的 UI-06 refs（`:137–141` / `:151–152` / `:82–160` → HEAD 正文 `:164–166`、勾选 `:176–179`、`ConsentDialog` `:92`）与 UI-14 refs（`:46 …` → `:606–659`）一并登记 → 属**文档侧后续**，不在本批 |

### 3.4 零改动证明（验收口径）

- `git status --short` 中 `interview-upload-form.tsx` 只含 §1 的差异行（`:58` / `:184` / `:323` / `:880` / `:903–905` / `:934` / `:979`），**不出现** `:698–801` 与 `:759–800` 两个区段。
- 探针：`cdp-req13-prefill.mjs:94`（返回工作台）/ `:108`（高级设置折叠态读取）/ `:248`（高级设置自动展开）与 `cdp-req14-consent.mjs:407`（payload 含 `customRedactionRules`）**全绿**。

---

## §4 验收

> 顺序不可颠倒：先改 `src/**` → 再改探针（§2）→ 再跑验收。

- [ ] **4.0 复核基线**：`git rev-parse --short HEAD`（应为 `15d6db2`）；`npm run lint`、`npx tsc --noEmit` **各跑一次留基线**（只允许改后「无新增错误」）。
- [ ] **4.1 字面归零**（脚本见 §6）：

| 组 | 待归零字面 | 检索范围 | 期望 |
| --- | --- | --- | --- |
| ① | `记忆引擎` | `src/components/upload/upload-workspace.tsx` | 0（另 7 文件**预期原状** → 0.8） |
| ② | `音频建档与处理` | `src/**` | 0 |
| ③ | `填写受访人基础信息，上传本地音视频文件，进入自动转写与整理流程。` | `src/**` | 0 |
| ④ | `普通话（默认）` | `src/**` | 0 |
| ⑤ | `<p className="section-eyebrow">受访音频</p>`（**精确字面**） | `src/components/upload/interview-upload-form.tsx` | 0（裸字 `受访音频` 该文件仍有 2 处：`:403` / `:901` → **预期原状**，故须用精确字面） |
| ⑥ | `上传音频材料` | `src/**` | 0 |
| ⑦ | `支持 mp3、wav、m4a、aac、flac、ogg 等常见音频格式。` | `src/**` | 0 |
| ⑧ | `提交后将直接开始本地音频转写、AI 整理与隐私脱敏处理。` | `src/**` | 0 |
| ⑨ | `创建项目并开始处理` | `src/**` | 0（改前 2 处：`:184` 与 `:979`） |
| ⑩ | `请先勾选知情同意确认，才能创建项目并开始处理。` | `src/**` | 0 |
| ⑪ | `本平台会对本次口述音频`（**红线**） | `src/**` | **1（必须仍在，P-1）** |
| ⑫ | `我确认已获得受访者的`（**红线**） | `src/**` | **1（必须仍在，P-1）** |

- [ ] **4.2 新文案就位**（各 ≥1 命中）：`音频处理`（`:31`）、`上传录音后自动转写整理`（`:34`）、`上传音频`（`:880`，与 `route-chooser.tsx:238` 同词）、`label: "普通话"`（`:58`）、`提交后开始处理`（`:934`）、`开始处理`（`:979`）、`请先勾选知情同意`（`:184`）、`return "";`（`:323`）、`{helperText ?`（`:903`）。
- [ ] **4.3 类型 / 静态检查**：`npx tsc --noEmit`（重点：`:321–328` 的 `useMemo` 返回仍为 `string`；`:903` 守卫不引入 `possibly undefined` / JSX 类型错误）＋ `npm run lint` 无新增错误。
- [ ] **4.4 探针跑通**（按 §2 同步后）：
  - `node tmp/verify-phase3.mjs` ✔ —— **须确认 `OPEN_CONSENT` 步骤真实点击成功**（静默 false 风险，见 §2 末）
  - `node tmp/cdp-req13-outline.mjs` ✔（`:347` 定位；注：该脚本 `__t.btn` 找不到会 **throw**）
  - `node tmp/cdp-req14-consent.mjs` ✔ —— **含红线 `:300`**；`:405–408` payload 断言（`customRedactionRules` 存在性）须仍通过
- [ ] **4.5 回归**：`node tmp/cdp-req13-prefill.mjs` ✔（UI-05 划界证明）；`node tmp/cdp-req28-labels.mjs` 全绿（其 eyebrow / label 断言只在访谈页 → A 批基线 17/17 不受影响）。
- [ ] **4.6 diff 审查**：`git status --short` → **只应出现 2 个 `src/**` 文件**；`src/lib/**`、`src/app/**`、`projects/project-workflow-board.tsx` **零改动**；`tmp/**` 不入库；docs 侧只允许本单 ＋ `docs/tasks/IMPL_REQ-28_文案清理.md`（§5 授权的 §5.1 回写）。
- [ ] **4.7 视觉复核（人工）**：`/projects/new` → 分流「上传音频」→ 步骤 3 —— 页头无「记忆引擎」眉标、h1「音频处理」＋ 一句说明；上传卡片只有标题「上传音频」（无 eyebrow、无 `Audio` 标签、无格式清单句）；**未选文件时卡片内无空行**；选文件后显示「已选择：…」；底部说明「提交后开始处理」；主按钮「开始处理」；弹层正文与勾选框**逐字未变**；未勾选时提示「请先勾选知情同意」。
- [ ] **4.8 UI-05 复视**：展开「高级设置（选填）」→「脱敏级别」选择器与 6 项「自定义脱敏规则」**与改前逐字一致**，默认勾选（电话 / 身份证号 / 地址 / 联系方式）不变，提交 payload 的 `customRedactionRules` 不变。

### 4-9 备选（**本单不采用**，仅备总管改判）

- 若 D-05 原意为「**保留眉标**并替换为『上传音频』」：`:878` 改为替换（`:880` 同改）→ 同卡片出现两次「上传音频」，与 R5（PRD L36）冲突；采用时 §4.1 组⑤ 期望改 1、§4.2 相应调整。
- 若 D-02 原意为「上传音频」（＝ IMPL §4.5 L380 字面）：`upload-workspace.tsx:31` → `上传音频`，与 D-05 同词同屏 → 违反 R5；采用时须同时改 **0.3** 与 IMPL §4.5 L380。

---

## §5 交付边界

- `tmp/**` 受 `.gitignore:54` 屏蔽 → 探针改动**不入库**；`docs/tasks/` 已纳管，本单新建即入库。
- 实施轮**单 commit**，范围 ＝ **2 个 `src/**` 文件** ＋ `docs/tasks/IMPL_REQ-28_文案清理.md` 三处回写（§5.1 裁决 ❻、§4.5 L380 ＋ §2.4 L149 裁决 ❼，均纯 docs 不触发重启）；message：`文案清理(REQ-28-D): 上传音频文案清理`。
- **判失败条件**：`git status --short` 出现第 3 个 `src/**` 文件，或 `src/lib/**` / `src/app/**` / `projects/project-workflow-board.tsx` 任一出现（裁决 ❺① ＋ §4.6）。
- 回滚：纯文案 ＋ 一处守卫 ＋ 一处 `mt-2` → `mt-3`，`git revert` 即可；探针漂移优先回退**文案**（IMPL §3.6 纪律 4）。
- 本单**不涉及**：帮助入口批次（D-12 与 IMPL §5.6 回填清单）、UI-05 的功能 / 交互实现（§3.3）、E / F 批、`src/lib/**`（含 `oral-history.ts`、`server/project-store.ts`）。
- ✅ **已授权并执行的两行 docs 回写（裁决 ❼）**：`IMPL §4.5 L380`「D-02 / D-03 主标题为『上传音频』，说明为『上传录音后自动转写整理』」→「D-02 h1 →『音频处理』；D-03 副标题 →『上传录音后自动转写整理』（PRD 目标字面）」；`§2.4 L149`「替换 →『上传音频』（或『音频处理』）」→「替换 →『音频处理』」＋备注列记「未取备选」→ 与裁决 ❷ 对齐（回写前字面见 0.3）。
- **文档侧后续（不在本批）**：`docs/需求登记表.md` UI-05 / UI-06 / UI-14 三处陈旧行号（§3.3④）；A / B 单 §0.9 沿用的「源文件均为 CRLF」旧口径（已由本单 0.1① 纠正，A / B 单**不回改**）。

---

## §6 附：字面归零脚本 ＋ 探针备份脚本（无 ripgrep，PowerShell 内存扫描）

```powershell
cd (git rev-parse --show-toplevel)   # 仓库根（或手动：cd <仓库根>）

function Hits([string]$scope, [string]$pat) {
  $items = if (Test-Path -LiteralPath $scope -PathType Container) {
    Get-ChildItem -LiteralPath $scope -Recurse -Include '*.ts','*.tsx' -File
  } else { Get-Item -LiteralPath $scope }
  $n = 0
  foreach ($f in $items) {
    $c = (Select-String -LiteralPath $f.FullName -SimpleMatch -Pattern $pat | Measure-Object).Count
    if ($c -gt 0) {
      $n += $c
      '      {0} ({1} 行)' -f $f.FullName.Replace((Get-Location).Path + '\', ''), $c
    }
  }
  return $n
}

# 组号 / 检索范围（目录或单文件）/ 字面 / 期望（改后）
$cases = @(
  @('①',  'src\components\upload\upload-workspace.tsx',        '记忆引擎',                                                     0),
  @('②',  'src',                                              '音频建档与处理',                                                 0),
  @('③',  'src',                                              '填写受访人基础信息，上传本地音视频文件，进入自动转写与整理流程。',      0),
  @('④',  'src',                                              '普通话（默认）',                                                 0),
  @('⑤',  'src\components\upload\interview-upload-form.tsx',   '<p className="section-eyebrow">受访音频</p>',                   0),
  @('⑥',  'src',                                              '上传音频材料',                                                   0),
  @('⑦',  'src',                                              '支持 mp3、wav、m4a、aac、flac、ogg 等常见音频格式。',             0),
  @('⑧',  'src',                                              '提交后将直接开始本地音频转写、AI 整理与隐私脱敏处理。',             0),
  @('⑨',  'src',                                              '创建项目并开始处理',                                             0),
  @('⑩',  'src',                                              '请先勾选知情同意确认，才能创建项目并开始处理。',                    0),
  @('⑪',  'src',                                              '本平台会对本次口述音频',                                         1),
  @('⑫',  'src',                                              '我确认已获得受访者的',                                           1)
)

foreach ($c in $cases) {
  $hits = Hits $c[1] $c[2]
  '{0,-4} {1,-56} => 期望 {2} · 实测 {3}' -f $c[0], $c[2], $c[3], $(if ($hits -eq $c[3]) { "$hits  OK" } else { "$hits  ✗" })
}
```

> 组① 必须**限定单文件**（`src` 全域 `记忆引擎` 另有 7 处属**预期原状**）；组⑤ 必须用**精确字面**（裸字 `受访音频` 在该文件仍有 `:403` / `:901` 两处）；组⑪⑫ 为**红线保留项**（期望 1，归零即失败）。
>
> 行号定位一律用 `[IO.File]::ReadAllLines`（**禁用 `Get-Content`** → 0.1③）：
>
> ```powershell
> $a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
> for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -match '创建项目并开始处理|受访音频|支持 mp3') { 'L' + ($i + 1) + ': ' + $a[$i].Trim() } }
> ```

```powershell
# 探针改动前备份（§2）
New-Item -ItemType Directory -Force -Path 'tmp\_backup_REQ28D' | Out-Null
'verify-phase3.mjs','cdp-req13-outline.mjs','cdp-req14-consent.mjs' | ForEach-Object {
  $src = Join-Path 'tmp' $_
  $dst = Join-Path 'tmp\_backup_REQ28D' $_
  Copy-Item -LiteralPath $src -Destination $dst -Force
  "backed up: $src -> $dst"
}
```

**依据来源**：PRD `§4 REQ-28-D`（L120–135，12 条含「现状 / 建议替换 / 问题类型 / 处置」列）、`§3 R1–R5`（L28–38，R5 原文见 L36）、`§5 P-1／P-4`（L193／L196）；IMPL `§0.2-D3／D4`（L39–40）、`§2.4`（L144–159）、`§3.2`（L245–259）、`§3.4`（L276–286）、`§3.6`（L301–307）、`§4.5`（L377–389）、`§5.1`（L433–440）／`§5.2`（L442–447）／`§5.3`（L449–453）／`§5.6`（L471–485）／`§5.7`（L487–490）；**总管 2026-10-07 六点裁决**（❶ `mt-2`→`mt-3` ／ ❷ D-02「音频处理」＋ D-05「上传音频」／ ❸ `:903` 最小守卫／ ❹ 探针注释随改／ ❺ UI-05 同批 4 条硬边界／ ❻ IMPL §5.1 回写 ＋ 三项禁止操作）；`docs/需求登记表.md` UI-05／UI-06／UI-14 条目；行号为本轮对 `src/**`、`tmp/**`、`docs/**` 的全量只读实测（HEAD `15d6db2`，2026-10-07，口径 ＝ `[IO.File]::ReadAllLines`）。
