# IMPL · REQ-28 全局冗余提示词清理（KIMI 文案审查）

> **上位文档**：`docs/PRD_REQ-28_文案清理.md`（PRD 定稿，2026-10-06 总管审核通过）＋ `docs/需求登记表.md` v2.5 的 REQ-28 行（登记 commit `65d30c0`）
> **本文件**：`docs/tasks/IMPL_REQ-28_文案清理.md`（`docs/tasks/` 未跟踪，不入 commit —— 见 §5.7）
> **性质**：实施计划。只回答两件事 ——「改哪个文件的哪类文案」「哪些探针要跟着改」。**全文不写行号**：行号会随任何一次编辑漂移，实施时一律按「文件 ＋ 字面」检索复核。
> **编写期边界**：本文档编写过程零改码，`src/**` 与 `tmp/**` 均未被触碰。

---

## §0 读前须知：七处事实偏离 ＋ 四项已定口径

### 0.1 与 PRD 记载不一致的七处事实（**一律以代码实测为准**）

| # | PRD 记载 | 代码 / 探针实测 | 对实施的影响 |
| --- | --- | --- | --- |
| ① | F 类标签字面为 `PROFILE` / `EDITABLE` / `AUDIO` / `STEP 02 • AI 访谈` | 源码里是 **Title Case** 字面：`Profile` / `Editable` / `Audio` / `Step 02 · AI 访谈`；全大写只是 `src/app/globals.css` 的 `.tape-label { text-transform: uppercase }` 产生的视觉效果 | F 批一律按 Title Case 检索（如 `>Profile<`）。按全大写搜索**零命中**，照抄 PRD 现状列会找不到落点 |
| ② | F-02 / F-03 / F-04 是「`EDITABLE` 三处」 | `src` 全域 `Editable` **只有 1 处字面**（提纲内容卡右上角），UI 上随「生成结果 / 预览编辑 / Markdown 编辑」三态复用 | F-02/03/04 是**同一次改动**：改净 1 处即 3 条达标 |
| ③ | C-01 现状 `STEP 02 • AI 访谈` | 实际字面是 `Step 02 · AI 访谈`，访谈页 **3 处**（准备 / 进行 / 暂停三态共用同一行代码） | C-01 与 F-06 是**同一处**，只在 **F 批执行一次**；C 批不重复改 |
| ④ | B-06 / B-07 / B-12 / B-13 / B-16 / B-17 各只有一句按钮文案 | 这 6 条落在同一个**双变体三元式**上：`embedded ?「跳过提纲，下一步」: 「跳过，直接上传」`、`embedded ?「确认提纲，下一步」: 「确认提纲，进入上传」`（`src/components/outline/outline-plan-workspace.tsx`）。**独立页那一套 PRD 未列** | 本批只改 **embedded（流程内）** 一套；独立页一套按 0.2-D1 **不动** |
| ⑤ | B-11 / B-15 现状「发送修改建议」 | 代码字面是「**发送修改**」（全域 `发送修改建议` 零命中；`发送修改` 仅 1 处，预览/编辑态与 Markdown 编辑态**共用同一按钮字面**） | 以代码为准；B-11 与 B-15 **合并为一次改动** → 「提交修改」 |
| ⑥ | B-08 / B-09 / B-10 位置记为「02 提纲（预览/编辑）界面」 | 三句的字面落点在**生成侧模板** `src/lib/providers/llm/ark-llm-provider.ts`（画像摘要段与提纲模板的 prompt 文本） | 属生成侧，与 UI-27 / UI-28 同面 → 按 0.2-D2 **移出本批** |
| ⑦ | E-03 ~ E-10 位置记为「处理进度各步骤」 | 文案常量在 `src/lib/types/project.ts` 的 `PROCESS_STEPS`（每步 `label` / `description`）；`project-workflow-board.tsx` 只做渲染 | 按 0.2-D2 **授权只改字面量**；E-20 同理落在 `src/lib/writing-rules.ts` |

**另有 4 组「PRD 未列的同类文案」（本批不改，仅登记备查）**

| 组 | 实测波及 | 说明 |
| --- | --- | --- |
| `Confidentiality` 标签 | `src/components/upload/interview-upload-form.tsx`（1 处，与 F-05 的 `Audio` 同屏同族，同属 `.tape-label`） | 本批不清；若日后统一英文字面，须与 F-05 同批处理 |
| 「记忆引擎」眉标 | **8 个文件**：`app/layout.tsx`、`app/login/page.tsx`、`app/register/page.tsx`、`components/home/home-dashboard.tsx`、`components/upload/upload-workspace.tsx`、`lib/interview-prompt.ts`、`lib/writing-rules.ts`、`lib/server/project-export.ts` | D-01 只列上传页 1 处；其余 7 处含服务端与导出侧 → 0.2-D4 不动 |
| 同词副本 | 「受访音频」6 文件、「建档时间」「待处理」「脱敏」「要素标引」「脱敏整理稿」等在 `app/api/**`、`app/projects/[projectId]/page.tsx`、`lib/server/project-export.ts` 另有副本 | 只改**界面呈现处**，不动服务端与导出文本 |
| 状态键 | 「待处理」之类同词可能同时是**状态取值映射**，不是展示文案 | 只改胶囊 label 字面；**严禁**动状态键、类型联合与数据契约 |

### 0.2 四项口径（已定，2026-10-06 总管确认）

| 编号 | 裁决 | 后果 |
| --- | --- | --- |
| **D-1** | 独立页按钮一套（「跳过，直接上传」/「确认提纲，进入上传」）**本批不动** | `cdp-ui24-fixes.mjs`、`cdp-req13-prefill.mjs` 及 `verify-phase2.mjs` 中针对独立页的断言**无需改**（§3.3） |
| **D-2** | `src/lib` **两处授权**（`types/project.ts`、`writing-rules.ts`）只改字面量；**B-08 / B-09 / B-10 移出**本批，交 UI-27 / UI-28 | 本批覆盖 **85 条**（88 − 3） |
| **D-3** | 处置为「移到帮助」的 **7 条降级**：能替换的替换、无替换句的删除；帮助入口另立批次 | B-21 替换；B-04 / C-07 / D-06 / E-18 删除并登记回填；D-12 / E-27 随帮助批次 |
| **D-4** | §0.1 表末 4 组「PRD 未列同类文案」**本批不动** | 不扩大改动面，避免波及服务端与导出文档 |

### 0.3 本轮边界

本文档**只写计划**：`src/**`、`tmp/**` 零改动，不产生 commit。所有探针脚本的修改都在**本 IMPL 实施轮**进行，且只改 §3 列出的定位文案与正则。

---

## §1 实施范围与统计

### 1.1 条目口径（按 §0.2 重算，可与 PRD §6.4 对账）

| 项 | 条数 | 说明 |
| --- | ---: | --- |
| PRD §4 进入实施 | 88 | A 15 ＋ B 20 ＋ C 7 ＋ D 12 ＋ E 27 ＋ F 7 |
| 移出本批（生成侧，交 UI-27 / UI-28） | −3 | B-08 / B-09 / B-10 |
| **本 IMPL 覆盖** | **85** | A 15 ＋ B 17 ＋ C 7 ＋ D 12 ＋ E 27 ＋ F 7 |
| 其中「暂不动」（P-1 红线） | 2 | D-09 / D-10 |
| 其中「随帮助入口批次」 | 2 | D-12（无代码落点）/ E-27（帮助层收纳补遗） |
| **本批实际落地** | **81** | 删除 / 替换 / 精简；其中 4 条由「移到帮助」降级 |

> 对账：PRD §6.4 记「可直接执行 86 条」＝ 88 − 2（暂不动）。本表 81 ＝ 86 − 3（移出）− 2（随帮助批次）。

