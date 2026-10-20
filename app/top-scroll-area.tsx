"use client";

import { useEffect, useId, useRef, useState, type HTMLAttributes } from "react";

/** A native top scrollbar synchronized with the original scrolling content. */
export default function TopScrollArea({ children, className = "", id, ...props }: HTMLAttributes<HTMLDivElement>) {
  const generatedId = useId();
  const contentId = id || generatedId;
  const viewport = useRef<HTMLDivElement>(null);
  const scrollbar = useRef<HTMLDivElement>(null);
  const scrollSource = useRef<"bar" | "content" | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [width, setWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const content = viewport.current;
    if (!content) return;
    function measure() {
      if (!content) return;
      setWidth(content.scrollWidth);
      setOverflowing(content.scrollWidth > content.clientWidth + 1);
      if (scrollbar.current) scrollbar.current.scrollLeft = content.scrollLeft;
    }
    const resize = new ResizeObserver(measure);
    function observe() {
      resize.disconnect();
      resize.observe(content!);
      for (const child of content!.children) resize.observe(child);
      measure();
    }
    const mutation = new MutationObserver(observe);
    mutation.observe(content, { childList: true, subtree: true, characterData: true });
    observe();
    return () => {
      resize.disconnect(); mutation.disconnect();
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  function synchronize(source: "bar" | "content", left: number) {
    // Ignore the mirrored scroll event so native smooth scrolling isn't interrupted.
    if (scrollSource.current && scrollSource.current !== source) return;
    scrollSource.current = source;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    const target = source === "bar" ? viewport.current : scrollbar.current;
    if (target && target.scrollLeft !== left) target.scrollLeft = left;
    scrollTimer.current = setTimeout(() => { scrollSource.current = null; }, 120);
  }

  return <div className="top-scroll-area">
    <div ref={scrollbar} className="top-scroll-bar" hidden={!overflowing} tabIndex={overflowing ? 0 : -1}
      role="region" aria-label="Scroll content horizontally" aria-controls={contentId}
      onScroll={event => synchronize("bar", event.currentTarget.scrollLeft)}>
      <div style={{ width, height: 1 }} />
    </div>
    <div {...props} id={contentId} ref={viewport} className={`top-scroll-content ${className}`}
      onScroll={event => {
        synchronize("content", event.currentTarget.scrollLeft);
        props.onScroll?.(event);
      }}>{children}</div>
  </div>;
}
