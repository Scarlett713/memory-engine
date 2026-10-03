"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Maximize2,
  PenLine,
  RotateCcw,
  ScanText,
  ShieldAlert,
  Sparkles,
  Tags,
  X,
} from "lucide-react";

import { ElementEmptyState, SurfaceSection } from "@/components/projects/element-shell";
import { TimelinePanel } from "@/components/projects/timeline-panel";
import { Button } from "@/components/ui/button";
import {
  getEmotionLevelLabel,
  isExcerptMatchedByRules,
} from "@/lib/oral-history";
import {
  countPendingSensitiveMarks,
  type CollectionPath,
  type EmotionSignal,
  type ProjectRecord,
  type RedactionRule,
  type SensitiveMark,
  type SensitiveMarkStatus,
} from "@/lib/types/project";

type ProjectProcessingConsoleProps = {
  project: ProjectRecord;
  autoStart?: boolean;
};

type MarkReviewUpdate = {
  id: string;
  status: SensitiveMarkStatus;
};

// 脱敏复核面板与父组件之间的唯一接口：面板只负责展示与收集操作，
// 请求、loading、锁定态一律由父组件持有，避免内联/放大两个实例各持一份而分叉。
type RedactionReviewController = {
  busy: boolean;
  // 仅承载「并发拒绝」这类面板级错误；单卡失败由卡片自己就地显示
  error: string | null;
  locked: boolean;
  onReview: (
    updates: MarkReviewUpdate[],
  ) => Promise<{ ok: boolean; message?: string }>;
};

type TextPanelProps = {
  title: string;
  icon: typeof FileText;
  content: string;
  tag: string;
  dense?: boolean;
  // 只有「脱敏整理稿」开这个开关：它可能长到把首屏占满。口述摘要复用同一个组件但不开，
  // 保持不限高。默认 false 即老行为。
  clampBody?: boolean;
};

// 超过该字数才折叠（严格大于：280 字不出按钮，281 字出按钮）。
// 同 STRUCTURED_COLLAPSE_CHAR_THRESHOLD 的约定：按字数判断，不依赖 DOM 测量。
const DRAFT_CLAMP_CHAR_THRESHOLD = 280;

// 折叠态用固定高度裁切，不用 line-clamp：见下方 StructuredSectionCard 的注释，
// -webkit-box 与 whitespace-pre-wrap 组合时换行符处理不稳定。这里保留原文排版优先。
const DRAFT_CLAMP_CLASS = "max-h-[17.5rem] overflow-hidden";

