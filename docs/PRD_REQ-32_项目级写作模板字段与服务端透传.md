# PRD_REQ-32 通用写作模板的项目级接入（项目级字段 ＋ 服务端透传）

## 表头

| 编号 | 标题 | 来源 | 优先级 | 状态 | 方案 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-32 | 通用写作模板的项目级接入（项目级字段 ＋ 服务端透传；UI 入口为下游） | 总管 2026-10-13 裁决立号（REQ-31 §0.4-Q2 的出口）· 只读扫描出稿（2026-11-07） | P2（**暂定**，待总管确认） | PRD 已出（待排期） | 方案 A：新增**唯一项目级字段** `writingTemplateKey?`，服务端全链透传（**不改模板数据本体**、**不加 UI**） | REQ-31（内核已交付）、REQ-14（探针锁定面）、REQ-25（导出侧 31 条硬线）、REQ-23（版本追溯，仅登记不确定项） |

## 0. 阅读须知（证据口径）

- 所有 `file:line` 均为 **2026-11-07 只读扫描的实测锚点**（`Get-Content` / `Select-String` 1-based），代码改动后必然漂移。
- 标记约定：**待裁决** = 需总管拍板；**待 DS 扫描确认** = 出稿时无法离线证实的实现细节；**不确定** = 事实层面尚无定论，不得在本条内假定。
- 本轮**只读**：`src/` / `storage/` / `tmp/` 零改动，未运行 dev server、未写入任何项目数据。

## 1. 现状（含问题）

### 1.1 内核已交付：显式键通道成立，但只在程序内可达

`src/lib/writing-rules.ts` 现状（REQ-31，2026-10-13，commit `3279536`）：

| 锚点 | 内容 |
| --- | --- |
| `:22-28` | `WritingTemplateKey` **6 键**：`tibet_aid` / `local_chronicle` / `enterprise_history` / `biography` / `family_memoir` / `general` |
| `:37-107` | `OUTLINE_WRITING_TEMPLATES` 6 套模板；`general` =「通用访谈类」，**3 章**骨架 |
| `:110` | `FALLBACK_WRITING_TEMPLATE_KEY = "biography"` |
| `:114-128` | `SCENARIO_WRITING_TEMPLATE`（场景 → 键；**不含 `general`**） |
| `:129-135` | `CUSTOM_TEMPLATE_KEYWORDS`（仅 `tibet_aid` / `enterprise_history` 两条，**不含 `general`**） |
| `:137-145` | `WritingTemplateInput`，**已含** `templateKey?: WritingTemplateKey`（REQ-31 交付，本条无需再动） |
| `:160-180` | `resolveWritingTemplate`：显式键（`:165-171`）→ `custom` 关键词兜底（`:173-175`）→ 场景映射（`:177-179`） |
| `:193-222` | `WRITING_RULES_TEMPLATE`（「章节标题逐字使用，不增删章节」口径即出自 `:212-214`） |
| `:229-237` | `buildWritingRules`（把模板名 / 章节渲染进 `{{TEMPLATE_NAME}}` / `{{TEMPLATE_CHAPTERS}}`） |

### 1.2 断点：生产链路**永不**传入 `templateKey`

`buildWritingRulesForProject`（`writing-rules.ts:240-252`）是目前**唯一**的生产接入点：

```ts
export function buildWritingRulesForProject(
  project: Pick<
    ProjectRecord,
    "projectName" | "customScenarioLabel" | "collectionScenario" | "researchFocus"   // :241-244
  >,
): string {
  return buildWritingRules({
    scenario: project.collectionScenario,
    customScenarioLabel: project.customScenarioLabel,
    projectName: project.projectName,
    researchFocus: project.researchFocus,
  });                                                                                  // :246-251
}
```

- `Pick` 字段集**没有**模板键 ⇒ 即便记录里存了也读不到；
- 调用体 `:246-251` **未传** `templateKey` ⇒ `resolveWritingTemplate` 的显式分支在生产链路**恒不命中**；
- 唯一调用点 `src/lib/server/process-project.ts:93`：`writingRules: buildWritingRulesForProject(project)`（该字面量被探针**源码级硬断言**，见 §8.3）。

### 1.3 数据层现状：全库零模板字段

