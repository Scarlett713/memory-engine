"use client";

import { useId, useState } from "react";
import { Sparkles } from "lucide-react";

import { ElementEmptyState, SurfaceSection } from "@/components/projects/element-shell";
import type { ProjectRecord } from "@/lib/types/project";

// 超过该条数才折叠（严格大于：8 条全显示，9 条才折叠）
const TIMELINE_COLLAPSE_THRESHOLD = 8;
// 折叠时显示的条数
const TIMELINE_VISIBLE_COUNT = 6;

// 「时间待补充」的两种既有写法。需求原文是「时间待补充」，
// 但 createFallbackTimeline（oral-history.ts）实际写的是「待人工补充」——
// 短转写稿走兜底路径是最常见的情况，只认前者会让这批节点显示成实心节点 + 实线徽标，
// 看上去像「时间已知」。两个都收进来，不改数据层。
const PENDING_TIME_LABELS = new Set(["待人工补充", "时间待补充"]);

function isPendingTimeLabel(label: string) {
  const trimmed = label.trim();

  return !trimmed || PENDING_TIME_LABELS.has(trimmed);
}

export function TimelinePanel({
  events,
  dense = false,
}: {
  events: ProjectRecord["timelineEvents"];
  dense?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // 必须用 useId 而非硬编码 id：内联实例（hidden xl:block，仍在 DOM 里）
  // 与放大浮层实例可能同时存在，硬编码会让 aria-controls 指向重复 id。
  const listId = useId();

  const collapsible = events.length > TIMELINE_COLLAPSE_THRESHOLD;
  const remainingCount = events.length - TIMELINE_VISIBLE_COUNT;
  // 顺序严格等于数据顺序：只 slice，不 sort、不 reverse。
  const visibleEvents =
    collapsible && !isExpanded ? events.slice(0, TIMELINE_VISIBLE_COUNT) : events;
  const pendingCount = events.filter((event) => isPendingTimeLabel(event.timeLabel)).length;

  // 「共 N 项」恒为总数：折叠时只显示 6 条，但要让使用者知道总共多少。
  const meta =
    events.length > 0
      ? `共 ${events.length} 项${pendingCount > 0 ? ` · ${pendingCount} 项时间待补充` : ""}`
      : null;

  return (
    <SurfaceSection title="要素标引" icon={Sparkles} meta={meta} dense={dense}>
      <div className="grid gap-3">
        {events.length > 0 ? (
          <ol id={listId} className="grid gap-3">
            {visibleEvents.map((event, index) => {
              const pending = isPendingTimeLabel(event.timeLabel);

              return (
                <li key={event.id} className="flex gap-3">
                  {/* 左列：轨线 + 节点。轨线下端多伸 0.75rem（= gap-3）接上下一项，末项不画。 */}
                  <div aria-hidden className="relative flex w-4 shrink-0 justify-center">
                    {index < visibleEvents.length - 1 ? (
                      <span className="absolute top-4 -bottom-3 w-px bg-line" />
                    ) : null}
                    {/* 待补充 = 空心节点，正常 = 实心节点。填充差异在灰度下也分得清。 */}
                    <span
                      className={`relative mt-1 h-2.5 w-2.5 rounded-full ${
                        pending
                          ? "border border-line-strong bg-white/70"
                          : "bg-accent-strong"
                      }`}
                    />
                  </div>

                  {/* 右列：min-w-0 + wrap-break-word 是窄屏长标题不横向溢出的关键 */}
                  <div className="min-w-0 flex-1">
                    {/* 待补充 = 虚线徽标 + muted，正常 = 实线徽标 + accent-strong。
                        与空心/实心节点叠加，共三处非颜色线索。 */}
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] ${
                        pending
                          ? "border border-dashed border-line-strong text-muted"
                          : "border border-accent-soft bg-accent-soft/72 text-accent-strong"
                      }`}
                    >
                      {/* 空串会渲染成一个空胶囊，回落到文案 */}
                      {pending && !event.timeLabel.trim() ? "时间待补充" : event.timeLabel}
                    </span>
                    <p className="mt-1.5 wrap-break-word text-sm font-semibold text-foreground">
                      {event.title}
                    </p>
                    <p className="mt-1 wrap-break-word text-sm leading-6 text-muted">
                      {event.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <ElementEmptyState message="暂未提取到要素标引。转写内容较短或缺少明确时间、事件线索时可能出现，建议对照转写稿人工核对。" />
        )}

        {collapsible ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={listId}
            onClick={() => setIsExpanded((value) => !value)}
            className="mt-1 w-full rounded-[0.9rem] border border-line/50 bg-white/55 px-3 py-2 text-center text-xs font-semibold text-accent-strong transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
          >
            {isExpanded ? "收起" : `展开其余 ${remainingCount} 项`}
          </button>
        ) : null}
      </div>
    </SurfaceSection>
  );
}
