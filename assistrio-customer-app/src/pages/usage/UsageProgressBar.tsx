import { KnowledgeUsageMeterBar } from '@/components/knowledge/KnowledgeUsageMeterBar';

type Props = {
  percent: number;
  ariaLabel: string;
  tone?: 'default' | 'warning' | 'danger';
  heightClass?: string;
};

export function UsageProgressBar({
  percent,
  ariaLabel,
  tone = 'default',
  heightClass = 'h-2.5',
}: Props) {
  const pct = Math.min(100, Math.max(0, percent));
  const fillClass =
    tone === 'danger' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-teal-600';

  return (
    <KnowledgeUsageMeterBar
      percent={pct}
      heightClass={heightClass}
      fillClassName={fillClass}
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pct)}
    />
  );
}
