# BUG-12 实施任务单 · API 兜底 catch 脱敏（三处同型落点改固定人话）

> 上游：`docs/需求登记表.md` §三 BUG-12（现 `:678`，**P3**；总管 2026-10-08 裁定立号；v2.22 已补登「落点 3 处 ＋ 根因已定性 ＋ 修法方向已定点」）＋ §1.2（`:122`）／§5.1（`:1234`）／§5.2（`:1289`、`:1290`）。**本条不出 PRD**（缺陷修复：3 个 route 的 catch 块话术分层）。
> - **规模**：生产代码 **3 文件 / 6 hunk** —— ① `projects/route.ts`：`:15` import ＋ `:159` 内层校验 catch ＋ `:189-194` 外层兜底；② `ask/route.ts`：`:38` 内层 `request.json()` catch ＋ `:75-79` 外层兜底；③ `process/route.ts`：`:43-47` 外层兜底（无内层）。`src/lib/**` / `src/store/**` / `src/components/**` **0 hunk**。
> - **前置 / 红线**：`src/lib/server/upload-store.ts` **0 hunk**（BUG-11 铁律：100MB 阈值与文案须与前端预检同批）；`src/lib/server/process-project.ts` **0 hunk**（本单派工口径 —— 落库面另议，§6-Q1）；`[projectId]/interview/audio/route.ts:90-101` 的校验类原话直出**刻意保留**（登记表已定点，不在修复面）；`src/store/project-workspace.ts:112-113` 前端透传**不加过滤**（服务端单一真值来源）。
> - **行号基线**：2026-10-14 实测，HEAD = `61f3873`（`master` = `origin/master`）。行号口径 ＝ `[IO.File]::ReadAllLines` ／ `Get-ChildItem | Select-String`；**禁用 `Get-Content`**（PS 5.1 把无 BOM UTF-8 当 GBK 解码 → 行号虚高）；**含 `[projectId]` 的路径必须用 `-LiteralPath` 或 `Get-ChildItem` 管道**（`-Path` 会把方括号当通配符、静默失配）；改前须复核。
> - **状态**：**待实施**（登记表 §三 BUG-12 状态 ＝「待实施（下轮统一处理）」；本单把已定点的修法展开为可执行 diff ＋ D 组断言）。
> - **回传口径（沿 BUG-16 · 总管 2026-10-14 定）**：回传聊天窗口**只给三段** —— ① 结论表（commit hash / 行号 / 状态）② 待裁决项 ③ 异常（若有）；过程细节（`numstat` / 编码与行尾核验 / 逐轮日志归属等）留在本单。

---

## §0 机理与取证（2026-10-14；只读核实，`src` 零改动）

### 0.1 现象与传播链（三处落点 ＋ 一处落库面）

| # | 落点（现写法，行号 = HEAD `61f3873`） | 外层兜底串 | `throw` 的实测来源（源码逐条核过） | 前端承接点 |
| --- | --- | --- | --- | --- |
| ① | `src/app/api/projects/route.ts:189-194`<br>`const message = error instanceof Error ? error.message : "上传失败，请稍后重试。";` | 上传失败，请稍后重试。 | 入参校验 3 条中文串（`upload-store.ts:48`／`:52`／`:59`，经 `:159 saveInterviewAudio`）＋ fs 层（`writeFile` → `EACCES` / `ENOSPC` / `ENOENT` / **绝对路径**）＋ `:160 createProject` → `project-store.ts:188`「项目存储文件损坏，已保留隔离副本，本次写入已中止。」 | `store/project-workspace.ts:112-113`（`throw new Error(result.message)`，**无过滤**）→ `interview-upload-form.tsx:660` |
| ② | `src/app/api/projects/[projectId]/ask/route.ts:75-79`<br>`… : "问答失败，请稍后重试。";` | 问答失败，请稍后重试。 | `:38 (await request.json())` 解析异常（undici / V8 英文原文）＋ `:70 getLlmProvider().askQuestion()` → `ark-llm-provider.ts:26`「Missing environment variable … for Ark LLM.」／`:302`「Ark LLM request failed: {HTTP 响应体}」 | `project-qa-panel.tsx:48`（`payload.message ?? …`）＋ `:55` |
| ③ | `src/app/api/projects/[projectId]/process/route.ts:43-47`<br>`… : "处理失败，请稍后重试。";` | 处理失败，请稍后重试。 | `:38 processProject()` → `xfyun-transcription-provider.ts:14`「缺少讯飞转写配置：XFYUN_APP_ID」／`:139`／`:180`／`volcengine-transcription-provider.ts:21`／`:155` ＋ `process-project.ts:207`「处理结果写入失败。」＋ `project-store.ts:188` | `project-processing-console.tsx:936` ＋ `:952` |

