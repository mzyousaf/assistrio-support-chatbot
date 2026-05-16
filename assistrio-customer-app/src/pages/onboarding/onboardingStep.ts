/**
 * Onboarding layout typography and structure.
 * Form fields and actions: `@/components/ui` (`Input`, `Textarea`, `Select`, `Button`, `Checkbox`).
 */

export const styles = {
  step: 'flex flex-col gap-3',
  h2: 'm-0 text-[1.125rem] font-semibold text-slate-900',
  p: 'm-0 text-[0.9375rem] leading-[1.5] text-slate-400',
  pre: 'm-0 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[0.75rem] text-slate-600',
  label: 'flex flex-col gap-[0.35rem] text-[0.875rem] text-slate-600',
  /** Use `@/components/ui` `Checkbox` inside this row. */
  check: 'flex items-center gap-2 text-[0.875rem] text-slate-600',
  errBanner:
    'm-0 rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-[0.65rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]',
  actions: 'mt-2 flex flex-wrap items-center justify-between gap-4',
  back: 'text-[0.875rem] font-semibold text-primary no-underline hover:text-[var(--teal-800)]',
  danger:
    'self-start cursor-pointer border-none bg-none p-0 text-[0.8125rem] text-[var(--color-danger-text-emphasis)] underline',
  faqBlock:
    'flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4',
  faqHead: 'flex items-center justify-between gap-3',
  faqTitle: 'text-[0.875rem] font-semibold text-slate-900',
  faqRow:
    'flex flex-col gap-2 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0',
  code: 'rounded-md bg-slate-100 px-1 py-0.5 font-mono text-[0.8125em] text-slate-600',
} as const;
