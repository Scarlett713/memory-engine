# BUG-18 「创建项目并处理」重复提交防护 · PRD

- 需求编号：**BUG-18**（登记表**下一可用号**，见 §0.4 水位）｜ 来源：总管 2026-11-19 指派（只读扫描 → PRD ＋ 任务单）｜ 优先级：**P1**（重复创建项目 = 用户数据面污染，非纯样式）｜ 状态：**已实施 ＋ 静态/行为双臂实测通过（2026-11-19），待验收**
- 界面落点：`/upload` 上传页（旧版三步向导 ＋ 新版分流分支**同一组件**）→ `src/components/upload/interview-upload-form.tsx`（**唯一生产改动文件**）
- 关联：`docs/需求登记表.md` §1.2 UI-33 行（本版 v2.42 水位 `:165`；**同文件上一批，已 commit `c17d09e`**）· `docs/PRD_UI-33_文件格式校验提前到知情同意确认之前.md`（同文件同区段前一批）· UI-06（知情同意弹窗，已验收面）· BUG-11 / BUG-12（同文件邻近已验收面）
- 硬约束：`src/app/api/projects/route.ts` / `src/lib/server/**` / `src/store/project-workspace.ts` / `storage/**` **全部 0 hunk**（§4）
- 行号基线：**2026-11-19 实测**（`[IO.File]::ReadAllLines` 口径，`interview-upload-form.tsx` 共 **1287 行**；`project-workspace.ts` **160 行**；`api/projects/route.ts` **236 行**）。**注意**：PowerShell `Get-Content` 把无 BOM 的 UTF-8 当 GBK 解码 ⇒ 同一文件报 **1187** 行，**不作口径**；行号随 `src` 改动必漂移，实施一律按 §2 的「区块语义 ＋ 逐字锚点」定位
- 工作区状态：`HEAD = d498afa`（docs v2.41 UI-33 验收落盘）· `git status --short` **仅** `_delivery/` ＋ 交付包 zip（未跟踪）· `git diff --numstat -- src` **空** ⇒ **本批须为下一手唯一批**，无在途批冲突
- **裁决（总管 2026-11-19，逐条见 §0.2.1）**：P1 ✅ 按钮 disable ＋ loading（**实测本已存在**，本批不改、只由探针守门）｜P2 ✅ 提交函数入口加锁（早退）｜P3 ✅ 失败/异常后解锁｜P4 ✅ 弹窗确认按钮接 `submitting`｜P5 ❌ 后端幂等不做｜**P6 ✅ 页面跳转后 cleanup**（**裁决新增项**，与原 §0.2 的 P6「store `isSubmitting` 卡死」不是同一件事 —— 后者仍为遗留 L-2）
- **实施与实测（2026-11-19 实施轮，已完成）**：`interview-upload-form.tsx` **1287 → 1339 行**（`+53 −1`，**12 hunk**）；静态臂 `G1~G13` **13/13 PASS**；行为臂 **13/13 PASS**；**改动前基线 3 FAIL（`posts=2`）** 以同一脚本在旧代码上复现 ⇒ 缺陷真实、修复有效（§9.3 实测记录）
- 反馈来源：**本次对话的人工测试反馈（2026-11-19）**，原文即反馈，无独立批次编号

## 0. 一句话概述

`/upload` 第 3 步那个「开始处理」按钮**自己不发请求** —— 它只开知情同意弹窗；真正发 `POST /api/projects` 的是弹窗里的「同意并继续」。而**这两个按钮、以及整条调用链（`handleFormSubmit` → `handleConsentConfirm` → `submitProject` → `store.createProject`）没有任何一处判断「是否已有请求在途」**，`setConsentOpen(false)` 又要等下一次渲染才把弹窗摘掉 ⇒ **同一 tick 内的第二次点击照样打在同一颗 DOM 节点上，照样发第二个 POST ⇒ 建出两个项目**。本批加**同步在途锁**（`useRef`）＋ 让弹窗确认按钮接住 `submitting`，把「重复提交」堵在客户端；**服务端不做幂等**（§0.2 P5 有逐条理由）。

### 0.1 现状缺口（代码事实，2026-11-19 实测）

| # | 位置 | 现状 | 后果 |
|---|---|---|---|
| F1 | `:1253-1271` | 第 3 步按钮 `开始处理`：`<Button type="submit" … disabled={isSubmitting}>`（`:1254-1270`），loading 分支 `LoaderCircle` ＋ `上传中…`（`:1259-1263`） | **「disabled ＋ loading」在表单按钮上已经存在**，由 store 的 `isSubmitting` 驱动（`:468` 取值 / `:1257` 绑定）—— 总管点名要的「disabled ＋ loading」**不是缺口**，缺口在 F3 / F4 / F5 |
| F2 | `:777` → `:726-748` | `<form onSubmit={handleFormSubmit}>`；`step === 3` 分支只做三件事：`setConsentChecked(false)` `:745` → `setConsentDocOpen(false)` `:746` → `setConsentOpen(true)` `:747` | 点「开始处理」**不发请求**，只开弹窗 ⇒ 「点按钮 → 重复请求」中间还隔着一次「同意并继续」 |
| F3 | `:446-453` | 弹窗确认按钮：`<Button type="button" … disabled={!checked} onClick={onConfirm}>` `{CONSENT_BUTTON_LABEL}`（＝`同意并继续` `:150`） | **真正的建项目触发器**，却**只受勾选态约束**，`submitting` 一个字都没接（弹窗 props `:270-286` 里也没有这个概念） |
| F4 | `:750-753` | `handleConsentConfirm() { setConsentOpen(false); void submitProject(); }` | `setConsentOpen(false)` 是**异步渲染**：同一 tick 内第二次 `click()` 时弹窗**仍在 DOM 上**，`onClick` 照常派发 ⇒ `submitProject()` 第二次调用**畅通无阻** ⇒ 第二个 POST |
| F5 | `:676-724` | `submitProject()`：空文件早退 `:677-680` → `validateStepOne` 早退 `:683-689` → `try` `:691` → `await createProject(...)` `:694` → 成功 `router.push` `:716`；`catch` `:717-723`。**全函数无任何在途判断，也无 `finally`** | 无锁 ⇒ 任何来源的并发调用各发一个请求；无 `finally` ⇒ 将来若在 `push` 前抛错，本批新增的锁必须靠 `finally` 才能释放 |
| F6 | `:79-80`（store） | `async createProject(payload) { set({ error: null, isSubmitting: true }); … }`，`fetch("/api/projects", {method:"POST"})` `:102-106` | store 层**无去重 / 无锁 / 无信号量**；`isSubmitting` 只做「视觉」，**没有任何逻辑读它来决定要不要发请求** |
| F7 | 全文件实测 | `AbortController` **0 命中**、`requestSubmit` **0 命中**、`isSubmitting` **3 命中**（`:468` / `:1257` / `:1259`） | **零请求取消语义、零提交锁**；`isSubmitting` 从未被 `if` 读过 |
| F8 | 服务端 `api/projects/route.ts:71-236` | `POST` 校验（`:141-177`）→ `saveInterviewAudio` `:182` → `createProject` `:198` → 回包。**无 `Idempotency-Key`、无去重表、无内容指纹** | 两个请求 = 两个项目（现存行为）；`project-store` 每次生成新 id |

