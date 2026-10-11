# UI-06 实施任务单 v2 · 知情同意弹窗（文案重写 ＋ 说明全文展开区 ＋ 按钮改名 · 3 支探针同步）

> **上游**：`docs/PRD_UI-06_知情同意弹窗.md`（**PRD 定稿 v2**，总管 2026-10-11 授权清单已并入）。本单是它的**实施说明书**；逐字文案与 PRD §4.1／§4.3 **必须逐字符一致**（§0.6 ↔ PRD §4.1／§4.3）。
> **本文档只写计划**：不改代码、不产生 commit。实施轮按 §1 改 `src/**`，**并同批**同步 `tmp/**` 的 3 支探针（§1.2-1.4，已授权）。
> **规模**：`src` **1 个文件**（`interview-upload-form.tsx`）＝ **文案 3 处**（`:167-169` 正文 → 两段｜`:180-181` 勾选句｜`:206` 按钮）＋ **展开区新组件**（模块级常量 ＋ props ＋ 受控 state ＋ 复位 ＋ JSX）；`tmp` **3 支探针**同步；另 1 支只读断言（§4，不入库）。
> **授权**：总管 2026-10-11 **授权清单**（本批 UI-06 最终版，原文照录于 §0.4）：(a) 文案 3 处取任老师 v2 逐字；(b) **A5 扩大**（文案 3 处 ＋ 展开区新组件 ＋ 按钮改名）＋ **A8**（按钮改名 ＋ 3 支探针同步）；(c) **A7′**「脱敏」豁免。
> **行号基线**：2026-10-11 实测，HEAD ＝ `a791d16`（`master == origin/master`，工作树干净）→ **实施前须复核行号**（口径见 §0.1）。
> **状态**：**待 DS 实施**（总管放行后执行；执行前必须先复读 §0.4）。

---

## §0 口径说明

### 0.1 行号复核口径（**禁用 `Get-Content` 定位**）

PowerShell 5.1 的 `Get-Content` 把**无 BOM 的 UTF-8** 当 GBK 解码，会吞掉中文标点后的换行 —— 本文件实测会被算成 **938 行**（真值 **1,012 行**，偏差 **74 行**；`IMPL_REQ-28-D` §0.1③ 记录的 927／998／71 系 2026-10-08 的旧快照）。**一律用**：

```powershell
$a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
for ($i = 0; $i -lt $a.Length; $i++) {
  if ($a[$i] -match '本平台会对本次口述音频|我确认已获得受访者的|data-upload-modal|soft-scroll|我确认$') { 'L' + ($i + 1) + ': ' + $a[$i].Trim() }
}
```

**开工前置**：`git rev-parse --short HEAD` 应为 `a791d16` 或其后继；`git status --short` **必须为空**（同文件串行纪律，§0.8）。行号若漂移，**以「逐字锚点」定位、不认行号**：本批的定位锚是「本平台会对本次口述音频」（旧正文）、「我确认已获得受访者的」（旧勾选句）、`'我确认'`（旧按钮字面）、`data-upload-modal` ＋ `.soft-scroll`（容器）。

### 0.2 改动纪律

- **文案**只改字符串字面量及其所在文本节点：不改既有 `className`、`id`、`data-*`、`aria-*`、`role`、`checked`/`onChange`/`disabled` 门控、条件分支与导出。
- **新增**元素只允许 §1.1 明列的那些（触发行 `<button>`、面板 `<div>`、两条 `<p>` 的 `data-ui06-*`、模块级常量、`ConsentDialog` 的 2 个新 props、父组件 1 个 state ＋ 1 行复位 ＋ 2 个挂载 props）。
- **不新增**样式文件、不改 `globals.css`、不新增依赖、不改配置；面板高度/滚动用**工具类** `max-h-[240px] overflow-y-auto` 承担（`ui06-doc` 仅作锚点类名）。
- **JSX 书写规则（本批硬规则）**：① 文案一律放进**模块级常量**（`CONSENT_BODY_1/2`、`CONSENT_TICK`、`CONSENT_BUTTON_LABEL`），常量字符串**必须单行**、**不得在句中换行**（JSX/字符串折行都可能凭空造出 `研究 / 归档` 或破坏逐字一致）；② 文案内**不得出现** `{` `}` `<` `>` `&`（定稿实测 **0** 个）；③ 展开区文本一律来自 `CONSENT_DOC_BLOCKS`，**不得**手写内联文本。
- 一行文本过长**无需**担忧：本仓**无 prettier / editorconfig**（`package.json` 的 lint ＝ `eslint` 一项，flat config `eslint.config.mjs`），eslint 不会因行长告警，也不会自动回写。

### 0.3 授权项清单（**本批有结构授权** —— 与 v1 的关键差异）

| 类别 | 本批 | 规格 |
| --- | --- | --- |
| 文案字面量 | ✅ | 3 处（正文两段 ／ 勾选句 ／ 按钮） |
| **新增组件**（展开区） | ✅ | 触发行 `<button type="button" data-ui06-toggle aria-expanded aria-controls>` ＋ 面板 `<div id="ui06-consent-doc" data-ui06-doc class="ui06-doc …">`（PRD §4.2） |
| **新增 props / state** | ✅ | `ConsentDialog`：`docOpen` ＋ `onDocOpenChange`（受控）；父组件：`consentDocOpen` state ＋ 复位 ＋ 2 个挂载 props |
| **新增模块级常量** | ✅ | `CONSENT_BODY_1/2`、`CONSENT_TICK`、`CONSENT_BUTTON_LABEL`、`ConsentDocBlock` 类型、`CONSENT_DOC_BLOCKS`（§0.6） |
| 按钮字面 | ✅ | `:206` `我确认` → `同意并继续`（A8） |
| 既有结构（遮罩/卡片/滚动容器/勾选控件/提示句） | ❌ | 一律不动（§2.1） |
| 样式文件 / 依赖 / 配置 | ❌ | 零改动 |
| `tmp/**` 探针 | ✅ **恰好 3 支** | `verify-phase3.mjs`／`cdp-req14-consent.mjs`／`cdp-req13-outline.mjs`（§1.2-1.4） |

### 0.4 ⚠ **授权清单原文**（总管 2026-10-11 · **DS 执行前必须复读**）

**（1）完整授权清单（照录；符号按全角规范化）**

| 项 | 授权内容 |
| --- | --- |
| **A5** | D-09/D-10 解冻**扩大**：文案 **3 处** ＋ **展开区新组件** ＋ **按钮改名** |
| **A8** | 按钮「我确认」→「**同意并继续**」＋ **3 支探针**同步 |
| 探针① | `verify-phase3.mjs:830/836` |
| 探针② | `cdp-req14-consent.mjs:331/382/386/155` |
| 探针③ | `cdp-req13-outline.mjs:362/363` |
| **A7′** | 正文「脱敏」豁免，照录官方原文 |

**（2）A7′ 裁决（照录）**：「照录任老师定稿，A7 改为 A7′ **豁免登记**：正文两段含『校订脱敏』『脱敏处理』属《个人信息处理说明》**官方用词**，照录不改；**勾选句仍不含「脱敏」**；**U6-5** 重定义为**正向事实断言**（正文含「校订脱敏」「脱敏处理」＋ 勾选句不含「脱敏」）；**P-4** 缺口回登需求登记表 P-4 条目（另批，不阻塞本批）。」

**（3）范围声明（照录）**：「任务一/二/三按你的执行计划全量落笔，无需再等任何裁决。完成后停手发总管审批，**不 commit，不碰 src**。」⇒ **本轮（文档批）不落代码**；`src` ＋ 3 支探针由**实施轮**按本单 §1 **同批**落地。

**授权边界（越界即判失败）**

| 项 | 状态 |
| --- | --- |
| `:167-169` 正文（→ 两段） | ✅ 可替换 |
| `:180-181` 勾选句 | ✅ 可替换 |
| `:206` 按钮字面 | ✅ 可替换（→ `同意并继续`） |
| 展开区（触发行 ＋ 面板 ＋ 常量 ＋ props/state） | ✅ 可新增（§1.1 明列） |
| `:166` 滚动容器（含 `.soft-scroll` / `max-h`） | ❌ 不动（class 一字不改） |
| `:172-183` `<label>` / `<input>` / `<span>` **结构** | ❌ 不动（`<span>` 只换文本 → 常量表达式） |
| `:156` 眉标 / `:163` 标题 / `:187` 提示 / `:198` 取消按钮 | ❌ 不动 |
| `:93` 注释里的「我确认」字样 | ❌ **本批不动**（改名后陈旧，登记于 §2.1／PRD §8 ⑤；**不得**顺手改） |
| `:138-152` 的 `data-*` / `role` / `aria-*` | ❌ 不动 |
| REQ-28 其余冻结项（`IMPL_REQ-28-D` §0.7） | ❌ 不动（含 `cdp-req14-consent.mjs:300` 所钉旧句 **不得复活**） |
| `tmp/**` 除 §1.2-1.6 明列者 | ❌ 不动 |

### 0.5 探针影响面判定：**恰好 3 支必改（8 行）＋ 其余 0 行**

**结论**：`src/**` 按 §1.1 改完后，`tmp/**` 中**只有 3 支**探针必须同步（**已授权**，见 §0.4），**合计 8 行**；其余 **0 行**。逐支账目：

