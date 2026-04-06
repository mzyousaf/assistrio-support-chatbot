"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryBotCard, KB_CAROUSEL_SLIDE_COUNT } from "@/components/sections/gallery/gallery-bot-card";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import type { PublicBotListItem } from "@/types/bot";

/**
 * Base display counts for gallery cards (by index in the full `bots` list).
 * The pill shows base + live `totalChats` from the API.
 */
const SHOWCASE_DISPLAY_CHAT_COUNTS: readonly number[] = [
  1240, 892, 2156, 340, 5678, 923, 156, 4012, 2890, 445, 6721, 1103, 834, 2999, 1567, 721, 4980, 233, 8844,
  1205, 367, 5520, 991, 4333, 1888, 76, 6200, 1402, 777, 3050, 412, 9600, 555, 2233, 88, 7105, 3300, 1999,
  4444, 250, 5050, 1222, 678, 8901, 3400, 7777, 1024, 2100, 55, 8888, 3333,
];

type Props = {
  bots: PublicBotListItem[];
  /** Page intro (and lead copy) rendered in the hero band above search & category filters. */
  children?: ReactNode;
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0 0 4.35 4.35"
      />
    </svg>
  );
}

export function GalleryGridClient({ bots, children }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | "all">("all");
  const { track } = useTrackEvent();

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const b of bots) {
      const c = b.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [bots]);

  const displayChatCountByBotId = useMemo(() => {
    const m = new Map<string, number>();
    const arr = SHOWCASE_DISPLAY_CHAT_COUNTS;
    const n = arr.length;
    bots.forEach((b, i) => {
      const base = arr[i % n]!;
      const live =
        typeof b.totalChats === "number" && Number.isFinite(b.totalChats) && b.totalChats >= 0
          ? Math.floor(b.totalChats)
          : 0;
      m.set(b.id, base + live);
    });
    return m;
  }, [bots]);

  /** Stagger initial KB panel per bot (Documents / FAQs / Notes / Try asking) by card order. */
  const initialKbSlideByBotId = useMemo(() => {
    const m = new Map<string, number>();
    const n = KB_CAROUSEL_SLIDE_COUNT;
    bots.forEach((b, i) => {
      m.set(b.id, i % n);
    });
    return m;
  }, [bots]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bots.filter((b) => {
      if (category !== "all") {
        const cat = b.category?.trim() ?? "";
        if (cat !== category) return false;
      }
      if (!q) return true;
      const hay = [b.name, b.shortDescription ?? "", b.category ?? "", ...b.exampleQuestions].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [bots, query, category]);

  const countLabel =
    filtered.length === 1 ? "1 AI Support Agent" : `${filtered.length} AI Support Agents`;
  const showCategoryBar = categories.length >= 2;

  const toolbar = (
    <div className={`flex min-w-0 flex-col gap-5 ${children ? "mt-8" : ""}`}>
      <div className="flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="relative min-w-0 flex-1 max-w-3xl">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, description, or starter idea…"
            autoComplete="off"
            className="w-full rounded-xl border border-[var(--border-default)] bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-[var(--shadow-xs)] outline-none ring-[var(--brand-teal)]/0 transition placeholder:text-slate-400 focus:border-[var(--border-teal-soft)] focus:ring-2 focus:ring-[var(--brand-teal)]/20"
            aria-label="Search AI Support Agents"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Clear
            </button>
          ) : null}
        </div>
        <p className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-[var(--foreground-subtle)]">
          {countLabel}
        </p>
      </div>

      {showCategoryBar ? (
        <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${category === "all"
                ? "border-[var(--brand-teal)] bg-[var(--brand-teal-subtle)]/80 text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)]"
                : "border-[var(--border-default)] bg-white text-slate-600 shadow-[var(--shadow-xs)] hover:border-[var(--border-teal-soft)]"
              }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${category === c
                  ? "border-[var(--brand-teal)] bg-[var(--brand-teal-subtle)]/80 text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)]"
                  : "border-[var(--border-default)] bg-white text-slate-600 shadow-[var(--shadow-xs)] hover:border-[var(--border-teal-soft)]"
                }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const gridBody =
    filtered.length === 0 ? (
      <EmptyState title="No AI Support Agents match">
        <p>
          Try another search
          {showCategoryBar ? " or category" : ""}, or{" "}
          <button
            type="button"
            className="cursor-pointer font-medium text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:text-[var(--brand-teal)]"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            reset filters
          </button>
          .
        </p>
      </EmptyState>
    ) : (
      <div className="w-full min-w-0">
        <ul className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const href = `/bots/${encodeURIComponent(b.slug)}`;
            return (
              <li key={b.id} className="flex h-full min-w-0">
                <GalleryBotCard
                  bot={b}
                  href={href}
                  displayChatCount={displayChatCountByBotId.get(b.id)}
                  initialKbCarouselSlide={initialKbSlideByBotId.get(b.id)}
                  onNavigate={() => {
                    track("cta_clicked", { location: "gallery_card", label: "Open AI Support Agent", href });
                    track("demo_opened", { slug: b.slug, botName: b.name, href });
                  }}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );

  if (children) {
    return (
      <>
        <Section
          spacing="compact"
          className="relative overflow-hidden border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/35 to-transparent pb-10 pt-10 sm:pb-12 sm:pt-14"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(13,148,136,0.09),transparent_70%)]"
            aria-hidden
          />
          <Container className="relative">
            {children}
            {toolbar}
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24 pt-10 sm:pb-28 sm:pt-12">
          <Container>{gridBody}</Container>
        </Section>
      </>
    );
  }

  return (
    <div className="w-full min-w-0 py-2 sm:py-4">
      <div className="mb-10 flex min-w-0 flex-col gap-5 border-b border-[var(--border-default)] pb-8 sm:mb-12 sm:pb-10">
        {toolbar}
      </div>
      {gridBody}
    </div>
  );
}
