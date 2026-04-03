/** Shared list-page toolbar styles — use for search, filters, and meta across AdminShell pages. */

export const ADMIN_PAGE_SEARCH_INPUT_CLASS =
  "min-w-0 w-full rounded-md border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-w-md";

export function adminFilterChipClass(active: boolean): string {
  return active
    ? "rounded-md border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 dark:border-brand-500/40 dark:bg-brand-950/40 dark:text-brand-200"
    : "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400";
}

export const ADMIN_PAGE_META_TEXT_CLASS = "text-xs text-slate-500 dark:text-slate-500";
