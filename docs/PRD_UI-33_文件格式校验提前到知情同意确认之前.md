# UI-33 文件格式校验提前到知情同意确认之前 · PRD

- 需求编号：UI-33 ｜ 来源：总管 2026-10-15 裁定立号（**反馈原文 / 批次待补**）｜ 优先级：P2 ｜ 状态：**PRD 已出，待实施**
- 界面落点：`/upload` 上传页（旧版三步向导 ＋ 新版分流分支同一组件）→ `src/components/upload/interview-upload-form.tsx`（**唯一生产改动文件**）
- 关联：`docs/需求登记表.md:1242`（§三 UI-33）· UI-06（知情同意弹窗，同组件已验收面）· BUG-11（`accept` 串来历）/ BUG-12（服务端兜底文案）· REQ-32（同文件并行批，须排期互斥）
- 硬约束：`src/lib/server/upload-store.ts` / `ConsentDialog` / `CONSENT_*` 常量 / `src/app/api/projects/[projectId]/interview/audio/route.ts` **全部 0 hunk**
- 行号基线：2026-11-18 实测（`[IO.File]::ReadAllLines` 口径，`interview-upload-form.tsx` 共 **1222 行**）。**注意**：PowerShell `Get-Content` 把无 BOM 的 UTF-8 当 GBK 解码，同一文件会报 1138 行 —— **不作口径**；行号随 `src` 改动必漂移，实施一律按 §2 的「区块语义 ＋ 逐字锚点」定位
- 设计裁决：总管已裁 **7 项**（§0.2 全部逐条落定），本 PRD **无剩余待裁决项**

## 0. 一句话概述

把「音频格式不合法」的判定从**服务端 400 回包**提前到**用户选文件的那一刻**，并在**打开知情同意弹窗之前**再判一次 —— 用户不必先勾完「我已阅读并理解《个人信息处理说明》」、点下「同意并继续」，才在页面错误区看到「仅支持常见音频文件格式上传。」。

### 0.1 现状缺口（代码事实，2026-11-18 实测）

| 位置 | 现状 | 后果 |
|---|---|---|
| `:48` | `const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,audio/*";` | 只作用于**文件选择框**筛选；拖拽 / 程序化构造的 `File` 完全不受约束；`audio/*` 还会把 `audio/webm` 等一并放进选择框 |
| `:540-554` `handleFileChange` | 只判 `nextFile.size > maxAudioBytes`（`:543`，100MB），合法时 `setAudioFile(nextFile)` ＋ `setError(null)`（`:552-553`） | **无任何格式判定** ⇒ 选了 `.txt` 也照样进「已选择：…」态 |
| `:564-582` `validateStepOne` | 仅必填字段（项目名 / 受访者 / 自定义场景 / 保密级别） | 无格式项；且该函数被 `submitProject:628` 复用 ⇒ **禁止**把格式判定塞进来（会让步骤一与步骤三的错误串台） |
| `:671-683` `handleFormSubmit` | `step === 3` 时**直接** `setConsentChecked(false)` → `setConsentDocOpen(false)` → `setConsentOpen(true)`（`:680-682`） | 格式问题在**用户点「同意并继续」之前完全不可见** |
| `:685-688` `handleConsentConfirm` → `:621-669` `submitProject` | 判空 `:622-625`；`createProject` `:639`；失败时把 `submitError.message` 原样写进错误区 `:663-667` | 非法格式**只能由服务端 400 暴露**（`upload-store.ts:58-60` 抛 `仅支持常见音频文件格式上传。`），此时用户已完成知情同意确认 |
| `:1144-1148` | 错误条容器（`border-danger/20 bg-danger/8 text-danger`） | 唯一的错误呈现位 —— 本批**复用**，不新增 UI 元素 |

**关键时序**：用户点「开始处理」→ 弹窗（`ConsentDialog`，`:1211+`）→ 勾选 → 「同意并继续」→ `submitProject` → multipart 上传 → 服务端 `saveInterviewAudio`（`upload-store.ts:46`）→ 抛错 → 回 400 → 错误条出现。**整条链路上，「格式」这道门槛排在「知情同意」之后**，这就是本条要挪动的唯一对象。

### 0.2 已裁决口径（总管，逐条落定 · 本 PRD 直接照写，不再待裁）

