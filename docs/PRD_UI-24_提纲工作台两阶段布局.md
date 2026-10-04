# UI-24 提纲工作台两阶段布局切换 · PRD

- 需求编号：UI-24 ｜ 来源：用户体验反馈（2026-10-04）｜ 优先级：P1 ｜ 状态：PRD 已出，待实施
- 界面落点：`/projects/new/outline` → `src/components/outline/outline-plan-workspace.tsx`（唯一生产改动文件）
- 关联：UI-12（提纲工作台字段收敛）、REQ-13（提纲生成与对话细化）、REQ-14（AI 访谈入口）、`docs/需求登记表.md:659`（UI-24 条目）
- 断点口径：**`xl`（≥1280px）= PC 形态；`< xl`（含 `lg` 1024–1279px）= 移动形态**
- 硬约束：不引入新依赖；不改数据层 / 存储层 / API 契约；尽量复用仓库既有 class；**overlay 不使用 `!important`**

## 0. 一句话概述

生成提纲前保持「左表单 + 右空态」的**填写态**；提纲生成完成后自动切到「窄细条 + 提纲预览 / 对话修改并列」的**提纲态** —— PC 用可滑出的 overlay 收纳已完成使命的表单，移动端用 Tab 切换「填写信息 / 提纲修改」。

## 1. 目标与非目标

**目标**

1. 生成提纲后把主视觉从「表单」让位给「提纲预览 + 对话修改」，对话框获得明显更宽的可用宽度。
2. 表单不丢失、随时可回：PC 一键滑出、移动端一个 Tab，均能继续修改主题 / 对象姓名 / 内容概述并重新生成。
3. 不改变任何业务闭环：生成 / 对话 / 确认带入上传 / 跳过 / 进入 AI 访谈五条链路的行为与载荷完全不变。

**非目标**

- 不做表单字段、契约、prompt、数据层 / 存储层的任何变更（沿用 UI-12 口径）。
- 不做跨设备 / 刷新后的阶段记忆（阶段是页面内瞬时状态，刷新回填写态）。
- 不新增组件文件、不引入依赖、不新增色值、不改公共 CSS 类。
- 不给 `lg`（1024–1279px）单独设计第三套形态 —— 该区间归入「移动形态」。

## 2. 阶段与断点定义

| 阶段 | 触发 | PC（xl ≥1280） | 移动（< xl） |
|---|---|---|---|
| 阶段 1 · 填写态 | 进入页面，或尚未产出提纲 | 现有布局：左表单（`lg:grid-cols-2` 的 1/2）+ 右空态 / loading | 现有单栏表单（不出现 Tab 栏） |
| 阶段 2 · 提纲态 | 提纲生成完成（成功或兜底模板） | 左 `w-12` 细条（仅图标）+ 右「预览 │ 对话」并列；表单收进 overlay | 「填写信息 / 提纲修改」Tab；默认停在「提纲修改」；预览在上、对话在下、输入框固定底部 |

> 断点说明：本轮**不把 PC 形态下放到 1024–1279px**。该区间沿用「移动形态（Tab）」，但阶段 1 仍保留现状的 `lg:grid-cols-2` 两栏表单 —— 即 `lg` 下「阶段 1 两栏、阶段 2 Tab」，属本轮接受的口径（见 §10 风险）。

## 3. 交互详述

### 3.1 PC 端（xl ≥1280px）

**阶段 1（填写态）**

- 布局与今天逐像素一致：`div.grid.lg:grid-cols-2`，左表单 section（`:381-462`）+ 右提纲 section（`:464-653`，空态文案「填写左侧信息后点击生成」）。
- 不渲染细条、不渲染抽屉、不渲染遮罩、不出现 Tab 栏。

**生成中**

- 保持阶段 1 不变（`phase` 不因 `isGenerating` 变化）。右栏空态沿用既有文案「正在生成提纲…」（`:520`）。
- 生成按钮加载态（`LoaderCircle + 生成中…`）与现有一致。

**生成完成 → 自动切阶段 2**

