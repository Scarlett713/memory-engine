# BUG-10 实施任务单 · 分流页「返回上一步」后已填基本信息丢失

> 上游：`docs/需求登记表.md` §三 BUG-10（现 `:637`，**P1**；总管 2026-10-07 裁定立号）＋ §1.2（现 `:117`）／§5.1（现 `:1196`）／§5.2「BUG-10 ↔ BUG-07 ↔ REQ-15 / REQ-16 / REQ-21 / REQ-24」（现 `:1250`）。**本条不出 PRD**（缺陷修复；改动面 = 1 个 `useState` 初值）。
> - **规模**：生产代码 **1 个文件 / 1 处**（`src/components/new-project/new-project-flow.tsx:47`）；`src/lib/**` **0 hunk**（不新增存储函数、不改 `outline-session.ts`）。
> - **前置**：**REQ-15 为存储归属前置**（登记表 §5.1 口径）—— 本单**不私建第二套草稿机制**，只消费既有 `sessionStorage["memory-engine-outline-session"]`（键名权威来源 `src/lib/outline-session.ts:10`）。
> - **行号基线**：2026-10-14 实测，HEAD = `278282d`（`master`）。行号口径 = `[IO.File]::ReadAllLines`（**禁用 `Get-Content`**，PS 5.1 会把无 BOM UTF-8 当 GBK 解码致行号虚高）；改前须复核。**S5 回写后（2026-10-14）登记表锚点位移**：§1.2 → `:118`、§三 → `:638`、§5.1 → `:1199`、§5.2 → `:1253`（同批实测，见变更记录 v2.20-⑦）；引用一律按文本定位。
> - **红线**：不动 `handleBack` / `goToStep` 的落点口径；不动 `persistBasicInfo()`（BUG-07 的守门代码，`:76-94`）；不动 `route-chooser.tsx` / `interview-console.tsx` / `outline-session.ts`。
> - **状态**：**已完成**（2026-10-14，本批 commit `3e3416a`；S0~S4 全绿 —— §1.2 三侧面实测结论见 §1.2 表下、探针计数见 §2.3、§6 三项裁决结论见 §6 表下）。

---

## §0 根因事实（三条 · 只读扫描 2026-10-14，`src` 零改动）

### 0.1 ① 跨路由重挂载 —— 访谈页的「返回上一步」不是 SPA 内换步

访谈页顶栏返回控件是 `next/link`，指向**另一棵路由树**（`src/components/interview/interview-console.tsx:975-982`）：

```tsx
<Link
  href="/projects/new?step=route"
  data-interview-back="route-step"
  className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
>
  <ArrowLeft className="h-4 w-4" />
  返回上一步
</Link>
```

它从 `/projects/[projectId]/interview` 导航到 `/projects/new`，该页是 server component，`initialStep` 由 URL 重新取（`src/app/projects/new/page.tsx:12-13`）：

```tsx
  const { step } = await searchParams;
  return <NewProjectFlow initialStep={step ?? "basic"} />;
```

而 `NewProjectFlow` 的 `step` 用 `useState` 初始化（`new-project-flow.tsx:41-44`，注释自陈「初始步只取一次」）⇒ 跨路由进入即**整棵组件重新挂载**，`step` = `"route"`、`basicInfo` = 初值。

对照：流程内的 header「返回上一步」（`new-project-flow.tsx:110-117` → `handleBack` `:62-68`）走 `goToStep`（`:54-57`）的 `setStep` + `router.replace`，**不卸载组件**，`basicInfo` 保留 —— 即两条「返回上一步」的机制不同（这也是既有断言 `tmp/verify-phase3.mjs` H2/H3 全绿、而本条仍红的原因）。

### 0.2 ② 无读回 —— `basicInfo` 的初值恒为空，全文件没有任何「挂载读回」

```tsx
// L33-37
const EMPTY_BASIC_INFO: BasicInfo = {
  projectName: "",
  intervieweeName: "",
  overview: "",
};

// L45-47
  // 基本信息只走 React state，不下沉 sessionStorage（IMPL §3.4）。
  // 刷新即丢，草稿回填归 REQ-15。
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(EMPTY_BASIC_INFO);
```

