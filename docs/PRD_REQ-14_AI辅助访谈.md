# REQ-14 PRD：AI 辅助访谈（人主持 + AI 实时侧写）

- 版本：v1.0（初稿）
- 编制日期：2026-10-03
- 语言：中文（工程导向）
- 关联：REQ-13（提纲生成与对话细化，已实现）、REQ-11、REQ-16（首页与新建流程重构，候选）
- 已拍板决策：
  - D1=C 表单为主、对话细化｜D2=A 人主持 + AI 侧写｜D3=A Web Speech 实时识别 + 结束后讯飞归档
  - D4=A 仅音频｜D5=B 仅 AI 访谈强制提纲｜D6=A TTS 默认关、可开｜D7=B 确认提纲后进项目
  - D8=C 情绪提示规则为主、LLM 抽样增强

## 0. 硬约束（不可更改）

1. 不引入新依赖、不新增色值（沿用既有 class 与颜色 token）。
2. 不改数据层（`src/lib/types/project.ts`、`src/lib/server/project-store.ts`）。
3. 不改存储层（`src/lib/server/upload-store.ts`、`src/lib/server/storage.ts`）。
4. 不改导出 API（`src/app/api/projects/[projectId]/export/route.ts`）。
5. 不接讯飞流式 IAT（付费能力，另立项）。
6. Web Speech API 仅浏览器端，**不做 polyfill**。
7. 移动端专项适配不在本期。
8. 随本需求一并收口 hardening：
   - `src/app/api/projects/route.ts:108-110`（`collectionScenario` 裸 cast）+ `:113-115`（`privacyLevel` 裸 cast）
   - `src/proxy.ts` BUG-06：未登录/失效 token 访问 `/api/*` 应返 `401`，不应 `302`

## 1. 用户故事

- **US-1（主）**：作为访谈主持人（研究者），我已生成并确认提纲，希望在一个页面里边主持访谈边看到**实时字幕**与**AI 侧写**（可追问方向、遗漏提醒）；访谈结束后录音自动进入处理台走讯飞归档——不需要另开录音设备再手动上传。
- **US-2**：作为访谈主持人，我希望提纲以 **checklist** 形式实时提示「哪些议题已聊到、哪些还没问」，避免漏问关键议题，且**系统不会替我问问题**（人主持）。
- **US-3**：作为访谈主持人，当受访者情绪出现波动时，我希望**尽快**看到温和的提示与安抚话术（不经过大模型、不产生延迟），且该提示**不打断**访谈。

## 2. 整体流程图（文字描述）

### 2.1 主链路（Happy path）

1. **提纲工作台** `/projects/new/outline`：填画像 → 生成提纲 → 对话细化（REQ-13 已实现）。
2. **D7=B 建项目**：点「进入 AI 访谈」→ `POST /api/projects/ai-interview` 创建项目（`collectionPath="ai_interview"`，**此刻无音频**）→ 拿到 `projectId` → 跳 `/projects/{projectId}/interview`。
   - 注：既有「确认提纲，进入上传」按钮**保持不变**（走 REQ-13 原链路），新增的 AI 访谈入口与之并列。
3. **访谈控制台 · 准备态**：展示项目信息摘要与提纲 checklist；勾选知情同意；点「检测设备」（麦克风权限 + 实时字幕能力探测）。
4. **开始访谈**：点「开始录音」→ 同时启动 ①音频采集（Web Audio 采集 PCM）②Web Speech 实时识别。
5. **访谈进行中**：
   - 实时字幕区滚动显示（interim 灰、final 黑）。
   - 每条 final 文本 → **本地规则引擎**立即产出情绪提示（D8=C 的「规则为主」）。
   - 累计到阈值（新 final ≥240 字 或 距上次抽样 ≥90s）且距上次调用 ≥45s、未熔断 → 调 `POST .../interview/sidecar` 产出 AI 侧写与 checklist 覆盖建议。
   - checklist 随覆盖建议高亮；用户可手动勾选/取消。
   - TTS 开关（**默认关**）：开启后仅朗读「可追问建议」，不朗读字幕（D6=A 不抢话）。
