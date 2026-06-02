import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cx } from "./utils";

const SEE_MORE_EN = "see more...";

/** Muted tone for in-thread transcript (on panel background, not inside the voice bubble). */
const transcriptMuted = (dark: boolean) => (dark ? "text-gray-400" : "text-gray-500");
const SEE_MORE_CTA_EST_PX = 78;

const textBase = (dark: boolean) =>
  cx(
    "text-left text-[13px] leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
    transcriptMuted(dark),
  );

function measureTwoLineBreak(
  t: string,
  widthPx: number,
  host: HTMLElement,
  dark: boolean,
): { head: string; tail: string } {
  if (!t) return { head: "", tail: "" };
  if (widthPx < 8) return { head: t, tail: "" };
  const div = document.createElement("div");
  div.setAttribute("aria-hidden", "true");
  div.className = textBase(dark);
  div.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;width:${widthPx}px;`;
  host.appendChild(div);
  try {
    div.textContent = "A";
    const oneLineH = div.offsetHeight;
    if (oneLineH < 4) return { head: t, tail: "" };
    const max2 = oneLineH * 2 + 1.5;
    let lo = 0;
    let hi = t.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      div.textContent = t.slice(0, mid);
      if (div.offsetHeight <= max2) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best < 1 && t.length > 0) {
      return { head: t, tail: "" };
    }
    return { head: t.slice(0, best), tail: t.slice(best) };
  } finally {
    host.removeChild(div);
  }
}

/**
 * Fills a single line with as many full words (and the spaces after them) as fit in maxWidth; never splits a word.
 */
function fitTailWordsToLineWidth(tail: string, maxWidth: number, host: HTMLElement, dark: boolean): string {
  if (!tail || maxWidth < 4) return "";
  const div = document.createElement("div");
  div.setAttribute("aria-hidden", "true");
  div.className = cx("inline-block text-left text-[13px] leading-snug whitespace-nowrap", transcriptMuted(dark));
  div.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;";
  host.appendChild(div);
  try {
    const parts = tail.match(/[^\s]+|\s+/g) ?? [tail];
    let built = "";
    for (const p of parts) {
      const next = built + p;
      div.textContent = next;
      if (div.getBoundingClientRect().width > maxWidth) {
        if (built.length === 0) {
          // First word itself wider than the line: show no tail text; user opens full text via "see more".
          return "";
        }
        return built.replace(/\s+$/u, "");
      }
      built = next;
    }
    return built.replace(/\s+$/u, "");
  } finally {
    host.removeChild(div);
  }
}

function TranscriptThirdLine({
  tail,
  dark,
  onSeeMore,
  measureHostRef,
}: {
  tail: string;
  dark: boolean;
  onSeeMore?: () => void;
  measureHostRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [visibleTail, setVisibleTail] = useState("");

  const recompute = useCallback(() => {
    const host = measureHostRef.current;
    if (!host || !rowRef.current) {
      setVisibleTail(tail);
      return;
    }
    const row = rowRef.current;
    const w = row.getBoundingClientRect().width;
    if (w < 4) {
      setVisibleTail(tail);
      return;
    }
    const cta = row.lastElementChild as HTMLElement | null;
    const ctaW = cta?.getBoundingClientRect().width ?? 0;
    const maxW = Math.max(0, w - (ctaW > 2 ? ctaW : SEE_MORE_CTA_EST_PX));
    setVisibleTail(fitTailWordsToLineWidth(tail, maxW, host, dark));
  }, [tail, measureHostRef, dark]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(row);
    return () => ro.disconnect();
  }, [recompute]);

  const seeMoreBtn = onSeeMore ? (
    <button
      type="button"
      onClick={onSeeMore}
      className={cx(
        "shrink-0 text-[13px] font-medium leading-snug focus:outline-none focus-visible:ring-2 rounded px-0.5 transition-opacity",
        "underline decoration-current underline-offset-2",
        "hover:decoration-current",
        dark ? "text-gray-400 focus-visible:ring-gray-500/50" : "text-gray-500 focus-visible:ring-gray-400/60",
      )}
    >
      {SEE_MORE_EN}
    </button>
  ) : (
    <span
      className={cx(
        "shrink-0 text-[13px] font-medium leading-snug",
        "underline decoration-current underline-offset-2",
        dark ? "text-gray-400" : "text-gray-500",
      )}
    >
      {SEE_MORE_EN}
    </span>
  );

  return (
    <div
      ref={rowRef}
      className="flex w-full min-w-0 max-w-full flex-nowrap items-baseline justify-start gap-0 text-[13px] leading-snug"
      title={tail.trim() || undefined}
    >
      <span
        className={cx(
          "m-0 min-w-0 max-w-full flex-1 basis-0 overflow-hidden whitespace-nowrap text-left text-clip",
          "text-[13px] leading-snug",
          transcriptMuted(dark),
        )}
      >
        {visibleTail}
      </span>
      {seeMoreBtn}
    </div>
  );
}

/**
 * ~2.5 lines: two full lines, then one line of tail words (full words only) + “see more...”.
 * Max width matches the in-thread voice message player. Transcript uses muted (disabled) text color.
 */
export function VoiceTranscriptPreview({
  text,
  dark,
  onSeeMore,
}: {
  text: string;
  dark: boolean;
  onSeeMore?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState<{ head: string; tail: string } | null>(null);

  const recompute = useCallback(() => {
    const t = text.trim();
    if (!t) {
      setSplit((prev) => (prev?.head === "" && prev?.tail === "" ? prev : { head: "", tail: "" }));
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    const w = host.clientWidth;
    const next = measureTwoLineBreak(t, w, host, dark);
    setSplit((prev) => (prev && prev.head === next.head && prev.tail === next.tail ? prev : next));
  }, [text, dark]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  const t = text.trim();
  if (!t) return null;

  if (split == null) {
    return (
      <div ref={hostRef} className="w-full min-w-0 max-w-full text-left">
        <p className={cx(textBase(dark), "!text-left", "line-clamp-2")}>{t}</p>
      </div>
    );
  }

  const { head, tail } = split;
  const showThirdRow = tail.length > 0;

  if (!showThirdRow) {
    return (
      <div ref={hostRef} className="w-full min-w-0 max-w-full text-left">
        <p className={cx(textBase(dark), "!text-left")}>{t}</p>
      </div>
    );
  }

  return (
    <div ref={hostRef} className="w-full min-w-0 max-w-full text-left">
      {head ? (
        <p className={cx(textBase(dark), "m-0 !text-left whitespace-pre-wrap break-words [overflow-wrap:anywhere]")}>
          {head}
        </p>
      ) : null}
      <TranscriptThirdLine
        tail={tail}
        dark={dark}
        onSeeMore={onSeeMore}
        measureHostRef={hostRef}
      />
    </div>
  );
}
