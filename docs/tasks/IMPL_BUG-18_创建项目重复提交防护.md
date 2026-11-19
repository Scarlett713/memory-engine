# BUG-18 实施任务单｜创建项目重复提交防护（单文件 · **12 hunk** · 零服务端）

**执行人：** DS
**上游：** `docs/PRD_BUG-18_创建项目重复提交防护.md`（PRD 定稿 ＋ **§0.2.1 总管裁决 2026-11-19** ＋ 派生约束 C1~**C6**）；`docs/需求登记表.md` §1.2 UI-33 行（同文件上一批）
**前置条件：** PRD 已出 ＋ **总管已放行（2026-11-19 裁决 P1~P6：P1~P4 / P6 ✅ 做，P5 ❌ 不做）**；`git status --short` 仅 `_delivery/` ＋ 交付包 zip（本批须为下一手**唯一批**，同文件在途批见 §0.3）
**禁改面（逐项 0 hunk）：** `src/app/api/projects/route.ts` ｜ `src/lib/server/**`（`project-store.ts` / `upload-store.ts` / `enum.ts`）｜ `src/store/project-workspace.ts` ｜ `src/app/**` ｜ `storage/**`（零写入）｜ `src/components/ui/button.tsx` ｜ `globals.css` ｜ `CONSENT_*`（`:144-150`）＋ `CONSENT_DOC_BLOCKS`（`:160-266`）＋ 弹窗结构（含 `data-upload-modal="consent"` `:318` / `data-ui06-part` `:346-347`）｜ UI-33 面（`:48` `accept` / `:53-93` 白名单 / `:597-605` 第一道 / `:734-742` 第二道）
**规模（实测）：** `src` **1 个文件、12 个 hunk、`+53 −1`**（`1287 → 1339`）；`docs` 回写 1 件（§S5）
**行号基线：** 2026-11-19 实测 `interview-upload-form.tsx` 改前 = **1287 行**、改后 = **1339 行**（`[IO.File]::ReadAllLines` 口径；下文所有 `:行号` 均为**改前水位**）
**探针基线：** 本轮**未运行任何探针**（只读扫描）；出稿前已知：`tmp/verify-phase3.mjs` 的 I1 上传臂注入 `.wav` ＋ `audio/wav`、I2 / I3 臂**不选文件**直接开弹窗；`tmp/verify-ui33-format-guard.mjs` 为 UI-33 静态守门（G1~G10）
**状态：** **已实施（2026-11-19）＋ 静态/行为双臂实测通过，待验收** —— 见 §3 实测列与 PRD §6.2 / §9.3

---

## §0 口径与纪律

### 0.1 行号复核（**禁用 `Get-Content` 定位**）

PowerShell 5.1 的 `Get-Content` 把无 BOM 的 UTF-8 当 GBK 解码，中文标点后的换行会被吞 —— 同一文件 `Get-Content` 报 **1187** 行、`ReadAllLines` 报 **1287** 行。**一律用**：

```powershell
$a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
for ($i = 0; $i -lt $a.Length; $i++) {
  if ($a[$i] -match 'submitInFlightRef|submitProject|handleConsentConfirm|handleFormSubmit|disabled=\{!checked|checked=\{consentChecked') {
    'L' + ($i + 1) + ': ' + $a[$i]
  }
}
```

**行号漂移时以「逐字锚点」定位、不认行号**（锚点见 §1.1）。本单所有行号均为 2026-11-19 水位。

### 0.2 改动纪律