6. **暂停 / 继续**：暂停时停止识别与音频写入（录音保持**单文件连续**，不产生拼接），计时冻结；继续可恢复。
7. **结束访谈**：二次确认（文案含「结束后将上传录音并启动讯飞归档」）→ 停止采集 → 浏览器端封装 `interview-{projectId}.wav` → `POST /api/projects/{projectId}/interview/audio` 落盘并回填音频字段。
8. **进入处理台**：调既有 `POST /api/projects/{projectId}/process`（讯飞转写 → LLM 整理 → 脱敏）→ 跳 `/projects/{projectId}`，由既有处理台展示进度（转写中 / 整理中 / 待审校 / 可导出）。

### 2.2 失败与边界分支

| 场景 | 行为 |
| --- | --- |
| 浏览器不支持 `SpeechRecognition` | **仅录音继续**；字幕区置灰提示；AI 侧写无输入、不触发；归档不受影响 |
| 麦克风权限被拒绝 | 阻止进入录音态，提示在地址栏解除限制 |
| 实时识别启动失败（与录音争用麦克风） | **录音优先**；识别降级为不可用，其余流程不变 |
| LLM 侧写失败 / 超时 / 熔断 | 静默降级，保留规则情绪提示（见 §7） |
| 录音为空或超 100MB | 阻止提交；提示「重新录制」或「改用音频上传（跳 /upload）」 |
| 音频上传接口 4xx/5xx | 控制台停留并可重试；已生成 Blob 保留在内存，不丢录音 |
| 讯飞归档失败 | 由既有 `processProject` 兜底接管（状态回退 + `lastProcessingError`），处理台可见并可重试 |

### 2.3 状态机

`idle → consent → ready → recording ⇄ paused → ending → uploading → done | error`

## 3. UI 模块设计：访谈控制台

- **路由**：`/projects/{projectId}/interview`（新增；服务端页做鉴权与取数，交互在客户端）
- **容器**：`src/components/interview/interview-console.tsx`（承载 §2.3 状态机）
- **视觉规范**：复用既有类名 `archive-frame / paper-panel / paper-panel-strong / surface-card / section-eyebrow / tape-label / text-field / text-area`；颜色仅用既有 token。**不新增色值。**

| # | 模块 | 职责 | 关键交互 | 组件 |
| --- | --- | --- | --- | --- |
| 1 | 顶部信息条 | 项目名 / 受访者 / 场景 / 采集方式（AI 访谈）/ 保密级别（只读）/ 计时 / 状态徽标 | 准备态承载知情同意与设备自检 | 容器内 |
| 2 | 控制条 | 开始、暂停、继续、结束；录音指示灯；总计时 | 结束需二次确认；暂停冻结计时；上传中按钮 loading | `interview-control-bar.tsx` |
| 3 | 实时字幕区 | interim/final 字幕滚动；自动滚底 | 可「暂停滚动」「清屏（仅视图，不删内存）」；不支持时置灰 | `interview-caption-stream.tsx` |
| 4 | AI 侧写区 | 侧写卡片流（可追问方向 / 遗漏提醒 / 议题小结）+ 情绪提示分级色带 | 新卡片高亮；可「暂停侧写」（仅停 LLM 抽样，规则提示保留）；降级态显式提示 | `interview-sidecar-panel.tsx` |
| 5 | 提纲 checklist | 由 `outlineDraftMarkdown` 解析条目；覆盖态 = AI 建议 + 手动勾选 | 命中高亮；点击切换；可折叠；显示「已聊 n/m」 | `interview-outline-checklist.tsx` |
| 6 | TTS 开关 | 默认**关**；开启仅朗读「可追问建议」 | 开启时提示「建议佩戴耳机，避免被麦克风收录」；朗读期间暂停字幕识别 | 控制条内 |