全文件 `readOutlineDraftSession` 的**唯一**出现位置是 `persistBasicInfo()` 的 merge（`:76-94`，调用点 `:77`）—— 那是**纯写路径**；`NewProjectFlow` 没有任何「初始化时读回」的代码。

### 0.3 ③ sessionStorage 里其实有值 —— 数据没丢，只是没人读

基本信息在点「下一步」时已落存储（`new-project-flow.tsx:163` → `persistBasicInfo` `:76-94`）：

```tsx
  function persistBasicInfo(next: BasicInfo) {
    const existing = readOutlineDraftSession();
    ...
    const projectName = next.projectName.trim();
    const intervieweeName = next.intervieweeName.trim();
    const notes = next.overview.trim();

    saveOutlineDraftToSession(existing?.outlineMarkdown ?? "", {
      ...existing?.profile,
      ...(projectName ? { projectName } : {}),
      ...(intervieweeName ? { intervieweeName } : {}),
      // IMPL §3.3 裁决：描述信息 → notes；researchFocus 不由基本信息写入。
      ...(notes ? { notes } : {}),
    });
  }
```

落点 = `sessionStorage["memory-engine-outline-session"]` 的 `profile.projectName / intervieweeName / notes`（键名 `outline-session.ts:10`；写 `:146-170`、读 `:174-192`）。字段对应关系：`overview ↔ profile.notes`（`persistBasicInfo` 上引；提纲侧同口径见 `outline-plan-workspace.tsx:380-387`）。

### 0.4 三条合并后的失效链（分流页按钮变灰的直接来源）

| 步 | 事实 | 锚点 |
| --- | --- | --- |
| 1 | 跨路由重挂载 ⇒ `basicInfo` 回到 `EMPTY_BASIC_INFO` | `interview-console.tsx:975-982` → `app/projects/new/page.tsx:12-13` → `new-project-flow.tsx:42-47` |
| 2 | 空 state 经 props 下传分流页（**不经 context、不经 sessionStorage**） | `new-project-flow.tsx:195-198`；`route-chooser.tsx:16-21` 注释 |
| 3 | `hasBasicInfo` 判假 ⇒ `disabled` 为真 ＋ 出现空态提示 | `route-chooser.tsx:131-133`、`:211`、`:246-250` |
| 4 | 且流程内**无法**从 route 退回 basic（header 回退是 route → outline）⇒ 用户在分流页没有自愈路径 | `new-project-flow.tsx:67` |
| 5 | 提纲步初值同样来自空 state（`initialTopic` / `initialSubject` / `initialOverview`） | `new-project-flow.tsx:177-181` → `outline-plan-workspace.tsx:117-121` |

---

## §1 改动清单（唯一文件 · 唯一改动点）

### 1.1 `src/components/new-project/new-project-flow.tsx:47`（**唯一生产改动**）

**现状（L45-47，逐字）**

```tsx
  // 基本信息只走 React state，不下沉 sessionStorage（IMPL §3.4）。
  // 刷新即丢，草稿回填归 REQ-15。
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(EMPTY_BASIC_INFO);
```

**改法（懒初始化函数形式；三字段全部回填，`overview ← profile.notes`）**

```tsx
  // 基本信息只走 React state；但挂载时从既有草稿读回一次（BUG-10）：
  // 访谈页「返回上一步」是跨路由导航（/projects/new?step=route），组件会整棵重挂载，
  // 不读回就退回 EMPTY_BASIC_INFO ⇒ 分流页「AI 实时访谈」变灰。
  // 懒初始化函数：整个挂载周期只跑一次；SSR 下 readOutlineDraftSession() 返回 null。
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(() => {
    const profile = readOutlineDraftSession()?.profile;

    if (!profile) {
      return EMPTY_BASIC_INFO;
    }

    return {
      projectName: profile.projectName,
      intervieweeName: profile.intervieweeName,
      overview: profile.notes,
    };
  });
```

**约束与自检**

