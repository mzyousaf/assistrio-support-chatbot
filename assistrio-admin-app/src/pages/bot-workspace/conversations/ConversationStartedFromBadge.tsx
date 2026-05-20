import { cn } from '@/lib/utils';
import { widgetStartedFromUiLabel } from '@/pages/bot-workspace/analytics/shared/widgetChannelLabels';

/** Readable widget channel for panel titles and CSV (not raw enum). */
export function formatStartedFromLabel(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return '';
  return widgetStartedFromUiLabel(t);
}

type Props = { startedFrom: string | null | undefined; className?: string };

export function ConversationStartedFromBadge({ startedFrom, className }: Props) {
  const raw = startedFrom?.trim();
  if (!raw) return null;
  const label = widgetStartedFromUiLabel(raw);
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-md border border-slate-200/90 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-slate-700',
        className,
      )}
      title={raw}
    >
      {label}
    </span>
  );
}