- `ProjectRecord`（`src/lib/types/project.ts:161-213`）**无任何模板相关字段**；可选字段区 `:206-211` 现有 5 个（`intervieweeRelation` / `interviewOccasion` / `expectedOutput` / `language` / `projectCode` / `estimatedDuration`），其中 4 个在 `src/**` **零读零写**（见 §3.3-U2）。
- `storage/projects.json` 全量检索 `writingTemplate|templateKey|writing-rules` = **0 命中**（实测）。
- `CreateProjectInput`（`src/lib/server/project-store.ts:25-46`）无该键；`createProject` 的对象字面量（`:228-278`）无该键；`normalizeProjectRecord`（`:67-153`）**不处理**该键。
- 两个建项入口均未读取：`POST /api/projects`（`src/app/api/projects/route.ts:108-133` 的枚举解析段）与 `POST /api/projects/ai-interview`（`src/app/api/projects/ai-interview/route.ts:120-124`）。
- `PATCH /api/projects/[id]`（`src/app/api/projects/[projectId]/route.ts:185-275`）只做**状态机流转**（`VALID_TRANSITIONS`），**不接受任意字段写入** ⇒ 建项后无法改模板（本条不扩展，见 §2.2-N5）。

### 1.4 由此产生的四个问题

1. **`general` 在生产中不可达**：REQ-31 刻意未把 `general` 放进场景映射与关键词表，也未新增场景值 ⇒ 除程序化调用外，**任何项目都派不出 3 章骨架**。
2. **非口述史 / 非史志访谈被强套五章**：`collectionScenario = "custom"` 且标签不含「援藏 / 企业」关键词时，一律回落 `biography`（5 章）。
3. **没有项目级配置面**：模板**只能由场景派生**，同一机构的多个通用访谈项目无法逐个指定，更无法「同场景、不同模板」。
4. **导出侧仍是验证项**：REQ-31 已明记「3 章实件导出为接入轮验证项 ⇒ REQ-32」；导出层按**章标题正则**识别（不按章数），本条须补实件验证（AC-9）。

## 2. 目标 / 非目标

### 2.1 目标

- **G1 可达**：让 `general`（及其余 5 键）在**生产链路**可达 —— 建项时显式指定即生效，无需改场景枚举、无需加关键词。
- **G2 落库**：`writingTemplateKey` 作为**项目级字段**持久化，旧 JSON（无该键）读取后行为与改动前**逐字等价**。
- **G3 透传**：整理链（`process-project`）自动使用记录中的模板键，**不新增调用点参数**、不改 `process-project.ts`。
- **G4 可测**：在不依赖 UI、不依赖真实 LLM 的前提下，用纯函数断言 + 源码级断言证明「建项 → 落库 → 透传 → 渲染」四段连通。

### 2.2 非目标（明确不做，越界即返工）

| 编号 | 不做的事 | 理由 |
| --- | --- | --- |
| N1 | **不加任何 UI 控件**（上传页 / 新建页 / 详情页） | REQ-31 §0.4-Q3 裁决：UI 入口须先出设计稿，属本条**下游** |
| N2 | 不改 `OUTLINE_WRITING_TEMPLATES` 的 6 套模板字面、不加第 7 键 | REQ-31 已定稿（探针 `2b` 组 20 条守门） |
| N3 | 不改 `SCENARIO_WRITING_TEMPLATE` / `CUSTOM_TEMPLATE_KEYWORDS` / `FALLBACK_WRITING_TEMPLATE_KEY` | 同上；`general` 的「不可派生」是刻意设计 |
| N4 | 不改 `WRITING_RULES_TEMPLATE`（`writing-rules.ts:193-222`）与 `buildWritingRules` 渲染逻辑 | 规则正文与探针 3 / 4 / 7 组强绑定 |
| N5 | 不支持**建项后**改模板（`PATCH` 不扩字段） | `PATCH` 现仅做状态机（`:185-275`）；事后改模板牵出「是否重跑整理」问题（见 U1） |
| N6 | 不改导出层（`project-export.ts`）与 mock provider | REQ-25 出口 31 / 31 硬线；`mock-llm-provider.ts` 未接显式键是 §0.4-Q4 已接受的局限 |
| N7 | 不落库「模板名 / 章节骨架」快照 | §3.2 硬结论 2（第二真值源） |
| N8 | 不动 5 个既有可选字段的语义（`expectedOutput` 等） | §3.3-U2 |

### 2.3 用户故事

- **US-1（API 调用方 / 机构集成）**：作为机构侧集成方，我在 `POST /api/projects` 里带 `writingTemplateKey=general` 建项，后续整理稿即按 3 章通用骨架产出 —— 不需要我先「造一个能命中关键词的项目名」。
- **US-2（存量项目）**：作为既有 100+ 项目的使用者，我不做任何操作，整理结果与今天**完全一致**（无该键 = 走场景派生）。
- **US-3（测试 / 验收方）**：作为验收方，我用 `resolveWritingTemplate` / `buildWritingRulesForProject` 的纯函数断言即可判定「透传是否接通」，不需要跑真实 LLM。
- **US-4（未来 UI，下游）**：作为后续 UI 批次的实现者，我只需把选中的键塞进建项请求，服务端**零改动**即可支持。

