import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { CustomerConversationMessage } from '@/api/types';
import { Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatCreditAmount } from './conversationDisplayFormat';
import {
  buildConversationCreditBreakdown,
  type ConversationCreditBreakdownPayload,
  type ConversationCreditTableRowModel,
} from './conversationCreditBreakdown';

type Props = {
  open: boolean;
  onClose: () => void;
  conversationTotalCreditsUsed?: number;
  messages: CustomerConversationMessage[] | null;
};

function formatCostCell(v: number | null): string {
  if (v === null) return 'Unknown';
  if (!Number.isFinite(v)) return 'Unknown';
  return formatCreditAmount(v);
}

function BreakdownSummary({ payload, detailTotal }: { payload: ConversationCreditBreakdownPayload; detailTotal?: number }) {
  const detailKnown = typeof detailTotal === 'number' && Number.isFinite(detailTotal);
  const delta = detailKnown ? Math.abs(payload.totalFromMessages - (detailTotal as number)) : 0;
  const mismatched = detailKnown && delta > 1e-6;

  const row = (label: string, value: ReactNode) => (
    <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-0.5 text-[13px] leading-snug">
      <span className="shrink text-slate-600">{label}</span>
      <span className="min-w-0 text-right font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="space-y-2 border-b border-slate-200/80 pb-3">
      <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
      {row(
        'Total credits (conversation)',
        detailKnown ? formatCreditAmount(detailTotal!) : <span className="text-slate-500">—</span>,
      )}
      {row('Total credits (sum of loaded user messages)', formatCreditAmount(payload.totalFromMessages))}
      {mismatched ? (
        <p className="m-0 text-[11px] leading-snug text-amber-800">
          Loaded messages may not include the full transcript; summed credits can differ slightly from the conversation total until all
          turns are fetched.
        </p>
      ) : null}

      <div className="pt-2">
        <p className="m-0 mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">By stored credit reason</p>
        <div className="space-y-1">
          {payload.rollupByStoredReason.length ? (
            payload.rollupByStoredReason.map((r) => (
              <div key={r.label}>{row(`${r.label} (${r.messageCount})`, formatCreditAmount(r.credits))}</div>
            ))
          ) : (
            <p className="m-0 text-[12px] text-slate-500">No user messages in the loaded set.</p>
          )}
          <div className="pt-2">
            <p className="m-0 mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Totals from saved line-items (creditBreakdown)</p>
            {payload.rollupByBreakdownComponents.length ? (
              <div className="space-y-1">
                {payload.rollupByBreakdownComponents.map((c) => (
                  <div key={c.key}>{row(`${c.label} (units × rate rows: ${Math.round(c.billedUnits)})`, formatCreditAmount(c.creditsUsed))}</div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[12px] text-slate-500">No persisted breakdown rows in loaded messages (older traffic).</p>
            )}
          </div>
          {payload.attachmentOnlyMessageCount > 0 ? (
            <div>{row('Messages billed as attachment-only', payload.attachmentOnlyMessageCount)}</div>
          ) : null}
          {row('Messages that included attachments', payload.messagesWithAttachments)}
          {row('Total dictation sessions (stored on messages)', payload.totalDictationSessions)}
          {row('Not billable user messages (_not_billable)', payload.notBillableMessages)}
        </div>
      </div>

      {payload.quotaPeriods.length ? (
        <div className="pt-2">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Billing / quota periods (from messages)</p>
          <p className="m-0 text-[13px] text-slate-800">{payload.quotaPeriods.join(', ')}</p>
        </div>
      ) : null}
    </div>
  );
}

function BreakdownTable({ rows }: { rows: ConversationCreditTableRowModel[] }) {
  const head = ['Time', 'Charged kind', 'Credits', 'Dict.', 'Bd.', 'Att.', 'Reason', 'Preview'] as const;
  return (
    <div className="mt-4 min-h-0">
      <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Per-message (loaded)</p>
      <div className="mt-2 max-h-[42vh] overflow-auto rounded-lg border border-slate-200/90">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-[1] border-b border-slate-200/90 bg-slate-50">
            <tr>
              {head.map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-100 last:border-b-0">
                  <td className="align-top whitespace-nowrap px-2 py-1.5 text-slate-700">{r.timeAbsolute}</td>
                  <td className="align-top px-2 py-1.5 text-slate-900">{r.chargedKind}</td>
                  <td className="align-top whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-900">
                    <span className={cn(r.notBillable && 'text-slate-600')}>{formatCostCell(r.creditCost)}</span>
                  </td>
                  <td className="align-top whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-800">
                    {r.dictationSessions == null ? '—' : r.dictationSessions}
                  </td>
                  <td className="align-top whitespace-nowrap px-2 py-1.5 text-slate-800">{r.breakdownAvailable ? 'Yes' : 'No'}</td>
                  <td className="align-top whitespace-nowrap px-2 py-1.5 text-slate-800">{r.hadAttachment ? 'Yes' : 'No'}</td>
                  <td className="align-top break-all px-2 py-1.5 font-mono text-[10px] text-slate-600" title={r.creditReason}>
                    {r.creditReason ?? '—'}
                  </td>
                  <td className="align-top max-w-[12rem] break-words px-2 py-1.5 text-slate-700">{r.preview}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-slate-500">
                  No user messages with billing fields in this loaded window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConversationCreditBreakdownModal({ open, onClose, conversationTotalCreditsUsed, messages }: Props) {
  const payload = useMemo(() => buildConversationCreditBreakdown(messages), [messages]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Credit breakdown"
      description="Summaries use creditCost / creditReason from loaded messages only. New messages reflect updated billing classification; older rows stay as stored."
      closeOnBackdropClick
      allowDismiss
      size="lg"
      bodyClassName="px-4 py-3 sm:px-5 sm:py-4"
    >
      <BreakdownSummary payload={payload} detailTotal={conversationTotalCreditsUsed} />
      <BreakdownTable rows={payload.rows} />
    </Modal>
  );
}
