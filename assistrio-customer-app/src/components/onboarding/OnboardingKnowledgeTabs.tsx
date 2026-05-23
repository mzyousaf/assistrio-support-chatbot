import { cn } from '@/lib/utils';

export type OnboardingKnowledgeTabId = 'file' | 'snippet' | 'qa' | 'datasheet';

export type OnboardingKnowledgeTabCounts = {
  file: number;
  snippet: number;
  qa: number;
  datasheet: number;
};

type TabDef = {
  id: OnboardingKnowledgeTabId;
  label: string;
  countKey: keyof OnboardingKnowledgeTabCounts;
};

const TABS: TabDef[] = [
  { id: 'file', label: 'Documents', countKey: 'file' },
  { id: 'qa', label: 'Q&A', countKey: 'qa' },
  { id: 'snippet', label: 'Snippets', countKey: 'snippet' },
  { id: 'datasheet', label: 'Datasheets', countKey: 'datasheet' },
];

type Props = {
  value: OnboardingKnowledgeTabId;
  onChange: (tab: OnboardingKnowledgeTabId) => void;
  counts: OnboardingKnowledgeTabCounts;
  disabled?: boolean;
  className?: string;
};

export function OnboardingKnowledgeTabs({ value, onChange, counts, disabled, className }: Props) {
  return (
    <div
      className={cn(
        'knowledge-tabs flex w-full flex-wrap gap-x-0.5 gap-y-0 border-b border-[var(--ui-border)]',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      role="tablist"
      aria-label="Knowledge source type"
    >
      {TABS.map((t) => {
        const selected = value === t.id;
        const count = counts[t.countKey];
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px box-border inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.8125rem] font-semibold transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ui-border)]',
              selected
                ? 'border-[var(--color-teal-600)] text-[var(--color-teal-700)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--ui-border)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {t.label}
            {count > 0 ? (
              <span
                className={cn(
                  'inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold leading-none tabular-nums',
                  selected
                    ? 'bg-[var(--color-teal-600)] text-white'
                    : 'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--color-text-secondary)]',
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