## 3. 字段定性：哪些是项目级、哪些是派生（本条核心裁决面）

### 3.1 定性表

| 字段 / 值 | 是否落库 | 写入方 | 变化时机 | 定性 |
| --- | --- | --- | --- | --- |
| `writingTemplateKey` | **是**（可选，仅建项写） | 建项 API 调用方（未来 UI） | 建项 | **项目级字段（本条新增，唯一新增）** |
| `collectionScenario` | 是（既有 `:180`） | 建项 | 建项 | 项目级（既有）· **派生输入** |
| `customScenarioLabel` | 是（既有 `:166`） | 建项 | 建项 | 项目级（既有）· **派生输入** |
| `projectName` | 是（既有 `:163`） | 建项 | 建项（未来可改） | 项目级（既有）· **派生输入** |
| `researchFocus` | 是（既有 `:181`） | 建项 | 建项 | 项目级（既有）· **派生输入** |
| 生效模板（`name` / `chapters`） | **否** | `resolveWritingTemplate` 现算 | 每次整理时现算 | **派生值（禁止落库）** |
| 模板章节快照 | **否**（本期） | — | — | **不确定（U1）** |
| `expectedOutput` | 声明存在、**全库零写入** | — | — | **不确定（U2）** |

### 3.2 三条硬结论

1. **只新增 1 个项目级字段**；其余全部沿用既有字段，不新建第二套「项目模板配置」对象。
2. **派生值不入库**：模板 `name` / `chapters` 是 `OUTLINE_WRITING_TEMPLATES` 的只读投影 —— 落库会在模板字面变更后与代码形成**第二真值源**（旧项目永远停在旧骨架且无人知晓）。任何「把章节抄进项目记录」的实现一律驳回。
3. **「项目级」的判据 = 由调用方在建项时显式指定、且需要长期保存的输入**。据此 `writingTemplateKey` 是项目级；`general` 的 3 章骨架不是（它是 `key` 的函数）。

### 3.3 不确定项（本 PRD 不假定，须裁决后才可动）

- **U1 模板快照**：若日后要回答「这条记录当初是用哪套模板整理的」（与 REQ-23 版本追溯同源，`versionHistory` 目前**全库零写入**，`types/project.ts:212`），应在记录里存**快照键**（而非章节全文）。本期**不做**，且**不预留**字段 —— 预留等于冻结一个未定语义。→ **待裁决**。
- **U2 `expectedOutput` 是否与模板联动**：`expectedOutput`（`types/project.ts:208`）连同 `intervieweeRelation` / `interviewOccasion` / `projectCode` / `estimatedDuration`（`:206-211`）在 `src/**` **零读零写**（实测只有类型声明命中）⇒「口述史 → text/both、通用访谈 → text」这类联动**没有事实基础**，本条不碰，也不替它定义语义。
- **U3 UI 选择器的取值面**：只暴露「通用访谈类」一键切换，还是 6 键全开，属 UI 设计稿（N1 下游）。本 PRD 只保证**服务端 6 键全部合法**。

## 4. 契约与实现口径

### 4.1 新增字段定义

```ts
// src/lib/types/project.ts —— ProjectRecord 内，与既有可选字段同区（:206-211 一带）
writingTemplateKey?: WritingTemplateKey;
```

| 项 | 口径 |
| --- | --- |
| 名称 | `writingTemplateKey`（camelCase，与 `collectionScenario` / `collectionPath` 同风格） |
| 类型 | `WritingTemplateKey`（6 值联合，类型归属见 §4.3） |
| 必填 | 否 —— 缺省 = **不存在该键**（不是 `null`、不是 `biography`） |
| 取值域 | `tibet_aid` / `local_chronicle` / `enterprise_history` / `biography` / `family_memoir` / `general` |
| 写入时机 | **仅建项**（`POST /api/projects`、`POST /api/projects/ai-interview`） |
| 缺省语义 | 无键 ⇒ `resolveWritingTemplate` 走既有「关键词 → 场景 → `biography`」链路，与今天逐字一致 |

### 4.2 优先级不变式（不得回退）

`writingTemplateKey` 一旦存在，**必须**压过场景映射与关键词兜底：

```
writingTemplateKey（显式键）
  > custom 场景的关键词兜底（CUSTOM_TEMPLATE_KEYWORDS）
  > collectionScenario 映射（SCENARIO_WRITING_TEMPLATE）
  > FALLBACK_WRITING_TEMPLATE_KEY（biography）
```

该序由 `resolveWritingTemplate`（`:160-180`）既定、探针 `2b` 组已锁（`:552-579`：覆盖枚举映射 / 覆盖关键词兜底 / 非法键回落）。本条**只做一件事** —— 在 `buildWritingRulesForProject` 里把键递进去；**不得**改动顺序，**不得**在 `buildWritingRules` 里再加一层判断。

