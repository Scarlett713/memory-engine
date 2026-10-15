# BUG-09 实施任务单 · AI 访谈「提问链路」客户端超时（`fetchNextQuestion` 挂 `AbortController`）

> 上游：`docs/需求登记表.md` §三 BUG-09（`:636-654`，**P2**；2026-10-14 由「暂缓」转「待实施」；**未定性口径不变**）＋ §1.2（`:124`）／§5.1（`:1241`）／§5.2（`:1310`，BUG-14 ↔ BUG-09 ↔ REQ-14 / REQ-27）。**本条不出 PRD**（缺陷修复：一处 `fetch` 加 `AbortController` ＋ 两个常量）。
> - **规模**：生产代码 **1 文件 / 2 hunk** —— `src/components/interview/interview-console.tsx`：① `:249-250` 的 BLOB 常量块之后新增常量块（`NEXT_QUESTION_TIMEOUT_MS` / `NEXT_QUESTION_TIMEOUT_MESSAGE`）；② `:800-863` 的 `fetchNextQuestion`（`fetch` 挂 `signal` ＋ 到点 `abort` ＋ `catch` 区分 `AbortError` ＋ `finally` 清定时器；`:805-855` 既有体逐字不动）。`src/lib/**` / `src/app/**` / `src/hooks/**` / 其余组件 **0 hunk**；**0 UI hunk**（错误条与「重试」按钮已在 `:1224-1240`）。
> - **前置 / 红线**：**不改** `src/app/api/projects/[projectId]/interview/next-question/route.ts`（服务端 15s 口径不动）；**不改** `src/lib/interview-prompt.ts`（`INTERVIEW_QUESTION_TIMEOUT_MS` 只作只读比对）；**不改任何 `src/lib/**`**；**不改** reducer 转移表（`:429-449` 的 `FAIL` / `RETRY` 逐字不动）、`uploadAudio`（`:886`）、`use-speech-recorder.ts`；**不做** PRD §7-6 的「自动跳下一问 ＋ 待补录」（`NEXT_QUESTION_READY` 现无生产者，见 §0.3 与 §6-Q1）。
> - **行号基线**：2026-10-14 实测，HEAD = `e8f1c63`（`master` = `origin/master`；工作区干净）。行号口径 ＝ `[IO.File]::ReadAllLines` ／ `Get-ChildItem | Select-String`；**禁用 `Get-Content`**（PS 5.1 把无 BOM UTF-8 当 GBK 解码 → 行号虚高）；**含 `[projectId]` 的路径必须用 `-LiteralPath` 或 `Get-ChildItem` 管道**（`-Path` 会把方括号当通配符、静默失配）。
> - **状态**：**待实施**（纯任务单：`src` / `tmp` / `storage` 零改动、**不 commit**）。
> - **回传口径（沿 BUG-16 · 总管 2026-10-14 定）**：回传聊天窗口**只给三段** —— ① 结论表（commit hash / 行号 / 状态）② 待裁决项 ③ 异常（若有）；过程细节（`numstat` / 编码与行尾核验 / 逐轮日志归属等）留在本单。

---

## §0 机理与取证（2026-10-14；只读核实，`src` 零改动）

### 0.1 触发条件与链路（行号 = HEAD `e8f1c63`）