**关键时序（本条的复现脚本）**：

```
click「开始处理」           → handleFormSubmit:726  → setConsentOpen(true)          （0 请求）
click「同意并继续」第 1 下   → handleConsentConfirm:750 → setConsentOpen(false)（排入渲染队列，尚未生效）
                                                        → submitProject:676（同步跑到第一个 await）
                                                        → createProject（store:79，set isSubmitting=true）
                                                        → POST #1 ──┐
click「同意并继续」第 2 下   → 弹窗此刻**还在 DOM 上**（渲染未提交）              │ 两个 POST 交错在飞
   （同一 tick / 双击 / 触控双击）  → handleConsentConfirm:750 再进一次（无守卫）   │
                                   → submitProject:676 再进一次（无守卫）        │
                                   → POST #2 ────────────────────────────────┘
```

> 触发条件不是「手速特别快」，而是**同一个 JS 任务内两次派发**（`btn.click(); btn.click();`、触控双击的第二次、自动化脚本、未来的快捷键绑定）。React 19 对离散事件逐次同步 flush，但**第一次点击排入的 `setConsentOpen(false)` 要等该 handler 返回后才提交渲染**，第二次派发正是钻这个窗口。

### 0.2 设计口径（P1~P6：**只读扫描推导稿** —— 与裁决编号的对应关系见 §0.2.1，实施以裁决为准）

| # | 决策点 | 本 PRD 口径 | 理由 | 详见 |
|---|---|---|---|---|
| P1 | 锁的载体 | **`useRef<boolean>` 同步锁**（`submitInFlightRef`），**不新增 `useState`** | 同一 tick 内第二次点击读到的 ref 已是最新值；`useState` 要等渲染提交才可见 ⇒ **挡不住本条要挡的那一下**。视觉态继续复用 store 的 `isSubmitting`，避免两套「提交中」真相 | §3.1 |
| P2 | 锁的位置 | **三处守卫 ＋ 一处 `finally` 释放**：`submitProject` 顶部（主锁）／`handleFormSubmit` 顶部（次）／`handleConsentConfirm` 顶部（次）；`submitProject` 的 `try` 前取锁、`finally` 解锁 | 主锁管「不问来路」；`handleConsentConfirm` 的守卫是**必须**的（它先关弹窗再调用，若只靠主锁，第二次仍会把弹窗再关一次并再跑一遍 `submitProject` 的前置校验 → 错误条被重写）；`handleFormSubmit` 的守卫是**兜底**（防 `requestSubmit()` / Enter 隐式提交） | §3.2 / §3.3 / §3.4 |
| P3 | 锁的释放点 | **`finally`**，成功 / 失败两条路都释放 | 失败后按钮必须可再点（重试是正常行为，AC-13）；成功路径已 `router.push` 跳走，释放无副作用 | §3.2（c） |
| P4 | 弹窗确认按钮是否接 `submitting` | **接**（新增 1 个 prop，`disabled={!checked \|\| submitting}`） | 「可点性 = 勾选态 × 提交态」是两条独立约束；本批虽已用锁挡住重复派发，但**按钮自身状态与真相不一致就是下一个 bug 的温床**（例如将来把 `setConsentOpen(false)` 改成「请求成功后再关弹窗」）。改动量 = 1 prop ＋ 1 行 JSX ＋ 1 行传参 | §3.5 |
| P5 | **后端幂等是否要做** | **本批不做（0 服务端改动）** | ① 重复的唯一可复现来源是**同一用户、同一份 FormData 的同 tick 双派发** ⇒ 前端锁即可闭环，服务端没有第二种重复来源需要兜；② 服务端要幂等必须新增 `Idempotency-Key` 请求头契约 ＋ 存储侧去重（`route.ts:71-236` ＋ `project-store.ts` ＋ 前端生成与重放键），**跨出「单文件」范围**，且仓内**无任何幂等基础设施**可复用；③ 幂等键会误伤**合法**场景 —— 当前产品**允许**用户用同一名称连建两个项目，键必须做成「会话级」才安全，复杂度与收益不成正比；④ 若将来出现「网络层重试 / 代理重放导致的重复」（与本次不同源），**另立 REQ**，不在本条夹带 | §4 / §7 R5 |
| P6 | 是否顺手修 `isSubmitting` 卡死风险（store:80 在 `try` 之外） | **不本批**（记入 §6 遗留 L-2） | 修它要动 `project-workspace.ts`（第二文件），且属**理论**风险（FormData 组装抛错才会触发）；本批的 `finally` 已保证**组件侧锁**不会卡死，视觉态卡死窗口仍存在但与本条缺陷不同源 | §6 |

### 0.2.1 总管裁决（2026-11-19）与编号映射

**裁决逐条（原文口径）**：

| # | 裁决项 | 结论 | 理由（裁决原文） |
|---|---|---|---|
| P1 | 按钮 disable ＋ loading | ✅ 做 | 核心修复，必须 |
| P2 | 提交函数入口加锁（早退） | ✅ 做 | 双保险，防 disable 被绕过 |
| P3 | 失败/异常后解锁 | ✅ 做 | 否则失败后按钮永久卡死 |
| P4 | 弹窗确认按钮也接 `submitting` | ✅ 做 | 知情同意确认后到请求完成之间也有窗口，要堵上 |
| P5 | 后端幂等 | ❌ 不做 | 前端双保险够用，后端改动超出本轮 scope，不值当 |
| P6 | 页面跳转后 cleanup | ✅ 做 | 避免组件卸载后 setState 报 warning |

**编号映射（防错读：两套 P 编号不是一一对应）**：

