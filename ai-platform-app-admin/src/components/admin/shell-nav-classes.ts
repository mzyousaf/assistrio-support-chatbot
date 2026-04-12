/**
 * Shared navigation styles for the workspace rail (main) and agent rail.
 * Uses Tailwind `dark:` so parent `.dark` / `dark` class on shell controls appearance.
 */

/** Top-level row (Agents, Playground, group headers style alignment). */
export const SHELL_NAV_TOP_INACTIVE =
  "border-l-2 border-transparent text-slate-600 hover:bg-teal-50/90 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100";

export const SHELL_NAV_TOP_ACTIVE =
  "border-l-2 border-brand-500 bg-teal-50/95 text-brand-900 dark:border-brand-400 dark:bg-slate-800/60 dark:text-brand-200";

/** Nested link under a section (Analytics children, agent nested items). */
export const SHELL_NAV_NESTED_INACTIVE =
  "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200";

export const SHELL_NAV_NESTED_ACTIVE =
  "bg-teal-50 text-brand-900 dark:bg-brand-500/10 dark:text-brand-300";
