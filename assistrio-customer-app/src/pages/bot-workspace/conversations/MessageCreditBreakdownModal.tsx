import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CustomerConversationMessage, CustomerConversationMessageCreditBreakdownRow } from '@/api/types';
import { Modal } from '@/components/ui';
import { formatConversationDateTimeDetailed } from '@/lib/conversationDateFormat';
import { chargedKindDisplay } from './conversationCreditBreakdown';
import { formatCreditAmount } from './conversationDisplayFormat';

type Props = {
  open: boolean;
  onClose: () => void;
  message: CustomerConversationMessage | null;
};

export function MessageCreditBreakdownModal({ open, onClose, message }: Props) {
  const rows = useMemo(() => {
    if (!message || (message.role ?? '').toLowerCase() !== 'user') return null;
    const raw = message.creditBreakdown;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out: CustomerConversationMessageCreditBreakdownRow[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const key = typeof row.key === 'string' ? row.key.trim() : '';
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      const count = typeof row.count === 'number' && Number.isFinite(row.count) ? row.count : NaN;
      const creditsEach = typeof row.creditsEach === 'number' && Number.isFinite(row.creditsEach) ? row.creditsEach : NaN;
      const creditsUsed = typeof row.creditsUsed === 'number' && Number.isFinite(row.creditsUsed) ? row.creditsUsed : NaN;
      if (row.billable !== true && row.billable !== false) continue;
      if (!key || !label || Number.isNaN(count) || Number.isNaN(creditsEach) || Number.isNaN(creditsUsed)) continue;
      out.push({ key, label, count, creditsEach, creditsUsed, billable: row.billable });
    }
    return out.length ? out : null;
  }, [message]);

  const body = message && (message.role ?? '').toLowerCase() === 'user' ? message : null;
  const dictationSessionsRaw = (body?.voiceMeta as { dictationSessionCount?: unknown } | undefined)?.dictationSessionCount;
  const dictationSessions =
    typeof dictationSessionsRaw === 'number' && Number.isFinite(dictationSessionsRaw)
      ? Math.round(dictationSessionsRaw)
      : null;

  const capturedAtFormatted = body?.createdAt ? formatConversationDateTimeDetailed(body.createdAt) : '—';

  const summaryRows: Array<{ label: string; value: ReactNode }> = body
    ? [
        { label: 'Total charged', value: <span className="tabular-nums">{formatCreditAmount(body.creditCost)}</span> },
        {
          label: 'Reason',
          value: chargedKindDisplay(body.creditReason),
        },
        { label: 'Captured at', value: capturedAtFormatted },
        {
          label: 'Dictation sessions',
          value: dictationSessions != null ? <span className="tabular-nums">{dictationSessions}</span> : '—',
        },
      ]
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Credit details"
      description="Values are stored billing fields only."
      closeOnBackdropClick
      allowDismiss
      size="md"
      bodyClassName="px-4 py-3 sm:px-5 sm:py-4"
    >
      {!body ? (
        <p className="m-0 text-sm text-slate-600">Select a visitor message.</p>
      ) : (
        <div className="space-y-4 text-[13px] leading-snug text-slate-800">
          <div>
            <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200/90">
              <table className="w-full border-collapse text-left text-[12px]">
                <tbody>
                  {summaryRows.map(({ label, value }) => (
                    <tr key={label} className="border-b border-slate-100 last:border-b-0">
                      <th
                        scope="row"
                        className="whitespace-nowrap bg-slate-50/95 px-2 py-2 font-medium text-slate-600 align-top w-[42%]"
                      >
                        {label}
                      </th>
                      <td className="px-2 py-2 align-top text-slate-900 min-w-0 break-words">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Line items</p>
            {rows?.length ? (
              <div className="max-h-[42vh] overflow-auto rounded-lg border border-slate-200/90">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 z-[1] border-b border-slate-200/90 bg-slate-50">
                    <tr>
                      <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700">Component</th>
                      <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700 text-right tabular-nums">
                        Count
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700 text-right tabular-nums">
                        Each
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700 text-right tabular-nums">
                        Credits
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-slate-100 last:border-b-0">
                        <td className="max-w-[10rem] break-words px-2 py-1.5 text-slate-900">{r.label}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">{r.count}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">{formatCreditAmount(r.creditsEach)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">{formatCreditAmount(r.creditsUsed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="m-0 text-[12px] italic text-slate-500">
                Breakdown unavailable for older message (only total credits were recorded).
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