| 裁决 # | 落到本 PRD | 实施落码位置（实测） | 备注 |
|---|---|---|---|
| P1 | **无设计项**（现状已满足） | `:1257` `disabled={isSubmitting}` ＋ `:1259-1263` `LoaderCircle` / `上传中…` | 裁决措辞是「做」，但**该行为 2026-11-19 实测已存在** ⇒ 本批**不改**，由 G8 静态臂 ＋ L4 行为臂守门，谁改坏谁红 |
| P2 | 原 P1（锁载体）＋ 原 P2（锁位置） | `submitInFlightRef` 声明 ＋ 三处守卫（`submitProject` / `handleFormSubmit` / `handleConsentConfirm`） | 载体仍按原 P1 取 `useRef`：`useState` 挡不住同 tick 双派发 |
| P3 | 原 P3（释放点） | `} finally { submitInFlightRef.current = false; }` | 成功 / 失败两条路都解锁 |
| P4 | 原 P4 | `submitting` 共 4 处（解构 / 类型 / `disabled` 或条件 / 传参） | — |
| P5 | 原 P5 | 无（禁用面） | `src/lib` / `src/app` / `storage` **0 hunk**（G11） |
| P6 | **原稿没有此设计项（裁决新增）** | `isMountedRef` ＋ cleanup `useEffect` ＋ `catch` 卸载守卫 | 原稿的 P6 是「store `isSubmitting` 卡死」⇒ 并入**遗留 L-2**，本批仍不做 |

> **P6 为什么必须新增一个 `useEffect`**：原稿 C4 写的是「零新 effect」，但「跳转后不再 setState」只能从挂载 / 卸载边界拿信号，React 没有第二个入口。故新增 **C6** 明确开口子：**允许 1 处** mount cleanup effect，且不得引入任何 `useState`（详见 §3.6）。

### 0.3 派生约束（由 P1~P6 ＋ 既有验收面推导，非新决策）

| # | 约束 | 依据 |
|---|---|---|
| C1 | **锁的获取必须在全部前置校验之后** —— `submitProject` 的空文件早退（`:677-680`）与 `validateStepOne` 早退（`:683-689`）**不得被锁包住** | 这两条早退**不发请求**，若先加锁再校验，一旦早退就必须解锁，否则「不选文件 → 同意并继续」后按钮永久 disabled；且 UI-33 的 `AC-4`（不选文件 → 同意 → 错误区出 `请先选择一段受访音频。`）依赖这条路径**保持可用** |
| C2 | **`event.preventDefault()` 必须留在 `handleFormSubmit` 最前面** | 新增守卫若写在它之前，早退时会走浏览器**原生表单提交**（整页刷新、表单内容全丢）—— 比重复提交更严重 |
| C3 | **不得引入 `AbortController` / 请求取消语义** | 取消只解决「重复请求的结果谁生效」，不解决「发不发」；且中途 abort 会让服务端 `saveInterviewAudio` 已落盘的音频变孤儿文件（`route.ts:182` 在 `createProject:198` 之前写盘） |
| C4 | **`isSubmitting` 仍是唯一视觉真相**，本批**不新增**本地 `submitting` state | 两套真相必然打架（store 复位时刻 `:119` / `:127` 是唯一权威时刻） |
| C5 | **不改 `step < 3` 的「下一步」按钮**（`:1246-1252`）与本页其余交互 | 与本次缺陷无关；改了会牵动 `verify-phase3` 的 J 系列臂 |
| C6 | **允许新增 1 处挂载 / 卸载 cleanup `useEffect`（P6），且其中只许置位 `isMountedRef`**；不得引入任何 `useState` | 裁决 P6 要求「跳转后不再 setState」，而这只能从卸载边界取信号。StrictMode 是「挂载 → 清理 → 再挂载」⇒ effect 体内必须先置 `true`、清理置 `false`；只在清理里置 `false` 会让重挂后的守卫永久失效（dev 下 `setError` 被误吞） |

### 0.4 编号水位（实测，2026-11-19）

`docs/需求登记表.md` 全表最高号 = `UI-33` / `BUG-17` / `REQ-36` ⇒ **下一可用 = `UI-34` / `BUG-18` / `REQ-37`**。本条占用 **`BUG-18`**（登记表正文 `BUG-18` 字面 **0 命中**，仅在 v2.37 / v2.38 / v2.41 的「下一可用」句中提及 ⇒ **未冲突**）。

## 1. 目标与非目标

**目标**

1. 同一 tick 内重复派发（双击 / 触控双击 / 脚本 / 双击 Enter）**只发 1 个 `POST /api/projects`**，只建 1 个项目。
2. 请求在途时，**发起按钮与确认按钮都不可再点**，且视觉上明确「上传中…」。
3. 请求结束（成功 / 失败）后**必然解锁**：失败可重试，成功走跳转。
4. 零服务端改动、零新依赖、零新 state / action / 接口；**effect 仅允许 1 处**（P6 的卸载 cleanup，C6）；合法单次提交路径行为**完全不变**。
5. **跳转卸载后不再 setState**（裁决 P6）：`router.push` 之后组件卸载，异步收尾不得再碰组件 state。

**非目标**

- **不改服务端**：`src/app/api/projects/route.ts`、`src/lib/server/project-store.ts`、`upload-store.ts` 全部 0 hunk（P5）。
- **不改 store**：`src/store/project-workspace.ts` 0 hunk（含 P6 的卡死风险，记遗留 L-2）。
- **不引入请求取消 / 超时**（C3）。
- **不做「提交失败自动重试」/ 指数退避**（重试是用户行为，不是系统行为）。
- **不改知情同意文案 / 结构 / 勾选逻辑**：`CONSENT_*`（`:144-150`）、`CONSENT_DOC_BLOCKS`（`:160-266`）、`data-upload-modal="consent"`（`:318`）、`data-ui06-part`（`:346-347`）逐字不动 —— UI-06 已验收面，本批**只给确认按钮加一个 `disabled` 的或条件**。
- **不改 UI-33 面**：`accept` 串（`:48`）、白名单常量（`:53-93`）、`handleFileChange` 两道判定、`handleFormSubmit` 的第二道格式兜底（`:734-742`）全部不动。
- **不动 `?autostart=1` 跳转链**（`:716`）—— REQ-34 交叉面。

## 2. 落点与定位口径

- **主落点（唯一生产改动文件）**：`src/components/upload/interview-upload-form.tsx`，**6 个位置 / 12 hunk（实施实测）**：
  1. `:551` 之后 —— `submitInFlightRef`（P2 锁载体）＋ `isMountedRef`（P6 卸载标记）；
  2. `:575` 之后 —— 挂载 / 卸载 cleanup `useEffect`（P6，C6）；
  3. `:676` `submitProject`：主锁（首部）＋ 取锁（`try {` 之前）＋ `catch` 卸载守卫（P6）＋ `finally` 释放（P3）；
  4. `:727` `handleFormSubmit` 的 `event.preventDefault();` 之后 —— 次守卫（P2）；
  5. `:750` `handleConsentConfirm` 首部 —— 次守卫（P2，**必须**）；
  6. `:270-286` `ConsentDialog` 解构 / 类型 ＋ `:446-453` 确认按钮 ＋ `:1276-1284` 传参 —— `submitting`（P4，共 4 处小改）。
