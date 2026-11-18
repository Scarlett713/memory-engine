# UI-33 实施任务单｜文件格式校验提前到知情同意确认之前（3 hunk · 单文件 · 零服务端）

**执行人：** DS
**上游：** `docs/PRD_UI-33_文件格式校验提前到知情同意确认之前.md`（PRD 定稿，7 项裁决 D1~D7 ＋ 3 条派生约束 C1~C3）；`docs/需求登记表.md:1242`（§三 UI-33）
**前置条件：** PRD 已出 ＋ **总管放行实施**（未放行不得开工）；`git status --short` 干净（本批须为下一手**唯一批**，同文件在途批见 §0.3）
**禁改面（逐项 0 hunk）：** `src/lib/server/upload-store.ts` ｜ `ConsentDialog`（`interview-upload-form.tsx:225-410`）｜ `CONSENT_*` 常量（`:99-105`）＋ `CONSENT_DOC_BLOCKS`（`:115+`）｜ `src/app/api/projects/[projectId]/interview/audio/route.ts` ｜ `validateStepOne`（`:564-582`）｜ `submitProject`（`:621-669`）｜ `?autostart=1`（`:661`）
**规模：** `src` **1 个文件 3 个 hunk，≈ `+66 −1`**（PRD §8）；`docs` 回写 1 件（§S5）
**行号基线：** 2026-11-18 实测 `interview-upload-form.tsx` = **1222 行**（`[IO.File]::ReadAllLines` 口径）；实施后应为 **≈1287 行**
**探针基线：** 本轮**未运行任何探针**（用户约束）；出稿前已知：`verify-phase3.mjs` 的 I1 上传臂注入 `.wav` ＋ `audio/wav`、I2 / I3 臂**不选文件**直接开弹窗
**状态：** **PRD 已出，待实施**（总管放行后执行）

---

## §0 口径与纪律

### 0.1 行号复核（**禁用 `Get-Content` 定位**）

PowerShell 5.1 的 `Get-Content` 把无 BOM 的 UTF-8 当 GBK 解码，中文标点后的换行会被吞 —— 同一文件 `Get-Content` 报 1138 行、`ReadAllLines` 报 **1222** 行。**一律用**：

```powershell
$a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
for ($i = 0; $i -lt $a.Length; $i++) {
  if ($a[$i] -match 'acceptedAudioExtensions|handleFileChange|handleFormSubmit|setConsentOpen\(true\)|maxAudioBytes') {
    'L' + ($i + 1) + ': ' + $a[$i]
  }
}
```

**行号漂移时以「逐字锚点」定位、不认行号**（锚点见 §1.1）。本单所有行号均为 2026-11-18 水位。

### 0.2 改动纪律

- **只动 PRD §2 的三处**：`:48`（`accept` 串）／`handleFileChange`（第一道）／`handleFormSubmit` 的 `step === 3` 分支开头（第二道）；其余行**不删、不改、不重排**。
- 文件行尾 **LF**、**无 BOM** ⇒ 编辑时**不得**把 LF 归一为 CRLF，否则整份 1222 行 diff、复核失效。
- **不新增** state / effect / action / props / 接口调用 / 依赖 / CSS 类 / 组件文件；**不新增** DOM 节点（错误仍走 `:1144-1148`）。
- **不引入 Node `path`**（`"use client"` 组件），扩展名用 `lastIndexOf(".")`。
- 判定顺序固定：**大小（100MB，`:543-550`）→ 格式**（PRD §0.3 C3）。
- **不得**在 `handleFormSubmit` 加「无文件」拦截（PRD §0.3 C1；`verify-phase3.mjs` I2 / I3 会红）。
- 文案**逐字**：`仅支持常见音频文件格式上传。`（同 `upload-store.ts:59`）。

### 0.3 禁改面与在途批

| 面 | 口径 |
|---|---|
| `src/lib/server/upload-store.ts` | **0 hunk**：`allowedExtensions:14-22` 不导出、不移动；`:55-60` 的 MIME 分支与 `:59` 文案一字不动；`:65` 的 `.audio` 兜底不动（存量 6 条 webm 归档依赖它） |
| `ConsentDialog` / `CONSENT_*` | **0 hunk**：UI-06 已验收面；本批只动「**何时**打开弹窗」 |
| `interview/audio/route.ts` | **0 hunk**：webm 归档链 |
| 同文件在途批 | UI-06（已验收）/ REQ-32 / UI-05 / UI-14 / UI-30 ⇒ 开工前确认无并行改动，否则**停手回报** |