### 1.2 批次、优先级与实施序

| 批次 | 内容 | 本批条数 | 优先级 | 实施序 | 联动 |
| --- | --- | ---: | --- | ---: | --- |
| **F** | 全局英文 / 编号标签清理 | 7 | P1 | 1 | 无；做完可 grep 归零校验 |
| **B** | 新建项目 01~03（基本信息 / 提纲 / 分流支路） | 17 | P1 | 2 | 与 UI-27 / UI-28 划界（B-08/09/10 已移出） |
| **A** | 首页 / 项目工作台 ＋ 历史项目列表 | 15 | P1 | 3 | 与 UI-11 同面（A-01） |
| **D** | 上传音频全流程 | 12 | P2 | 4 | 与 UI-05 同批（D-06 / D-12）；知情同意 2 条暂不动 |
| **E** | 项目详情页全流程 | 27 | P2 | 5 | 与 UI-08 / UI-17 同批（E-19 / E-26） |
| **C** | AI 访谈全流程 | 7 | P2 | 6 | C-01 已在 F 批完成 |

### 1.3 不做什么（负面清单）

- 不改流程、不改交互结构、不动数据契约（PRD「边界」）。
- 不新建「？」帮助入口 —— 7 条「移到帮助」已降级（0.2-D3）；帮助入口另立批次（回填清单见 §5.6）。
- 不改服务端与导出文本（`lib/server/project-export.ts` 等），不改状态键与类型联合。
- 不改 `docs/` 之外的任何脚本；探针改动仅限 §3 清单。
- 不顺手修 `cdp-ui24-fixes.mjs` 中 UI-26 遗留断言（与本批无关，见 §3.4）。


---

## §2 代码落点表（文件粒度 · 不含行号）

> 用法：每行 = 一条 PRD 编号的**实施动作单**。`落点` 列给「文件 ＋ 检索字面」；`改动类型` 沿用 PRD §4 通用说明①的取值（删除 / 替换 / 移到帮助 / 暂不动），并按 §0.2 标注降级结果；`备注` 写明字面实测差异、多处复用、牵连与红线。
> 检索字面**以代码实测为准**（§0.1）：PRD 现状列里的 `STEP 02 •`、`发送修改建议`、全大写标签均为转写后的样子，照抄会找不到落点。

### 2.1 A 批 · 首页 / 项目工作台 ＋ 历史项目列表（15 条）

| 编号 | 落点（文件 ＋ 检索字面） | 改动类型 | 备注（实测 / 复用 / 牵连） |
| --- | --- | --- | --- |
| A-01 | `src/components/home/home-dashboard.tsx` — 新建卡片标题下说明段 | 删除（保留则替换） | 替换句「创建项目并生成访谈提纲」；与 UI-11 同面 |
| A-02 | `home-dashboard.tsx` — 「草稿」标签 ＋「未完成的草稿」标题 | 替换 | 同一卡片内两处字面同改；目标「进行中 / 未完成的访谈」 |
| A-03 | `home-dashboard.tsx` — 草稿空态灰字 | 删除（保留则替换） | 替换句「进行中的项目会显示在这里」 |
| A-04 | `src/components/home/recent-project-list.tsx` — eyebrow「项目索引」 | 删除 | 仓库**无独立列表页路由**（`src/app/projects/page.tsx` 不存在），`RecentProjectList` 仅被 `home-dashboard.tsx` 引入 → A-04 与 A-06 **疑为同一渲染点**（同一处被截图两次）；实施时以界面复核确认 |
| A-05 | `home-dashboard.tsx` ＋ `recent-project-list.tsx` — 「历史项目」 | 替换 →「我的项目」/「项目列表」 | 区头与列表件同词两处，须一次改净（R4 同词表）；A-05 与 A-07 落点相同（同上） |
| A-06 | 同 A-04（`recent-project-list.tsx`） | 删除 | 与 A-04 同一字面 → 改一处两处同时生效 |
| A-07 | 同 A-05（列表件标题） | 替换 →「我的项目」 | |
| A-08 | `recent-project-list.tsx` — 计数胶囊「15 个项目」 | 替换 →「15 个」 | 数字由项目数量拼接 → 改的是**模板字面**，不是数字本身 |
| A-09 | `src/components/ui/status-badge.tsx` — 胶囊 label「待人工审校」 | 替换 →「待审核」 | 状态胶囊的唯一出口：改此处即「卡片 ＋ 详情页」同步；勿动状态键 |
| A-10 | `ui/status-badge.tsx` — 胶囊 label「待处理」 | 替换 →「处理中」/「整理中」 | ⚠ 同词另见 `app/api/projects/[projectId]/route.ts`、`app/api/projects/[projectId]/export/route.ts`、`project-overview-panel.tsx`、`project-workflow-board.tsx` → **只改胶囊 label**（0.2-D4） |
| A-11 | `recent-project-list.tsx` — 说明条「当前阶段：人工审校 · 待您审校」 | 删除（保留则替换 →「待您确认」） | 文案来源是 `project-workflow-board.tsx` 的 `getWorkflowStatusLabel()`，**首页卡片与详情页共用** → 须同时覆盖映射处与渲染处 |
| A-12 | 同 A-11 —「当前阶段：受访音频建档 · 进行中」 | 删除（保留则替换 →「音频整理中」） | KIMI 指定的最优先 6 处之一 |
| A-13 | `recent-project-list.tsx` — 字段「受访音频：…」 | 替换 →「音频：已上传 / 音频：待上传」 | KIMI 最优先之一；同词另见 `app/projects/[projectId]/page.tsx` 信息行 eyebrow、`app/not-found.tsx`、`api/projects/route.ts`、`lib/types/project.ts`（2 处）→ **一律不动**（0.2-D4） |
| A-14 | `recent-project-list.tsx` — 信息区「建档时间」 | 替换 →「创建时间」 | 同词另见 `app/projects/[projectId]/page.tsx`、`lib/server/project-export.ts` → 不动 |
| A-15 | `recent-project-list.tsx` ＋ `project-workflow-board.tsx` — 进度模块「进度 / 3 / 5 已完成」 | 替换 →「进度 / 已完成 3/5」 | 分子分母由进度值拼接 → 只改模板字面；`project-processing-console.tsx` 另有「当前阶段」类同词，实施时 grep 判定是否同语义 |

### 2.2 B 批 · 新建项目 01~03（17 条；B-08/09/10 已移出、B-14 早已移出）

