"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

export const HOME_SCROLL_STORAGE_KEY = "memory-engine-home-scroll";

// 恢复重试的帧预算（约 0.5s @60fps）：扛住加载占位块的重排与迟到的字体/布局抖动。
const RESTORE_FRAME_BUDGET = 30;

// 服务端渲染路径上不调用 useLayoutEffect。React 19 的服务端调度器本就把
// useLayoutEffect 映射成 noop 且不再警告，这里留同构别名只是为了不依赖该实现细节。
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type ScrollTarget = HTMLElement | Window;

type UseScrollRestorationOptions = {
  storageKey: string;
  // 只有 pathname 匹配时才允许写入。客户端跳转改掉 URL 之后立刻停止持久化，
  // 免得 Next 自己的回顶把存档刷成 0。
  persistPath?: string;
  // 「内容已落定」信号：为 false 表示列表正在重新拉取。两个分支都不拿它当门控 ——
  // 返回首页时 fetchProjects 会立刻把 isLoading 翻成 true，门控会把恢复推迟到请求结束。
  // 现在只在恢复 A 里当「内容到货后重跑一次」的触发器。
  ready?: boolean;
};

// 按运行时能力挑滚动容器，而不是按断点分支：
// ≥1280px 时内层列表 div 在滚（xl:h-dvh xl:overflow-hidden 锁死了 window），
// 更窄时该 div 滚不动，由 window 滚。
function isScrollable(element: HTMLElement | null): boolean {
  return element !== null && element.scrollHeight - element.clientHeight > 1;
}

function resolveScrollTarget(element: HTMLElement | null): ScrollTarget {
  return isScrollable(element) ? (element as HTMLElement) : window;
}

function readScrollTop(target: ScrollTarget): number {
  return target instanceof HTMLElement ? target.scrollTop : window.scrollY;
}

function maxScrollTop(target: ScrollTarget): number {
  if (target instanceof HTMLElement) {
    return Math.max(0, target.scrollHeight - target.clientHeight);
  }

  const { documentElement } = document;

  return Math.max(
    0,
    documentElement.scrollHeight - documentElement.clientHeight,
  );
}

function writeScrollTop(target: ScrollTarget, top: number): void {
  if (target instanceof HTMLElement) {
    // 直接赋值就是瞬时的：scroll-behavior: smooth 挂在 <html> 上，管不到内层容器。
    target.scrollTop = top;
    return;
  }

  // behavior: "instant" 压过 globals.css 里 html { scroll-behavior: smooth }。
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

function readSavedOffset(storageKey: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);

    if (!raw) return null;

    const value = Number(raw);

    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    // 隐私模式 / 配额异常：恢复降级为尽力而为。
    return null;
  }
}

// 恢复循环。提成模块级函数而不是 hook 体内的闭包，免得 react-hooks/exhaustive-deps
// 要求把函数本身也塞进依赖数组。
//
// 第一次尝试是同步的：内层 div 分支跑在 useLayoutEffect 里，必须在这一帧 paint 之前
// 落位，这是零闪烁的前提。只有「列表还在长、够不到目标」的重试才留在 rAF 上。
function startScrollRestore(
  elementRef: RefObject<HTMLElement | null>,
  saved: number,
  isRestoringRef: RefObject<boolean>,
  cancelRef: RefObject<(() => void) | null>,
): () => void {
  // 同一时刻只允许一个循环在跑。两个分支的守卫不严格互补 —— layout 与 passive 两阶段
  // 之间隔着一次 paint，容器可滚性可能翻转、让两边同时成立。两个循环并存会互相把
  // isRestoringRef 提前清掉，真实的 scroll 事件就会溜进 persist() 写坏存档。
  cancelRef.current?.();

  isRestoringRef.current = true;

  let frame = 0;
  let framesLeft = RESTORE_FRAME_BUDGET;

  function finish() {
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    isRestoringRef.current = false;
    cancelRef.current = null;
  }

  function apply() {
    frame = 0;

    // 每次尝试都重新解析目标：列表长高之后可以从 window 交接到内层 div。
    const target = resolveScrollTarget(elementRef.current);
    const next = Math.min(saved, maxScrollTop(target));
    writeScrollTop(target, next);

    // 列表可能还在长，够不到目标就下一帧再试，直到帧预算耗尽。
    const landed = readScrollTop(target);

    if (Math.abs(landed - next) >= 1 && framesLeft > 0) {
      framesLeft -= 1;
      frame = window.requestAnimationFrame(apply);
      return;
    }

    finish();
  }

  cancelRef.current = finish;
  apply();

  return finish;
}

