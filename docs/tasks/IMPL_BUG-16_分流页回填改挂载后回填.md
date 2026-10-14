# BUG-16 实施任务单 · 分流步回填改为「挂载后回填」（消除 hydration mismatch）

> 上游：`docs/需求登记表.md` §三 BUG-16（**P1**，本批新立号）＋ §1.2 / §5.1 / §5.2（同批写入）。**本条不出 PRD**（缺陷修复：一处初值 ＋ 一个 effect）。
>
> - **承接关系**：`docs/tasks/IMPL_BUG-10_分流页返回信息丢失.md` §1.2-③ 与 §6-Q2 当时已明记本风险与分支（「若告警存在且总管不接受 ⇒ 换后置回填形态，需另裁决，**不属本单**」）。总管 2026-10-14 诊断单即对该开口项的裁决：**立 BUG-16、改后置回填**。
> - **规模**：生产代码 **1 文件 / 2 hunk**（`git diff --numstat` = `23 9`；hunk 首行 `@@ -1,6 +1,6 @@` 与 `@@ -48,24 +48,38 @@`）——① `:3` 的 `react` import；② `:45-82` 的 `basicInfo` 初值 ＋ 挂载后回填 effect（含 BUG-10 / BUG-16 注释块）。**「1 hunk」的缺口如实计入**：`useEffect` 必须新增 import，与改动区块相距 40 余行，git 必拆两段；把 effect 挪出本组件、或改用免 import 的形态，代价更大。
> - **前置 / 红线**：`src/lib/**` **0 hunk**（不新增存储函数、不改 `outline-session.ts`）；`persistBasicInfo()`（BUG-07 守门）、`handleBack()`、`goToStep()`、header 文案 **0 hunk**；不动 `route-chooser.tsx` / `interview-console.tsx`；**范围口径不变** —— 仅 `initialStep === "route"`（BUG-10 §6-Q1 取 B）。
> - **行号基线**：2026-10-14 实测，HEAD = `b2fb89c`（`master`，BUG-10 两笔 commit 之后；**本单已 commit（两笔）、未 push**）。行号口径 = `[IO.File]::ReadAllLines` ／ `Select-String`（**禁用 `Get-Content`** —— PS 5.1 会把无 BOM UTF-8 当 GBK 解码致行号虚高）。
> - **状态**：**已完成**（2026-10-14 提交 · **本批第一笔** commit，hash 见第二笔回填）。终验：R1 `136/136` exit 0 ／ R2 `31/31` FAIL 0 exit 0 ／ R3 **45/46**（唯一 FAIL = 既有抖动臂 **J3**；K4 / K5 / K6 全 PASS）⇒ 依 §6-Q2 裁决视为通过；灵敏度反证已做并已原样恢复。
> - **回传口径（总管 2026-10-14 定）**：回传聊天窗口**只给三段** —— ① **结论表（commit hash / 行号 / 状态）**、② **待裁决项**、③ **异常（若有）**；**过程细节一律留在本单**（`numstat` / 编码与行尾核验 / 自伤修复经过 / 逐轮日志归属等），不进聊天窗口。

---

## §0 机理与取证（2026-10-14；只读核实 ＋ 一次性诊断探针，`src` 零改动）

### 0.1 触发条件与两侧产物

`NewProjectFlow` 是 client component、**仍参与 SSR**（`src/app/projects/new/page.tsx` 是 server component，只把 `initialStep` 下传）。BUG-10 的修法把草稿读回放在 `useState` 的**懒初始化**里 ⇒ 同一份代码两侧产物不同：

| 侧 | 分支条件 | `basicInfo` | `#route-chooser-realtime` | 空态提示（`route-chooser.tsx:246-250`） |
| --- | --- | --- | --- | --- |
| 服务端 | `typeof window === "undefined"`（`outline-session.ts:174-177` 守门） | `EMPTY_BASIC_INFO` | `disabled=""` | 渲染 |
| 客户端首帧 | 读到草稿 | 草稿三字段 | 无 `disabled` 属性（可点） | 不渲染 |

两侧 HTML 不一致 ⇒ React 19 判 **hydration 失败**（`Recoverable`）、**丢弃服务端 HTML 并在客户端整棵重渲染** —— 页面功能不坏，但有性能损耗与控制台 / 异常报错。