- **同型第 4 面（落库，**不在本单修复面**）**：`process-project.ts:212-213` 用同一写法取 `message` → `:216 lastProcessingError: message`（由 `:232 throw new Error(message)` 再把同一串抛给 route）⇒ 同一内部串会**随项目记录持久化**，并由 `project-processing-console.tsx:1082-1084`（`{error || currentProject.lastProcessingError}`）显示。本单口径：**`process-project.ts` 不动**（§6-Q1）。
- **刻意保留面**：`[projectId]/interview/audio/route.ts:90-101`（`"录音文件校验未通过。"` 兜底的原话直出，回 400）。

### 0.2 只读取证（全 `src` 扫描，2026-10-14）

- `instanceof Error` 全量命中 **18 处**（`Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String "instanceof Error"`；**服务端 6 / 客户端 12**）：
  - **本条修复面 3 处**：`projects/route.ts:191`、`ask/route.ts:77`、`process/route.ts:45`。
  - **刻意保留 1 处**：`[projectId]/interview/audio/route.ts:97`（回 400 的校验类原话，登记表已定点「不在修复面」）。
  - **落库面 1 处**：`process-project.ts:213`（本单不动，§6-Q1）。
  - **值比较 1 处（非话术透传）**：`auth/register/route.ts:62`（`err.message === 'EMAIL_EXISTS'` 的判定；`user-store.ts:72` 抛该常量）。
  - **客户端本地兜底 12 处**（不经手服务端串，**不在本条面**）：`project-workspace.ts:74`／`:126`、`interview-console.tsx:853`／`:935`、`project-processing-console.tsx:835`／`:869`／`:907`／`:952`、`project-qa-panel.tsx:55`、`project-export-panel.tsx:108`、`interview-upload-form.tsx:660`、`recent-project-list.tsx:62`。
- **对照面（同一仓库另一种取向）**：常量式固定人话兜底 **11 处 / 8 支 route**（清单见登记表 §三 BUG-12 对照面行）；其中 `[projectId]/interview/audio/route.ts:122-127` 为**形态样板** —— 无参 `catch {` ＋ 常量串 ＋ 行内注释「不回显内部 error.message，避免泄漏路径与堆栈」。
- **本单可用的注入点（实测可复现、不触网）**：`getLlmProvider()` 在无 `LLM_API_KEY` 时回落 mock（`providers/llm/index.ts:5-17`）；`mock-llm-provider.ts:124` 的 `#fail` 人为失败开关**只作用于 outline chat**，`askQuestion`（`:244-255`）无失败钩子 ⇒ ② 的服务端 500 路径**只能静态断言**（D2），运行臂由 ③ 证明同型结论（D7）。转写侧在缺 `XFYUN_APP_ID` 时抛 `xfyun-transcription-provider.ts:14` 的缺配置串 ⇒ ③ 的失败臂**可离线、确定性**复现。

### 0.3 为什么「有 fallback 也不安全」（根因的机器解释）

三元表达式语义：固定人话**只在异常不是 `Error` 实例时**生效；而 `saveInterviewAudio` / provider 层 / fs 层 / `JSON.parse` 抛出的**全是 `Error` 实例** ⇒ 三条固定人话在这条路径上**不可达**，「兜底」实为「直通」。⇒ 本条不是「补一个 fallback」（补了也不生效），而是**去掉 `error.message` 这一支**（无参 `catch`）＋ 按「入参校验类 ↔ 实现异常」**分层**（§1.2／§1.3）。

### 0.4 硬边界（禁改清单）

| # | 禁改面 | 依据 |
| --- | --- | --- |
| ① | `src/lib/server/upload-store.ts`（整文件：阈值 `:51-52`、文案 `:48`／`:52`／`:59`） | BUG-11 铁律 —— 其阈值与文案须与前端预检 `interview-upload-form.tsx:48-51` 同批 |
| ② | `src/lib/server/process-project.ts`（整文件，含 `:212-213`／`:216`／`:232`） | 本单派工口径；落库面处置见 §6-Q1 |
| ③ | `[projectId]/interview/audio/route.ts`（整文件：`:90-101` 与 `:122-127` **两者都保留**） | 登记表已定点「刻意保留」，不在本条修复面 |
| ④ | `src/store/project-workspace.ts`（`:112-113` 透传不过滤） | 过滤放服务端，保持单一真值来源 |
| ⑤ | 三个 route 的业务分支：401／404／403、`projects` 的 400 校验串与 201 成功体、`ask` 的 `{ answer }`、`process` 的 `{ project }` | 本条只动 catch 块 |
| ⑥ | `src/components/**`（含 `project-qa-panel.tsx:48`／`:55`、`project-processing-console.tsx:936`／`:952`） | 前端兜底话术不在本条面 |
| ⑦ | 另有 11 处常量式固定人话 route（8 支文件） | 登记表对照面行；**不在本条面** |
| ⑧ | `next.config.ts` / `src/proxy.ts` / `src/lib/server/project-store.ts`（含 `:188` 文案） | 分别属 BUG-11 面与存储层，避免混批 |

