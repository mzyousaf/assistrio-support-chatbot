import { cn } from '@/lib/utils';
import { isBehaviourAsDataSourceScore } from './formatSourceConfidenceScore';

function headlineForSourceType(raw: string | undefined): string {
  const t = String(raw ?? '').trim();
  if (!t) return 'Source';
  const lower = t.toLowerCase();
  if (lower === 'faq') return 'Q&A';
  if (lower === 'note') return 'Snippet';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Props = {
  sourceType?: string;
  retrievalScore?: number | null;
  /** When false, weak-match scores do not relabel the badge as “Behaviour” (e.g. “Other sources” list). Default true. */
  applyWeakScoreBehaviour?: boolean;
  className?: string;
};

export function AssistantSourceTypeBadge({
  sourceType,
  retrievalScore,
  applyWeakScoreBehaviour = true,
  className,
}: Props) {
  const behaviour = applyWeakScoreBehaviour && isBehaviourAsDataSourceScore(retrievalScore);
  const typeLabel = headlineForSourceType(sourceType);
  const label = behaviour ? 'Behaviour' : typeLabel;
  const originalSuffix =
    behaviour && sourceType?.trim() ? ` · ${typeLabel}` : '';
  const title = behaviour
    ? `Behaviour as data source${originalSuffix}`
    : typeLabel;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-[10rem] shrink-0 truncate rounded border border-slate-200/90 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm',
        className,
      )}
    >
      {label}
    </span>
  );
}