**最小复现**：① `sessionStorage["memory-engine-outline-session"]` 的 `profile.projectName` / `intervieweeName` 非空；② **整页加载** `/projects/new?step=route`（同 tab 硬刷新 / 直入 URL / 跨路由重挂载）。**软导航不触发**（软导航不发生 hydrate）—— 这正是 BUG-10 那轮 K1 臂（客户端导航返回）测不出本问题的原因。

### 0.2 取证（两条互相独立的通道 ＋ 对照臂）

诊断探针 `tmp/diag-hydration.mjs`（本单新增、一次性；`tmp/` 为 `.gitignore:54` 忽略目录 ⇒ **不入版本库**）：`ARM-1` = 有草稿 ＋ 整页加载 `?step=route`；`ARM-2` = 抽掉草稿的对照臂。

| 项 | ARM-1（有草稿） | ARM-2（对照） |
| --- | --- | --- |
| 服务端 HTML（页内 `fetch(location.href)`） | `disabled=""` ＋ 含空态提示 | `disabled=""` ＋ 含空态提示 |
| 客户端 DOM（hydrate 后） | 无 `disabled` 属性 ＋ 无提示 | `disabled=""` ＋ 有提示 |
| **结构比对** | **★ 两侧不一致** | 一致（无 mismatch 条件） |
| `Runtime.exceptionThrown` | **1 条**：`Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. … - A server/client branch 「if (typeof window !== 'undefined')」` | **0 条** |

⇒ ① 结构比对（**与日志通道无关**）证明两侧首帧产物确实不同；② 异常原文证明 React 的判定与该形态直接对应（它自己点名了 `typeof window !== 'undefined'` 分支）；③ 对照臂证明信号由草稿回填驱动，不是别的副作用。

### 0.3 为什么 BUG-10 那轮漏报（通道盲区复盘）

`tmp/verify-phase3.mjs` 当时的 §1.2③ 臂**只采集 `Runtime.consoleAPICalled`**；而 React 19 ＋ Next 16 把该失败经 `reportError` 抛出、走 **`Runtime.exceptionThrown`** ⇒ 当轮读数「console 条目 2、hydration 相关 0」被读成「未见 hydration 告警」，并据此写下 v2.20-④③ 与 `IMPL_BUG-10` §1.2③ 的结论「Q2 懒初始化形态可」。**该结论已作废**（更正记录见 §5 与 `docs/需求登记表.md` 变更记录 v2.21-④）。本单处置：把 `excLog` 通道并入探针，并把该臂从 NOTE **升为断言 K5**（＋ 独立的**结构通道**判据），使这条缺陷无法再以「0 命中」形态静默通过。

---

## §1 修法与副作用

### 1.1 唯一改动（1 文件 / 2 hunk；`git diff --numstat` = `23 9`）