### 0.5 编码 / 行尾 / 行号口径（2026-10-14 实测）

| 文件 | BOM | 行尾 | 行数 |
| --- | --- | --- | --- |
| `src/app/api/projects/route.ts` | 无 | 纯 LF（CRLF=0） | 195 |
| `src/app/api/projects/[projectId]/ask/route.ts` | 无 | 纯 LF | 81 |
| `src/app/api/projects/[projectId]/process/route.ts` | 无 | 纯 LF | 49 |
| `src/lib/server/process-project.ts`（只读参照） | 无 | 纯 LF | 234 |
| `src/lib/server/upload-store.ts`（只读参照） | **有 BOM** | 76 处 LF ＋ 1 处 CRLF | 77 |
| `docs/**`（含本单） | 无 | 全 CRLF | — |

**口径纪律**：① `src/**` **禁止**把 `\n` 归一为 `\r\n`（三个目标文件均为纯 LF，改后须复验 `CRLF=0`）；② `docs/**` 保持 **CRLF ＋ 无 BOM**；③ 行号按 §0.1 口径实测；改动后 `:189-194` 会因 `:15` import 与 `:159` 内层 catch 而**整体下移**（具体位移量以实施轮实测为准），回写登记表时须重测而不是沿用本单数字。

---

## §1 修法与副作用

> 统一形状 ＝ `[projectId]/interview/audio/route.ts:122-127`（无参 `catch {` ＋ 常量人话 ＋ 行内注释）；统一口径 ＝ 登记表 §三 BUG-12「修法方向（定点：走 ① —— 兜底改固定人话）」。

### 1.1 落点 ① `src/app/api/projects/route.ts`（3 hunk）

**A. 外层兜底（`:189-194` 改后）**

```ts
  } catch {
    // 不回显内部 error.message：写盘 / 存储层异常串可能含绝对路径与系统错误码
    // （EACCES / ENOSPC 等）。形状对齐 [projectId]/interview/audio/route.ts:122-127。
    return NextResponse.json(
      { message: "上传失败，请稍后重试。" },
      { status: 500 },
    );
  }
```

**B. 内层校验 catch（新增，包住 `:159 saveInterviewAudio`；`const savedAudio` 一行改为 `let` 声明）**

```ts
    let savedAudio: SavedInterviewAudio;

    try {
      savedAudio = await saveInterviewAudio(audio);
    } catch (error) {
      // 这里的 throw 全是入参校验（空文件 / 超 100MB / 非音频格式）：原话直出回 400，
      // 与 audio 路由 :86-101 同形同码。已知取舍同其注释：writeFile 失败也会落到这里
      // （区分它须改 upload-store.ts，而那是 BUG-11 铁律不动的文件）。
      return NextResponse.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "音频文件校验未通过，请重新选择。",
        },
        { status: 400 },
      );
    }
```

**C. import（`:15` 改后）**

```ts
import {
  saveInterviewAudio,
  type SavedInterviewAudio,
} from "@/lib/server/upload-store";
```

（与 `audio/route.ts:8-11` 逐字同形；**只改 import 语句，`upload-store.ts` 本体 0 hunk**。）
> 备选（未采纳）：`let savedAudio: Awaited<ReturnType<typeof saveInterviewAudio>>;` 可省掉 C，但形态与 audio 路由不一致 ⇒ 取 C（多 1 hunk，换取「三处形状同源」的可审查性）。
> 两点实现细节：① `let savedAudio: SavedInterviewAudio;` ＋ try 内赋值 ＋ catch 必 `return` ⇒ TS 明确赋值分析通过，`:161-165` 的四处 `savedAudio.*` 无需改动；② 内层兜底串「音频文件校验未通过，请重新选择。」是**新常量**（不在登记表对照面的 11 处清单内）—— 它只在「抛出非 `Error`」这种理论路径上出现，**不新增可泄漏面**；若总管要求与既有权重口径统一，可改用 `audio` 路由的「录音文件校验未通过。」（§6-Q2 附带项）。

