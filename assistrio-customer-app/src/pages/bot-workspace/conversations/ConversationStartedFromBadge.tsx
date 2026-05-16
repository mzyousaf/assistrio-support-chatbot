import { cn } from '@/lib/utils';

const BADGE_LABELS: Record<string, string> = {
  playground_preview: 'Playground',
  shared_preview: 'Shared preview',
  runtime_widget: 'Widget',
  runtime_iframe: 'IFrame',
  unknown: 'Unknown',
};

const TITLE_LABELS: Record<string, string> = {
  playground_preview: 'Playground',
  shared_preview: 'Shared preview',
  runtime_widget: 'Runtime widget',
  runtime_iframe: 'Runtime IFrame',
  unknown: 'Unknown',
};

/** Readable label for panel titles (not raw enum). */
export function formatStartedFromLabel(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return '';
  return TITLE_LABELS[t] ?? t.replace(/_/g, ' ');
}

type Props = { startedFrom: string | null | undefined; className?: string };

export function ConversationStartedFromBadge({ startedFrom, className }: Props) {
  const raw = startedFrom?.trim();
  if (!raw) return null;
  const label = BADGE_LABELS[raw] ?? raw.replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-md border border-slate-200/90 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600',
        className,
      )}
      title={raw}
    >
      {label}
    </span>
  );
}