- 网格改为两列：`xl:grid-cols-[3rem_minmax(0,1fr)]`。
  - **细条（col 1）**：宽 `w-12`（= 3rem = 48px），高撑满；只有一个**展开图标按钮**（建议 `ChevronRight`，lucide 内），**无文字**；建议 `aria-label="展开填写信息"`、`aria-expanded={isFormDrawerOpen}`、`aria-controls="outline-profile-drawer"`。
  - **右区（col 2）**：`xl:grid-cols-2` 并排 —— 左「提纲预览 / 编辑」，右「多轮对话细化」。预览沿用 `MarkdownSheet` + 预览 / 编辑切换；对话沿用消息气泡与发送区。
- 提纲预览面板与对话面板各自在面板内滚（`soft-scroll` + `overflow-y-auto`），对话输入区贴面板底部（flex 列：消息区 `flex-1 min-h-0 overflow-y-auto`，输入区在滚动区之外）。

**细条展开 overlay（阶段 2 内）**

1. 点细条图标 → 表单以 overlay 形式**从左侧滑出**，覆盖在提纲区之上；**不推动右侧布局**（`position:absolute`，不改栅格列宽）。
2. 覆盖范围：锚定内容网格左上角，`inset-y-0 left-0`，宽 `w-[min(32rem,88%)]`；抽屉内即完整表单卡（`paper-panel paper-panel-strong archive-frame`），内部 `soft-scroll overflow-y-auto`，表单过高时抽屉内滚动。
3. 遮罩：`absolute inset-0`，沿用仓库既有遮罩色 `bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px]`。
4. 收回：**点遮罩** 或 **再次点细条图标**；两种方式等价。
5. 三条动作按钮（跳过 / 进入 AI 访谈 / 确认提纲）随表单位于抽屉底部；抽屉打开时可用，链路不变。
6. `xl:overflow-hidden` 的主容器已锁页面滚动，抽屉开合不产生页面滚动位移。

### 3.2 移动端（< xl）

**阶段 1（填写态）**

- 与现状一致：单栏表单；**不显示 Tab 栏**（此时无「提纲修改」内容可切，避免出现空 / 禁用 Tab）。

**生成完成 → 自动切阶段 2**

- 出现 Tab 栏：「填写信息」/「提纲修改」，`role="tablist"`，按钮 `role="tab"` + `aria-selected`，样式复用 `project-detail-tabs.tsx:16-19` 的 `TAB_ACTIVE / TAB_IDLE` 类串（常量未导出，本地复制即可）。
- **自动停在「提纲修改」Tab**（`mobileTab = "outline"`）。
- 「提纲修改」Tab 内容：
  - 上：提纲预览（沿用 `MarkdownSheet` 容器 + 预览 / 编辑切换）。
  - 下：多轮对话（沿用消息气泡布局）。
  - **输入框固定在页面底部、不随内容滚动**：`fixed inset-x-0 bottom-0 z-40`，外裹 `paper-panel paper-panel-strong`（或 `surface-card`）+ 顶部渐变过渡（对齐处理台 `sticky bottom-0` 的既有做法）；对话内容区补底部留白（约 `pb-36`），避免末条消息被固定条遮挡。
  - 移动端对话列表**不做** `max-h-48` 内滚，改为随页面自然增长（输入框固定，内容滚动）。
- 点「填写信息」Tab → 回到表单（`mobileTab = "form"`），字段可随时改；改完再点「提纲修改」返回，`markdown` / `messages` 均保留（受控值已提升到组件 state，不丢数据）。

## 4. 状态管理（建议方案）

新增 3 个 `useState`，既有 state 语义全部不变：

| 新 state | 类型 | 初值 | 作用 | 生效断点 |
|---|---|---|---|---|
| `phase` | `"form" \| "outline"` | `"form"` | 两阶段控制的**唯一真源** | 全断点 |
| `isFormDrawerOpen` | `boolean` | `false` | PC overlay 抽屉开合 | xl |
| `mobileTab` | `"form" \| "outline"` | `"form"` | 移动端当前 Tab | < xl |