| # | 决策点 | 裁决 | PRD 落点 |
|---|---|---|---|
| D1 | 客户端校验方式 | **扩展名 ＋ MIME 双点校验**（与服务端**同构**：`!isAudioMime && !allowedExtensions.has(ext)` 取反 ⇒ **任一命中即放行**） | §3.2 |
| D2 | 扩展名白名单 | **`.mp3` / `.wav` / `.m4a` / `.aac` / `.flac` / `.ogg` / `.mp4`（7 种）** —— 与 `upload-store.ts:14-22` 逐项一致 | §3.2 |
| D3 | `webm` | **客户端不加入白名单**；服务端 `upload-store.ts` 的 MIME 分支**保持不动** | §3.2 / §4.1 |
| D4 | 校验时机 | **`handleFileChange`（即时）＋ `handleFormSubmit`（打开 consent 前二次）** | §3.3 / §3.4 |
| D5 | 错误文案 | **`仅支持常见音频文件格式上传。`** —— 逐字复用 `upload-store.ts:59`，前后端对用户只留一句话 | §3.5 |
| D6 | `accept` 属性 | 收窄为 **`.mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4`**（**去掉 `audio/*`**） | §3.1 |
| D7 | 改动范围 | **仅 `interview-upload-form.tsx`**；**不动** `upload-store.ts` | §5 |

### 0.3 派生约束（由 D1~D7 ＋ 既有验收面推导，非新裁决）

| # | 约束 | 依据 |
|---|---|---|
| C1 | **第二道校验不得拦「没有选文件」** —— `audioFile === null` 时照旧打开 consent，空文件提示仍由 `submitProject:622-625`（`请先选择一段受访音频。`）在「同意并继续」之后给出 | `tmp/verify-phase3.mjs:680-730` 的 **I2 / I3 两臂就是「不选文件 → 点『开始处理』→ 断言弹窗打开」**；若在 `handleFormSubmit` 加空文件拦截，会直接把这两条既有绿臂打红。且本条的语义边界是**格式**，不是必填 |
| C2 | **客户端 MIME 用显式白名单，不用 `audio/*` 通配** | D3 要求 webm 不入客户端白名单；若 MIME 分支写成 `type.startsWith("audio/")`（服务端写法），`audio/webm` 会在客户端**放行**，与 D3 冲突。故客户端取「显式 10 个 MIME」而非通配 —— **结构同构、常量更窄**，不对称性在 §4.1 明写 |
| C3 | 判定顺序固定为 **大小 → 格式** | `:543-550` 的 100MB 分支文案已验收（BUG-11 面）；同时超限且格式非法时先报 100MB，保证既有文案不被新分支抢走 |

## 1. 目标与非目标

**目标**

1. 非法格式在**选文件那一刻**就报错（`handleFileChange`），用户不进入「已选择：…」态。
2. 即便非法 `File` 已经进了 state（拖拽 / 程序化构造 / 未来新增入口），也要在**打开知情同意弹窗之前**被拦下（`handleFormSubmit`），不再让用户先做完同意确认。
3. 错误文案与服务端**逐字一致**，不出现「前端一套、后端一套」。
4. 单文件、零新依赖、零服务端改动；合法文件路径行为**完全不变**。

**非目标**

- **不改 `src/lib/server/upload-store.ts`**（白名单仍模块私有、不导出；`MIME` 分支 `:55-60` 一字不动）。
- **不改 `ConsentDialog`**（`:225-410`）与 `CONSENT_*`（`:99-105`）—— UI-06 已验收面。
- **不改 AI 访谈 webm 归档链**：`src/app/api/projects/[projectId]/interview/audio/route.ts`（复用 `saveInterviewAudio` 于 `:89`）0 hunk。
- **不新增空文件拦截**（见 §0.3 C1）。
- 不做文件内容嗅探（magic number）/ 不做时长、码率、采样率校验 —— 另立需求。
- 不把 `.mp4` 收窄成「仅音频 mp4」，不看 `file.type` 是否 `video/mp4`（服务端同口径，收窄另立）。
- 不新增「格式说明」常驻文案 / tooltip / 图标（错误只在失败时出现在 `:1144-1148`）。
- 不修 `:540` 未清 `input.value` 的既有缺口之外的东西（本批只在**两条拒绝分支**清 `input.value`，与 100MB 分支同形）。

## 2. 落点与定位口径