- **hunk 实测明细**（`git diff -U0`，可直接复核；单文件、单块语义）：

| hunk | 旧行 | 新行 | 内容 |
|---|---|---|---|
| 1 | `-272,0` | `+273` | `ConsentDialog` 解构 `submitting,` |
| 2 | `-280,0` | `+282` | 类型 `submitting: boolean;` |
| 3 | `-449` | `+451` | `disabled={!checked \|\| submitting}`（改写 1 行） |
| 4 | `-552,0` | `+555,9` | `submitInFlightRef` ＋ `isMountedRef` ＋ 注释 |
| 5 | `-575,0` | `+587,10` | cleanup `useEffect` |
| 6 | `-676,0` | `+698,5` | `submitProject` 主锁 |
| 7 | `-690,0` | `+717,4` | 取锁（早退之后） |
| 8 | `-717,0` | `+748,6` | `catch` 卸载守卫（P6） |
| 9 | `-722,0` | `+759,3` | `finally` 解锁（P3） |
| 10 | `-728,0` | `+768,6` | `handleFormSubmit` 次守卫 |
| 11 | `-750,0` | `+796,6` | `handleConsentConfirm` 次守卫 |
| 12 | `-1278,0` | `+1330` | `submitting={isSubmitting}` |
- **逐字锚点（实施时按此定位，不认行号）**：
  1. `const [consentDocOpen, setConsentDocOpen] = useState(false);`
  2. `async function submitProject() {`
  3. `    if (!audioFile) {`
  4. `    try {`
  5. `  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {`
  6. `  function handleConsentConfirm() {`
  7. `              disabled={!checked}`
  8. `        checked={consentChecked}`
- **禁止改动的邻近锚点**：`CONSENT_BUTTON_LABEL`（`:150`）、`CONSENT_TICK`（`:148`）、`data-upload-modal="consent"`（`:318`）、`aria-labelledby="consent-dialog-title"`（`:329`）、`{CONSENT_BUTTON_LABEL}`（`:452`）、`accept={acceptedAudioExtensions}`（`:1200`）、`disabled={isSubmitting}`（`:1257`）、`router.push(…?autostart=1)`（`:716`）。
- **错误呈现位（复用，不改）**：`:1209-1213`（`border-danger/20 bg-danger/8 text-danger`）。

## 3. 定稿形态

### 3.1 新增在途锁（插在 `:551` 之后、`:553` `const [error, setError] = …` 之前）

```tsx
  // BUG-18：在途锁。用 ref 不用 state —— 同一 tick 里的第二次点击读到的必须是最新值，
  // 而 state 要等本轮渲染提交后才可见，挡不住 btn.click(); btn.click(); 这种同 tick 双派发
  // （弹窗按钮尤其明显：setConsentOpen(false) 得等下一次渲染才把节点摘掉）。
  // 只锁「请求本身」：前置校验的早退分支不发请求，不能占锁（PRD §0.3 C1）。
  const submitInFlightRef = useRef(false);
  // BUG-18 P6：卸载标记。router.push 之后本组件会被卸载，而 submitProject 的 catch 还要
  // setError —— 卸载后不再 setState。
  const isMountedRef = useRef(true);
```

> `useRef` 已在 `:3-10` 的 import 里（`:466` 的 `fileInputRef` 在用）⇒ **无新增 import**。

### 3.2 `submitProject` 三处改动（`:676-724`）

**（a）函数首部加主锁**（`:676` 之后，`if (!audioFile) {` 之前）：

```tsx
    // BUG-18 P2：主锁 —— 已有一次 POST 在飞，任何来源的第二次调用直接丢弃。
    if (submitInFlightRef.current) {
      return;
    }
```

**（b）取锁**（`:691` 的 `try {` **之前**）：

```tsx
    // BUG-18 P2/P3：校验全过、马上要发请求 —— 这里才取锁（两条早退都不占锁，C1）；
    // 释放统一走下面的 finally，成功（已跳转）与失败（要能重试）两条路都解锁。
    submitInFlightRef.current = true;
```

**（c）`finally` 解锁**（`:723` 的 `}` 之后）：

```tsx
    } finally {
      // BUG-18 P3：成功路径已跳转、失败路径要允许重试 —— 两条路都必须解锁。
      submitInFlightRef.current = false;
    }
```

改后骨架（**其余行一字不动**）：

```tsx
  async function submitProject() {
    if (submitInFlightRef.current) { return; }      // ← 新增（a）
    if (!audioFile) { …:677-680 原样… }
    const stepOneError = validateStepOne();
    if (stepOneError || confidentialityLevel === null) { …:685-689 原样… }
    submitInFlightRef.current = true;               // ← 新增（b）
    try {
      …:692-716 原样（含 router.push）…
    } catch (submitError) {
      …:718-722 原样…
    } finally {                                     // ← 新增（c）
      submitInFlightRef.current = false;
    }
  }
```

### 3.3 `handleFormSubmit` 次守卫（`:726-728`）

```tsx
  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // BUG-18 P2：次守卫 —— 请求还没回来之前，任何再次触发的 submit 一律丢弃。
    // 必须留在 preventDefault() 之后：早退时漏了它，浏览器会走原生表单提交，整页刷新。
    if (submitInFlightRef.current) {
      return;
    }
```

> **`event.preventDefault();` 与守卫之间不得插入任何语句**（C2）。UI-33 的格式兜底（`:734-742`）与三行 `setConsent*`（`:745-747`）保持原顺序。

### 3.4 `handleConsentConfirm` 次守卫（`:750-753`）

```tsx
  function handleConsentConfirm() {
    // BUG-18 P2/P4：「同意并继续」是本页唯一真正发请求的按钮。setConsentOpen(false) 要等
    // 下一次渲染才把弹窗摘掉，同一 tick 里的第二次点击仍打在这个还活着的 DOM 节点上。
    if (submitInFlightRef.current) {
      return;
    }

    setConsentOpen(false);
    void submitProject();
  }
```

> 失败后重试：`finally` 已把 ref 复位，用户再点「开始处理」→ 弹窗 → 勾选 → 「同意并继续」照常发第 2 个请求（AC-13）。

### 3.5 弹窗确认按钮接住 `submitting`（P4，4 处小改）

**（a）props 声明**（`:280` 附近，`checked: boolean;` 之后）：`submitting: boolean;`
**（b）解构**（`:272`，`checked,` 之后）：`submitting,`
**（c）按钮 or 条件**（`:449`）：

```diff
-              disabled={!checked}
+              disabled={!checked || submitting}
```

**（d）传参**（`:1278`，`checked={consentChecked}` 之后）：`submitting={isSubmitting}`

> 视觉不加 loading 图标：确认成功后弹窗**同一 tick 内即卸载**，看不到；加图标反而会在「慢渲染 ＋ 快速双击」时闪烁。按钮文案 `{CONSENT_BUTTON_LABEL}` 逐字不动（UI-06 已验收面）。