- 情绪提示沿用既有等级中文映射 `getEmotionLevelLabel`（notice=提示 / warning=关注 / high=高度关注），**不新建词表**。
- 空态：未开始录音时，字幕区显示「点击开始录音后，这里会实时显示对话文字」；侧写区显示「AI 侧写会在对话进行到一定长度后出现」。

## 4. 新增 API 路由设计

统一约定：鉴权由 `src/proxy.ts` 注入 `x-user-id`；归属校验复用 `getProjectById` + `isProjectOwnedBy`；错误信封沿用现有风格（新路由用 `{ message }`，与 `/api/projects` 一致）。

### 4.1 `POST /api/projects/ai-interview` —— 创建 AI 访谈项目（D7）

请求（`application/json`）：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `projectName` | 是 | 空则 400「请填写口述项目名称。」 |
| `intervieweeName` | 是 | 空则 400「请填写受访对象姓名或称谓。」 |
| `collectionScenario` | 否 | 白名单外/空 → 落 `urban_memory` |
| `customScenarioLabel` | 条件 | `collectionScenario === "custom"` 且为空 → 400 |
| `outlineDraftMarkdown` | 是 | 空则 400（D5=B：AI 访谈强制提纲） |
| `privacyLevel` | 否 | 白名单外/空 → `standard` |
| `confidentialityLevel` | 否 | 白名单外/空 → `internal` |
| `institutionName` / `researchFocus` / `notes` | 否 | 原样透传（可空串） |
| `customRedactionRules` | 否 | 非法/缺失 → 默认四规则 |

响应：`201 { project }`｜`400 { message }`｜`401 { message }`｜`500 { message }`

实现要点：

1. 复用 `createProject`，`collectionPath` 固定 `"ai_interview"`，音频字段置空（`audioFileName: ""`、`audioStoragePath: ""`、`audioMimeType: "application/octet-stream"`、`audioSize: 0`）。
2. 随后 `updateProject` 将 `workflow[upload]` 由 `completed` 改为 `in_progress`（诚实反映「尚无音频」）。`status` 无「录音中」枚举且数据层为固化约束，保持默认值；UI 用「`collectionPath === "ai_interview"` 且 `audioFileName` 为空」自行判定为「访谈进行中」。
3. 枚举校验一律走 §8.1 的共享 `parseEnumValue`（**不新增第二份白名单**）。

### 4.2 `POST /api/projects/{projectId}/interview/audio` —— 访谈录音归档

请求：`multipart/form-data`

- `audio`：File，命名固定 `interview-{projectId}.wav`，`type: "audio/wav"`
- `durationMs`：可选，录音总时长（不含暂停）

响应：`200 { project }`｜`400 { message }`｜`401/403/404`｜`500`

实现要点：

1. `const saved = await saveInterviewAudio(audio)` → `updateProject` 回填 `audioFileName / audioStoragePath / audioMimeType / audioSize`，并置 `workflow[upload] = "completed"`、`status = "uploaded"`。
2. **必须 try/catch**：`saveInterviewAudio` 以 `throw Error` 报错（空文件、>100MB、格式不支持），需把 `error.message` 原样转为 `400`，否则会变成 500。
3. 不新增字段、不改存储层。

### 4.3 `POST /api/projects/{projectId}/interview/sidecar` —— AI 侧写抽样

请求（`application/json`，服务端再截断）：

| 字段 | 上限 | 说明 |
| --- | --- | --- |
| `checklist` | ≤40 条 | `[{ id, text }]`，来源为前端解析结果 |
| `coveredItemIds` | — | 上一轮 AI 建议 + 人工勾选 |
| `recentTranscript` | ≤4000 字 | 上次抽样游标之后的**新增 final** 文本 |
| `windowStartMs` / `windowEndMs` | — | 本轮窗口（仅用于提示词上下文） |

响应：

```json
{
  "coveredItemIds": ["c-3"],
  "sideNotes": [{ "title": "…", "detail": "…", "source": "llm" }],
  "emotionHints": [{ "level": "warning", "label": "…", "excerpt": "…", "guidance": "…" }],
  "degraded": false
}
```