| # | 项 | 判据 |
| --- | --- | --- |
| ① | 只改 `:47` 一处；`readOutlineDraftSession` 已在 `:14` import（**无需新增 import**）、`EMPTY_BASIC_INFO` 已在 `:33-37` 定义（**无需新增常量**） | `git diff --stat` 恰 1 个生产文件；hunk 只覆盖 `:45-47` 区块 |
| ② | `persistBasicInfo()`（`:76-94`）**0 hunk** | BUG-07 守门代码未被触碰 |
| ③ | `handleBack`（`:62-68`）/ `goToStep`（`:54-57`）/ header 文案（`:116`）**0 hunk** | H1 / H2 / H3 的落点与文案口径不变 |
| ④ | `src/lib/**` **0 hunk** | 不新增存储函数；不对 `outline-session.ts` 做任何扩展 |

### 1.2 副作用核查（**必须实测**，非「顺带修」）

懒初始化会改变**一切 `/projects/new*` 冷启动**的初值（不再只是 `?step=route`），由此产生三处须在实施轮实测并回报的侧面：

| # | 侧面 | 事实 | 受影响断言 / 行为 |
| --- | --- | --- | --- |
| ① | **提纲步自动生成会被提前触发** | `outline-plan-workspace.tsx:179-204`：`embedded && initialTopic && initialSubject` 即在挂载 600ms 后自动 `POST /api/outline/generate`。回填后，`?step=outline` 冷启动或 route → outline 回退**都会**变成「有初值」⇒ 从「不自动生成」变为「自动生成」 | `tmp/verify-phase3.mjs` H4（`:537-572`）本就在「有初值」路径上；但 **H3**（`:505-535`）终点是 `?step=outline`，回填后会在该步触发自动生成（当前不会）⇒ 须实测 H3 是否仍绿（其断言只比 `profile` 三字段，**预期不受影响，但属行为变化，须记录**）。**另**：`outline-plan-workspace` 的 `markdown` state 初值恒为 `""`（`:123`，不读草稿）⇒ 自动生成可能覆盖既有草稿全文，**须由总管裁决是否接受**（见 §6-Q1） |
| ② | 冷启动「初值为空」类断言 | `tmp/verify-phase3.mjs:153-156` A2「旧路由冷启动：提纲步初值为空」。该断言运行在**刚登录、sessionStorage 为空**时（`:139-145`，无前置写入）⇒ 懒初始化返回 `EMPTY_BASIC_INFO`，**预期仍绿**；但这是**唯一**依赖「无草稿时初值空」的断言，须列入守门 | 该断言**不得为适配本改动而修改**；若它变红 ⇒ 立即停手回总管（说明 §0 论证有误） |
| ③ | Hydration | `NewProjectFlow` 是 client component，仍参与 SSR。SSR 期 `readOutlineDraftSession()` 因 `typeof window === "undefined"` 返回 `null`（`outline-session.ts:174-177`）⇒ 服务端输出 `disabled` 为真的标记；客户端 hydration 读到草稿后 `hasBasicInfo` 为真 ⇒ `#route-chooser-realtime` 的 `disabled` 属性两侧不一致 | React 会补丁修正并可能打印 hydration 不一致告警。**须实测**：草稿在时直开 `?step=route`，检查（a）浏览器 Console 是否有 hydration 告警、（b）按钮最终为可点。若告警存在且总管不接受 ⇒ 见 §6-Q2（换后置回填形态，需另裁决，**不属本单**） |

**实测结论（2026-10-14 实施轮，原始日志 `tmp/_BUG10_R3.log`）**