### 1.2 落点 ② `src/app/api/projects/[projectId]/ask/route.ts`（2 hunk）

**A. 内层 `request.json()` catch（新增，包住 `:38`）**

```ts
    let body: { question?: unknown };

    try {
      body = (await request.json()) as { question?: unknown };
    } catch {
      return NextResponse.json(
        { message: "请求格式不正确。" },
        { status: 400 },
      );
    }
```

（与 `projects/route.ts:77-90`、`audio/route.ts:63-72` 的既有写法**同串同码**；目的：非法 JSON 不再落进 500 兜底、也不再把解析器英文原文当 `message`。）

**B. 外层兜底（`:75-79` 改后）**

```ts
  } catch {
    // 不回显内部 error.message：provider 异常原话含端点与环境变量名（如
    // ark-llm-provider.ts:26 / :302）。形状对齐 audio 路由 :122-127。
    return NextResponse.json(
      { message: "问答失败，请稍后重试。" },
      { status: 500 },
    );
  }
```

### 1.3 落点 ③ `src/app/api/projects/[projectId]/process/route.ts`（1 hunk，无内层）

```ts
  } catch {
    // 不回显内部 error.message：转写 / LLM / 写盘异常原话含配置名与实现细节。
    // 已知：可读的 provider 文案（如「讯飞转写任务失败（failType=…）。」）本层会被覆盖，
    // 该串仍留在流程内的 lastProcessingError（process-project.ts:216，本批不动）—— §6-Q1 / Q2。
    return NextResponse.json(
      { message: "处理失败，请稍后重试。" },
      { status: 500 },
    );
  }
```

**为什么 ③ 不加内层校验 catch**：该 route 的入参校验全部是 `return` 式（`:21-36` 的 401／404／403），try 体内没有「校验类 `throw`」，`:38 processProject()` 是纯实现调用 ⇒ 分层无对象（加了只会多一层空壳）。

### 1.4 副作用核查（八项；实施轮逐条实测回填）

| # | 侧面 | 判据 | 结论 / 去向 |
| --- | --- | --- | --- |
| ① | **三类校验话术仍可达**（空文件 / >100MB / 非音频） | 内层 B 分支 ＋ D3／D4／D5 | **护栏生效**：三条中文串逐字符不变（`upload-store.ts` 一行未改） |
| ② | **状态码变化**：三项校验 **500 → 400**（对齐 audio 路由 `:94-100`） | D3／D4／D5 断言 400 | 前端只看 `response.ok`（`project-workspace.ts:112`），无逻辑依赖；**已如实登记为行为变化** ⇒ §6-Q3 |
| ③ | **可读文案退化面 1**：`project-store.ts:188`「项目存储文件损坏，已保留隔离副本，本次写入已中止。」经 `createProject` 落入外层 catch | 推演（无注入点，不设运行臂） | 改后响应变为「上传失败，请稍后重试。」——**信息量下降、非泄漏**；是否白名单 ⇒ §6-Q2 |
| ④ | **可读文案退化面 2**：`process` 的 provider 可读串（`xfyun-transcription-provider.ts:203-206` 等；`storage/projects.json:3487` 有实测留存「讯飞转写任务失败（failType=6：静音文件）。」） | D7／D8 | 响应层被固定人话覆盖；**落库面未动** ⇒ 处理台刷新后仍显示该串（`project-processing-console.tsx:1082-1084`）；是否白名单 ⇒ §6-Q2 |
| ⑤ | **`ask` 的 500 路径无法运行验证** | D2（静态） | mock 无 `askQuestion` 失败钩子（§0.2）⇒ 该项以静态断言 ＋ ③ 的运行结论覆盖同型；**不伪造旋钮** |
| ⑥ | **前端零改动** | `git diff --stat` | `src/store/**`、`src/components/**` 0 hunk；服务端 message 仍是唯一话术来源 |
| ⑦ | **落库面未动 ⇒ 内部串仍持久化** | D8（登记性断言） | 如实登记；处置见 §6-Q1（**不得**为让 D8「变绿」而改 `process-project.ts`） |
| ⑧ | **成功路径零变化** | D9（改动前基线在 S0 采一份） | 201 上传 / `{ answer }` / `{ project }` 三处返回体逐字段比对 |

### 1.5 静态门

`npx tsc --noEmit` → **exit 0**；`npx eslint src/app/api/projects` → **exit 0**（含 `[projectId]` 的路径在 PS 下按目录级调用，避免方括号被当通配符）。