- **主落点（唯一改动文件）**：`src/components/upload/interview-upload-form.tsx`，3 处：
  1. `:48` —— `accept` 串（D6）；
  2. `:540-554` —— `handleFileChange`（D4 第一道）；
  3. `:671-683` —— `handleFormSubmit`（D4 第二道）。
- **新增常量 / 函数**：紧随 `:48` 之后、`:49` 的 100MB 注释之前插入（§3.2），与 `maxAudioBytes` 同区。
- **逐字锚点（实施时按此定位，不认行号）**：
  1. `const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,audio/*";`
  2. `// 与 src/lib/server/upload-store.ts 的 100MB 业务上限同口径（那边是既有实现，本批不动）：`
  3. `if (nextFile && nextFile.size > maxAudioBytes) {`
  4. `    // 每次创建都重新确认：先重置勾选态并弹窗，确认后才真正创建。`
  5. `    setConsentOpen(true);`
- **错误呈现位（复用，不改）**：`:1144-1148`；`accept` 落点 `:1135`，`onChange` `:1136`。
- **禁止改动的邻近锚点**：`ConsentDialog` 渲染 `:1211+`、`data-upload-modal="consent"`（组件内 `:273`）、`CONSENT_*` `:99-105`、`?autostart=1` 跳转链 `:661`。

## 3. 定稿形态

### 3.1 `accept` 收窄（D6）

```tsx
const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4";
```

> 只影响选择框的默认过滤（含移动端相册 / 文件 App 的候选集），**不是校验**；拖拽路径本来就不看 `accept`，这也是 D4 第二道存在的理由。

### 3.2 常量与判定函数（新增，紧随 `:48`）

```tsx
// UI-33：格式白名单 —— 扩展名集合与 src/lib/server/upload-store.ts:14-22 逐项一致。
// 服务端那份是模块私有（未导出），本批既不导出它、也不改那个文件，
// 客户端另存一份同口径常量，靠注释锁住「两处必须同步」。
// webm 刻意不在其中：它只走 AI 访谈录音链路（interview/audio），不经本表单。
const allowedAudioExtensions = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".mp4",
]);
// MIME 白名单只列上面 7 种格式的常见取值 —— 不用 "audio/*" 通配：
// 通配会把 audio/webm 一并放行，与「webm 不入客户端白名单」的裁决冲突（本 PRD §0.3 C2）。
const allowedAudioMimeTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
]);
// 文案逐字复用 upload-store.ts:59，前后端对用户只留一句话。
const audioFormatError = "仅支持常见音频文件格式上传。";

function getFileExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

// 与服务端同构的两点判定：扩展名或 MIME 任一命中即放行 —— 即 upload-store.ts:55-60
// （!isAudioMime && !allowedExtensions.has(extension)）取反。
// 保留「或」的理由：部分系统 / 浏览器给不出 file.type（空串）或给非标准值，
// 只认 MIME 会误伤合法 .m4a / .wav；只认扩展名又挡不住无扩展名的伪装文件。
function hasSupportedAudioFormat(file: File) {
  return (
    allowedAudioExtensions.has(getFileExtension(file.name)) ||
    allowedAudioMimeTypes.has(file.type.split(";")[0].trim().toLowerCase())
  );
}
```

**取值理由（逐条可核）**

| 项 | 取值 | 理由 |
|---|---|---|
| `getFileExtension` 而不用 `path.extname` | `lastIndexOf(".")` | 本文件是 `"use client"` 组件，**不能引 Node `path`**（会污染客户端包）；等价语义：取**最后一个**点后的片段、转小写 |
| `file.type.split(";")[0].trim().toLowerCase()` | 归一化 | `audio/webm;codecs=opus` 这类带参数值在存量数据里真实存在（见 §4.2）；不做归一化会 `Set.has` 恒假 |
| MIME 含 `audio/mp3` / `audio/x-wav` / `audio/x-m4a` / `audio/flac` / `audio/x-flac` | 别名 | 浏览器 / 操作系统给出的 MIME 不统一；存量实测 `.m4a` 落盘 MIME 为 **`audio/x-m4a`**（§4.2），必须命中 |
| MIME **不含** `audio/webm` / `audio/opus` / `audio/wma` | 收窄 | D3：webm 只属于 AI 访谈链路；其余非白名单音频格式本来服务端也不接收（扩展名不在集合内） |
| `audioFormatError` 用常量而非内联 | 常量 | 与 `CONSENT_*`（`:99-105`）同一理由：逐字文案要能被脚本按「整行相等」核验 |