| 编号 | 落点（文件 ＋ 检索字面） | 改动类型 | 备注（实测 / 复用 / 牵连） |
| --- | --- | --- | --- |
| B-01 | `src/components/new-project/basic-info-form.tsx` — 多行输入框 `placeholder` | 替换 →「补充事件、人物、时间线等背景信息」 | **placeholder 属性**而非正文；只改字符串，不动 `name` / `id` |
| B-02 | `basic-info-form.tsx` — 底部主按钮「下一步：生成提纲」 | 替换 →「下一步」（或「生成提纲」） | 探针只有 `verify-phase3.mjs` L597 的 `clickText('下一步')` —— **子串匹配**，旧文案含同名子串 → 改后仍命中，**无需改探针**；步骤判定另靠 `aria-current="step"` |
| B-03 | `src/components/outline/outline-plan-workspace.tsx` — 卡片标题「受访者画像」＋「必填信息」 | 替换 →「访谈信息」（或保留「受访者画像」、去「必填信息」） | 两处字面在同一标题行，同改 |
| B-04 | `outline-plan-workspace.tsx` — 卡片底部灰字「生成后可自由修改，提纲不会自动上传。」 | 删除 | 原为「移到帮助」→ 按 0.2-D3 **降级删除**；帮助批次须回填（§5.6） |
| B-05 | `outline-plan-workspace.tsx` — 生成结果区提示「正在生成提纲...」 | 替换（标点）→「正在生成提纲…」 | 仅把三点省略号改为单字符省略号；注意不要误伤同屏加载态按钮文案 |
| B-06 / B-12 / B-16 | `outline-plan-workspace.tsx` — 底部次按钮（**embedded 分支**） | 替换 →「跳过」（或「暂不生成提纲」） | 三个页面态共用同一处三元式 → **一次改净 3 条**；独立页分支「跳过，直接上传」不动（0.2-D1） |
| B-07 / B-13 / B-17 | `outline-plan-workspace.tsx` — 底部主按钮（**embedded 分支**） | 替换 →「确认并继续」（或「保存提纲」） | 同上，一次改净 3 条；独立页分支「确认提纲，进入上传」不动 |
| B-08 | `src/lib/providers/llm/ark-llm-provider.ts` —「核心议题（可按事件/时期分 ### 子节）」 | **移出本批** | 生成侧模板，与 UI-27 / UI-28 同面（0.2-D2）；本 IMPL 不列实施步骤 |
| B-09 | `ark-llm-provider.ts` — 情绪安全提示条目 | **移出本批** | 同上；P-2 要求**保留在主界面**（章节标题「情绪安全提示」保留），若日后随 UI-27/UI-28 落地，成品句为「涉及敏感经历时，先确认受访者意愿，可暂停或跳过。」 |
| B-10 | `ark-llm-provider.ts` — 现场记录提醒条目 | **移出本批** | 同上；成品句「录音录像前请先获得受访者同意。」 |
| B-11 / B-15 | `outline-plan-workspace.tsx` — 底部主按钮「发送修改」 | 替换 →「提交修改」 | 以代码字面为准（§0.1-⑤）；预览/编辑态与 Markdown 编辑态**共用同一处** → 一次改净 2 条 |
| B-14 | — | 已移出（P-5） | Markdown 源码标记属功能设计，不占编号（PRD §6.6） |
| B-18 | `src/components/new-project/route-chooser.tsx` — 标题下说明「两种方式都会带上你刚填的基本信息，不需要再填一遍。」 | 替换 →「已自动带入基本信息」 | |
| B-19 | `route-chooser.tsx` — 第一个选项说明 | 替换 →「按提纲逐题访谈并自动记录」 | 与「AI 实时访谈」选项标题同屏 |
| B-20 | `route-chooser.tsx` — 第二个选项说明 | 替换 →「上传录音，自动转写整理」 | P-4 口径：句内「脱敏」→「隐私处理」，但成品句已不再出现该词 |
| B-21 | `route-chooser.tsx` — 卡片底部灰字「提纲留空也可以直接上传音频。」 | 替换 →「无需提纲也可上传」 | 原为「移到帮助」→ 按 0.2-D3 采用**替换**分支；原句回填登记（§5.6） |


### 2.3 C 批 · AI 访谈全流程（7 条；全部落在同一文件）

| 编号 | 落点（文件 ＋ 检索字面） | 改动类型 | 备注（实测 / 复用 / 牵连） |
| --- | --- | --- | --- |
| C-01 | `src/components/interview/interview-console.tsx` — 顶部步骤标签 `Step 02 · AI 访谈`（3 处复用） | 替换 →「AI 访谈」 | 与 F-06 同一处，**只在 F 批执行一次**，本行不重复动作 |
| C-02 | `interview-console.tsx` — 标题下说明「受访者 123 · AI 逐题提问…讯飞归档」 | 替换 →「受访者：{姓名}」 | 姓名由数据拼接；句内 `123` 属 E 类演示数据，替换后自然消失 |
| C-03 | `interview-console.tsx` — 准备就绪卡说明「提纲共 41 条，开始后 AI 会逐题提问。」 | 替换 →「共 41 条提纲」 | 条数由数据拼接 → 改模板字面 |
| C-04 | `interview-console.tsx` — 底部主按钮「我已听清，开始回答」 | 替换 →「开始回答」 | 只改本按钮字面，不动同屏其他保留项（PRD §6.3） |
| C-05 | `interview-console.tsx` — 实时字幕空态「点击开始录音后，这里会实时显示对话文字。」 | 替换 →「开始录音后显示文字」 | |
| C-06 | `interview-console.tsx` — 暂停弹层说明「已录音与已转写内容已保留。按 Esc 也可以继续访谈。」 | 替换 →「已保存当前进度」 | **C-07 是 C-06 句内的后半句**（子串关系）→ 改 C-06 即同时清掉 C-07，两条一次改净 |
| C-07 | 同 C-06（句内「按 Esc 也可以继续访谈」） | 删除（随 C-06 替换一并达成） | 原为「移到帮助」→ 0.2-D3 降级；帮助批次回填（§5.6） |

### 2.4 D 批 · 上传音频全流程（12 条）

| 编号 | 落点（文件 ＋ 检索字面） | 改动类型 | 备注（实测 / 复用 / 牵连） |
| --- | --- | --- | --- |
| D-01 | `src/components/upload/upload-workspace.tsx` — 眉标「记忆引擎」 | 删除 | ⚠ 同词在 **8 个文件**出现（§0.1 第二表）→ 本批**只删上传页这一处**，其余 7 处按 0.2-D4 不动 |
| D-02 | `upload-workspace.tsx` — 主标题「音频建档与处理」 | 替换 →「上传音频」（或「音频处理」） | |
| D-03 | `upload-workspace.tsx` — 主标题下说明「填写受访人基础信息，上传本地音视频文件…」 | 替换 →「上传录音后自动转写整理」 | |
| D-04 | `src/components/upload/interview-upload-form.tsx` — 语言选择默认值「普通话（默认）」 | 替换 →「普通话」 | 改的是选项**文案字面**，不动 `value` |
| D-05 | `interview-upload-form.tsx` — 上传卡片眉标「受访音频」＋ 标题「上传音频材料」 | 替换 →「上传音频」 | 与 F-05 的 `Audio` 标签**同屏**：本批删标签、改中文标题 → 两批须一起验收（§4 D 包） |
| D-06 | `interview-upload-form.tsx` — 上传区格式说明「支持 mp3、wav、m4a、aac、flac、ogg 等常见音频格式。」 | 删除 | 原为「移到帮助」→ 降级删除；同屏 `<details>` 折叠块属 UI-05（隐私保护模块），本批不动 |
| D-07 | `interview-upload-form.tsx` — 底部说明「提交后将直接开始本地音频转写、AI 整理与隐私脱敏处理。」 | 替换 →「提交后开始处理」 | R1 反例句；注意与同页知情同意弹层（D-09/D-10）无关，勿误改其正文 |
| D-08 | `interview-upload-form.tsx` — 底部主按钮「创建项目并开始处理」 | 替换 →「开始处理」（或「提交」） | ⚠ **探针 4 处按此文案定位**（§3.2）→ 探针与文案必须同批改，否则脚本红 |
| D-09 | `interview-upload-form.tsx` — 知情同意弹层正文 | **暂不动**（P-1） | 红线：`cdp-req14-consent.mjs` 断言其正文（§3.4）；法务 / 伦理确认前不缩短 |
| D-10 | `interview-upload-form.tsx` — 知情同意勾选框文案 | **暂不动**（P-1） | 同上 |
| D-11 | `interview-upload-form.tsx` — 未勾选提示「请先勾选知情同意确认，才能创建项目并开始处理。」 | 替换 →「请先勾选知情同意」 | 不被探针断言，可安全替换 |
| D-12 | —（帮助层未实现） | 无代码落点 | `src` 全域「帮助」零命中；按 0.2-D3 随帮助批次，本 IMPL 不列动作 |