---

## §2 验收口径

**命题**：三处兜底 `catch` 在**任何** `Error` 路径上都不再把内部 `error.message` 当对外 `message`；同时 ① 上传的三条入参校验中文串与既有成功路径**零变化**，② `ask` 的非法 JSON 不再落 500 兜底，③ 落库面（本批不动）如实登记。

### 2.1 断言（D 组 10 条）

| # | 断言 | 判据（机器） |
| --- | --- | --- |
| **D1** | 静态：三处外层兜底均为**无参** `catch {`，块内含各自常量串 | `process/route.ts` 与 `ask/route.ts` 的 `instanceof Error` **归零**；`projects/route.ts` 恰剩 **1 处**且位于内层 `saveInterviewAudio` 的 catch 内（其下方 10 行内出现 `{ status: 400 }`）；三条常量串各出现 1 次 |
| **D2** | 静态：`ask/route.ts` 的 `request.json()` 被内层 catch 包住（该块含 `"请求格式不正确。"` ＋ `{ status: 400 }`）；外层 catch 无参 ＋ 含 `"问答失败，请稍后重试。"` | 源码逐行断言（同 `tmp/verify-bug11-12-docs.mjs:21` 的 `src()` 取行口径） |
| **D3** | 运行：空文件（0 字节 `audio/wav`） | `400` ＋ `message === "上传文件为空，请重新选择音频。"`（且不含 `Error` / 路径 / `EACCES`） |
| **D4** | 运行：非音频（`.txt` / `text/plain`） | `400` ＋ `message === "仅支持常见音频文件格式上传。"` |
| **D5** | 运行（**可降级**）：>100MB | `400` ＋ `message === "演示版本建议上传 100MB 以内的音频文件。"`；造 101MB 体成本高 ⇒ 允许以「D3 / D4 已证明分层通路 ＋ D10 的 `upload-store.ts` 0 hunk」替代，降级须在 §4 记录理由 |
| **D6** | 运行：`ask` 非法 JSON（body `"{"`） | `400` ＋ `message === "请求格式不正确。"`（**不再**落 500 兜底） |
| **D7** | 运行：`process` 走缺配置失败臂（隔离 env） | `500` ＋ `message === "处理失败，请稍后重试。"`；响应体 `!includes` **负向串清单**：`缺少讯飞转写配置` / `Missing environment variable` / `EACCES` / `ENOSPC` / 演练目录绝对路径 / `.ts:` |
| **D8** | 运行（**登记性**，不为变绿而改源码）：同一失败后演练目录 `projects.json` 中该项目的 `lastProcessingError` **仍是原话** | 逐字符读文件断言 ⇒ 证明落库面未被顺手改动（§6-Q1） |
| **D9** | 运行：成功路径零回归 —— 正常音频上传 `201` ＋ `project.id` 在场；同一项目 `ask` 返回 `{ answer }`（mock） | 与 S0 采的改动前基线逐字段比对 |
| **D10** | 结构守门 | `git diff --numstat` 恰 **3 文件**；`upload-store.ts` / `process-project.ts` / `audio/route.ts` / `src/store/**` / `src/components/**` **0 hunk** |

### 2.2 探针落点与装载（`tmp/verify-bug12-sanitize.ts`，新增；**不入库**）

- **首选形态（离线直调 route handler）**，装载与隔离**照抄** `tmp/verify/verify-req14-ai-interview.ts:1-21`：
  - 运行命令：`node --import ./tmp/verify/register-alias-api.mjs tmp/verify-bug12-sanitize.ts`（`register-alias-api.mjs` 把 `next/server` 指到 `tmp/verify/stub-next-server.mjs`，见 `tmp/verify/alias-hooks-api.mjs:12-15`）。
  - 隔离：**任何 import 之前** `process.env.LOCAL_STORAGE_DIR = path.join("tmp", "drill-bug12")`，并先 `rm -r` 清一次；再 `delete` 掉 `XFYUN_APP_ID` / `XFYUN_SECRET_KEY` / `TRANSCRIPTION_PROVIDER` / `LLM_API_KEY`（保证**不触网**、结果确定性）。
  - 请求构造：`new Request(url, { method, headers: { "x-user-id": "u-bug12", "x-user-type": "personal", "content-type": … }, body })`；音频用现造的最小 WAV `Uint8Array` ＋ `FormData` / `File`（Node 20+ 原生）；`context` 传 `{ params: Promise.resolve({ projectId }) }`。
  - 断言助手：`check(name, pass, detail)` 形态（照抄 `tmp/verify-outline-planning.ts:14-19`），末行打印 PASS / FAIL 计数并以 `process.exitCode` 反映。