- **只动 PRD §2 的 6 处（12 hunk）**（两个 ref 声明 / cleanup effect / `submitProject` 四处 / `handleFormSubmit` 守卫 / `handleConsentConfirm` 守卫 / `ConsentDialog` 的 `submitting` 共 4 小处）；其余行**不删、不改、不重排**。
- 文件行尾 **LF**、**无 BOM** ⇒ 编辑时**不得**把 LF 归一为 CRLF，否则整份 1339 行 diff、复核失效（本轮用 `tmp/patch-bug18.mjs` 逐锚点替换，写入前断言「无 CR / 无 BOM / 每个锚点命中恰 1 次」）。
- **不新增** state / action / 接口调用 / 依赖 / CSS 类 / 组件文件；**effect 恰 1 处**（P6 的卸载 cleanup，PRD C6）；**不新增 import**（`useRef` 在 `:8`、`useEffect` 在 `:6`）。
- **P6（裁决新增）只落 3 小处**：`isMountedRef` 声明 ＋ cleanup `useEffect` ＋ `catch` 首部 `if (!isMountedRef.current) { return; }`。**不**把 `setError` 包进 `if`（会多改 5 行缩进，diff 白增）；`return` 时 `finally` 照样执行 ⇒ 锁不漏放。
- **锁必须用 `useRef`，不得用 `useState`**（PRD §0.2 P1：state 挡不住同 tick 双派发）。
- **取锁必须在两条前置早退之后**（PRD §0.3 C1：`:677-680` 空文件 ＋ `:685-689` `validateStepOne`）。
- **守卫必须写在 `event.preventDefault();` 之后**（PRD §0.3 C2）。
- **解锁只写在 `finally`**，且全文件 `= false;` **恰 1 次**（PRD §0.2 P3）。
- **不引入** `AbortController` / `requestSubmit` / 超时 / 自动重试（PRD §0.3 C3）。
- **不动** `isSubmitting` 的既有视觉链路（`:468` 取值 / `:1257` disabled / `:1259-1263` loading）。

### 0.3 禁改面与在途批

| 面 | 口径 |
|---|---|
| `src/app/api/projects/route.ts` | **0 hunk**：不做幂等键、不加去重表（PRD §0.2 P5） |
| `src/lib/server/**` | **0 hunk**：`project-store.ts` / `upload-store.ts` 一字不动 |
| `src/store/project-workspace.ts` | **0 hunk**：`isSubmitting` 四处读写 `:48` / `:80` / `:119` / `:127` 原样；**不得**在 store 里加锁（PRD §7 R4 已否决） |
| 弹窗本体 / `CONSENT_*` | **0 hunk**：UI-06 已验收面；本批**只**给确认按钮的 `disabled` 加一个 `\|\| submitting` |
| UI-33 面 | **0 hunk**：`:48` / `:53-93` / `:597-605` / `:734-742` 原样（本批改动落在 `:734-742` **之后**、`:745` 之前，不得挤动它们） |
| 同文件在途批 | UI-06 / UI-33 / BUG-11 / BUG-12（均已验收）⇒ 开工前确认 `git status --short` 无 `src` 改动，否则**停手回报** |

---

## §S0 先写探针（先红后绿）

> 目的：本批是**时序型**缺陷，静态断言只能守形态、守不住行为。故 **S0 必须先落探针**：改动前跑一次（L2 预期 `count === 2` ⇒ **红**），改完再跑（`count === 1` ⇒ 绿）。

### S0-A 新增静态探针 `tmp/verify-bug18-submit-guard.mjs`（无需 dev server，出口门禁）

`tmp/**` 为 `.gitignore:54` 忽略目录 ⇒ **不入版本库**，与既有探针同口径。断言清单见 **PRD §9.1**（G1~G12），核心 4 条：

| # | 断言 | 改动前 |
|---|---|---|
| G1 | `const submitInFlightRef = useRef(false);` 逐字 1 次 | **红**（不存在） |
| G2 | `submitProject` 切片内 `submitInFlightRef.current` **早于** `await createProject(` | **红** |
| G4 | `submitInFlightRef.current = false;` **恰 1 次**且落在 `} finally {` 块内 | **红**（当前文件 `finally` **0 命中**） |
| G7 | `disabled={!checked \|\| submitting}` 1 次 ＋ `submitting: boolean;` 1 次 ＋ `submitting={isSubmitting}` 1 次 | **红**（当前仅 `disabled={!checked}` `:449`） |

### S0-B 行为臂（**独立文件** `tmp/verify-bug18-live.mjs`，需 `npm run dev` ＋ Chrome）

