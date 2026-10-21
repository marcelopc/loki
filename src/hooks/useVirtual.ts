// Minimal windowing hook for a vertically-scrollable list. Renders only the
// rows within the viewport plus a small overscan buffer, keeping large
// commit histories (100k+) smooth.

import { useEffect, useRef, useState, type RefObject } from "react";

const OVERSCAN = 8;
const DEFAULT_ROW_HEIGHT = 28;

export interface VirtualRange {
  total: number;
  start: number;
  end: number;
  containerRef: RefObject<HTMLDivElement | null>;
  rowHeight: number;
  scrollTop: number;
}

export function useVirtual(
  total: number,
  rowHeight = DEFAULT_ROW_HEIGHT
): VirtualRange {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const visCount = Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2;
  const end = Math.min(total, start + visCount);

  return { total, start, end, containerRef, rowHeight, scrollTop };
}