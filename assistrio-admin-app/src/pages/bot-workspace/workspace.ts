/**
 * Shared Tailwind class strings for workspace layout, tables, and banners.
 * Form controls: use `@/components/ui` (`Input`, `Textarea`, `Select`, `Button`, `Checkbox`).
 */

export const ws = {
  panel: 'max-w-[52rem]',
  workspacePageHead: 'mb-6',
  /** Same step as `workspaceEditorH1` — use for non-editor page titles. */
  workspacePageTitle:
    'mb-1.5 mt-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl',
  workspacePageLead: 'm-0 max-w-[42rem] text-sm leading-relaxed text-slate-400',

  /**
   * Bot workspace editors (Profile, Behavior, Leads Capture): one typographic scale.
   *
   * Modest sizes; clear steps: L1 → L2 → L3 → body.
   *
   * - L1 Page `h1`: `text-lg` / `sm:text-xl` — workspaceEditorH1
   * - L2 Card `h2`: `text-sm` / `sm:text-base` — workspaceEditorSectionTitle (always below L1)
   * - L3 Sub `h3`: `text-sm` medium slate-700 — workspaceEditorSubsectionTitle (under L2, not competing with H2)
   * - Lead / tab / section descriptions: `text-sm` muted — workspaceEditorLead, TabContext, SectionDescription
   * - UI labels: `text-sm` medium — workspaceEditorControlLabel
   * - Hints / preview meta: `text-xs` — workspaceEditorHelperText, ControlHint, Preview*
   * - Primary actions: `text-sm` semibold — workspaceEditorButtonLabel
   */
  workspaceEditorPageHeader:
    'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
  workspaceEditorTitleBlock: 'flex min-w-0 flex-col gap-2',
  /** Page title + lead */
  workspaceEditorHeadingStack: 'flex flex-col gap-1',
  /** L1 — Page `<h1>` */
  workspaceEditorH1:
    'm-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl',
  /** Lead under page title (same scale as tab context). */
  workspaceEditorLead: 'm-0 max-w-xl text-sm leading-relaxed text-slate-500',
  /** Full-width lead (e.g. Datasheets explainer spanning the content column). */
  workspaceEditorLeadFull: 'm-0 w-full max-w-none text-sm leading-relaxed text-slate-500',
  workspaceEditorSubnavSection: 'mb-6 space-y-2',
  workspaceEditorSubnavBar: 'min-w-0 border-b border-slate-200',
  /** Tab strip context line */
  workspaceEditorTabContext: 'm-0 text-sm leading-relaxed text-slate-500',
  /** L2 — Card section `<h2>` (below page h1, above body copy). */
  workspaceEditorSectionTitle:
    'm-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base',
  /** Muted copy under card section title */
  workspaceEditorSectionDescription: 'm-0 max-w-prose text-sm leading-relaxed text-slate-500',
  workspaceEditorSectionHeaderStack: 'space-y-1',
  /** L3 — Subsection inside a card (lighter than H2; same body size, different weight/color). */
  workspaceEditorSubsectionTitle:
    'm-0 text-sm font-medium leading-snug tracking-tight text-slate-700',
  /** Helper under pills, inline tips */
  workspaceEditorHelperText: 'm-0 text-xs leading-snug text-slate-500',
  workspaceEditorCardSection: 'min-w-0 space-y-4',
  workspaceEditorFieldStack: 'space-y-3',
  workspaceEditorControlLabel: 'block cursor-pointer text-sm font-medium leading-tight text-slate-900',
  workspaceEditorControlHint: 'm-0 mt-0.5 text-xs leading-snug text-slate-500',
  /** Compact grid field labels (e.g. capture field columns) */
  workspaceEditorFieldCaption:
    'block text-xs font-medium uppercase tracking-wide text-slate-500',
  /** Save / primary toolbar actions */
  workspaceEditorButtonLabel: 'text-sm font-semibold',

  /**
   * Knowledge base — shared `Button` sizing (use with `size="sm"`; overrides to `h-9` for alignment).
   * Covers form footers, modals, header CTAs, and pagination in playground/knowledgebase.
   */
  knowledgeFormActionsRow: 'flex flex-wrap items-center justify-end gap-2',
  knowledgeFormActionPrimary:
    'h-9 min-w-[9.5rem] gap-1.5 px-4 text-sm font-semibold shadow-sm',
  knowledgeFormActionSecondary: 'h-9 gap-1.5 px-4 text-sm font-medium',
  /** Detail page header: primary Edit */
  knowledgeDetailHeaderButtonPrimary: 'h-9 gap-1.5 px-4 text-sm font-semibold',
  /** Detail page header: secondary Delete (add danger text/hover classes in `cn` where needed) */
  knowledgeDetailHeaderButtonSecondary: 'h-9 gap-1.5 px-4 text-sm font-medium',
  knowledgeModalActionPrimary: 'h-9 min-w-[9.5rem] gap-1.5 px-4 text-sm font-semibold shadow-sm',
  knowledgeModalActionDanger: 'h-9 min-w-[9.5rem] gap-1.5 px-4 text-sm font-semibold',
  /** Knowledge list/doc pagination: match 32px control height (`Button` size `md` is h-8). */
  knowledgeListPaginationButton: 'max-h-8 gap-1 px-2.5 text-xs font-medium leading-none',
  /** Shared pagination + per-page bar (documents + Q&A / snippets / datasheets / suggestions). */
  knowledgeSourcesPaginationBar:
    'flex shrink-0 flex-col gap-2 border-t border-slate-200/80 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-2.5',
  knowledgeSourcesPaginationMuted: 'text-xs leading-none text-slate-500',
  /** Bulk selection bar (same vertical rhythm as form actions) */
  knowledgeBulkBarButton: 'h-7 gap-1 px-2.5 text-xs font-medium sm:h-8 sm:text-sm',
  /** Inline banners (error, info) */
  workspaceEditorBannerText: 'text-sm',
  /** `Input` / `Textarea` editor content (matches UI components) */
  workspaceEditorControlInput:
    'text-sm leading-relaxed text-slate-900 placeholder:text-slate-400',
  workspaceEditorCardGap: 'flex w-full min-w-0 flex-col gap-5',

  /**
   * Knowledge Sources list pages (Snippets, Q&A, Suggestions) — match `KnowledgeSection` shell:
   * outer flex column fills the playground column; inner `flex-1 pb-10` extends scroll height so bottom
   * inset is visible (avoid `h-full` on the same node as `pb-*`, which pins height and hides tail padding).
   */
  knowledgeSourcesPageRoot: 'flex min-h-0 w-full min-w-0 flex-1 flex-col',
  knowledgeSourcesPageBody: 'flex w-full min-w-0 flex-1 flex-col gap-6 px-0 pb-10',
  knowledgeSourcesAddCard:
    'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  knowledgeSourcesAddCardOverline: 'm-0 text-xs font-semibold uppercase tracking-wide text-slate-500',
  knowledgeSourcesAddCardFieldStack: 'mt-4 w-full min-w-0 space-y-5',
  /** Nested grouping inside add card (e.g. Suggestions chip vs scope). */
  knowledgeSourcesAddNestedPanel:
    'rounded-lg border border-slate-200/85 bg-slate-50/40 px-4 py-4 sm:px-5 sm:py-5',
  knowledgeSourcesAddNestedPanelInner: 'flex w-full min-w-0 flex-col gap-3',
  knowledgeSourcesListShell:
    'flex w-full min-w-0 flex-col rounded-xl border border-dashed border-slate-200/90 bg-white p-5 sm:p-6',
  knowledgeSourcesListControlsStack: 'mb-3 flex w-full min-w-0 shrink-0 flex-col gap-2',
  knowledgeSourcesListRowGap: 'm-0 flex w-full list-none flex-col gap-3 p-0 pb-2',
  /** Second workflow inside the same card as add (Suggestions: update picker). */
  knowledgeSourcesCardFollowOnSection: 'mt-6 w-full min-w-0 border-t border-slate-200/80 pt-6 space-y-5',

  /**
   * Paired fields: one column on small screens, two equal columns from `md`.
   * Use for compact selects / paired controls; wrap each field in `min-w-0`.
   */
  workspaceEditorFieldPairGrid:
    'grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 md:items-start',

  /** Full-width row inside `workspaceEditorFieldPairGrid` (spans both columns). */
  workspaceEditorFieldPairFullRow: 'min-w-0 md:col-span-2',

  /** Preview pane chrome (slightly smaller than editor; still readable). */
  workspaceEditorPreviewBarLabel:
    'max-w-full truncate rounded-md bg-white px-2.5 py-0.5 text-[0.625rem] font-medium leading-tight text-slate-500 ring-1 ring-slate-200/80',
  workspaceEditorPreviewChip:
    'inline-flex max-w-[10rem] items-center truncate rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/90',
  workspaceEditorPreviewChipAccent:
    'inline-flex items-center rounded-full bg-[var(--teal-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-teal-700)] ring-1 ring-[var(--teal-200)]',
  workspaceEditorPreviewOverline: 'm-0 text-xs font-semibold uppercase tracking-wide text-slate-400',
  workspaceEditorPreviewBody: 'm-0 text-sm leading-relaxed text-slate-800',
  workspaceEditorPreviewBubble:
    'mt-1 rounded-2xl rounded-tl-md border border-slate-200/90 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-sm',
  workspaceEditorPreviewQuiet: 'm-0 text-xs text-slate-500',
  workspaceEditorPreviewSuggestionChip:
    'inline-flex max-w-full items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm',
  workspaceEditorPreviewChipInline:
    'inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/90',
  workspaceEditorPreviewPillOn:
    'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/90',
  workspaceEditorPreviewPillOff:
    'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/80',
  workspaceEditorPreviewPillNeutral:
    'inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/90',

  loadingBox: 'py-8 px-4 text-center text-slate-400',
  errorBox: 'py-8 px-4 text-center text-[var(--color-danger-text-emphasis)]',
  emptyBox: 'py-8 px-4 text-center text-slate-400',

  spinner:
    'mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary',

  back: 'text-sm font-semibold text-primary no-underline hover:text-[var(--teal-800)]',

  surface: 'rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]',

  muted: 'mb-4 text-sm leading-[1.5] text-slate-400 last:mb-0',

  label: 'mb-[0.85rem] flex flex-col gap-[0.35rem] text-sm text-slate-600',
  danger:
    'cursor-pointer border-none bg-transparent text-sm text-[var(--color-danger-text-emphasis)] underline',

  success: 'mb-3 text-sm text-[var(--color-success-text)]',
  err: 'mb-3 text-sm text-[var(--color-danger-text-emphasis)]',

  bannerInfo:
    'mb-4 rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm text-[var(--color-info-text)]',
  bannerWarn:
    'mb-4 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning-text)]',

  badge: 'inline-block rounded-md px-[0.45rem] py-[0.15rem] text-xs font-semibold capitalize',
  badgeQueued: 'bg-[var(--color-info-accent-bg)] text-[var(--color-info-accent-text)]',
  badgeProcessing: 'bg-[var(--color-warning-strong-bg)] text-[var(--color-warning-strong-text)]',
  badgeReady: 'bg-[var(--color-success-fill)] text-[var(--color-success-text)]',
  badgeFailed: 'bg-[var(--color-danger-fill)] text-[var(--color-danger-text-emphasis)]',
  badgeUnknown: 'bg-slate-100 text-slate-600',
  badgeDraft: 'bg-[var(--color-warning-accent-bg)] text-[var(--color-warning-accent-text)]',
  badgePublished: 'bg-[var(--color-success-fill)] text-[var(--color-success-text)]',

  chip: 'inline-block rounded-full bg-slate-100 px-2 py-[0.2rem] text-xs text-slate-600',
  chips: 'mt-2 flex flex-wrap gap-[0.35rem]',

  mono: 'font-mono text-sm break-all',

  tableWrap: 'overflow-hidden rounded-[0.625rem] border border-slate-100 bg-white',
  table: 'w-full border-collapse text-sm',

  goLiveStack: 'mt-2 flex flex-col gap-5',
  goLiveCard: 'rounded-[0.625rem] border border-slate-100 bg-white p-[1.15rem_1.25rem]',
  goLiveCardTitle:
    'mb-2 mt-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base',
  goLiveCardLead: 'mb-3 text-sm leading-relaxed text-slate-400',

  statusChips: 'mb-3 flex flex-wrap gap-[0.35rem]',

  checklist: 'm-0 flex flex-col gap-2 p-0 list-none',
  checklistItem: 'flex items-start gap-2 text-sm leading-[1.4] text-slate-600',
  checklistIcon: 'w-5 shrink-0 text-center font-bold',
  checklistIconOk: 'text-[var(--color-success-text)]',
  checklistIconNo: 'text-slate-300',
  checklistHint: 'mt-0.5 block text-xs text-slate-400',

  nextSteps:
    'mt-3 rounded-md border border-[var(--teal-200)] bg-[var(--teal-50)] px-3 py-[0.65rem] text-sm text-[var(--teal-800)]',

  playgroundRow: 'mt-2 flex flex-wrap items-center gap-[0.65rem]',
  playgroundLink:
    'inline-flex items-center rounded-md border border-[var(--teal-200)] bg-white px-[0.65rem] py-[0.35rem] text-sm font-semibold text-primary no-underline transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--teal-600)_8%,transparent)]',

  copyRow: 'mt-[0.65rem] flex flex-wrap items-center gap-2',
  copyStatus: 'min-h-5 text-sm font-semibold text-[var(--color-success-text)]',

  knowledgePage: 'max-w-[56rem]',
  knowledgeHeader: 'mb-5',
  knowledgeTitle:
    'mb-1.5 mt-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl',
  knowledgeLead: 'm-0 max-w-[40rem] text-sm leading-relaxed text-slate-400',

  knowledgeTabs:
    'm-0 mb-6 flex flex-wrap gap-1 border-b border-slate-100 p-0',
  knowledgeTab:
    '-mb-px inline-flex items-center rounded-t-md border-b-2 border-transparent px-[0.85rem] py-2 text-sm font-medium text-slate-400 no-underline hover:bg-slate-50 hover:text-slate-900',
  knowledgeTabActive:
    'border-b-2 border-primary text-primary font-semibold bg-transparent',

  knowledgeSection: 'mb-7',
  knowledgeSectionTitle:
    'mb-2 mt-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base',
  knowledgeEmpty:
    'm-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm leading-relaxed text-slate-400',

  faqRow: 'mb-3 rounded-lg border border-slate-100 bg-white p-[0.85rem_0.9rem]',
  check: 'mb-3 flex items-center gap-2 text-sm text-slate-600',

  chat: 'mb-3 flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3',
  bubbleUser:
    'max-w-[92%] self-end rounded-lg bg-primary px-3 py-[0.55rem] text-sm leading-relaxed text-white',
  bubbleAsst:
    'max-w-[92%] self-start rounded-lg border border-slate-200 bg-white px-3 py-[0.55rem] text-sm leading-relaxed text-slate-900',
  chatComposer: 'flex items-end gap-2',

  sectionDivider: 'my-0 border-none border-t border-slate-100',
} as const;