### 4.3 类型归属与循环依赖（R1 的解法）

**问题（实测）**：`writing-rules.ts:14` 已 `import type { InterviewScenario, ProjectRecord } from "@/lib/types/project"` ⇒ 若 `types/project.ts` 反向 `import type { WritingTemplateKey } from "@/lib/writing-rules"`，即构成**类型级循环**，且语义上「纯类型文件依赖业务模块」是倒挂。

**方案 A（推荐）：把联合类型下移到纯类型文件**

```ts
// src/lib/types/project.ts（新增，置于 ProjectRecord 之前）
export type WritingTemplateKey =
  | "tibet_aid"
  | "local_chronicle"
  | "enterprise_history"
  | "biography"
  | "family_memoir"
  | "general";
```

```ts
// src/lib/writing-rules.ts:14 一带 —— 删掉原 :22-28 的定义，改为
import type { WritingTemplateKey } from "@/lib/types/project";
export type { WritingTemplateKey }; // tsconfig 的 isolatedModules: true 要求 export type
```

- 对外导入面**不变**：`@/lib/writing-rules` 仍能导出该类型；
- 实测外部引用 = **0 处**（`src/**` 递归检索 `WritingTemplateKey` 共 **8 处**命中，**全部在 `writing-rules.ts` 自身**：`:22` / `:31` / `:38` / `:110` / `:116` / `:130` / `:144` / `:149`）⇒ 迁移成本 ≈ 0；
- 键值字面量**只搬不改**（6 值逐字一致）⇒ 探针 `2b`「模板总数 = 6」（`:534`）不受影响。

**方案 B（驳回）**：在 `types/project.ts` 重复声明 6 值联合 ⇒ 双真值源，与 §3.2-2 同类错误。
**方案 C（驳回）**：字段类型写 `string` ⇒ 丢类型安全，`Pick` 处需 `as` 强转，评审必拒。

> **待 DS 扫描确认**：「0 处外部引用」为本机 `Get-ChildItem -Recurse -Include *.ts,*.tsx | Select-String` 实测；落地前请用 `rg -n "WritingTemplateKey" src` 复核（含 `src/**/*.mts` 与 `.next/types` 生成物以外的全部文件）。

### 4.4 校验口径（非法值怎么办）

| 方案 | 行为 | 评价 |
| --- | --- | --- |
| **A（建议）静默丢弃** | 非法 / 空串 ⇒ 该键不写入记录，HTTP 仍 `201` | 与既有 `parseEnumValue`（`enum.ts:16-23`：非法值**回退**而非 400）**同风格**；缺点：调用方拼错无感知 |
| B 返回 400 | 非法值直接拒建 | 契约更严，但与同文件其它枚举字段（`collectionScenario` / `privacyLevel` / `collectionPath`）**不一致** |
| C 原样存 | 不做白名单 | 记录里留垃圾值、GET 会回显给未来 UI ⇒ 拒绝 |

**推荐 A**，并要求把「非法值 ⇒ 记录中该键不存在」写成断言（AC-4）。

实现注意：`parseEnumValue` 的签名是 `(value, allowed, fallback: T): T`，**不能**直接复用（本字段缺省必须是 `undefined`，不能是某个默认键）。两条路：
- 在 route 内联：`const raw = formData.get("writingTemplateKey"); const writingTemplateKey = isWritingTemplateKey(raw) ? raw : undefined;`
- 或给 `enum.ts` 增一个 `parseOptionalEnumValue<T>(value, allowed): T | undefined`（**新增导出，待裁决**，见 Q2）。

### 4.5 归一化口径（旧 JSON 兼容 —— R2 的核心）

`normalizeProjectRecord`（`project-store.ts:67-153`）在**每次读取**时执行，且归一化后的数组会被**写回**（`createProject` / `updateProject` 都在 `runExclusive` 锁内 `writeProjects`）⇒ 归一化里任何一个「补默认值」都会**被持久化**。

硬约束：

- **禁止** `writingTemplateKey: project.writingTemplateKey || "biography"` —— 这会把全库存量项目从「场景派生」**永久锁死**成 biography，是本条最严重的回归形态；
- 推荐写法（二选一，都满足「无键 ⇒ JSON 里不出现该键」）：

```ts
// 写法 1：条件展开（显式表达「无值不落键」）
...(isWritingTemplateKey(project.writingTemplateKey)
  ? { writingTemplateKey: project.writingTemplateKey }
  : {}),

// 写法 2：赋 undefined（JSON.stringify 会丢弃 undefined 属性）
writingTemplateKey: isWritingTemplateKey(project.writingTemplateKey)
  ? project.writingTemplateKey
  : undefined,
```

