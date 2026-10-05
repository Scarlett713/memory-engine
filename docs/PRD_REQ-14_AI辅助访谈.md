# REQ-14 PRD：AI 辅助访谈（AI 主访 + 实时侧写）

- 版本：v1.5
- 编制日期：2026-10-03
- 版本变更：v1.1（交互方式待确认、情绪提示口径修正）→ v1.2（D2=A AI 主访已选定；PRD 正文待按方案 A 改稿）→ **v1.3（2026-10-03 正文按 D2=A 重写：AI 逐问与追问、情绪暂停恢复、写作规则插槽；302→307 措辞修正）** → **v1.4（2026-10-03：两份 prompt 模板落盘 `src/lib/writing-rules.ts` / `src/lib/interview-prompt.ts`；§11.5.1 最小解冻 1 行插槽；§9-H 一票否决本期口径；§13 新增 2 项待确认）** → **v1.5（2026-10-05：D7=B′ 口径同步 —— AI 实时访谈唯一入口移入流程内分流步（`#route-chooser-realtime`）；提纲在流程内可跳过、AI 分支须有提纲且校验点在 API 层（不放宽契约）；§2.1 主链路、§9-A、§9-G、§11.4、§11.5.1、§13 同步互引；随 REQ-16 Phase 3 / REQ-21 验收同批落地）**
- 语言：中文（工程导向）
- 关联：REQ-13（提纲生成与对话细化，已实现）、REQ-11、REQ-15（草稿箱，候选）、REQ-16（首页与新建流程重构，候选）、REQ-17（后台编辑管理入口，候选）、REQ-18（脱敏规则体系，候选）、REQ-19（用户反馈通道 / 稿件返修，候选）、REQ-20（成文稿导出 PDF，候选）、UI-07（处理台情绪提示定位修正）
- **交互方式：D2=A AI 主访（AI 直接主访受访者）—— 任 2026-10-03 确认，方案 A「✅ 已选定」（见 §0.1）**；接受文本模型（deepseek-v4-flash）单轮 3-10s 延迟，**中期不要求实时语音模型**。本稿正文（§1 ~ §9）已按方案 A（AI 主访）重写（v1.3，2026-10-03）；方案 B 仅作历史记录（见 §0.1）。
- 已拍板决策：
  - D1=C 表单为主、对话细化｜**D2=A AI 主访（2026-10-03 语义修订，原注「人主持 + AI 侧写」作废）**｜D3=A Web Speech 实时识别 + 结束后讯飞归档
  - D4=A 仅音频｜D5=B 仅 AI 访谈强制提纲｜D6=A TTS 默认关、可开｜**D7=B′ 流程内分流步选「AI 实时访谈」时须有提纲（提纲在流程内可跳过；空提纲由分流步弹引导回填，契约校验点仍在 API 层）—— 2026-10-05 随 REQ-16 Phase 3 修订，原注「确认提纲后进项目」作废**
  - D8=C 情绪提示规则为主、LLM 抽样增强
- 情绪提示定位修正（任，2026-10-03）：**给后台编辑看、只关注负面情绪、只标注事实不给建议**；REQ-14 新增 sidecar 出参**去掉 `guidance` 字段**。存量处理台 / 导出的联动改动归 UI-07，见 §0 第 9 条

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
   - `src/proxy.ts` BUG-06：未登录/失效 token 访问 `/api/*` 应返 `401`，不应 `307`
9. 与 UI-07 的边界：本期**不改**存量处理台情绪面板与导出中的情绪字段（§0.2、§0.4 依旧冻结）。
   - REQ-14 的情绪语义收敛**只作用于新增 sidecar 出参与访谈控制台**；存量「建议：{guidance}」（`project-processing-console.tsx:239`、`project-export.ts:359` / `:474`）的调整属 **UI-07**，需先裁决是否解冻 §0.2 / §0.4。

> **已确认技术约束（已拍板，不可更改）**：
> ① 录音 **WAV**（单声道 16kHz / 16bit），**≈1.9 MB/min、50 分钟上限**（精确值 1.92 MB/min、100MB ≈ 52 分钟、45 分钟起提示，见 §12）；
> ② 建项目 `confidentialityLevel` **默认 `internal`、不弹确认窗**，控制台只读；事后修改的 UI 入口本期不做（接口层 `PATCH` 已具备能力）；
> ③ `home-dashboard.tsx` 与上传页本批**不动**，入口重构归 REQ-16。

## 0.1 交互方式（已选定：方案 A AI 主访）

> 状态：**已决定 —— 方案 A（AI 主访）**。任 2026-10-03 确认 D2=A：接受文本模型单轮 3-10s 延迟，**中期不要求接入实时语音模型**。方案 B / C 仅作历史记录；本稿正文（§1 ~ §9）已按方案 A 重写（v1.3，2026-10-03）。