- **失败非致命**：任何 LLM 异常 / 超时 / 解析失败 → `200 { degraded: true, coveredItemIds: [], sideNotes: [], emotionHints: [] }`，**不返回 5xx**（实时场景不宜弹错）。
- 实现要点：`getLlmProvider().askQuestion(prompt)`（**不改 provider 接口**，mock/ark 双实现零改动）；用 `Promise.race` 加 15s 服务端超时；返回前做白名单归一化（`level` 限枚举、去重、`sideNotes ≤3`、`emotionHints ≤2`、字段截断）。

### 4.4 复用且不改的既有路由

- `POST /api/projects/{projectId}/process` —— 结束后触发讯飞归档与整理。
- `GET /api/projects`、`GET /api/projects/{projectId}` —— 列表 / 详情。
- `PATCH /api/projects/{projectId}` —— 既有 `safeBody` 透传可改 `confidentialityLevel` 等字段（**接口层已具备能力，UI 入口本期不做**）。

## 5. Web Speech API 集成方案

### 5.1 能力探测（不 polyfill）

```ts
const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
const supported = typeof Ctor === "function";
```

- 不支持 → 字幕区禁用并提示「当前浏览器不支持实时字幕，录音与归档不受影响」，其余功能照常。
- 需补最小类型声明（无新依赖）：`src/lib/speech-recognition.d.ts`（或在 hook 内 `declare global`）。

### 5.2 识别配置

- `lang="zh-CN"`、`continuous=true`、`interimResults=true`、`maxAlternatives=1`。
- `onresult`：遍历 `event.results`；`isFinal` 追加进内存 `finalSegments`，否则更新 `interimText`（**不落库**）。
- **自动重启**：Chrome 长静音会自行 `end`；当 `state === "recording"` 时在 `onend` 内 `setTimeout(restart, 300)`，用 `restartGuard` 防抖，避免 `start` 抛 `InvalidStateError` 形成死循环。
- `onerror`：`not-allowed` / `service-not-allowed` → 停用并提示；`no-speech` / `network` → 静默忽略，等待自动重启。

### 5.3 识别结果如何送给 AI

- **不逐条送**。`interim` 仅上屏，不进 AI、不触发规则（避免重复命中）；`final` 入库内存并上屏。
- 触发抽样时，取「上次抽样游标之后的新增 final」，按句聚合（遇 `。！？` 或累计 60 字成句）后切片（≤4000 字）作为 `recentTranscript`。
- 每轮返回后推进游标（`lastSampledIndex`），保证增量、幂等、不重发。

### 5.4 与录音并行

- 字幕（SpeechRecognition）与录音（`getUserMedia` + AudioContext）各自持有麦克风。已知风险：个别环境两者争用麦克风导致识别失败。
  - 缓解：先 `getUserMedia` 成功再启动识别；识别失败不影响录音；**录音优先**（D3 的归档源是音频）。
- TTS 朗读会经空气回灌麦克风 → 开启 TTS 时**暂停字幕识别**（朗读结束恢复），并提示佩戴耳机。

## 6. AI 侧写触发策略（D8=C）

两条独立通路：

| 通路 | 触发 | 延迟 | 成本 | 产出 |
| --- | --- | --- | --- | --- |
| 规则引擎（**为主**） | 每条 `final` 即时 | 0（本地） | 0 | 情绪提示 |
| LLM 抽样（增强） | 见 6.2 频控 | 1~10s | 每轮 1 次调用 | checklist 覆盖建议 + 侧写卡片 + 情绪升级 |

### 6.1 规则引擎（`src/lib/interview-signals.ts`，纯函数）