| 段 | 现状 | 「链路已断、请求不回包」时（断网 / 代理或网关黑洞 / 服务端进程被杀） |
| --- | --- | --- |
| 起点 | 「开始访谈」按钮 `:1079-1086` → `dispatch({ type: "START" })` —— **只改相位，不开麦克风**（录音由 `:1117-1119` 的 `await startRecording()` ＋ `USER_START_ANSWERING` 启动） | — |
| 触发 | effect `:867-873`：`phase !== "ai_thinking"` 直接 return，否则 `void fetchNextQuestion()` | — |
| 请求 | `:800-814`：`await fetch(\`/api/projects/${project.id}/interview/next-question\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ … }) })` —— **无 `signal`、无 `Promise.race`** | **永不 settle** ⇒ `await` 不返回 |
| 服务端 | `route.ts:48-71` `askWithTimeout`（`Promise.race` 15s；`:41-47` 自记「provider 接口是 `askQuestion(prompt)` 单参契约，没有 timeout 选项也没有 `AbortSignal`」的已知取舍） | **不生效**：进程侧即便算完并回 502，包也回不到浏览器 |
| 回包 | `:816-826` 非 2xx → `throw new Error(payload?.error ?? payload?.message ?? "请求失败，请重试。")`；`data.done` → `FINISH`；否则 `AI_QUESTION_READY` | **永不执行** |
| 失败 | `:850-855` `catch` → `dispatch({ type: "FAIL", message: error instanceof Error ? error.message : "网络错误，请重试" })` | **永不执行** |
| 相位 | `:429-438` `FAIL`：任意非终态 → `error`（记 `prevPhase`）；`:440-449` `RETRY`：`error` → `prevPhase ?? ready`；错误 UI `:1224-1240`（错误条 ＋ `RotateCcw`「重试」） | **无限期停在 `ai_thinking`** ⇒ 视觉＝「一直转圈」，且**没有任何出口**（无错误条、无重试按钮） |

⇒ 现象「AI 访谈持续转圈」的**客户端可复现成因之一**（登记表 §三「根因」第 1 条）＝ **加载态没有上限**。旁证：`BLOB_WAIT_TIMEOUT_MS = 2000`（`:249`）只服务录音 blob 等待（`:307-326` 的 `waitForBlob`），与加载态无关。

### 0.2 只读取证（两条互相独立的通道）

| # | 通道 | 证据（2026-10-14 实测） | 结论 |
| --- | --- | --- | --- |
| ① | 全目录 grep | `Get-ChildItem src,tmp,docs -Recurse -File -Include *.ts,*.tsx,*.mjs,*.md \| Select-String -Pattern 'AbortController\|AbortSignal\|signal:'` | `src` 内**唯一命中 = `next-question/route.ts:44` 的注释**；**`src/components/interview/**` 0 命中**；`src` 内**没有任何一处实现** ⇒ PRD §7-3 的「前端 `AbortController` 10s」同样**未落地** |
| ② | 源码直读 | `:800-814` 逐字核对：`fetch(url, { method, headers, body })` —— 第三参**无 `signal`** | 与 ① 互证（grep 与直读两条通道同结论） |
| ③ | 旁证（既有写法） | `sleep()`（`:296-298`）用 `window.setTimeout` | 本文件**已有**「定时器用 `window` 版」的写法，本单沿之（§1.1 hunk B） |

### 0.3 与 PRD 的口径差（**须总管裁决**，本单默认取派工口径）

| PRD 原文 | 口径 | 与本案的关系 |
| --- | --- | --- |
| `docs/PRD_REQ-14_AI辅助访谈.md:266`（§7-3，侧写链路兜底） | 「前端：`AbortController` 10s 超时；失败静默，保留上一轮侧写与 checklist 状态；连续 3 次失败熔断」 | 指**侧写链**（`/ask`）；提问链无同款条文。**且全仓未落地**（§0.2 ①） |
| `:272`（§7-6，提问链路兜底）＋ `:67`（④）＋ `:99`（模块 3） | 「`next-question` 超过 15s → **自动跳下一问并标注「待补录」**；访谈结束后在控制台提示『N 个问题未充分展开』」 | 与本案派工口径（**进 `error` ＋ 可重试**）**不同**。落地障碍：`NEXT_QUESTION_READY` **现无生产者**（`:66-67` 注释明记「保留给 Step 5+ 的『待补录』兜底」）⇒ PRD §7-6 的行为**当前不可直接实现**，须先立节点（§6-Q1） |

> 本单判断（供裁决参考）：**超时进 `error` 可重试**是 PRD §7-6「自动跳下一问」的**前置安全网** —— 没有它，同一场景连「跳」的机会都没有（请求永不 settle）。两者**不互斥**：本单先补安全网；「待补录」需要 reducer 新出口（`questionIndex + 1` 但无问题文本的新 state 语义 ＋ 侧写区呈现），属**功能增量**，不在本条。

---

## §1 修法与副作用

### 1.1 唯一改（`src/components/interview/interview-console.tsx`，2 hunk）