**转移规则**

| 事件 | 动作 |
|---|---|
| 初始挂载 | `phase="form"`（任何断点） |
| `handleGenerate` 成功（`setMarkdown` 之后） | `setPhase("outline"); setMobileTab("outline"); setIsFormDrawerOpen(false)` |
| `handleGenerate` 兜底分支（catch，写 `buildFallbackMarkdown`） | 同上（已产出提纲即进入阶段 2） |
| 生成中（`isGenerating` true→false 期间） | **不改 `phase`** → 首次生成保持阶段 1；已在阶段 2 时重新生成不闪回 |
| 点细条图标 | `setIsFormDrawerOpen(v => !v)` |
| 点遮罩 | `setIsFormDrawerOpen(false)` |
| 点移动 Tab | `setMobileTab(tab)` |

**为什么用显式 `phase` 而不是派生 `Boolean(markdown.trim())`**

1. 「编辑」模式下用户把 markdown 清空时，派生方案会把整页弹回阶段 1（误伤）；显式 `phase` 一旦进入阶段 2 不再回退。
2. 移动端「生成完成 → 自动跳 Tab」是**一次性事件**，派生值无法表达「只在完成那一刻跳」的语义。
3. 与「生成中保持阶段 1」的规则需要「生成期间不动阶段」，显式状态更易表达与断言。

伪代码（写入 `handleGenerate`）：

```tsx
// 成功后（含 catch 兜底写完 markdown 之后），统一收口：
setPhase("outline");
setMobileTab("outline");
setIsFormDrawerOpen(false);
```

> `hasOutline = Boolean(markdown.trim())` 仍保留，仅用于决定「预览 / 对话块是否渲染」，**不再驱动阶段**。

## 5. 动画 / 过渡

| 对象 | 类（Tailwind 原子类） | 时长 / 缓动 | 说明 |
|---|---|---|---|
| 抽屉位移 | `transition-transform duration-300 ease-out` + 开 `translate-x-0` / 关 `-translate-x-full` | 300ms / ease-out | 用 transform，GPU 友好；抽屉**常驻挂载**，靠类切换，保证双向都有动画 |
| 遮罩淡入淡出 | `transition-opacity duration-200 ease-out` + 开 `opacity-100` / 关 `opacity-0 pointer-events-none` | 200ms / ease-out | 关闭态禁用点击穿透 |
| 阶段切换本身（列宽 50%→3rem + 右栏拆并列） | **不加过渡** | 瞬时 | `grid-template-columns` 动画兼容差、易 jank，直接瞬时切换；切换发生在生成完成瞬间，用户注意力在内容上 |

- 建议（非必须）：抽屉 / 遮罩加 `motion-reduce:transition-none` 尊重系统「减弱动效」。
- 不新增 keyframes，`globals.css` 预计零改动；如需过渡辅助类，只**追加**不改既有类。

## 6. 实现要点（DOM 骨架与坑）

**目标骨架（阶段 2 · PC）**

```tsx
<main className="… xl:overflow-hidden">
  <div className="… xl:grid xl:grid-rows-[auto_minmax(0,1fr)]">
    <header>…（不动）</header>
    <div className="relative grid min-w-0 gap-2 xl:min-h-0
                    xl:grid-cols-[3rem_minmax(0,1fr)]">   {/* 加 relative 作 overlay 定位上下文 */}
      {/* col 1：细条（阶段 2 才渲染） */}
      <aside className="hidden xl:flex w-12 … items-start justify-center pt-4">
        <Button variant="ghost" aria-label="展开填写信息" aria-expanded={isFormDrawerOpen}
                aria-controls="outline-profile-drawer" onClick={toggleDrawer}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </aside>

      {/* col 2：预览 │ 对话 并列 */}
      <div className="grid min-w-0 gap-2 xl:grid-cols-2 xl:min-h-0">…</div>

      {/* overlay：定位层 + 遮罩 + 面板（内层才挂 paper-panel） */}
      <div className="hidden xl:block">
        <div className="absolute inset-0 z-[55] bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px] …"
             onClick={closeDrawer} />
        <div id="outline-profile-drawer"
             className="absolute inset-y-0 left-0 z-[60] w-[min(32rem,88%)]
                        transition-transform duration-300 ease-out
                        {open ? 'translate-x-0' : '-translate-x-full'}">
          <div className="paper-panel paper-panel-strong archive-frame h-full rounded-[1.85rem]
                          soft-scroll overflow-y-auto p-4 md:p-5">
            {profileFormBody}   {/* 复用与阶段 1 相同的表单 JSX */}
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
```