### 3.6 跳转后 cleanup（裁决 P6：`:575` 之后 ＋ `catch` 首部）

**（a）卸载标记**：与锁同一处声明（见 §3.1 末行）—— `const isMountedRef = useRef(true);`

**（b）挂载 / 卸载 effect**（插在既有 `useEffect(…, [hasOutlineFlag]);` 之后）：

```tsx
  // BUG-18 P6：effect 体内先置 true、清理时置 false —— dev 的 StrictMode 是
  // 「挂载 → 清理 → 再挂载」，只在清理里置 false 会让重挂之后的守卫永久失效。
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);
```

**（c）`catch` 首部守卫**（`} catch (submitError) {` 之后、原 `setError(` 之前）：

```tsx
      // BUG-18 P6：已经跳走（组件卸载）就不再 setError，避免对已卸载组件 setState。
      // 用 return 而不是把 setError 包进 if —— finally 照样执行，锁不会漏放。
      if (!isMountedRef.current) {
        return;
      }
```

> **为什么用 `return` 而不是 `if (guard) { setError(...) }`**：`return` 不改原 `setError(...)` 那 5 行的缩进 ⇒ diff 最小；而出 `return` 时 `finally` **照样执行**（ES 语义保证）⇒ 锁不会漏放。
> **为什么成功路径不加守卫**：成功路径只做 `clearOutlineDraftFromSession()`（外部存储，与挂载无关）＋ `router.push`，**没有任何 `setState`**。
> **可观测性（诚实标注）**：React 19 已不再输出「Can't perform a React state update on an unmounted component」警告 ⇒ 本条**无法用 console 断言**，证据由静态臂 G13 ＋ §9.3 的逐行审阅承担，**不伪造行为臂**。

## 4. 零新增清单（禁改面，逐项 0 hunk）

| 面 | 口径 |
|---|---|
| `src/app/api/projects/route.ts` | **0 hunk**（236 行原样；无幂等键、无去重 —— P5 明确不做） |
| `src/lib/server/**` | **0 hunk**（`project-store.ts` / `upload-store.ts` / `enum.ts`） |
| `src/store/project-workspace.ts` | **0 hunk**（160 行原样；`isSubmitting` **五处** ＝ `:35` 类型 ＋ 四处读写 `:48` / `:80` / `:119` / `:127`，一字不动；P6 遗留不修） |
| `src/app/**` | **0 hunk** |
| `storage/**` | **0 写入**（探针不得留下测试项目 ⇒ 跑完须核对 `storage/projects.json` 条数回到基线，或建后即删） |
| `src/components/ui/button.tsx` | **0 hunk**（不把 `loading` 加进通用按钮 —— 全站只有这一处需要） |
| `globals.css` | **0 hunk**（无新增样式类） |
| 新依赖 / 新 `src` 文件 | **0** |

**新增文件全部在 `tmp/`（`.gitignore:54` 忽略，不入库；与既有探针同口径）**：

| 文件 | 用途 | 入库 |
|---|---|---|
| `tmp/verify-bug18-submit-guard.mjs` | 静态臂 G1~G13（门禁） | ❌ |
| `tmp/verify-bug18-live.mjs` | 行为臂（CDP ＋ fetch 拦截：`hold` / `reject`） | ❌ |
| `tmp/patch-bug18.mjs` | 一次性补丁脚本（12 处锚点，逐个断言命中 1 次） | ❌ |

## 5. 边界与交叉

| 面 | 关系 | 处置 |
|---|---|---|
| **UI-06** 知情同意弹窗（已验收） | 同组件、同弹窗 | 只加 `submitting` 一个 prop 与一个 `\|\|` 条件；`CONSENT_*` / `CONSENT_DOC_BLOCKS` / `data-upload-modal` / `data-ui06-part` 逐字不动 ⇒ UI-06 探针在 `submitting === false` 下取样，**行为 0 变化** |
| **UI-33** 格式校验前置（已验收 `c17d09e`） | 同文件、同两函数 | `handleFormSubmit` 的第二道兜底（`:734-742`）排在新守卫**之后**、`setConsent*` 之前，顺序不动；`submitProject` 的空文件早退不被锁包住（C1） |
| **BUG-11 / BUG-12** | 同文件邻近已验收面 | `:48` `accept` 串、`:588-595` 的 100MB 判定、`:1209-1213` 错误条均不动 |
| **REQ-34**（整理结果回工作台 / 后台处理） | 交叉 `?autostart=1`（`:716`） | 不触碰跳转链；若 REQ-34 将来把创建改成「后台处理 ＋ 不跳转」，锁的释放点仍在 `finally`（**不依赖跳转**） |
| **BUG-09**（AI 访谈 30s 超时 / `AbortController`，已闭环） | 不同文件（`interview-console.tsx`） | 无交叉；本批**不引入** `AbortController`（C3） |
| `?outline=1` 分流分支（`flowMode`） | 同一组件两条入口 | 锁与入口无关（`submitProject` 是唯一发请求的函数）⇒ 两条路径同修 |

## 6. AC 全表

> LIVE 臂需 `npm run dev` ＋ Chrome（CDP）；STATIC 臂无需环境。截图清单见 §9 末。

