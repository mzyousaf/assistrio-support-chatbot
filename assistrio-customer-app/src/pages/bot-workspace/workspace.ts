/**
 * Shared Tailwind class strings for workspace layout, tables, and banners.
 * Form controls: use `@/components/ui` (`Input`, `Textarea`, `Select`, `Button`, `Checkbox`).
 */

export const ws = {
  panel: 'max-w-[52rem]',
  workspacePageHead: 'mb-6',
  workspacePageTitle: 'mb-1.5 mt-0 text-[1.25rem] font-semibold tracking-tight text-slate-900',
  workspacePageLead: 'm-0 max-w-[42rem] text-[0.9375rem] leading-[1.55] text-slate-400',

  loadingBox: 'py-8 px-4 text-center text-slate-400',
  errorBox: 'py-8 px-4 text-center text-[var(--color-danger-text-emphasis)]',
  emptyBox: 'py-8 px-4 text-center text-slate-400',

  spinner:
    'mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary',

  back: 'text-[0.875rem] font-semibold text-primary no-underline hover:text-[var(--teal-800)]',

  surface: 'rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]',

  muted: 'mb-4 text-[0.9375rem] leading-[1.5] text-slate-400 last:mb-0',

  label:
    'mb-[0.85rem] flex flex-col gap-[0.35rem] text-[0.875rem] text-slate-600',
  danger:
    'cursor-pointer border-none bg-transparent text-[0.8125rem] text-[var(--color-danger-text-emphasis)] underline',

  success: 'mb-3 text-[0.875rem] text-[var(--color-success-text)]',
  err: 'mb-3 text-[0.875rem] text-[var(--color-danger-text-emphasis)]',

  bannerInfo:
    'mb-4 rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-[0.875rem] text-[var(--color-info-text)]',
  bannerWarn:
    'mb-4 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-[0.875rem] text-[var(--color-warning-text)]',

  badge: 'inline-block rounded-md px-[0.45rem] py-[0.15rem] text-[0.75rem] font-semibold capitalize',
  badgeQueued: 'bg-[var(--color-info-accent-bg)] text-[var(--color-info-accent-text)]',
  badgeProcessing: 'bg-[var(--color-warning-strong-bg)] text-[var(--color-warning-strong-text)]',
  badgeReady: 'bg-[var(--color-success-fill)] text-[var(--color-success-text)]',
  badgeFailed: 'bg-[var(--color-danger-fill)] text-[var(--color-danger-text-emphasis)]',
  badgeUnknown: 'bg-slate-100 text-slate-600',
  badgeDraft: 'bg-[var(--color-warning-accent-bg)] text-[var(--color-warning-accent-text)]',
  badgePublished: 'bg-[var(--color-success-fill)] text-[var(--color-success-text)]',

  chip: 'inline-block rounded-full bg-slate-100 px-2 py-[0.2rem] text-[0.75rem] text-slate-600',
  chips: 'mt-2 flex flex-wrap gap-[0.35rem]',

  mono: 'font-mono text-[0.8125rem] break-all',

  tableWrap: 'overflow-hidden rounded-[0.625rem] border border-slate-100 bg-white',
  table: 'w-full border-collapse text-[0.875rem]',

  goLiveStack: 'mt-2 flex flex-col gap-5',
  goLiveCard: 'rounded-[0.625rem] border border-slate-100 bg-white p-[1.15rem_1.25rem]',
  goLiveCardTitle: 'mb-2 mt-0 text-[0.9375rem] font-semibold text-slate-900',
  goLiveCardLead: 'mb-3 text-[0.875rem] leading-[1.45] text-slate-400',

  statusChips: 'mb-3 flex flex-wrap gap-[0.35rem]',

  checklist: 'm-0 flex flex-col gap-2 p-0 list-none',
  checklistItem: 'flex items-start gap-2 text-[0.875rem] leading-[1.4] text-slate-600',
  checklistIcon: 'w-5 shrink-0 text-center font-bold',
  checklistIconOk: 'text-[var(--color-success-text)]',
  checklistIconNo: 'text-slate-300',
  checklistHint: 'mt-0.5 block text-[0.8125rem] text-slate-400',

  nextSteps:
    'mt-3 rounded-md border border-[var(--teal-200)] bg-[var(--teal-50)] px-3 py-[0.65rem] text-[0.875rem] text-[var(--teal-800)]',

  playgroundRow: 'mt-2 flex flex-wrap items-center gap-[0.65rem]',
  playgroundLink:
    'inline-flex items-center rounded-md border border-[var(--teal-200)] bg-white px-[0.65rem] py-[0.35rem] text-[0.875rem] font-semibold text-primary no-underline transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--teal-600)_8%,transparent)]',

  copyRow: 'mt-[0.65rem] flex flex-wrap items-center gap-2',
  copyStatus: 'min-h-5 text-[0.8125rem] font-semibold text-[var(--color-success-text)]',

  knowledgePage: 'max-w-[56rem]',
  knowledgeHeader: 'mb-5',
  knowledgeTitle: 'mb-1.5 mt-0 text-[1.25rem] font-semibold tracking-tight text-slate-900',
  knowledgeLead: 'm-0 max-w-[40rem] text-[0.9375rem] leading-[1.55] text-slate-400',

  knowledgeTabs:
    'm-0 mb-6 flex flex-wrap gap-1 border-b border-slate-100 p-0',
  knowledgeTab:
    '-mb-px inline-flex items-center rounded-t-md border-b-2 border-transparent px-[0.85rem] py-2 text-[0.875rem] font-medium text-slate-400 no-underline hover:bg-slate-50 hover:text-slate-900',
  knowledgeTabActive:
    'border-b-2 border-primary text-primary font-semibold bg-transparent',

  knowledgeSection: 'mb-7',
  knowledgeSectionTitle: 'mb-2 mt-0 text-[0.9375rem] font-semibold text-slate-900',
  knowledgeEmpty:
    'm-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-[0.9375rem] leading-[1.5] text-slate-400',

  faqRow: 'mb-3 rounded-lg border border-slate-100 bg-white p-[0.85rem_0.9rem]',
  check: 'mb-3 flex items-center gap-2 text-[0.875rem] text-slate-600',

  chat: 'mb-3 flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3',
  bubbleUser:
    'max-w-[92%] self-end rounded-lg bg-primary px-3 py-[0.55rem] text-[0.9375rem] leading-[1.45] text-white',
  bubbleAsst:
    'max-w-[92%] self-start rounded-lg border border-slate-200 bg-white px-3 py-[0.55rem] text-[0.9375rem] leading-[1.45] text-slate-900',
  chatComposer: 'flex items-end gap-2',

  sectionDivider: 'my-0 border-none border-t border-slate-100',
} as const;