| # | 侧面 | 实测 | 结论 |
| --- | --- | --- | --- |
| ① | 提纲步自动生成（软导航臂：分流步 → header 返回 → 提纲步） | 自动生成信号 = `generating`（**原码对照 = 「6s 内无」**） | **行为确有变化、已如实记录**：该路径 `markdown` 初值恒 `""`（`outline-plan-workspace.tsx:123`）、自动生成只 `setMarkdown` **不写 `sessionStorage`** ⇒ 既有草稿不被覆盖；**H3（现 label「R2 返回 3/3」，`tmp/verify-phase3.mjs:541`）仍 PASS**（其断言只比 `profile` 三字段）⇒ 与上表预期一致 |
| ①′ | **冷启动臂（Q1=B 的直接效果，实施轮追加）** | 有草稿硬加载 `?step=outline` ⇒ 自动生成信号 = 「6s 内无」、`#outline-topic=""` | ✅ 范围收窄生效：提纲步**冷启动不**回填、**不**触发自动生成 |
| ② | 冷启动「初值为空」类断言（A2，`:153-156`） | `A2 旧路由冷启动` **PASS**（R3 整单 44/44 两轮） | ✅ A2 **零改动**（既有 39 条逐字未动）⇒ 未出现「§0 论证有误」信号 |
| ③ | Hydration | 有草稿直开 `?step=route`：console 条目 2 ／ hydration 相关 **0**；`#route-chooser-realtime` 最终 `disabled=false` | ✅ **无 hydration 告警** ⇒ **Q2 懒初始化形态可**（无需转后置 `useEffect` 回填） |

---

## §2 验收口径

**命题**：*访谈页返回分流页后，课题名称 / 受访者姓名自动回填，按钮可点。*

### 2.1 复现路径（人工 / 实机）

| # | 操作 | 期望 |
| --- | --- | --- |
| 1 | 登录 → 首页「新建访谈」→ `/projects/new` | 基本信息步 |
| 2 | 填「访谈主题」「受访对象」「详细介绍」→ 点 `[data-step-next="outline"]` | 落提纲步（初值 = 刚填的三项） |
| 3 | 生成或点「跳过」→ 落分流步 | `#new-step-route` |
| 4 | 点 `#route-chooser-realtime`（有提纲时直接建项目） | 落 `/projects/{id}/interview` |
| 5 | 点顶栏 `[data-interview-back="route-step"]` | 落 `/projects/new?step=route` |
| 6 | 观察分流页 | **①`#route-chooser-realtime` 可点（非灰）；② 不再出现「AI 实时访谈需要访谈主题与受访者姓名，请先回到上一步填写。」** |

### 2.2 断言（机器口径；沿用 `tmp/verify-phase3.mjs` 的 `__p3` 助手与 CDP 风格）

| # | 断言 | 判据 |
| --- | --- | --- |
| **V1** | 落点 | `location.pathname + location.search === "/projects/new?step=route"` |
| **V2** | **按钮可点（主断言）** | `document.querySelector('#route-chooser-realtime').disabled === false` |
| **V3** | 空态提示消失 | 页面内**不存在**含「AI 实时访谈需要访谈主题与受访者姓名」的文本节点 |
| **V4** | **两项回填（主断言，可观测形式）** | 点 header 返回 → `?step=outline`：`#outline-topic === 课题名称` 且 `#outline-subject === 受访者姓名`（第三项对照：`#outline-overview === 详细介绍`） |
| **V5** | 同 tab 硬刷新等价 | 在 `?step=route` 原地重载（草稿在）后，V2 / V3 仍成立 |
| **V6** | **反证（灵敏度）** | 清空 `sessionStorage["memory-engine-outline-session"]` 后直开 `?step=route` ⇒ V2 变红（`disabled === true`）—— 证明 V2 由草稿回填驱动，而非其它副作用 |

> 说明（数据事实）：分流步**不渲染** `#projectName` / `#intervieweeName`（基本信息表单仅 `step === "basic"` 时挂载，`new-project-flow.tsx:157-168`），故「两项是否回填」在分流步的**唯一直接可观测形式**是 V2（`hasBasicInfo` 就是这两项的布尔），V4 是同一 state 在提纲步的文字证据。若需在基本信息步直读，可追加：header 连按两次（route → outline → basic）后断言 `#projectName` / `#intervieweeName` 有值。

### 2.3 探针落点（与 §3 联动）

优先**扩展** `tmp/verify-phase3.mjs` 的 H 段（该段即「返回导航」面的既有归属：H1 / H2 / H3 已锁三条返回落点，H6 / H7 已锁 outline-required 弹窗），新增 **1 组（V1 ~ V4 ＋ V6 反证）**；**不另立新探针文件**（避免第二份文档事实源）。V5 若与 H 段既有导航序列冲突，可降级为人工验收项并在 §5 记录。

