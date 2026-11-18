# UI-32 实施任务单｜AI 访谈作答态显示当前问题（+15 −0 · 单文件 · 零状态）

**执行人：** DS
**上游：** `docs/PRD_UI-32_AI访谈显示当前问题.md`（PRD 定稿，含总管 2026-11-18 三问裁决 Q1 / Q2 / Q3）；`docs/需求登记表.md:1225`（§三 UI-32）
**前置条件：** PRD 已出 ＋ **总管放行实施**（未放行不得开工）；`git status` 无他人同文件在途改动
**禁止：** 不碰 BUG-09 三处已验收面（`fetchNextQuestion` `:818-900` / `AbortController` `:819-823` / 错误 UI `:1261-1277`）；不改 `ai_asking` `:1128-1139`、`paused` `:1234-1250`、字幕卡 `:1193-1199`、操作行 `:1201-1226` 任何一行；不动 `src/app/api/**` / `src/lib/**` / `storage/**`
**规模：** `src` **1 个文件 1 个 hunk，+15 −0**（3 行注释 ＋ 11 行 JSX ＋ 1 空行）；`docs` 回写 1 件（§5）
**行号基线：** 2026-11-18 实测 `interview-console.tsx` = **1394 行**（`[IO.File]::ReadAllLines` 口径）；实施后应为 **1409 行**
**探针基线：** `node tmp/verify-bug09-next-question-timeout.mjs` 出稿前实测 **exit 0**（本单出口要求：**仍 exit 0**）
**状态：** **待 DS 实施**（总管放行后执行）

---

## §0 口径与纪律

### 0.1 行号复核（禁用 `Get-Content` 定位）

PowerShell 5.1 的 `Get-Content` 把无 BOM 的 UTF-8 当 GBK 解码，中文标点后的换行会被吞 ⇒ **一律用**：

```powershell
$a = [IO.File]::ReadAllLines('src/components/interview/interview-console.tsx')
for ($i = 0; $i -lt $a.Length; $i++) {
  if ($a[$i] -match 'user_answering|permissionError|Step 3 已接入 Web Speech|实时字幕') { 'L' + ($i + 1) + ': ' + $a[$i].Trim() }
}
```

**行号漂移时以「逐字锚点」定位、不认行号**（锚点见 §1.1）。本单所有行号均为 2026-11-18 水位。

### 0.2 改动纪律

- **只新增 1 个 JSX 块**（§1.2 逐字）；不删、不改、不重排既有任何行。
- 复用既有 class：`surface-card` / `rounded-[1.55rem]` / `section-eyebrow` / `tape-label` / `flex` / `items-center` / `justify-between` / `gap-3` / `mt-2` / `line-clamp-2` / `text-sm` / `leading-7` / `text-foreground` —— **不新增 CSS 类、不改 `globals.css`**。
- **不新增** state / action / props / effect / 接口调用 / 依赖 / 组件文件；**不加** `soft-scroll` / `max-h` / 折叠按钮 / `title` / `data-*`。
- 文案**只用既有字面量**：「当前问题」「第 {n} / {m} 题」「（等待 AI 提问）」—— 逐字取自 `ai_asking:1131` / `:1133` / `:1138`。
- 本仓无 prettier / editorconfig（`lint` = `eslint`），eslint 不因行长告警；但仍**保持与相邻块同缩进**（14 空格起）。

---

## §1 S1：插入问题卡（唯一改动）

### 1.1 定位（逐字锚点，插入点 = 两者之间）

```text
              ) : null}                                              ← ①权限横幅块结尾（:1190）

              {/* Step 3 已接入 Web Speech；「暂停滚动 / 清屏（仅视图）」仍待补。 */}   ← ②字幕卡前注释（:1192）
```

> 上面两块是**定位示意**（`←` 为定位标注，**不是代码**）：实施时保留这两行原样，把 §1.2 的整块插到它们之间。

在两行之间（**保留这两行原样**）插入 §1.2 的整块，并在块后留 **1 个空行**。

### 1.2 插入内容（逐字，14 行 ＋ 尾空行 = 15 行）

```tsx
              {/* UI-32：作答态固定显示当前问题 —— 总管 2026-11-18 裁决：带题号、
                  限 2 行截断不折叠、固定在字幕卡上方且不随字幕滚动。
                  只读 state，不新增 action；形态对齐 ai_asking / paused。 */}
              <div className="surface-card rounded-[1.55rem] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-eyebrow">当前问题</p>
                  <div className="tape-label">
                    第 {state.questionIndex + 1} / {questionTotal} 题
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-7 text-foreground">
                  {state.currentQuestion || "（等待 AI 提问）"}
                </p>
              </div>
```