- **兜底形态（若 stub 与 `request.formData()` 不兼容）**：起 dev server（`npm run dev`）后走 HTTP 探测；此时须自带登录会话（cookie）或复用既有 CDP 探针的取会话方式。
- 两形态**都必须**在 §4 记录实际采用者与理由；探针**只新增、不改既有探针**（唯一例外见 §3 末「★」段）。

### 2.3 人工验收

| 项 | 操作 | 期望 |
| --- | --- | --- |
| **V1** | 上传页选一个正常音频走完整上传（沿用 BUG-11 的实机路径） | 与改动前一致：无新提示、无 console 报错、可进入分流步 / 处理台 |
| **V2** | 上传页选 0 字节音频；再把同一文件改名为 `.txt` 重试 | 界面提示**仍是原来的中文串**（不得退化成「上传失败，请稍后重试。」）；服务端回 400 |

---

## §3 回归要求

| # | 回归项 | 命令（仓库根目录） | 判据 |
| --- | --- | --- | --- |
| **R1** | REQ-14 prompt 探针（与本案零交叉的「未越界」证据） | `node --experimental-strip-types --import ./tmp/register-alias.mjs tmp/verify/verify-req14-prompts.ts` | **136/136** / FAIL 0 / exit 0 |
| **R2** | REQ-25 导出探针 | `node --import ./tmp/verify/register-alias.mjs tmp/verify-req25-export-format.mjs` | **31/31** / FAIL 0 / exit 0 |
| **R3** | 全链路场景（**前置**：dev server `localhost:3000` ＋ Chrome 在 `C:/Program Files/Google/Chrome/Application/chrome.exe`） | `node tmp/verify-phase3.mjs` | A2 / A3 / H1~H3 / K1~K6 全绿；**本批重点盯**：上传步（`POST /api/projects` 成功路径）与处理台（`/process`）零回归。既有抖动臂 **G / J3** 沿用 BUG-16 §6-Q2 裁决（只登记不修、不得据此改 `src`） |
| **R4** | 静态门 | `npx tsc --noEmit`；`npx eslint src/app/api/projects` | 均 exit 0 |
| **R5** | 本单新探针 | `node --import ./tmp/verify/register-alias-api.mjs tmp/verify-bug12-sanitize.ts` | D1~D10 全绿（D5 允许按注降级）；末行 PASS / FAIL 计数 ＋ exit 0 |
| **R6** | 越界守门 | `git diff --numstat` ＋ `git status --porcelain` | 恰 **3 文件**；`tmp/**` 不入库；`storage/**` 零改动；`docs/**` 仅本单 ＋ 登记表 |

**口径纪律**：① 既有断言（A2 / A3 / H1~H3 / K1~K6 等）**不得**为适配本批而改写；② R1 / R2 与本案零交叉，是「未越界」的机器证据；③ 任何一轮 R3 中**上传步或处理台**变红 ⇒ 立即停手回总管；④ 既有 G / J3 抖动**不得**记作本单失败。