### 2.5 E 批 · 项目详情页全流程（27 条）

| 编号 | 落点（文件 ＋ 检索字面） | 改动类型 | 备注（实测 / 复用 / 牵连） |
| --- | --- | --- | --- |
| E-01 | `src/app/projects/[projectId]/page.tsx` — 项目说明占位「当前项目未填写项目说明。」 | 替换 →「暂无项目说明」 | |
| E-02 | `src/components/projects/project-workflow-board.tsx` — 处理进度说明句 | 替换 →「处理完成后可导出」 | P-3：删说明文字、保留标题 |
| E-03 | `src/lib/types/project.ts` — `PROCESS_STEPS[0].label`「受访音频建档」 | 替换 →「音频已上传」 | **授权改字面量**（0.2-D2）；渲染侧 `project-workflow-board.tsx` 自动生效，勿改渲染 |
| E-04 | `lib/types/project.ts` — `PROCESS_STEPS[0].description`「受访音频已上传归档…」 | 删除 | P-3；删除后若渲染侧留下空段落，只允许**最小守卫**（如 `description &&` 条件渲染），不得改结构或样式 |
| E-05 | `lib/types/project.ts` — `PROCESS_STEPS[1].label`「音视频转写」 | 替换 →「转写」 | |
| E-06 | `lib/types/project.ts` — `PROCESS_STEPS[1].description`「调用语音识别服务，输出音视频转写稿。」 | 删除 | 同 E-04 守卫说明 |
| E-07 | `lib/types/project.ts` — `PROCESS_STEPS[2].label`「整理与脱敏」 | 替换 →「整理与隐私处理」 | P-4 口径 |
| E-08 | `lib/types/project.ts` — `PROCESS_STEPS[2].description`「完成摘要、结构化整理、情绪提示与隐私脱敏。」 | 删除 | 同 E-04 守卫说明 |
| E-09 | `lib/types/project.ts` — `PROCESS_STEPS[3].description`「研究员进行复核，并决定是否进入成果导出。」 | 删除 | 同 E-04 守卫说明 |
| E-10 | `lib/types/project.ts` — `PROCESS_STEPS[4].description`「生成可归档的 docx、txt 和结构化 JSON 成果。」 | 删除 | 同 E-04 守卫说明 |
| E-11 | `src/components/projects/project-processing-console.tsx` — 小标题「上传即处理」 | 删除 | 与「处理进度」标题语义重复（R5） |
| E-12 | `project-processing-console.tsx` — 空态 / 说明「上传完成后，系统会自动生成…立即开始整理。」 | 替换 →「处理中，完成后可查看结果」 | R2 反例句 |
| E-13 | `project-processing-console.tsx` — 按钮「重新生成整理结果」 | 替换 →「重新生成」 | 与弹窗确认语同屏，勿改弹窗文案（保留项） |
| E-14 | `project-processing-console.tsx` — 审核提示卡标题「AI 整理已完成 · 请确认审核结果」 | 替换 →「整理完成，请确认」 | |
| E-15 | `project-processing-console.tsx` — 审核提示卡说明「点击下方打开整理结果…解锁导出。」 | 替换 →「确认无误后即可导出」 | |
| E-16 | `project-processing-console.tsx` — 审核状态按钮「请先在整理结果中处理（还剩 3 处待确认）」 | 替换 →「还有 3 处待确认」 | 处数由数据拼接 → 改模板字面 |
| E-17 | `project-processing-console.tsx` — 结果摘要卡枚举句 | 替换 →「包含转写稿、摘要与结构化档案」 | 与 E-19 模块名同源，实施时保持口径一致 |
| E-18 | `project-processing-console.tsx` — 结果查看页说明「更适合通读长文本；按 Esc 也可以关闭。」 | 删除 | 原为「移到帮助」→ 降级删除；帮助批次回填（§5.6） |
| E-19 | `project-processing-console.tsx` — 结果模块标题（脱敏整理稿 / 要素标引 / 结构化档案 / 口述摘要 / 主题关键词 / 情绪提示 / 脱敏提示 / 原始转写稿）＋ `src/components/projects/timeline-panel.tsx` —「要素标引」（2 处） | 替换 → 整理稿 / 时间线 / 档案 / 摘要 / 关键词 / 情绪提示 / 隐私处理 / 原始转写稿 | P-4（脱敏 → 隐私处理）；**模块名须与实际模块一一对应**，逐模块核对、勿机械替换；同词在 `lib/server/project-export.ts`（「要素标引」×2、「脱敏整理稿」×2）→ **不动**（0.2-D4） |
| E-20 | `src/lib/writing-rules.ts` — 结构化档案小节占位「本节内容在本次访谈中未涉及。」 | 替换 →「本小节暂无内容」 | **授权改字面量**（0.2-D2）；该文件同时含「记忆引擎」→ **那一处不动**（§0.1 第二表） |
| E-21 | `project-processing-console.tsx` — 情绪提示空态「该采集路径暂不提供情绪提示。」 | 替换 →「暂无情绪提示」 | |
| E-22 | `project-processing-console.tsx` — 脱敏提示统计「共 3 处 · 待确认 3 · 已确认 0 · 已撤销 0 · 待核实 0」 | 替换 →「共 3 处，待确认 3」 | 数字拼接；删去 3 个零值项 |
| E-23 | `project-processing-console.tsx` — 筛选标签「全部 3 / 仅看待确认 3 / 仅看存疑 0」 | 替换 →「全部 / 待确认 / 存疑」 | 计数是否保留由实施人按同屏空间决定，**须与 E-22 口径一致** |
| E-24 | `project-processing-console.tsx` — 批量操作按钮「批量确认 3 项（不含存疑）」 | 替换 →「全部确认」 | |
| E-25 | `project-processing-console.tsx` — 条目原因字段「原因：普通个人姓名 / 原因：个人手机号 / 原因：受访者居住地址信息」 | 替换 →「类型：姓名 / 类型：手机号 / 类型：住址」 | 三处字面同改 |
| E-26 | `project-processing-console.tsx` — 原始转写稿说明「讯飞原始转写，供与整理稿对照；默认收起」 | 替换 →「原始转写稿」 | 与 UI-08 / UI-17（转写稿文案）同面，须定主从 |
| E-27 | `project-processing-console.tsx` — 「按 Esc 也可以关闭」「默认收起」等界面行为说明 | 随帮助批次 | E-18 本批已删、E-26 本批已替换 → 本行**不另生动作**，仅登记 |


### 2.6 F 批 · 全局英文 / 编号标签清理（7 条）

| 编号 | 落点（文件 ＋ 检索字面） | 改动类型 | 备注（实测 / 复用 / 牵连） |
| --- | --- | --- | --- |
| F-01 | `src/components/outline/outline-plan-workspace.tsx` — `>Profile<` | 删除 | 检索用 Title Case（§0.1-①）；**`.tape-label` 样式类保留**（见 §5.4） |
| F-02 / F-03 / F-04 | `outline-plan-workspace.tsx` — `>Editable<` | 删除 | **同一处字面**在「生成结果 / 预览编辑 / Markdown 编辑」三态复用 → 一次改净 3 条（§0.1-②） |
| F-05 | `src/components/upload/interview-upload-form.tsx` — `>Audio<` | 删除 | 同屏 `Confidentiality` **不动**（§0.1 第二表）；与 D-05 同屏 → 两批一起验收 |
| F-06 | `src/components/interview/interview-console.tsx` — `Step 02 · AI 访谈`（3 处复用） | 替换 →「AI 访谈」 | 与 C-01 同一处，只执行一次 |
| F-07 | `project-processing-console.tsx` — `tag="Raw / Safety / Topics / Redaction / Archive / Redacted / Summary"`（7 个标签）＋ `timeline-panel.tsx` — `tag="Timeline"` | 删除 | 模块含义由中文标题承担（见 E-19）；标签字面为 Title Case，检索勿用全大写 |

