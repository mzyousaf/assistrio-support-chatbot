import { Sparkles } from 'lucide-react';
import type { AdminConversationMessageCreditBreakdownRow } from '@/api/types';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { chatLogListChipClass } from './conversationTopicSentimentDisplay';
import { breakdownRowVisitorLabel } from './creditBreakdownDisplay';

function isBillableBlockedReason(reason: string): boolean {
  return reason.trim().toLowerCase().endsWith('_not_billable');
}

/** Footer shows persisted billing when totals, breakdown rows, or a creditReason fingerprint exist. */
export function shouldShowMessageCreditBadge(
  creditCost?: number,
  creditReason?: string,
  creditBreakdown?: AdminConversationMessageCreditBreakdownRow[] | null,
): boolean {
  if (Array.isArray(creditBreakdown) && creditBreakdown.length > 0) return true;
  if (typeof creditCost === 'number' && Number.isFinite(creditCost)) return true;
  return Boolean(String(creditReason ?? '').trim());
}

function formatSpendLabel(cost: number, creditReason?: string): string {
  const rr = String(creditReason ?? '').trim();
  if (!Number.isFinite(cost)) return 'Unknown billing';
  if (cost !== 0) {
    const n = cost % 1 === 0 ? String(Math.round(cost)) : String(cost);
    return cost === 1 ? `${n} AI Credit` : `${n} AI Credits`;
  }
  if (rr && isBillableBlockedReason(rr)) return 'Not billable';
  return `${cost % 1 === 0 ? String(Math.round(cost)) : String(cost)} AI Credits`;
}

export const CREDITS_USAGE_TOOLTIP_TITLE = 'Credits usage';

export function creditBreakdownTooltipLines(
  rows: AdminConversationMessageCreditBreakdownRow[],
): string[] {
  return rows.map((r) => {
    const n = r.creditsUsed % 1 === 0 ? String(Math.round(r.creditsUsed)) : String(r.creditsUsed);
    const lab = breakdownRowVisitorLabel(r);
    return `${lab}: ${n}`;
  });
}

/** Plain-text tooltip for native `title` (e.g. chat log list chips). */
export function creditBreakdownTooltipText(
  rows: AdminConversationMessageCreditBreakdownRow[],
): string | undefined {
  const lines = creditBreakdownTooltipLines(rows);
  if (!lines.length) return undefined;
  return [CREDITS_USAGE_TOOLTIP_TITLE, ...lines].join('\n');
}

type Props = {
  creditCost?: number;
  creditReason?: string;
  creditBreakdown?: AdminConversationMessageCreditBreakdownRow[] | null;
  className?: string;
  /** Match neutral chip styling used in Insights chat logs. */
  chatLogList?: boolean;
};

export function MessageCreditBadge({
  creditCost,
  creditReason,
  creditBreakdown,
  className,
  chatLogList,
}: Props) {
  const reasonStr = String(creditReason ?? '').trim();
  const costKnown = typeof creditCost === 'number' && Number.isFinite(creditCost);
  if (!costKnown && !reasonStr && !(creditBreakdown && creditBreakdown.length)) return null;

  const finiteCost = costKnown ? creditCost! : 0;
  const label = costKnown ? formatSpendLabel(finiteCost, reasonStr) : 'Unknown billing';
  const muted = label === 'Not billable' || label === 'Unknown billing';

  const breakdownRows = Array.isArray(creditBreakdown) ? creditBreakdown : [];
  const breakdownLines = creditBreakdownTooltipLines(breakdownRows);
  const breakdownTooltip = creditBreakdownTooltipText(breakdownRows);

  if (chatLogList) {
    return (
      <span
        title={breakdownTooltip}
        className={cn(
          chatLogListChipClass,
          muted ? 'border-slate-200/85 text-slate-600' : 'text-slate-800',
          className,
        )}
      >
        <Sparkles className={cn('size-3 shrink-0', muted ? 'text-slate-500' : 'text-teal-600')} strokeWidth={2} aria-hidden />
        <span className="tabular-nums">{label}</span>
      </span>
    );
  }

  const badge = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight shadow-sm',
        muted
          ? 'border-slate-300/95 bg-slate-50 text-slate-700'
          : 'border-[var(--color-teal-600)] bg-[var(--teal-50)] text-[var(--color-teal-800)]',
        className,
      )}
    >
      <Sparkles className={cn('size-3 shrink-0', muted ? 'text-slate-500' : 'text-[var(--color-teal-600)]')} strokeWidth={2} aria-hidden />
      <span className="tabular-nums">{label}</span>
    </span>
  );

  if (breakdownLines.length) {
    return (
      <Tooltip
        side="top"
        panelClassName="max-w-xs text-left text-xs"
        content={
          <>
            <span className="text-slate-400">{CREDITS_USAGE_TOOLTIP_TITLE}</span>
            <span className="mt-1 block space-y-0.5 font-medium text-slate-50">
              {breakdownLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
          </>
        }
      >
        <span className="inline-flex min-w-0">{badge}</span>
      </Tooltip>
    );
  }

  return badge;
}