| # | 探针 | 命中的字面（实测行号） | 必改 | 改法 |
| --- | --- | --- | --- | --- |
| ① | `tmp/verify-phase3.mjs` | `:830`、`:836` `innerText.trim() === '我确认'`；另 `:713`（注释）、`:876`（报告字符串「我确认可点=」）**无判定力** | **2 行** | 字面 → `'同意并继续'` |
| ② | `tmp/cdp-req14-consent.mjs` | `:155` `hasFixedText: el.textContent.includes('研究/归档目的')`；`:331`／`:382` `window.__t.info('我确认')`；`:386` `__t.click('我确认')`；另 `:4`／`:6`／`:378`（注释）与 `:156`／`:300`（新文案下仍为真）**不改** | **4 行** | `:155` → `'智能转写'`；`:331`／`:382`／`:386` → `'同意并继续'` |
| ③ | `tmp/cdp-req13-outline.mjs` | `:362`、`:363` `innerText.trim() === '我确认'` | **2 行** | 字面 → `'同意并继续'` |
| ④ | 另 2 支 `tmp` 断言件（`cdp-ui06-consent-copy.mjs`／`check-ui06-docs.mjs`） | 见 §1.5／§1.6 | 整体改写 / `EXPECT` 同步 | 均**不入库**（`.gitignore:54`） |
| ⑤ | **其余全部**（`tmp/*.mjs` 实为 **50 支**，扣除上列 5 支） | 字面普查（2026-10-11）：`我确认`／`同意并继续`／`研究/归档目的`／`研究 / 归档`／`本平台会对本次口述音频`／`我确认已获得受访者的`／`智能转写` 全量检索**零命中** | **0 行** | —— |
| —— | **合计（授权范围）** | —— | **8 行 / 3 支** | 与 §0.4 A8 逐行一致 |

**「探针-源」同步纪律（本批最重要的工艺要求）**

1. **同批**：3 支探针的 8 行改动**必须与 `src` 落在同一批**（同一次实施会话）；**不得**只改 `src` 不改探针 —— 探针按字面精确定位按钮，找不到时 `find` 返回 `null` 而**静默漏检**（`verify-phase3.mjs:830/836` 的 `clickText` 语义）。
2. **回退方向**：若同步后探针变红，**先回退文案**（保持旧按钮字面）而不是改断言 —— 纪律见 `IMPL_REQ-28-D` §3.6 第 4 条。
3. **不许扩面**：本批**只**动 §1.2-1.4 明列的 8 行；发现其它脚本也需要改动 ⇒ **立即停手、回总管**（说明 §0.5 论证有误）。

### 0.6 逐字定稿与全文常量（**与 PRD §4.1／§4.3 逐字符一致**；实施中不得再改，改选须回总管）

**⓪ 逐字明文（人读比对用；与 PRD §4.1／§4.3 **逐字符一致**，也是 `check-ui06-docs.mjs` 的命中目标）**

```text
平台将通过云端技术服务，对您本次录制或上传的口述资料进行智能转写、要素标引与校订脱敏，并为您提供资料保存与检索服务。
```

```text
平台仅在您授权的范围内处理与使用资料，通过访问权限控制与脱敏处理保护个人信息。如需将资料用于公开展示、图书出版、网络传播等用途，平台将另行征求您的同意。资料保存期限、云端处理情况及撤回同意、更正与删除的申请方式，详见《个人信息处理说明》。
```

```text
我已阅读并理解《个人信息处理说明》，同意平台按上述目的与方式处理本次口述资料。
```

```text
同意并继续
```

**① 模块级常量**（插在 `:91` 的 `const ROUTE_STEP_HREF = "/projects/new?step=route";` **之后**、`:93` 的弹窗注释**之前**）