| AC | 类型 | 操作 | 期望 |
|---|---|---|---|
| AC-1 | STATIC | 断言 `const submitInFlightRef = useRef(false);` 逐字存在 | 1 次命中；且 `useRef` 仍在该文件 import 内 |
| AC-2 | STATIC | `submitProject` 函数体切片内 `submitInFlightRef.current` 出现在 `await createProject(` **之前** | 顺序成立（主锁早于请求） |
| AC-3 | STATIC | `submitInFlightRef.current = true;` 早于 `await createProject(`；`= false;` **恰 1 次**且在 `finally {` 块内 | 取锁早于请求、释放唯一且在 `finally` |
| AC-4 | STATIC | `handleFormSubmit` 内 `event.preventDefault();` **早于** `submitInFlightRef.current`，且两者之间无其它语句 | C2 成立 |
| AC-5 | STATIC | `handleConsentConfirm` 函数体切片含 `submitInFlightRef.current`，且早于 `setConsentOpen(false)` | 次守卫在位 |
| AC-6 | STATIC | `disabled={!checked \|\| submitting}` **1 次**；`submitting: boolean;` **1 次**；`submitting={isSubmitting}` **1 次** | P4 四处齐全 |
| AC-7 | STATIC | `disabled={isSubmitting}` **1 次**、`上传中…` **1 次** | 既有视觉零回退 |
| AC-8 | STATIC | `git diff --numstat -- src/lib src/app storage` **空**；`git diff --name-only -- src` **恰 1 行** | 单文件、后端 0 改动 |
| AC-9 | STATIC | `git diff -U0 -- <file>` 的 `@@` 计数 **≤ 14** | 防误改大段（**实测 12 个 hunk**，明细见 §2） |
| AC-10 | LIVE | step 3 选 `.wav` → 点「开始处理」→ 勾选 → **同一 `evaluate` 内** `btn.click(); btn.click();` | `POST /api/projects` 计数 **=== 1**；`storage/projects.json` 只增 **1** 条 |
| AC-11 | LIVE | POST 在途（探针用 fetch gate 挂住）时读取 | ① `[data-upload-modal="consent"]` **不存在**；② 「开始处理」`disabled === true`；③ 其文本含 `上传中…`；④ 再 `clickText('开始处理')` 后计数仍 **=== 1** |
| AC-12 | LIVE | 放行请求（成功） | 跳转 `/projects/<id>?autostart=1`；列表只多 1 条。**⚠️ 本轮未跑**：`hold` / `reject` 两种拦截下不存在成功响应，真跑会写 `storage`（§4 卫生口径）⇒ 由代码审阅（`finally` 释放与跳转互不依赖，§7 R7）＋ AC-15~17 回归承担 |
| AC-13 | LIVE | 失败臂：放行为 400 / 500 | 错误条出现（`:1209-1213`）；按钮恢复 `开始处理` 且 `disabled === false`；再点一次能发**第 2** 个请求（计数 2）⇒ 证明 `finally` 正常解锁 |
| AC-14 | LIVE | 不选文件 → 点「开始处理」→ 勾选 →「同意并继续」 | 弹窗正常打开（UI-33 `AC-4` 不回退）；错误区出 `请先选择一段受访音频。`；POST 计数 **0** |
| AC-15 | REG | `node tmp/verify-ui33-format-guard.mjs` | **exit 0**（UI-33 面零回退） |
| AC-16 | REG | `node tmp/verify-phase3.mjs` | I1 / I2 / I3 臂绿（原先 42/42） |
| AC-17 | REG | `node tmp/cdp-ui06-consent-copy.mjs` | 绿（弹窗文案 / 勾选态零回退） |
| AC-18 | STATIC | P6 四件套：`isMountedRef` 声明 **1 次**、`= true` / `= false` **各 1 次**、cleanup effect 正则命中、`catch` 守卫 **早于** `setError(` | 全齐（G13） |
| AC-19 | REVIEW | P6 语义逐行审阅：① 成功路径无 `setState`；② `catch` 用 `return` 且 `finally` 仍执行；③ StrictMode 双挂载下 effect 体先置 `true` | 三条成立（§3.6 三个「为什么」） |

### 6.2 实测结果（2026-11-19，本轮）

| 臂 | 命令 | 结果 |
|---|---|---|
| 静态 G1~G13 | `node tmp/verify-bug18-submit-guard.mjs` | **13/13 PASS**，exit 0 |
| 行为臂（12 项断言） | `node tmp/verify-bug18-live.mjs`（dev `:3000` ＋ headless Chrome） | **ALL PASS**，exit 0 —— `L1 posts=1`／`L4 disabled=true ＋ 上传中…`／`L3 fired=true 且 posts=1、不再开弹窗`／`L5 失败 → 解锁 → 重试 posts=2` |
| **改动前基线（L2）** | 同一 live 脚本 ＋ `git stash push -- <file>` | **3 FAIL**：`L1 posts=2`、`L3 posts=2`、`L3 dialog=true` ⇒ **缺陷真实复现**（一次点击建两个项目）。`git stash pop` 后文件 SHA256 与补丁前备份一致（`4D54B95F5E…4522`） |
| UI-33 回归 | `node tmp/verify-ui33-format-guard.mjs` | **G1~G9 9/9 PASS**；**G10 红** —— 见下方口径更正 |
| phase3 回归 | `node tmp/verify-phase3.mjs` | **42/42 通过**，exit 0（含 I2 / I3「不选文件直接开弹窗」臂 ⇒ C1 未破） |
| UI-06 回归 | `node tmp/cdp-ui06-consent-copy.mjs` | **52/52 passed**，exit 0 |
| 类型 / 风格 | `npx tsc --noEmit` ／ `npx eslint src/components/upload/interview-upload-form.tsx` | eslint **exit 0**；tsc 唯一报错在**未跟踪**的 `_delivery/memory-engine-demo/src/components/new-project/new-project-flow.tsx:232`（交付副本，与 `src/` 无关，`?? _delivery/` 可证） |

> **UI-33 `G10` 的口径更正（探针债，不在本批改）**：`G10` 断的是「working diff 恰 3 hunk、落在三处」，这只在「UI-33 尚在途」时成立；UI-33 已合入 `c17d09e` 之后，任何后续批都会让它红，**与 UI-33 功能零回归无关**（功能断言 G1~G9 全绿）。后续复用该探针前应把它改成「UI-33 锚点仍在」的语义断言。

### 6.1 遗留（本批不做，随验收报告归档）

| # | 遗留 | 处置 |
|---|---|---|
| L-1 | **后端无幂等**：两个真实请求 = 两个项目 | P5 已裁决不做；如后续出现「网络重试 / 代理重放」型重复，另立 REQ（候选：`Idempotency-Key` ＋ 会话级键） |
| L-2 | `project-workspace.ts:80` 的 `set({isSubmitting:true})` 在 `try`（`:101`）**之外** ⇒ FormData 组装阶段若抛错，`isSubmitting` 永久 true（按钮永久 disabled） | P6 不本批（要动第二文件）；记入登记表待另裁 |
| L-3 | `route-chooser.tsx` 的 `isCreating` 守卫同样是 **state 级**守卫，理论上存在同 tick 双派发窗口 | 登记为同族候选（不同入口、不同请求 `POST /api/projects/ai-interview`），本条**不夹带** |
| L-4 | 上传页无「离开页面即中止上传」语义 | C3 明确不做 |

> **裁决 P6 与原稿 P6 的差异（必读）**：裁决的 **P6 = 页面跳转后 cleanup**（已并入本批：§3.6 / AC-18 / AC-19 / G13）；原稿的 P6 = 「store `isSubmitting` 卡死风险」⇒ **仍为 L-2，本批不动** `project-workspace.ts`（由 G10 与 AC-8 守门：该文件 0 diff 才通过）。

## 7. 风险与回滚

