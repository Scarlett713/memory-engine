# REQ-35 任务单｜要素标引 prompt 优化

**执行人：** DS
**前置条件：** 需求登记表已补登，总管已放行
**禁止：** 不得动 src/lib/writing-rules.ts

> **只读核查校正（2026-11-04）**：本单由只读扫描产出，以下事实与原始指令不一致，已按实测校正，**未改动任何 `src/` 文件**。
>
> | # | 原始指令 | 实测（只读） | 处置 |
> | --- | --- | --- | --- |
> | 1 | `src/components/timeline-panel.tsx` | **该文件不存在**；实际为 `src/components/projects/timeline-panel.tsx`（LF / 5535 B，`PENDING_TIME_LABELS` 位于 `:14-18`） | S4 按实际路径执行 |
> | 2 | `npx tsx tmp/verify-req14-prompts.ts` | **该文件不存在**；实际为 `tmp/verify/verify-req14-prompts.ts`（24498 B） | S5 按实际路径执行 |
> | 3 | `npx tsx tmp/verify-req25-export-format.mjs` | 与实测一致（`tmp/verify-req25-export-format.mjs`，14928 B） | 原样执行 |
> | 4 | REQ-35 待补登 | **已登记**：§1.2 `:152` / §5.1 `:1275`（v2.26 补登、v2.27 四点裁决，提出时间 **2026-10-15**） | 不重复编号；按总管 2026-11-04 裁决，两行状态已回写为「任务单已出：`docs/tasks/REQ-35-task.md`（2026-11-04）」，**未新增行、未改提出时间** |
>
> **探针影响面（只读核实）**：`tmp/verify/verify-req14-prompts.ts` 对 `ark-llm-provider.ts` 的源码级断言仅 3 条（`:516-522`：`严禁自行脱敏` / `input.writingRules` / 插槽位于 `Transcript:` 之前），**不含** `timelineEvents` / `时间待补充` / `待人工补充`；`tmp/verify-req25-export-format.mjs` 全文对 `timeline` / `时间待补充` / `待人工补充` **0 命中** ⇒ S1~S4 不改变两支探针的断言数（仍应为 **136/136**、**31/31**）。

---

## 实施步骤

### S1 修改 prompt（主落点）
文件：`src/lib/providers/llm/ark-llm-provider.ts` 约 `L354`

现值（2026-11-04 只读核查，逐字）：
```ts
"9. timelineEvents should extract key events or life stages in chronological form when possible.",
```

将英文 rule 9 改为（或在其后插入）：
```
- timeLabel: use format "YYYY年" or a stage description (e.g. "童年时期").
  Never leave it empty. Do not force Gregorian year if unknown.
- description: ≤25 Chinese characters. State only the core event.
  Do NOT paraphrase or repeat the original transcript.
```

> 约束：只增改 rule 9 相关行；`:346-352` 的脱敏口径与 `:355` 的 `input.writingRules` 插槽位置**逐字不动**（探针 `:516-522` 锁定）。

### S2 修改兜底常量 1
文件：`src/lib/providers/llm/ark-llm-provider.ts` 约 `L234`

现值（`normalizeTimelineEvents` 归一化返回）：
```ts
timeLabel: timeLabel || "时间待补充",
```
将 `"时间待补充"` 改为 `"时间不详"`

### S3 修改兜底常量 2
文件：`src/lib/oral-history.ts` `L348-359`

现值（`createFallbackTimeline`）：
```ts
export function createFallbackTimeline(summary: string): TimelineEvent[] {
  if (!summary.trim()) {
    return [];
  }

  return [
    {
      id: "timeline-1",
      timeLabel: "待人工补充",
      title: "口述历史关键事件",
      description: summary.trim(),
    },
  ];
}
```
将 `"待人工补充"` 改为 `"时间不详"`（与 S2 统一）

### S4 修改前端兜底
文件：`src/components/projects/timeline-panel.tsx` `L14-18`

现值：
```ts
// 「时间待补充」的两种既有写法。需求原文是「时间待补充」，
// 但 createFallbackTimeline（oral-history.ts）实际写的是「待人工补充」——
// 短转写稿走兜底路径是最常见的情况，只认前者会让这批节点显示成实心节点 + 实线徽标，
// 看上去像「时间已知」。两个都收进来，不改数据层。
const PENDING_TIME_LABELS = new Set(["待人工补充", "时间待补充"]);
```
`PENDING_TIME_LABELS` **改为三值收口**（总管 2026-11-04 补充裁决：**保留原有两个值**以兼容存量数据，**只追加**新值，不替换、不删除）：
```ts
const PENDING_TIME_LABELS = new Set(["待人工补充", "时间待补充", "时间不详"]);
```
同步 `:14-17` 注释措辞（说明「三种写法」＝ 存量两值 ＋ 本次新增兜底值），避免注释与代码不一致。