**落地（2026-10-14）**：已在 H 段之后新增 **K 组 5 条** —— `K1`（V1 ＋ V2 ＋ 草稿在场）、`K2`（V3）、`K3`（V4，提纲步三字段）、`K3b`（V4 直读形态，按 §2.2 说明段允许项直读 `#projectName` / `#intervieweeName` / `#overview`）、`K4`（V6 反证），落点 `tmp/verify-phase3.mjs:1066` / `:1075` / `:1112` / `:1144` / `:1199`（`check(` 行，2026-10-14 实测；追加后行号会位移，**引用按 label 定位**）；`tmp/verify-phase3.mjs` 实测总数 **39 → 44 条**（**K 组之外 39 条逐字零改动**）。**V5（Q3）降级人工项**：探针内只留 `§6-Q3 V5（同 tab 硬刷新，人工项）机器快照` 的 NOTE，**不入 `check`**。**导航守卫硬化**：新增助手 `clickBackUntil`，其判定基准由 `location.search` 改为渲染锚点 `#new-step-*`（根因：`goToStep` 的 `setStep` 是紧急更新、`router.replace` 是过渡更新，过渡未提交时 **URL 旧 / DOM 新** ⇒ 用 URL 当守卫会重复点击、多退一格）。**计数口径更正**：S0 表所写「`verify-phase3 24/24`」为探针**早期版本**口径（此后已被 REQ-24 / R7 / 问题 A-B 等单扩展至 39），本单按落地后的 **44** 记。

---

## §3 回归要求（三项基线一律不得回退）