| # | 风险 | 处置 |
|---|---|---|
| R1 | 把取锁放在前置校验**之前** ⇒ 「不选文件 → 同意并继续」后按钮永久 disabled（UI-33 `AC-4` 直接红） | C1 ＋ AC-2（顺序断言）双守门；一红即把 `= true` 挪回 `try` 前 |
| R2 | 守卫写在 `event.preventDefault()` **之前** ⇒ 早退走原生表单提交，整页刷新丢表单 | C2 ＋ AC-4（**中间无其它语句**的静态断言） |
| R3 | 忘记 `finally` / 把解锁写进 `catch` ⇒ 成功路径上锁未释放（返回后可点性失控） | AC-3（`= false` 恰 1 次且在 `finally` 块内）＋ AC-13（失败后能重试） |
| R4 | 试图在 **store** 里加锁（`if (get().isSubmitting) return;`） | 会让 `createProject` 在并发时**少发请求却仍 `resolve(undefined)`**，破坏 `Promise<ProjectRecord>` 类型 ⇒ 显式**否决**，锁只在组件层 |
| R5 | 顺手加服务端幂等键 | P5 否决；`git diff --numstat -- src/lib src/app storage` **必须为空**（AC-8），命中即回退 |
| R6 | 改动 LF → CRLF | `git diff --numstat -- src` 若出现 ≈1287 / ≈1287 ⇒ `git checkout --` 重做，编辑保持原行尾（该文件 **LF / 无 BOM**） |
| R7 | 整体回滚 | 单文件 ⇒ `git checkout -- src/components/upload/interview-upload-form.tsx` 即净；`tmp/verify-bug18-submit-guard.mjs` 保留（不入库）；登记表如实记录已回退 |

## 8. 规模估算

| 项 | 量 |
|---|---|
| 生产代码（**实测**） | **1 文件**（`interview-upload-form.tsx`），**`1287 → 1339` 行**（`git diff --numstat` = **`+53 −1`**，**12 个 hunk**；明细见 §2） |
| 新增行明细（实测 53） | 注释 **18** ＋ 代码 **26** ＋ 空行 **8** ＋ 改写行 **+1**（`disabled={!checked}` → `disabled={!checked \|\| submitting}`）：ref 声明 2｜cleanup effect 6｜主锁 3｜取锁 1｜`catch` 守卫 3｜`finally` 2｜`handleFormSubmit` 守卫 3｜`handleConsentConfirm` 守卫 3｜`submitting` 3（解构 / 类型 / 传参） |
| 新增 state / action / 依赖 / 组件文件 / CSS 类 | **全部 0**；**effect 恰 1 处**（P6 的 cleanup，C6） |
| 服务端 | **0 hunk** |
| 探针 | `tmp/verify-bug18-submit-guard.mjs`（静态 G1~G13）＋ `tmp/verify-bug18-live.mjs`（行为臂）＋ `tmp/patch-bug18.mjs`（一次性补丁脚本），**均不入库** |
| docs | `docs/PRD_BUG-18_…`（本件，已并入裁决 ＋ 实测）＋ `docs/tasks/IMPL_BUG-18_…`（任务单，已并入裁决 ＋ 实测）＋ 登记表 v2.41 → **v2.42**（PRD 轮）→ **v2.43**（实施轮，本轮） |

## 9. 探针影响与设计（`tmp/verify-bug18-submit-guard.mjs`）

### 9.1 静态臂（G1~G12，**门禁，无需 dev server**）

骨架照 `tmp/verify-ui33-format-guard.mjs`（`readFileSync` ＋ `lines.findIndex` ＋ `check(name, ok, detail)` ＋ `process.exit(fails?1:0)`）。断言与被检事实**一一对应**：

| # | 断言 | 取值口径 |
|---|---|---|
| G1 | `const submitInFlightRef = useRef(false);` 逐字 | 整行匹配 **1 次** |
| G2 | `submitProject` 切片内 `submitInFlightRef.current` 的 `indexOf` **<** `await createProject(` 的 `indexOf` | 切片 = `indexOf("async function submitProject()")` → `indexOf("function handleFormSubmit")` |
| G3 | `submitInFlightRef.current = true;` 早于 `await createProject(` | 同上切片 |
| G4 | `submitInFlightRef.current = false;` 全文件 **恰 1 次**，且落在 `} finally {` 与其闭合 `}` 之间 | 块切片（AC-3） |
| G5 | `handleConsentConfirm` 切片内 `submitInFlightRef.current` **早于** `setConsentOpen(false)` | AC-5（**切片前先剥整行注释** —— 注释里复述了 `setConsentOpen(false)`，直接 `indexOf` 会命中注释，实测第一版探针就是这样误报的） |
| G6 | `handleFormSubmit` 切片内 `event.preventDefault();` **早于** `submitInFlightRef.current`，且两行之间只有空行 ＋ 注释 | AC-4 取「无第三语句」最严口径 |
| G7 | `disabled={!checked \|\| submitting}` **1 次**；`submitting: boolean;` **1 次**；`submitting={isSubmitting}` **1 次** | AC-6 |
| G8 | `disabled={isSubmitting}` **1 次**；`上传中…` **1 次** | AC-7（既有视觉零回退） |
| G9 | 全文件 `fetch("/api/projects"` **0 命中**；`AbortController` **0 命中**；`requestSubmit` **0 命中** | 前端不新增请求点、不引入取消语义（C3） |
| G10 | `src/store/project-workspace.ts` 的 `method: "POST"` **恰 1 处**，且该文件 `git diff --numstat <BASE>` 空 | store 0 改动 |
| G11 | `git diff --numstat <BASE> -- src/lib src/app storage` **=== ""** | AC-8 |
| G12 | `git diff --name-only <BASE> -- src` 行数 **=== 1**，且 `git diff -U0 <BASE> -- <file>` 的 `@@` 计数 **≥ 1 且 ≤ 14** | AC-8 / AC-9（**实测 12**） |

> **`<BASE>` = `d498afa`**（本批基线：docs v2.41 UI-33 验收落盘）。G10~G12 一律对「基线 ↔ 当前工作区」取 diff —— **提交前、提交后都能跑**；若用裸 `git diff`（默认对 index），代码一提交就恒为空，这三条会退化成永远绿（实测踩过，已改）。
| G13 | P6 四件套：`const isMountedRef = useRef(true);` **1 次**；`isMountedRef.current = true;` / `= false;` **各 1 次**；cleanup effect 正则（`useEffect(() => { … = true; return () => { … = false; }; }, []);`）命中；`catch` 切片内守卫 **早于** `setError(` | AC-18 |

### 9.2 行为臂（**实测实现**：`tmp/verify-bug18-live.mjs`，需 `npm run dev` ＋ 本机 Chrome）