**为什么不塞进 `--live` 开关**：静态臂要能**永远离线**跑（出口门禁），行为臂依赖 Chrome ⇒ 拆成两个文件，互不牵连。
管道照 `tmp/cdp-req14-consent.mjs`（零依赖 CDP：`Target.createTarget` → `attachToTarget` → `Runtime.evaluate` ＋ `Page.navigate` ＋ `waitFor`）；页面内 `window.__t.arm(mode)` 在 `fetch` 层拦截 `POST /api/projects`：`hold` = **永不 resolve**（锁保持）、`reject` = **立即 500**。**全程不发真请求 ⇒ 零 `storage` 写入**（比原设计的「建完再 `DELETE`」更严）。

| 臂 | 操作 | 期望（改动后） | 改动前（本轮实测） |
|---|---|---|---|
| setup | 走完 Step1~3 → `setFile` → 点「开始处理」→ 弹窗内勾选 | 确认按钮可用 | PASS（同） |
| L1 | `__t.doubleClick('同意并继续')`（**同一 tick 两次 `click()`**） | `posts === 1` | **`posts=2` ⇒ 红（本批主复现）** |
| L4 | `hold` 在途时读 `form button[type="submit"]` | `disabled === true` ＋ 文本含 `上传中…` | PASS（P1 现状守门） |
| L3 | 在途 `form.requestSubmit()`（返回 `fired`，排除原生校验假绿） | `fired === true` 且 `posts` 仍 **1**、不再开弹窗 | **`posts=2` / `dialog=true` ⇒ 红** |
| L5 | `reject` 模式完整提交 → 观察恢复 → 重试 | 按钮恢复、错误渲染、重试 `posts === 2` | PASS（同） |

```powershell
node tmp/verify-bug18-submit-guard.mjs   # 改动前：9 FAIL (4/13) exit 1 ；改动后：ALL PASS 13/13 exit 0
node tmp/verify-bug18-live.mjs           # 改动前：3 FAIL（L1 / L3 / L3b）exit 1 ；改动后：ALL PASS exit 0
```

---

## §1 改动步骤（①~⑧ 顺序执行，逐字块可直接落码）

### 1.1 定位（逐字锚点，改前 1287 行水位）

| 处 | 逐字锚点 | 水位 |
|---|---|---|
| ① 锁声明 | `const [consentDocOpen, setConsentDocOpen] = useState(false);`（紧随其后的空行 → `const [error, setError] = useState<string \| null>(null);`） | `:551` → `:553` |
| ② 主锁 | `async function submitProject() {` → 下 1 行 `    if (!audioFile) {` | `:676` / `:677` |
| ③ 取锁 | `    try {`（其上是 `validateStepOne` 早退块 `:685-689`，其下是 `setError(null);`） | `:691` |
| ④ 释放 | `    }`（`catch` 块收尾）＋ `  }`（函数收尾），其间**当前无 `finally`** | `:723-724` |
| ⑤ 次守卫 | `  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {` → `    event.preventDefault();` → 空行 → `    if (step < 3) {` | `:726-729` |
| ⑥ 次守卫 | `  function handleConsentConfirm() {` → `    setConsentOpen(false);` | `:750-751` |
| ⑦ 弹窗 | `              disabled={!checked}`（其下 `onClick={onConfirm}` / `{CONSENT_BUTTON_LABEL}`） | `:449-452` |
| ⑧ 传参 | `        checked={consentChecked}`（其下 `onCheckedChange` / `onConfirm`） | `:1278` |

### 1.2 ① 锁声明（PRD §3.1）

插在 `:551` 之后、`:553` 之前（**保留原有空行结构**）：

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

### 1.3 ② 主锁（PRD §3.2 a）

`submitProject` 函数体**第一行**（`:677` 的 `if (!audioFile) {` 之前）：

```tsx
    // BUG-18 P2：主锁 —— 已有一次 POST 在飞，任何来源的第二次调用直接丢弃。
    if (submitInFlightRef.current) {
      return;
    }
```

### 1.4 ③ 取锁（PRD §3.2 b）

`    try {`（`:691`）**之前**插入，与上一块之间留 1 空行：

