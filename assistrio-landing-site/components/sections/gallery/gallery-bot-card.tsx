"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import type { PublicBotListItem, PublicKnowledgeBaseCounts } from "@/types/bot";
import { parseAgentPrimaryColor, rgbaFromHex } from "@/lib/agentAccent";

/** Validates a hex color string for optional accent overrides. */
export function safeAccent(hex?: string): string | undefined {
  if (!hex) return undefined;
  const t = hex.trim();
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(t) ? t : undefined;
}

function isLikelyHttpImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function nameInitials(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  const alnum = name.replace(/\s/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return (name.slice(0, 2) || "A").toUpperCase();
}

function defaultKnowledgeBaseCounts(): PublicKnowledgeBaseCounts {
  return { documents: 0, faqs: 0, notes: 0, urls: 0, html: 0 };
}

function knowledgeBaseCountsSummary(c: PublicKnowledgeBaseCounts): string {
  return [
    `${c.documents} ${c.documents === 1 ? "document" : "documents"}`,
    `${c.faqs} ${c.faqs === 1 ? "FAQ" : "FAQs"}`,
    `${c.notes} ${c.notes === 1 ? "note" : "notes"}`,
    `${c.urls} ${c.urls === 1 ? "URL" : "URLs"}`,
    `${c.html} ${c.html === 1 ? "HTML page" : "HTML pages"}`,
  ].join(", ");
}

export const KB_CAROUSEL_SLIDE_COUNT = 4;
const KB_CAROUSEL_SWIPE_PX = 48;
const KB_CAROUSEL_AUTO_MS = 5500;

/** Slide titles for header and carousel navigation. */
const SLIDE_TITLES = ["Documents", "FAQs", "Notes", "Try Asking"] as const;

const MAX_SUGGESTED_QUESTIONS_SHOWN = 3;

function previewDocumentLabel(item: { title: string; fileName?: string }): string {
  const fn = item.fileName?.trim();
  if (fn) return fn;
  return item.title.trim() || "Untitled";
}

function ShowcaseAvatar({
  name,
  imageUrl,
  emoji,
  accentHex,
}: {
  name: string;
  imageUrl?: string;
  emoji?: string;
  accentHex: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const rawUrl = imageUrl?.trim() ?? "";
  const showImage = Boolean(rawUrl && !imgFailed && isLikelyHttpImageUrl(rawUrl));

  const shell =
    "h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-md";

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic API URLs
      <img
        src={rawUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${shell} object-cover`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  if (emoji) {
    return (
      <span
        className={`flex ${shell} items-center justify-center bg-slate-50 text-2xl leading-none`}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  return (
    <span
      className={`flex ${shell} items-center justify-center text-sm font-semibold tracking-tight`}
      style={{
        backgroundColor: rgbaFromHex(accentHex, 0.1),
        color: accentHex,
      }}
      aria-hidden
    >
      {nameInitials(name)}
    </span>
  );
}

function normalizeInitialKbSlide(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  const i = Math.floor(raw);
  return ((i % KB_CAROUSEL_SLIDE_COUNT) + KB_CAROUSEL_SLIDE_COUNT) % KB_CAROUSEL_SLIDE_COUNT;
}

type Props = {
  bot: PublicBotListItem;
  href: string;
  /** When set (e.g. gallery: showcase base + live `totalChats`), overrides the chats pill value. */
  displayChatCount?: number;
  /** Initial KB carousel panel (0–3). Only applied on mount. */
  initialKbCarouselSlide?: number;
  onNavigate: () => void;
};

/**
 * Public gallery showcase card — editorial layout, overlay link for primary navigation.
 * Interactive controls (carousel, sample download) use pointer-events-auto above the link.
 */
export function GalleryBotCard({ bot, href, displayChatCount, initialKbCarouselSlide, onNavigate }: Props) {
  const primaryRaw = bot.chatUI?.primaryColor?.trim();
  const accentHex = parseAgentPrimaryColor(
    primaryRaw && /^#[0-9a-fA-F]{6}$/.test(primaryRaw) ? primaryRaw : undefined,
  );

  const avatarPrimary = bot.imageUrl?.trim();
  const avatarFallback = bot.chatUI?.launcherAvatarUrl?.trim();
  const displayImage = avatarPrimary || (!avatarPrimary && avatarFallback ? avatarFallback : undefined);

  const qs = useMemo(() => bot.exampleQuestions.map((q) => q.trim()).filter(Boolean), [bot.exampleQuestions]);
  const qShown = useMemo(() => qs.slice(0, MAX_SUGGESTED_QUESTIONS_SHOWN), [qs]);
  const qMore = qs.length > MAX_SUGGESTED_QUESTIONS_SHOWN ? qs.length - MAX_SUGGESTED_QUESTIONS_SHOWN : 0;

  const kbCounts = bot.knowledgeBaseCounts ?? defaultKnowledgeBaseCounts();
  const hasAnyKbDisplay = useMemo(() => Object.values(kbCounts).some((v) => v > 0), [kbCounts]);
  const firstDownloadable = useMemo(
    () => (bot.knowledgeBasePreview ?? []).find((i) => i.fileDownloadable && i.documentId),
    [bot.knowledgeBasePreview],
  );
  const documentPreviewItems = useMemo(
    () => (bot.knowledgeBasePreview ?? []).filter((i) => i.sourceType.toLowerCase() === "document"),
    [bot.knowledgeBasePreview],
  );
  const docMoreCount = Math.max(0, kbCounts.documents - documentPreviewItems.length);
  const faqPreviewTitles = useMemo(
    () =>
      (bot.knowledgeBasePreview ?? [])
        .filter((i) => i.sourceType.toLowerCase() === "faq")
        .map((i) => i.title.trim())
        .filter(Boolean),
    [bot.knowledgeBasePreview],
  );
  const faqMoreCount = Math.max(0, kbCounts.faqs - faqPreviewTitles.length);
  const notePreviewText = bot.knowledgeNotePreview?.trim() ?? "";

  const totalChats =
    typeof displayChatCount === "number" &&
    Number.isFinite(displayChatCount) &&
    displayChatCount >= 0
      ? Math.floor(displayChatCount)
      : typeof bot.totalChats === "number" && Number.isFinite(bot.totalChats) && bot.totalChats >= 0
        ? Math.floor(bot.totalChats)
        : 0;

  const sampleDocHref =
    firstDownloadable?.documentId &&
    bot.slug &&
    `/api/public/bots/${encodeURIComponent(bot.slug)}/documents/${encodeURIComponent(firstDownloadable.documentId)}/download`;

  const categoryLine = bot.category?.trim() ? bot.category : "AI Support Agent";
  const blurb = bot.shortDescription?.trim();

  const [kbCarouselSlide, setKbCarouselSlide] = useState(() => normalizeInitialKbSlide(initialKbCarouselSlide));
  const [kbCarouselHoverPause, setKbCarouselHoverPause] = useState(false);
  const [kbCarouselManualPause, setKbCarouselManualPause] = useState(false);
  const kbTouchStartX = useRef<number | null>(null);
  const kbManualResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kbCarouselGo = useCallback((dir: -1 | 1) => {
    setKbCarouselSlide((s) => (s + dir + KB_CAROUSEL_SLIDE_COUNT) % KB_CAROUSEL_SLIDE_COUNT);
  }, []);

  const kbCarouselPauseBriefly = useCallback(() => {
    setKbCarouselManualPause(true);
    if (kbManualResumeRef.current) clearTimeout(kbManualResumeRef.current);
    kbManualResumeRef.current = setTimeout(() => {
      kbManualResumeRef.current = null;
      setKbCarouselManualPause(false);
    }, 9000);
  }, []);

  const kbCarouselAutoPaused = kbCarouselHoverPause || kbCarouselManualPause;

  useEffect(() => {
    if (kbCarouselAutoPaused) return undefined;
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = window.setInterval(() => {
      setKbCarouselSlide((s) => (s + 1) % KB_CAROUSEL_SLIDE_COUNT);
    }, KB_CAROUSEL_AUTO_MS);
    return () => window.clearInterval(id);
  }, [kbCarouselAutoPaused]);

  useEffect(
    () => () => {
      if (kbManualResumeRef.current) clearTimeout(kbManualResumeRef.current);
    },
    [],
  );

  const onKbCarouselTouchStart = useCallback((e: TouchEvent) => {
    kbTouchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onKbCarouselTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = kbTouchStartX.current;
      kbTouchStartX.current = null;
      if (start == null) return;
      const end = e.changedTouches[0]?.clientX;
      if (end == null) return;
      const dx = end - start;
      if (Math.abs(dx) < KB_CAROUSEL_SWIPE_PX) return;
      kbCarouselPauseBriefly();
      kbCarouselGo(dx < 0 ? 1 : -1);
    },
    [kbCarouselGo, kbCarouselPauseBriefly],
  );

  const onKbCarouselKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        kbCarouselPauseBriefly();
        kbCarouselGo(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        kbCarouselPauseBriefly();
        kbCarouselGo(1);
      }
    },
    [kbCarouselGo, kbCarouselPauseBriefly],
  );

  const knowledgeHeaderCountLine = useMemo(() => {
    switch (kbCarouselSlide) {
      case 0: {
        const n = kbCounts.documents;
        return `${n.toLocaleString()} ${n === 1 ? "document" : "documents"}`;
      }
      case 1: {
        const n = kbCounts.faqs;
        return `${n.toLocaleString()} ${n === 1 ? "FAQ" : "FAQs"}`;
      }
      case 2: {
        const n = kbCounts.notes;
        return `${n.toLocaleString()} ${n === 1 ? "note" : "notes"}`;
      }
      case 3: {
        const n = qs.length;
        return `${n.toLocaleString()} suggested question${n === 1 ? "" : "s"}`;
      }
      default:
        return "";
    }
  }, [kbCarouselSlide, kbCounts.documents, kbCounts.faqs, kbCounts.notes, qs.length]);

  const accentBarStyle = {
    background: `linear-gradient(90deg, ${accentHex} 0%, ${rgbaFromHex(accentHex, 0.45)} 100%)`,
  } satisfies CSSProperties;

  return (
    <div className="group/showcase relative flex h-full min-h-0 w-full min-w-0">
      <Link
        href={href}
        onClick={onNavigate}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        aria-label={`Open ${bot.name} — chat live`}
      />
      <article
        className="pointer-events-none relative z-[1] flex h-full min-h-[29rem] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-20px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-300 group-hover/showcase:border-slate-300/90 group-hover/showcase:shadow-[0_20px_50px_-24px_rgba(15,23,42,0.18)]"
        title={knowledgeBaseCountsSummary(kbCounts)}
      >
        <div className="h-1 w-full shrink-0" style={accentBarStyle} aria-hidden />

        <header className="px-5 pb-1 pt-5 sm:px-6">
          <div className="flex gap-4">
            <div className="relative isolate h-14 w-14 shrink-0">
              <ShowcaseAvatar
                name={bot.name}
                imageUrl={displayImage}
                emoji={bot.avatarEmoji}
                accentHex={accentHex}
              />
              <span
                className="pointer-events-none absolute bottom-0 right-0 z-10 flex h-3.5 w-3.5 translate-x-[15%] translate-y-[15%] items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white"
                aria-label="Live agent"
                title="Live agent"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg">
                {bot.name}
              </h2>
              {blurb ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-[13px]">{blurb}</p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                  Open this agent to chat live.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--brand-teal)_22%,var(--border-default))] bg-[color-mix(in_srgb,var(--brand-teal-subtle)_55%,white)] px-2.5 py-1.5 shadow-[var(--shadow-xs)]">
              <span className="text-base font-bold tabular-nums leading-none text-[var(--brand-teal-dark)]">
                {totalChats.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-teal-dark)]/75">
                chats
              </span>
            </span>
            <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.03]">
              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
              <span className="truncate text-xs font-semibold text-slate-600">{categoryLine}</span>
            </span>
          </div>
        </header>

        <div className="mx-5 mb-2 mt-4 flex min-h-0 flex-1 flex-col sm:mx-6">
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-gradient-to-b from-slate-50/40 to-white"
            aria-labelledby={`${bot.id}-panel-title`}
            role="region"
            aria-roledescription="carousel"
            aria-label={`${bot.name}: knowledge base and suggested questions`}
            onMouseEnter={() => setKbCarouselHoverPause(true)}
            onMouseLeave={() => setKbCarouselHoverPause(false)}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/50 px-4 py-3 sm:px-4">
              <div className="min-w-0">
                <p
                  id={`${bot.id}-panel-title`}
                  className="text-xs font-semibold tracking-tight text-slate-900 sm:text-[13px]"
                  aria-live="polite"
                >
                  {kbCarouselSlide === 3 ? "Try asking" : "Knowledge Base"}
                </p>
                <p
                  className="mt-0.5 truncate text-[10px] font-medium tabular-nums tracking-tight text-slate-400 sm:text-[11px]"
                  aria-live="polite"
                >
                  {knowledgeHeaderCountLine}
                </p>
                <p id={`${bot.id}-kb-carousel-hint`} className="sr-only">
                  Sections advance automatically. Use arrow keys or swipe to move between sections.
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    kbCarouselPauseBriefly();
                    kbCarouselGo(-1);
                  }}
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label={`Previous: ${SLIDE_TITLES[(kbCarouselSlide - 1 + KB_CAROUSEL_SLIDE_COUNT) % KB_CAROUSEL_SLIDE_COUNT]}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M15 18l-6-6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    kbCarouselPauseBriefly();
                    kbCarouselGo(1);
                  }}
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label={`Next: ${SLIDE_TITLES[(kbCarouselSlide + 1) % KB_CAROUSEL_SLIDE_COUNT]}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 18l6-6-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 sm:px-4">
              <div
                className="min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-lg"
                tabIndex={0}
                onKeyDown={onKbCarouselKeyDown}
                onTouchStart={onKbCarouselTouchStart}
                onTouchEnd={onKbCarouselTouchEnd}
                aria-describedby={`${bot.id}-kb-carousel-hint`}
              >
                <div className="overflow-hidden rounded-lg bg-white/60 ring-1 ring-slate-200/40">
                  <div
                    className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
                    style={{ transform: `translate3d(-${kbCarouselSlide * 100}%, 0, 0)` }}
                  >
                    <div className="w-full shrink-0 px-4 py-4" aria-hidden={kbCarouselSlide !== 0}>
                      <div
                        className={
                          kbCounts.documents === 0
                            ? "flex min-h-[11.5rem] flex-col items-center justify-center px-1 text-center"
                            : "flex min-h-[11.5rem] flex-col"
                        }
                      >
                        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                          {kbCounts.documents > 0
                            ? "File sources help the agent cite real material and stay specific in answers."
                            : "In chat, this agent still draws on FAQs, notes, and other sources you’ll see when you open it."}
                        </p>
                        {hasAnyKbDisplay && kbCounts.documents > 0 && documentPreviewItems.length > 0 ? (
                          <>
                            <p className="mt-3 w-full text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Shown here
                            </p>
                            <ul className="mt-2 w-full space-y-2 text-left" aria-label="Documents shown in preview">
                              {documentPreviewItems.map((item, i) => (
                                <li
                                  key={`${bot.id}-doc-${item.documentId ?? i}-${i}`}
                                  className="border-l-2 border-slate-200 pl-3 text-sm leading-snug text-slate-700"
                                  style={{ borderLeftColor: rgbaFromHex(accentHex, 0.55) }}
                                >
                                  {previewDocumentLabel(item)}
                                  {item.fileType ? (
                                    <span className="ml-1.5 text-xs font-normal text-slate-400">({item.fileType})</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                            {docMoreCount > 0 ? (
                              <p className="mt-2 w-full text-left text-xs font-medium tabular-nums text-slate-500">
                                +{docMoreCount.toLocaleString()} more document{docMoreCount === 1 ? "" : "s"} indexed
                              </p>
                            ) : null}
                          </>
                        ) : hasAnyKbDisplay && kbCounts.documents > 0 && documentPreviewItems.length === 0 ? (
                          <p className="mt-3 w-full text-left text-sm leading-relaxed text-slate-600">
                            The full agent page lists every document for richer, file-grounded replies.
                          </p>
                        ) : null}
                        {sampleDocHref ? (
                          <div className={kbCounts.documents === 0 ? "mt-4" : "mt-auto pt-4"}>
                            <a
                              href={sampleDocHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                            >
                              Download sample
                              <svg className="h-3.5 w-3.5 opacity-90" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-full shrink-0 px-4 py-4" aria-hidden={kbCarouselSlide !== 1}>
                      <div
                        className={
                          kbCounts.faqs === 0
                            ? "flex min-h-[11.5rem] flex-col items-center justify-center px-1 text-center"
                            : "flex min-h-[11.5rem] flex-col"
                        }
                      >
                        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                          {kbCounts.faqs > 0
                            ? "FAQs keep common answers fast, consistent, and aligned with how you want to sound."
                            : "When you open this agent, answers still combine documents, notes, and general context for helpful replies."}
                        </p>
                        {kbCounts.faqs > 0 && faqPreviewTitles.length > 0 ? (
                          <>
                            <p className="mt-3 w-full text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Shown here
                            </p>
                            <ul className="mt-2 w-full space-y-2 text-left" aria-label="FAQ questions shown in preview">
                              {faqPreviewTitles.map((t, i) => (
                                <li
                                  key={`${bot.id}-faq-${i}`}
                                  className="border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-700"
                                  style={{ borderLeftColor: rgbaFromHex(accentHex, 0.55) }}
                                >
                                  {t}
                                </li>
                              ))}
                            </ul>
                            {faqMoreCount > 0 ? (
                              <p className="mt-2 w-full text-left text-xs font-medium tabular-nums text-slate-500">
                                +{faqMoreCount.toLocaleString()} more FAQ{faqMoreCount === 1 ? "" : "s"} indexed
                              </p>
                            ) : null}
                          </>
                        ) : kbCounts.faqs > 0 && faqPreviewTitles.length === 0 ? (
                          <p className="mt-3 w-full text-left text-sm leading-relaxed text-slate-600">
                            Opening this agent unlocks the full FAQ set for broader coverage on frequent questions.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-full shrink-0 px-4 py-4" aria-hidden={kbCarouselSlide !== 2}>
                      <div
                        className={
                          kbCounts.notes === 0
                            ? "flex min-h-[11.5rem] flex-col items-center justify-center px-1 text-center"
                            : "flex min-h-[11.5rem] flex-col"
                        }
                      >
                        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                          {kbCounts.notes > 0
                            ? "Notes shape tone and policy alongside documents and FAQs; the excerpt below may be shortened."
                            : "In chat, context still comes through documents, FAQs, and the full experience when you open this agent."}
                        </p>
                        {kbCounts.notes > 0 && notePreviewText ? (
                          <p className="mt-3 w-full max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-left text-sm leading-relaxed text-slate-700">
                            {notePreviewText}
                          </p>
                        ) : kbCounts.notes > 0 && !notePreviewText ? (
                          <p className="mt-3 w-full text-left text-sm leading-relaxed text-slate-600">
                            The full agent view includes the complete note so answers reflect that full guidance.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-full shrink-0 px-4 py-4" aria-hidden={kbCarouselSlide !== 3}>
                      <div
                        className={
                          qs.length === 0
                            ? "flex min-h-[11.5rem] flex-col items-center justify-center px-1 text-center"
                            : "min-h-[11.5rem]"
                        }
                      >
                        {qs.length > 0 ? (
                          <>
                            <p className="text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                              These prompts illustrate how the agent responds — try them when you open this agent or ask your own.
                            </p>
                            <ul className="mt-3 space-y-2" aria-label="Suggested questions">
                              {qShown.map((q, i) => (
                                <li
                                  key={`${bot.id}-q-${i}`}
                                  className="border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-700"
                                  style={{ borderLeftColor: rgbaFromHex(accentHex, 0.55) }}
                                >
                                  {q}
                                </li>
                              ))}
                            </ul>
                            {qMore > 0 ? (
                              <p className="mt-3 text-xs font-medium tabular-nums text-slate-500">
                                +{qMore.toLocaleString()} more suggested question{qMore === 1 ? "" : "s"}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-auto border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
          <span className="relative inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-teal)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(13,148,136,0.45)] transition-[transform,box-shadow] duration-200 group-hover/showcase:-translate-y-0.5 group-hover/showcase:shadow-[0_14px_36px_-10px_rgba(13,148,136,0.5)]">
            Chat live
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M7 17L17 7M17 7H9M17 7V15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </article>
    </div>
  );
}