### 3.3 `handleFileChange` 第一道（即时）

在 **100MB 分支之后**（C3 顺序）、`setAudioFile(nextFile)` 之前插入：

```tsx
    // UI-33：格式在「选文件」这一步就判 —— 与上面 100MB 同理，不必等用户勾完知情同意、
    // 白跑一次 multipart 才被服务端 400 打回。判定口径见 hasSupportedAudioFormat。
    if (nextFile && !hasSupportedAudioFormat(nextFile)) {
      setAudioFile(null);
      setError(audioFormatError);
      // 同 100MB 分支：不清 input.value 的话，重选同一个非法文件不会触发 change。
      event.target.value = "";
      return;
    }
```

- `nextFile` 为 `null`（用户点了取消）时**不判**，落到 `setAudioFile(null)` ＋ `setError(null)` —— 与现状一致。
- 清 `input.value` 的理由与 `:547-548` 逐字同源。

### 3.4 `handleFormSubmit` 第二道（打开 consent 之前）

在 `step === 3` 分支的最前面插入（**必须早于 `setConsentChecked(false)`**）：

```tsx
    // UI-33：第二道 —— accept 只过滤选择框，拖拽 / 程序化构造的 File 能绕过去；
    // 这里在打开知情同意弹窗之前再判一次，避免用户勾完「同意并继续」才被服务端 400 打回。
    // 无文件时不拦：空文件提示仍由 submitProject（:622-625）给，且 verify-phase3 的
    // I2 / I3 两臂就是「不选文件直接开弹窗」，拦掉会把既有验收面打红（本 PRD §0.3 C1）。
    if (audioFile && !hasSupportedAudioFormat(audioFile)) {
      setAudioFile(null);
      setError(audioFormatError);
      return;
    }
```

插入后的完整顺序（`step === 3` 分支）：

1. **【新增】格式兜底判定**（命中即 `return`，弹窗不打开）
2. `setConsentChecked(false)`
3. `setConsentDocOpen(false)`
4. `setConsentOpen(true)`

> **不做**：不在 `goNext()` / `goToStep()` 里加判定（会污染步骤 1→2 的过渡）；不在 `validateStepOne()` 里加（`:628` 复用会串台，登记表 §三 风险 ② 已列）；不在 `submitProject()` 里加（那是第三道，属于 consent 之后，不解决本条问题）。

### 3.5 错误呈现（复用既有）

- 文案：`仅支持常见音频文件格式上传。`（`audioFormatError`，逐字同 `upload-store.ts:59`）。
- 位置：`:1144-1148` 的 `error` 条 —— **不新增** DOM 节点、不加 `data-*`、不改样式类。
- 清空时机：用户下一次选到合法文件时 `setError(null)`（`:553` 现有行为）。

### 3.6 判定矩阵（客户端 `hasSupportedAudioFormat`，与服务端 `upload-store.ts:55-60` 对照）

| # | 文件名 | `file.type` | 客户端 | 服务端 | 是否一致 |
|---|---|---|---|---|---|
| 1 | `a.wav` | `audio/wav` | 放行（扩展名 ＋ MIME 双命中） | 放行 | ✅ |
| 2 | `a.m4a` | `audio/x-m4a` | 放行（双命中） | 放行 | ✅ |
| 3 | `a.mp3` | `""`（空） | **放行**（扩展名命中） | 放行（扩展名命中） | ✅ |
| 4 | `a.txt` | `text/plain` | **拒** | 拒（400） | ✅ |
| 5 | `a`（无扩展名） | `audio/mpeg` | **放行**（MIME 命中） | 放行（MIME 命中） | ✅ |
| 6 | `a.webm` | `audio/webm` | **拒**（D3） | 放行（`audio/` 前缀） | ⚠️ **刻意不对称**，见 §4.1 |
| 7 | `a.m4a` | `video/mp4`（异常 MIME） | 放行（扩展名命中） | 放行 | ✅ |
| 8 | `a.mp4`（视频） | `video/mp4` | 放行 | 放行 | ✅（既有口径，未收窄，见 §7-④） |

## 4. 前后端对称性与存量影响

### 4.1 判定不对称（**必须明写**，本 PRD 已知取舍）