### 2.7 落点汇总（去重后 14 个实施文件）

| 文件 | 涉及编号 | 类别 |
| --- | --- | --- |
| `src/components/home/home-dashboard.tsx` | A-01 ~ A-03、A-05 | 组件 |
| `src/components/home/recent-project-list.tsx` | A-04 ~ A-08、A-11 ~ A-15 | 组件 |
| `src/components/ui/status-badge.tsx` | A-09、A-10 | 组件 |
| `src/components/new-project/basic-info-form.tsx` | B-01、B-02 | 组件 |
| `src/components/outline/outline-plan-workspace.tsx` | B-03 ~ B-07、B-11 ~ B-13、B-15 ~ B-17、F-01 ~ F-04 | 组件（**本批最大落点**） |
| `src/components/new-project/route-chooser.tsx` | B-18 ~ B-21 | 组件 |
| `src/components/interview/interview-console.tsx` | C-01 ~ C-06（C-07 随 C-06）、F-06 | 组件 |
| `src/components/upload/upload-workspace.tsx` | D-01 ~ D-03 | 组件 |
| `src/components/upload/interview-upload-form.tsx` | D-04 ~ D-11、F-05 | 组件 |
| `src/components/projects/project-workflow-board.tsx` | A-11 / A-12 / A-15 的文案源、E-02 | 组件 |
| `src/components/projects/project-processing-console.tsx` | E-11 ~ E-19、E-21 ~ E-26、F-07 | 组件 |
| `src/components/projects/timeline-panel.tsx` | E-19、F-07 | 组件 |
| `src/app/projects/[projectId]/page.tsx` | E-01（另有 A-13 / A-14 同词副本 → 不动） | 页面 |
| `src/lib/types/project.ts` | E-03 ~ E-10 | **lib 授权**（只改字面量） |
| `src/lib/writing-rules.ts` | E-20 | **lib 授权**（只改字面量） |
| `src/lib/providers/llm/ark-llm-provider.ts` | B-08 ~ B-10 → **移出** | 生成侧，交 UI-27 / UI-28 |
| `src/app/globals.css` | 无改动（`.tape-label` 保留） | 样式 |


---

## §3 探针影响面（`tmp/**`，共 34 个 `.mjs`）

### 3.1 方法、口径与定位语义（先读这段，否则改不对）

- 仓库**无 ripgrep**；全量检索用 PowerShell 内存扫描（命令模板见 §5.8）。
- 34 个脚本三分法：**需同步 5 个**（§3.2）／**因 0.2-D1 判定不影响 2 个**（§3.3）／**不影响 27 个**（§3.5）。
- 两套探针帮助对象的定位语义不同，改文案前必须区分：

| 帮助对象 | 位置 | 定位实现 | 语义 |
| --- | --- | --- | --- |
| `clickText(t)` | `tmp/verify-phase2.mjs`、`tmp/verify-phase3.mjs` 注入页面的帮助对象 | `[...document.querySelectorAll('button')].find(b => b.innerText.trim().includes(t))` 后点击 | **子串匹配**、**不过滤可见性**、取第一个 |
| `__t.btn(t)` / `__t.visBtn(t)` | 各 `tmp/cdp-*.mjs` 注入的 `window.__t` | `filter(b => b.textContent.includes(t) && b.checkVisibility())`；`btn()` 找不到即 `throw` | **子串匹配** ＋ 可见性过滤 |

> **风险提示**：改后的新文案是短词（「跳过」「开始处理」）时，子串匹配可能命中页面上**另一颗**含同词的按钮（顺序不确定）。实施时先在界面确认新文案的**唯一性**；若冲突，**在探针侧**改用更精确的定位（就近容器内查文本、或结合 `aria-current` / 可见性过滤），**不得**为迁就探针在 DOM 上加 `data-*` 属性（本需求不改结构）。

### 3.2 需同步的 5 个断言探针（行号＝当前实测，改前请复核）

| 探针 | 受影响定位（当前行号） | 关联编号 | 同步改法 |
| --- | --- | --- | --- |
| `tmp/verify-phase3.mjs` | `clickText('跳过提纲，下一步')` ×9：L167 / L217 / L317 / L513 / L631 / L701 / L890 / L931 / L979 | B-06 / B-12 / B-16 | 改为新文案（如 `'跳过'` 或 `'暂不生成提纲'`，与 §2.2 定稿一致） |
| 同上 | `clickText('确认提纲，下一步')` L268 | B-07 / B-13 / B-17 | 改为「确认并继续」（或定稿文案） |
| 同上 | `clickText('创建项目并开始处理')` L714、`includes('创建项目并开始处理')` 判定 L908 | D-08 | 改为「开始处理」 |
| 同上 | check 名与注释里含旧词处（如「跳过提纲」段落标签） | 全部 | **仅报告文本**，建议同批改便于阅读；不影响断言 |
| `tmp/verify-phase2.mjs` | `clickText('跳过提纲，下一步')` L252、`clickText('确认提纲，下一步')` L379 | B-06/B-07 等 | 同上两行同改 |
| 同上 | L373 `READY_CONFIRM` 定位、L220 `hasConfirm`（`'确认提纲，进入上传'`） | — | **独立页文案 → 不动**（0.2-D1）；确认仍通过即可 |
| `tmp/cdp-req13-outline.mjs` | `__t.btn('确认提纲，下一步')` L272、`__t.btn('跳过提纲，下一步')` L375、`includes('创建项目并开始处理')` L347 | B-07 / B-06 / D-08 | 同改；注意 `__t.btn` 找不到会 **throw** |
| `tmp/cdp-req13-crosscut.mjs` | `__t.btn('确认提纲，下一步')` L186 | B-07 等 | 同改 |
| 同上 | L290 段内 check 名含「草稿」（A-02 的改动对象） | A-02 | **仅报告文本**；该断言校验的是路由 / 状态，文案改后仍应通过 |
| `tmp/cdp-req14-consent.mjs` | `创建项目并开始处理` 4 处：L315 / L319 / L363 / L379；注释 L2 / L311 | D-08 | 同改 |
| 同上 | **L300 `bodyHas('本平台会对本次口述音频')`** | D-09 / D-10 | **红线**：D-09/D-10 暂不动 ⇒ 该断言必须**保持通过**；本批不得以「精简」为由改知情同意正文 |

> **不需修改、仅登记的相邻项（豁免清单）**：
> - `verify-phase3.mjs` **L597** `clickText('下一步')` → 对应 **B-02**：子串匹配，新旧文案都命中，**行为不变**。
> - `verify-phase2.mjs` **L226** 断言 `"Step 01 · 访谈准备"` eyebrow（字段名 `eyebrowRaw`）→ 该 eyebrow **不在本批清单**，不动。
> - `cdp-ui24-fixes.mjs` **L352** `keepGuide`（UI-26 遗留，见 §3.3 注）→ 不得顺手修。


### 3.3 因 0.2-D1 判定「不影响」的 2 个探针

| 探针 | 相关定位（当前行号） | 说明 |
| --- | --- | --- |
| `tmp/cdp-ui24-fixes.mjs` | `visBtn('确认提纲，进入上传')` L308 / L448 / L467 / L471 / L496；`visBtn('跳过，直接上传')` L448 / L472 | 全部针对**独立页**文案 → 本批不动 ⇒ 断言保持通过。**条件**：若日后统一独立页文案，这些行连同 L318 / L343 / L446 的 `/确认提纲\|跳过/` 正则必须同批改 |
| `tmp/cdp-req13-prefill.mjs` | `__t.btn('确认提纲，进入上传')` L227 | 同上（独立页）。同脚本 L211 / L220 依赖 `textarea[aria-label="访谈提纲草稿"]` → 本批不改 `aria-label`，不受影响 |

