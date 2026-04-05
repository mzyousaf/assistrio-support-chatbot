import { ProductVisualFrame } from "@/components/product/product-visual-frame";

/**
 * Illustrative runtime widget scene — fallback when no screenshot asset is configured or load fails.
 */
export function HomeWidgetMock() {
  return (
    <div className="relative w-full">
      <ProductVisualFrame chrome="page" addressBarLabel="https://yoursite.com/docs">
        <div className="relative h-[min(22rem,52vw)] min-h-[12rem] sm:h-[min(26rem,42vw)] bg-gradient-to-br from-slate-100 via-white to-[var(--brand-teal-subtle)]/30">
          <div className="absolute inset-0 p-6">
            <p className="max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
              Your page content continues here — the launcher stays docked so visitors can ask without leaving the doc.
            </p>
          </div>
        </div>
      </ProductVisualFrame>
        <div className="absolute bottom-6 right-6 w-[min(100%,22rem)] sm:bottom-8 sm:right-8">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] ring-1 ring-slate-900/[0.06]">
          <div className="flex items-center justify-between border-b border-white/10 bg-[var(--brand-teal)] px-4 py-3 text-white">
            <span className="text-sm font-semibold">Acme Support</span>
            <span className="text-lg leading-none opacity-90" aria-hidden>
              ×
            </span>
          </div>
          <div className="space-y-3 bg-slate-50/90 p-4">
            <p className="text-center text-[0.65rem] uppercase tracking-wide text-slate-400">Today · 9:42</p>
            <div className="rounded-xl rounded-bl-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              Hi — I can pull answers from your docs. What do you need?
            </div>
            <div className="ml-6 rounded-xl rounded-br-md bg-[var(--brand-teal-subtle)] px-3 py-2 text-sm text-slate-800">
              How do I rotate my API key?
            </div>
            <div className="rounded-xl rounded-bl-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              Here’s the security doc section on keys and rotation…
            </div>
            <p className="flex items-center pl-1 text-xs text-slate-400">
              <span>Assistrio is typing</span>
              <span className="typing-dots ml-0.5 inline-flex gap-0.5" aria-hidden>
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--brand-teal)]" />
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--brand-teal)]" />
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--brand-teal)]" />
              </span>
            </p>
          </div>
          <div className="border-t border-slate-100 bg-white px-3 py-2">
            <div className="h-9 rounded-full border border-slate-200 bg-slate-50 pl-3 text-xs leading-9 text-slate-400">
              Message…
            </div>
          </div>
        </div>
        <span className="launcher-pulse absolute -bottom-1 -right-1 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-teal)] text-2xl text-white shadow-[0_12px_32px_rgba(13,148,136,0.45)] ring-4 ring-white">
          💬
        </span>
      </div>
    </div>
  );
}