---

## §S0 先写探针（先红后绿）

> 目的：本批的行为改动大量落在「拒绝路径」，既有探针**只覆盖合法文件路径**（PRD §9）。故 **S0 必须先落探针**，在改动前跑一次（预期**红**），改完再跑（预期**绿**）。

### S0-A 新增静态探针 `tmp/verify-ui33-format-guard.mjs`（无需 dev server，出口门禁）

`tmp/**` 为 `.gitignore:54` 忽略目录 ⇒ **不入版本库**，与既有探针同口径。断言清单（按源码逐行 / 逐字）：

| # | 断言 | 取值口径 |
|---|---|---|
| G1 | `acceptedAudioExtensions` 字面 **=== `".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4"`** | 整行匹配，且全文件 `audio/*` **0 命中** |
| G2 | 文案 `仅支持常见音频文件格式上传。` 全文件 **1 次** | 且该行同时含 `const audioFormatError` |
| G3 | `allowedAudioExtensions` 含 **7 项**（`.mp3 .wav .m4a .aac .flac .ogg .mp4`），**不含** `.webm` | 7 项逐字 |
| G4 | MIME 白名单**不是通配实现** | 全文件 `startsWith("audio/")` **0 命中**；`allowedAudioMimeTypes` 至少含 `audio/x-m4a`（存量实测值） |
| G5 | `handleFormSubmit` 内 **`hasSupportedAudioFormat(audioFile)` 出现在 `setConsentOpen(true)` 之前** | `indexOf` 先后比对（**顺序断言**，AC-3 的静态半） |
| G6 | 第二道带「无文件不拦」守卫 | 逐字含 `if (audioFile && !hasSupportedAudioFormat(audioFile))`（PRD §0.3 C1） |
| G7 | 第一道在 100MB 分支**之后** | `maxAudioBytes` 的 `indexOf` < 格式分支 `indexOf`（C3） |
| G8 | 两条拒绝分支都清 `input.value` | `event.target.value = ""` 全文件 **2 次**（100MB ＋ 格式） |
| G9 | 服务端 0 改动 | `git diff --numstat -- src/lib/server/upload-store.ts` **空**；且该文件仍含 `const isAudioMime = file.type.startsWith("audio/")` |
| G10 | 弹窗面 0 改动 | `git diff -U0` 的 hunk 数 **=== 3**，且三个 hunk 的行号区间均落在「`:48` / `handleFileChange` / `handleFormSubmit`」内 |

骨架（照仓内 `tmp/verify-ui06-extref.mjs` 的取行风格）：