function TextPanel({
  title,
  icon: Icon,
  content,
  tag,
  dense = false,
  clampBody = false,
}: TextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // 必须用 useId 而非硬编码 id：内联实例（hidden xl:block，仍在 DOM 里）
  // 与弹层实例可能同时存在，硬编码会让 aria-controls 指向重复 id。
  const contentId = useId();
  // 收起时要滚回卡片。ref 只能挂在自己的 div 上——SurfaceSection 不接受 ref，
  // 而本轮的改动范围限定在这一个文件里。
  const containerRef = useRef<HTMLDivElement>(null);

  const clamped = clampBody && content.length > DRAFT_CLAMP_CHAR_THRESHOLD;

  function handleToggle() {
    if (isExpanded) {
      setIsExpanded(false);
      // 收起后卡片骤短，scrollTop 不变会把视口甩到下方内容上。
      // 用 rAF 而不是 useLayoutEffect：本组件会被服务端预渲染，useLayoutEffect 会打 SSR 警告；
      // rAF 回调在 React 结束事件内的同步 flush 之后、下一次 paint 之前跑，DOM 已是收起后的高度。
      requestAnimationFrame(() => {
        // block: "nearest" = 卡片在视口上方时最小幅度滚动，让刚点过的按钮停在鼠标下
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } else {
      setIsExpanded(true);
    }
  }

  return (
    <div ref={containerRef} className="min-w-0">
      <SurfaceSection title={title} icon={Icon} tag={tag} dense={dense}>
        <div
          id={contentId}
          className={`whitespace-pre-wrap wrap-break-word text-sm leading-7 text-muted ${
            clamped && !isExpanded ? DRAFT_CLAMP_CLASS : ""
          }`}
        >
          {content || "暂无内容"}
        </div>
        {clamped ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={handleToggle}
            className="mt-2 rounded-full px-2 py-1 text-xs font-semibold text-accent-strong transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
          >
            {isExpanded ? "收起" : "展开全文"}
          </button>
        ) : null}
      </SurfaceSection>
    </div>
  );
}

// 转写稿说明文案：默认收起时提示这是什么、去哪儿看整理稿。
const TRANSCRIPT_HINT = "讯飞原始转写，供与整理稿对照；默认收起";
const TRANSCRIPT_EMPTY_HINT = "暂无转写稿";
// 展开态在卡内滚动，不把页面撑长（用户痛点是滚动层数太多，不是怕滚动）。
const TRANSCRIPT_BODY_CLASS =
  "soft-scroll mt-3 max-h-[20rem] overflow-y-auto overflow-x-hidden pr-1 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-muted";

// 原始转写稿收纳卡：整卡全宽摆在结果栅格最后一行，默认只露标题 + 说明 + 展开按钮。
// 必须定义在模块作用域：写在 ResultGrid 内部会每次 render 生成新组件类型，展开状态会闪
// （同 StructuredSectionCard 的约定）。
function TranscriptPanel({ content, dense = false }: { content: string; dense?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bodyId = useId();

  const empty = content.trim().length === 0;
  const expanded = !empty && isExpanded;

  return (
    <SurfaceSection title="原始转写稿（对照用）" icon={FileText} tag="Raw" dense={dense}>
      <p className="text-sm leading-6 text-muted">
        {empty ? TRANSCRIPT_EMPTY_HINT : TRANSCRIPT_HINT}
      </p>
      {/* 容器恒定渲染、正文按需挂载：aria-controls 始终指向存在的节点，
          折叠时也不把整篇转写稿留在 DOM 里（内联与弹层两份实例会翻倍）。 */}
      <div id={bodyId}>
        {expanded ? <div className={TRANSCRIPT_BODY_CLASS}>{content}</div> : null}
      </div>
      {empty ? null : (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setIsExpanded((value) => !value)}
          className="mt-3 w-full rounded-[0.9rem] border border-line/50 bg-white/55 px-3 py-2 text-center text-xs font-semibold text-accent-strong transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
        >
          {expanded ? "收起" : "展开对照"}
        </button>
      )}
    </SurfaceSection>
  );
}

function EmotionPanel({
  signals,
  collectionPath,
  dense = false,
}: {
  signals: EmotionSignal[];
  collectionPath?: CollectionPath;
  dense?: boolean;
}) {
  const levelStyleMap = {
    notice: "border-accent-soft bg-accent-soft/55 text-accent-strong",
    warning: "border-warning/20 bg-warning/10 text-warning",
    high: "border-danger/20 bg-danger/10 text-danger",
  } as const;

  // 肯定分支判 ai_interview，而不是判 upload。
  // collectionPath 可选，REQ-03 之前创建的项目该字段缺失，undefined 是真实存在的取值，
  // 而全仓库的缺省语义一律是 "upload"（project-store 写入默认值、getCollectionPathLabel 兜底），
  // 所以 undefined 必须与 "upload" 走同一分支。
  const emptyMessage =
    collectionPath === "ai_interview"
      ? "未识别到需要重点关注的情绪片段。"
      : "该采集路径暂不提供情绪提示。";

  return (
    <SurfaceSection
      title="情绪提示"
      icon={AlertTriangle}
      tag="Safety"
      dense={dense}
    >
      <div className="grid gap-3">
        {signals.length > 0 ? (
          signals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded-[1.15rem] border p-4 ${levelStyleMap[signal.level]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{signal.label}</p>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]">
                  {getEmotionLevelLabel(signal.level)}
                </span>
              </div>
              {/* 受访者原话用引文样式，与下方「建议」形成对照。
                  去掉「片段：」前缀——竖线本身就是引文信号，blockquote 也给了屏幕阅读器语义。 */}
              <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm leading-6 text-muted">
                {signal.excerpt}
              </blockquote>
              <p className="mt-1 text-sm leading-6">建议：{signal.guidance}</p>
            </div>
          ))
        ) : (
          // 空态才按采集路径分流。upload 路径下若模型仍然返回了情绪信号，
          // 上面的 signals.map 照常渲染，不隐藏。
          <ElementEmptyState message={emptyMessage} />
        )}
      </div>
    </SurfaceSection>
  );
}

function KeywordsPanel({
  keywords,
  dense = false,
}: {
  keywords: string[];
  dense?: boolean;
}) {
  return (
    <SurfaceSection title="主题关键词" icon={Tags} tag="Topics" dense={dense}>
      <div className="flex flex-wrap gap-2">
        {keywords.length > 0 ? (
          keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-accent-soft bg-accent-soft/72 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-accent-strong"
            >
              {keyword}
            </span>
          ))
        ) : (
          <ElementEmptyState message="暂未提取到主题关键词。" />
        )}
      </div>
    </SurfaceSection>
  );
}