- 词表分级：自伤 / 他伤 / 虐待 → `high`；哭泣 / 哽咽 / 愤怒 / 崩溃 / 长时间沉默 → `warning`；战争 / 灾难 / 丧亲 / 去世 / 饥荒 → `notice`。
- 去重：同类别 **30s 冷却**，避免刷屏。
- `high` → 顶部横幅「建议暂停，先照顾受访者情绪」，同时**立即**尝试一次 LLM 抽样（若未熔断）补充安抚话术；规则本身不依赖 LLM。
- 与 D8 的关系：**规则 = 实时、必达、不依赖网络；LLM = 抽样、增量、可降级**。两者产出合并去重后进侧写区，分别标记 `source: "rule" | "llm"`。

### 6.2 LLM 抽样频控（双闸 + 熔断）

- 触发条件（全部满足）：处于 `recording` 且未「暂停侧写」；`新增 final 字数 ≥ 240` **或** `距上次抽样 ≥ 90s`；`距上次调用 ≥ 45s`；`callCount < 24`。
- 熔断：连续 3 次失败/超时 → 本次访谈停止 LLM 抽样，UI 提示「AI 侧写暂不可用，规则提示仍生效」。
- 幂等：请求携带上一轮 `coveredItemIds`，只要求模型返回「新增覆盖」，降低重复。
- 无输入不调用：`recentTranscript` 为空或全空白 → 跳过本轮，不发请求。

## 7. LLM 失败兜底策略

分层兜底，任何一层失败都不阻断访谈：