```ts
// UI-06 v2：知情同意弹窗 3 处文案 ＋《个人信息处理说明》全文常量。
// 全部走常量而非内联字面量 —— 与 ROUTE_STEP_HREF（:88-91）同一理由：
// 文案一旦内联进 JSX，「换行 ＋ 缩进」会被折叠成一个空格（可能凭空造出
// 「研究 / 归档」这类带空格字面），且逐字定稿无法被脚本按「整行相等」核验。
// 改任一字面，必须同批改：docs/PRD_UI-06_知情同意弹窗.md §4 ＋ 本单 §0.6
// ＋ 3 支探针（本单 §1.2-1.4；授权行见 §0.4 A8）。
const CONSENT_BODY_1 =
  "平台将通过云端技术服务，对您本次录制或上传的口述资料进行智能转写、要素标引与校订脱敏，并为您提供资料保存与检索服务。";
const CONSENT_BODY_2 =
  "平台仅在您授权的范围内处理与使用资料，通过访问权限控制与脱敏处理保护个人信息。如需将资料用于公开展示、图书出版、网络传播等用途，平台将另行征求您的同意。资料保存期限、云端处理情况及撤回同意、更正与删除的申请方式，详见《个人信息处理说明》。";
const CONSENT_TICK =
  "我已阅读并理解《个人信息处理说明》，同意平台按上述目的与方式处理本次口述资料。";
const CONSENT_BUTTON_LABEL = "同意并继续";

type ConsentDocBlock =
  | { kind: "title" | "h1" | "h2" | "p"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

// 《个人信息处理说明》（更新/生效日期 2026年10月8日）逐字全文，73 块 ＝
// Title 1 ＋ 章标题 9（h1 → <h3>）＋ 小节标题 6（h2 → <h4>）＋ 正文段 52 ＋ 表格 5。
// 纯文本 4,124 字符（正文段 2,704 ＋ 表格单元格 1,420）。
// docx 的 5 个官方链接以 HYPERLINK 字段码存在 ⇒ 此处只有链接标签文字、无 URL（PRD §4.2）。
const CONSENT_DOC_BLOCKS: ConsentDocBlock[] = [
  { kind: "title", text: "个人信息处理说明" },
  { kind: "p", text: "更新日期：2026年10月8日" },
  { kind: "p", text: "生效日期：2026年10月8日" },
  { kind: "p", text: "“记忆引擎”平台提供口述采集、智能转写、要素标引、校订脱敏、资料检索与成果转化服务。本说明介绍个人信息的处理范围、云端服务、保存规则与权利申请方式。" },
  { kind: "h1", text: "处理主体" },
  { kind: "p", text: "平台运营主体：复旦大学“记忆引擎”智述时光项目组" },
  { kind: "p", text: "联系电话：17376590989" },
  { kind: "p", text: "联系地址：上海市杨浦区邯郸路220号" },
  { kind: "p", text: "您可以通过上述电话联系我们，咨询资料处理规则，或提出查阅、复制、更正、删除与撤回同意的申请。" },
  { kind: "h1", text: "处理的信息" },
  { kind: "p", text: "平台根据您选择的服务，处理以下信息：" },
  { kind: "table", head: ["信息类别", "具体内容"], rows: [
    ["口述资料", "本次录制或上传的音视频、文字与补充材料，以及其中涉及的人物经历、家庭关系、工作经历等信息"],
    ["整理成果", "转写稿、校订稿、时间戳、要素标引、检索索引与经授权形成的转化成果"],
    ["项目信息", "项目名称、访谈主题、成果用途、授权范围与保存期限"],
    ["服务记录", "处理进度、修改记录、审核记录、授权变更与必要的操作日志"],
  ] },
  { kind: "p", text: "平台按照具体服务需要处理信息。您可以根据记录目的选择使用真实姓名、化名或隐去姓名，减少提交与本次服务无关的个人信息。" },
  { kind: "h1", text: "处理目的与方式" },
  { kind: "p", text: "口述采集：根据您的操作录制音视频，或接收您上传的口述资料。" },
  { kind: "p", text: "智能转写：将语音转写为文字，形成时间戳、文本分段与说话人区分等信息。" },
  { kind: "p", text: "要素标引：识别与整理时间、地点、人物、事件、机构与主题，便于资料查考。" },
  { kind: "p", text: "校订脱敏：辅助标记转写疑点、存疑信息与敏感内容，按服务约定开展人工校订、复核与脱敏处理。" },
  { kind: "p", text: "资料检索：在授权范围内提供分类浏览、关键词检索、全文检索、语义检索与内容定位。" },
  { kind: "p", text: "成果转化：根据您的需求与授权，将整理后的资料转化为回忆录、口述史编研稿、展览文本、视频脚本与音频故事等成果。" },
  { kind: "p", text: "AI处理结果可能存在错误、遗漏或表达偏差。涉及人名、地名、时间、事件与敏感内容的结果，应结合原始资料核对；听辨不清或尚未核实的内容保留说明。" },
  { kind: "h1", text: "云端技术服务" },
  { kind: "p", text: "平台使用阿里云技术服务完成语音识别、文本处理、向量检索、资料存储与应用运行。调用时，仅传输完成对应任务所需的信息。" },
  { kind: "h2", text: "服务提供方及产品" },
  { kind: "table", head: ["处理用途", "服务提供方及产品", "涉及信息"], rows: [
    ["语音识别", "阿里云百炼：Paraformer-v2、Paraformer-realtime-v2", "待转写音频、实时语音与必要的识别参数"],
    ["语音合成", "阿里云百炼：CosyVoice-v2", "需要播报的访谈提问与提示文本"],
    ["文本处理", "阿里云百炼：通义千问Qwen-Plus", "待整理文字、必要的上下文与处理指令"],
    ["向量生成", "阿里云百炼：text-embedding-v4", "用于建立检索索引的文本片段与检索问题"],
    ["向量检索", "阿里云向量检索服务DashVector", "文本向量、资料编号、必要的标引字段与检索条件"],
    ["存储备份", "阿里云对象存储OSS", "原始音视频、整理文稿、转化成果与备份资料"],
    ["应用运行", "阿里云云服务器ECS", "项目信息、处理任务、权限设置与必要的运行日志"],
  ] },
  { kind: "p", text: "语音合成用于播报提问与提示，采用服务商提供的声音，不以本次口述资料开展声音克隆。" },
  { kind: "p", text: "科大讯飞为可研报告中的语音识别备选服务。正式启用前，平台将补充具体产品、处理范围与相关说明，并告知您。" },
  { kind: "h2", text: "服务条款与保存规则" },
  { kind: "table", head: ["服务产品", "保存与处理规则", "官方说明"], rows: [
    ["阿里云百炼", "根据法律法规留存模型与应用调用数据；业务数据的处理、删除与服务终止后的保留，按服务协议执行。平台使用模型API开展处理，不将资料提交至个人聊天产品", "阿里云百炼服务协议、合规资质与隐私说明"],
    ["DashVector", "按平台指令保存、修改与删除检索数据；释放服务、终止服务或欠费后的数据处理，按协议及产品缓冲期规则执行", "阿里云向量检索服务协议"],
    ["OSS", "保存期限由平台设置的存储规则控制。删除资料时，同步处理相应历史版本与备份，避免仅删除当前版本而继续保留旧版本", "对象存储OSS服务协议"],
    ["ECS", "应用数据与系统备份由平台管理；服务终止、实例释放与数据清理按云服务器协议及相应产品规则执行", "阿里云云服务器服务协议"],
  ] },
  { kind: "p", text: "平台保存期限与服务商依法留存调用记录的期限分别管理。平台办理删除时，将清理自主管理的资料，并向受托服务商提出适用的删除要求；依法需要保留的记录，按相应规则限制使用。" },
  { kind: "h2", text: "模型训练" },
  { kind: "p", text: "本次授权用于口述资料处理与约定的保存服务，不包含模型训练。" },
  { kind: "p", text: "平台不将您的原始音视频、未公开文稿与个人信息用于模型训练。依据阿里云百炼现行服务协议，服务商不得未经授权将客户业务数据用于模型训练。建立文本向量与检索索引，是为了完成本项目资料检索，不属于模型训练。" },
  { kind: "p", text: "后续如开展模型训练，平台将另行说明资料范围、训练用途、参与方与保存规则，并依法取得相应授权。" },
  { kind: "h1", text: "敏感信息与他人资料" },
  { kind: "p", text: "口述资料可能涉及医疗健康、宗教信仰、金融账户、行踪轨迹等敏感个人信息。确需处理此类信息时，平台将说明处理的必要性与对个人权益的影响，并依法取得单独同意。" },
  { kind: "p", text: "您可以跳过有关问题、暂停录制或结束访谈。敏感内容的处理与公开范围，可以分别选择。" },
  { kind: "p", text: "您代他人录制或上传资料时，应向受访者说明录音、云端处理、整理用途与保存规则，并取得相应授权。涉及第三方个人信息的内容，平台将核查使用依据，根据需要限制利用或进行脱敏处理。" },
  { kind: "p", text: "涉及不满十四周岁未成年人的个人信息，平台将在处理前征得监护人同意，并提供相应的处理说明。" },
  { kind: "h1", text: "资料使用与公开" },
  { kind: "p", text: "原始资料与整理成果按项目管理，仅向具有相应权限的用户与工作人员开放。人工校订人员根据任务需要访问资料，并承担保密义务。" },
  { kind: "p", text: "公开展示、图书出版、网络传播，以及向档案、文旅、教育等机构提供可识别个人身份的资料，须具有对应的授权或其他合法依据。平台将明确使用目的、接收方、资料范围、署名方式与使用期限。" },
  { kind: "p", text: "脱敏处理用于降低身份识别与隐私泄露风险，不代替公开授权。声音、影像与叙述细节仍可能识别个人，公开前需结合具体内容复核。" },
  { kind: "h1", text: "资料保存与保护" },
  { kind: "h2", text: "存储地域" },
  { kind: "p", text: "平台云端服务采用中国境内的华北2（北京）地域，原始资料与整理成果存储于该地域的OSS，检索数据存储于DashVector，应用运行使用ECS。异地备份限定在中国境内。" },
  { kind: "p", text: "平台使用境内模型服务接口。本服务不安排个人信息出境；后续如需变更，将另行履行告知与相应程序。" },
  { kind: "h2", text: "保存期限" },
  { kind: "p", text: "资料保存以授权目的与必要期限为依据。您可以选择保存服务、申请较短期限或提前删除资料。" },
  { kind: "table", head: ["保存类别", "保存期限", "适用范围与起算方式"], rows: [
    ["基础保存", "3年", "个人、家庭与一般机构选择基础保存服务的资料，自成果确认或项目验收之日起计算"],
    ["延长保存", "5年", "需要持续补充、查考或再次利用的资料，经确认选择延长保存服务后，自成果确认或项目验收之日起计算"],
    ["项目保存", "10年", "具有持续查考需求的机构项目资料，经书面约定保存范围与期限后，自项目验收之日起计算"],
    ["过程资料", "项目结束后30日内清理", "临时音频片段、中间文件与无保留必要的重复稿件；具有校订或审核依据价值的版本随项目资料保存"],
    ["授权记录", "保存服务期间及结束后3年", "保存证明授权范围、变更情况与申请处理结果所需的最少信息"],
    ["安全日志", "至少6个月", "用于安全排查的访问与操作记录；法律法规要求更长期限的，按相应要求执行"],
    ["备份资料", "随主资料期限管理", "主资料删除后停止日常访问，在30日内完成平台自主管理备份中的清理；依法需要保留的除外"],
  ] },
  { kind: "p", text: "3年、5年与10年为平台提供的保存服务期限，并非对全部口述史料统一规定的档案保管期限。" },
  { kind: "p", text: "需正式归档的口述史料，由委托单位依据《口述史料采集与管理规范》及本单位制度，确定永久、30年或10年的保管期限。平台按约定完成移交；需要继续托管的，另行明确保存责任与服务期限。" },
  { kind: "p", text: "订阅服务到期后，平台提供30日资料导出期。您可以续订或选择单独的保存服务；未继续选择服务的，平台在导出期结束后按上述规则清理资料。" },
  { kind: "p", text: "保存期满前30日，平台提醒您办理导出、续期或移交。处理目的已经完成、授权撤回或依法应当删除时，平台按申请与法律要求提前处理。" },
  { kind: "h2", text: "安全措施" },
  { kind: "p", text: "平台按照可研报告的安全方案设置以下措施：" },
  { kind: "p", text: "传输保护：平台访问与云端调用使用HTTPS/TLS加密传输；资料下载使用限时授权链接。" },
  { kind: "p", text: "加密存储：原始音视频、整理文稿与备份资料启用存储加密，原始资料保留只读副本，校订过程保留版本记录。" },
  { kind: "p", text: "访问权限：按项目与岗位分配权限，人工审核人员仅访问承担任务所需的资料；管理账号与技术密钥分别管理。" },
  { kind: "p", text: "项目隔离：通过独立的资料目录、项目标识与检索权限，限制不同项目之间的资料访问。" },
  { kind: "p", text: "操作日志：记录访问、编辑、导出、删除与授权变更，限制日志访问范围，避免写入完整口述内容与无关敏感信息。" },
  { kind: "p", text: "资料备份：开展每日增量备份与每周完整备份，设置境内异地备份，定期检查备份完整性与恢复能力。" },
  { kind: "p", text: "发生或可能发生资料泄露、损毁、丢失时，平台将立即采取补救措施，核实影响范围，并依法履行通知与报告义务。" },
  { kind: "h1", text: "您的信息管理权利" },
  { kind: "p", text: "您可以通过项目页面的文本编辑、成果导出、授权管理与资料删除功能管理资料，也可以拨打17376590989提出申请。" },
  { kind: "table", head: ["申请事项", "办理方式"], rows: [
    ["查阅复制", "在项目页面查阅资料，通过成果导出获取相应副本；原始资料副本可联系项目组申请"],
    ["更正补充", "通过文本编辑补充或修改内容；需保留原始记录的，采用校订与说明方式处理"],
    ["撤回同意", "在授权管理中提交撤回申请，或电话说明需要撤回的处理事项与使用范围"],
    ["删除资料", "在项目页面提出资料删除申请，或联系项目组办理"],
    ["咨询投诉", "通过联系电话咨询处理规则，提出异议或投诉"],
  ] },
  { kind: "p", text: "受访者即使未注册平台账号，也可以通过联系电话提出有关本人信息的申请。平台仅核验确认申请人身份与资料关联所需的信息。" },
  { kind: "p", text: "平台在收到申请并完成必要身份核验后，于15个工作日内完成处理并反馈结果。无法按申请办理的，将说明具体原因与处理依据。" },
  { kind: "p", text: "撤回同意不影响撤回前基于同意开展的合法处理。撤回后，平台停止相应处理；如影响转写、检索或保存服务，将告知受影响的功能。" },
  { kind: "p", text: "依法仍需保存，或技术上暂时难以删除的信息，平台将限制为必要的存储与安全保护，并说明保留依据及后续处理安排。" },
  { kind: "h1", text: "说明更新" },
  { kind: "p", text: "服务提供方、处理目的、信息范围、保存规则或权利申请方式发生变化时，平台将更新本说明，并通过平台提示或项目联系方式告知您。" },
  { kind: "p", text: "需要重新取得同意的变更，将在取得相应同意后实施。更新本说明不自动扩大您原有的授权范围。" },
];
```

> **常量书写要点**：`CONSENT_BODY_1/2` 与 `CONSENT_TICK` 的**字符串字面量必须是一行**（`=` 换行、值不换行 ⇒ 值内部无空格注入风险）；`CONSENT_BUTTON_LABEL` 与探针字面 `'同意并继续'` **逐字符相同**。

**② 正文两段 ＋ 展开区 JSX**（`:166-170` 区块 · **容器 `:166` 与 `:170` 的 `</div>` 一字不改**）

**改前（`:167-169`）**

```jsx
<p>
  本平台会对本次口述音频进行本地转写、AI 整理与隐私脱敏处理，处理结果仅用于研究/归档目的。上传前，请确认您已向受访者完整说明上述用途。
</p>
```

**改后（在 `.soft-scroll` 内：正文两段 → 触发行 → 条件渲染面板）**