| # | 回归项 | 命令（仓库根目录执行） | 判据 |
| --- | --- | --- | --- |
| **R1** | **REQ-14 探针（136 / 136）** | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | 末行 `REQ-14 prompt 验收：136/136 通过`、**FAIL 0**、**exit 0**（本案 0 hunk 触及 `writing-rules.ts` / 该探针文件，回退即视为越界） |
| **R2** | **REQ-25 探针（31 / 31）** | `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | **31 / 31 全 PASS / FAIL 0 / exit 0**（本案 0 hunk 触及 `project-export.ts` 与导出面板） |
| **R3** | **BUG-07 场景不回归** | `node tmp/verify-phase3.mjs`（**前置**：dev server 在 `localhost:3000`、Chrome 在 `C:/Program Files/Google/Chrome/Application/chrome.exe`；见脚本 `:1-13`） | ① **A2**（`:155-156`）「旧路由冷启动：提纲步初值为空」**仍 PASS**；② **A3**（`:171-176`）「冷启动直达提纲步，跳过提纲后画像字段未被空值覆盖」**仍 PASS**；③ **H1 / H2 / H3**（`:471-535`）三条返回断言**仍 PASS**；④ 整体**满额通过**（脚本末行 `results.length - failed.length / results.length`，基线 24），**FAIL 0 / exit 0** |

**R4 静态检查**：`npx tsc --noEmit` → 0 error；`npx eslint src` → **不新增**告警 / 错误（改前先跑一次记基线）。

**口径纪律（逐条遵守）**

1. **R3 的既有断言一律零改动**：本单只允许**追加** §2.3 的新断言；既有断言（尤其 A2 / A3 / H1 ~ H3）**不得**为适配改动而改写 —— 变红即回退实现、回总管。
2. **R1 / R2 与本案零交叉**，是「未越界」的机器证据；一旦回退 ⇒ 直接判定实现越界（改到了本单 §1.1 之外的文件）。
3. 若 §1.2-① 在实测中造成 **H3 / H4 行为位移**，须在实施轮**如实记录**，不得静默 —— 是否接受由总管裁决（§6-Q1）。

---

## §4 步骤 / 回滚

### 4.1 实施步骤

| 步 | 动作 | 产物 / 判据 |
| --- | --- | --- |
| **S0** | 基线取证（**改前**）：`git status --porcelain` 为空；跑 R1 / R2 / R3 各一次并留全文 | 基线 = `136/136`、`31/31`、`verify-phase3 24/24`（任一不为满 ⇒ 停手，先定性） |
| **S1** | 落 §1.1 唯一 hunk（`new-project-flow.tsx:47`，懒初始化 ＋ 注释标注 BUG-10） | `git diff --stat` 恰 **1 file**；hunk 只覆盖 `:45-47` |
| **S2** | R4 静态检查：`npx tsc --noEmit`；`npx eslint src` | 0 error / 不新增告警 |
| **S3** | 补 §2.3 探针（**仅追加**）；复跑 R1 / R2 / R3 | R1 `136/136`、R2 `31/31`、R3 基线 ＋ 新增（满额）、FAIL 0 / exit 0 |
| **S4** | §2.1 人工验收 ＋ §1.2 三侧面实测（尤其 ③ hydration 告警） | 按 §2.2 V1 ~ V6 逐条留证；§1.2 三行逐行回报 |
| **S5** | §5 文档回写（同批）＋ commit | 回写清单逐行核销；commit message 含 `BUG-10`，并把 commit hash 回填 §5 |

### 4.2 回滚

| 情形 | 动作 |
| --- | --- |
| S1 后任一回归项变红 | `git checkout -- src/components/new-project/new-project-flow.tsx`（**单文件单点**，回滚即恢复 `useState<BasicInfo>(EMPTY_BASIC_INFO)` 原状），然后回总管对话 |
| 探针已追加后回滚 | 探针改动与实现**同批回退**（`git checkout -- tmp/verify-phase3.mjs`）；**不得**留「断言在、实现无」的中间态 |
| 文档已回写后回滚 | 登记表 / 本单同批回退，恢复登记表原状态「**待实施**（代码侧根因待定性）」 |
| §1.2-③ hydration 告警不可接受 | 本单方案作废，转 §6-Q2 由总管重新裁决形态 |

> 回滚粒度 = **1 文件 1 hunk**，不存在跨文件级联 —— 这也是本单把存储扩展（`src/lib/**`）排除在外的直接原因。

---

## §5 文档回写清单（落地后同批执行；**本单出稿阶段一律不动**）

| # | 文件 | 位置（2026-10-14 实测锚点） | 回写内容 |
| --- | --- | --- | --- |
| ① | `docs/需求登记表.md` | §三 BUG-10（标题 `:637`，状态行 `:639`：现「**状态**：**待实施**（代码侧根因待定性）· 编号复用：原 BUG-10「AI 超时」已关闭」） | 状态 →「**已完成**（日期，`commit`）」；**补三条根因事实**（跨路由重挂载 / 无读回 / 存储有值，含本单 §0 锚点）；「修法方向」段 → 实测修法（`new-project-flow.tsx` 懒初始化读回，**1 文件 1 hunk**）；「现象（待补）」→ 固化复现路径（本单 §2.1） |
| ② | `docs/需求登记表.md` | §1.2 总览表 BUG-10 行（现 `:117`）＋ §5.1 编号索引 BUG-10 行（现 `:1196`） | 两处状态同步为「**已完成**（日期，`commit`）」；优先级 / 实施序（若列）同步 |
| ③ | `docs/需求登记表.md` | §5.2 横切条「BUG-10 ↔ BUG-07 ↔ REQ-15 / REQ-16 / REQ-21 / REQ-24」（现 `:1250`） | 补「**BUG-10 已落地**：回填走既有草稿（`outline-session.ts` 既有 API，`src/lib/**` 0 hunk）；`persistBasicInfo` 的 BUG-07 守门未动；REQ-14 / REQ-25 探针零回退」 |
| ④ | `docs/需求登记表.md` | 变更记录（文件头版本行现 `:3`） | 新增版本条目（下一可用版本号 **v2.20**）：本批性质（生产 **1 文件 / 1 hunk** ＋ 探针 1 文件追加 ＋ 2 文档回写）、R1 `136/136` / R2 `31/31` / R3 满额、commit hash；**行号锚点按 `[IO.File]::ReadAllLines` 重新实测**（不套用本单历史值） |
| ⑤ | `docs/tasks/IMPL_BUG-10_分流页返回信息丢失.md`（本单） | 顶部「**状态**」块 | →「**已完成**（日期，`commit`）」；§1.2 三侧面回填**实测结论**（含 hydration 是否有告警）；§2.3 写回**新增断言条数**与 `verify-phase3` 实测总数；§6 三项裁决结论回填 |
| ⑥ | `docs/系统现状与路线图.md` | 附表 1（历史存档） | **不动** —— 参考 v2.15 裁决「附表属历史存档性质、不追改」；若总管要求追列，**另批**处理 |
| ⑦ | `docs/PRD_REQ-21_新建流程统一.md` / `docs/IMPL_REQ-16_首页与新建流程重构.md` §9.4 | 草稿 / 回填口径段 | **仅在**本单实现改变其书面口径时才改；预计 **0 hunk**（本单未改步骤、未改存储归属、未改 `persistBasicInfo`） |

---

## §6 待总管裁决（**开工前**）

| # | 开口项 | 本单取值 | 需裁决的点 |
| --- | --- | --- | --- |
| **Q1** | 回填范围 vs 提纲步自动生成（§1.2-①） | 本单按指示取「**无条件懒初始化**」（任意 `/projects/new*` 冷启动都回填） | 回填使 `?step=outline` 冷启动也带初值 ⇒ 触发 `outline-plan-workspace.tsx:179-204` 的 600ms 自动生成，而该组件 `markdown` 初值恒为 `""`（`:123`）⇒ **可能覆盖既有草稿提纲全文**。二选一：**(A)** 接受（记为已知行为变化）；**(B)** 收窄为「仅 `initialStep === "route"` 时回填」（更贴本条现象、不动提纲步路径；需在 §1.1 的初值函数内增一个步值判断 ⇒ 仍是**同一 hunk**） |
| **Q2** | Hydration 形态（§1.2-③） | 本单取「懒初始化」形态（总管指示的形式） | 若实测出现 hydration 不一致告警且不接受 ⇒ 需换「后置回填」形态（`useEffect` 内 `setBasicInfo`），但那**不是懒初始化**、且会多一帧空态闪烁 ⇒ 须总管重新裁决 |
| **Q3** | 是否把 §2.2 的 V5（同 tab 硬刷新）纳入机器断言 | 本单列为**可选** | V5 需在同一 tab 内重载并保持草稿，与 H 段既有导航序列可能相互干扰；取舍由总管定 |

**裁决结论回填（2026-10-14，三项均由总管放行后落地）**

| # | 裁决 | 结论 | 落地证据 |
| --- | --- | --- | --- |
| **Q1** | 回填范围 vs 提纲步自动生成 | **取 B** —— 仅 `initialStep === "route"` 回填（同 hunk 内加 `typeof window !== "undefined"` 守门） | 代码 `new-project-flow.tsx:53`；提纲步**冷启动**臂实测无自动生成（§1.2-①′）；软导航臂的生成行为变化已如实记入 §1.2-① |
| **Q2** | Hydration 形态 | **保持懒初始化**（不转后置 `useEffect` 回填） | 有草稿直开 `?step=route` 实测 **无 hydration 告警**、按钮最终可点（§1.2-③） |
| **Q3** | V5 是否纳入机器断言 | **不纳入**，降级人工验收项 | 探针内只留机器快照 NOTE；人工项 ＝ 同 tab 硬刷新 `?step=route` 后按钮 `disabled=false`（机器快照已吻合，待实机复认） |

> 本单最终改动面 ＝ **`src` 1 文件 / 1 hunk**（`new-project-flow.tsx:46-68`，懒初始化 ＋ 注释块）＋ **`tmp/verify-phase3.mjs` 追加**（K 组 5 条；**`tmp/` 已由 `.gitignore:54` 忽略 ⇒ 不入版本库**）＋ `docs/需求登记表.md` 四处与任务单回写；§6 三项裁决结论见上表，落地结果见 §5 回写与变更记录 **v2.20**。