export function useScrollRestoration(
  elementRef: RefObject<HTMLElement | null>,
  { storageKey, persistPath, ready = true }: UseScrollRestorationOptions,
): void {
  // 最近一次存档的内存镜像，effect 重跑时不必再读一遍 sessionStorage。
  const savedOffsetRef = useRef<number | null>(null);
  // 程序化滚动期间吞掉自身的 scroll 事件，防止恢复动作覆盖掉正在恢复的值。
  const isRestoringRef = useRef(false);
  // 在跑的恢复循环的取消函数，保证同一时刻只有一个。
  const cancelRestoreRef = useRef<(() => void) | null>(null);

  // 滚动时存，不在 unmount 存。
  //
  // 原因：App Router 客户端跳转时，旧树清理与 Next 在 layout 阶段写
  // htmlElement.scrollTop = 0 属于同一次 commit，cleanup 里读到的可能已经是 0。
  // 持续存档总能拿到最后一个真实位置，persistPath 再补一道「URL 已变就拒绝写入」的闸。
  // 这个 effect 只挂监听、绝不在挂载时写入，所以存档在被读取前不会被清掉。
  useEffect(() => {
    let frame = 0;

    function persist() {
      frame = 0;

      if (isRestoringRef.current) return;
      if (persistPath && window.location.pathname !== persistPath) return;

      const target = resolveScrollTarget(elementRef.current);
      const offset = readScrollTop(target);
      savedOffsetRef.current = offset;

      try {
        window.sessionStorage.setItem(storageKey, String(offset));
      } catch {
        // sessionStorage 不可用：恢复降级为尽力而为。
      }
    }

    function handleScroll() {
      if (frame !== 0) return;

      frame = window.requestAnimationFrame(persist);
    }

    const element = elementRef.current;

    window.addEventListener("scroll", handleScroll, { passive: true });
    element?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", handleScroll);
      element?.removeEventListener("scroll", handleScroll);
    };
  }, [elementRef, storageKey, persistPath]);

  // 恢复 A：目标是内层 div → 用 layout effect，paint 之前落位，零闪烁。
  //
  // 可以安全地跑在 Next 的 layout 阶段写 documentElement.scrollTop = 0 之前：Next 只碰
  // documentElement，碰不到后代容器，给 documentElement 赋 scrollTop 改不了内层 div 的
  // scrollTop；而且 xl 下 window 根本不可滚，那行本来就是 no-op。
  //
  // 不拿 ready 做硬门控：返回首页时 HomeDashboard 的 mount effect 会立刻调 fetchProjects，
  // 把 isLoading 翻成 true，用 ready 门控会把恢复一直推迟到请求结束（实测停在顶部 4 帧）。
  // 容器可滚就说明内容已在位，此时直接恢复。ready 仍留在依赖里当重跑触发器。
  useIsomorphicLayoutEffect(() => {
    void ready;

    if (!isScrollable(elementRef.current)) return;

    const saved = savedOffsetRef.current ?? readSavedOffset(storageKey);

    if (saved === null || saved <= 0) return;

    return startScrollRestore(
      elementRef,
      saved,
      isRestoringRef,
      cancelRestoreRef,
    );
  }, [elementRef, storageKey, ready]);

  // 恢复 B：目标是 window。
  //
  // 这里不能用 layout 阶段直接写：Next 在 layout-router 的 componentDidUpdate 里写
  // documentElement.scrollTop = 0，而 React 的 layout 阶段子先父后，我们会被反超。
  // 也不能用被动 useEffect：它由 Scheduler 调度，不保证在 paint 之前跑完 —— 慢网实测
  // 会漏出一帧停在顶部（375px + 800ms 延迟稳定复现）。
  //
  // 微任务正好落在两者之间：本次 commit 的同步栈全部跑完（Next 的反超写入已完成）之后、
  // 浏览器 paint 之前。所以「layout 阶段把第一次恢复排进微任务」既躲开反超，又赶在
  // paint 前落位。实测同一场景顶部停留帧 1 → 0。
  //
  // 不拿 ready 做门控、也不进依赖数组（理由同恢复 A）。返回首页时 HomeDashboard 的 mount
  // effect 会立刻调 fetchProjects 把 isLoading 翻成 true，这一下会在**同一个任务内**触发
  // 重渲染，于是本 effect 的 cleanup 抢在微任务出队之前跑掉、把排好的恢复取消 —— 实测
  // popstate 返回时恢复一次都没执行。内容迟到靠 startScrollRestore 的 rAF 重试兜，
  // 不需要 ready 触发重跑。
  useIsomorphicLayoutEffect(() => {
    if (isScrollable(elementRef.current)) return;

    const saved = savedOffsetRef.current ?? readSavedOffset(storageKey);

    // 存档为 0 或没有存档：不排微任务，什么也不做，天然没有可闪的东西。
    if (saved === null || saved <= 0) return;

    let cancelled = false;
    let stop: (() => void) | null = null;

    queueMicrotask(() => {
      if (cancelled) return;

      stop = startScrollRestore(
        elementRef,
        saved,
        isRestoringRef,
        cancelRestoreRef,
      );
    });

    return () => {
      // 卸载可能发生在微任务出队之前，此时 stop 还是 null，靠 cancelled 拦住尚未启动的恢复。
      cancelled = true;
      stop?.();
    };
  }, [elementRef, storageKey]);
}