> 另注：`cdp-ui24-fixes.mjs` L352 `bodyHas('生成提纲后，可以用一句话让 AI 继续调整')` 是 **UI-26 遗留断言**（对应文案已删、当前应已红）→ 与本批无关，**不得顺手修**（§1.3）。

### 3.4 红线断言冻结清单（改文案时不得破坏）

| 断言的契约 | 位置（当前行号） | 对应红线 |
| --- | --- | --- |
| 知情同意正文含「本平台会对本次口述音频」 | `cdp-req14-consent.mjs` L300 | D-09 / D-10 暂不动（P-1） |
| 按钮精确文本「我确认」 | `cdp-req14-consent.mjs` L331 / L382 / L386；`verify-phase3.mjs` L830 / L836 | 知情同意弹层结构不动 |
| `textarea[aria-label="访谈提纲草稿"]` | `cdp-req13-prefill.mjs` L211 / L220；`cdp-ui24-fixes.mjs` L103 / L196 / L364 / L377 | `aria-label` 是探针契约 → 本批**一律不改** |
| `aria-current="step"` 步骤条 | `verify-phase3.mjs` 的 `upStep()` 判定；`cdp-req13-outline.mjs` L281 / L301 / L383 | 步骤条结构不动（B-02 改文案后仍靠它判定步骤） |
| `data-upload-modal` / `data-interview-back` / `data-upload-back` 等 `data-*` 钩子 | `cdp-req14-consent.mjs`、`cdp-req13-*`、`verify-phase2/3` 多处 | `data-*` 一律不动 |
| `#route-chooser-realtime` | `verify-phase3.mjs` L320 | 分流卡片 id 不动（B-18 ~ B-21 只改文案） |
| `#outline-profile-drawer` | 提纲 / 画像抽屉相关脚本 | 抽屉 id 不动 |

### 3.5 不影响的 27 个脚本

| 类别 | 个数 | 清单 | 为什么不影响 |
| --- | ---: | --- | --- |
| 数据 / 运维 / 基建 | 17 | `alias-loader`、`cleanup-probe`、`cleanup-probe-projects`、`cleanup-probe-projects2`、`cleanup-stray`、`convert-deerlight`、`diag-ai-path`、`diag-ai-path2`、`fill-ch1`、`fill-ch4`、`fill-deepseek`、`insert-ch7-status`、`list-projects`、`reformat-arch-doc`、`register-alias`、`script1-fix-confirm-export`、`script2-reset-export-pending` | 处理的是**文档数据 / 项目数据 / 别名**，不读界面文案；其中出现的「脱敏 / 审校 / 记忆引擎」是数据内容，P-4 术语替换**不回溯**已生成文档 |
| 视觉 / 窄屏 / 行为 | 9 | `cdp-flash-narrow`、`cdp-flash-test`、`cdp-frames-narrow`、`cdp-header-height`、`cdp-narrow-trace`、`cdp-scroll-test`、`measure-375`、`probe-header-slot`、`probe-urlsync` | 断言的是尺寸 / 布局 / 滚动 / URL 同步，本批文案零命中 |
| 早期批次前哨 | 1 | `verify-phase1` | 本批文案零命中 |

> 编译产物：`tmp/verify/**`（含 `compiled-console` 等）为陈旧产物 → **不改、不重生成**，运行时一律以源 `.mjs` 为准。

> **F 批正面结论（34 个 `tmp/*.mjs` 全量实测）**：`Redacted`、`Safety`、`Topics`、`Archive`、`Summary`、`Timeline`、`Editable`、`Step 02`、`tape-label` **零命中** → **删除这些标签不会破坏任何断言**。`Redaction` 的命中也全部与界面标签无关：`cdp-req14-consent.mjs` L405 / L407 是数据字段名 `customRedactionRules`；`fill-ch4.mjs`、`reformat-arch-doc.mjs` 命中的是**架构文档正文**（形如 `L.push("…RAW / REDACTED 对照…")`）。`verify-phase2.mjs` 的 `Raw`×3 是变量名（`eyebrowRaw` L215 / L226、`transcriptRaw` L381）。
> 另：`tmp` 下还有历史脚本与编译产物（`.tsx` / `.jsx` / `.bak` / `.log`，如 `verify-redaction.tsx`、`project-processing-console.jsx`）同样含旧标签字面 —— 它们**不在本轮回归集**，不改、不重生成。

### 3.6 探针同步纪律

1. **同批改动**：文案与探针必须在同一实施批次（同一轮验证、同一 commit）内改完，禁止「先改文案、探针下次再说」。
2. **只改清单内**：只改 §3.2 列出的字面与正则；不改断言语义、不删断言、不换选择器策略。
3. **唯一性优先**：新文案若为短词，先确认页面上是否唯一；不唯一时改**探针侧定位**（就近容器 / 可见性 / `aria-current` 邻域），**不在 DOM 上加 `data-*`**。
4. **红线不动**：§3.4 的 7 类契约在实施轮内零改动；若某条断言因本批文案变化而红，说明改错了对象 → **回退文案**，不要改断言。
5. **留痕**：`tmp/` 不入库（§5.7），探针改动必须在实施轮的验证记录中逐条写清（探针名 ＋ 行号 ＋ 旧文案 → 新文案），否则下轮回归必红。


---

## §4 验收清单（按模块打包 · 逐项勾选）

> **通用前置（每包先过）**：`npm run lint` ＋ `npx tsc --noEmit` 无新增错误（基线见 §5.5）。
> **通用判据（PRD §4 通用说明④）**：① 现状文案在界面上不再出现；② 替换文案与定稿一致；③ 同一文案多处复用时**全部**替换。
> **注意**：判据只针对**本 IMPL 已列条目**；未列副本（§0.1 第二表）保持原状是**预期结果**，不是缺陷。

### 4.1 包 F · 英文标签归零（最先做，可独立验收）

- [ ] 提纲页三态右上角无 `Profile` / `Editable`
- [ ] 上传卡片右上角无 `Audio`
- [ ] 结果查看页无 `Raw` / `Safety` / `Topics` / `Redaction` / `Archive` / `Redacted` / `Summary` / `Timeline` 标签
- [ ] 访谈页顶部标签为「AI 访谈」（无 `Step 02 ·` 前缀）
- [ ] `.tape-label` 样式类**保留**（仍有中文标签与 `Confidentiality` 在用，不做死代码清理）
- [ ] 检索校验（预期：12 个 needle 零命中；命中需人工判读，注释 / 变量名不算界面文案）：

```powershell
cd <仓库根>
$fs = Get-ChildItem -LiteralPath 'src' -Recurse -Include '*.tsx' -File
foreach ($s in @('Profile','Editable','Audio','Raw','Safety','Topics','Redaction','Archive','Redacted','Summary','Timeline','Step 02')) {
  foreach ($f in $fs) {
    if ([System.IO.File]::ReadAllText($f.FullName).Contains($s)) {
      '{0} => {1}' -f $s, $f.FullName.Replace((Get-Location).Path + '\src\', '')
    }
  }
}
```

### 4.2 包 A · 首页 / 项目工作台 ＋ 历史项目列表