- `isWritingTemplateKey` 的类型守卫放哪 —— **待裁决（Q3）**：
  - 放 `project-store.ts` 本地：0 新导出，但校验表与 `OUTLINE_WRITING_TEMPLATES` **可能脱钩**（第二真值源）；
  - 放 `writing-rules.ts` 导出：单一真值源，但该文件是 REQ-14 探针锁定面，**新增导出须总管点头**（REQ-31 先例：解冻范围须先裁决）。

### 4.6 入口覆盖：两个建项 API（对登记表「5 处触点」的修正）

| 入口 | 载体 | 现状 | 本条是否改 |
| --- | --- | --- | --- |
| `POST /api/projects` | `FormData` | `route.ts:108-133` 枚举解析段无该键 | **改**（加 1 段解析 + 传参） |
| `POST /api/projects/ai-interview` | JSON | `ai-interview/route.ts:120-124` 无该键；`AiInterviewRequest`（`:37-50`）无该字段 | **改**（登记表漏记的第 6 处） |

**修正说明**：登记表 §三 / §5.1 记的「5 处触点」把 `process-project.ts:93` 算作改动点，且**未计** `ai-interview/route.ts`。实测结论与登记相反：

- `process-project.ts:93` 的 `buildWritingRulesForProject(project)` 传的是**整个项目对象**，透传只需扩 `Pick` + 在函数体内递键 ⇒ **该文件 0 hunk**；且该字面量被探针 `:526` 源码级硬断言（`processSource.includes("buildWritingRulesForProject(project)")`），改了必红；
- `ai-interview` 是**独立建项入口**，不覆盖则「AI 访谈路径建的项目永远不能指定模板」，与 G1 直接冲突。

**仍待裁决（Q1）**：是否本批同时覆盖 `ai-interview`。推荐覆盖；若不覆盖，须在本 PRD 显式记为「AI 路径不可达」的已知缺口，并同步登记表。

## 5. 数据流（端到端）

```
建项（两条入口，均只在此刻写入）
  ① 上传路径（UI 为下游，本条 0 hunk）
     interview-upload-form.tsx → store/project-workspace.ts:79-110（FormData）
        → POST /api/projects（route.ts:108-133 解析 / :181 起 createProject）
  ② AI 访谈路径（UI 为下游，本条 0 hunk）
     new-project-flow.tsx:171-186（JSON）→ POST /api/projects/ai-interview
        （ai-interview/route.ts:120-124 解析 / :151 起 createProject）
                                    ↓
落库：project-store.createProject（:224-289）→ storage/projects.json（一条 ProjectRecord）
                                    ↓
读回：normalizeProjectRecord（:67-153）—— 无键 ⇒ 保持无键（§4.5）
                                    ↓
整理：POST /api/projects/[id]/process → process-project.ts:87-94
        → writingRules: buildWritingRulesForProject(project)（:93，**0 hunk**）
        → writing-rules.ts:240-252（Pick 扩键 + 递 templateKey）
        → resolveWritingTemplate（:160-180）→ 显式键命中 general
        → WRITING_RULES_TEMPLATE 渲染（:229-237）→ ark provider prompt 的 writingRules 插槽
                                    ↓
导出：project-export.ts（**0 hunk**）—— 3 章实件须验证章标题识别（AC-9）
```

| 段 | 落点 | 本条改动 |
| --- | --- | --- |
| 写入口 | 2 个 API route | 各加 1 段白名单解析 + 1 行入参 |
| 存储层 | `project-store.ts` | `CreateProjectInput` + 字面量 + 归一化 |
| 生成侧 | `writing-rules.ts` | `Pick` 扩键 + 递键（+ 类型下移） |
| 调用点 | `process-project.ts:93` | **0 hunk** |
| UI / 导出 / mock | — | **0 hunk** |

## 6. 改动范围（文件 + 行号 + 具体改什么）

### 6.1 `src/lib/types/project.ts`

- 新增 `WritingTemplateKey` 联合类型（6 值，见 §4.3），置于 `ProjectRecord` 之前；
- `ProjectRecord`（`:161-213`）可选字段区（`:206-211` 一带）新增 `writingTemplateKey?: WritingTemplateKey;`；
- **不动**：`ProjectStatus` / `VALID_TRANSITIONS`（`:10-16`）、`createInitialWorkflow`（`:215` 起）、既有 5 个可选字段。

### 6.2 `src/lib/writing-rules.ts`