```jsx
<p data-ui06-part="body1">{CONSENT_BODY_1}</p>
<p data-ui06-part="body2" className="mt-2.5">{CONSENT_BODY_2}</p>

<button
  type="button"
  data-ui06-toggle=""
  aria-expanded={docOpen}
  aria-controls="ui06-consent-doc"
  onClick={() => onDocOpenChange(!docOpen)}
  className="mt-3 flex w-full items-center gap-1.5 rounded-[0.9rem] px-1 py-1 text-left text-xs font-medium text-accent-strong transition-colors"
>
  <span aria-hidden="true">{docOpen ? "▼" : "▶"}</span>
  <span className="underline decoration-dotted underline-offset-4">个人信息处理说明</span>
</button>

{docOpen ? (
  <div
    id="ui06-consent-doc"
    data-ui06-doc=""
    className="ui06-doc mt-2.5 max-h-[240px] overflow-y-auto rounded-[0.9rem] border border-line/70 bg-white/55 px-3 py-2.5 text-xs leading-6 text-muted"
  >
    {CONSENT_DOC_BLOCKS.map((block, index) => {
      if (block.kind === "table") {
        return (
          <table key={`t${index}`} className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr>
                {block.head.map((cell, cellIndex) => (
                  <th key={`h${cellIndex}`} className="border border-line/60 px-2 py-1 font-medium text-foreground">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`r${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`c${cellIndex}`} className="border border-line/60 px-2 py-1 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      if (block.kind === "h1") {
        return (
          <h3 key={`h${index}`} className="mt-3 font-semibold text-foreground">{block.text}</h3>
        );
      }

      if (block.kind === "h2") {
        return (
          <h4 key={`s${index}`} className="mt-2 font-medium text-foreground">{block.text}</h4>
        );
      }

      if (block.kind === "title") {
        return (
          <p key={`t${index}`} className="text-sm font-semibold text-foreground">{block.text}</p>
        );
      }

      return <p key={`p${index}`} className="mt-1.5">{block.text}</p>;
    })}
  </div>
) : null}
```

> **实现要点**：① 触发行与面板**都在 `.soft-scroll` 之内**（`<div className="soft-scroll …">` 的闭合 `</div>` 仍在其后），弹窗总高由 `.soft-scroll` 的 `max-h-[min(55vh,24rem)]` 决定 ⇒ **展开不改变弹窗高度**（保护 `cdp-req14-consent.mjs:346`）；② 面板**独立滚动**（240px）⇒ 形成「外层滚动 ＋ 内层滚动」，窄屏可用性由 §5.7 人工复核兜底；③ `key` 前缀不得重复（`t`／`h`／`s`／`p`／`r`／`c`）；④ 展开区**只**由 `docOpen` 决定，**不读**任何外部状态、**不发**请求。

**③ 勾选句**（`:179-182` 的 `<span>` · **只换文本，标签不动**）

| 项 | 内容 |
| --- | --- |
| 改前（`:180` ＋ `:181`，跨两行 JSX 文本） | `我确认已获得受访者的口头或书面知情同意，受访者已了解本次口述内容将被录音、转写、AI` ⏎ `整理，并同意在脱敏处理后用于研究/归档目的。` |
| 改后 | `<span>{CONSENT_TICK}</span>`（**单行表达式**） |
| 净行数 | **−1**（其后同文件行号 **−1**；`:182` 起 `</span>` 上移一行） |

**④ 按钮**（`:200-207` · **只换文本节点**）

```jsx
<Button
  type="button"
  className="w-full justify-center sm:w-auto sm:min-w-[140px]"
  disabled={!checked}
  onClick={onConfirm}
>
  {CONSENT_BUTTON_LABEL}
</Button>
```

| 项 | 内容 |
| --- | --- |
| 改前（`:206`） | `我确认` |
| 改后 | `{CONSENT_BUTTON_LABEL}` ⇒ 渲染为 `同意并继续` |
| 净行数 | **0**（`:206` 一行换一行） |

**⑤ 父组件三处（受控 state ＋ 重弹复位 ＋ 挂载 props）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `:299` 之后（`consentOpen` 声明之后、`error` 之前） | 新增 `const [consentDocOpen, setConsentDocOpen] = useState(false);` ＋ 注释：`// 展开态受控：与勾选态同址复位，保证每次重弹都是收起态（UI-06 PRD §4.5 第 4 条）。` |
| ② | `:472-475`（`handleFormSubmit` 的「每次创建都重新确认」块，紧接 `:473` `setConsentChecked(false);`） | 新增一行 `setConsentDocOpen(false);` |
| ③ | `:1003-1009`（`<ConsentDialog … />`） | 新增 `docOpen={consentDocOpen}` 与 `onDocOpenChange={setConsentDocOpen}` 两行 |

**为什么用「父组件受控」而不是组件内 `useState`（**已裁决，勿另行发挥**）**

1. `ConsentDialog` **常驻挂载**（`:123-125` 早退 `return null`）⇒ 组件内 state **会跨「关闭 → 重弹」存活**，展开态将被记忆，直接违反 PRD §4.5 第 4 条。
2. 受控写法与既有 `checked` / `onCheckedChange` **同构**，复位点落在既有 `:472-475`（与 `setConsentChecked(false)` 同一处），审计最好读。
3. **被否决的替代方案**（组件内 state ＋ 在 `:108-121` 的 `useEffect` 里复位）：effect 在「打开」那次渲染**之后**运行 ⇒ 理论上有一帧展开态残留可能；且复位逻辑分散到两处。

**⑥ 改后必须成立的契约点（与 PRD §4.5 逐条对应）**

| # | 契约 | 本批状态 |
| --- | --- | --- |
| 1 | 开弹窗不发 `POST`；取消路径 `posts === 0` | 不变 |
| 2 | 弹窗内 checkbox **恰好 1 个**、初始未勾、未勾时确认按钮 `disabled` | 不变（`disabled={!checked}` `:203` 未动） |
| 3 | Esc / 「取消」/ 点遮罩 三路关闭；关闭即卸载 | 不变（`:108-121`、`:123-125` 未动） |
| 4 | 重弹重置勾选态 **＋ 展开态** | **新增展开态复位**（⑤ ②） |
| 5 | 弹窗不超视口；`.soft-scroll` `auto` ＋ `max-height ≤ 385px` | 不变（`max-h-[min(55vh,24rem)]` `:166` 未动） |
| 6 | 结构锚点（`data-upload-modal` / `role` / `aria-*` / `id` / `.soft-scroll`）逐字保留 | 不变 |
| 7 | 展开 / 收起只读（无请求、无存储写入） | **新增**（§4.5 断言） |

### 0.7 编码 / 行尾（**按文件现状保持，禁归一**）

| 项 | 现状（2026-10-11 实测） | 本批口径 |
| --- | --- | --- |
| `interview-upload-form.tsx` 行尾 | **纯 LF**（`src/**` 实测纯 LF；`core.autocrlf=false`、**无 `.gitattributes`**） | **禁止**把 LF 归一为 CRLF（否则整份 **1,012 行** diff，复核失效） |
| 该文件 BOM | **无 BOM** | 不增不删 BOM |
| 本单与 PRD 文档 | `docs/**` ＝ **CRLF** | 两份文档**须 CRLF**（校验见 §5.2） |
| `tmp/**` 探针 | LF（既有） | 保持 LF，**只改字面** |

### 0.8 串行纪律（**本批须为下一手唯一批**）

`src/components/upload/interview-upload-form.tsx` 为**多批共用热点文件**：UI-05（隐私模块）／UI-14（保密级别）／UI-30（上传页字段标签变体）／BUG-11／REQ-28-D 后续均落此文件。**本批还额外触及 `tmp/` 的 3 支探针**（`verify-phase3.mjs` 覆盖 I1/I2/I3 段、`cdp-req13-outline.mjs` 覆盖 13-B 提交路径）⇒ 探针侧同样**不得**与其它批次交叉。

- 开工前：`git status --short` **必须干净**、`git rev-parse HEAD` 与 §0.1 基线一致（或已知后继）。
- 实施中：**不得**「顺手」改动其它段落或其它脚本（哪怕发现可疑文案 → 记录、另开单）。
- 收工后：`git status --short` 只允许出现 **1 个** `src/**` 文件（`interview-upload-form.tsx`）。

---

## §1 改动清单

### 1.1 `src/components/upload/interview-upload-form.tsx`（**唯一 `src` 文件**）

| # | 处 | 行（改前） | 改前 → 改后 | 净行数 |
| --- | --- | --- | --- | --- |
| ① | **模块级常量块**（新增） | 插在 `:91` 之后 | 见 §0.6 ①（4 个常量 ＋ `ConsentDocBlock` 类型 ＋ `CONSENT_DOC_BLOCKS` 105 行） | **＋129** |
| ② | `ConsentDialog` **props** | `:95-107` | 解构与类型各增 `docOpen` / `onDocOpenChange` | **＋4** |
| ③ | **正文两段 ＋ 展开区** | `:167-169` | 见 §0.6 ② | **＋68** |
| ④ | **勾选句** | `:180-181` | `<span>` 文本 → `{CONSENT_TICK}` | **−1** |
| ⑤ | **按钮字面** | `:206` | `我确认` → `{CONSENT_BUTTON_LABEL}` | **0** |
| ⑥ | 父组件 **state** | 插在 `:299` 之后 | `consentDocOpen` ＋ 注释 | **＋2** |
| ⑦ | 父组件 **重弹复位** | 插在 `:473` 之后 | `setConsentDocOpen(false);` | **＋1** |
| ⑧ | 父组件 **挂载 props** | `:1003-1009` 内 | `docOpen={consentDocOpen}` ＋ `onDocOpenChange={setConsentDocOpen}` | **＋2** |
| —— | **合计** | —— | —— | **＋205 行**（1,012 → 约 1,217 行） |

**行号漂移提示**：④ 净减 **1 行** ⇒ 改动后**同文件后续行号整体 −1**（例：`</span>` 由 `:182` → `:181`；「请先勾选知情同意」由 `:187` → `:186`；确认按钮由 `:206` → `:205`，但因 ③ ＋ 68 行，**按钮实际落在 `:273` 附近**）。**复核一律按 §0.1 的逐字锚点，不按旧行号**。

### 1.2 `tmp/verify-phase3.mjs`（探针① · **2 行**）

| 行 | 改前（逐字） | 改后 |
| --- | --- | --- |
| `:830` | `const btn = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '我确认');` | 尾部字面 → `'同意并继续'` |
| `:836` | 同上（`I_HELPERS` 内的第二次查找） | 同上 |

- **不改**：`:713`（注释「真正跑 `submitProject()` 的是弹窗里的「我确认」」）＝ 注释、`:876`（`\\`…我确认可点=${i1Enabled}…\\``）＝ **报告字符串**，两者**均无判定力**（PRD §8 ⑤ 已登记）。
- **语义提醒**：本探针的 `I2_PROBE` 靠 `innerText.trim() === '我确认'` 精确定位按钮；**漏改 = 找不到按钮 = 静默漏检**（不抛错）⇒ 必须与 `src` 同批。

