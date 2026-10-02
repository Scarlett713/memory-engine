import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// 处理台上的要素面板外壳。原先内联在 project-processing-console.tsx 里，
// 抽出独立模块是为了让 timeline-panel.tsx 也能用：否则控制台 import 时间线面板、
// 时间线面板又 import 控制台的两个共享件，形成循环依赖。
// 无状态组件，不加 "use client"，随引入方进入客户端边界（同 button.tsx 的约定）。

export function SurfaceSection({
  title,
  icon: Icon,
  tag,
  meta,
  children,
  dense = false,
}: {
  title: string;
  icon: LucideIcon;
  tag: string;
  // 面板头计数/提示（「共 9 项 · 2 项时间待补充」「共 3 节」）。
  // 可选：不是每个面板都有可计数的条目，空态旁边挂个「共 0 项」是噪音。
  meta?: ReactNode;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <article className={`surface-card rounded-[1.55rem] ${dense ? "p-4" : "p-4 md:p-5"}`}>
      <div className="flex items-center justify-between gap-4">
        {/* min-w-0 让 meta 在窄屏下能换行，不把右侧 tag 挤出容器 */}
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0 text-accent-strong" />
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {meta ? <span className="text-xs font-medium text-muted">{meta}</span> : null}
        </div>
        <span className="tape-label shrink-0">{tag}</span>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

// 四类要素的统一空态：虚线边框占位块 + muted 文案。
// 文案只表述「未提取到」，不暗示「系统确认没有问题」。
// w-full 必需：关键词面板的外层是 flex flex-wrap，没有它占位块会缩到文字宽度。
export function ElementEmptyState({ message }: { message: string }) {
  return (
    <div className="w-full rounded-[1.1rem] border border-dashed border-line/70 bg-white/40 px-4 py-5 text-sm leading-6 text-muted">
      {message}
    </div>
  );
}