// 固定长度占位，不能按 excerpt.length 生成——否则遮盖本身会泄露原片段长度。
const MASKED_EXCERPT_PLACEHOLDER = "••••••••";

const MARK_STATUS_META: Record<
  SensitiveMarkStatus,
  { label: string; className: string }
> = {
  pending: { label: "待确认", className: "border-warning/25 bg-warning/12 text-warning" },
  confirmed: { label: "已确认", className: "border-success/25 bg-success/10 text-success" },
  revoked: { label: "已撤销", className: "border-line/60 bg-white/70 text-muted" },
};

const SMALL_ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50";

// 必须定义在模块作用域：若写在 RedactionPanel 内部，每次 render 都会生成新的组件类型，
// 整列表会被卸载重建，显隐状态与卡片内错误都会闪。
function RedactionMarkCard({
  mark,
  rules,
  isRevealed,
  onToggleReveal,
  locked,
  busy,
  onReview,
}: {
  mark: SensitiveMark;
  rules: RedactionRule[];
  isRevealed: boolean;
  onToggleReveal: () => void;
  locked: boolean;
  busy: boolean;
  onReview: RedactionReviewController["onReview"];
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const statusMeta = MARK_STATUS_META[mark.status];
  const needsAttention = mark.status === "pending" && mark.needsVerify;
  // 撤销后仍会被自动规则强制脱敏，必须告知审校人「撤销不生效」的原因。
  const stillMaskedByRules =
    mark.status === "revoked" && isExcerptMatchedByRules(mark.excerpt, rules);

  const submit = useCallback(
    async (status: SensitiveMarkStatus) => {
      setLocalError(null);
      const result = await onReview([{ id: mark.id, status }]);

      if (!result.ok) {
        setLocalError(result.message ?? "操作失败，请重试");
      }
    },
    [mark.id, onReview],
  );

  return (
    <div
      className={`rounded-[1.15rem] border p-4 ${
        needsAttention ? "border-warning/30 bg-warning/10" : "border-warning/18 bg-warning/8"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{mark.type}</p>
          {needsAttention ? (
            <span className="rounded-full border border-warning/30 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-warning">
              【待人工核实】
            </span>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <button
        type="button"
        aria-expanded={isRevealed}
        onClick={onToggleReveal}
        className="mt-2 w-full rounded-[0.9rem] border border-line/50 bg-white/55 px-3 py-2 text-left transition-colors hover:bg-white/80"
      >
        <span className="text-xs font-semibold text-accent-strong">
          {isRevealed ? "点击隐藏片段" : "点击查看片段"}
        </span>
        <span className="mt-1 block break-all text-sm leading-6 text-muted">
          {isRevealed ? mark.excerpt : MASKED_EXCERPT_PLACEHOLDER}
        </span>
      </button>

      <p className="mt-2 text-sm leading-6 text-muted">原因：{mark.reason}</p>

      {stillMaskedByRules ? (
        <p className="mt-2 rounded-[0.9rem] border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
          该片段同时命中自动规则，仍将脱敏
        </p>
      ) : null}

      {localError ? <p className="mt-2 text-xs text-red-500">{localError}</p> : null}

      {locked ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {mark.status === "pending" ? (
            <>
              <button
                type="button"
                onClick={() => submit("confirmed")}
                disabled={busy}
                className={`${SMALL_ACTION_CLASS} border-success/30 bg-success/10 text-success hover:bg-success/15`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                确认脱敏
              </button>
              <button
                type="button"
                onClick={() => submit("revoked")}
                disabled={busy}
                className={`${SMALL_ACTION_CLASS} border-line/60 bg-white/70 text-muted hover:bg-white`}
              >
                <X className="h-3.5 w-3.5" />
                撤销脱敏
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => submit("pending")}
              disabled={busy}
              className={`${SMALL_ACTION_CLASS} border-line/60 bg-white/70 text-accent-strong hover:bg-white`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              改回待确认
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type RedactionFilter = "all" | "pending" | "verify";

const REDACTION_FILTERS: Array<{ value: RedactionFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending", label: "仅看待确认" },
  { value: "verify", label: "仅看存疑" },
];

function RedactionPanel({
  marks,
  rules,
  dense = false,
  review,
  lockedHint,
}: {
  marks: SensitiveMark[];
  rules: RedactionRule[];
  dense?: boolean;
  review: RedactionReviewController;
  lockedHint: string | null;
}) {
  const [filter, setFilter] = useState<RedactionFilter>("all");
  // 按 mark.id 记显隐：卡片 key 含 status，状态一变会重挂载，显隐不能跟着丢。
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [isBatching, setIsBatching] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // 先记下原数组下标，再排序与筛选——下标即 tiebreaker，显式保证同组内顺序稳定。
  const { orderedMarks, counts, batchIds } = useMemo(() => {
    const rank = (mark: SensitiveMark) => {
      if (mark.status !== "pending") {
        return 2;
      }

      return mark.needsVerify ? 0 : 1;
    };

    const ordered = marks
      .map((mark, index) => ({ mark, index }))
      .sort((left, right) => rank(left.mark) - rank(right.mark) || left.index - right.index);

    const batchTargets = marks.filter(
      (mark) => mark.status === "pending" && !mark.needsVerify,
    );

    return {
      orderedMarks: ordered,
      counts: {
        total: marks.length,
        pending: marks.filter((mark) => mark.status === "pending").length,
        confirmed: marks.filter((mark) => mark.status === "confirmed").length,
        revoked: marks.filter((mark) => mark.status === "revoked").length,
        verify: marks.filter((mark) => mark.status === "pending" && mark.needsVerify).length,
        batch: batchTargets.length,
      },
      batchIds: batchTargets.map((mark) => mark.id),
    };
  }, [marks]);

  const toggleReveal = useCallback((id: string) => {
    setRevealed((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  const handleBatchConfirm = useCallback(async () => {
    setIsBatching(true);
    setBatchError(null);

    try {
      const result = await review.onReview(
        batchIds.map((id) => ({ id, status: "confirmed" as const })),
      );

      if (!result.ok) {
        setBatchError(result.message ?? "批量确认失败，请重试");
      }
    } finally {
      setIsBatching(false);
    }
  }, [batchIds, review]);

  const filterCounts: Record<RedactionFilter, number> = {
    all: counts.total,
    pending: counts.pending,
    verify: counts.verify,
  };

  // 只按状态筛选，不重新排序——orderedMarks 的顺序已由上面的 sort 定死。
  const visibleMarks = orderedMarks.filter(({ mark }) => {
    if (filter === "pending") {
      return mark.status === "pending";
    }

    if (filter === "verify") {
      return mark.status === "pending" && mark.needsVerify;
    }

    return true;
  });

  return (
    <SurfaceSection title="脱敏提示" icon={ShieldAlert} tag="Redaction" dense={dense}>
      <div>
        {counts.total === 0 ? (
          <p className="text-sm leading-6 text-muted">
            本稿无需人工复核的 AI 标记；规则脱敏已自动执行。
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted">
              共 {counts.total} 处 · 待确认 {counts.pending} · 已确认 {counts.confirmed} ·
              已撤销 {counts.revoked} · 待核实 {counts.verify}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {REDACTION_FILTERS.map((option) => {
                const isActive = filter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? "border-accent-soft bg-accent-soft/72 text-accent-strong"
                        : "border-line/60 bg-white/70 text-muted hover:bg-white"
                    }`}
                  >
                    {option.label} {filterCounts[option.value]}
                  </button>
                );
              })}
            </div>

            {lockedHint ? (
              // T8：锁定态只提示一次，操作按钮整块收起，不在每张卡片上重复
              <p className="mt-3 rounded-[0.9rem] border border-line/60 bg-white/55 px-3 py-2 text-xs leading-5 text-muted">
                {lockedHint}
              </p>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleBatchConfirm}
                  disabled={counts.batch === 0 || review.busy}
                  className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-1.5 text-sm font-semibold text-success transition-colors hover:bg-success/15 disabled:opacity-50"
                >
                  {isBatching ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  批量确认 {counts.batch} 项（不含存疑）
                </button>
                {batchError ? (
                  <p className="mt-2 text-xs text-red-500">{batchError}</p>
                ) : null}
                {review.error ? (
                  <p className="mt-2 text-xs text-red-500">{review.error}</p>
                ) : null}
              </div>
            )}

            <div className="mt-4 grid gap-3">
              {visibleMarks.length > 0 ? (
                visibleMarks.map(({ mark }) => (
                  <RedactionMarkCard
                    // 带上 status：状态跃迁时重挂载，卡片内的错误提示自动清掉；
                    // 失败时状态未变，错误会保留——正是想要的。
                    key={`${mark.id}:${mark.status}`}
                    mark={mark}
                    rules={rules}
                    isRevealed={revealed.has(mark.id)}
                    onToggleReveal={() => toggleReveal(mark.id)}
                    locked={lockedHint !== null}
                    busy={review.busy}
                    onReview={review.onReview}
                  />
                ))
              ) : (
                <p className="text-sm leading-6 text-muted">当前筛选下没有敏感标记。</p>
              )}
            </div>
          </>
        )}
      </div>
    </SurfaceSection>
  );
}