### 1.3 `tmp/cdp-req14-consent.mjs`（探针② · **4 行**）

| 行 | 改前（逐字） | 改后 |
| --- | --- | --- |
| `:155` | `hasFixedText: el.textContent.includes('研究/归档目的'),` | `hasFixedText: el.textContent.includes('智能转写'),` |
| `:331` | `confirm: window.__t.info('我确认'),` | `confirm: window.__t.info('同意并继续'),` |
| `:382` | `const afterTick = await ev(\`window.__t.info('我确认')\`);` | 字面 → `'同意并继续'` |
| `:386` | `await ev(\`__t.click('我确认')\`);` | 字面 → `'同意并继续'` |

- **`:155` 的语义变化（A6／A7′ 的探针面）**：该断言的作用域 ＝ `d.querySelector('.soft-scroll')`（**正文容器**）。改前钉「固定字面『研究/归档目的』」；v2 正文**不含**该字面（字面退场，PRD §3 A6）⇒ 改钉**段一必含的「智能转写」**（v2 下恒真：段一有 1 处；展开区另有 2 处）。**键名 `hasFixedText` 保留**（改名会扩大 diff 且无收益；其相邻注释若指名旧字面，**另批**处理）。
- **`:156` 保留不改**：`hasSpacedText: el.textContent.includes('研究 / 归档')` ⇒ v2 下仍恒 `false`（正文两段无「研究」二字；展开区原文实测「研究」**0 次**）⇒ 作为**负向防回归断言**继续有效。
- **`:300` 保留不改**：`cardCopy: window.__t.bodyHas('本平台会对本次口述音频')` ⇒ v2 正文首句为「平台将通过云端技术服务」⇒ 仍恒 `false`（**旧句不得复活**，PRD §3 A5 界外声明）。
- **`:4`／`:6`／`:378`（注释）**：不动（纯注释）。
- **`:346`／`:347-349`（弹窗高度与滚动区上限）**：不动 —— ③ 的展开区在 `.soft-scroll` 内且容器 `max-h` 未变 ⇒ 仍恒真。

### 1.4 `tmp/cdp-req13-outline.mjs`（探针③ · **2 行**）

| 行 | 改前（逐字） | 改后 |
| --- | --- | --- |
| `:362` | `await waitFor(\`(() => { … const b = [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === '我确认'); return Boolean(b && !b.disabled); })()\`, 20, 150);` | 字面 → `'同意并继续'` |
| `:363` | `await ev(\`(() => { … const b = d ? [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === '我确认') : null; if (b && !b.disabled) b.click(); return true; })()\`);` | 字面 → `'同意并继续'` |

- 该两行的查找作用域是 `[data-upload-modal="consent"]` 内的**全部按钮**；新增的触发行按钮文本为「个人信息处理说明」，**不匹配**任一断言字面 ⇒ 无副作用（`cdp-req14-consent.mjs:331`／`verify-phase3.mjs:830/836` 同理）。

### 1.5 `tmp/cdp-ui06-consent-copy.mjs`（**整体改写**为 v2；不入库）

| 段 | 改前（B1 版） | 改后（v2） |
| --- | --- | --- |
| `EXPECT`（`:18-21`） | `body`（1 段）＋ `tick` | `body1` ＋ `body2` ＋ `tick` ＋ `button: "同意并继续"` ＋ `docBlocks: 73`（§4.1） |
| 文档侧（`:183-198`） | 两份文档定稿行逐字一致 | 同构 ＋ 新增「按钮字面」「A7′ 正向断言」「A5/A8 授权原文在位」 |
| 关闭态（`:320-337`） | 旧正文句／旧勾选句不复活 | 同构（锚点换成 v2 旧句：`本平台会对本次口述音频`／`我确认已获得受访者的`） |
| 打开态（`:347-392`） | 正文 `=== EXPECT.body`、`U6-5 正文不含脱敏`、`info('我确认')` | **拆成收起态 ＋ 展开态 ＋ 复位态三段**：`U6-1/2` 改为 `body1/body2`；`U6-5` **重定义为 A7′ 正向事实断言**；`U6-8`／`U6-15` 用 `同意并继续`；新增 `data-ui06-*` 锚点断言与面板 `240px / auto` 断言（§4.2-4.4） |
| 只读证明（`:392`） | `posts === 0` | 同 ＋ **新增**「展开→收起→取消」全程 `posts === 0`（§4.5） |
| 新增开关 | —— | `--docs-only`：**不启 Chrome、不依赖 dev server**，只跑文档侧（§4.1），供本批自检与后续回归 |

### 1.6 `tmp/check-ui06-docs.mjs`（文档一致性只读校验 · **`EXPECT` 同步**；不入库）

| 行 | 改前 | 改后 |
| --- | --- | --- |
| `:6-7` | `body`（1 段）＋ `tick` | `body1` ＋ `body2` ＋ `tick` ＋ `button` |
| `:36-39` | 两份文档按 `['body','tick']` 前缀命中 | 按 `['body1','body2','tick','button']` 前缀命中（**须各 ≥1 且整行相等**） |
| `:48` | `check('… 定稿 body 不含「脱敏」（P-4）', !EXPECT.body.includes('脱敏'))` | **改为 A7′ 正向断言**：`EXPECT.body1.includes('校订脱敏') && EXPECT.body2.includes('脱敏处理') && !EXPECT.tick.includes('脱敏')` |
| `:50` | `check('… 基线 HEAD c6e2066 在列', md.includes('c6e2066'))` | **`a791d16`**（v2 行号基线） |
| `:60` | `check('IMPL 照录 A5 授权原文（范围 2 处 5 行）', …includes('授权范围仅此 2 处 5 行'))` | **`check('IMPL 照录 A5/A8 授权清单', …includes('D-09/D-10 解冻**扩大**') && …includes('探针③'))` |
| `:61` | `check('IMPL 声明探针 0 行必改', …includes('0 行必改'))` | **`check('IMPL 声明 3 支必改 + 其余 0 行', …includes('3 支必改') && …includes('0 行'))`** |
| 其余（`:32-35`、`:47`、`:49`、`:53-64`） | CRLF／无 BOM／行数 > 100／`研究 / 归档` 负向／文档互引 | **保持不变** |

> 两个 `tmp` 断言件都**不入库**（`.gitignore:54`），但**必须**与两份文档同批更新，否则本单 §5.2 的放行判定失真。

### 1.7 diff 形态预期

| 文件 | 预期形态 |
| --- | --- |
| `src/components/upload/interview-upload-form.tsx` | `1 file changed, ≈ 211 insertions(+), 6 deletions(-)`（§1.1：6 处删除 ＝ 正文 3 ＋ 勾选句 2 ＋ 按钮 1；其余为常量块与新增块） |
| `tmp/verify-phase3.mjs` | `2 insertions(+), 2 deletions(-)`（不入库） |
| `tmp/cdp-req14-consent.mjs` | `4 insertions(+), 4 deletions(-)`（不入库） |
| `tmp/cdp-req13-outline.mjs` | `2 insertions(+), 2 deletions(-)`（不入库） |
| `tmp/cdp-ui06-consent-copy.mjs` / `tmp/check-ui06-docs.mjs` | 整体改写 / 局部同步（不入库） |
| `docs/PRD_UI-06_知情同意弹窗.md`、`docs/tasks/IMPL_UI-06_知情同意弹窗.md` | 全量改写（**本批交付物**；CRLF、无 BOM） |

**判失败形态**：`git status --short` 出现第 2 个 `src/**` 文件；diff 中出现**既有行**的 `className` / `data-*` / `aria-*` 改动（新增元素上的 `data-ui06-*` 与 `className` **不算**）；`src/lib/**` 或 `src/app/**` 出现改动；`tmp/**` 改动出现在 §1.2-1.6 之外；文件行尾被归一（整份 diff）。

---

## §2 不动清单（防「顺手改」）

### 2.1 同文件（`interview-upload-form.tsx`）

| 区段 | 行 | 内容 | 为何不动 |
| --- | --- | --- | --- |
| 弹窗构件与 portal | `:92-145`（**除** `:95-107` props 增 2 项） | `ConsentDialog` 定义、`createPortal`、挂 body 的两条理由注释 | REQ-14 交付物；结构已定形 |
| 遮罩 / 对话框 | `:138-142`、`:147-152` | `data-upload-modal="consent"`、`role="dialog"`、`aria-*`、点遮罩取消 | 护栏（3 支探针按此定位） |
| 眉标 / 标题 | `:154-164` | `知情同意确认`／`知情同意书`（`id="consent-dialog-title"`） | 非本批范围 |
| 滚动容器 | `:166` | `.soft-scroll mt-3 max-h-[min(55vh,24rem)] overflow-y-auto …` | 护栏（`:347-349` 判 `auto` 与上限）—— **class 一字不改**；展开区**新增在其内部** |
| 勾选控件结构 | `:172-179`、`:182-183` | `<label>` / `<input type="checkbox">` / `checked` / `onChange` / `<span>` 标签 | 只换 `<span>` 内文本（→ 常量表达式） |
| 未勾提示 | `:185-189` | `请先勾选知情同意` | D-11 已落地文本（**保持**） |
| 按钮区 | `:191-205`、`:207-208` | 「取消」按钮、`disabled={!checked}`、两个按钮的 `className` | 只换 `:206` 文本节点 |
| 逻辑与行为 | `:108-125`、`:297-299`（仅**增** 1 行 state）、`:472-475`（仅**增** 1 行复位） | Esc 取消；关闭即卸载；重弹重置勾选态 | 行为契约（PRD §4.5），**既有行不改** |
| **`:93` 注释** | `:93-94` | 「…用户点「我确认」之后才真正发起创建。」 | 改名后**陈旧**，但**本批不动**（授权边界，§0.4；登记于 PRD §8 ⑤） |
| 其它文案（非弹窗） | `:403` 等 | 「请先选择一段受访音频。」等 | REQ-28 已收口或属另批范围 |