| 方案 | 形态 | 工期 | 风险 / 说明 |
| --- | --- | --- | --- |
| A（✅ 已选定） | AI 直接语音主访受访者（全自动） | 1 ~ 2 周 | 伦理风险高（AI 主访的边界、暂停权待改稿明确）；当前 LLM（deepseek-v4-flash）每轮响应 3-10s，语音对话场景等待明显，需接入实时语音模型才能达到小鹿光年体验水平 —— **该延迟已由产品方接受，中期不要求实时语音模型** |
| B（原稿依据，已落选） | 人主持，AI 实时旁边辅助侧写 | 3 ~ 5 天 | 人的主导权与伦理边界清晰；AI 只做侧写、不抢话（原 D2=A / D6=A 注解，已随 D2 修订作废） |
| C（仅作 10-05 兜底） | AI 仅协助准备提纲（REQ-13 已实现）+ 实际访谈只录音 + 归档 | 10-05 可交付 | 无实时能力：访谈中无侧写、无情绪提示；**仅在进度告急时启用的兜底路径** |

> 方案 A 的延迟数据（deepseek-v4-flash 每轮 3-10s）由产品方（任）提供；**任已于 2026-10-03 接受该延迟，中期不要求实时语音模型**，故本项不再构成 A / B 取舍障碍。

## 1. 用户故事

- **US-1（主）**：作为访谈主持人（研究者），我已生成并确认提纲，希望 AI 按提纲逐问引导受访者，而我在同一页面看到**实时字幕**与**AI 侧写**（追问方向、遗漏提醒）；访谈结束后录音自动进入处理台走讯飞归档——不需要另开录音设备再手动上传。
- **US-2**：作为访谈主持人，我希望提纲以 **checklist** 形式实时提示「哪些议题已聊到、哪些还没问」，避免漏问关键议题，且**同一议题在 AI 追问不超过 2 次后强制推进**，避免在一个议题上滞留。
- **US-3**：作为访谈主持人，当受访者出现**负面情绪波动**时，我希望**尽快**看到一条**中性提示**（只标注「检测到负面情绪波动」，不给建议话术；不经过大模型、不产生延迟），且该提示**不打断**访谈（暂停权与恢复见 §3 模块 4）。

## 2. 整体流程图（文字描述）

### 2.1 主链路（Happy path）

1. **新建三步流程** `/projects/new`（REQ-21）：基本信息 → 提纲（可跳过）→ 分流。提纲步内嵌 REQ-13 的提纲工作台（填画像 → 生成提纲 → 对话细化）；**独立路由 `/projects/new/outline` 已退役为 307 跳板**，最终落到 `/projects/new?step=outline`。
2. **D7=B′ 建项目**：在**流程内分流步**点「AI 实时访谈」（`#route-chooser-realtime`）→ `POST /api/projects/ai-interview` 创建项目（`collectionPath="ai_interview"`，**此刻无音频**）→ 拿到 `projectId` → 跳 `/projects/{projectId}/interview`。
   - 注 1：分流步另一卡「上传音频」承接 REQ-13 原链路（`/upload?outline=1`，提纲草稿照带）；流程内提纲步按钮为「确认提纲，下一步」/「跳过提纲，下一步」，**独立页时代的三按钮形态（确认 / 跳过 / 进入 AI 访谈）随该页退役**。
   - 注 2（2026-10-05，D7=B′）：**AI 实时访谈的唯一入口在流程内分流步**。提纲是流程内的可选步骤，但选 AI 分支时须有提纲 —— 空提纲时由分流步弹 `[data-route-modal="outline-required"]` 引导回填；**API 契约不放宽**（`ai-interview/route.ts:137-138` 仍强制 `outlineDraftMarkdown` 非空）。
3. **访谈控制台 · 准备态**：展示项目信息摘要、**当前问题区**与提纲 checklist；勾选知情同意；点「检测设备」（麦克风权限 + 实时字幕能力探测）。
4. **开始访谈**：点「开始录音」→ 同时启动 ①音频采集（Web Audio 采集 PCM）②Web Speech 实时识别；**AI 读取已确认提纲，取第 1 个问题**。
5. **AI 逐问循环**（每问一拍；并行产出情绪提示与 AI 侧写）：
   - ① TTS 播报问题（D6=A，默认关、可开；关时只显示问题文字）。
   - ② 用户语音回答 → Web Speech 实时识别 → 字幕显示（interim 灰、final 黑）。
   - ③ AI 分析回答：充分 → 生成下一问；不充分 → 生成追问（**最多连续追问 2 次后强制推进**）；命中负面情绪关键词 → 弹「是否暂停」提示（见 §3 模块 4）。任一路径均回到 ①。
   - ④ 生成下一问超时 >15s → 自动跳下一问并标注「待补录」，访谈结束后提示用户（见 §7-6）。
   - 并行：每条 final → **本地规则引擎**立即产出情绪提示（D8=C 的「规则为主」）；累计到阈值（新 final ≥240 字 或 距上次抽样 ≥90s）且距上次调用 ≥45s、未熔断 → 调 `POST .../interview/sidecar` 产出 AI 侧写与 checklist 覆盖建议；checklist 随覆盖建议高亮，用户可手动勾选/取消。