**不依赖 `--live` 开关**：静态臂与行为臂拆成两个文件，静态臂永远可跑（`node tmp/verify-bug18-submit-guard.mjs`），行为臂单独跑（`node tmp/verify-bug18-live.mjs`），避免「本机没 Chrome 就跑不了门禁」。
管道照 `tmp/cdp-req14-consent.mjs`（零依赖 CDP：`Target.createTarget` → `Target.attachToTarget` → `Runtime.evaluate` ＋ `Page.navigate` ＋ `waitFor`），页面内装 `window.__t`（受控输入走原生 setter；`arm(mode)` 拦截 `POST /api/projects`；`doubleClick` / `submitForm` / `setFile`）。**关键注入**：

```js
// mode='hold'   → POST 永不 resolve（锁保持，测在途行为）
// mode='reject' → POST 立即 500（测失败后的解锁 / 重试）
arm(mode) {
  const calls = [];
  window.__probe = { calls, mode };
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String((init && init.method) || (typeof input === 'string' ? 'GET' : input && input.method) || 'GET').toUpperCase();
    if (method === 'POST' && /\/api\/projects$/.test(url)) {
      calls.push({ url, mode: window.__probe.mode });
      if (window.__probe.mode === 'hold') return new Promise(() => {});
      return Promise.resolve(new Response(JSON.stringify({ message: 'probe 500' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return real(input, init);
  };
  return 'patched:' + mode;
},
// 同一 tick 连点两次（React 还没重渲染，节点仍然活着）—— 这就是缺陷的复现动作
doubleClick(text) { const el = window.__t.find(text); el.click(); el.click(); return true; },
// 绕过 disabled 直接派发 submit 事件，专测 handleFormSubmit 的次守卫
submitForm() {
  const f = document.querySelector('form');
  let fired = false;
  f.addEventListener('submit', () => { fired = true; }, { once: true, capture: true });
  f.requestSubmit();
  return fired;   // true ⇒ submit 事件真的派发了（排除「原生校验拦掉 ⇒ 假绿」）
},
```

| 臂 | 操作 | 期望 | 实测（2026-11-19） |
|---|---|---|---|
| setup | 走完 Step1~3 → `setFile` → 点「开始处理」→ 在弹窗内勾选 | 确认按钮 `disabled === false` 且 `inDialog === true` | ✅ PASS |
| **L1** | `__t.doubleClick('同意并继续')`（**同一 tick 两次 `click()`**） | `POST /api/projects` 计数 **=== 1**（核心断言；改动前 = 2） | ✅ `posts=1`（**基线 `posts=2`**） |
| L1b | 上述之后立刻读 DOM | 弹窗已摘（`[role="dialog"]` 为 `null`） | ✅ `dialog=false` |
| **L4** | `hold` 在途时读表单提交按钮 | `disabled === true` 且文本含 `上传中…`（裁决 P1 现状不回退） | ✅ `{"disabled":true,"text":"上传中…"}` |
| L3-fired | 在途时 `form.requestSubmit()` | 返回 `true` ⇒ submit 事件确实派发（排除原生校验造成的假绿） | ✅ `fired=true` |
| **L3** | 同上之后的计数 | 仍 **=== 1**（次守卫丢弃） | ✅ `posts=1`（基线 `posts=2`） |
| L3b | 同上之后的弹窗状态 | 不再开弹窗（`dialog === false`） | ✅ `dialog=false`（基线 `dialog=true`） |
| **L5** | `reject` 模式（500）走完整提交 → 观察恢复 → 再走一次 | 按钮恢复可用、错误提示渲染、重试发出**第 2** 条 ⇒ `finally` 解锁成立 | ✅ 三臂 + 重试 `posts=2` 全 PASS |

> **`storage` 卫生（比原设计更强）**：全部行为臂都在 `fetch` 层拦截 `POST /api/projects` ⇒ **一个真实请求都不发、一条 `storage` 记录都不写**，无需事后 `DELETE` 清理。这也是为什么 AC-12（真跳转）本轮**不跑**：要跑就得发真请求（§6.2）。
> **登录**：探针用独立账号 `bug18probe@example.com` 现场注册（`/api/auth/register`，`userType: 'personal'`），不污染既有测试账号。
> **脚手架坑（已修，留档）**：① `/upload` 首屏有「正在加载表单…」占位，`#projectName` 不是随 `load` 就出现 ⇒ 必须 `waitFor` 轮询（150×100ms）；② 在途时按钮文案变成 `上传中…`，用「文本找按钮」会拿到 `null` ⇒ L4 改用 `form button[type="submit"]` 选择器。

### 9.3 实测记录（红 → 绿，2026-11-19）

**① 静态臂 S0 先红**（改动前跑 `node tmp/verify-bug18-submit-guard.mjs`）：

```
FAIL  G1 … decl=0 refs=0          FAIL  G2 … guard=-1 request=412
FAIL  G3 … take=-1                FAIL  G4 … finallyBlock=missing
FAIL  G5 … guard=-1               FAIL  G6 … guard=-1
FAIL  G7 … or=0 prop=0 arg=0 old=1  FAIL  G12 … files=[] hunks=0
FAIL  G13 … effect=false
PASS  G8 / G9 / G10 / G11
9 FAIL  (4/13)   exit 1
```

**② 行为臂红基线（L2）**：`git stash push -- src/components/upload/interview-upload-form.tsx` → 同一 live 脚本：

```
FAIL  L1 同 tick 双点击「同意并继续」只发 1 条 POST  - posts=2   ← 缺陷复现：一次点击建两个项目
FAIL  L3 在途时 requestSubmit() 被次守卫丢弃          - posts=2
FAIL  L3 被丢弃的提交不再开弹窗                        - dialog=true
3 FAIL
```

**③ 落码后双臂全绿**：

```
$ node tmp/verify-bug18-submit-guard.mjs
ALL PASS  (13/13)   exit 0

$ node tmp/verify-bug18-live.mjs
PASS  L1 …  - posts=1
PASS  L4 …  - {"disabled":true,"text":"上传中…"}
PASS  L3 …  - fired=true / posts=1 / dialog=false
PASS  L5 …  - 按钮恢复 / 错误已渲染 / 重试 posts=2
ALL PASS   exit 0
```

**④ 恢复校验**：`git stash pop` 后 `Get-FileHash` 与补丁前备份**逐字节一致**（`4D54B95F5E…4522`），且 `git diff --numstat -- src` 回到 `53 / 1`。

**⑤ 提交后再跑一遍**（`b413a34` 之后）：静态臂仍是 **13/13 PASS** —— 但 G10~G12 已改为**对基线 `d498afa` 取 diff**，否则代码一提交 `git diff` 恒为空，这三条会退化成永远绿（实测踩过，已修）。

**截图（本轮未产出）**：headless 断言替代人工截图（① 双击后项目列表只多 1 条 ② 在途时 `上传中…` ＋ 弹窗已卸载 ③ 失败后错误条 ＋ 按钮恢复 ④ 失败后重试成功）。若验收要求人工截图，按上表四臂在浏览器复现即可。