1. **服务端**：`Promise.race([askQuestion, 15s])` + `try/catch` + 容忍式 JSON 解析（可剥离 ```json 围栏与前后噪声）→ 失败返回 `200 { degraded: true, …空 }`。
2. **白名单归一化**：`level` 仅接受 `notice|warning|high`；`coveredItemIds` 只保留存在于请求 checklist 的 id；`sideNotes ≤3`、`emotionHints ≤2`；各字段按长度截断。
3. **前端**：`AbortController` 10s 超时；失败静默，**保留上一轮侧写与 checklist 状态**；连续 3 次失败熔断。
4. **本地兜底产出**：`degraded` 时用规则引擎结果生成一条本地侧写（如「上一段提到了 XX，可在情绪平稳后追问感受」），保证侧写区**非空且有价值**，并标注「本地提示」。
5. **mock 环境**：`LLM_PROVIDER=mock` 下 `askQuestion` 返回自由文本 → 解析失败 → 走兜底 4，demo 仍可用（侧写以本地提示呈现）。

## 8. hardening 清单处理方案

### 8.1 `collectionScenario` / `privacyLevel` 裸 cast（`src/app/api/projects/route.ts`）

**现状（已核实）**：

- `route.ts:30` 已有 `parseEnumValue`，`:18` / `:24` 已有 `confidentialityLevelValues` / `collectionPathValues`，且 `:117` / `:122` 已在用。
- 但 `:108-110` 的 `collectionScenario` 与 `:113-115` 的 `privacyLevel` **仍是裸 cast**，空串 / 非法值 / 中文值会原样透传落库。

**方案**：

1. 新建 `src/lib/server/enum.ts`，把**已有的** `parseEnumValue` 与允许值常量**迁移**过去（route 文件不能被其它 route import，新路由必须走共享模块），并补齐 `interviewScenarioValues` 与 `privacyLevelValues`。
2. `projects/route.ts` 删除本地定义，改为从 `enum.ts` 导入；把 `:108-110`、`:113-115` 两处裸 cast 改为 `parseEnumValue(...)`。
3. 新路由 `ai-interview` 复用同一 helper，**全程只有一份白名单**。
4. 保留既有业务校验：`custom` + 空 `customScenarioLabel` → 400。

**验收**：`collectionScenario` 传 `""` / `"URBAN_MEMORY"` / `"城市记忆"` / `"garbage"` → 落 `urban_memory`；传 `"red_memory"` → 原样保存；`privacyLevel` 同理退回 `standard`。

### 8.2 `src/proxy.ts` BUG-06：未登录 `/api/*` 应返 401 不 302

**现状（已核实）**：所有非公开路径（含 `/api/*`）在无 token 或 token 失效时 `NextResponse.redirect('/login')`，前端 fetch 会跟随重定向拿到 HTML，导致各 route 内的 `401` 分支形同虚设（`src/app/api/outline/chat/route.ts:40-41` 的注释已记录该现象）。

**方案**：

```ts
const isApi = pathname.startsWith("/api");
if (!token) {
  return isApi
    ? NextResponse.json({ message: "未登录。" }, { status: 401 })
    : NextResponse.redirect(loginUrl);
}
// verifyToken 失败同理：API → 401；页面 → redirect(/login?reason=expired)
```

`PUBLIC_PATHS`、`STATIC_PREFIXES`、`config.matcher` **保持不变**。

**回归影响（已核实）**：`useAuth` 调 `/api/auth/me`，原来跟随 302 到 `/login`（HTML，`res.ok === false`），现在直接 `401`（`res.ok === false`）→ 行为等价，无回归。

**验收**：无 cookie `GET /api/projects` → `401` JSON；有 cookie → `200`；无 cookie `GET /` → `302 /login?redirect=/`；失效 token 访问 `/api/*` → `401`（不再附带 `reason` 参数）。

## 9. 验收标准

### A. 流程与接口

1. 提纲工作台点「进入 AI 访谈」→ 生成项目（`collectionPath="ai_interview"`、`audioFileName=""`）→ 落在 `/projects/{id}/interview`。
2. 既有「确认提纲，进入上传」按钮行为不变（回归通过）。
3. 结束访谈后 `POST .../interview/audio` 返回 200；项目详情「受访音频」显示 `interview-{id}.wav`，`workflow.upload = completed`。
4. 归档触发后状态依次 `transcribing → ai_refining → manual_review`，处理台可见；docx / txt / json 三格式导出**全部回归通过**（导出 API 零改动）。
5. 未登录 `POST /api/projects/ai-interview` → **401 JSON**（非 302）。
6. 访问他人项目 `/interview/sidecar` → 403；项目不存在 → 404。

### B. 枚举 hardening

7. `POST /api/projects` 传 `collectionScenario=""` / `"URBAN_MEMORY"` / `"城市记忆"` / `"garbage"` → 落库 `urban_memory`，存储中不出现非法值。
8. 传 `"red_memory"` → 原样保存；`custom` + 空 `customScenarioLabel` → 400。
9. `privacyLevel` 传非法值 → 落 `standard`。

### C. 实时字幕 / Web Speech

10. Chrome：开始录音后字幕区出现 interim（灰）→ final（黑）；停止后不再新增。
11. 「不支持 SpeechRecognition」被 stub 为 undefined 时：字幕区置灰，**录音与归档仍成功**。
12. 模拟 `onend`（长静音）后识别自动重启，且不出现重复 final 或 `InvalidStateError`。
13. 抓包确认 `interim` 文本**不进入** sidecar 请求、不触发规则提示。

### D. 录音

14. 产物为 WAV、单声道 16kHz；时长与计时器误差 < 2s。
15. 暂停期间不重复写入音频（暂停前后拼接无重叠、无空洞）。
16. 麦克风权限被拒 → 不进入录音态，给出可操作提示。
17. 空录音（0 字节）或 >100MB → 阻止提交并给出「重新录制」引导；路由返回 400 且带原文案。

### E. AI 侧写与情绪（D8）

18. 命中「自伤」类词 → **规则**在 1s 内产生 `high` 提示，不等 LLM。
19. 累计新增 final ≥240 字 → 触发 1 次 sidecar；45s 内再次满足条件不重复调用（抓包计数）。
20. LLM 返回非法 JSON / 超时 → 接口 `200 { degraded: true }`；UI 不弹错、既有侧写保留、出现一条「本地提示」。
21. 连续 3 次失败 → 后续不再发起 sidecar 请求，UI 出现降级提示；规则提示继续工作。
22. `callCount` 达 24 → 停止抽样（规则提示不受影响）。

### F. TTS（D6）

23. 默认关闭，页面无朗读；开启后仅朗读「可追问建议」；朗读期间不产生新的 final 字幕（回灌被抑制）。
24. 关闭开关后立即停止朗读。

### G. 回归与布局

25. 原「音频上传」链路（`/upload`）与 REQ-13 提纲预填、`?outline=1` 草稿带入**全部回归通过**。
26. `tmp/cdp-req13-outline.mjs`（含 13-E 首页两入口断言）、`tmp/cdp-req13-crosscut.mjs`、`tmp/measure-375.mjs`（375px header 高度基线）**全部保持通过**（因首页与上传页未改动）。

## 10. 不做边界（本期明确不做）

- 视频采集（D4=A 仅音频）。
- AI 全自动主访 / AI 主动提问（D2=A 人主持）。
- 讯飞流式 IAT 及任何新的付费识别能力。
- 说话人分离（Web Speech 单通道，无法区分主持人与受访者）。
- 实时字幕与 checklist 覆盖态**落库**（仅内存/会话级；归档以讯飞转写稿为准）。
- 移动端专项适配。
- Web Speech 的 polyfill / 离线识别 / 第三方识别替代。
- 多轨录音、断点续录、录音后剪辑。
- 云端草稿与跨设备续访（属 REQ-15 草稿箱范畴）。
- TTS 语音克隆、唤醒词、自动朗读字幕。
- 处理台修改 `confidentialityLevel` 的 UI 入口（接口已具备，UI 留待迭代）。
- 首页与新建流程重构（属 REQ-16；本期首页与上传页**不动**）。
- 真实 RAG 检索（沿用现有「整理稿全文 Prompt」）。

## 11. 文件改动清单

### 11.1 新增（页面与组件）

| 文件 | 用途 |
| --- | --- |
| `src/app/projects/[projectId]/interview/page.tsx` | 服务端页：鉴权 + 取项目 + 渲染控制台 |
| `src/components/interview/interview-console.tsx` | 控制台容器与状态机 |
| `src/components/interview/interview-control-bar.tsx` | 录音 / 暂停 / 结束 + TTS 开关 + 计时 |
| `src/components/interview/interview-caption-stream.tsx` | 实时字幕区 |
| `src/components/interview/interview-sidecar-panel.tsx` | AI 侧写区 + 情绪提示 |
| `src/components/interview/interview-outline-checklist.tsx` | 提纲 checklist |

### 11.2 新增（hook、纯逻辑与类型）

| 文件 | 用途 |
| --- | --- |
| `src/hooks/useSpeechRecognition.ts` | Web Speech 封装（探测 / 自动重启 / 降级） |
| `src/hooks/useAudioRecorder.ts` | Web Audio 采集 + WAV 封装 + 暂停 |
| `src/lib/speech-recognition.d.ts` | 最小类型声明（无新依赖） |
| `src/lib/interview-outline.ts` | 提纲 markdown → checklist 解析（纯函数） |
| `src/lib/interview-signals.ts` | 规则情绪提示 + 本地侧写兜底 + 触发频控（纯函数） |
| `src/lib/types/interview.ts` | 侧写 / checklist 类型（**新建文件，不动 `types/project.ts`**） |
| `src/lib/server/enum.ts` | `parseEnumValue` + 允许值常量（hardening 共享） |

### 11.3 新增（API）

| 文件 | 用途 |
| --- | --- |
| `src/app/api/projects/ai-interview/route.ts` | 创建 AI 访谈项目（D7） |
| `src/app/api/projects/[projectId]/interview/audio/route.ts` | 访谈录音落盘与回填 |
| `src/app/api/projects/[projectId]/interview/sidecar/route.ts` | AI 侧写抽样 |

### 11.4 修改（3 个既有文件）

| 文件 | 改动 | 依据 |
| --- | --- | --- |
| `src/proxy.ts` | BUG-06：`/api/*` 未登录 / 失效返 401 JSON，页面仍 302 | §8.2 |
| `src/app/api/projects/route.ts` | 删除本地 `parseEnumValue` 与常量（迁至 `enum.ts` 后导入）；`:108-110` `collectionScenario`、`:113-115` `privacyLevel` 改用 `parseEnumValue` | §8.1 |
| `src/components/outline/outline-plan-workspace.tsx` | 「确认提纲」处新增「进入 AI 访谈」分支 → 调 `ai-interview` 建项目 → 跳控制台；既有「确认提纲，进入上传」按钮不变 | D7=B |

### 11.5 明确不修改

`src/lib/types/project.ts`、`src/lib/server/project-store.ts`、`src/lib/server/upload-store.ts`、`src/lib/server/storage.ts`、`src/lib/server/process-project.ts`、`src/app/api/projects/[projectId]/export/route.ts`、`src/lib/providers/llm/*`、`src/lib/providers/transcription/*`、`src/components/home/home-dashboard.tsx`、`src/components/upload/interview-upload-form.tsx`。

> 说明：上传页 Step 2 的「AI 访谈」卡片是硬编码 `disabled`（`interview-upload-form.tsx:662`），且该表单提交链路强制要求音频文件（`src/app/api/projects/route.ts:151-156`）。本期**保持 disabled 与「即将开放」文案不变**，AI 访谈入口唯一在提纲工作台；上传页与首页的入口重构统一交给 REQ-16。

### 11.6 新增（验收脚本）

| 文件 | 覆盖 |
| --- | --- |
| `tmp/verify/verify-req14-ai-interview.ts` | 建项目路由：枚举回退、必填 400、401 |
| `tmp/verify/verify-req14-sidecar.ts` | 侧写路由：401 / 403 / 空输入 / degraded / 白名单归一化 |
| `tmp/verify/verify-interview-signals.ts` | 规则引擎分级、去重冷却、频控与熔断 |
| `tmp/verify/verify-outline-parser.ts` | 提纲解析（空 / 超长 / 异常 markdown） |
| `tmp/verify/verify-proxy-api.ts` | proxy：`/api/*` 401 vs 页面 302 |
| `tmp/cdp-req14-interview.mjs` | 控制台端到端（stub SpeechRecognition / 录音，断言状态机、sidecar 调用、结束 → 上传 → 跳处理台） |

## 12. 关键实现参数速查

| 项 | 值 | 依据 |
| --- | --- | --- |
| 录音格式 | WAV，单声道 16kHz / 16bit | 讯飞与存储层双兼容 |
| 体积 | 32 KB/s = **1.92 MB/min** | 16kHz × 16bit × 1ch |
| 硬上限 | **100MB ⇒ ≈52 分钟** | `upload-store.ts:51` |
| 接近上限提示 | 45 分钟起 | 本 PRD 定 |
| 落盘命名 | `interview-{projectId}.wav`，`type: "audio/wav"` | 命中 `allowedExtensions` 与 `normalizeExtension` 的 `audio/wav` 分支 |
| 讯飞格式判定 | 取 `audioFileName` 扩展名 → `wav` | `xfyun-transcription-provider.ts:19-23` |
| LLM 抽样阈值 | 新增 final ≥240 字 或 ≥90s | 本 PRD 定 |
| LLM 冷却 / 上限 | ≥45s、`callCount < 24` | 本 PRD 定 |
| 服务端 / 前端超时 | 15s / 10s | 本 PRD 定 |
| 规则去重冷却 | 同类 30s | 本 PRD 定 |
| 上下文切片 | `recentTranscript ≤4000 字`、checklist ≤40 条 | 本 PRD 定 |
| 熔断 | 连续 3 次失败 | 本 PRD 定 |

## 13. 待确认项（不阻塞开工）

1. `confidentialityLevel` 建项目时默认 `internal`、不弹确认窗；控制台只读展示。事后修改需 UI 入口（本期不做）。
2. REQ-14 入口唯一在提纲工作台；首页与上传页不动，等 REQ-16 统一重构。
3. REQ-16 与 REQ-14 的排期顺序：本 PRD 假设 REQ-14 先行、REQ-16 后续重构入口。