- `:22-28` 的 `WritingTemplateKey` 定义 → 改为从 `types/project` 导入并 `export type { WritingTemplateKey }`（§4.3 方案 A）；
- `:241-244` 的 `Pick` 字段集追加 `"writingTemplateKey"`；
- `:246-251` 的调用体追加 `templateKey: project.writingTemplateKey`；
- （若 Q3 裁「守卫放 lib」）追加 `isWritingTemplateKey` 导出；
- **不动**：`OUTLINE_WRITING_TEMPLATES`（`:37-107`）、`FALLBACK_WRITING_TEMPLATE_KEY`（`:110`）、`SCENARIO_WRITING_TEMPLATE`（`:114-128`）、`CUSTOM_TEMPLATE_KEYWORDS`（`:129-135`）、`resolveWritingTemplate`（`:160-180`）、`WRITING_RULES_TEMPLATE`（`:193-222`）、`buildWritingRules`（`:229-237`）。

### 6.3 `src/lib/server/project-store.ts`

- `CreateProjectInput`（`:25-46`）追加 `writingTemplateKey?: WritingTemplateKey;`；
- `createProject` 对象字面量（`:228-278`）追加该键（**透传 input，不写默认值**）；
- `normalizeProjectRecord`（`:67-153`）追加守卫（§4.5 写法 1 或 2）；
- **不动**：`normalizeWorkflowCopy`（`:48-65`）、`sensitiveMarks` 归一化（`:132-142`）、`createProject` 的锁与排序（`:280-288`）。

### 6.4 `src/app/api/projects/route.ts`

- `:108-133` 解析段之后追加 `writingTemplateKey` 解析（白名单命中才取值，否则 `undefined`）;
- `:181` 起 `createProject({ … })` 入参追加 1 行;
- **不动**：`formData()` 的 try/catch（BUG-11 修复）、`:135-152` 的 400 分支、`NOTES_MAX_LENGTH` 截断、`:189` 起的外层 catch（BUG-12 登记面）。

### 6.5 `src/app/api/projects/ai-interview/route.ts`

- `AiInterviewRequest`（`:37-50`）追加 `writingTemplateKey?: unknown;`；
- `:120-124` 解析段之后追加解析（复用 `toEnumInput`，`:56-58`：JSON 侧只放行字符串，其余当缺失）；
- `:151` 起 `createProject({ … })` 入参追加 1 行；
- **不动**：提纲必填校验（`:140-142`）、custom 场景校验（`:144-149`）、二次写 workflow（`:183` 起）。

### 6.6 0 hunk 清单（硬红线）

| 文件 / 面 | 理由 |
| --- | --- |
| `src/lib/server/process-project.ts` | `:93` 字面量被探针 `:526` 源码级硬断言；`project` 已全量传入 ⇒ 无需改 |
| `src/lib/providers/llm/ark-llm-provider.ts` | 插槽 `input.writingRules` 已接（探针 `:517-522` 三条守门） |
| `src/lib/providers/llm/mock-llm-provider.ts` | §0.4-Q4 已接受的局限（探针 `:619` 守门「mock 未接显式键」） |
| `src/lib/server/project-export.ts` | REQ-25 出口 31 / 31 硬线 |
| `src/app/api/projects/[projectId]/route.ts` | `PATCH` 只做状态机（N5），不扩任意字段写 |
| `src/store/project-workspace.ts`、`src/components/**` | UI 为下游（N1） |
| `src/lib/server/enum.ts` | 除非 Q2 裁「新增 `parseOptionalEnumValue`」 |
| `storage/**` | 只读扫描，不改数据 |

## 7. 验收标准

| 编号 | 验收点 | 判据 / 证据 |
| --- | --- | --- |
| **AC-1** | 类型零回归 | `npx tsc --noEmit` **0 error**；`npx eslint src` 与基线一致（当前存量 6 项，不得增加） |
| **AC-2** | 上传路径写入 | `POST /api/projects`（multipart）带 `writingTemplateKey=general` ⇒ `201` 且落库记录**含**该键（`general`） |
| **AC-3** | AI 访谈路径写入 | `POST /api/projects/ai-interview`（JSON）带该键 ⇒ `201` 且记录含该键；若 Q1 裁「不做」，本 AC 改为「已知缺口登记」并同步登记表 |
| **AC-4** | 非法值丢弃 | 带 `writingTemplateKey=nope`（或空串）⇒ `201` 且记录中**不存在**该键（不是 `null`、不是 `biography`） |
| **AC-5** | 旧 JSON 兼容 | 对 `storage/projects.json` 全量记录跑 `normalizeProjectRecord`：输出**不含**该键；且「无键 × 6 场景」的 `resolveWritingTemplate` 结果与改动前**逐字相同**（比对 `name` + `chapters`） |
| **AC-6** | 透传接通 | `buildWritingRulesForProject({ collectionScenario: "urban_memory", writingTemplateKey: "general", … })` 输出含「本项目适用模板：通用访谈类。」＋ 3 条章标题，且**不含**五章字面 |
| **AC-7** | 优先级不变 | `custom` + 项目名含「公司」+ 键 `general` ⇒ 仍 `general`（显式键压过关键词兜底）；键 `nope` ⇒ 回落地方史志（与探针 `:574-579` 同口径） |
| **AC-8** | 探针全绿 | `verify-req14-prompts.ts` ≥ **136**（既有 136 条零改动 + 新增组全绿）、`verify-req25-export-format.mjs` **31 / 31** |
| **AC-9** | 3 章实件导出 | 建 1 个 `general` 项目 → 整理 → 导出 `.docx`：3 个章标题全部被识别为章（无跳章 / 无「章节缺失」），与 REQ-25 版式规范一致。**导出侧识别口径登记表记 `project-export.ts:186-216` 一带，本 PRD 未逐行核实 ⇒ 待 DS 扫描确认** |
| **AC-10** | 反向证据（0 hunk） | `git diff --stat` 中 `process-project.ts` / `ark-llm-provider.ts` / `mock-llm-provider.ts` / `project-export.ts` / `src/components/**` **均为空** |