### 2.2 其它文件 / 目录

- `src/lib/**`、`src/app/**`、`src/components/**`（除本文件）、`projects/**`：**零改动**。
- `docs/**`：本批**只改**两份 UI-06 文档（PRD ＋ 本单）；**不改** `docs/需求登记表.md`（其同步放**放行后另批**，§6.4）。
- `tmp/**`：**只**动 §1.2-1.6 明列的 **5 支**（3 支探针 ＋ 2 支断言件），其余 **45 支零改动**；`tmp/**` 被 `.gitignore:54` 屏蔽、不入库。
- 外部依据两份 `.docx`（`1.内容\`）：**只读**，本批与再批均**不得改动**（指纹唯一真值）。

---

## §3 探针影响面：复核命令与实测证据

### 3.1 复核命令（只读；实施轮改前 / 改后各跑一次）

```powershell
Select-String -Path 'tmp\*.mjs' -SimpleMatch -Pattern '我确认','同意并继续','研究/归档目的','研究 / 归档','本平台会对本次口述音频','我确认已获得受访者的','智能转写' |
  ForEach-Object { '{0}:{1}  {2}' -f $_.Filename, $_.LineNumber, $_.Line.Trim() }
```

**实测（2026-10-11）**：命中**只有 5 支文件** —— `verify-phase3.mjs`（`我确认`）、`cdp-req14-consent.mjs`（`我确认`／`研究/归档目的`／旧句）、`cdp-req13-outline.mjs`（`我确认`）、`cdp-ui06-consent-copy.mjs`（全部）、`check-ui06-docs.mjs`（`研究 / 归档` 负向 ＋ 定稿字面）。其中 `智能转写` 与 `同意并继续` 在 `tmp/**` **当前零命中**（本批新引入）。

### 3.2 为什么 v1 的「0 行必改」在本批**失效**（三处根因）

| # | 根因 | v1 结论 | v2 结论 |
| --- | --- | --- | --- |
| ① | **按钮改名**（`我确认` → `同意并继续`） | 不动按钮 ⇒ 0 行 | **6 行必改**（`verify-phase3.mjs:830/836`、`cdp-req14-consent.mjs:331/382/386`、`cdp-req13-outline.mjs:362/363`） |
| ② | **「研究/归档目的」字面退场**（PRD §3 A6） | 正文保留该字面 ⇒ `:155` 恒真、0 行 | **1 行必改**（`cdp-req14-consent.mjs:155` 改钉段一「智能转写」） |
| ③ | 其余负向 / 结构性断言 | —— | **6 行保留不改**（`:156`／`:300` ＋ 4 处注释）：新文案下仍恒真 ⇒ 改它只会扩大 diff |

### 3.3 §3 小结

| 探针 | 必改行数 | 依据 |
| --- | --- | --- |
| `tmp/verify-phase3.mjs` | **2** | 按钮改名 |
| `tmp/cdp-req14-consent.mjs` | **4** | 按钮改名（3）＋ 字面退场（1） |
| `tmp/cdp-req13-outline.mjs` | **2** | 按钮改名 |
| 其余（含 `cdp-req13-prefill.mjs`、`cdp-req28-labels.mjs`、`verify-ui06-extref.mjs`、`verify-ui29-docs-pos.mjs` 等） | **0** | §3.1 实测零命中 |
| **合计** | **8 行 / 3 支** | 与 §0.4 A8 授权逐行一致 |

> **不做「备份探针」动作**（改动范围已知且极小）；若实施中发现需要改动**第 4 支** ⇒ **立即停手、回总管**。

---

## §4 新探针设计：`tmp/cdp-ui06-consent-copy.mjs`（**只读** · 不入库）

**目的**：把 v2 的「文案 ＋ 展开区 ＋ 复位 ＋ 只读」从人工比对升级为**机器断言**，并把「文档 ↔ 常量 ↔ 页面」三方一致性钉死。**只读**（不改 DOM 数据、不发 POST、不打桩；仅导航 ＋ 点按钮开弹窗/展开/取消）。

**运行方式**：

```text
node tmp/cdp-ui06-consent-copy.mjs --docs-only   # 只跑 §4.1（不启 Chrome、不依赖 dev server）
node tmp/cdp-ui06-consent-copy.mjs               # §4.1 + §4.2-4.5（需 dev server 在 3000 端口）
```

**管道**：CDP 连接 / 导航 / `ev()` / `waitFor()` / `inject()` 照搬 `tmp/cdp-req14-consent.mjs`（同一登录 → 分流「上传音频」→ step3 → 选音频 → 点「开始处理」路径），只替换断言段。

### 4.1 文档侧断言（**先跑，不依赖浏览器**）

```js
// 与 tmp/check-ui06-docs.mjs 的 EXPECT 逐字节同源
const EXPECT = {
  body1: "平台将通过云端技术服务，对您本次录制或上传的口述资料进行智能转写、要素标引与校订脱敏，并为您提供资料保存与检索服务。",
  body2: "平台仅在您授权的范围内处理与使用资料，通过访问权限控制与脱敏处理保护个人信息。如需将资料用于公开展示、图书出版、网络传播等用途，平台将另行征求您的同意。资料保存期限、云端处理情况及撤回同意、更正与删除的申请方式，详见《个人信息处理说明》。",
  tick: "我已阅读并理解《个人信息处理说明》，同意平台按上述目的与方式处理本次口述资料。",
  button: "同意并继续",
};
```

| # | 断言 | 判定 |
| --- | --- | --- |
| U6-D1～D8 | 两份文档各自：`body1`／`body2`／`tick`／`button` **≥1 且整行逐字相等** | `lines.filter(l => l === EXPECT[k]).length >= 1` |
| U6-D9 | 两份文档 **CRLF ＋ 无 BOM** | 裸 `\n` 计数 `=== 0`、无 `\uFEFF` |
| U6-D10 | IMPL 照录 A5／A8 授权清单（含 `D-09/D-10 解冻` 与 `探针③`） | 子串在位 |
| U6-D11 | IMPL 声明「**3 支必改**」与「**0 行**」 | 子串在位 |
| U6-D12 | **展开区常量块数 ＝ 73** | IMPL 内 `{ kind: "` 出现 **73** 次 |
| U6-D13 | 常量分层：`kind: "h1"` ＝ **9**、`"h2"` ＝ **6**、`"table"` ＝ **5**、`"title"` ＝ **1**、`"p"` ＝ **52** | 计数相等 |
| U6-D14 | A7′ 正向：常量含「**校订脱敏**」与「**脱敏处理**」，且**不含**「研究」（负向防回归） | 子串计数 |
| U6-D15 | 常量**不含** `http`（5 个官方链接只有标签文字） | 计数 `=== 0` |

> 共 **20 项**（U6-D1～D8 ＝ 每份文档 4 项；U6-D13 展开为 title／h1／h2／p／table 五项判定）；与 `tmp/check-ui06-docs.mjs` 断言集**同源**（后者更严：额外检查行数 > 200 与 `研究 / 归档` 负向）。

### 4.2 页面侧 · **收起态**（开弹窗后立即取值）

```js
const pick = () => `(() => {
  const d = document.querySelector('[data-upload-modal="consent"]');
  if (!d) return null;
  const scroll = d.querySelector('.soft-scroll');
  const card = d.querySelector('[role="dialog"]');
  const label = d.querySelector('input[type="checkbox"]')?.closest('label');
  const toggle = d.querySelector('[data-ui06-toggle]');
  const panel = d.querySelector('[data-ui06-doc]');
  const btn = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '同意并继续');
  return {
    body1: d.querySelector('[data-ui06-part="body1"]')?.textContent.trim() ?? null,
    body2: d.querySelector('[data-ui06-part="body2"]')?.textContent.trim() ?? null,
    tick: label?.querySelector('span')?.textContent?.trim() ?? null,
    scrollText: scroll ? scroll.textContent : null,
    toggleText: toggle ? toggle.textContent.trim() : null,
    expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
    controls: toggle ? toggle.getAttribute('aria-controls') : null,
    panelPresent: Boolean(panel),
    panelCount: d.querySelectorAll('[data-ui06-doc]').length,
    h3: panel ? panel.querySelectorAll('h3').length : 0,
    h4: panel ? panel.querySelectorAll('h4').length : 0,
    tables: panel ? panel.querySelectorAll('table').length : 0,
    links: panel ? panel.querySelectorAll('a').length : 0,
    panelOverflowY: panel ? getComputedStyle(panel).overflowY : null,
    panelMaxHeight: panel ? getComputedStyle(panel).maxHeight : null,
    boxes: d.querySelectorAll('input[type="checkbox"]').length,
    confirmDisabled: btn ? btn.disabled : null,
    cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
    cardFitsViewport: card ? card.getBoundingClientRect().height <= window.innerHeight : null,
    scrollOverflowY: scroll ? getComputedStyle(scroll).overflowY : null,
    scrollMaxHeight: scroll ? getComputedStyle(scroll).maxHeight : null,
    dataModal: d.getAttribute('data-upload-modal'),
    cardRole: card ? card.getAttribute('role') : null,
    cardAriaModal: card ? card.getAttribute('aria-modal') : null,
    titleId: card ? card.getAttribute('aria-labelledby') : null,
  };
})()`;
```

| # | 断言（收起态） |
| --- | --- |
| U6-1 | `body1 === EXPECT.body1`（逐字） |
| U6-2 | `body2 === EXPECT.body2`（逐字） |
| U6-3 | `tick === EXPECT.tick`（逐字） |
| U6-4 | 触发行：`toggleText` 含「个人信息处理说明」、`expanded === 'false'`、`controls === 'ui06-consent-doc'` |
| U6-5 | **A7′ 正向事实断言**：`body1` 含「校订脱敏」**且** `body2` 含「脱敏处理」**且** `tick` **不含**「脱敏」 |
| U6-6 | `.soft-scroll` 文本含「智能转写」（＝ 探针② `:155` 的锚）**且不含**「研究 / 归档」 |
| U6-7 | **收起不渲染面板**：`panelPresent === false`、`panelCount === 0` |
| U6-8 | checkbox 数 ＝ 1、初始未勾、`confirmDisabled === true`（按钮字面 `同意并继续`） |
| U6-9 | `.soft-scroll`：`overflowY === 'auto'`、`parseFloat(maxHeight) <= 385`（沿用旧上限口径） |
| U6-10 | 结构锚点原样：`dataModal === 'consent'`、`cardRole === 'dialog'`、`cardAriaModal === 'true'`、`titleId === 'consent-dialog-title'` |
| U6-11 | `cardFitsViewport === true` |

### 4.3 页面侧 · **展开态**（`click('[data-ui06-toggle]')` 之后）

| # | 断言（展开态） |
| --- | --- |
| U6-12 | 面板出现：`panelPresent === true`、`panelCount === 1` |
| U6-13 | `expanded === 'true'`（`aria-expanded` 同步） |
| U6-14 | 面板样式：`panelOverflowY === 'auto'`、`panelMaxHeight === '240px'` |
| U6-15 | 层级还原：`h3 === 9`、`h4 === 6`、`tables === 5`、`links === 0` |
| U6-16 | 面板首尾内容：含「处理主体」（首章标题）与「更新本说明不自动扩大您原有的授权范围」（末段） |
| U6-17 | **弹窗高度不因展开变化**：`cardHeight` 与收起态**相等**（±1px） |
| U6-18 | **再次点击收起**：面板消失（`panelPresent === false`）、`expanded === 'false'` |

### 4.4 页面侧 · **重弹复位**（取消 → 再开）

| # | 断言 |
| --- | --- |
| U6-19 | 点「取消」→ 弹窗从 DOM 消失（`[data-upload-modal]` 为 `null`） |
| U6-20 | 再次点「开始处理」→ 弹窗再现，且 `expanded === 'false'`、`panelPresent === false`（**展开态归零**） |
| U6-21 | 同一时刻 checkbox 未勾、确认按钮 `disabled`（勾选态归零，既有契约） |

### 4.5 只读证明（全程）

| # | 断言 |
| --- | --- |
| U6-22 | `posts === 0`（「展开 → 收起 → 取消」全程**未发** `POST /api/projects`） |
| U6-23 | 展开 / 收起前后 `localStorage` ＋ `sessionStorage` 快照**相等**（不落存储） |

> **放行闸口**：`--docs-only`（**文档侧 20 项**）与全量（文档侧 **20 项** ＋ 页面侧 **32 项** ＝ 关闭态前置 9 ＋ 收起 11 ＋ 展开 7 ＋ 复位 3 ＋ 只读 2）**全部 `ok`**；任一 `FAIL` ⇒ 按 §6.2 回退**文案/实现**（**不改断言** —— `IMPL_REQ-28-D` §3.6 第 4 条）。截图留证：`tmp/run-ui06/consent-collapsed.png`／`consent-expanded.png`（自动建目录）。

---

## §5 验收清单（顺序不可颠倒：先改 `src` ＋ 3 支探针 → 静态 → 探针 → 人工 → 文档）

- [ ] **5.0 基线**：`git rev-parse --short HEAD`（应含 `a791d16` 或已知后继）；`npm run lint`、`npx tsc --noEmit` **各跑一次留基线**（改后只允许「无新增错误」）。
- [ ] **5.1 字面归零 / 就位**（用 `[IO.File]::ReadAllLines` ＋ `Select-String -SimpleMatch`，**禁用** `Get-Content` 定位）：

| 组 | 字面 | 范围 | 期望 |
| --- | --- | --- | --- |
| ① | `本平台会对本次口述音频` | `src/**` | **0**（旧正文句消失） |
| ② | `我确认已获得受访者的` | `src/**` | **0**（旧勾选句消失） |
| ③ | `研究/归档目的` | `src/**` | **0**（字面退场，含正文与勾选句） |
| ④ | `研究 / 归档`（带空格斜杠） | `src/**` | **0** |
| ⑤ | `我确认` | `src/**` | **1** —— 仅 `:93` 注释（陈旧留档，PRD §8 ⑤；**不是**按钮） |
| ⑥ | `同意并继续` | `src/**` | **1**（`CONSENT_BUTTON_LABEL` 常量值） |
| ⑦ | `平台将通过云端技术服务` | `src/**` | **1**（新正文段一就位） |
| ⑧ | `平台仅在您授权的范围内处理与使用资料` | `src/**` | **1**（新正文段二就位） |
| ⑨ | `我已阅读并理解《个人信息处理说明》` | `src/**` | **1**（新勾选句就位） |
| ⑩ | `智能转写` | `src/**` | **3**（段一 1 ＋ 展开区常量 2） |
| ⑪ | `校订脱敏` | `src/**` | **3**（段一 1 ＋ 常量 2） |
| ⑫ | `脱敏处理` | `src/**` | **4**（段二 1 ＋ 常量 3） |
| ⑬ | `脱敏` | **弹窗区段**（`ConsentDialog` ＋ 常量块） | **7**（JSX 2 ＋ 常量 5；**A7′ 豁免**，非缺陷） |
| ⑭ | `http` | **展开区常量块** | **0**（5 个官方链接只有标签文字） |
| ⑮ | `<a ` | **弹窗区段** | **0**（面板内不产生链接） |

- [ ] **5.2 文档与断言件一致性**：两份文档 **CRLF ＋ 无 BOM**；`node tmp/check-ui06-docs.mjs` **全绿**；`node tmp/cdp-ui06-consent-copy.mjs --docs-only` **全绿**（§4.1）；`node tmp/verify-ui06-extref.mjs` 仍 **32/32**（本批**不改** `docs/需求登记表.md`）。<br>※ `node tmp/verify-doc01.mjs` **不纳入本批放行判定**（基线过期、既有 FAIL 与本批无关；只要求失败数不新增）。
- [ ] **5.3 静态检查**：`npx tsc --noEmit` **无新增**；`npm run lint` **无新增**（本仓 lint ＝ `eslint`，无 prettier 回写）。
- [ ] **5.4 既有探针回归**（全部应绿；**3 支已按 §1.2-1.4 同步**）：
  - `node tmp/cdp-req14-consent.mjs` ✔ —— 重点看 `:300`（旧句不复活）、`:331/:382/:386`（新按钮字面可用）、`:343-345`（单勾选）、`:346`（弹窗不超视口）、`:347-349`（滚动区 `auto` ＋ 上限）、`:351-352`（`hasFixedText`＝「智能转写」且 `hasSpacedText === false`）；
  - `node tmp/cdp-req13-outline.mjs` ✔（`:359-363` 路径，按钮字面已同步）；
  - `node tmp/verify-phase3.mjs` ✔ —— **须确认弹窗内按钮点击步骤真实命中**（`clickText` 语义：找不到只返回 `false`，不抛错）；
  - `node tmp/cdp-req13-prefill.mjs` ✔、`node tmp/cdp-req28-labels.mjs` ✔（作用域不在本弹窗）。
- [ ] **5.5 新增断言**：`node tmp/cdp-ui06-consent-copy.mjs` → **全绿**（文档侧 20 ＋ 页面侧 32 项；`--docs-only` 可先跑文档侧）。
- [ ] **5.6 diff 审查**：`git status --short` → **1 个** `src/**` ＋ **2 个** `docs/**`；`git diff --stat` 与 §1.7 形态一致；`src/lib/**`、`src/app/**` 零改动；`tmp/**` 不入库；**行尾未被归一**（diff 不是整份）。
- [ ] **5.7 人工视觉复核**（两种宽度都要看）：
  - 桌面：弹窗内**两段正文 → 「▶ 个人信息处理说明」触发行 → 未勾提示 → 按钮**；点触发行 → 面板出现且**内部独立滚动**；`▶` 变 `▼`；再点收起；面板内 `h3`/`h4` 层级与 5 张表格可读、**无外链**；
  - **窄屏（≤ 640px）**：`.soft-scroll` 与面板**嵌套滚动**可正常操作（滚到底能看到触发行并展开）；
  - 未勾时确认按钮灰（文字「同意并继续」）＋ 提示「请先勾选知情同意」；勾选后可确认；Esc ／ 点遮罩 ／「取消」三路关闭；**重开弹窗勾选态与展开态均归零**。
- [ ] **5.8 文档留痕**：PRD §4.1／§4.3 与 IMPL §0.6 的逐字文案**逐字符一致**（由 5.2 的 U6-D1～D8 自动断言）。
- [ ] **5.9 越界复核**：PRD §5 非目标逐条确认未被顺手实现 —— 无第 2 个 checkbox、无留痕字段、无 `06 号` 渲染、无外链 `<a>`、无自动展开、无展开态记忆、无样式文件改动。

---

## §6 交付边界

### 6.1 本批 commit 范围（**3 个文件**）

| # | 文件 | 变更 |
| --- | --- | --- |
| ① | `src/components/upload/interview-upload-form.tsx` | **文案 3 处 ＋ 展开区新组件**（§1.1：≈ 211 insertions / 6 deletions） |
| ② | `docs/PRD_UI-06_知情同意弹窗.md` | **改写为 v2**（本轮已落笔；CRLF、无 BOM） |
| ③ | `docs/tasks/IMPL_UI-06_知情同意弹窗.md` | **改写为 v2**（本单；CRLF、无 BOM） |

- `tmp/**` 受 `.gitignore:54` 屏蔽 ⇒ 3 支探针 ＋ 2 支断言件的改动**不入库**（与既有探针一致）。
- 建议 message：`UI-06: 知情同意弹窗 v2（文案重写 + 说明全文展开区 + 按钮改名）`（如需关联 REQ-28，可加脚注 `REQ-28 P-1 解冻扩大执行`）。

### 6.2 判失败条件

| # | 触发 | 说明 |
| --- | --- | --- |
| ① | `git status --short` 出现**第 2 个** `src/**` 文件 | 越界（§0.3） |
| ② | diff 中出现**既有行**的 `className` / `data-*` / `aria-*` / `<input` / `<label` / `<Button` 改动 | 结构越界（**新增元素**上的 `data-ui06-*` 与 `className` 不算） |
| ③ | 5.1 组 ①～④、⑦～⑨、⑭、⑮ ≠ 期望，或 ⑤／⑥ ≠ 1 | 替换不彻底 / 旧句复活 / 字面漂移 |
| ④ | 5.4 任一探针变红，或 5.2／5.5 非全绿 | 护栏被破 ⇒ **回退文案 / 实现**（不改断言） |
| ⑤ | `src/lib/**` / `src/app/**` 出现改动 | 越界 |
| ⑥ | 触发行 / 面板**不在** `.soft-scroll` 内，或 `.soft-scroll` 的 class 被改 | 违反 PRD §4.2（弹窗高度契约） |
| ⑦ | 展开态在「取消 → 重弹」后仍为展开 | 违反 PRD §4.5 第 4 条（§0.6 ⑤ 已钉受控写法） |

### 6.3 回滚

- 代码：`git revert <commit>` 即可完全复原（无数据迁移、无状态残留、无依赖变更）。
- 若仅探针变红：**先回退文案 / 按钮字面**（回到 `我确认` 与占位句），再回总管复核 §3 论证。
- 若仅展开区出问题：**可单独回退常量块 ＋ 展开区 JSX**，保留文案与按钮改名（两者相互独立）；此时须同批回退 `cdp-ui06-consent-copy.mjs` 的 §4.3-4.5 断言。

### 6.4 本批**不涉及**

- `docs/需求登记表.md` 的同步（见 6.5）；REQ-28 其余冻结项（含 D-11 已落地文本）；UI-05 / UI-14 / UI-30 / BUG-11 等共用本文件的批次；帮助入口批次；`src/lib/**`（含 `oral-history.ts`、`server/project-store.ts`）；外部两份 `.docx`（只读）。
- **不做**「顺手」修正：`:93` 注释里的「我确认」、`verify-phase3.mjs:876` 的报告标签、`cdp-req14-consent.mjs:155` 的键名 `hasFixedText` —— 一律**只记录、另开单**。

### 6.5 放行后**另批**：登记表 / 台账同步清单（**不与本批混 commit**）

| # | 位置 | 现文 | 待改为 |
| --- | --- | --- | --- |
| ① | `docs/需求登记表.md` §1.2 UI-06 行（L87） | `候选（待 PRD）` | `**已完成**（commit <hash>，2026-10-XX）`（按全表口径） |
| ② | §三 UI-06「落地状态」（L680） | 「弹窗现仍为占位文案…替换动作在 UI-06 PRD 批执行」 | 「**已落地 v2**：正文两段／勾选句／按钮「同意并继续」＋《个人信息处理说明》全文展开区，见 `docs/PRD_UI-06_知情同意弹窗.md`；commit `<hash>`」 |
| ③ | §三 UI-06 现状锚点（L679） | `:167-169` / `:180-182` / `:92` | 复核行号（勾选句 −1 行、正文 ＋68 行、常量块 ＋129 行 ⇒ **行号整体重排**；改按**逐字锚点**定位） |
| ④ | §三 UI-06「外部依据」追注 | 「同批更新指纹或注明沿用原文件」 | 追加「UI-06 v2：**沿用原文件**、指纹不变」 |
| ⑤ | §5.1（L1046）UI 组行备注 | 「文案来源（同意书 ← …）」 | 追加「UI-06 **已落地 v2**（`<hash>`）」 |
| ⑥ | §5.2 关联条（L1107） | 「后续任何批次改动弹窗文案，须同批更新指纹或注明沿用原文件」 | 追加「本批为**首例执行**：沿用原文件、指纹不变」 |
| ⑦ | `docs/PRD_REQ-28_文案清理.md` §5 **P-4**（L196） | 「脱敏 → 隐私处理」全站统一 | 追加**缺口登记**：UI-06 v2 正文 2 处 ＋ 展开区 5 处「脱敏」属**照录官方用词**（A7′ 豁免）；是否收口待裁 |
| ⑧ | `docs/PRD_REQ-28_文案清理.md` §4 D-09／D-10（L132／L133） | 「（待定稿）」 | 追加「**已由 UI-06 v2 落地**（文案取任老师 2026-10-09 定稿），`<hash>`」 |
| ⑨ | `docs/PRD_REQ-28_文案清理.md` §5 **P-1**（L193） | D-09／D-10「逐字不动」 | 追加「**UI-06 v2 明文解冻并扩大**（A5，`<hash>`）」 |
| ⑩ | 登记表版本头 / 变更记录 | v2.9 | v2.10（含本次同步摘要） |

> 另：PRD §8 的 8 条「待确认」**不阻塞**本批；其中 ①（v2 删去责任句）、③（P-4 缺口）若总管改判，属**文案变更**（须重走 PRD §4 与本单 §0.6）。

---

## 附：依据来源与变更记录

**依据来源**

- 总管 **2026-10-11 授权清单**（本批 UI-06 最终版）：A5（解冻扩大）／A8（按钮改名 ＋ 3 支探针同步，逐行锚点）／A7′（「脱敏」豁免 ＋ U6-5 重定义 ＋ P-4 缺口回登）—— 原文照录于 **§0.4** 与 `docs/PRD_UI-06_知情同意弹窗.md` §3。
- 总管 **2026-10-09 两项裁决**（已被 v2 更新）：裁决 ①（正文取 B1 ＋ 来源三方分项标注）／裁决 ②（解冻 D-09/D-10，范围 2 处 5 行）—— 其中**来源分项标注义务**按 v1 措辞继续有效（PRD §3 A1）。
- **任老师 2026-10-09 v2 文案定稿**（正文两段 ＋ 勾选句 ＋ 按钮「同意并继续」）。
- `docs/PRD_UI-06_知情同意弹窗.md`（**PRD 定稿 v2**）：§1.1 现状／§1.4 目标／§2 来源与指纹／§3 裁决 A1–A8／§4.1／§4.3 逐字定稿与来源列／§4.2 展开区规格／§4.5 行为契约／§5 非目标／§6 互引边界／§7 验收／§8 待确认／§9 风险。
- `docs/需求登记表.md` v2.9：§三 UI-06（L657-680：外部依据、指纹、唯一真值声明、现状锚点、落地状态）／§1.2 L87／§5.1 L1046／§5.2 L1107。
- `docs/PRD_REQ-28_文案清理.md`：L132／L133（D-09／D-10）、L193（P-1）、L196（P-4）、L38（R4）。
- `docs/tasks/IMPL_REQ-28-D_上传音频文案与UI-05.md`：§0.1（行号口径）、§0.2（JSX 书写纪律）、§0.7（红线冻结 L62-66）、§2（探针纪律与静默 `false` 风险）、§3.6（文案 vs 断言的回退纪律）、§4.6（diff 边界）、§6（字面归零脚本用法）。
- 内部规格（仓库内）：`docs/记忆引擎_产品使用流程说明文档_v1.5.md:128-133`、`docs/记忆引擎_产品设计与技术规格文档_v2.1.md:238-244`（**本批只用于偏离登记与缺口比对**）。
- 外部依据（外置、不入 git，指纹见 PRD §2.3）：`06 知情同意书.docx`（个人 / 家庭版）、`个人信息处理说明.docx`（**73 块全文已提取**，4,124 字符）。
- 代码与探针实测（HEAD `a791d16`，2026-10-11，只读）：`src/components/upload/interview-upload-form.tsx`（**1,012 行**、纯 LF、无 BOM）：`:92-214`／`:297-299`／`:472-475`／`:1003-1009`；`tmp/cdp-req14-consent.mjs:155-156／300／331／346／382／386`；`tmp/verify-phase3.mjs:713／830／836／876`；`tmp/cdp-req13-outline.mjs:362-363`；`tmp/**` 全量字面普查（**50 支脚本**）。

**变更记录**

| 日期 | 版本 | 变更 |
| --- | --- | --- |
| 2026-10-09 | 初稿（B1 批） | 起草本单：§0 口径（行号 / 纪律 / **纯字面批** / A5 授权原文 / 探针 **0 行必改** ＋ 三护栏 / 逐字定稿 / 行尾 / 串行纪律）；§1 改动清单（2 处 5 行）；§3 探针影响面四条实测依据；§4 只读断言；§5 验收；§6 交付边界与登记表另批清单。 |
| 2026-10-11 | **v2（本版）** | **整篇重写**：① 规模由「2 处 5 行」升为 **文案 3 处 ＋ 展开区新组件**（§0.3 新增「授权项清单」表）；② §0.4 换为 **2026-10-11 授权清单原文**（A5 扩大／A8 三探针逐行／A7′ 豁免）＋ 新增「本轮只写文档、实施轮落代码」的范围声明；③ §0.5／§3 探针账目由「**0 行必改**」改为「**3 支必改（8 行）＋ 其余 0 行**」＋「探针-源同批」纪律；④ **新增 §0.6**：⓪ 逐字明文 ＋ ① 模块级常量 ＋ `CONSENT_DOC_BLOCKS` **全文 73 块**（逐字照录）＋ ② 正文/展开区 JSX 改前改后 ＋ ③④ 勾选句/按钮 ＋ ⑤ 父组件受控 state 裁决 ＋ ⑥ 契约点；⑤ §1.1 改 8 处逐项（含 `:299`／`:473`／`:1003-1009` 父组件三处）＋ §1.2-1.4 三支探针逐行「改前 → 改后」＋ §1.5／§1.6 断言件同步 ＋ §1.7 diff 形态；⑥ **§4 重写**为「文档侧 15 ＋ 收起 11 ＋ 展开 7 ＋ 复位 3 ＋ 只读 2」断言设计 ＋ `--docs-only` 开关；⑦ §5 验收表按 v2 字面重列（含 ⑤＝1、⑩～⑬ 的 A7′ 计数、⑭⑮ 禁链）；⑧ §6 交付边界与**登记表 / REQ-28 台账另批清单扩到 ⑩ 条**；⑨ 行号基线更新为 **`a791d16`**、`src` 文件行数更正为 **1,012 行**。 |