- [ ] A-01 / A-02 / A-03 草稿卡片：无「填写受访者与访谈主题…」「草稿」「未完成的草稿」「新建项目后未提交的内容…」
- [ ] A-04 / A-06 无「项目索引」标签（两页或同一件列表均已核）
- [ ] A-05 / A-07 标题为「我的项目」/「项目列表」（区头与列表件同词已同步）
- [ ] A-08 计数胶囊为「N 个」
- [ ] A-09 / A-10 胶囊为「待审核」/「处理中」，且**详情页同态一致**
- [ ] A-11 / A-12 / A-15 卡片无「当前阶段：…」说明条；进度显示「已完成 N/M」
- [ ] A-13 / A-14 字段为「音频：已上传 / 音频：待上传」「创建时间」
- [ ] 预期原状：详情页信息行的「受访音频」「建档时间」等**未列副本**保持不变（0.2-D4）
- [ ] 回归：`cdp-ui24-fixes.mjs`（独立页断言）不因 A 批改动而红

### 4.3 包 B · 新建项目 01~03

- [ ] B-01 多行框 placeholder 为「补充事件、人物、时间线等背景信息」
- [ ] B-02 主按钮为「下一步」/「生成提纲」；步骤条仍可被 `aria-current="step"` 判定
- [ ] B-03 卡片标题为「访谈信息」（或「受访者画像」去「必填信息」）
- [ ] B-04 卡片底部无灰字说明
- [ ] B-05 生成提示为「正在生成提纲…」（单字符省略号）
- [ ] B-06 / B-12 / B-16 次按钮新文案在**三种页面态均已生效**
- [ ] B-07 / B-13 / B-17 主按钮新文案在**三种页面态均已生效**
- [ ] B-11 / B-15 主按钮为「提交修改」（预览编辑态与 Markdown 编辑态均已生效）
- [ ] B-18 ~ B-21 分流页四句已按定稿替换（B-20 成品句无「脱敏」字样）
- [ ] 预期原状：独立页（非 embedded）按钮仍为「跳过，直接上传」「确认提纲，进入上传」（0.2-D1）
- [ ] 预期原状：B-08 / B-09 / B-10（生成侧模板）未改动 → 生成结果里的原句照旧
- [ ] 探针：`verify-phase3` / `verify-phase2` / `cdp-req13-outline` / `cdp-req13-crosscut` 的 B 批定位行已同步且全绿

### 4.4 包 C · AI 访谈

- [ ] C-02 说明为「受访者：{姓名}」（无「AI 逐题提问」「讯飞归档」）
- [ ] C-03 为「共 N 条提纲」
- [ ] C-04 主按钮为「开始回答」
- [ ] C-05 字幕空态为「开始录音后显示文字」
- [ ] C-06 暂停弹层为「已保存当前进度」，且句内**无**「按 Esc 也可以继续访谈」（C-07 一并达成）
- [ ] F-06 顶部标签为「AI 访谈」（与 C-01 同处，只做了一次）
- [ ] 回归：弹层按钮与「我确认」类断言不受影响


### 4.5 包 D · 上传音频 ＋ 知情同意（含红线）

- [ ] D-01 上传页无「记忆引擎」眉标（其余 7 处未列副本保持原状 → 预期）
- [ ] D-02 / D-03 主标题为「上传音频」，说明为「上传录音后自动转写整理」
- [ ] D-04 语言选择显示「普通话」（无「（默认）」）
- [ ] D-05 卡片为「上传音频」，且右上角无 `Audio` 标签（与 F-05 同屏一起验收）
- [ ] D-06 上传区无格式清单句；同屏 `<details>` 隐私保护模块不受影响
- [ ] D-07 底部为「提交后开始处理」
- [ ] D-08 主按钮为「开始处理」/「提交」
- [ ] **红线** —— D-09 / D-10：知情同意弹层正文与勾选框文案**逐字未变**（P-1）
- [ ] D-11 未勾选提示为「请先勾选知情同意」
- [ ] 探针：`cdp-req14-consent.mjs` 全绿（**含 L300 正文断言**）；`verify-phase3` 与 `cdp-req13-*` 的 D-08 定位行已同步
- [ ] 与 UI-05 划界：上传页隐私模块本批未改

### 4.6 包 E-1 · 处理进度

- [ ] E-01 项目说明占位为「暂无项目说明」
- [ ] E-02 进度说明为「处理完成后可导出」（标题保留）
- [ ] E-03 / E-05 / E-07 步骤 01~03 标题为「音频已上传 / 转写 / 整理与隐私处理」；步骤 04 / 05 标题按 P-3 保留原样
- [ ] E-04 / E-06 / E-08 / E-09 / E-10 五条说明文字**均已不显示**，且列表**无空行 / 空段落**（若用最小守卫，确认未改动样式与结构）
- [ ] 首页卡片「当前阶段」与详情页进度口径一致（同一映射源）

### 4.7 包 E-2 · 整理结果 / 审核 / 隐私处理

- [ ] E-11 无「上传即处理」小标题
- [ ] E-12 空态 / 说明为「处理中，完成后可查看结果」
- [ ] E-13 按钮为「重新生成」（弹窗确认语属保留项，未连带改）
- [ ] E-14 / E-15 审核卡为「整理完成，请确认」「确认无误后即可导出」
- [ ] E-16 审核状态按钮为「还有 N 处待确认」
- [ ] E-17 摘要卡为「包含转写稿、摘要与结构化档案」
- [ ] E-18 结果查看页无「更适合通读长文本；按 Esc 也可以关闭。」
- [ ] E-19 模块标题为「整理稿 / 时间线 / 档案 / 摘要 / 关键词 / 情绪提示 / 隐私处理 / 原始转写稿」，且**与实际模块一一对应**（无错配、无遗留「要素标引」「脱敏整理稿」）
- [ ] E-20 结构化档案占位为「本小节暂无内容」
- [ ] E-21 情绪提示空态为「暂无情绪提示」
- [ ] E-22 / E-23 统计为「共 N 处，待确认 N」、筛选为「全部 / 待确认 / 存疑」，两者口径一致
- [ ] E-24 批量按钮为「全部确认」
- [ ] E-25 原因字段为「类型：姓名 / 类型：手机号 / 类型：住址」
- [ ] E-26 原始转写稿说明为「原始转写稿」（无「讯飞」「默认收起」）
- [ ] **未列副本复核（预期原状）**：「脱敏」在 `project-processing-console.tsx`（模块名以外的若干处）、`interview-upload-form.tsx`（隐私模块 ＋ D-09/D-10 正文）、`project-overview-panel.tsx`、`app/layout.tsx`、`lib/**` 与「审校」在 `api/**`、`lib/**` 的残留 → 均**不属于本批已列条目**，保持原状
- [ ] 与 UI-08 / UI-17（转写稿文案）的主从关系已在实施记录里写明

### 4.8 包 G · 全局回归（收尾包）

- [ ] R1~R5 抽查：主界面无「本地转写 / AI 整理 / 讯飞 / Markdown 源码 / 文件 ID」等实现细节
- [ ] 同词表复核（**限本批已列条目**）：建档 → 创建、审校 → 审核、索引 → 我的项目、脱敏 → 隐私处理
- [ ] `npm run lint` 通过；`npx tsc --noEmit` 无新增错误
- [ ] 5 支需同步探针全绿（§3.2）；2 支 D-1 探针保持原有结果（§3.3）
- [ ] 未列文案复核：`Confidentiality`、其余 7 处「记忆引擎」、服务端 / 导出文本、状态键 → 仍为原状（证明未越界）
- [ ] 帮助批次登记：§5.6 的回填清单已随实施记录留档（5 处原句 ＋ 2 条随批条目）
- [ ] 交付边界复核：`git status` 中**只有 `src/**` 的文案改动**（`tmp/**` 与 `docs/tasks/**` 不应入库）


---

## §5 实施注意事项

### 5.1 编码与换行（实测基线）