## 8. 探针与回归

### 8.1 新增断言组 `2c.项目级`（建议 8 条；组名避开既有 `2b`）

| # | 断言 | 期望值 / 判据 |
| --- | --- | --- |
| 1 | 白名单守卫 | `isWritingTemplateKey("general") === true`、`isWritingTemplateKey("nope") === false`、`isWritingTemplateKey("") === false`（取决于 Q3 的落点） |
| 2 | 透传接通 | `buildWritingRulesForProject({ collectionScenario: "urban_memory", customScenarioLabel: "", projectName: "x", researchFocus: "", writingTemplateKey: "general" })` 输出包含 `本项目适用模板：通用访谈类。` |
| 3 | 章数 = 3 | 上述输出中「中文数字 + 、」开头的章标题行**恰好 3 行**（**口径已核实**：`buildWritingRules` 以 `template.chapters.join("\n")` 注入（`:235`）⇒ 章标题**严格一行一条**；`WRITING_RULES_TEMPLATE` 自身用 `【】`／阿拉伯数字分段，无「一、」开头行 —— 见 `:191-192` 注释） |
| 4 | 无键 = 5 章 | 同一输入去掉 `writingTemplateKey` ⇒ 章标题行**恰好 5 行**，且输出与「改动前基线字符串」**逐字相同**（旧行为等价，AC-5 的纯函数面） |
| 5 | 非法键回落 | `writingTemplateKey: "nope" as never` 的输入 ⇒ 输出与「删除该键」的输入**逐字相同** |
| 6 | 优先级 | `collectionScenario: "custom"` + `projectName: "某公司发展史采集"` + `writingTemplateKey: "general"` ⇒ 仍是 `通用访谈类`（显式键压过关键词兜底） |
| 7 | 归一化不补默认值（源码级） | `project-store.ts` 中**不出现** `writingTemplateKey || ` 这类兜底；且出现类型守卫调用 |
| 8 | 调用点 0 hunk（源码级） | `process-project.ts` 仍含 `buildWritingRulesForProject(project)` — 与探针 `:526` 同口径，本条不新增重复断言亦可，但须在交付说明里点明「未改」 |

> **待 DS 扫描确认**：上述 1 / 7 两条的**可断言形态**取决于 Q2 / Q3 的裁决（守卫是否导出、是否新增 `parseOptionalEnumValue`）。若最终不导出守卫，则 1 / 7 改为「跑一次真实 `POST /api/projects` 后的 GET 断言」（成本更高，可降级为人工验收项）。

### 8.2 回归硬线（一条都不许红）

| 命令 | 基线 | 说明 |
| --- | --- | --- |
| `npx tsx tmp/verify/verify-req14-prompts.ts` | **136 / 136（exit 0）** | 既有 136 条**零改动**；只允许追加 `2c` 组 |
| `npx tsx tmp/verify-req25-export-format.mjs` | **31 / 31** | 导出层 0 hunk ⇒ 不得回退 |
| `npx tsc --noEmit` | 0 error | — |
| `npx eslint src` | 存量 6 项不变 | — |

### 8.3 不得动的既有断言（源码级，最容易误伤）

| 探针位置 | 断言 | 误伤方式 |
| --- | --- | --- |
| `verify-req14-prompts.ts:526` | `processSource.includes("buildWritingRulesForProject(project)")` | 把调用点改成 `buildWritingRulesForProject(project, key)` 或 `(project as ...)` ⇒ **必红**。本条明令 **0 hunk** |
| `:534` | `Object.keys(OUTLINE_WRITING_TEMPLATES).length === 6` | 顺手加第 7 套模板 ⇒ 必红（N2） |
| `:601-612` | `general` 不进 `SCENARIO_WRITING_TEMPLATE` / `CUSTOM_TEMPLATE_KEYWORDS` | 「让 general 更易命中」去加关键词 ⇒ 必红（N3） |
| `:619` | `!mockSource.includes("templateKey")` | 为了让 mock 也能演示而给 mock 接键 ⇒ **必红**（§0.4-Q4 已裁「接受该局限」） |