> 口径核对：`state` / `questionTotal` 均为该组件内既有作用域变量（`questionTotal` 定义于 `:634`），**无需新增解构**；`line-clamp-2` 属 Tailwind v4 核心工具类（无需插件）。

---

## §2 S2：离线自检（不启 dev server 也能验）

```powershell
# ① 行数（1394 → 1409）
([IO.File]::ReadAllLines('src/components/interview/interview-console.tsx')).Length

# ② diff 规模（期望 +15 / −0，且只有 1 个 src 文件）
git diff --numstat -- src

# ③ hunk 数（期望 1 个 hunk，位置落在 user_answering 分支内）
git diff -U0 -- src/components/interview/interview-console.tsx

# ④ 字面量计数（期望值：2 / 2 / 3）
(Select-String -Path src/components/interview/interview-console.tsx -Pattern '当前问题' -AllMatches).Matches.Count
(Select-String -Path src/components/interview/interview-console.tsx -Pattern 'questionIndex \+ 1\} / \{questionTotal\} 题' -AllMatches).Matches.Count
(Select-String -Path src/components/interview/interview-console.tsx -Pattern '（等待 AI 提问）' -AllMatches).Matches.Count

# ⑤ 越界面反证（期望 0 命中）
git diff -- src/app src/lib storage | Measure-Object -Line
```

| 检查项 | 期望 | 不达标处置 |
|---|---|---|
| 文件行数 | **1409** | 行数不符 ⇒ 检查是否多/少空行，**禁止**为凑数改其他行 |
| `git diff --numstat -- src` | `15  0  src/components/interview/interview-console.tsx` | 出现第 2 个文件 ⇒ **回退重做** |
| hunk 数 | **1** | 出现多 hunk ⇒ 说明误改了既有行，须还原 |
| 「当前问题」 | **2**（`ai_asking:1131` ＋ 新增） | 3 及以上 ⇒ 误改他处 |
| 「第 x / y 题」模板 | **2**（`ai_asking:1133` ＋ 新增） | 同上 |
| 「（等待 AI 提问）」 | **3**（`ai_asking:1138` / `paused:1242` / 新增） | 同上 |
| `src/app` `src/lib` `storage` diff | **0 行** | 任何命中 ⇒ 立即回退 |

---

## §3 S3：联调与视觉验收（AC 全表）

**环境**：`npm run dev`（`next dev --webpack`，:3000）→ `/projects` → 任一项目 → 「AI 访谈」入口；断点续访项目可点「从断点继续」（只验显示，不改其行为）。

| AC | 操作 | 期望 | 视口 |
|---|---|---|---|
| AC-1 | 点「开始回答」进入作答态 | 眉标「当前问题」＋ 胶囊「第 n / m 题」＋ 问题正文三者同时出现 | 390×844 |
| AC-2 | 对照进入作答**前** `ai_asking` 的题号 | 两处 `n / m` 逐字相同，且 `n ≤ m` | 390×844 |
| AC-3 | 用后台把当前问题置空（或走接口未回填路径） | 显示 `（等待 AI 提问）`，与 `ai_asking` / `paused` 逐字一致 | 任 |
| AC-4 | 后端返回 ≥ 60 字长问题 | 只 2 行 ＋ 省略号；无横滚、无第 3 行、无展开控件 | 390×844 |
| AC-5 | 持续说话使字幕增长 | 问题卡 y 坐标不变（前后截图对比） | 390×844 |
| AC-6 | 拒绝麦克风权限后再开始回答 | 顺序：眉标行 → 权限横幅 → **问题卡** → 字幕卡 → 操作行 | 390×844 |
| AC-7 | 逐一走 `ready` / `ai_asking` / `paused` / `error` | 与改前一致（`git diff` 中这四块 0 hunk ＋ 截图对比） | 1280×800 |
| AC-8 | `git status --porcelain` | `src/` 仅 1 个文件变更 | — |
| AC-9 | `node tmp/verify-bug09-next-question-timeout.mjs` | **exit 0**，输出与本单出稿前基线一致 | — |
| AC-10 | 最矮视口作答态 | 可滚动到「结束回答」并点击；字幕卡仍 `min-h-[14rem]` | 375×667 |