| 维度 | 客户端（本批新增 `hasSupportedAudioFormat`） | 服务端（`upload-store.ts:55-60`，**本批 0 hunk**） |
|---|---|---|
| 扩展名集合 | 7 种（D2） | 7 种（`:14-22`），**逐项相同** |
| MIME 判定 | **显式 10 个 MIME**（不含 `audio/*`、不含 `audio/webm`） | `file.type.startsWith("audio/")`（**任意** `audio/*`） |
| 逻辑关系 | **或**（任一命中即放行） | **或**（`!isAudioMime && !ext` 才拒） |
| 结果差异 | 仅一类：`audio/webm`（及其他未列出的 `audio/*`）**客户端拒 / 服务端放行** | — |

**为什么这个不对称是可接受的**

1. **webm 不会经过本表单**。它由 AI 访谈页录制产生，走 `POST /api/projects/[projectId]/interview/audio`（`route.ts:89` 复用 `saveInterviewAudio`），**完全不进 `interview-upload-form.tsx`**。
2. 所以「客户端拒 / 服务端放行」这条缝隙**没有用户可见入口**：用户在 `/upload` 选不到、拖不进 webm 的合法路径（D3 即此意）。
3. 反方向才是危险的（「前端收 → 用户已同意 → 后端拒」）：本设计下客户端白名单 ⊂ 服务端受理集，**永远不会**放过一个服务端会拒的文件（`a.txt` / `text/plain` 两侧都拒；见 §3.6）。

### 4.2 存量数据（2026-11-18 实测 `storage/projects.json`）

| 指标 | 实测 |
|---|---|
| `audioStoragePath` 非空条目 | **25** 条 |
| 落盘扩展名分布 | `.m4a` 13 / `.audio` **6** / `.mp3` 3 / `.wav` 3 |
| `audioMimeType` 分布 | `application/octet-stream` 20 / `audio/x-m4a` 13 / **`audio/webm;codecs=opus` 6** / `audio/mpeg` 3 / `audio/wav` 3 |
| 6 条 `.audio` 的来源 | **全部**为 AI 访谈录音（`audio/webm;codecs=opus`）—— 由 `upload-store.ts:56` 的 MIME 分支放行、`:65` 因扩展名不在白名单而改存 `.audio` |

**结论**：
- 存量 6 条 `.audio` 是**历史产物**，本条**不重校验、不回灌、不改名**（无迁移脚本、无 `storage` 写入）。
- 本条的校验只发生在**「用户新选一个文件」**这一事件上；项目详情页 / 素材库 / 导出 / 断点续访读取的都是已落盘记录，**不经过** `hasSupportedAudioFormat`。
- 因此「客户端不认 webm」不会让任何一个旧项目变红。

## 5. 边界与不触碰面（逐条可核）

| 关联 | 边界 |
|---|---|
| **`src/lib/server/upload-store.ts`** | **0 hunk**。白名单 `:14-22` 不导出、不移动；格式判定 `:55-60` 与文案 `:59` 一字不动；`:65` 的 `.audio` 兜底不动 |
| **`ConsentDialog`**（`:225-410`） | **0 hunk**：结构 / 文案 / 勾选逻辑 / `data-upload-modal="consent"` `:273` / `data-ui06-part` `:301-302` 全不动；本批只动「**何时**打开它」 |
| **`CONSENT_*`**（`:99-105`） | **0 hunk**：`CONSENT_BODY_1` / `CONSENT_BODY_2` / `CONSENT_TICK` / `CONSENT_BUTTON_LABEL` 与《个人信息处理说明》`CONSENT_DOC_BLOCKS`（`:115+`）不动 |
| **`interview/audio/route.ts`** | **0 hunk**；webm 归档链（`:89` `saveInterviewAudio`）行为不变 |
| **`?autostart=1` 跳转链**（`:661`） | **0 hunk**（REQ-34 交叉面） |
| **`validateStepOne`**（`:564-582`） | **0 hunk**：格式判定**不得**写进这里（被 `:628` 复用，会串台） |
| **100MB 分支**（`:543-550`） | 文案与顺序不动；新分支**插在其后**（C3） |
| **REQ-32** | 同文件并行批（新建页组件 ＋ 本文件 UI 入口）⇒ **须排期互斥**，不得同批改 |
| **UI-05 / UI-14 / UI-30** | 同文件其余字段面 ⇒ 沿「同一文件不得两批并行」口径合并排期 |
| **BUG-11 / BUG-12** | `:48` 的 `accept` 串出自 BUG-11、服务端兜底文案出自 BUG-12 ⇒ 本批落在其已验收面的邻近行，须在交付物里附「`:543-550` 100MB 分支 0 逻辑改动」摘录 |