**hunk A —— 常量（紧随 `:249-250` 的 BLOB 常量块之后；现状上下文见 `:242-250`）**

```ts
/**
 * BUG-09：提问链路的客户端上限。链路「已断、不回包」时服务端那 15s race 不生效
 * （包根本回不来），加载态必须由客户端自己兜一个上限。
 *
 * 必须 > 服务端的 INTERVIEW_QUESTION_TIMEOUT_MS（15s）：否则服务端自己的 502
 * 信封会先被我们 abort 掉，服务端口径反而看不到。5s 余量留给回程与解析。
 */
const NEXT_QUESTION_TIMEOUT_MS = 20_000;
/** 与服务端 502 信封（next-question/route.ts:179）逐字一致，用户视角连续。 */
const NEXT_QUESTION_TIMEOUT_MESSAGE = "AI 响应超时，请重试。";
```

**hunk B —— `fetchNextQuestion`（`:800-863`；`try` 的入口与 `catch` / `finally` 为新增，`:805-855` 既有体逐字不动）**

```ts
  // 每问一次真实请求。首问（START）与后续每一问都走这里。
  const fetchNextQuestion = useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      NEXT_QUESTION_TIMEOUT_MS,
    );

    try {
      const res = await fetch(
        `/api/projects/${project.id}/interview/next-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ … }),        // ← 逐字不动
          signal: controller.signal,          // ← 本单唯一新增的 request 选项
        },
      );

      … 既有体（`!res.ok` 信封 / `data.done` → FINISH / `AI_QUESTION_READY`）逐字不动 …

    } catch (error) {
      // AbortError 的 message 是浏览器英文串（如 "signal is aborted without
      // reason"），属实现细节、不外显（同 BUG-12 的脱敏纪律）⇒ 固定人话。
      const timedOut =
        error instanceof DOMException && error.name === "AbortError";

      dispatch({
        type: "FAIL",
        message: timedOut
          ? NEXT_QUESTION_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : "网络错误，请重试",
      });
    } finally {
      // 快路径也要清：挂着的 timer 会拖住下一次渲染轮（对照 route.ts:66-69）。
      window.clearTimeout(timer);
    }
  }, [ … deps 逐字不动（`project.id` / `state.questionIndex` / `state.followUpCount` / `state.coveredItemIds` / `state.captions` / `stopRecording`）… ]);