```js
// tmp/verify-ui33-format-guard.mjs —— UI-33 静态守门（无需 dev server）
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const FILE = "src/components/upload/interview-upload-form.tsx";
const text = readFileSync(FILE, "utf8");
const lines = text.split(/\r?\n/);
let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  <- " + detail}`);
  if (!ok) fails += 1;
};
// G1 … G8：按上表逐条断言（整行 / 计数 / indexOf 先后）
// G9：execSync("git diff --numstat -- src/lib/server/upload-store.ts").toString().trim() === ""
// G10：execSync(`git diff -U0 -- ${FILE}`) 的 "@@" 计数 === 3
process.exit(fails === 0 ? 0 : 1);
```

### S0-B（可选，需 dev server ＋ Chrome）行为臂

若总管要求「拒绝路径」也进自动化：在 `tmp/verify-phase3.mjs` **之外**新增一次性脚本 `tmp/cdp-ui33-format-guard.mjs`，复用其 `enterUploadStep3()`（`:659-674`）与 `setFile` 助手（`:775-783`），增设两臂：

| 臂 | 操作 | 期望 |
|---|---|---|
| R1 | `setFile('input[type="file"]', 'probe-bad.txt')` 但 `type: 'text/plain'` | `.text-danger` 文本 === `仅支持常见音频文件格式上传。`；`[data-upload-modal="consent"]` **不存在** |
| R2 | 不选文件 → `clickText('开始处理')` | 弹窗**出现**（守 C1；与 `verify-phase3` I2 / I3 同断言） |

> **R2 不得省略**：它是「无文件不拦」的唯一自动化守门。

```powershell
node tmp/verify-ui33-format-guard.mjs   # S0 落地后：改动前预期 exit 1（G1/G3/G5/G6 红）
```

---

## §1 改动步骤（①②③ 顺序执行，逐字块可直接落码）

### 1.1 定位（逐字锚点，改前 1222 行水位）

| 处 | 逐字锚点 | 水位 |
|---|---|---|
| ① `accept` | `const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,audio/*";` | `:48` |
| ② 第一道 | `if (nextFile && nextFile.size > maxAudioBytes) {` …（到该分支 `return;` ＋ `}` 结束）… 紧接着 `setAudioFile(nextFile);` | `:543-552` |
| ③ 第二道 | `// 每次创建都重新确认：先重置勾选态并弹窗，确认后才真正创建。` → `setConsentChecked(false);` | `:679-680` |

### 1.2 ① 更新 `accept` 属性（D6）

```diff
-const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,audio/*";
+const acceptedAudioExtensions = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4";
```

### 1.3 ② `handleFileChange` 加格式判定（D4 第一道）＋ 常量块

**（a）常量块**：紧随改后的 `:48` 插入（即 `// 与 src/lib/server/upload-store.ts 的 100MB 业务上限同口径…` 注释**之前**），逐字见 **PRD §3.2**（`allowedAudioExtensions` / `allowedAudioMimeTypes` / `audioFormatError` / `getFileExtension` / `hasSupportedAudioFormat`，共 +43 行）。

**（b）判定分支**：插在 100MB 分支的 `}` 之后、`setAudioFile(nextFile);` 之前：

```tsx
    // UI-33：格式在「选文件」这一步就判 —— 与上面 100MB 同理，不必等用户勾完知情同意、
    // 白跑一次 multipart 才被服务端 400 打回。判定口径见 hasSupportedAudioFormat。
    if (nextFile && !hasSupportedAudioFormat(nextFile)) {
      setAudioFile(null);
      setError(audioFormatError);
      // 同 100MB 分支：不清 input.value 的话，重选同一个非法文件不会触发 change。
      event.target.value = "";
      return;
    }
```

### 1.4 ③ `handleFormSubmit` 加二次判定（D4 第二道）

插在 `step === 3` 分支**最前面**（`:679` 的注释行**之前**），**必须**早于 `setConsentChecked(false)`：

```tsx
    // UI-33：第二道 —— accept 只过滤选择框，拖拽 / 程序化构造的 File 能绕过去；
    // 这里在打开知情同意弹窗之前再判一次，避免用户勾完「同意并继续」才被服务端 400 打回。
    // 无文件时不拦：空文件提示仍由 submitProject（:622-625）给，且 verify-phase3 的
    // I2 / I3 两臂就是「不选文件直接开弹窗」，拦掉会把既有验收面打红（PRD §0.3 C1）。
    if (audioFile && !hasSupportedAudioFormat(audioFile)) {
      setAudioFile(null);
      setError(audioFormatError);
      return;
    }
```

改后 `step === 3` 分支顺序：**格式兜底 → `setConsentChecked(false)` → `setConsentDocOpen(false)` → `setConsentOpen(true)`**。

---

## §2 离线自检（不启 dev server）

```powershell
# ① 行数（1222 -> ~1287）
([IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')).Length

# ② diff 规模（期望 1 个 src 文件、~66 / 1、3 hunk）
git diff --numstat -- src
git diff -U0 -- src/components/upload/interview-upload-form.tsx

# ③ 禁改面（期望全部为空）
git diff --numstat -- src/lib src/app storage

# ④ 字面量计数
$a = [IO.File]::ReadAllLines('src/components/upload/interview-upload-form.tsx')
($a -match 'audio/\*').Count                       # 期望 0
($a -match '仅支持常见音频文件格式上传。').Count      # 期望 1
($a -match 'event\.target\.value = ""').Count      # 期望 2
($a -match 'startsWith\("audio/"\)').Count         # 期望 0
```

| 项 | 期望 | 不达标处置 |
|---|---|---|
| `src` 改动文件数 | **1** | 出现第 2 个 ⇒ **回退重做** |
| hunk 数 | **3** | 多 hunk ⇒ 误改了既有行，须还原 |
| `audio/*` | **0**（`accept` 已收窄、MIME 非通配） | 命中 ⇒ 违反 D6 / C2 |
| `仅支持常见音频文件格式上传。` | **1** | ≥2 ⇒ 文案被内联进判定分支（须改回常量） |
| `event.target.value = ""` | **2** | 1 ⇒ 格式分支漏清 `input.value` |
| `src/lib` / `src/app` / `storage` diff | **0 行** | 任何命中 ⇒ 立即回退 |

---

## §3 探针回归清单（实施轮必须跑）

| # | 探针 | 期望 | 说明 |
|---|---|---|---|
| P1 | `node tmp/verify-ui33-format-guard.mjs`（S0 新增） | **exit 0** | UI-33 专属守门（G1~G10） |
| P2 | `node tmp/verify-phase3.mjs` | **I1 上传臂绿**（`.wav` ＋ `audio/wav`）；**I2 / I3 臂绿**（不选文件开弹窗） | 需 `npm run dev` ＋ Chrome；I2 / I3 是本批**最易打红**的两臂 ⇒ 必跑 |
| P3 | `node tmp/cdp-ui06-consent-copy.mjs` | 绿（弹窗文案 0 改动） | 需 dev server；环境不可用时以 P2 ＋ `git diff` 静止面替代并记录理由 |
| P4 | `node tmp/cdp-req14-consent.mjs` | 绿（选 `.wav` → 开弹窗 → 同意 → 提交） | 同上 |
| P5 | `node tmp/verify-bug12-sanitize.ts`（如需） | 服务端 400 面不受影响 | 直接打 API，不经表单 |
| — | `tmp/verify-bug11-12-docs.mjs` / `tmp/verify-bug09-taskorder.mjs` | **不计门禁** | 预存红单（钉旧文档 / 旧源码水位），本批不回改 |

> 若环境无法跑 P2~P4：**必须在交付说明里明写「未跑」及原因**，并附 `git diff -U0` 摘录作为替代证据 —— 不得默认「应该没事」。

---

## §4 AC 全表（逐条打勾 ＋ 截图）

| AC | 操作 | 期望 | 视口 |
|---|---|---|---|
| AC-1 | 选 `.wav`（`audio/wav`） | 「已选择：…」出现、无错误条、点「开始处理」开弹窗 | 390×844 |
| AC-2 | 选 `.txt`（`text/plain`） | 选中当下即出 `仅支持常见音频文件格式上传。`；无「已选择」态；重选同一 `.txt` 仍触发 | 390×844 |
| AC-3 | `DataTransfer` 注入 `.txt` 后派发 `change` | 弹窗**不打开**、错误条出现；＋ G5 静态顺序断言 | 1280×800 |
| AC-4 | 不选文件 → step 3 →「开始处理」→ 勾选 →「同意并继续」 | 弹窗**正常打开**；随后错误区 `请先选择一段受访音频。`；无 POST | 390×844 |
| AC-5 | 代码审读 ＋ `git diff --numstat -- src/lib src/app` | 空；`upload-store.ts` MIME 分支原样；`interview/audio/route.ts:89` 未改 | — |
| AC-6 | 打开 1 个存量 `.audio` 项目（详情 / 素材 / 导出） | 与改前一致；`storage/**` 0 写入 | 1280×800 |
| AC-7 | 控制台读 `input[type=file].accept` | `=== ".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4"` | — |
| AC-8 | 错误条文本逐字比对 | `=== "仅支持常见音频文件格式上传。"` | — |
| AC-9 | P1 / P2 | 全绿 | — |
| AC-10 | `git status --porcelain -- src` | 只有 `interview-upload-form.tsx`；`numstat` ≈ `66 1` | — |
| AC-11 | 同时超限 ＋ 非法格式 | 出 `演示版本建议上传 100MB 以内的音频文件。`（大小优先） | — |

**截图清单（交付物）**：① `.txt` 被即时拦（错误条 ＋ 空上传区）；② `.wav` 放行（「已选择」态）；③ 不选文件开弹窗（AC-4 第一段）；④ 同意后「请先选择一段受访音频。」（AC-4 第二段）；⑤ 存量 `.audio` 项目详情页。

---

## §S5 文档回写（`docs/需求登记表.md` → **v2.41**）

> 本轮（PRD ＋ 任务单出稿）已把登记表升到 **v2.40**，UI-33 状态改为 `PRD 已出，待实施`。实施轮**再升一版**：

1. **版本行 `:3`**：`v2.40` → `v2.41`；**更新日期 `:4`** → 实施当天。
2. **变更记录**：在 `- v2.40` 行之后追加 **1 行**，要点：① 落点（单文件 **3 hunk**：`:48` ＋ `handleFileChange` ＋ `handleFormSubmit`）；② 判定口径（**7 扩展名 ＋ 10 MIME，或语义**；`audio/webm` 客户端拒 / 服务端收，webm 不经本表单；存量 6 条 `.audio` 不重校验）；③ 探针（`verify-ui33-format-guard` exit 0 ＋ `verify-phase3` I1 / I2 / I3 绿）；④ 行号效应（`src` 1222 → 实测；登记表按实测）；⑤ 未 commit / 待放行。
3. **§三 UI-33 状态行**：`**PRD 已出，待实施**` → `**已实施（YYYY-MM-DD），待验收**`。
4. **§1.2 ＋ §5.1** 状态列同步同一 token（三处不得矛盾）。
5. **行号效应**按实测填写（本轮 PRD 批已使登记表从 1386 行增长）。

---

## §S6 git

```powershell
git add src/components/upload/interview-upload-form.tsx docs/需求登记表.md docs/PRD_UI-33_文件格式校验提前到知情同意确认之前.md docs/tasks/IMPL_UI-33_文件格式校验提前到知情同意确认之前.md
git commit -m "feat(ui-33): 音频格式校验提前到知情同意确认之前（扩展名+MIME 双点，单文件3hunk）"
# 不 push，等总管放行
```

> `tmp/**` 探针不入库（`.gitignore:54`）。若总管要求文档与代码分笔：代码 `feat(ui-33): …`，文档 `docs: v2.41 UI-33 实施落盘（格式校验前置）`。

---

## 验收交付物

- [ ] `git diff -U0 -- src/components/upload/interview-upload-form.tsx` 摘录：**3 hunk**，分别落在 `:48` / `handleFileChange` / `handleFormSubmit`
- [ ] `([IO.File]::ReadAllLines(...)).Length` 实测值 ＋ `git diff --numstat -- src` 实测值（预期 ≈ `66 1`）
- [ ] `git diff --numstat -- src/lib src/app storage` **全空**（AC-5 / AC-6）
- [ ] `node tmp/verify-ui33-format-guard.mjs` **exit 0**（贴输出尾行）
- [ ] `node tmp/verify-phase3.mjs` 的 **I1 / I2 / I3** 输出片段（或「未跑 ＋ 原因」）
- [ ] AC-1…AC-11 逐条打勾 ＋ §4 截图 5 张
- [ ] 登记表 v2.41 回写（版本行 ＋ 变更记录行 ＋ §三 / §1.2 / §5.1 三处状态 token 一致）

## 风险与回滚

| # | 风险 | 处置 |
|---|---|---|
| ① | 在 `handleFormSubmit` 误加「无文件」拦截 ⇒ `verify-phase3` I2 / I3 红 | PRD §0.3 C1 ＋ G6 / R2 双守门；一红即改回 `if (audioFile && …)` |
| ② | MIME 写成 `audio/*` 通配（或 `startsWith("audio/")`）⇒ webm 回到客户端白名单 | G4 ＋ §2-④ 守门；`startsWith("audio/")` 必须 **0 命中** |
| ③ | 误动 `upload-store.ts`（比如「顺手导出一份白名单共享」） | G9 ＋ AC-5；任何 `src/lib` diff 立即回退 |
| ④ | 误把 LF 改 CRLF | `git diff --numstat -- src` 若出现 ~1222 / ~1222 ⇒ `git checkout --` 重做，编辑时保持原行尾 |
| ⑤ | 整体回退 | 单文件 3 hunk ⇒ `git checkout -- src/components/upload/interview-upload-form.tsx` 即净；登记表 v2.40 / v2.41 保留并如实记录已回退 |