## 6. 验收标准（逐条可验，实施轮逐条打勾）

- **AC-1（合法格式放行）** 选一个 `.wav`（`type: audio/wav`）→ 出现「已选择：<文件名>，x.xx MB」、**无**错误条、点「开始处理」正常打开 consent。
- **AC-2（非法格式即时拦）** 选一个 `.txt`（`text/plain`）→ **在 `handleFileChange` 当下**（无需点任何按钮）出现 `仅支持常见音频文件格式上传。`；不出现「已选择」态；`input.value` 被清空（再选同一个 `.txt` 仍能触发 `change`）。
- **AC-3（绕过 `accept` 仍被拦）** 用 `DataTransfer` 构造 `.txt` ＋ `text/plain` 的 `File` 直接赋给 `input.files` 并派发 `change`（等价于拖拽 / 程序化路径，`accept` 不生效）→ **consent 不会打开**，错误条出现；同时静态断言 `handleFormSubmit` 的格式分支**位于 `setConsentOpen(true)` 之前**（覆盖「state 内已存在非法 `File`」的纵深防御）。
- **AC-4（不传文件）** 不选文件直接到 step 3 点「开始处理」→ consent **照旧打开**（既有行为不变）；勾选后点「同意并继续」→ 错误区出现 `请先选择一段受访音频。`（`submitProject:622-625`），**不发** POST。
- **AC-5（webm 归档链不受影响）** `git diff --numstat -- src/lib src/app` **为空**；代码审读：`upload-store.ts:55-60` 的 MIME 分支原样（`isAudioMime` 仍在）；`interview/audio/route.ts:89` 未改；可选加速回归 —— 走一次 AI 访谈录音，归档条目仍落 `.audio` ＋ `audio/webm;codecs=opus`。
- **AC-6（存量旧项目不受影响）** `storage/**` 0 写入；任取 1 个存量 `.audio` 项目打开详情页 / 素材区 / 导出，行为与改前一致（校验只在「新选文件」事件上发生）。
- **AC-7（`accept` 收窄）** 控制台 `document.querySelector('input[type="file"]').accept === ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4"`（**不含** `audio/*`）。
- **AC-8（文案逐字）** 错误条文本 `=== "仅支持常见音频文件格式上传。"`；全文件该字面量**出现 1 次**（常量定义处）。
- **AC-9（探针）** `tmp/verify-phase3.mjs` 的 **I1 上传臂**（`:812` 注入 `probe-upload.wav` ＋ `:779` `type: 'audio/wav'`）仍绿；**I2 / I3 无文件臂**（`:680-730`）仍绿（守 C1）。
- **AC-10（改动面）** `git status --porcelain -- src` 只有 `src/components/upload/interview-upload-form.tsx`；`git diff --numstat -- src` ≈ `66 1`（实测为准，见 §8）。
- **AC-11（顺序）** 同时超限（>100MB）且格式非法时，错误区显示 `演示版本建议上传 100MB 以内的音频文件。`（大小优先，C3）。

## 7. 风险与对策

| # | 风险 | 对策 |
|---|---|---|
| ① | **客户端 / 服务端判定不对称**（客户端 MIME 显式白名单 vs 服务端 `audio/` 前缀；存量 6 条 `.audio` webm） | §4.1 已论证「客户端白名单 ⊆ 服务端受理集」，危险方向不可能发生；webm 不经本表单；存量不重校验。**若后续要把 MIME 改成 `audio/*` 通配，等于把 webm 放回客户端白名单 —— 须另裁** |
| ② | 误伤合法文件（`file.type` 为空 / 非标准 MIME，如某些环境给 `audio/mp4`、`audio/x-m4a`） | 采用「或」语义 ＋ MIME 别名表（§3.2）；AC-1 / AC-6 实测。**不得**为救场私自加 `audio/*` 通配 |
| ③ | 第二道在正常 UI 路径**不可达**（`handleFileChange` 已清 `input.value`），造成「假绿」 | AC-3 用「程序化注入 ＋ 静态顺序断言」双证；任务单 S0 的探针必须含这两条 |
| ④ | `.mp4` 扩展名同时容纳视频（`video/mp4` 也放行） | 与 `upload-store.ts` **同口径**，属既有行为；收窄成「仅音频 mp4」须另立需求，本批不做 |
| ⑤ | 加了「无文件拦截」会把 `verify-phase3` I2 / I3 打红 | §0.3 C1 明确禁止；AC-4 / AC-9 双向守门 |
| ⑥ | 同文件多批并行（UI-06 / REQ-32 / UI-05 / UI-14 / UI-30） | 开工前 `git status` 干净；任务单 §0 要求「本批为下一手唯一批」 |
| ⑦ | 文档锚点漂移加剧预存红单 `tmp/verify-bug11-12-docs.mjs` | 该探针钉的是**文档**行号，自 v2.23 起已漂移，属**预存红单**，**不计本条门禁**、本批不回改 |
| ⑧ | 用户选中非法文件后 `audioFile` 被清空，误以为「白选了」 | 错误条即说明原因（文案与服务端 100% 相同）；下一次选合法文件自动 `setError(null)` |