6. **暂停 / 继续**：暂停时停止识别与音频写入（录音保持**单文件连续**，不产生拼接），计时冻结；继续可恢复（情绪触发的暂停见 §3 模块 4，刷新后恢复见 §7-8）。
7. **结束访谈**：二次确认（文案含「结束后将上传录音并启动讯飞归档」）→ 停止采集 → 浏览器端封装 `interview-{projectId}.wav` → `POST /api/projects/{projectId}/interview/audio` 落盘并回填音频字段。
8. **整理阶段**：调既有 `POST /api/projects/{projectId}/process`（讯飞转写归档）→ **写作规则注入（见 §6.3）** → AI 生成整理初稿 → 跳 `/projects/{projectId}`，由既有处理台展示进度（转写中 / 整理中 / 待审校 / 可导出）。

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
| 1 | 顶部信息条 | 项目名 / 受访者 / 场景 / 采集方式（AI 访谈）/ 保密级别（只读）/ 计时 / 当前题号 n/m / 状态徽标 | 准备态承载知情同意与设备自检 | 容器内 |
| 2 | 控制条 | 开始、暂停、继续、结束；录音指示灯；总计时 | 结束需二次确认；暂停冻结计时；上传中按钮 loading | `interview-control-bar.tsx` |
| 3 | AI 提问引擎 | 读取提纲 → 生成当前问题 → 判断回答是否充分：充分则进下一题，不充分则追问（最多连续 2 次后强制推进）；生成超时 >15s 自动跳下一问并标注「待补录」 | 显示当前问题文字；追问次数徽标；TTS 开时「重听」 | 容器内 |
| 4 | 情绪暂停（简化版） | 负面关键词命中（见 §6.1 词表）→ 弹「检测到情绪波动，是否暂停访谈？」；选「暂停」：保存进度（已录音 + 已转写文字 + 当前题号）、停止录音、进 `paused`；选「继续」：记录触发时间戳，访谈继续 | 「暂停 / 继续访谈」；`paused` 态下常驻「继续访谈」入口 | 容器内 |
| 5 | 实时字幕区 | interim/final 字幕滚动；自动滚底 | 可「暂停滚动」「清屏（仅视图，不删内存）」；不支持时置灰 | `interview-caption-stream.tsx` |
| 6 | AI 侧写区 | 侧写卡片流（可追问方向 / 遗漏提醒 / 议题小结）+ 负面情绪提示（分级色带，**仅标注事实、不给建议**） | 新卡片高亮；可「暂停侧写」（仅停 LLM 抽样，规则提示保留）；降级态显式提示 | `interview-sidecar-panel.tsx` |
| 7 | 提纲 checklist | 由 `outlineDraftMarkdown` 解析条目；覆盖态 = AI 建议 + 手动勾选 | 命中高亮；点击切换；可折叠；显示「已聊 n/m」 | `interview-outline-checklist.tsx` |
| 8 | TTS 开关 | 默认**关**；开启仅朗读「可追问建议」 | 开启时提示「建议佩戴耳机，避免被麦克风收录」；朗读期间暂停字幕识别 | 控制条内 |

