import { useMemo } from 'react';
import type { AdminConversationMessage } from '@/api/types';
import { formatAnalyticsAiCreditsLabel, formatAnalyticsCredits, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { Modal } from '@/components/ui';
import { AGENT_RESOURCES_USAGE_SERIES } from '@/pages/bot-workspace/analytics/agent-resources/agentResourcesUsageTrendTheme';
import {
  buildConversationCreditBreakdown,
  type ConversationCreditUsageModalityRowModel,
} from './conversationCreditBreakdown';

type Props = {
  open: boolean;
  onClose: () => void;
  messages: AdminConversationMessage[] | null;
};

function modalitySeriesMeta(usageType: ConversationCreditUsageModalityRowModel['usageType']): { label: string; color: string } {
  for (const s of AGENT_RESOURCES_USAGE_SERIES) {
    if ('mapsToUsageType' in s && s.mapsToUsageType === usageType) {
      return { label: s.label, color: s.color };
    }
  }
  return { label: usageType.replace(/_/g, ' '), color: '#64748b' };
}

function formatUsageFormulaLine(row: ConversationCreditUsageModalityRowModel): string {
  const qtyStr = formatAnalyticsInteger(row.quantity);
  const unitStr =
    row.quantity > 0 && row.creditsEach != null ? formatAnalyticsCredits(row.creditsEach) : row.quantity > 0 ? '—' : formatAnalyticsCredits(0);
  const creditsStr = formatAnalyticsCredits(row.creditsUsed);
  return `${qtyStr} ${row.noun} x ${unitStr} = ${creditsStr}`;
}

export function ConversationCreditBreakdownModal({ open, onClose, messages }: Props) {
  const payload = useMemo(() => buildConversationCreditBreakdown(messages), [messages]);

  const modalityCreditsSum = useMemo(
    () => payload.usageModalityRows.reduce((sum, row) => sum + row.creditsUsed, 0),
    [payload.usageModalityRows],
  );

  const modalityTotalsMismatch = Math.abs(modalityCreditsSum - payload.totalFromMessages) > 0.005;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Credit details"
      description="Credits from visitor messages loaded in Insights."
      closeOnBackdropClick
      allowDismiss
      size="lg"
      bodyClassName="px-4 py-3 sm:px-5 sm:py-4"
    >
      <div className="space-y-5">
        <div className="shrink-0">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Avg AI Credits / message</p>
          <p className="m-0 mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
            {payload.averageCreditsPerVisitorMessage != null
              ? formatAnalyticsAiCreditsLabel(payload.averageCreditsPerVisitorMessage)
              : '—'}
          </p>
        </div>

        <div className="border-b border-slate-200/90" role="presentation" />

        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usage breakdown</h3>
          <p className="m-0 text-[11px] font-medium tabular-nums leading-snug text-slate-500">
            {payload.usageSidebarUsesBreakdownAttribution ? 'Transaction × Cost = AI Credits Usage' : 'Messages × cost'}
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <ul
            className="m-0 flex list-none flex-col gap-1 space-y-0 py-0.5 pr-0.5"
            aria-label="Credit usage split by text, voice, and dictation"
          >
            {payload.usageModalityRows.map((row) => {
              const meta = modalitySeriesMeta(row.usageType);
              const detailLine = formatUsageFormulaLine(row);
              return (
                <li key={row.usageType}>
                  <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-transparent px-2 py-1.5 text-left sm:flex-nowrap sm:justify-between">
                    <div className="flex max-w-[min(100%,11rem)] shrink-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-xs font-semibold leading-snug text-slate-900">{meta.label}</span>
                    </div>
                    <div className="min-w-0 flex-1 text-right sm:min-w-[12rem]">
                      <span className="inline-block max-w-full text-xs font-normal tabular-nums leading-snug text-slate-900 break-words">
                        {detailLine}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
            <li className="mt-2 border-t border-slate-200/90 pt-2">
              <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-transparent px-2 py-1.5 text-left sm:flex-nowrap sm:justify-between">
                <div className="flex max-w-[min(100%,11rem)] shrink-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full ring-2 ring-teal-100/90"
                    style={{
                      backgroundColor:
                        AGENT_RESOURCES_USAGE_SERIES.find((s) => s.id === 'totalCreditsUsed')?.color ?? '#0d9488',
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-xs font-semibold leading-snug text-slate-900">Total Usage</span>
                </div>
                <div className="min-w-0 flex-1 text-right sm:min-w-[12rem]">
                  <span className="inline-flex min-w-0 flex-wrap items-baseline justify-end gap-x-1 tabular-nums">
                    <span className="font-normal leading-none text-slate-400 select-none" aria-hidden>
                      =
                    </span>
                    <span className="text-xs font-normal leading-snug text-slate-900">
                      {formatAnalyticsAiCreditsLabel(payload.totalFromMessages)}
                    </span>
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </div>

        {modalityTotalsMismatch ? (
          <p className="m-0 text-[10px] leading-snug text-slate-500">
            Rows above may not add up to the total when billing is composite or older messages omit saved modality rows.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