## 8. 附录 A：改动规模预估

| 处 | 变化 | 预估 |
|---|---|---|
| `:48` `acceptedAudioExtensions` | 改字（去 `audio/*`） | `−1 / +1` |
| `:49-` 常量块（§3.2） | 新增 3 常量 ＋ 2 函数 | **+43** |
| `:540-554` `handleFileChange` | 新增格式分支 | **+12** |
| `:671-683` `handleFormSubmit` | 新增兜底分支 | **+10** |
| **合计** | **3 hunk / 1 文件** | **≈ `+66 −1`**，文件 **1222 → ≈1287 行**（以 `[IO.File]::ReadAllLines` 实测为准） |

- 新增依赖 / state / effect / 接口调用 / 服务端改动 / CSS 类 / 组件文件：**全 0**。
- `interview-upload-form.tsx` 行尾为 **LF**（`src/**` 实测纯 LF、无 BOM）⇒ 实施**禁止**把 LF 归一为 CRLF（否则整份 1222 行 diff，复核失效）。

## 9. 附录 B：探针影响（2026-11-18 实测扫描；**按用户约束本轮未运行任何探针**）

| 探针 | 影响 |
|---|---|
| `tmp/verify-phase3.mjs` **I1 上传臂** | 注入 `probe-upload.wav` ＋ `type: 'audio/wav'`（`:775-783` / `:812`）⇒ 扩展名 `.wav` 命中、MIME `audio/wav` 命中 ⇒ **预期仍绿** |
| `tmp/verify-phase3.mjs` **I2 / I3 臂** | `:680-690` 进入 step 3 后**不选文件**直接 `clickText('开始处理')`，断言 `[data-upload-modal="consent"]` 出现 ⇒ 依赖 §0.3 C1「无文件不拦」⇒ **预期仍绿** |
| `tmp/cdp-req14-consent.mjs` / `tmp/cdp-ui06-consent-copy.mjs` / `tmp/cdp-req13-outline.mjs` / `tmp/_b1-cdp-ui06-consent-copy.mjs` | 均注入 `*.wav` ＋ `audio/wav` 后再点「开始处理」⇒ 合法路径，**预期不受影响** |
| `tmp/verify-bug11-12-docs.mjs` | 钉**文档**锚点（含 `:48` / `:671-683` 之类行号），本批文档与源码双改动会继续加剧漂移 ⇒ **预存红单，不计门禁** |
| `tmp/verify-bug12-sanitize.ts` / `tmp/_bug12-live.mjs` | 直接打 `POST /api/projects`（服务端 400 面），**不经客户端表单** ⇒ 不受影响（`upload-store.ts` 0 hunk） |

## 10. 附录 C：实施顺序与交付

1. **S0 先写探针**（新增 UI-33 专属断言，先红后绿）—— 见任务单 §S0。
2. S1 `accept` 收窄 → S2 `handleFileChange` 第一道 → S3 `handleFormSubmit` 第二道（逐字块见任务单 §1）。
3. S4 离线自检（`numstat` / 行数 / 字面量计数 / `src/lib` 0 diff）→ S5 探针回归 → S6 AC 全表 ＋ 截图 → S7 登记表回写（**v2.41**）→ S8 git（不 push）。
4. 任务单：`docs/tasks/IMPL_UI-33_文件格式校验提前到知情同意确认之前.md`。