- 情绪提示沿用既有等级中文映射 `getEmotionLevelLabel`（notice=提示 / warning=关注 / high=高度关注），**不新建词表**。
- **情绪提示定位（任反馈修正）**：给**后台编辑**看、不展示给前端用户；只关注**负面情绪**（创伤 / 悲痛 / 激动），文案**只标注事实**（如「检测到负面情绪波动」），**不给编辑建议**（不写「保持庄重」「避免煽情」「建议暂停」等话术）；用途是访谈中提示主持人是否暂停 / 调整。
  - 冲突待确认：「不展示给前端用户」与「提示主持人」（主持人即前端用户）并存，最终展示位置见 §13 待确认项 2；默认口径为控制台保留中性提示、后台编辑视角随 REQ-17 落地。
  - 存量数据注意：现有 `emotionalSignals` 中存在 notice 级**正面**情绪样例（如「幽默与乐观」「輕鬆愉快」），新规则**不再产出**正面情绪，存量数据不迁移。
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
  "emotionHints": [{ "level": "warning", "label": "…", "excerpt": "…" }],
  "degraded": false
}
```

- **不出建议话术**：`emotionHints` 只返回 `level` / `label` / `excerpt`，**不返回 `guidance`**（任反馈修正：系统不给编辑 / 主持人写安抚或追问建议）。该字段也不在新增类型 `src/lib/types/interview.ts` 中定义，`types/project.ts` 的 `EmotionSignal` **不动**（存量 `guidance` 的调整属 UI-07）。
- **失败非致命**：任何 LLM 异常 / 超时 / 解析失败 → `200 { degraded: true, coveredItemIds: [], sideNotes: [], emotionHints: [] }`，**不返回 5xx**（实时场景不宜弹错）。
- 实现要点：`getLlmProvider().askQuestion(prompt)`（**不改 provider 接口**，mock/ark 双实现零改动）；用 `Promise.race` 加 15s 服务端超时；返回前做白名单归一化（`level` 限枚举、去重、`sideNotes ≤3`、`emotionHints ≤2`、字段截断）。

### 4.4 复用且不改的既有路由

- `POST /api/projects/{projectId}/process` —— 结束后触发讯飞归档与整理。
- `GET /api/projects`、`GET /api/projects/{projectId}` —— 列表 / 详情。
- `PATCH /api/projects/{projectId}` —— 既有 `safeBody` 透传可改 `confidentialityLevel` 等字段（**接口层已具备能力，UI 入口本期不做**）。

### 4.5 AI 提问引擎（路径待定）

- ⚠️ **路径冲突**：整理稿问答已占用 `POST /api/projects/{projectId}/ask`（`src/app/api/projects/[projectId]/ask/route.ts`，已核实）。REQ-14 的 AI 提问引擎需另择路径，建议 `POST /api/projects/{projectId}/interview/next-question`（与 §4.2 / §4.3 的 `interview/*` 家族一致）。
- 请求超时 15s（服务端）；失败兜底见 §7-6。（出参草案待 Phase 1 确认，本节暂不定义字段。）

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
- 暂停访谈时停止 `SpeechRecognition`，恢复时重新 `start()`，已识别文字追加不覆盖。

## 6. AI 侧写触发策略（D8=C）

两条独立通路：

| 通路 | 触发 | 延迟 | 成本 | 产出 |
| --- | --- | --- | --- | --- |
| 规则引擎（**为主**） | 每条 `final` 即时 | 0（本地） | 0 | 情绪提示 |
| LLM 抽样（增强） | 见 6.2 频控 | 1~10s | 每轮 1 次调用 | checklist 覆盖建议 + 侧写卡片 + 情绪升级 |

### 6.1 规则引擎（`src/lib/interview-signals.ts`，纯函数）

- 词表分级（**只收负面情绪**，不产出正面情绪）：自伤 / 他伤 / 虐待 → `high`；哭泣 / 哽咽 / 愤怒 / 崩溃 / 长时间沉默 → `warning`；战争 / 灾难 / 丧亲 / 去世 / 饥荒 → `notice`。
- 去重：同类别 **30s 冷却**，避免刷屏。
- 文案规范：**只标注事实**，输出「检测到负面情绪波动」（可带片段与等级），**不输出任何建议**（不写「建议暂停」「先照顾受访者情绪」「保持庄重」「避免煽情」等）；`high` 时可同时**中性横幅 + 立即尝试一次 LLM 抽样**（若未熔断）以补充侧写内容；规则本身不依赖 LLM。
- 与 D8 的关系：**规则 = 实时、必达、不依赖网络；LLM = 抽样、增量、可降级**。两者产出合并去重后进侧写区，分别标记 `source: "rule" | "llm"`。
- 触发逻辑：关键词命中即触发，不做情绪分类评分（简化版，后期可升级为 LLM 情绪判断）；此处「不做评分」指不输出连续分值 / 置信度，仍按本词表分 `high` / `warning` / `notice` 三级。
- 触发后行为：见 §3 模块 4。

### 6.2 LLM 抽样频控（双闸 + 熔断）

- 触发条件（全部满足）：处于 `recording` 且未「暂停侧写」；`新增 final 字数 ≥ 240` **或** `距上次抽样 ≥ 90s`；`距上次调用 ≥ 45s`；`callCount < 24`。
- 熔断：连续 3 次失败/超时 → 本次访谈停止 LLM 抽样，UI 提示「AI 侧写暂不可用，规则提示仍生效」。
- 幂等：请求携带上一轮 `coveredItemIds`，只要求模型返回「新增覆盖」，降低重复。
- 无输入不调用：`recentTranscript` 为空或全空白 → 跳过本轮，不发请求。

### 6.3 写作规则注入（婷婷写作规则）

- 规则文档（已核实存在，位于 `D:\Users\25425\Documents\SHSE-Cup\midterm\1.内容`）：
  - `03_AI语言输出规范.docx` —— 语言 / 句式主规则（四大原则、语病与语序修正边界、分级适配）。
  - `07_口述史写作模板.docx` —— 段落结构模板（章节骨架）。
  - `05_最终交付文本标准与文本内容测试标准.docx` —— 交付与格式标准（可选并入）。
- 注入方式：整理阶段 system prompt 末尾附加规则全文（或摘要），作为写作约束。
- 占位符：`{{WRITING_RULES}}`，规则文档到位后填入；文档未到位时回退默认口语化整理风格。
- 涵盖：专业术语规范、句式风格、段落结构、禁用词表（待规则文档确认后细化）。
- 注：文档为 `.docx`，注入前需转纯文本（本期人工粘贴，**不引入 docx 解析依赖**，符合 §0.1）。

## 7. 兜底策略（侧写链路 + 提问链路）

分层兜底，任何一层失败都不阻断访谈：

1. **服务端**：`Promise.race([askQuestion, 15s])` + `try/catch` + 容忍式 JSON 解析（可剥离 ```json 围栏与前后噪声）→ 失败返回 `200 { degraded: true, …空 }`。
2. **白名单归一化**：`level` 仅接受 `notice|warning|high`；`coveredItemIds` 只保留存在于请求 checklist 的 id；`sideNotes ≤3`、`emotionHints ≤2`；各字段按长度截断。
3. **前端**：`AbortController` 10s 超时；失败静默，**保留上一轮侧写与 checklist 状态**；连续 3 次失败熔断。
4. **本地兜底产出**：`degraded` 时用规则引擎结果生成一条本地侧写（如「上一段检测到情绪波动片段，已记录」——**只陈述检测事实，不给编辑 / 主持人任何建议**），保证侧写区**非空**，并标注「本地提示」。
5. **mock 环境**：`LLM_PROVIDER=mock` 下 `askQuestion` 返回自由文本 → 解析失败 → 走兜底 4，demo 仍可用（侧写以本地提示呈现）。

**提问链路兜底（AI 主访新增）**：

6. **超时兜底**：`next-question` 超过 15s → 自动跳下一问并标注「待补录」；访谈结束后在控制台提示「N 个问题未充分展开」。
7. **识别失败兜底**：连续 3 次**非 `no-speech` / `network`** 类 `onerror` → 停用识别并提示「转录不可用（录音仍在）」，AI 提问链路降级为「按提纲顺序逐问」（不依赖识别文本）。
8. **崩溃恢复**：控制台意外刷新 / 关闭 → 从 `localStorage`（**仅本地、不上云、不走 REQ-15**）恢复「当前题号 + 已识别文字 + 触发时间戳」。

## 8. hardening 清单处理方案

### 8.1 `collectionScenario` / `privacyLevel` 裸 cast（`src/app/api/projects/route.ts`）

**现状（已核实）**：

- `route.ts:30` 已有 `parseEnumValue`，`:18` / `:24` 已有 `confidentialityLevelValues` / `collectionPathValues`，且 `:117` / `:122` 已在用。**（以上行号为 v1.2 时点；该 hardening 已按本节落地）**
- 但 `:108-110` 的 `collectionScenario` 与 `:113-115` 的 `privacyLevel` **仍是裸 cast**，空串 / 非法值 / 中文值会原样透传落库。

**方案**：

1. 新建 `src/lib/server/enum.ts`，把**已有的** `parseEnumValue` 与允许值常量**迁移**过去（route 文件不能被其它 route import，新路由必须走共享模块），并补齐 `ALLOWED_COLLECTION_SCENARIOS` 与 `ALLOWED_PRIVACY_LEVELS`，另含 `ALLOWED_CONFIDENTIALITY_LEVELS` / `ALLOWED_COLLECTION_PATHS` / `ALLOWED_INTERVIEW_MODES`（**已落地**，见 `src/lib/server/enum.ts`）。
2. `projects/route.ts` 删除本地定义，改为从 `enum.ts` 导入；把 `:108-110`、`:113-115` 两处裸 cast 改为 `parseEnumValue(...)`。
3. 新路由 `ai-interview` 复用同一 helper，**全程只有一份白名单**。
4. 保留既有业务校验：`custom` + 空 `customScenarioLabel` → 400。

**验收**：`collectionScenario` 传 `""` / `"URBAN_MEMORY"` / `"城市记忆"` / `"garbage"` → 落 `urban_memory`；传 `"red_memory"` → 原样保存；`privacyLevel` 同理退回 `standard`。

### 8.2 `src/proxy.ts` BUG-06：未登录 `/api/*` 应返 401 不 307

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

**回归影响（已核实）**：`useAuth` 调 `/api/auth/me`，原来跟随 307 到 `/login`（HTML，`res.ok === false`），现在直接 `401`（`res.ok === false`）→ 行为等价，无回归。

**验收**：无 cookie `GET /api/projects` → `401` JSON；有 cookie → `200`；无 cookie `GET /` → `307 /login?redirect=%2F`；失效 token 访问 `/api/*` → `401`（不再附带 `reason` 参数）。

## 9. 验收标准

### A. 流程与接口

1. 流程内分流步点「AI 实时访谈」→ 生成项目（`collectionPath="ai_interview"`、`audioFileName=""`）→ 落在 `/projects/{id}/interview`（2026-10-05：入口由提纲工作台移入分流步，D7=B′）。
2. 分流步「上传音频」行为不变（回归通过，`/upload?outline=1`）；流程内提纲步的「确认提纲，下一步」/「跳过提纲，下一步」与独立页时代的确认 / 跳过语义等价（回归通过）。
   - 补充（2026-10-05，D7=B′）：空提纲时点「AI 实时访谈」**不发起建项目请求**，改弹 `[data-route-modal="outline-required"]` 引导回填；有提纲时建项目成功并落到 `/projects/{id}/interview`（由 `tmp/verify-phase3.mjs` G 段断言覆盖）。
3. 结束访谈后 `POST .../interview/audio` 返回 200；项目详情「受访音频」显示 `interview-{id}.wav`，`workflow.upload = completed`。
4. 归档触发后状态依次 `transcribing → ai_refining → manual_review`，处理台可见；docx / txt / json 三格式导出**全部回归通过**（导出 API 零改动）。
5. 未登录 `POST /api/projects/ai-interview` → **401 JSON**（非 307）。
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
    - 情绪提示**只标注事实**：界面与出参均不含「建议 / 安抚 / 暂停 / 保持庄重 / 避免煽情」等建议性措辞；`emotionHints` 序列化结果中**不出现 `guidance` 字段**；规则引擎对正面情绪样例（如「幽默与乐观」「輕鬆愉快」）**不产出**提示。
19. 累计新增 final ≥240 字 → 触发 1 次 sidecar；45s 内再次满足条件不重复调用（抓包计数）。
20. LLM 返回非法 JSON / 超时 → 接口 `200 { degraded: true }`；UI 不弹错、既有侧写保留、出现一条「本地提示」。
21. 连续 3 次失败 → 后续不再发起 sidecar 请求，UI 出现降级提示；规则提示继续工作。
22. `callCount` 达 24 → 停止抽样（规则提示不受影响）。

### F. TTS（D6）

23. 默认关闭，页面无朗读；开启后仅朗读「可追问建议」；朗读期间不产生新的 final 字幕（回灌被抑制）。
24. 关闭开关后立即停止朗读。

### G. 回归与布局

25. 原「音频上传」链路（`/upload`）与 REQ-13 提纲预填、`?outline=1` 草稿带入**全部回归通过**。
26. `tmp/cdp-req13-outline.mjs`、`tmp/cdp-req13-crosscut.mjs`、`tmp/measure-375.mjs`（375px header 高度基线）**全部保持通过**；REQ-16 的三脚本断言迁移由 `tmp/verify-phase3.mjs` 承接（2026-10-05：原 23 条全绿，并补 G 段「有提纲 → 点 AI 实时访谈 → 建项目并落 `/projects/{id}/interview`」，共 **24/24**）。

### H. 一票否决项的本期口径（05 交付文本标准）

05《最终交付文本标准与文本内容测试标准》的 4 条一票否决项，**本期只验第 1 条与第 4 条**，另 2 条本期不可达、不验（原因见下）：

| # | 一票否决项 | 本期口径 |
| --- | --- | --- |
| 1 | 事实零错误 | **验**：`tmp/verify/verify-req14-prompts.ts` 第 7 组断言锁定 Prompt B 的「只按转写原文陈述」「禁止修正、只能标记」「事实存疑标【待人工核实】」 |
| 2 | 模板章节完整率 100% | 不验（本期不可达）：依赖导出侧按 07 模板渲染章节，而导出 API 本期零改动（§11.5）；整理侧已按 D8 在 Prompt B 落「aiDraft 按模板五章组织」 |
| 3 | 共用要素齐全率 100% | 不验（本期不可达）：07 元信息 12 项属导出封面职责，见 §13 待确认项 9 |
| 4 | 脱敏合规 | **验**：Prompt B「严格遵守「严禁自行脱敏」，只标记、不替换、不删除」与 `ark-llm-provider.ts` 既有 requirement 1 同口径（断言比对两份源码） |

## 10. 不做边界（本期明确不做）

- 视频采集（D4=A 仅音频）。
- AI 自主生成提纲外议题（AI 仅按已确认提纲提问 / 追问，不新增议题）。
- 讯飞流式 IAT 及任何新的付费识别能力。
- 说话人分离（Web Speech 单通道，无法区分主持人与受访者）。
- 实时字幕与 checklist 覆盖态**落库**（仅内存/会话级；归档以讯飞转写稿为准）。
- 移动端专项适配。
- Web Speech 的 polyfill / 离线识别 / 第三方识别替代。
- 多轨录音、断点续录、录音后剪辑。
- 云端草稿与跨设备续访（属 REQ-15 草稿箱范畴）。
- TTS 语音克隆、唤醒词、自动朗读字幕。
- 向用户 / 编辑输出安抚、追问或「保持庄重」「避免煽情」类**建议话术**（情绪提示只标注事实，见 §6.1）。
- 把情绪提示写入导出文件（导出 API 零改动；存量导出中的「建议：{guidance}」调整属 UI-07）。
- 存量处理台情绪面板的展示位置调整（属 UI-07，需先裁决 §0.2 / §0.4 是否解冻）。
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
| `src/lib/writing-rules.ts` | 写作规则收敛（03 语言规范 + 05 内容标准 + 07 五类模板）：`WRITING_RULES_TEMPLATE`、`OUTLINE_WRITING_TEMPLATES`、`resolveWritingTemplate`、`buildWritingRules`（纯函数，含 `OUTPUT_GRADE`） |
| `src/lib/interview-prompt.ts` | AI 提问 prompt 构建与出参容错：`buildInterviewQuestionPrompt`、`parseInterviewQuestionOutput`（含 `followUpCount>=2` 硬强制）、`INTERVIEW_QUESTION_TIMEOUT_MS = 15_000` |

### 11.3 新增（API）

| 文件 | 用途 |
| --- | --- |
| `src/app/api/projects/ai-interview/route.ts` | 创建 AI 访谈项目（D7） |
| `src/app/api/projects/[projectId]/interview/audio/route.ts` | 访谈录音落盘与回填 |
| `src/app/api/projects/[projectId]/interview/sidecar/route.ts` | AI 侧写抽样 |

### 11.4 修改（3 个既有文件）

| 文件 | 改动 | 依据 |
| --- | --- | --- |
| `src/proxy.ts` | BUG-06：`/api/*` 未登录 / 失效返 401 JSON，页面仍 307 | §8.2 |
| `src/app/api/projects/route.ts` | 删除本地 `parseEnumValue` 与常量（迁至 `enum.ts` 后导入）；`:108-110` `collectionScenario`、`:113-115` `privacyLevel` 改用 `parseEnumValue` | §8.1 |
| `src/components/outline/outline-plan-workspace.tsx` | 「确认提纲」处新增「进入 AI 访谈」分支 → 调 `ai-interview` 建项目 → 跳控制台；既有「确认提纲，进入上传」按钮不变 | D7=B → **2026-10-05 修订（D7=B′）**：该文件在流程内以 `embedded` 复用，AI 分支按钮在 `embedded` 下不再渲染（`outline-plan-workspace.tsx:530/532`），建项目入口改由分流步承担（`route-chooser.tsx:125-174`，`#route-chooser-realtime`）；文件既有确认 / 跳过链路零删除 |

### 11.5 明确不修改

`src/lib/server/project-store.ts`、`src/lib/server/upload-store.ts`、`src/lib/server/storage.ts`、`src/app/api/projects/[projectId]/export/route.ts`、`src/lib/providers/transcription/*`、`src/components/home/home-dashboard.tsx`、`src/components/upload/interview-upload-form.tsx`。

### 11.5.1 最小解冻（仅 1 行插槽，已落地 2026-10-03）

原「明确不修改」中的三个文件因**写作规则注入**（§6.3 / D6）各解冻 1 处，除此之外零改动：

| 文件 | 改动（逐字） | 依据 |
| --- | --- | --- |
| `src/lib/providers/llm/types.ts` | `LlmRefineInput` 增加 `writingRules?: string;`（+1 行） | §6.3 注入口 |
| `src/lib/providers/llm/ark-llm-provider.ts` | `refineTranscript` 的 prompt 数组在 `"Transcript:"` 之前插入 `...(input.writingRules ? [input.writingRules] : []),`（+1 行；未传时既有 prompt 逐字不变） | §6.3 |
| `src/lib/server/process-project.ts` | 新增 `import { buildWritingRulesForProject } from "@/lib/writing-rules";`；`refineTranscript({...})` 入参增加 `writingRules: buildWritingRulesForProject(project),`（+2 行） | §6.3 / D6 |

> 已核验（2026-10-03）：`git diff --numstat` 分别为 `1/0`、`1/0`、`2/0`（纯新增、零删除）；`writingRules` 未传时整理 prompt 与现状逐字一致（既有 9 条 requirement 不变）。
> 说明：本次解冻只动 provider 的输入契约（`LlmRefineInput.writingRules`）；**未触碰 §0 第 2 条「不改数据层」**：`ProjectRecord` / `project-store.ts` / `storage.ts` 零改动（`types/project.ts` 仅被读取类型，未被修改）。

> 说明：上传页 Step 2 的「AI 访谈」卡片是硬编码 `disabled`（`interview-upload-form.tsx:662`），且该表单提交链路强制要求音频文件（`src/app/api/projects/route.ts:151-156`）。本期**保持 disabled 与「即将开放」文案不变**（2026-10-05 复核：REQ-16 / REQ-21 落地后该卡片口径未变）。AI 访谈入口**唯一在流程内分流步**（**D7=B′，2026-10-05 修订 —— 原「唯一在提纲工作台」随 REQ-16 Phase 3 作废**）；上传页与首页的入口重构已由 REQ-16 收口。

### 11.6 新增（验收脚本）

| 文件 | 覆盖 |
| --- | --- |
| `tmp/verify/verify-req14-ai-interview.ts` | 建项目路由：枚举回退、必填 400、401 |
| `tmp/verify/verify-req14-sidecar.ts` | 侧写路由：401 / 403 / 空输入 / degraded / 白名单归一化 |
| `tmp/verify/verify-interview-signals.ts` | 规则引擎分级、去重冷却、频控与熔断 |
| `tmp/verify/verify-outline-parser.ts` | 提纲解析（空 / 超长 / 异常 markdown） |
| `tmp/verify/verify-proxy-api.ts` | proxy：`/api/*` 401 vs 页面 307 |
| `tmp/verify/verify-req14-prompts.ts` | 两份 prompt 模板 7 组断言：枚举覆盖 / 模板逐字（07 docx 直读）/ 零占位符 / 体积与切片 / JSON 容错 / 追问上限 / 脱敏口径（116 条断言全绿） |
| `tmp/cdp-req14-interview.mjs` | 控制台端到端（stub SpeechRecognition / 录音，断言状态机、sidecar 调用、结束 → 上传 → 跳处理台） |

## 12. 关键实现参数速查

| 项 | 值 | 依据 |
| --- | --- | --- |
| 录音格式 | WAV，单声道 16kHz / 16bit | 讯飞与存储层双兼容 |
| 体积 | 32 KB/s = **1.92 MB/min** | 16kHz × 16bit × 1ch |
| 硬上限 | **100MB ⇒ ≈52 分钟** | `upload-store.ts:51` |
| 接近上限提示 | 45 分钟起 | 本 PRD 定 |
| 落盘命名 | `interview-{projectId}.wav`，`type: "audio/wav"` | 命中 `allowedExtensions` 与 `normalizeExtension` 的 `audio/wav` 分支 |
| 设计口径（产品方） | **≈1.9 MB/min、50 分钟上限** | 与上两行精确值等价（1.92 MB/min、100MB ≈ 52 分钟、45 分钟起提示） |
| 讯飞格式判定 | 取 `audioFileName` 扩展名 → `wav` | `xfyun-transcription-provider.ts:19-23` |
| LLM 抽样阈值 | 新增 final ≥240 字 或 ≥90s | 本 PRD 定 |
| LLM 冷却 / 上限 | ≥45s、`callCount < 24` | 本 PRD 定 |
| 服务端 / 前端超时 | 15s / 10s | 本 PRD 定 |
| 规则去重冷却 | 同类 30s | 本 PRD 定 |
| 上下文切片 | `recentTranscript ≤4000 字`、checklist ≤40 条 | 本 PRD 定 |
| 熔断 | 连续 3 次失败 | 本 PRD 定 |
| 情绪提示出参字段 | `level` / `label` / `excerpt`（**无 `guidance`**） | 任反馈修正，§4.3 |
| 情绪提示范围 | 仅负面情绪（创伤 / 悲痛 / 激动），只标注事实、不给建议 | 任反馈修正，§6.1 |

## 13. 待确认项（不阻塞开工）

1. ~~交互方式（A / B / C）待产品方（任）确认~~ —— **✅ 已确认（2026-10-03）：D2=A（AI 主访）**；任接受文本模型单轮 3-10s 延迟，中期不要求实时语音模型（见 §0.1）。REQ-14 状态相应为「已拍板，进入开发排期」（见 `docs/需求登记表.md` §1.2）。
2. ~~**PRD 正文按方案 A 改稿的范围与排期**（现正文 §1 ~ §9 仍为原方案 B 卷）~~ —— **✅ 已实施（v1.3，2026-10-03）**：AI 提问编排与追问上限、TTS 朗读口径、情绪暂停与恢复、写作规则插槽（§6.3）、§10 已作废条目重写均已在正文落地。
3. **情绪提示最终展示位置**：「给后台编辑看、不展示给前端用户」与「访谈中提示主持人是否暂停」需明确分工或二者取一；默认口径为控制台保留中性提示、后台编辑视角随 REQ-17 落地。存量处理台 / 导出的联动改动属 **UI-07**，需裁决 §0.2 / §0.4 是否解冻。
4. `confidentialityLevel` 建项目时默认 `internal`、不弹确认窗；控制台只读展示。事后修改需 UI 入口（本期不做）。
5. ~~REQ-14 入口唯一在提纲工作台；首页与上传页不动，等 REQ-16 统一重构。~~ —— **✅ 已收口（2026-10-05）：唯一性改为「流程内分流步唯一」（D7=B′）；首页收敛为单入口、上传页「AI 访谈」卡片保持 `disabled`，REQ-16 / REQ-21 已验收。**
6. ~~REQ-16 与 REQ-14 的排期顺序：本 PRD 假设 REQ-14 先行、REQ-16 后续重构入口。~~ —— **✅ 已按此顺序执行完毕（2026-10-05）：REQ-14 先行、REQ-16 Phase 3-5 后续重构入口，无返工。**
7. **v1.3 新增待确认项**：① 写作规则文档最终清单（§6.3 列出的 3 个 docx 是否全用、禁用词表是否单独成表）；② 情绪暂停的形态（已按 §3 模块 4 复用 `paused` 态实现，是否需要独立暂停页）；③ 同一题连续追问上限 2 次是否需要可配置。
8. ~~**写作规则文档最终清单**~~ —— **✅ 已定稿（2026-10-03）**：03（语言规范）+ 05（内容标准）+ 07（5 类模板章节骨架）三份全用，落盘为 `src/lib/writing-rules.ts`（`WRITING_RULES_TEMPLATE` + `OUTLINE_WRITING_TEMPLATES`）；05 的「禁用词表」并入【语言规范】节、不单独成表；同一题追问上限**固定 2 次、不做配置**（`MAX_FOLLOW_UP_COUNT = 2`，路由侧硬强制）。
9. **07 元信息 12 项（共用要素齐全率）本期不可达**：07 模板的元信息 12 项属**导出封面**职责，导出 API 本期零改动（§11.5），故 05 的「共用要素齐全率 100%」本期不验；建议随 **UI-07** 统一处理导出侧模板渲染（含 §9-H 第 2、3 条）。