**截图清单（交付物）**：① 390×844 作答态全屏；② 375×667 作答态全屏（含滚动到底）；③ 长问题 2 行截断特写；④ 权限横幅 ＋ 问题卡同屏；⑤ `ai_asking` 与作答态题号对照（可拼图）。

---

## §4 S4：探针出口

```powershell
node tmp/verify-bug09-next-question-timeout.mjs   # 期望 exit 0（与本单出稿前基线一致）
```

- 该探针对本文件只做 **regex / `indexOf` 口径**（`NEXT_QUESTION_TIMEOUT_MS`、`AbortController` 唯一性等），不 pin 行号、不读 `user_answering` 区块 ⇒ 本单 +15 行**不应改变其判定**。
- `tmp/verify-bug09-taskorder.mjs` / `tmp/verify-bug11-12-docs.mjs` 为**预存红单**（钉旧行号 / 旧文档水位），**不得计入本条门禁**，本单**不回改**。
- 不跑 `tmp/verify-phase3.mjs`（需 dev server ＋ Chrome，且不进入访谈页）。

---

## §5 S5：文档回写（`docs/需求登记表.md` → v2.39）

1. **版本行 `:3`**：`v2.38` → `v2.39`；**更新日期 `:4`** → 实施当天。
2. **变更记录**：在 **v2.38 行之后**（现 `:61` → 实施时按 `- v2.38` 逐字锚点定位）追加 **1 行**，`①…⑤` 建议要点：① 落点（单文件单 hunk，`:1191+` 起 15 行）；② 三问裁决落地（题号 / 2 行截断 / 不联动）；③ 探针 `verify-bug09-next-question-timeout.mjs` exit 0；④ 行号效应（`src` 1394 → 1409；本文档 +1 行）；⑤ 未 commit / 待放行。
3. **§三 UI-32（状态行 `:1227`）**：状态字面 `**PRD / 任务单已出（2026-11-18）· 待总管放行实施**` → `**已实施（YYYY-MM-DD），待验收**`。
4. **§1.2 `:159` ＋ §5.1 `:1327`**：状态列同步为同一 token（三处不得矛盾）。
5. **行号效应**：本节新增 1 行 ＋ 三处行内改字 ⇒ 文件行数按实测填写（当前 1384 行）。

---

## §6 S6：git

```powershell
git add src/components/interview/interview-console.tsx docs/需求登记表.md docs/PRD_UI-32_AI访谈显示当前问题.md docs/tasks/IMPL_UI-32_AI访谈显示当前问题.md
git commit -m "feat(UI-32): AI 访谈作答态固定显示当前问题（题号+2行截断）"
# 不 push，等总管放行
```

> 若总管要求文档与代码分笔：代码 `feat(UI-32): …`，文档 `docs: v2.39 UI-32 实施落盘（作答态问题卡）`。

---

## 验收交付物

- [ ] `git diff` 单 hunk 摘录（证明 `ai_asking` / `paused` / 字幕卡 / 操作行 / BUG-09 三面 **0 hunk**）
- [ ] `([IO.File]::ReadAllLines(...)).Length` = **1409** ＋ `git diff --numstat -- src` = `15 0`
- [ ] AC-1…AC-10 逐条打勾 ＋ §3 截图 5 张
- [ ] `node tmp/verify-bug09-next-question-timeout.mjs` exit 0（贴输出尾行）
- [ ] 登记表 v2.39 回写（版本行 ＋ 变更记录行 ＋ §三 / §1.2 / §5.1 三处状态 token 一致）

## 风险与回滚

| # | 风险 | 处置 |
|---|---|---|
| ① | 误触 BUG-09 面（同文件相邻） | §2 ④⑤ ＋ AC-9 双守门；一有命中即 `git checkout -- src/components/interview/interview-console.tsx` 重做 |
| ② | 小屏溢出导致操作行不可达 | AC-10 实测；不达标**不私改**字幕卡高度，回报总管另立需求 |
| ③ | `line-clamp-2` 未生效（旧 Tailwind 插件缺失） | 本仓 Tailwind **v4**（核心内置）；若构建警告 ⇒ 回报，不得改用 `-webkit-line-clamp` 内联样式私改 |
| ④ | 需要整体回退 | 单文件单 hunk ⇒ `git checkout -- src/components/interview/interview-console.tsx` 即净；文档 v2.39 行保留（如实记录已回退） |
