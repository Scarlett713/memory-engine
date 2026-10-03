"use client";

import { useEffect, useRef, type RefObject } from "react";

export const HOME_SCROLL_STORAGE_KEY = "memory-engine-home-scroll";

// 恢复重试的帧预算（约 0.5s @60fps）：扛住加载占位块的重排与迟到的字体/布局抖动。
const RESTORE_FRAME_BUDGET = 30;

type ScrollTarget = HTMLElement | Window;

type UseScrollRestorationOptions = {
  storageKey: string;
  // 只有 pathname 匹配时才允许写入。客户端跳转改掉 URL 之后立刻停止持久化，
  // 免得 Next 自己的回顶把存档刷成 0。
  persistPath?: string;
  // 仅在为 true 时恢复。列表（重新）变高期间置 false，翻转回 true 时会重新钳位恢复。
  ready?: boolean;
};

// 按运行时能力挑滚动容器，而不是按断点分支：
// ≥1280px 时内层列表 div 在滚（xl:h-dvh xl:overflow-hidden 锁死了 window），
// 更窄时该 div 滚不动，由 window 滚。
function resolveScrollTarget(element: HTMLElement | null): ScrollTarget {
  if (element && element.scrollHeight - element.clientHeight > 1) {
    return element;
  }

  return window;
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

export function useScrollRestoration(
  elementRef: RefObject<HTMLElement | null>,
  { storageKey, persistPath, ready = true }: UseScrollRestorationOptions,
): void {
  // 最近一次存档的内存镜像，effect 重跑时不必再读一遍 sessionStorage。
  const savedOffsetRef = useRef<number | null>(null);
  // 程序化滚动期间吞掉自身的 scroll 事件，防止恢复动作覆盖掉正在恢复的值。
  const isRestoringRef = useRef(false);

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

  // 恢复必须用被动 useEffect，不能用 useLayoutEffect：React 的 layout 阶段子先父后，
  // 用 useLayoutEffect 会跑在 layout-router 里祖先组件写 scrollTop = 0 之前，被它反超。
  // 被动 effect 在整个 layout 阶段之后落地，push（点「返回工作台」）与 popstate（浏览器后退）都能覆盖。
  useEffect(() => {
    if (!ready) return;

    const saved = savedOffsetRef.current ?? readSavedOffset(storageKey);

    if (saved === null || saved <= 0) return;

    // 显式标注：apply 是函数声明会被提升，TS 不会把上面的 null 收窄带进闭包。
    const restoreTo: number = saved;

    isRestoringRef.current = true;

    let frame = 0;
    let framesLeft = RESTORE_FRAME_BUDGET;

    function apply() {
      frame = 0;

      const target = resolveScrollTarget(elementRef.current);
      const next = Math.min(restoreTo, maxScrollTop(target));
      writeScrollTop(target, next);

      // 列表可能还在长，够不到目标就下一帧再试，直到帧预算耗尽。
      const landed = readScrollTop(target);

      if (Math.abs(landed - next) >= 1 && framesLeft > 0) {
        framesLeft -= 1;
        frame = window.requestAnimationFrame(apply);
        return;
      }

      isRestoringRef.current = false;
    }

    frame = window.requestAnimationFrame(apply);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      isRestoringRef.current = false;
    };
  }, [elementRef, storageKey, ready]);
}