| 项 | 仓库基线 | 本批要求 |
| --- | --- | --- |
| 编码 | 源文件 UTF-8 | 一律 UTF-8 |
| BOM | **`src/lib/types/project.ts` 带 BOM**；其余源文件无 BOM | 保留该文件的 BOM，**其余不得新增 BOM** |
| 换行 | 源文件与 `docs/tasks/*.md` 均为 **CRLF** | 只改字面量时天然保持；若某次编辑整文件重写，须把 `\n` 归一为 `\r\n` 再落盘，否则整份 diff |
| 引号 / 缩进 | JSX 文案多为双引号 | 只替换字面量内容，不改引号风格与缩进 |

### 5.2 改动纪律（只改字符串字面量）

- 只替换**字符串字面量**：不改 JSX 结构、条件分支、props 名、导出、类型定义。
- **禁止改动**（探针契约，见 §3.4）：`data-*`、`id`、`aria-label`、`aria-current`、`name`、`#route-chooser-realtime`、`#outline-profile-drawer`、`textarea[aria-label="访谈提纲草稿"]`。
- 删除文案后若留下空标签 / 空行，用**最小守卫**（`cond && …`、返回 `null`）处理，不重构。
- 不新增依赖、不改配置、不动样式文件。

### 5.3 `src/lib` 白名单

- **允许**：`src/lib/types/project.ts`（E-03 ~ E-10）、`src/lib/writing-rules.ts`（E-20）—— 只改字面量。
- **不允许**：`src/lib/providers/llm/ark-llm-provider.ts`（B-08 ~ B-10 已移出）、`src/lib/server/**`、`src/lib/oral-history.ts`（「脱敏」×23 等生成侧 / 服务端文本）。
- `src/lib/writing-rules.ts` 同时含「记忆引擎」→ **只改 E-20 那一句**，其余不动。

### 5.4 样式类保留

- `.tape-label`（`src/app/globals.css`）**不删**：仍有中文标签与 `Confidentiality`（0.2-D4）在用；`text-transform: uppercase` 一律不动。
- 不做「死样式 / 死变量」清理：本批只做文案。


### 5.5 命令与验证基线

```powershell
npm run lint          # eslint（eslint.config.mjs）
npx tsc --noEmit      # 类型检查
```

- 改动前先跑一遍留**基线**，改后对比，只允许「无新增错误」。
- UI 验证以 CDP 探针为准（`tmp/cdp-*.mjs`、`tmp/verify-phase*.mjs`）；按 §3.2 同步后逐支执行。

### 5.6 帮助入口缺口与回填清单（0.2-D3 的记账）

`src` 全域「帮助」零命中，且无 Tooltip / Popover / 帮助组件 → 7 条「移到帮助」降级后，下列内容**尚无落点**，由「帮助入口」批次（另立需求）回填：

| 条目 | 原句 / 内容 | 本批处置 |
| --- | --- | --- |
| B-04 | 生成后可自由修改，提纲不会自动上传。 | 降级删除 |
| B-21 | 提纲留空也可以直接上传音频。 | 降级替换（原句待收纳） |
| C-07 | 按 Esc 也可以继续访谈 | 随 C-06 一并删除 |
| D-06 | 支持 mp3、wav、m4a、aac、flac、ogg 等常见音频格式。 | 降级删除 |
| D-12 | 「本地转写、AI 整理、隐私脱敏」实现链路说明 | 无代码落点，随帮助批次 |
| E-18 | 更适合通读长文本；按 Esc 也可以关闭。 | 降级删除 |
| E-27 | 「按 Esc 也可以关闭」「默认收起」等界面行为说明 | 随帮助批次（E-18 / E-26 已覆盖部分） |

> 同面需求：UI-05（上传页隐私模块）与 D-06 / D-12 同面；UI-08 / UI-17（转写稿文案）与 E-19 / E-26 同面。若它们先落地，可由其承接回填，主从须写进实施记录。

### 5.7 版本与交付边界

- `tmp/` 受 `.gitignore` 屏蔽（**第 54 行 `tmp/`**）→ 探针改动**不入库**。
- `docs/tasks/` 为**未跟踪**目录 → 本 IMPL 文档不入 commit（与既有两份反馈批次文档一致）。
- 实施轮建议：单一 commit，范围只含 `src/**` 文案改动；message 形如 `文案清理(REQ-28-x): <批次> 冗余提示词清理`。
- 回滚：纯文案改动，`git revert` 即可；若探针因改动漂移，优先回退**文案**而不是改断言（§3.6 纪律 4）。

### 5.8 检索命令速查（无 ripgrep，用内存扫描）

```powershell
cd <仓库根>

# ① 单字面命中文件 × 次数（改前 / 改后各跑一次，确认界面文件归零）
$fs = Get-ChildItem -LiteralPath 'src' -Recurse -Include '*.tsx','*.ts' -File
foreach ($f in $fs) {
  $n = ([regex]::Matches([System.IO.File]::ReadAllText($f.FullName), [regex]::Escape('受访音频'))).Count
  if ($n -gt 0) { '{0} x{1}' -f $f.FullName.Replace((Get-Location).Path + '\src\', ''), $n }
}

# ② 多字面命中矩阵（脱敏 / 审校 / 建档 / 记忆引擎 …）
foreach ($s in @('脱敏','审校','建档')) {
  $out = @()
  foreach ($f in $fs) {
    $n = ([regex]::Matches([System.IO.File]::ReadAllText($f.FullName), [regex]::Escape($s))).Count
    if ($n -gt 0) { $out += ($f.FullName.Replace((Get-Location).Path + '\src\', '') + 'x' + $n) }
  }
  '{0} || {1}' -f $s, ($out -join ' ; ')
}

# ③ 带行号定位（实施时核对锚点，不要写进文档）
$a = [System.IO.File]::ReadAllLines('src/components/outline/outline-plan-workspace.tsx')
for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -match '跳过|确认提纲') { 'L' + ($i + 1) + ': ' + $a[$i].Trim() } }

# ④ 探针行定位
$t = [System.IO.File]::ReadAllLines('tmp/verify-phase3.mjs')
for ($i = 0; $i -lt $t.Length; $i++) { if ($t[$i] -match 'clickText') { 'L' + ($i + 1) + ': ' + $t[$i].Trim() } }
```

### 5.9 主要风险与对策

| 风险 | 对策 |
| --- | --- |
| 短词新文案与探针子串匹配冲突（「跳过」「开始处理」） | 先确认唯一性；冲突时改**探针定位**，不加 DOM 属性（§3.1 / §3.6-3） |
| 同词多处只改一处（R4 要求一次改净） | 每条改动前后各跑一次 §5.8-①，确认**界面文件**命中数归零 |
| E-04 / E-06 / E-08 / E-09 / E-10 删除后出现空行 | 最小守卫 ＋ §4.6 界面复核 |
| 误碰服务端 / 导出文本 | 交付前 `git diff --stat` 复核文件清单，应恰为 §2.7 的实施文件 |
| 误碰探针契约（`aria-label` / `data-*` / `id`） | 逐项对照 §3.4 清单复查 diff |
| 整文件重写导致 CRLF / BOM 变化、diff 爆炸 | 遵守 §5.1；交付前检查 `git diff --stat` 的行数变化是否合理 |

---

## §6 附：本文档证据来源（可复现）

- PRD：`docs/PRD_REQ-28_文案清理.md`（全量逐条读取）
- 登记表：`docs/需求登记表.md` v2.5
- 代码：`src` 下全部 `.tsx` / `.ts` 逐字面内存扫描（§5.8 命令）
- 探针：`tmp` 下 34 个 `.mjs` 全量扫描 ＋ 受影响行内容抽取；`tmp/verify/**` 为编译产物，未采信
- 本文档**不含**任何改动记录；实施留痕另记于实施轮验证记录

---

> 编写：Cline ｜ 2026-10-06 ｜ 口径：§0.2（D-1 ~ D-4 已经总管确认）