## 9. 风险

| 编号 | 风险 | 影响 | 对策 |
| --- | --- | --- | --- |
| **R1** | 类型循环（`types/project` ↔ `writing-rules`） | TS 能过（类型循环允许），但 lint / 审阅不过，且语义倒挂 | §4.3 方案 A；**明令禁止**在 `types/project.ts` 里 `import from "@/lib/writing-rules"` |
| **R2** | 归一化补默认值 | **最严重**：全库存量项目被写回并**永久锁死**为 `biography` | §4.5 硬约束；AC-5 专项断言；代码评审逐字核对 `normalizeProjectRecord` |
| **R3** | 触碰 REQ-14 探针锁定面 | `writing-rules.ts` 属锁定面，历史先例（REQ-25 裁决 3 / REQ-31）要求**先裁决解冻范围** | 解冻范围明列于任务单 §1：类型下移 + `Pick` 扩键 + 递键（＋可能 1 个守卫导出），其余 0 hunk |
| **R4** | 端到端不可离线验证 | mock 链路仍 5 章（§0.4-Q4）⇒ 无法用 mock 演示 3 章 | 验收以纯函数断言为主（AC-6 / AC-7），实件走真链路（AC-9） |
| **R5** | 3 章导出未离线证实 | `project-export.ts` 的章标题识别口径未逐行核实 | AC-9 列专项；若实测失败，按「导出侧另立号」处理，**不得**在本条顺手改导出层（N6） |
| **R6** | 只覆盖一个入口 | 若 Q1 裁「不覆盖 ai-interview」⇒ AI 路径永远无法指定模板 | AC-3 条件化 + 登记表明记缺口 |

## 10. 待裁决 / 待确认（Q1–Q6）

| 编号 | 问题 | 推荐 | 备注 |
| --- | --- | --- | --- |
| **Q1** | 是否本批覆盖 `POST /api/projects/ai-interview` | **覆盖** | 不覆盖则 G1 只成立一半；且登记表「5 处触点」需同步更正为 6 处 |
| **Q2** | 是否给 `enum.ts` 新增 `parseOptionalEnumValue` | **不新增**，在 route 内联判断 | `enum.ts` 是共用防御层，动它影响面大于收益 |
| **Q3** | `isWritingTemplateKey` 守卫放哪 | **`writing-rules.ts` 导出**（单一真值源） | 属**新增导出**，须总管在解冻范围里点名；备选 `project-store.ts` 本地（0 新导出但有脱钩风险） |
| **Q4** | 非法值语义：静默丢弃 vs 400 | **静默丢弃（201）** | 与 `parseEnumValue` 既有风格一致（§4.4） |
| **Q5** | 是否为 U1（模板快照）预立编号 | **不预立** | 无写入方、无消费方，预立等于冻结未定语义 |
| **Q6** | 是否让 `PATCH` 支持改模板 | **不做** | 牵出「改后是否重跑整理 / 旧稿怎么办」，须与 REQ-23 一并裁 |

## 11. 落地顺序建议（S1 → S6）

| 步 | 内容 | 出口检查 |
| --- | --- | --- |
| S1 | `types/project.ts`：类型下移 + 字段；`writing-rules.ts`：改 import / `export type` | `tsc --noEmit` 0 error；`git diff` 仅 2 文件 |
| S2 | `project-store.ts`：`CreateProjectInput` + 字面量 + 归一化守卫 | 旧 JSON 读回不含新键（AC-5 纯函数面） |
| S3 | 两个 route：解析 + 入参 | 手工 POST 两条路径，记录含 / 不含键各一次 |
| S4 | `writing-rules.ts`：`Pick` 扩键 + 递 `templateKey` | 纯函数手测 `general` 输出 3 章 |
| S5 | 探针追加 `2c` 组（**先红后绿**：先写断言、跑一次确认红，再补 S4 使其转绿） | 探针 ≥ 136 全绿 |
| S6 | 回归 + 实件（AC-9）+ 文档回写 | 136 / 31 / tsc / eslint 四项同屏 |

> **注**：S5 的「先红后绿」沿用 REQ-31 的留证惯例（改源前先跑，FAIL + exit 1 留档），便于把「断言真的在测这件事」与「碰巧全绿」区分开。

---

**出稿说明**：本 PRD 为**只读扫描**产物（2026-11-07），未改 `src/` / `storage/` / `tmp/`；文中所有 `file:line` 为当时实测锚点。任务单见 `docs/tasks/REQ-32-task.md`。





