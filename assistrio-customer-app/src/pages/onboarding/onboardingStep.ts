/**
 * Onboarding layout typography and structure.
 */

export const styles = {
  errBanner:
    'm-0 rounded-[var(--radius-lg)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[0.875rem] text-[var(--color-danger-text-emphasis)]',
  helperCard:
    'rounded-[var(--radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-3.5',
  helperCardTitle: 'm-0 text-[0.8125rem] font-semibold text-[var(--color-text-primary)]',
  helperCardText: 'm-0 mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--color-text-secondary)]',
  helperCardList:
    'm-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[0.8125rem] text-[var(--color-text-secondary)]',
  infoBanner:
    'm-0 rounded-[var(--radius-lg)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--color-warning-text)]',
  successBanner:
    'rounded-[var(--radius-xl)] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3.5 text-[0.875rem] text-[var(--color-success-text)]',
  knowledgePanel: 'pt-1',
  formFields: 'onboarding-form-fields',
  formGroup: 'onboarding-form-group',
  formGroupHeader: 'onboarding-form-group-header',
  formGroupTitle: 'onboarding-form-group-title',
  formSectionHeading: 'onboarding-form-section-heading',
  formGroupHint: 'onboarding-form-group-hint',
  formGroupBody: 'onboarding-form-group-body',
  formDivider: 'onboarding-form-divider',
  sectionCard:
    'rounded-[var(--radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/60 p-4 sm:p-5',
  sectionTitle: 'm-0 text-[0.9375rem] font-semibold text-[var(--color-text-primary)]',
  sectionHint: 'm-0 mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-text-secondary)]',
  sectionBody: 'mt-4 flex flex-col gap-4',
  pre: 'm-0 overflow-auto rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3 text-[0.75rem] text-[var(--color-text-secondary)]',
  code: 'rounded-md bg-slate-100 px-1 py-0.5 font-mono text-[0.8125em] text-[var(--color-text-secondary)]',
} as const;