**必须注意**

1. **`.paper-panel` 自带 `position: relative`** —— 绝对定位的定位层**不能**挂 `paper-panel`，否则 `absolute` 失效、overlay 会留在文档流里推动布局。定位层用 Tailwind 位置类，`paper-panel` 只挂内层面板。
2. z-index 取 `z-[55] / z-[60]`，**低于仓库模态的 `z-[70]`**（`interview-console.tsx:1191` 等），保证全屏模态仍能盖住抽屉。
3. overlay 的祖先链不得出现 `overflow-hidden`（现网格容器没有）；`main` 的 `xl:overflow-hidden` 会裁掉超出主区部分，属可接受。
4. 表单 JSX 只写一份，抽成局部变量 `profileFormBody`，在「阶段 1 的左栏」与「阶段 2 的抽屉」两处互斥渲染；`subject` / `topic` / `overview` 等均为受控值，卸载不丢数据。
5. 遮罩与抽屉只 `hidden xl:block`，移动端不参与布局，避免与 Tab 形态打架。
6. 展开图标用 lucide 现成图标（建议 `ChevronRight`），无需新增依赖。

## 7. 涉及文件清单

**改（唯一生产文件）**：`src/components/outline/outline-plan-workspace.tsx`

- 新增 3 个 state 与 `handleGenerate` 收口；新增细条 / 抽屉 / 遮罩 / Tab 结构；阶段 2 右栏改并列、移动端输入区固定底部；表单 JSX 抽为局部变量复用。

**预计不改（如确需新过渡类则只追加，不改既有）**：`src/app/globals.css`

**明确不改**：`src/app/projects/new/outline/page.tsx`、`src/lib/outline-session.ts`、`src/lib/types/outline.ts`、`src/lib/types/project.ts`、`src/lib/server/*`、三个 API route（`outline/generate` / `outline/chat` / `projects/ai-interview`）

**需同步更新的既有断言（非生产代码）**：

- `tmp/cdp-req13-outline.mjs`：生成后依赖 `#outline-subject/topic`、`__t.btn('生成访谈提纲')`、`__t.outlineDetails()`；阶段 2 后按钮进入抽屉 / 移动 Tab，脚本需先展开抽屉或切 Tab。
- `tmp/cdp-req13-crosscut.mjs:160-161`：同上。
- `tmp/cdp-req13-prefill.mjs`：依赖已随 UI-12 失效的 `#outline-*` 旧 id，本轮不顺带修，仅登记。

**文档**：新建本 PRD；同步把 `docs/需求登记表.md` UI-24 状态改为「PRD 已出，待实施」。

## 8. 不改什么（边界）

- 不改五条链路的行为与请求载荷：`handleGenerate` / `handleChat` / `handleConfirm` / `handleSkip` / `handleEnterAiInterview` 全部原样。
- 不改数据来源：`subject` / `topic` / `overview` / `markdown` / `messages` / `chatInput` / `isGenerating` / `isChatting` / `isPreviewMode` / `notice` / `lastGeneratedRef` 语义不变；仅新增 `phase` / `isFormDrawerOpen` / `mobileTab`。
- 不改空态与 loading 文案（「填写左侧信息后点击生成」/「正在生成提纲…」）。
- 不改页头（返回链接逐字节一致）、不改消息气泡 / Markdown 渲染、不改预览与编辑切换逻辑。
- 不改数据层 / 存储层 / API route / 类型定义；不引入新依赖、不新增色值。
- 不覆盖 `globals.css` 既有类（`paper-panel` / `surface-card` / `soft-scroll` / `tape-label` / `chat-bubble*` 等）。
- overlay 不使用 `!important`。
- 不改 `lg` 阶段 1 的现有两栏表单布局。