> 与 S2 / S3 的关系：新兜底统一写 `"时间不详"`；三值集合同时覆盖**存量记录**（`"待人工补充"` / `"时间待补充"`）与**新增兜底**（`"时间不详"`）⇒ **不迁移数据**、不改展示语义（三者均渲染为「时间待补」态）。

### S5 运行探针确认无回归
```
npx tsx tmp/verify/verify-req14-prompts.ts   → 期望 136/136
npx tsx tmp/verify-req25-export-format.mjs   → 期望 31/31
```

### S6 文档回写（需求登记表版本位 ＋ 变更记录）
文件：`docs/需求登记表.md` —— **总管 2026-11-04 裁决：由 DS 实施时一并处理**（本单出稿阶段**未提前改**，登记表现仍为 v2.29 / 1327 行）

1. **版本行 `:3`**：`- 版本：v2.29` → `- 版本：v2.30`
2. **更新日期 `:4`**：`- 更新日期：2026-10-20` → 实施当天（取 commit 日期）
3. **变更记录**：在 **`:52`（v2.29 行）之后**追加 **1 行**（缩进与既有行一致 ＝ 2 空格 ＋ `- `）：
```
  - v2.30（YYYY-MM-DD）：**REQ-35 实施轮落盘（要素标引 prompt 优化：`timeLabel` 格式统一 ＋ `description` ≤ 25 字；四处落点同批；`PENDING_TIME_LABELS` 三值收口）** —— ① **落点四处**：`src/lib/providers/llm/ark-llm-provider.ts:354`（英文 rule 9）· `:234`（归一化兜底 `"时间待补充"` → `"时间不详"`）· `src/lib/oral-history.ts:348-359`（`createFallbackTimeline` 的 `"待人工补充"` → `"时间不详"`）· `src/components/projects/timeline-panel.tsx:14-18`（`PENDING_TIME_LABELS` **三值**：存量「待人工补充」/「时间待补充」＋ 追加「时间不详」）；② **未动**：`src/lib/writing-rules.ts`（REQ-14 探针锁定面，**0 hunk**）；③ **出口**：`tmp/verify/verify-req14-prompts.ts` **136/136** · `tmp/verify-req25-export-format.mjs` **31/31**；④ **行号效应**（`[IO.File]::ReadAllLines` 口径）：本版新增 **1 行**（本节）⇒ 文件 **1327 → 1328 行**。
```

> **硬约束（总管 2026-11-04 裁决②）**：三值收口裁决**随本条一并处理、不单独补** ⇒ 变更记录**只此 1 行**，**不得**另起 v2.31。
> **口径**：变更记录 `:49`（v2.26 行）中的「两值收口」为**历史原文，不改写**（本仓库惯例）。
> **自检**：改后 `[IO.File]::ReadAllLines` 应为 **1328**；`Select-String 'v2.30'` 命中 **2** 处（`:3` 与 `:53`）。

### S7 git 操作
```
git add src/lib/providers/llm/ark-llm-provider.ts src/lib/oral-history.ts src/components/projects/timeline-panel.tsx docs/需求登记表.md docs/tasks/REQ-35-task.md
git commit -m "feat: REQ-35 要素标引 prompt 优化 timeLabel格式+description≤25字"
# 不 push，等总管放行
```
> 说明：① 四个落点实际分布在 **3 个** `src/` 文件（ark 提供方 2 处、oral-history 1 处、timeline-panel 1 处）；② `docs/` 两件（登记表 v2.30 回写 ＋ 本任务单）**可与 feat commit 合并，也可单独一笔 `docs:` commit** —— 总管 2026-11-04 裁决「届时裁决」，二选一均可，但**须与本批同批或紧随其后**，不得留待下一批；③ 若选单独 docs commit，建议消息 `docs: v2.30 REQ-35 要素标引 prompt 优化落盘（四处落点 · 三值收口）`。

## 验收交付物
- [ ] 四处落点改动截图/diff
- [ ] verify-req14-prompts.ts 136/136 截图
- [ ] verify-req25-export-format.mjs 31/31 截图
- [ ] `docs/需求登记表.md` 版本行 **v2.30** ＋ **1 条** v2.30 变更记录（截图；`[IO.File]::ReadAllLines` ＝ **1328** 行）
- [ ] `git status` 确认 `src/` 仅 **3** 个预期文件（`src/lib/writing-rules.ts` **不在其中**）
- [ ] commit hash 回报