```

> ① `useCallback` 的 deps **不变**（`controller` / `timer` 都是调用内局部量，不进依赖数组）。② **不新增 import**（`AbortController` / `DOMException` / `window.setTimeout` 均为运行时全局；文件 `:1` 已是 `"use client"`，`fetchNextQuestion` 只在浏览器执行 —— SSR 不跑）。③ 常量与函数相距 550 行 ⇒ git **必然拆两段**（「1 hunk」的缺口如实计入）。

### 1.2 三个不变量（为什么这样写）

① **客户端上限 > 服务端 15s**：若取 10s（PRD §7-3 的侧写链数字），「慢模型」场景会被客户端先 abort，服务端 502 的固定人话被吞掉 ⇒ 同一现象出现两个来源、两种文案；**20s = 15s ＋ 5s 余量**（§6-Q6）。
② **不做「相位变更即 abort」的取消守卫**：`:865-866` 既有裁决明记「迟到的回包是安全的」，reducer 的 `FAIL` 分支（`:430-432`）对 `done` / `error` 直接 `return state` ⇒ 超时 abort 在用户**已结束 / 已失败**时同样被丢弃，**语义不变**；反之若按相位变更 abort，会把「用户在 `ai_thinking` 期间点结束回答」变成一次 FAIL 竞态 —— 属**新语义**，不在本单。
③ **0 UI hunk**：`:1224-1240` 的错误条 ＋「重试」按钮已就位；`RETRY` 回 `prevPhase`（= `ai_thinking`）→ effect `:867-873` 重发 ⇒ 「超时可重试」是**既有能力的接通**，不是新增交互。

### 1.3 副作用核查（逐项）

| # | 场景 | 行为 | 是否变化 |
| --- | --- | --- | --- |
| ① | 正常快路径（＜ 20s 回包） | 多一个 `AbortController` ＋ 一次 `setTimeout` / `clearTimeout`；`signal` 永不触发 | **无行为变化** |
| ② | 服务端 15s race 超时 | `!res.ok` 分支 → 抛 route 的 `{ error: "AI 响应超时，请重试" }`（`:176-182`；解析失败同文案 `:191-196`） | 逐字不变（同文案、同落点） |
| ③ | **链路挂住（本单目标）** | 20s 到点 abort → `catch` 判 `AbortError` → `FAIL`（固定人话）→ 错误条 ＋「重试」 | **新**：由「无限期转圈」变为「有上限 ＋ 可重试」 |
| ④ | 用户在 `ai_thinking` 期间结束 / 失败 | 迟到回包被 reducer 丢弃（`:430-432`）；迟到 abort 同理 | 不变（`:865-866` 口径保持） |
| ⑤ | 断网 / DNS 失败 | `fetch` **立即 reject**（非 `AbortError`）→ 走既有 `error.message` 分支 | 不变（BUG-12 §0.2 已把客户端本地兜底 12 处、含 `interview-console.tsx:853`，明确列为**不在修复面**；见 §6-Q2） |
| ⑥ | 组件卸载 / 路由离开 | 本单**不**在 cleanup 里 abort（`fetchNextQuestion` 是 `useCallback`，无 cleanup 钩子）；`window` 定时器 20s 到点自清 | 不变（不新增「卸载后 dispatch」风险面） |

### 1.4 明确不做（本单边界）

- **不做** PRD §7-6 的「自动跳下一问 ＋ 待补录」（`NEXT_QUESTION_READY` 无生产者；须先立节点）—— §6-Q1。
- **不补**其余 route 的服务端超时（`outline/generate` · `outline/chat` · `ask` · `process`；登记表 §三 BUG-09 根因 ② 已登记「超时口径不统一」）—— 与 **BUG-14** 同批另议（§5.2 `:1310`：「可合并为一条『全链路超时 / 重试策略』需求，但**不得互相代替定性**」）。
- **不动** `uploadAudio`（`:886`）的归档 `fetch`：`interview/audio` 归档**不触发转写**，其加载态属「结束后的整理阶段」（登记表「区分判据」③），不在本条复现面。
- **不加**「连续 3 次失败熔断」（PRD §7-3 是**侧写链**条文）—— §6-Q3。
- **不动** `src/lib/**` / `next-question/route.ts` / `interview-prompt.ts` / reducer `:429-449` / `use-speech-recorder.ts` / 错误 UI `:1224-1240`。

---


## §2 验收口径（新增独立探针，**不动**既有出口口径）

### 2.1 出口断言载体

**新增 `tmp/verify-bug09-next-question-timeout.mjs`**（一次性、`.gitignore:54` 忽略 `tmp/` ⇒ **不入版本库**）。

- **骨架参照** `tmp/cdp-req28-labels.mjs`：Chrome `--headless=new` ＋ Node 22 内置 WebSocket 直连 CDP、一次性 profile、跑完 kill ＋ 删目录；**该脚本已证明访谈页可零麦克风进 ready**（其头部纪律第 3 条「不进录音态（不 `getUserMedia`、不触发 `/interview/audio` 归档、不调讯飞）」）。
- **网络域参照**：`Fetch.enable` 用法见 `tmp/cdp-ui29-labels.mjs:220`；`Network.emulateNetworkConditions` 见 `tmp/cdp-flash-narrow.mjs:125`（本单离线臂沿用其参数形状）。
- **纪律**：① 只拦 `*interview/next-question*` 一个 pattern，不碰其它 route；② 不点「结束回答」、不进录音态；③ **不写 `storage/**`** —— 用既有「owner 匹配 ＋ `outlineDraftMarkdown` 非空」的项目**只读进入**访谈页（守卫见 `src/app/projects/[projectId]/interview/page.tsx:21-28`）；如需临时建项目，跑完按 `tmp/verify-phase3.mjs:38-43` 的 `apiLog` 做法清理并复核。
- **前置**：dev server 已在 `3000`；探针账号须为该记录 owner（例：`tmp/cdp-req28-labels.mjs:22-28` 的 `PROJECT_ID = fWyGpQ7qUN` / `EMAIL = scrolltest@example.com`，先复核该记录仍在且提纲非空，失效则另挑一条）。

### 2.2 断言组

| # | 臂 | 做法 | 断言（判据） |
| --- | --- | --- | --- |
| **A1** | **挂住 → 有上限（本条主线）** | `Fetch.enable({ patterns: [{ urlPattern: "*interview/next-question*" }] })`；收到 `Fetch.requestPaused` **不 continue**（请求永久挂住）；点「开始访谈」记 `t0` | ① ≤ **22s**（20s ＋ 2s 容差）出现错误条 ＋「重试」按钮；② 文案**逐字** ＝「AI 响应超时，请重试。」；③ 页内**不再**有转圈指示（按实测取 `CenteredLoading` 的现行文案作词表） |
| **A1′** | **非虚绿反证（自带）** | 同 A1，在 `t0 + 8s` 采样一次 | **此刻不得**出现错误条（证明 A1 的读数确由 20s 上限产生，而不是「一点就失败」的假绿） |
| **A2** | **重试恢复** | A1 之后：`Fetch.disable()` → 点「重试」 | ① 回到 `ai_thinking`；② ≤ 15s 出现题目文本（真 2xx 走 `AI_QUESTION_READY`）；③ **题号 / 追问计数 / `coveredItemIds` 与失败前一致**（`RETRY` 只回相位、不清状态） |
| **A3** | **服务端 502 口径不回退** | 对下一次请求 `Fetch.fulfillRequest` 立即回 `502` ＋ `{"error":"AI 响应超时，请重试"}` | ① 错误条文案逐字不变；② 错误出现时间 **≪ 20s**（证明「快失败」不被客户端上限改写、也不被 `signal` 吞掉） |
| **A4** | **断网臂（现状登记，不作硬断言）** | `Network.emulateNetworkConditions({ offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })` → 点「开始访谈」 | 记录实际文案（预期为浏览器 / 既有兜底文案）；**只登记不判红**（BUG-12 §0.2 已把客户端本地兜底 12 处列为不在面 ⇒ 本单不改文案，§6-Q2） |
| **S1** | **源码守门（离线，防回退）** | 读 `interview-console.tsx` ＋ `interview-prompt.ts` 做正则 / 数值断言 | ① 含 `NEXT_QUESTION_TIMEOUT_MS`；② `next-question` 的 `fetch` 带 `signal: controller.signal`；③ `catch` 含 `error.name === "AbortError"`；④ `NEXT_QUESTION_TIMEOUT_MS` **>** `INTERVIEW_QUESTION_TIMEOUT_MS`（值从 `src/lib/interview-prompt.ts:14` 读 `15_000`，两者做数值比较）；⑤ `interview/audio` 的 fetch **仍无** `signal`（**范围守门**：证明没扩大改动面） |

**灵敏度反证（S4，必做）**：临时回退 `src/components/interview/interview-console.tsx` 到 HEAD 版本 → 跑 A1 ⇒ **必须红**（≥ 25s 仍无错误条）→ 原样恢复后 A1 复绿。**反证与实现同批进退，不留「断言在、实现无」的中间态。**

### 2.3 验收要点（机器 ＋ 人工）

1. **机器**：A1 / A1′ / A2 / A3 / S1 全绿；S4 反证已红过并恢复。
2. **人工**：真机断网（关 Wi-Fi / 拔网线）点「开始访谈」→ ≤ 20s 出「AI 响应超时，请重试。」且「重试」可点；恢复网络后点重试 → 正常出题。

---

## §3 回归要求（既有基线一律不得回退）

### 3.1 既有出口回归

| # | 命令 | 期望 |
| --- | --- | --- |
| **R1** | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | `136/136`，exit 0（本单不改 `src/lib/**` ⇒ 应逐字零回退） |
| **R2** | `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | `31/31`，FAIL 0，exit 0 |
| **R3** | `node tmp/verify-phase3.mjs`（dev server ＋ Chrome；既有整单） | 与改动前**同口径**：K 组全绿 ＋ 已知抖动 **G / J3** 不入判（沿 BUG-16 §6-Q2 裁决）。**本单不新增臂到该文件**（避免动它的计数口径） |
| **R4** | `npx tsc --noEmit` ＋ `npx eslint src/components/interview/interview-console.tsx` | 双 exit 0 |
| **R5** | 越界守门（`git status --porcelain` ／ `git diff --numstat`） | 只列 `src/components/interview/interview-console.tsx` ＋ `docs`（`tmp/` 不入库）；`src` **无新增 / 删除文件**；`numstat` 恰 **1 文件**；`storage/**` 零改动 |

### 3.2 观感回归

- **回归观感**：正常网络下连续 3 问零变化（不出现「秒失败」、文案不变）；服务端 502 场景文案与改动前逐字一致。

---


## §4 步骤 / 回滚

| 步 | 动作 | 结果（实施轮回填） |
| --- | --- | --- |
| **S0** | 基线取证：`git status --porcelain` 为空（HEAD `e8f1c63`）；采集改动前读数 —— 正常问答 3 轮的耗时与出题文本、**挂住臂**（A1 形态）≥ 25s 仍无错误条、502 臂文案、断网臂文案 | 待填 |
| **S1** | 落 §1.1 hunk A ＋ hunk B | `git diff --numstat` 恰 **1 文件**；`src` 无新增 / 删除文件；**0 UI hunk** |
| **S2** | 静态门（R4） | `tsc` / `eslint` exit 0 |
| **S3** | 新增 `tmp/verify-bug09-next-question-timeout.mjs`，跑 S1（源码守门）/ A1 / A1′ / A2 / A3 / A4 | A 组按 §2.2 通过；A4 只登记（§6-Q2） |
| **S4** | 灵敏度反证（临时回退 `interview-console.tsx`）＋ 原样恢复 | 旧码 A1 红 ⇒ 非虚绿；恢复后 A1 复绿且 `numstat` 复原 |
| **S5** | R1 / R2 / R3 / R5 全跑 ＋ §2.3-2 人工断网回归 ＋ §3.2 观感回归 | 见 §3.1 / §3.2（既有抖动 G / J3 不入判） |
| **S6** | 登记表回写（§5）＋ 交付回传 | **本单不自行 commit**，等总管放行；hash 回填由放行后单独一笔完成（§6-Q5） |

**回滚**：`git checkout -- src/components/interview/interview-console.tsx`（单文件单点）⇒ 追加的常量与 `signal` 一并消失、无残留；探针与登记表回写**同批进退**。

---

## §5 文档回写清单（`docs/需求登记表.md`；实施轮执行）

| # | 位置（行号 = 现水位 `e8f1c63`） | 动作 |
| --- | --- | --- |
| ① | §三 BUG-09 **状态行**（`:638`） | 「**待实施**」→「**已完成**（实施日，commit `<hash>`）」＋ 实测摘要（1 文件 / 2 hunk；20s 上限 ＞ 服务端 15s 的理由） |
| ② | §三 BUG-09 **根因行**（`:646-648`） | 根因 ① 后追加「**2026-10-XX 已修**：客户端补 20s `AbortController` ＋ 固定人话；服务端 15s 口径不动」；根因 ②「超时口径不统一」**原文保留**（其余三条 route 仍未补，归 BUG-14 / 全链路策略） |
| ③ | §三 BUG-09 **验收要点 / 依赖行**（`:651-653`） | 补 A 组（A1 / A1′ / A2 / A3 / S1）与灵敏度反证结论；「批次归属」按 §6-Q4 收口 |
| ④ | §三 BUG-09 **风险行**（`:654`） | 追加「与 PRD §7-6『待补录』的口径差 ＋ 裁决结论」（§6-Q1） |
| ⑤ | §1.2 总览表 BUG-09 行（`:124`）＋ §5.1 编号索引 BUG-09 行（`:1241`） | 状态同步「已完成」＋ 一句修法摘要（20s `AbortController` / 固定人话 / 0 UI hunk）；**「未定性口径」「与 REQ-27 边界」「与 BUG-14 须互引、不得互相代替定性」等约束逐字保留** |
| ⑥ | §5.2 交叉条（`:1310`） | 追加「BUG-09 提问链客户端超时已闭环（20s ＋ 可重试）；**BUG-14 转写轮询链未动**」——**不得**删「须互引」「不得互相代替定性」「与 REQ-27 共用一套恢复交互」等原文 |
| ⑦ | 头部 `:3` 版本 → `v2.28`；`:4` 更新日期 → 实施日；变更记录在 `:50` 的 v2.27 行之后新增 v2.28 行 | 内容：1 文件 / 2 hunk；20s 与服务端 15s 的关系；未动清单（`src/lib/**` · `route.ts` · `interview-prompt.ts` · reducer · `uploadAudio` · 错误 UI）；A 组断言与反证；行号位移与 hash |
| ⑧ | 其余文档（`docs/tasks/IMPL_BUG-12_*` / `IMPL_BUG-16_*` / `docs/PRD_REQ-14_*`） | **不动** —— PRD §7-3 / §7-6 的口径差**只在登记表登记**，**不就地改 PRD**（是否回写 PRD 见 §6-Q1） |

**改文档的硬约束**：① 只改上述行，**不重排**表行顺序、不改他条；② 更正一律「**原文保留 ＋ 就地追加更正注**」；③ 所有行号以实施轮实测为准（本单数字是改前水位）。

---

## §6 开口项（待总管裁决；本单已给默认取值，未获裁决前按默认执行）

| # | 事项 | 选项 | 本单默认 |
| --- | --- | --- | --- |
| **Q1** | **超时后的行为**：PRD §7-6（`:272`）明令「超 15s → 自动跳下一问并标注『待补录』」，而派工口径是「进 `error` ＋ 可重试」 | A 按派工口径（`error` ＋ 重试），PRD §7-6 另立节点后再实现；B 直接实现「待补录」（须同批给 `NEXT_QUESTION_READY` 加生产者 ＋ 侧写区呈现，改动面超出本条）；C 两者同批 | **A** —— B 把缺陷修复扩成功能增量（新 reducer 出口 ＋ 呈现 ＋ 新 state 语义）；A 是 §7-6 的**前置安全网**。**PRD 是否就地回写**：默认**不回写**（只在登记表登记口径差） |
| **Q2** | 断网 / 真 reject 的**文案**是否同批脱敏（`:853` 现透出 `error.message`） | A 不动（沿 BUG-12 §0.2「客户端本地兜底 12 处不在面」）；B 本批改为固定人话 | **A** —— 本单只闭环「加载态无上限」这一层；文案统一应由「错误话术口径统一」另立条目处理 |
| **Q3** | 是否加「连续 N 次失败熔断」 | A 不加；B 加（PRD §7-3 为**侧写链**条文，提问链是否适用未定） | **A** |
| **Q4** | 与 **BUG-14** 是否合并为一条「全链路超时 / 重试策略」 | A 不合并（本条只闭环提问链，BUG-14 未动）；B 合并 | **A** —— 沿 §5.2 `:1310`「须互引、不得互相代替定性」；是否合并属 REQ 层决策，不改本单边界 |
| **Q5** | commit 边界 | A 单笔（`src` 1 文件 ＋ `docs` 1 件）；B 沿 BUG-16 / BUG-12 的「两笔：主体 ＋ `docs: 回填 … hash`」 | **A**（本案只 1 个生产文件）；若总管沿用两笔惯例则改 **B**，hash 回填锚点仍为 §5-⑦ 与 §4-S6 |
| **Q6** | 20s 是否合适（派工建议值） | A 20s（= 15s ＋ 5s 余量）；B 15s（与服务端等值 ⇒「谁先超时」不确定）；C 更大（如 30s） | **A**；**硬约束**：必须 **>** 服务端 `INTERVIEW_QUESTION_TIMEOUT_MS`（§1.2-①） |

---

> 本单状态 ＝ **待实施**（纯任务单：`src` / `storage` 零改动、**不 commit**）。交付物 ＝ 本单 ＋ 自检探针 `tmp/verify-bug09-taskorder.mjs`（`.gitignore:54` 忽略 `tmp/` ⇒ **不入版本库**）。放行后按 §4 的 S0~S6 执行。