## 9. 验收要点

1. 进入页面为阶段 1：左表单 + 右空态；**不出现**细条、抽屉、遮罩、Tab。
2. 点「生成访谈提纲」：生成中仍是阶段 1 + 右栏 loading；完成后自动进入阶段 2。
3. xl 阶段 2：左细条 `w-12`、仅一个图标无文字；右侧「预览 │ 对话」并列，对话框可用宽度明显大于改动前 50%。
4. 点细条图标：抽屉从左滑出、覆盖在提纲上方、**右侧布局不位移**；点遮罩或再点图标收回；位移动画约 300ms。
5. 抽屉内「确认提纲，进入上传」「跳过，直接上传」「进入 AI 访谈」可用；五条链路回归正常（生成 / 对话 / 确认带入上传 / 跳过 / 进入 AI 访谈）。
6. 重新生成：覆盖确认弹窗逻辑不变；已在阶段 2 时不闪回填写态；生成中阶段不变。
7. <xl 阶段 1 与现状一致；生成后自动出现 Tab 并停在「提纲修改」；预览在上、对话在下、输入框固定页面底部不随内容滚动；点「填写信息」可改字段并返回。
8. 375px 与 1280px / 1279px 边界均无横向溢出；overlay 不被裁切，遮罩可点击。
9. 产物核对：`git diff` 仅 1 个生产文件；无新依赖（`package.json` 未变）；无 `!important`；数据层 / API 未改。
10. 更新后的 `tmp/cdp-req13-*.mjs` 关键断言可通过（或明确登记为「需随 UI-24 更新」）。

## 10. 风险

1. **`lg`（1024–1279px）观感不一致**：阶段 1 是两栏表单、阶段 2 变 Tab，同一屏宽两种形态。须在 1279 / 1280 边界实测确认可接受。
2. **主行动作入口变深**：确认 / 跳过 / AI 访谈三条按钮随表单收进抽屉（PC）或「填写信息」Tab（移动），用户需先展开一步。可能影响进入上传 / AI 访谈转化，需产品侧确认此代价可接受（本轮设计已接受）。
3. **受控输入失焦**：阶段互斥渲染会让表单输入框 unmount↔mount，值保留但焦点 / 光标 / 输入法组合态会丢；「生成中不动阶段」可降低触发概率，仍属可接受损耗。
4. **`.paper-panel` 定位冲突**：若把 `paper-panel` 挂到绝对定位层，overlay 会退回相对定位并推动布局 —— 实现时必须按 §6-1 分层。
5. **移动端 `fixed` 输入框与软键盘**：iOS Safari 的 fixed + 键盘行为需实测；建议加 `pb-[env(safe-area-inset-bottom)]` 与内容区底部留白兜底。
6. **e2e 断言变红**：`tmp/cdp-req13-outline.mjs` / `cdp-req13-crosscut.mjs` 假设生成后按钮与 `__t.outlineDetails()` 直接可达；UI-24 后需先展开抽屉 / 切 Tab，脚本须同步更新。
7. **单文件复杂度**：组件已 658 行，再叠加「阶段 1 / PC 阶段 2 / 移动阶段 2」三形态易失控；建议把表单体、预览块、对话块抽为组件内部局部渲染变量或本文件内的小函数组件，控制嵌套深度。
8. **无障碍**：细条图标 / Tab / 抽屉需完整 `aria-*`；抽屉关闭态的内部可聚焦元素应不可达（建议 `pointer-events-none` + `aria-hidden`，必要时 `inert`），否则键盘 Tab 会串到隐藏表单。
9. **遮罩与全屏模态层级**：若 z-index 取高，会盖住既有 `z-[70]` 模态；须维持抽屉在 `z-[70]` 以下。