**★ 文档批探针红灯（2026-10-14 实测；归属见 §6-Q4）**：`node tmp/verify-bug11-12-docs.mjs`（180 行 / 10 节）现已**未跑完** —— 本次实测 **55 PASS / 9 FAIL**，`§5.1` 处在 `mjs:76` 因 `one("| BUG-10 | 分流页「返回上一步」回来后已填基本信息丢失 | P1 | **待实施**（根因待定性） |", "t51-anchor")` **命中 0 行抛异常中断**（`§5.2` 与 `§6~§10` 共 **6 节未执行** ⇒ 连 `== 结论：…` 行都没打印）。9 条 FAIL 逐字为：`行数 1069 → 1310`（`:27` 期望 `1104`）／`L3 版本：- 版本：v2.22`（`:30` 期望 `v2.7`）／`L4 更新日期：2026-10-14`（`:31` 期望 `2026-10-08`）／`BUG-10 行现在 L120`（`:41` 期望 `L103`）／`BUG-11 分节标题在 L662`（`:53` 期望 `L577`）／`BUG-12 分节标题在 L678`（`:54` 期望 `L593`）／`UI-01 分节标题在 L696`（`:55` 期望 `L605`）／`BUG-12 字段数 = 11`（`:63` 期望 `9`）／`BUG-12 段含「未全量普查」`（`t12` 段内）。**成因**：BUG-10 / BUG-16 的状态变更与 v2.22 补登，使该探针现有硬编码锚点**整体失配**（`§5.1` 的 BUG-10 行已改为「**已完成**（本批 commit `3e3416a`，2026-10-14）」）。**§4 / §8 中对 `src` 的交叉断言仍全绿**（`route.ts:77` 的 `let formData: FormData;`、`:83-84` 的 try ＋ `formData()`、`audio/route.ts:63-71` 同形、前端预检文案与服务端逐字同句等）—— 说明失配**只在文档侧锚点**。
**若本批承担同步**（§6-Q4 默认 A），须逐项处理：① `:27` 行数 → 实施轮实测；`:30` `L3 = "- 版本：v2.23"`；`:31` `L4` = 实施日。② `:41` 的 `iT12` 与 `:53`~`:55` 三个分节行号 → 实施轮实测。③ `t12` 段内断言「未全量普查」→ 按现文本改写；`:63` 的 BUG-12 字段数 `9` → 实测（v2.22 后为 **11**）。④ `:76` 的 `t51-anchor` 前缀**去掉状态列**（只用 `| BUG-10 | 分流页「返回上一步」回来后已填基本信息丢失 | P1 |`），使其在「待实施 ↔ 已完成」两态下都能命中。⑤ 增补 BUG-12 段新锚点（`落点 3 处` / `根因` / `修法方向` / `ask/route.ts:75-79` / `process/route.ts:43-47` / `process-project.ts:216`）。⑥ **`§9` 的 DOC-02 假设必须重设**：`:144` 期望「工作区改动 **1** 文件 = 登记表」、`:157` porcelain **1** 项 —— 本批会改 `src` 3 文件 ＋ `docs` 2 件，不重设**必然 FAIL**；`:161`~`:163` 的计数断言（「待补录」13 处、「`` `91dad22` ``」4 行）随登记表变更重算；`:142`~`:152` 的历史 commit 断言（`91dad22` = 3 文件 ＋38/−1）**保留**（历史事实不变）。同步后该探针**必须全绿**（`tmp/` 不入库，但它是 BUG-11 / BUG-12 文档面的既有出口证据）。

---

## §4 步骤 / 回滚

| 步 | 动作 | 结果（实施轮回填） |
| --- | --- | --- |
| **S0** | 基线取证：`git status --porcelain` 为空（HEAD `61f3873`）；采集改动前基线 —— 三项校验的状态码与 `message`、`ask` 非法 JSON 现状、`process` 失败臂的响应与落库值、三条成功路径返回体 | 待填 |
| **S1** | 落三处改法（§1.1 A/B/C ＋ §1.2 A/B ＋ §1.3） | `git diff --numstat` 恰 **3 文件**；`src` 无新增 / 删除文件 |
| **S2** | 静态门（R4） | `tsc` / `eslint` exit 0 |
| **S3** | 新增 `tmp/verify-bug12-sanitize.ts`，跑 R5 / R1 / R2；记录实际采用的探针形态与理由 | D 组全绿、136/136、31/31 |
| **S4** | 全链路 R3（dev server ＋ Chrome）＋ 越界守门 R6 ＋ §1.4 八项逐条复核回填 | 上传步 / 处理台零回归；`storage/**` 零改动 |
| **S5** | 登记表回写（§5）＋ commit ＋ hash 回填 | **本单不自行 commit，等总管放行** |

**回滚**：任一环红 ⇒ `git checkout -- src/app/api/projects/route.ts "src/app/api/projects/[projectId]/ask/route.ts" "src/app/api/projects/[projectId]/process/route.ts"`；本批不新增 / 不删除 `src` 文件，回滚无残留。探针与登记表回写**同批进退**（**不得**留「断言在、实现无」的中间态）。**D8 若因落库面被改动而红 ⇒ 立即停手回总管，不得改 `process-project.ts` 去「修绿」。**

---

## §5 文档回写清单（`docs/需求登记表.md` ＋ tmp 探针）