// 超过该字数才折叠（严格大于：119 字不出按钮，121 字出按钮）
const STRUCTURED_COLLAPSE_CHAR_THRESHOLD = 120;

// 必须定义在模块作用域：若写在 StructuredPanel 内部，每次 render 都会生成新的组件类型，
// 整列表会被卸载重建，展开状态会闪（同下方 RedactionMarkCard 的约定）。
function StructuredSectionCard({
  section,
  index,
}: {
  section: ProjectRecord["structuredSections"][number];
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  // 按字数判断，不依赖 DOM 测量
  const collapsible = section.content.length > STRUCTURED_COLLAPSE_CHAR_THRESHOLD;

  return (
    <div className="rounded-[1.1rem] border border-line/70 bg-white/58 p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-accent-strong/75">
          {String(index + 1).padStart(2, "0")}
        </span>
        <p className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">
          {section.heading}
        </p>
      </div>
      {/* 折叠态刻意不加 whitespace-pre-wrap：-webkit-box 与 pre-wrap 组合时换行符处理不稳定，
          展开态再恢复，保留原文排版。超 120 字的章节基本都是连续散文，这个取舍不影响可读性。 */}
      <p
        id={contentId}
        className={`mt-2 wrap-break-word text-sm leading-6 text-muted ${
          collapsible && !isExpanded ? "line-clamp-3" : "whitespace-pre-wrap"
        }`}
      >
        {section.content}
      </p>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((value) => !value)}
          className="mt-2 rounded-full px-2 py-1 text-xs font-semibold text-accent-strong transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
        >
          {isExpanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
}

function StructuredPanel({
  sections,
  dense = false,
}: {
  sections: ProjectRecord["structuredSections"];
  dense?: boolean;
}) {
  const meta = sections.length > 0 ? `共 ${sections.length} 节` : null;

  return (
    <SurfaceSection title="结构化档案" icon={FileText} tag="Archive" meta={meta} dense={dense}>
      <div className="grid gap-3">
        {sections.length > 0 ? (
          sections.map((section, index) => (
            <StructuredSectionCard key={section.id} section={section} index={index} />
          ))
        ) : (
          <ElementEmptyState message="暂无结构化内容。" />
        )}
      </div>
    </SurfaceSection>
  );
}

function ResultGrid({
  project,
  expanded = false,
  review,
}: {
  project: ProjectRecord;
  expanded?: boolean;
  review: RedactionReviewController;
}) {
  // T8：非人工审校阶段一律只读，但文案要分状态——重新生成途中说「审校已完成」是错的。
  const lockedHint = review.locked
    ? project.status === "ready_to_export"
      ? "审校已完成，标记已锁定"
      : "当前阶段不可审校"
    : null;

  return (
    <div className="grid w-full min-w-0 gap-4">
      {/* 双列各自独立流动（flex-col），不用 grid row：grid row 会强制左右同行等高，
          限高后的整理稿下面会留一大片空白。
          flex-col 的 align-items: stretch 作用在交叉轴（宽度）上，卡片照样撑满列宽；
          纵向按内容高度自然堆叠。小屏单列 fallback 顺序 = 左列 4 卡 → 右列 3 卡 → 转写稿。 */}
      <div className={`grid min-w-0 gap-4 ${expanded ? "2xl:grid-cols-[1.1fr_0.9fr]" : "xl:grid-cols-[1.08fr_0.92fr]"}`}>
        <div className="flex min-w-0 flex-col gap-4">
          <TextPanel
            title="脱敏整理稿"
            icon={Sparkles}
            content={project.redactedAiDraft || project.aiDraft}
            tag="Redacted"
            dense={expanded}
            clampBody
          />
          <KeywordsPanel keywords={project.keywords} dense={expanded} />
          <TimelinePanel events={project.timelineEvents} dense={expanded} />
          <StructuredPanel sections={project.structuredSections} dense={expanded} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <TextPanel
            title="口述摘要"
            icon={ScanText}
            content={project.summary}
            tag="Summary"
            dense={expanded}
          />
          <EmotionPanel
            signals={project.emotionalSignals}
            collectionPath={project.collectionPath}
            dense={expanded}
          />
          <RedactionPanel
            marks={project.sensitiveMarks}
            rules={project.customRedactionRules}
            dense={expanded}
            review={review}
            lockedHint={lockedHint}
          />
        </div>
      </div>

      {/* 栅格之后全宽：转写稿只是对照用，默认收起，不占首屏 */}
      <TranscriptPanel content={project.transcriptRaw} dense={expanded} />
    </div>
  );
}

export function ProjectProcessingConsole({
  project,
  autoStart = false,
}: ProjectProcessingConsoleProps) {
  const router = useRouter();
  const [currentProject, setCurrentProject] = useState(project);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    setCurrentProject(project);
  }, [project]);


  // ── 确认审校完成 ─────────────────────────────────────────
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── 脱敏标记逐条复核 ─────────────────────────────────────
  const [isReviewSaving, setIsReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // 同步守卫：isReviewSaving 是异步 state，同一帧的两次点击会一起穿过去
  const reviewInFlightRef = useRef(false);

  const handleReviewMarks = useCallback(
    async (
      updates: MarkReviewUpdate[],
    ): Promise<{ ok: boolean; message?: string }> => {
      if (updates.length === 0) {
        return { ok: true };
      }

      if (reviewInFlightRef.current) {
        const message = "操作进行中，请稍候。";
        setReviewError(message);
        return { ok: false, message };
      }

      reviewInFlightRef.current = true;
      setIsReviewSaving(true);
      setReviewError(null);

      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sensitiveMarks: updates.map((update) => ({
              id: update.id,
              status: update.status,
              // 改回待确认时不传 reviewedAt：服务端 mergeMarkReviews 用 ?? 保留旧值，不清空
              ...(update.status === "pending"
                ? {}
                : { reviewedAt: new Date().toISOString() }),
            })),
          }),
        });
        const data = (await res.json()) as {
          project?: ProjectRecord;
          message?: string;
        };

        if (!res.ok) {
          throw new Error(data.message ?? "操作失败，请重试");
        }

        // 服务端返回完整 project，整体替换；不做乐观更新。
        // 刻意不调 router.refresh()：会重渲染整棵 RSC 树造成闪屏（见 handleExport 里的注释）。
        if (data.project) {
          setCurrentProject(data.project);
        }

        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "操作失败，请重试",
        };
      } finally {
        reviewInFlightRef.current = false;
        setIsReviewSaving(false);
      }
    },
    [project.id],
  );

  const handleConfirmReview = useCallback(async (): Promise<boolean> => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        status: 'ready_to_export',
        workflow: currentProject.workflow.map((step) =>
          step.key === 'manual_review'
            ? { ...step, status: 'completed' as const }
            : step.key === 'export'
              ? { ...step, status: 'pending' as const }
              : step
        ),
      }),
      });
      const data = await res.json() as { project?: typeof project; message?: string };
      if (!res.ok) throw new Error(data.message ?? '操作失败');
      if (data.project) setCurrentProject(data.project);
      router.refresh();
      return true;
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : '操作失败，请重试');
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [project.id, router, currentProject]);

  const handleExport = useCallback(async (format: 'docx' | 'txt' | 'json') => {
    if (
      project.emotionalSignals?.some((s) => s.level === "high") &&
      !window.confirm("检测到受访者在本段访谈中情绪较为激动，是否确认导出？")
    ) {
      return;
    }

    setExportingFormat(format);
    setExportError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/export?format=${format}`);
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? '导出失败');
      }
      const blob = await res.blob();
      const header = res.headers.get('Content-Disposition');
      const utf8Match = header?.match(/filename\*=UTF-8''([^;]+)/i);
      const basicMatch = header?.match(/filename="?([^"]+)"?/i);
      const fileName = utf8Match?.[1]
        ? decodeURIComponent(utf8Match[1])
        : basicMatch?.[1] ?? `archive.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      // 注意：此处不要 router.refresh()——会重渲染整棵 RSC 树，页面会闪一下
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '导出失败，请重试');
    } finally {
      setExportingFormat(null);
    }
  }, [project.id, router]);

  const handleProcess = useCallback(
    (cleanupUrl = false) => {
      setError(null);
      setIsProcessing(true);
      setCurrentProject((current) => ({
        ...current,
        lastProcessingError: null,
        status:
          current.status === "uploaded" ? "transcribing" : current.status,
      }));

      startTransition(async () => {
        try {
          const response = await fetch(`/api/projects/${project.id}/process`, {
            method: "POST",
          });

          const payload = (await response.json()) as {
            message?: string;
            project?: ProjectRecord;
          };

          if (!response.ok) {
            throw new Error(payload.message ?? "处理失败，请稍后重试。");
          }

          if (payload.project) {
            setCurrentProject(payload.project);
          }
          setIsProcessing(false);

          if (cleanupUrl) {
            router.replace(`/projects/${project.id}`);
          }

          router.refresh();
        } catch (processError) {
          setIsProcessing(false);
          setError(
            processError instanceof Error
              ? processError.message
              : "处理失败，请稍后重试。",
          );

          if (cleanupUrl) {
            router.replace(`/projects/${project.id}`);
          }
        }
      });
    },
    [project.id, router],
  );

  const hasResults = Boolean(
    currentProject.transcriptRaw ||
      currentProject.aiDraft ||
      currentProject.summary ||
      currentProject.keywords.length > 0 ||
      currentProject.redactionNotes.length > 0 ||
      currentProject.structuredSections.length > 0,
  );

  const isProjectProcessing =
    currentProject.status === "transcribing" ||
    currentProject.status === "ai_refining";
  const isBusy = isProcessing || isProjectProcessing;

  const pendingReviewCount = countPendingSensitiveMarks(currentProject.sensitiveMarks);
  // 两个请求交叉禁用：复核落库前不该放行「完成审校」，确认审校期间面板按钮也要灰。
  const reviewBusy = isReviewSaving || isConfirming;

  const reviewController = useMemo<RedactionReviewController>(
    () => ({
      busy: reviewBusy,
      error: reviewError,
      locked: currentProject.status !== "manual_review",
      onReview: handleReviewMarks,
    }),
    [reviewBusy, reviewError, currentProject.status, handleReviewMarks],
  );

  // T9：警示只在「用户主动点击」这一层拦。handleProcess 还被 autoStart 直接调用，
  // 把 confirm 放进 handleProcess 会在自动启动时误弹。
  const handleRegenerateClick = useCallback(() => {
    const reviewedCount = currentProject.sensitiveMarks.filter(
      (mark) => mark.status === "confirmed" || mark.status === "revoked",
    ).length;

    if (
      reviewedCount > 0 &&
      !window.confirm("重新生成将清空已有审校结果，是否继续？")
    ) {
      return;
    }

    handleProcess();
  }, [currentProject.sensitiveMarks, handleProcess]);

  useEffect(() => {
    const shouldAutoStart =
      autoStart &&
      !hasAutoStartedRef.current &&
      !currentProject.transcriptRaw &&
      currentProject.status === "uploaded";

    if (!shouldAutoStart) {
      return;
    }

    hasAutoStartedRef.current = true;
    handleProcess(true);
  }, [
    autoStart,
    currentProject.status,
    currentProject.transcriptRaw,
    handleProcess,
  ]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <section className="paper-panel h-full min-h-0 rounded-[1.85rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">上传即处理</p>
            <h2 className="font-display mt-2 text-[1.7rem] font-semibold text-accent-strong md:text-[2rem]">
              整理结果
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* xl 及以上不再有「放大查看」入口：结果栅格已内联在下方，弹层只会多一层滚动 */}
            <Button onClick={handleRegenerateClick} disabled={isBusy}>
              {isBusy ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  整理中…
                </>
              ) : (
                <>
                  {currentProject.transcriptRaw ? "重新生成整理结果" : "立即开始整理"}
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="soft-scroll mt-4 h-[calc(100%-4.6rem)] overflow-auto pr-1">
          {error || currentProject.lastProcessingError ? (
            <div className="rounded-[1.2rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
              {error || currentProject.lastProcessingError}
            </div>
          ) : null}

          {!hasResults ? (
            <div className="surface-card rounded-[1.5rem] p-5 text-sm leading-6 text-muted">
              上传完成后，系统会自动生成音视频转写、情绪提示、脱敏稿和结构化档案内容；如果没有自动触发，也可以手动点击右上角立即开始整理。
            </div>
          ) : null}


          {/* ── 待审校：引导卡片 ── */}
          {hasResults && currentProject.status === 'manual_review' ? (
            <div className="mb-4 rounded-[1.4rem] border border-success/25 bg-success/8 p-5">
              <div className="flex items-start gap-3">
                <PenLine className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    AI 整理已完成 · 请确认审校结果
                  </p>
                  {/* xl 结果栅格就在下方，不需要弹层；<xl 才有「打开整理结果」这个动作 */}
                  <p className="mt-1 text-sm leading-6 text-muted">
                    <span className="hidden xl:inline">
                      查看下方整理结果，确认无误后点击「完成审校」解锁导出。
                    </span>
                    <span className="xl:hidden">
                      点击下方打开整理结果进行复核，确认无误后点击「完成审校」解锁导出。
                    </span>
                  </p>
                  {confirmError && (
                    <p className="mt-2 text-xs text-red-500">{confirmError}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="xl:hidden inline-flex items-center gap-2 rounded-full bg-white/70 border border-line/60 px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      查看整理结果
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReview}
                      disabled={reviewBusy || pendingReviewCount > 0}
                      className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50"
                    >
                      {isConfirming ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {isConfirming ? (
                        '处理中…'
                      ) : pendingReviewCount > 0 ? (
                        <>
                          <span className="xl:hidden">
                            请先在整理结果中处理（还剩 {pendingReviewCount} 处待确认）
                          </span>
                          <span className="hidden xl:inline">
                            还剩 {pendingReviewCount} 处待确认
                          </span>
                        </>
                      ) : (
                        '完成审校，解锁导出'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── 已完成审校：内嵌导出面板 ── */}
          {currentProject.status === 'ready_to_export' ? (
            <div className="mb-4 rounded-[1.4rem] border border-accent-soft bg-accent-soft/30 p-5">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="text-sm font-semibold text-foreground">审校已完成 · 选择格式导出</p>
              </div>
              {exportError && (
                <p className="mb-3 text-xs text-red-500">{exportError}</p>
              )}
              <div className="grid gap-2">
                {(['docx', 'txt', 'json'] as const).map((fmt) => {
                  const labels = { docx: '导出 Word 档案稿 (.docx)', txt: '导出纯文本 (.txt)', json: '导出结构化数据 (.json)' };
                  const isExporting = exportingFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleExport(fmt)}
                      disabled={exportingFormat !== null}
                      className={`flex items-center justify-between rounded-[1rem] px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50
                        ${fmt === 'docx'
                          ? 'bg-accent-strong text-white hover:bg-accent-strong/90'
                          : 'bg-white/70 border border-line/60 text-foreground hover:bg-white'}`}
                    >
                      <span>{labels[fmt]}</span>
                      {isExporting
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />
                      }
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hasResults ? (
            <>
              <div className="xl:hidden surface-card rounded-[1.5rem] p-5">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      整理结果已生成
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      包含：音视频转写 · 脱敏稿 · 摘要 · 情绪提示 · 主题关键词 · 脱敏提示 · 要素标引 · 结构化档案
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-line/60 bg-white/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white"
                >
                  <Maximize2 className="h-4 w-4" />
                  查看整理结果
                  {pendingReviewCount > 0 ? (
                    <span className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-semibold text-white">
                      {pendingReviewCount}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="hidden xl:block">
                <ResultGrid project={currentProject} review={reviewController} />
              </div>
            </>
          ) : null}

          {currentProject.status === 'manual_review' && hasResults && (
            <div className="sticky bottom-0 pt-3 pb-1 bg-gradient-to-t from-white via-white to-transparent">
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={reviewBusy || pendingReviewCount > 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50"
              >
                {isConfirming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isConfirming ? (
                  '处理中…'
                ) : pendingReviewCount > 0 ? (
                  <>
                    <span className="xl:hidden">
                      请先在整理结果中处理（还剩 {pendingReviewCount} 处待确认）
                    </span>
                    <span className="hidden xl:inline">
                      还剩 {pendingReviewCount} 处待确认
                    </span>
                  </>
                ) : (
                  '完成审校，解锁导出'
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {isExpanded ? (
        <div className="fixed inset-0 z-[70] bg-[rgba(35,26,20,0.42)] backdrop-blur-[6px]">
          <div className="flex h-full flex-col p-2 sm:p-3">
            <div className="paper-panel paper-panel-strong flex min-h-0 flex-1 flex-col rounded-[2rem] px-4 py-4 md:px-6 md:py-5">
              <div className="flex flex-col gap-3 border-b border-line/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="font-display text-[1.8rem] font-semibold text-accent-strong">
                    整理结果
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    更适合通读长文本；按 <span className="font-semibold text-accent-strong">Esc</span> 也可以关闭。
                  </p>
                  {confirmError ? (
                    <p className="mt-2 text-xs text-red-500">{confirmError}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentProject.status === 'manual_review' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        // 失败时不关闭：用户要看到错误并能就地重试
                        const ok = await handleConfirmReview();
                        if (ok) setIsExpanded(false);
                      }}
                      disabled={reviewBusy || pendingReviewCount > 0}
                      className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
                    >
                      {isConfirming
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />}
                      {isConfirming ? (
                        '处理中…'
                      ) : pendingReviewCount > 0 ? (
                        `还剩 ${pendingReviewCount} 处待确认`
                      ) : (
                        '完成审校，解锁导出'
                      )}
                    </button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsExpanded(false)}
                  >
                    <X className="h-4 w-4" />
                    关闭
                  </Button>
                </div>
              </div>

              {/* 只在这一层裁横向：宽度由 min-w-0 交给栅格，纵向照常滚动。
                  用长写 overflow-y/x 而非 overflow-auto + overflow-x-hidden，
                  避免简写属性按生成顺序把 overflow-x 覆盖回 auto。 */}
              <div className="soft-scroll mt-4 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                <ResultGrid project={currentProject} expanded review={reviewController} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