```tsx
    // BUG-18 P2/P3：校验全过、马上要发请求 —— 这里才取锁（两条早退都不占锁，C1）；
    // 释放统一走下面的 finally，成功（已跳转）与失败（要能重试）两条路都解锁。
    submitInFlightRef.current = true;
```

### 1.5 ④ `finally` 释放（PRD §3.2 c）

`:723` 的 `    }` 之后、`:724` 的函数收尾 `  }` 之前：

```tsx
    } finally {
      // BUG-18 P3：成功路径已跳转、失败路径要允许重试 —— 两条路都必须解锁。
      submitInFlightRef.current = false;
    }
```

改后 `submitProject` 骨架（**除新增块外一字不动**）：

```tsx
  async function submitProject() {
    // 主锁（新增）
    if (submitInFlightRef.current) { return; }
    if (!audioFile) { …:677-680 原样… }
    // :682-683 注释 ＋ const stepOneError = validateStepOne(); 原样
    if (stepOneError || confidentialityLevel === null) { …:686-689 原样… }
    // 取锁（新增）
    submitInFlightRef.current = true;
    try {
      …:692-716 原样（setError(null) / createProject / clearOutlineDraftFromSession / router.push）
    } catch (submitError) {
      if (!isMountedRef.current) { return; }          // ← 新增（⑨ P6）
      …:718-722 原样…
    } finally {
      submitInFlightRef.current = false;
    }
  }
```

### 1.6 ⑤ `handleFormSubmit` 次守卫（PRD §3.3）

`    event.preventDefault();`（`:727`）之**后**、`    if (step < 3) {`（`:729`）之**前**：

```tsx
    // BUG-18 P2：次守卫 —— 请求还没回来之前，任何再次触发的 submit 一律丢弃。
    // 必须留在 preventDefault() 之后：早退时漏了它，浏览器会走原生表单提交，整页刷新。
    if (submitInFlightRef.current) {
      return;
    }
```

> **`event.preventDefault();` 与守卫之间除空行外不得有任何语句**（PRD §0.3 C2 / G6）。
> UI-33 的 `:734-742` 兜底与 `:745-747` 三行 `setConsent*` **顺序、内容一字不动**。

### 1.7 ⑥ `handleConsentConfirm` 次守卫（PRD §3.4）

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

> `handleConsentCancel`（`:755-757`）**不动** —— 取消路径不发请求，无需守卫。

### 1.8 ⑦⑧ 弹窗确认按钮接住 `submitting`（PRD §3.5）

**（a）解构**（`:272` 的 `checked,` 之后）：`  submitting,`
**（b）类型**（`:280` 的 `checked: boolean;` 之后）：`  submitting: boolean;`
**（c）or 条件**：

```diff
-              disabled={!checked}
+              disabled={!checked || submitting}
```

**（d）传参**（`:1278` 的 `checked={consentChecked}` 之后）：`        submitting={isSubmitting}`

> **不加** loading 图标 / 不改 `{CONSENT_BUTTON_LABEL}`：确认成功后弹窗同 tick 卸载，图标看不到且会在慢渲染时闪烁；文案属 UI-06 已验收面。

---

### 1.9 ⑨⑩ P6：跳转后 cleanup（**裁决新增**，PRD §3.6）

**（a）cleanup effect**（插在既有 `useEffect(…, [hasOutlineFlag]);` 之后；该 effect 改前在 `:568-574`）：

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

**（b）`catch` 首部守卫**（`} catch (submitError) {` 之后、`setError(` 之前）：

```tsx
      // BUG-18 P6：已经跳走（组件卸载）就不再 setError，避免对已卸载组件 setState。
      // 用 return 而不是把 setError 包进 if —— finally 照样执行，锁不会漏放。
      if (!isMountedRef.current) {
        return;
      }
```

> **不要**写成 `if (isMountedRef.current) { setError(...) }` —— 会给原 5 行 `setError(...)` 整体加缩进，白增 5 改 5 删。
> **React 19 已不再输出 unmounted setState 警告** ⇒ 本条只能静态守门（G13）＋ 逐行审阅，**不要伪造 console 断言**（PRD §3.6 已写明）。

---

## §2 离线自检（不启 dev server）