| # | 位置 | 动作 |
| --- | --- | --- |
| ① | §三 BUG-12 状态行（现 `:680`） | 「**待实施**」→「**已完成**（实施日，commit `<hash>`）」＋ 补实测摘要（3 文件 / hunk 数、两处内层 catch、D 组断言按实）
| ② | §三 BUG-12 修法方向行（现 `:691`） | 按本单派工口径**更正**末句：`process-project.ts` **本批不动**（落库面另行处置）；回填 §6-Q1~Q3 裁决结论 |
| ③ | §三 BUG-12 验收要点行（现 `:692`） | 补「已落地为 D 组断言（D1~D10）＋ 实测结论」 |
| ④ | §三 BUG-12 依赖行（现 `:693`） | 三项「待确认」按裁决收口：① 白名单口径（Q2）② 三处已同批修 / `audio:90-101` 仍保留 ③ 与 BUG-09 / BUG-14 **不合并**（话术层 vs 超时重试层） |
| ⑤ | §1.2 总览表 BUG-12 行（现 `:122`） | 状态列同步「已完成」＋ 一句修法摘要（保持行内字数可控） |
| ⑥ | §5.1 编号索引 BUG-12 行（现 `:1234`） | 状态同步「已完成」＋ 补 `commit` |
| ⑦ | §5.2 两条关联（现 `:1289`、`:1290`） | 补「已闭环（BUG-12 三处同批脱敏）」，**不得**删「不得合并」「逐字同句 / 改任一处必须两处同改」等约束 |
| ⑧ | 头部 `:3` 版本 → `v2.23`；`:4` 更新日期 → 实施日；变更记录在 `:45` 的 v2.22 条目之后新增 v2.23 行 | 内容：落点 3 处 / 两处内层 catch / 未动清单（`upload-store.ts`、`process-project.ts`、`audio/route.ts`）/ D 组 / hash |
| ⑨ | `tmp/verify-bug11-12-docs.mjs`（180 行 / 10 节） | 按 §3 末「★」段**六项**逐条同步（行数 / 版本与日期 / 三处行号 / `t12` 断言与字段数 / `:76` 前缀去状态列 / **`§9` 的 DOC-02 假设重设**），跑通至 `== 结论：…` 且 FAIL 0（`tmp/` 不入库） |

**改文档的硬约束**：① 只改上述行，**不重排**表行顺序、不改他条；② `:691` 的更正须**保留原文可追溯**（写成「**2026-10-XX 更正**：…（原载『`process` 另须同批处置 `process-project.ts:216` 落库面』）」形态，不直接抹去）；③ 所有行号以实施轮实测为准（本单数字是改前水位）。

---

## §6 开口项（待总管裁决；本单已给默认取值，未获裁决前按默认执行）

| # | 事项 | 取值 | 本单默认 |
| --- | --- | --- | --- |
| **Q1** | **落库面 `process-project.ts:216`**：登记表 §三 修法方向原载「`process` 另须同批处置落库面」，而本单派工口径为「`process-project.ts` **不动**」⇒ **两者冲突，须显式裁决** | A 落库面另立单（本单只登记 D8）；B 本批随单改（落库值也改固定人话）；C 保持原话、仅在 UI 显示前过滤 | **A** —— 与 BUG-11 铁律同类推理（不顺手扩大 `src/lib/server` 面）；且落库值兼作排障线索（D8 的登记性断言即为此设） |
| **Q2** | 是否引入「可给用户看 ↔ 只进日志」白名单（登记表根因行点出的缺层） | A 接受两处可读文案退化（`project-store.ts:188` / `xfyun-transcription-provider.ts:203-206`）；B route 侧白名单（已知安全 message 集合），**须另立单** | **A** —— 本单按统一固定人话执行；退化已登记为 §1.4③④ |
| **Q3** | `projects/route.ts` 三项校验 **500 → 400** 的状态码变化是否接受 | A 接受（对齐 `audio/route.ts:94-100`）；B 保持 500、只换文案 | **A** |
| **Q4** | `tmp/verify-bug11-12-docs.mjs` 红灯（9 FAIL ＋ `:76` 中断）归属 | A 本批同批同步（`tmp/` 不入库，但同步后须全绿）；B 归文档批另办（本批只登记） | **A** —— 它是 BUG-11 / BUG-12 文档面的既有出口证据，红灯状态下无法证明本批文档回写正确 |
| **Q5** | commit 边界 | A 单笔（`src` 3 文件 ＋ `docs` 2 件）；B 沿用 BUG-16 的「两笔：主体 ＋ hash 回填」 | **B** —— 先例已跑通，hash 回填单独一笔可审计 |
| **Q6** | 是否与 BUG-09 / BUG-14 合并批次（登记表依赖行 ③ 留的开口） | A 不合并（本条属话术层）；B 合并 | **A** —— 链路不同；本单已在 §5-④ 按 A 收口 |

---

> 本单状态 ＝ **待实施**（纯任务单：`src` / `tmp` / `storage` 零改动）。交付物 ＝ 本单 ＋ 自检探针 `tmp/verify-bug12-taskorder.mjs`（`.gitignore:54` 忽略 `tmp/` ⇒ **不入版本库**）。放行后按 §4 的 S0~S5 执行；**本单不自行 commit**（§6-Q5 默认两笔）。
