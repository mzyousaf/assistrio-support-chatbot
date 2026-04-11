/** Shared visual tokens for marketing / trial modals (backdrop + panel + chrome). */

/** Full-screen dim behind modal content (no z-index — parent stacking context should set layer). */
export const landingModalBackdropClass = "bg-slate-900/50 backdrop-blur-[3px]";

/** Card surface only (no flex — use for compact centered dialogs). */
export const landingModalPanelSurfaceClass =
  "relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_55px_-22px_rgba(15,23,42,0.24),0_0_0_1px_rgba(15,23,42,0.04)]";

/** Surface + column layout + safe max height for scroll + sticky footer patterns. */
export const landingModalPanelStackClass = `${landingModalPanelSurfaceClass} flex max-h-[min(90dvh,40rem)] flex-col`;

export const landingModalPanelClass = `${landingModalPanelStackClass} max-w-md`;

export const landingModalHeaderIconWrapClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-teal-faint)] to-white text-[var(--brand-teal-dark)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-[var(--border-teal-soft)]/70";

export const landingModalCloseButtonClass =
  "rounded-xl p-2 text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const landingModalFooterBarClass =
  "shrink-0 border-t border-slate-100/95 bg-gradient-to-b from-slate-50/90 to-slate-50/70 px-5 py-4 sm:px-6";