```powershell
# ① 行数（1287 -> 1339，实测）
([IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')).Length

# ② diff 规模（对基线 d498afa 取 —— 代码一提交，裸 `git diff` 就恒为空）
git diff --numstat d498afa -- src
git diff -U0 d498afa -- src/components/upload/interview-upload-form.tsx

# ③ 禁改面（期望全部为空；同样对基线取）
git diff --numstat d498afa -- src/lib src/app storage src/store

# ④ 字面量计数（实测值，括号内为改动前）
$a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
($a -match 'submitInFlightRef').Count                           # 6（0）
($a -match 'isMountedRef').Count                                # 4（0）
($a -match 'submitInFlightRef\.current = false;').Count         # 1（0）
($a -match 'disabled=\{!checked \|\| submitting\}').Count        # 1（0）
($a -match 'disabled=\{!checked\}').Count                       # 0（1）
($a -match 'disabled=\{isSubmitting\}').Count                   # 1（1）既有视觉零回退
($a -match '上传中…').Count                                     # 1（1）
($a -match 'AbortController|requestSubmit').Count               # 0（0）
($a -match 'finally').Count                                     # 3（0）：`} finally {` ＋ 取锁注释 ＋ catch 注释
($a -match 'useEffect\(').Count                                 # 3（2）：ConsentDialog 1 ＋ 主组件 1 ＋ P6 新增 1
```

| 项 | 期望 | 实测 | 不达标处置 |
|---|---|---|---|
| `src` 改动文件数 | **1** | **1**（`interview-upload-form.tsx`） | 出现第 2 个 ⇒ **回退重做** |
| hunk 数 | **12**（≤ 14） | **12** | >14 ⇒ 误改了既有行，须还原 |
| `submitInFlightRef` 命中 | **6** | **6** | 5 ⇒ 漏一处次守卫或漏 `finally`；7+ ⇒ 重复加锁 |
| `isMountedRef` 命中 | **4** | **4** | 3 ⇒ 漏 `catch` 守卫或漏 cleanup |
| `disabled={!checked}` | **0** | **0** | 1 ⇒ ⑧ 的 or 条件没落 |
| `finally` | **3 行**（代码 1 ＋ 注释 2） | **3** | 代码 0 ⇒ 锁永不释放（**最危险**） |
| `src/lib` / `src/app` / `storage` / `src/store` diff | **0 行** | **0 行** | 任何命中 ⇒ 立即回退（PRD §7 R5） |
| `numstat` | `53 1` | **`53 1`** | 出现 ≈1339 / ≈1339 ⇒ **LF→CRLF**，`git checkout --` 重做 |

---

## §3 探针回归清单（实施轮必须跑）

> **编号提醒**：本表的 `R1~R7` 是**回归项**，与裁决的 `P1~P6`（决策点）**不是同一套编号**，别混读。

| # | 探针 | 期望 | 实测（2026-11-19） | 说明 |
|---|---|---|---|---|
| R1 | `node tmp/verify-bug18-submit-guard.mjs` | **exit 0** | ✅ **13/13 PASS**（改动前 9 FAIL） | 本批专属静态守门（G1~G13） |
| R2 | `node tmp/verify-bug18-live.mjs` | **exit 0**；L1 `posts === 1` | ✅ **ALL PASS**（改动前 3 FAIL，`posts=2`） | **本批核心行为证据**；需 `npm run dev` ＋ Chrome |
| R3 | `node tmp/verify-phase3.mjs` | I1 / I2 / I3 臂绿（原先 42/42） | ✅ **42/42 通过** | I2 / I3 = 「不选文件开弹窗」，C1 的自动化守门 |
| R4 | `node tmp/verify-ui33-format-guard.mjs` | exit 0（G1~G10） | ⚠️ **G1~G9 9/9 PASS；G10 红**（一次性 diff 形态断言，UI-33 已入库后恒红，非回归） | UI-33 面零回退 |
| R5 | `node tmp/cdp-ui06-consent-copy.mjs` | 绿 | ✅ **52/52 passed** | 弹窗文案 / 勾选态 0 改动 |
| R6 | `node tmp/cdp-req14-consent.mjs` | 绿（选 `.wav` → 开弹窗 → 同意 → 提交） | ⏸ **未跑**（同源覆盖已由 R2 的 setup 臂 ＋ R5 覆盖；该脚本会真实建项目、写 `storage`，本轮不引入写入） | 正向路径 |
| R7 | `npx tsc --noEmit` ／ `npx eslint <file>` | 无新增报错 | ✅ eslint exit 0；tsc 唯一报错在**未跟踪**的 `_delivery/` 副本（与本批无关） | 类型 / 风格 |
| — | `tmp/verify-bug11-12-docs.mjs` / `tmp/verify-bug09-taskorder.mjs` | **不计门禁** | — | 预存红单（钉旧文档 / 旧源码水位），本批不回改 |

> 若环境无法跑 P2~P6：**必须在交付说明里明写「未跑」及原因**，并附 `git diff -U0` 摘录作为替代证据 —— 不得默认「应该没事」。**P2 属核心证据，缺它不得判「已实施」**。

---

## §4 AC 全表（逐条打勾 ＋ 截图）

> 判据与 PRD §6 的 **AC-1~AC-17** 是**覆盖面**对应，非编号对应（本表 12 条 = 可由人工 / 截图复核的子集；其余 STATIC 项由 P1 自动覆盖）。

| AC | 操作 | 期望 | 视口 |
|---|---|---|---|
| AC-1 | 选 `.wav` → 点「开始处理」→ 勾选 → 「同意并继续」第 1 下 → **同 tick 第 2 下**（或连点两下） | 项目列表**只多 1 条**；`storage/projects.json` 只增 1 条 | 390×844 |
| AC-2 | 请求在途（DevTools Network 限速 Slow 3G）时观察 | 「开始处理」`disabled` ＋ 文案 `上传中…` ＋ 弹窗已卸载；再点无反应 | 390×844 |
| AC-3 | 制造失败（断网 / 停 dev server 后提交） | 错误条出现；「开始处理」恢复可点；恢复网络后再提交**能成功**（证明 `finally` 解锁） | 390×844 |
| AC-4 | 不选文件 → step 3 →「开始处理」→ 勾选 →「同意并继续」 | 弹窗**正常打开**（UI-33 AC-4 不回退）；随后错误区 `请先选择一段受访音频。`；**无 POST** | 390×844 |
| AC-5 | 选 `.txt` 触发 UI-33 第一道拒绝后，再选 `.wav` | 正常放行；两道校验顺序与改前一致 | 390×844 |
| AC-6 | 键盘：焦点在第 3 步按钮上连按 Enter | 只 1 条项目；无整页刷新（`preventDefault` 未被守卫挤掉） | — |
| AC-7 | 控制台 `document.querySelectorAll('[data-upload-modal="consent"]').length` | 弹窗打开时 `1`、确认后 `0`（结构 0 改动） | — |
| AC-8 | 弹窗勾选框取消 → 确认按钮 | `disabled === true`（`!checked` 分支仍生效） | — |
| AC-9 | 代码审读 ＋ `git diff --numstat -- src/lib src/app storage src/store` | **空** | — |
| AC-10 | P1 / P2 / P3 / P4 | 全绿 | — |
| AC-11 | `git status --porcelain -- src` | 只有 `interview-upload-form.tsx`；`numstat ≈ 29 2` | — |
| AC-12 | 请求在途时再点「同意并继续」（若弹窗仍在） | 无第 2 个 POST（次守卫生效） | — |

**截图清单（交付物）**：① 双击确认按钮后的项目列表（只多 1 条）；② 请求在途时「上传中…」disabled ＋ 弹窗已卸载；③ 失败后错误条 ＋ 按钮恢复 `开始处理`；④ 失败后重试成功的项目详情页。**本轮未产出截图**（headless 断言替代，见下）。

**本轮实测对照（人工项 → 自动化替代）**：

| AC | 本轮结论 | 依据 |
|---|---|---|
| AC-1 | ✅ 已覆盖 | R2 的 **L1** 臂：同 tick 双击 `posts=1`（改动前 2）—— 断言级替代「人工连点两下」 |
| AC-2 | ✅ 已覆盖 | R2 的 **L4 ＋ L1b** 臂：`disabled=true` / 含 `上传中…` / 弹窗已摘 |
| AC-3 | ✅ 已覆盖 | R2 的 **L5** 臂：500 后按钮恢复可用 ＋ 重试 `posts=2` |
| AC-4 | ✅ 未回归 | R3 的 I2 / I3（不选文件直接开弹窗）＋ G3（取锁在两条早退之后） |
| AC-5 | ✅ 未回归 | R4 的 G1~G7（UI-33 两道校验的锚点与顺序） |
| AC-6 | ✅ 已覆盖 | R2 的 **L3** 臂：`requestSubmit()` 的 `submit` 事件**真实派发**（`fired=true`），守卫丢弃、无整页刷新 |
| AC-7 / AC-8 | ✅ 未回归 | R5（弹窗结构 / 勾选态 52/52） |
| AC-9 / AC-11 | ✅ 已核 | `git diff --numstat -- src` = **`53 1`**；`src/lib` / `src/app` / `storage` / `src/store` 全空 |
| AC-10 | ✅ 已核 | R1 / R2 / R3 / R4 / R5（§3） |
| AC-12 | ✅ 已覆盖 | R2 的 L1（同 tick 双点击）＋ L3（在途强制提交）双路径 |
| **裁决 P6** | ✅ 静态守门 ＋ 逐行审阅 | R1 的 **G13**（`isMountedRef` / cleanup effect / `catch` 守卫）＋ PRD §3.6 |

---

## §S5 文档回写（`docs/需求登记表.md` → **v2.43**）

> 本轮（PRD ＋ 任务单出稿）已把登记表升到 **v2.42**，BUG-18 状态改为 `PRD 已出，待实施`（增 §1.2 一行 ＋ §三 一节）。实施轮**再升一版（v2.43）**，要点已定稿如下：

1. **版本行 `:3`**：`v2.42` → `v2.43`；**更新日期 `:4`** → `2026-11-19`。
2. **变更记录**：在 `- v2.42` 行**之前**插 `- v2.43`（新在上），要点：① **裁决落定**（P1~P4 / P6 做、P5 不做；**P6 = 跳转后 cleanup**，为裁决新增项）；② 落点（单文件 **12 hunk**、**`+53 −1`**、**1287 → 1339** 行：两个 ref ＋ cleanup effect ＋ `submitProject` 主锁/取锁/`catch` 守卫/`finally` ＋ 两个次守卫 ＋ 弹窗 `submitting` 4 小处）；③ 探针（`verify-bug18-submit-guard` G1~G13 **13/13** ＋ `verify-bug18-live` **ALL PASS**，改动前基线 `posts=2` 已复现）；④ 回归（phase3 **42/42**、UI-06 **52/52**、UI-33 G1~G9 全绿、UI-33 G10 属一次性 diff 断言恒红已注明）；⑤ 未 push，等验收。
3. **§三 BUG-18 状态行**：`**PRD 已出，待实施**` → `**已实施（2026-11-19），待验收**`。
4. **§1.2 ＋ §5.1** 状态列同步同一 token（三处不得矛盾）。
5. 遗留 L-1~L-4（§三 本节）：L-1（后端无幂等）＝ 裁决 P5 明确不做，保留「待另立 REQ」；L-2（store `isSubmitting` 卡死）＝ **仍未做**（裁决 P6 指的是卸载 cleanup，不是这一条）；L-3 / L-4 原样登记。

---

## §S6 git（**总管裁决：代码一笔 ＋ 文档一笔，共两笔**）

```powershell
# 第 1 笔：代码
git add src/components/upload/interview-upload-form.tsx
git commit -m "fix(bug-18): 创建项目重复提交防护（useRef 在途锁 + 弹窗 submitting + 卸载 cleanup，单文件 12 hunk）"

# 第 2 笔：文档（PRD 裁决＋实测、任务单、登记表 v2.43）
git add docs/需求登记表.md docs/PRD_BUG-18_创建项目重复提交防护.md docs/tasks/IMPL_BUG-18_创建项目重复提交防护.md
git commit -m "docs: v2.43 BUG-18 实施落盘（重复提交防护 · 裁决 P1~P6 + 双臂实测）"

# 不 push，等总管验收
```

> `tmp/**` 探针不入库（`.gitignore:54`）：`verify-bug18-submit-guard.mjs` / `verify-bug18-live.mjs` / `patch-bug18.mjs` 全部留在本地。
> 两笔顺序不可颠倒：文档里引用了代码的 hunk / 行号，先有代码再落文档。

---

## 验收交付物

- [x] `git diff -U0 -- src/components/upload/interview-upload-form.tsx`：**12 hunk**，分别落在「`submitting` 解构 / 类型 / `disabled` / 两个 ref / cleanup effect / 主锁 / 取锁 / `catch` 守卫 / `finally` / `handleFormSubmit` 守卫 / `handleConsentConfirm` 守卫 / 传参」（逐条见 PRD §2 表）
- [x] 行数 **1287 → 1339**；`git diff --numstat -- src` = **`53  1`**
- [x] `git diff --numstat -- src/lib src/app storage src/store` **全空**（AC-9）
- [x] `node tmp/verify-bug18-submit-guard.mjs` → `ALL PASS (13/13)` exit 0（改动前 `9 FAIL (4/13)` exit 1）
- [x] `node tmp/verify-bug18-live.mjs` → `ALL PASS` exit 0；**核心证据**：L1 `posts=1`（改动前 **`posts=2`**）、L3 `fired=true` ＋ `posts=1`、L4 `{"disabled":true,"text":"上传中…"}`、L5 重试 `posts=2`
- [x] `node tmp/verify-phase3.mjs` → **42/42 通过**（含 I2 / I3）
- [x] `node tmp/verify-ui33-format-guard.mjs` → G1~G9 全绿；**G10 一次性 diff 断言恒红，已在 §3 / PRD §6.2 注明口径**
- [x] `node tmp/cdp-ui06-consent-copy.mjs` → **52/52 passed**
- [ ] AC-1…AC-12 逐条打勾 ＋ §4 截图 4 张 —— **自动化替代已覆盖（§4 对照表）；截图待验收轮按需补**
- [ ] 登记表 v2.43 回写（版本行 ＋ 变更记录行 ＋ §三 / §1.2 / §5.1 三处状态 token 一致）—— **本轮已完成，见 §S5**

## 风险与回滚

| # | 风险 | 处置 |
|---|---|---|
| ① | 取锁放在前置校验**之前** ⇒ 「不选文件 + 同意」后按钮永久 disabled（UI-33 AC-4 ＋ `verify-phase3` I2 / I3 红） | PRD §0.3 C1 ＋ G3 / P3 双守门；一红即把 `= true` 挪回 `try` 前 |
| ② | 守卫写在 `event.preventDefault();` **之前** ⇒ 早退走原生提交、整页刷新 | G6（两行之间无第三语句）＋ AC-6 |
| ③ | 只写 `catch` 不写 `finally` ⇒ 成功路径锁未释放；或忘解锁 ⇒ 永久 disabled | §2-④ `finally` **恰 1** ＋ `= false;` **恰 1** ＋ AC-3（失败后可重试） |
| ④ | 误在 store / `route.ts` 加锁或幂等键 | `git diff --numstat -- src/lib src/app src/store` 必须空（AC-9），任何命中立即回退 |
| ⑤ | 误动弹窗文案 / 结构（顺手美化、加 spinner） | `verify-ui33-format-guard` 与 `cdp-ui06-consent-copy` 双守门；`CONSENT_*` 与 `data-ui06-*` 逐字不动 |
| ⑥ | 误把 LF 改 CRLF | `git diff --numstat -- src` 若出现 ≈1287 / ≈1287 ⇒ `git checkout --` 重做 |
| ⑦ | 整体回退 | 单文件 ⇒ `git checkout -- src/components/upload/interview-upload-form.tsx` 即净；`tmp/verify-bug18-submit-guard.mjs` 保留（不入库）；登记表 v2.42 / v2.43 如实记录已回退 |

