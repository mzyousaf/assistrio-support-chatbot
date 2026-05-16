import { Signal } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  SOURCE_SCORE_MISSING_TOOLTIP,
  confidenceSignalPillStyle,
  formatSourceConfidenceScore,
  retrievalScoreToConfidencePercent,
} from './formatSourceConfidenceScore';

const CONFIDENCE_TOOLTIP_LABEL = 'Confidence Score';

export const retrievalConfidencePillClasses =
  'inline-flex shrink-0 items-center gap-1 rounded-md border-0 px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm transition hover:brightness-110 active:brightness-95 disabled:pointer-events-none disabled:opacity-40';

type Props = {
  score?: number;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function AssistantRetrievalConfidencePill({ score, onClick, disabled, className }: Props) {
  const fmt = formatSourceConfidenceScore(score);
  const scoreLabel = fmt?.matchLabel ?? null;
  const pct =
    score != null && typeof score === 'number' && Number.isFinite(score)
      ? retrievalScoreToConfidencePercent(score)
      : NaN;
  const hasNumericScore = scoreLabel != null && Number.isFinite(pct);
  const pillBg = hasNumericScore ? confidenceSignalPillStyle(pct) : null;
  const fallbackBg = { backgroundColor: 'hsl(215, 14%, 42%)', color: '#fff' };
  const tip = fmt?.confidenceTitle ?? SOURCE_SCORE_MISSING_TOOLTIP;

  const style =
    pillBg ? { backgroundColor: pillBg.backgroundColor, color: '#fff' as const } : { ...fallbackBg };

  const body = (
    <>
      <Signal size={14} className="shrink-0 text-white" strokeWidth={2} aria-hidden />
      <span className="text-white">{hasNumericScore ? scoreLabel : '—'}</span>
    </>
  );

  if (onClick) {
    return (
      <Tooltip content={tip} side="top" panelClassName="max-w-xs text-xs">
        <button
          type="button"
          disabled={disabled}
          aria-label={
            hasNumericScore ? `${CONFIDENCE_TOOLTIP_LABEL} ${scoreLabel}` : 'Confidence Score not available'
          }
          className={cn(retrievalConfidencePillClasses, 'text-white', className)}
          style={style}
          onClick={onClick}
        >
          {body}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tip} side="top" panelClassName="max-w-xs text-xs">
      <span
        className={cn(retrievalConfidencePillClasses, 'cursor-default text-white', className)}
        style={style}
        aria-label={
          hasNumericScore ? `${CONFIDENCE_TOOLTIP_LABEL} ${scoreLabel}` : 'Confidence Score not available'
        }
      >
        {body}
      </span>
    </Tooltip>
  );
}