```tsx
// hunk 1（`:3`）
import { useEffect, useState } from "react";

// hunk 2（`:45-82`）
const [basicInfo, setBasicInfo] = useState<BasicInfo>(EMPTY_BASIC_INFO);

useEffect(() => {
  // 与 BUG-10 同范围：只在分流步冷启动回填（IMPL §6-Q1 取 B，不扩大到 basic / outline）。
  if (initialStep !== "route") return;
  const profile = readOutlineDraftSession()?.profile;
  if (!profile) return;
  setBasicInfo({
    projectName: profile.projectName ?? "",
    intervieweeName: profile.intervieweeName ?? "",
    overview: profile.notes ?? "",
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

（现场代码：机理注释 `:52-58`、state ＋ effect `:59-82`；注释块逐句对应 §0.1 / §0.3。）

**为什么依赖数组留空**：`initialStep` 只是「是不是分流步冷启动」的**一次性判定输入**；`goToStep` 的 `router.replace` 会让 server component 重渲染并把新的 `initialStep` 下传（`:41-44` 的注释即为此设）⇒ 若把它放进依赖，route 步往返会触发**第二次回填**、拿草稿去盖用户在 state 里刚改的值。旧的懒初始化只跑一次，本形态须同语义。豁免写法（`eslint-disable-next-line react-hooks/exhaustive-deps`）沿用 `outline-plan-workspace.tsx:203` 的既有先例。

**备选形态（未采纳）**：`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` —— React 官方处理「读浏览器存储」的形态，可在 hydrate 期直接用 server 快照、避免首帧空态；但需要稳定的 `subscribe` ＋ 必须缓存的 `getSnapshot`（引用不稳定会死循环），在「禁止扩展 `src/lib/**`」约束下只能内联在组件里，机制重量远大于收益；且总管指示的形态即 `useState` ＋ `useEffect`。

### 1.2 副作用核查（逐条实测，七项）

| # | 侧面 | 实测 | 结论 |
| --- | --- | --- | --- |
| ① | **首帧空态一帧**（新形态固有代价） | 整页加载 `?step=route`：首帧 `disabled=""`、随 effect 回填为可点（约一帧） | 可接受：两态**布局相同**（仅 `disabled` 属性 / 配色 / 提示段落在否）⇒ **无布局跳动**；K5 实测最终 `disabled=false`（**§6-Q3 裁决：取 A —— 接受**） |
| ② | **dev StrictMode 下 effect 双调用**（`next.config.ts` 未关 `reactStrictMode`） | 第二次 `setBasicInfo` 传同值新对象 ⇒ 多一次渲染、DOM 无变化 | 无影响：K1 / K3 / K3b / K5 全绿，结构通道 `markedAlive=true` |
| ③ | **客户端导航返回仍回填**（访谈页 `<Link>` → 组件重新挂载） | K1 仍 PASS（`disabled=false` ＋ 草稿在场） | BUG-10 能力 K1 **不回归** |
| ④ | **`?step=outline` 冷启动仍不回填**（Q1=B 口径） | §1.2①′ 冷启动臂仍「6s 内无」、`#outline-topic=""` | 范围未扩大 |
| ⑤ | **route → outline 软导航自动生成**（BUG-10 唯一行为变化） | §1.2① 臂仍 `generating` | 未变（本次不触碰提纲路径） |
| ⑥ | **无草稿整页加载 `?step=route`** | K4 / K6 仍绿（灰置 ＋ 有提示 ＋ 无 hydration 失败） | 与 BUG-10 同形 |
| ⑦ | **越界面** | `persistBasicInfo` / `handleBack` / `goToStep` / `src/lib/**` **0 hunk**；R1 / R2 全绿 | 未越界 |

### 1.3 静态门

`npx tsc --noEmit` → **exit 0**；`npx eslint src/components/new-project/new-project-flow.tsx` → **exit 0**（`react-hooks/exhaustive-deps` 以 `eslint-disable-next-line` 显式豁免，不新增告警）。

### 1.4 灵敏度反证（2026-10-14 实测）

`src` 临时回退到 BUG-10 版（`git checkout -- src/components/new-project/new-project-flow.tsx`）后跑同一支探针 `tmp/verify-phase3.mjs`：

| 版本 | K5 | K6（对照臂） |
| --- | --- | --- |
| 旧码（BUG-10 版） | **FAIL** —— `hydration 条目=1`（`exceptionThrown` 原文）、**`标记节点存活=false`**（React 丢弃整个 SSR 子树） | PASS |
| 新码（本单，4 轮） | **PASS** —— `hydration 条目=0`、`标记节点存活=true`、`disabled=false`、无空态提示 | PASS |

⇒ **两条通道同时变红**（日志通道 ＋ 结构通道），断言由本次修法驱动、非虚绿；已原样恢复并复验 `git diff --numstat` = `23 9`（2 hunk）。

---

## §2 验收口径

**命题**：整页加载 `/projects/new?step=route`（草稿在场）时 React **不再报 hydration 失败**（服务端与客户端首帧产物一致），且 BUG-10 的回填能力不回归。

### 2.1 断言（K 组 5 → 7 条）

| # | 断言 | 判据 |
| --- | --- | --- |
| **K5** | 有草稿整页加载 `?step=route` 无 hydration 失败，且草稿回填仍生效 | 两通道（`consoleAPICalled` ＋ `exceptionThrown`）hydration 命中 **0**；SSR 节点标记 `markedAlive === true`；`#route-chooser-realtime` 最终 `disabled === false` 且**无**空态提示；`removed === 0`（旁证） |
| **K6** | **对照臂**：无草稿整页加载 `?step=route` | 同一判据下 0 命中 ＋ `markedAlive === true` ＋ `removed === 0` ＋ `disabled === true`（K5 的基线） |

> 判据说明：`removed`（直接命中标记节点的移除计数）在旧码下实测仍为 `0` —— React 丢的是**祖先层**子树、被移除的那个节点本身没有标记。故结构判据取 `markedAlive`（`document.querySelector('#route-chooser-realtime') === window.__hyd.marked`），`removed` 仅作旁证。

### 2.2 探针落点（`tmp/verify-phase3.mjs`，2026-10-14 实测；引用按 label 定位）

| 构件 | 落点 |
| --- | --- |
| `excLog` 声明（含通道说明注释 `:44-48`） | `:50` |
| `Runtime.exceptionThrown` 采集分支 | `:81-84` |
| `HYDR_MARK`（SSR 节点打标）＋ `Page.addScriptToEvaluateOnNewDocument` | `:1194-1209` / `:1210` |
| `hydrState()` / `hydrHits()` 助手 | `:1211-1221` / `:1222` |
| **K5 臂**（K4 之前置；两通道清零 → 写草稿 → 整页 goto → 复算） | `:1224-1238`（`check(` 行 `:1232`） |
| `§6-Q3 V5` 人工项机器快照 NOTE | `:1237-1238` |
| **K6 臂**（复用 K4 的无草稿跳转） | `:1263-1271`（`check(` 行 `:1267`） |

**K 组之外 39 条与 K1~K4 逐字零改动**（只把原「NOTE-only」的 §1.2③ 采集代码升为 K5）；整单实测总数 **44 → 46 条**。

### 2.3 人工验收（V5，沿用 BUG-10 §6-Q3 的降级口径）

| 项 | 操作 | 期望 |
| --- | --- | --- |
| **V5** | 同一 tab 内**硬刷新** `/projects/new?step=route`（草稿已在） | 「AI 实时访谈」按钮 **`disabled=false`**、三字段预填、**无**「请先回到上一步填写」提示、console 无异常报错 |

探针 `:1237-1238` 已留同口径**机器快照** NOTE（`URL=… button disabled=false`）；**仍按 Q3 不入 `check`**，由实机复认。

---

## §3 回归要求

| # | 回归项 | 命令（仓库根目录） | 判据（2026-10-14 实测） |
| --- | --- | --- | --- |
| **R1** | REQ-14 探针 | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | **`136/136` 通过 / FAIL 0 / exit 0** |
| **R2** | REQ-25 探针 | `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | **`31/31` / FAIL 0 / exit 0** |
| **R3** | BUG-07 / REQ-24 场景（`tmp/verify-phase3.mjs`；前置：dev server `localhost:3000` ＋ Chrome 在 `C:/Program Files/Google/Chrome/Application/chrome.exe`） | `node tmp/verify-phase3.mjs` | A2 / A3 / H1~H3 / K1~K4 / **K5 / K6 全绿**；整单 **44 → 46 条**，5 轮中 **1 轮 46/46 满分**，其余轮的 FAIL **全部**落在既有抖动臂 G / J3。 **终验（放行后复跑，2026-10-14）**：**45/46** —— 唯一 FAIL = **J3**（G 臂本轮未触发）；**K4 / K5 / K6 全 PASS** ⇒ 依 §6-Q2 裁决**通过**；日志 `tmp/_BUG16_final_R3.log`（不入库） |
| **R4** | 静态门 | `npx tsc --noEmit`；`npx eslint <改动文件>` | 均 exit 0 |

**既有抖动登记（不在本单修复面内、不得据此改 `src`）**：`G` 臂 = `route-chooser.tsx:184` 的 `router.push` 建出项目后未落地 / 响应体未被探针及时捕获（`id=null`，落点其实已是 `/projects/{id}/interview`）；`J3` 臂 = 读「返回上一步」控件时控件为 `null`、落地仍 `/projects/new`。5 轮中出现 3 次、**未伴随白屏 / 无 4xx-5xx**，属**探针侧竞态**（探针自身已注「G 段未跳转（已知抖动）」，且有 H8 / H9 兜底）；**同族现象在 BUG-10 轮留存日志 `tmp/_BUG10_R3.log` 中已存在**（43/44、FAIL J3）⇒ 与本次改动**无因果**。已在 `docs/需求登记表.md` §三 BUG-15 补一行实测实例、§5.2 补交叉条；**是否收窄为「探针侧竞态」或并入 BUG-15，待总管裁决**。**裁决（2026-10-14，§6-Q2 取 A）**：**只登记、不修**；**探针修复单暂不立号**，等本条闭环后视噪声频率再定；R3 除 G / J3 外全绿即视为通过（本次终验即按此判定）。

**口径纪律**：① 既有断言（A2 / A3 / H1~H3 / K1~K4 / K6）**不得**为适配本次改动而改写；② R1 / R2 与本案零交叉，是「未越界」的机器证据；③ 任何一轮 R3 若 **K5 / K6** 变红 ⇒ 立即停手回总管（说明修法论证有误）；④ 既有 G / J3 抖动**不得**记作本单失败、**不得**在本单内「顺手修」。

---

## §4 步骤 / 回滚

| 步 | 动作 | 结果 |
| --- | --- | --- |
| **S0** | 基线取证：`git status --porcelain` 为空（HEAD `b2fb89c`）；诊断探针复现 | 旧码：`异常 1 条` ＋ `标记节点存活=false` ⇒ 问题坐实 |
| **S1** | 落唯一改动（`:3` import ＋ `:45-82` state / effect） | `git diff --numstat` = `23 9` / **2 hunk**（1 文件） |
| **S2** | 静态门：`tsc --noEmit`、`eslint <改动文件>` | 均 exit 0 |
| **S3** | 探针扩两臂（K5 / K6）＋ 补 `exceptionThrown` 通道；复跑 R1 / R2 / R3 | R1 `136/136`、R2 `31/31`、R3 K 组 7 条全绿（1 轮 46/46） |
| **S4** | 灵敏度反证（回退 `src` 跑同一探针）＋ 恢复 | 旧码 K5 红 / K6 绿 ⇒ 非虚绿；恢复后复验 `numstat 23 9` |
| **S5** | §5 文档回写 ＋ commit ＋ push | **已完成**（2026-10-14 提交两笔；**未 push**）；commit hash 回填 **§5-⑧** |

**回滚**：① S1 后回归变红 ⇒ `git checkout -- src/components/new-project/new-project-flow.tsx`（单文件单点）；② 探针改动与实现**同批回退**（不留「断言在、实现无」的中间态）；③ 文档已回写后回滚 ⇒ 登记表 / 本单 / `IMPL_BUG-10` 三处修正同批回退，恢复「Q2 懒初始化形态可」的旧口径与 **v2.20** 版本号。

---

## §5 文档回写清单（已随本批执行；文档面共 3 件）

| # | 文件 | 回写内容 |
| --- | --- | --- |
| ① | `docs/需求登记表.md` | **§三 新增 BUG-16 节**（`:1158`；状态 / 优先级 / 来源 / 现象 / 触发条件 / 根因 / 结构证据 / 修法 / 探针与回归 / 口径更正 / 副作用核查 / 既有抖动 / 边界 / 风险 / 依赖，共 15 条） |
| ② | `docs/需求登记表.md` | **§1.2 总览表 BUG-16 行**（`:139`）＋ **§5.1 编号索引 BUG-16 行**（`:1246`）＋ **§5.2 交叉条**（`:1286`，BUG-16 ↔ BUG-10 ↔ REQ-15 / BUG-15） |
| ③ | `docs/需求登记表.md` | **变更记录 v2.21**（新版本行）＋ 版本行 **v2.20 → v2.21** ＋ 在 v2.20 行尾补 ⑨⑩ **更正注**（④③ 误判 ＋ ⑥ 的 `44/44` 口径无法复现） |
| ④ | `docs/需求登记表.md` | **BUG-10 口径同步**：§三 BUG-10（状态行 `:642` / 探针与回归行 `:650` / 实测修法行 `:651`）＋ §1.2 BUG-10 行（`:119`）标注「形态已由 BUG-16 修订」，**既有事实零改动**；§三 **BUG-15 末条补实测实例**（`:1156`） |
| ⑤ | `docs/tasks/IMPL_BUG-10_分流页返回信息丢失.md` | §1.2-③ 结论行标「**作废**」（附通道原因）；§2.3 落地段补「K5 / K6 ⇒ 46 条」；§6 增 **Q2-后续** 行（改判后置回填）；§4.2 末行补「该情形已实际发生」；文末补**批后追记** |
| ⑥ | `docs/tasks/IMPL_BUG-16_分流页回填改挂载后回填.md` | 本单（S0 取证 → S4 反证 → 文档回写全过程） |
| ⑦ | 其余既有文档（`IMPL_REQ-*` / `IMPL_UI-*` / `docs/系统现状与路线图.md`） | **不动**（与本案零交叉；路线图附表 1 属历史存档，沿用 v2.15 裁决） |
| ⑧ | 本单 / `docs/需求登记表.md` | **commit hash 回填**：**第一笔** commit hash = `<HASH>`（随 §6-Q4 第二笔 `docs: 回填 BUG-16 首笔 commit hash` 落盘） |

---

## §6 开口项（交总管）

**裁决结论回填（2026-10-14，总管放行）**

| # | 裁决 | 结论 | 落地位置 |
| --- | --- | --- | --- |
| **Q1** | 历史口径更正方式 | **取 A** —— 原文保留 ＋ 就地标注作废 / 更正注（与 v2.15 以来惯例一致，审计链完整） | 登记表 v2.20-⑨⑩ ＋ §1.2 / §三 BUG-10 三行；`IMPL_BUG-10` §1.2-③ / §6-Q2-后续 / §4.2 / 文末追记 |
| **Q2** | G / J3 抖动归属 | **取 A** —— 本批只登记不修；**探针修复单暂不立号**（等 BUG-16 闭环后视噪声频率再定）；R3 除 G / J3 外全绿即视为通过 | §3 抖动段 ＋ 登记表 §三 BUG-16 抖动行 / §5.2 |
| **Q3** | 首帧空态一帧 | **取 A** —— 接受（无布局跳动，不值得引入 `useSyncExternalStore` 的复杂度） | §1.2-① 行 ＋ 登记表 §三 BUG-16 风险行 |
| **Q4** | commit 边界 | **取「两笔」（同 BUG-10 先例）** —— ① 主体（`src` 1 ＋ `docs` 3）② `docs: 回填 BUG-16 首笔 commit hash`；message 采建议原文 | 第一笔 hash 由第二笔回填本单 §5-③ 与登记表 v2.21-⑩ / §5.1 行 |

> 本单最终改动面 ＝ **`src` 1 文件 / 2 hunk**（`new-project-flow.tsx`，`numstat 23 9`）＋ **`tmp` 2 文件**（`verify-phase3.mjs` 扩 K5 / K6 两臂；`diag-hydration.mjs` 一次性诊断；**`.gitignore:54` 忽略 ⇒ 不入版本库**）＋ `docs` 3 件（本单 / `IMPL_BUG-10` / `docs/需求登记表.md`，后者新增 24 行、`numstat 30 6`）。**下列 4 行为裁决前的开口项原文（保留存档；裁决结论见上表）。**

| # | 开口项 | 本单取值 | 需裁决的点 |
| --- | --- | --- | --- |
| **Q1** | v2.20-④③ / ⑥ 与 `IMPL_BUG-10` §1.2③ 的**误判**如何处置 | 按「**事实性更正**」处理：历史行**原文保留** ＋ 在 v2.21 与相关行**追加更正注**；`IMPL_BUG-10` 结论行标「作废」 | 若总管主张「历史行零改动」⇒ 回退那两处注（仅保留登记表内注） |
| **Q2** | R3 的 **G / J3 抖动**归属 | 本单**只登记、不修**（§3 末段 ＋ 登记表 §三 BUG-15 / §5.2） | 收窄为「探针侧竞态」（可另出一支探针修复单）还是并入 **BUG-15** 本体；**不得**据此改 `src` |
| **Q3** | 「首帧空态一帧」是否接受 | 本单取「**接受**」（无布局跳动，仅属性 / 配色 / 提示段落在否） | 若不接受 ⇒ 转 §1.1 备选形态 `useSyncExternalStore`，成本另估（须另立任务单） |
| **Q4** | 本批 commit 边界 | **1 个 commit**：`src` 1 文件 ＋ `docs` 3 件（`tmp/` 不入库） | commit message 建议 `fix(new-project): BUG-16 分流步回填改挂载后回填，消除 hydration mismatch`；hash 回填 §5-③ —— **2026-10-14 裁决改判**：**两笔**（主体 ＋ `docs: 回填 BUG-16 首笔 commit hash`），hash 回填锚点增补 **§5-⑧**；本行原文保留 |

> 本单最终改动面 ＝ **`src` 1 文件 / 2 hunk**（`new-project-flow.tsx`，`numstat 23 9`）＋ **`tmp` 2 文件**（`verify-phase3.mjs` 扩 K5 / K6 两臂；`diag-hydration.mjs` 一次性诊断；**`.gitignore:54` 忽略 ⇒ 不入版本库**）＋ `docs` 3 件（本单 / `IMPL_BUG-10` / `docs/需求登记表.md`，后者新增 24 行、`numstat 30 6`）。**已提交**（2026-10-14，按 §6-Q4 出**两笔**：第一笔 = 本单主体 `src` 1 ＋ `docs` 3，hash 见 §5-⑧ / 登记表 v2.21-⑩ / §5.1 行；第二笔 = `docs: 回填 BUG-16 首笔 commit hash`）；**未 push**（放行指令只要求 commit）。
