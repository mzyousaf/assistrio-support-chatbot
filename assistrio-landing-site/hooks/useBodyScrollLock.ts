"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Locks root scroll while `locked`: preserves `window.scrollY`, uses `position: fixed` on `body`
 * (iOS-friendly), compensates scrollbar width on `padding-right`, and sets `overscroll-behavior: none`
 * on `html`/`body` to reduce scroll chaining / rubber-banding behind overlays.
 */
export function useBodyScrollLock(locked: boolean) {
  const scrollYRef = useRef(0);

  useLayoutEffect(() => {
    if (!locked) return;

    const html = document.documentElement;
    const body = document.body;
    scrollYRef.current = window.scrollY;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    const prevBodyPaddingRight = body.style.paddingRight;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      body.style.paddingRight = prevBodyPaddingRight;
      body.style.overscrollBehavior = prevBodyOverscroll;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [locked]);
}
