import type { CustomerConversationMessage, CustomerConversationMessageCreditBreakdownRow } from '@/api/types';
import { formatConversationAbsolute } from '@/lib/conversationDateFormat';
import { conversationMessageBodyText } from './conversationMessageText';

const BASIS_LABEL: Record<string, string> = {
  text_message: 'Text message',
  voice_message: 'Voice message',
  dictation_session: 'Dictation sessions',
  dictation_message: 'Dictation message',
  suggested_question_message: 'Text message',
  quick_reply_message: 'Quick reply — not billable',
  attachment_message: 'Attachment — not billable',
  unknown_message: 'Unknown — not billable',
};

function normalizeCreditBasis(creditReason?: string): string | null {
  const r = String(creditReason ?? '').trim();
  if (!r) return null;
  if (r.startsWith('composite:')) {
    const inner = r.slice('composite:'.length).trim();
    return inner.replace(/[+]/g, ',');
  }
  return r.replace(/_not_billable$/i, '').replace(/^_+/, '').toLowerCase();
}

/** Human-readable charged kind from persisted `creditReason` (fallback when no persisted breakdown rows). */
export function chargedKindDisplay(creditReason?: string): string {
  const raw = String(creditReason ?? '').trim();
  if (raw.startsWith('composite:')) {
    const parts = raw.slice('composite:'.length).split('+').filter(Boolean).map((p) => BASIS_LABEL[p] ?? p.replace(/_/g, ' '));
    return parts.length ? parts.join(' + ') : 'Composite charge';
  }
  const base = normalizeCreditBasis(creditReason);
  if (!base) return 'Unknown';
  return BASIS_LABEL[base] ?? base.replace(/_message$/i, '').replace(/_/g, ' ');
}

function finiteCredit(cost: unknown): number | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  return cost;
}

function parseBreakdown(raw: CustomerConversationMessage['creditBreakdown']): CustomerConversationMessageCreditBreakdownRow[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: CustomerConversationMessageCreditBreakdownRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const key = typeof row.key === 'string' ? row.key.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const count = typeof row.count === 'number' && Number.isFinite(row.count) ? row.count : NaN;
    const creditsEach = typeof row.creditsEach === 'number' && Number.isFinite(row.creditsEach) ? row.creditsEach : NaN;
    const creditsUsedRow = typeof row.creditsUsed === 'number' && Number.isFinite(row.creditsUsed) ? row.creditsUsed : NaN;
    let billable: boolean;
    if (row.billable === true || row.billable === false) billable = row.billable;
    else continue;
    if (!key || !label || Number.isNaN(count) || Number.isNaN(creditsEach) || Number.isNaN(creditsUsedRow)) continue;
    out.push({ key, label, count, creditsEach, creditsUsed: creditsUsedRow, billable });
  }
  return out.length ? out : undefined;
}

export type ConversationCreditTableRowModel = {
  key: string;
  timeAbsolute: string;
  chargedKind: string;
  creditCost: number | null;
  creditReason?: string;
  breakdownAvailable: boolean;
  hadAttachment: boolean;
  dictationSessions: number | null;
  preview: string;
  notBillable: boolean;
};

export type ConversationCreditAggregateRow = {
  label: string;
  messageCount: number;
  credits: number;
};

export type BreakdownComponentTotalsRowModel = {
  key: string;
  label: string;
  billedUnits: number;
  creditsUsed: number;
};

export type ConversationCreditBreakdownPayload = {
  totalFromMessages: number;
  rollupByStoredReason: ConversationCreditAggregateRow[];
  rollupByBreakdownComponents: BreakdownComponentTotalsRowModel[];
  messagesWithAttachments: number;
  totalDictationSessions: number;
  attachmentOnlyMessageCount: number;
  notBillableMessages: number;
  quotaPeriods: string[];
  rows: ConversationCreditTableRowModel[];
};

function shortenPreview(raw: string, max = 56): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Display-only rollup from persisted message fields (`creditBreakdown` when present, else totals only). Never applies pricing formulas. */
export function buildConversationCreditBreakdown(messages: CustomerConversationMessage[] | null | undefined): ConversationCreditBreakdownPayload {
  const userRows = (messages ?? []).filter((m) => (m.role ?? '').toLowerCase() === 'user');

  const rollupReasonMap = new Map<string, { count: number; credits: number; label: string }>();
  const componentMap = new Map<string, BreakdownComponentTotalsRowModel>();

  let totalFromMessages = 0;
  let messagesWithAttachments = 0;
  let attachmentOnlyMessageCount = 0;
  let notBillableMessages = 0;
  let totalDictationSessions = 0;
  const quota = new Set<string>();

  const tableRows: ConversationCreditTableRowModel[] = [];

  for (let i = 0; i < userRows.length; i += 1) {
    const m = userRows[i];
    const hadAttachment = Boolean(m.attachments?.length);
    if (hadAttachment) messagesWithAttachments += 1;

    const pq = typeof m.quotaPeriod === 'string' ? m.quotaPeriod.trim() : '';
    if (pq) quota.add(pq);

    const cost = finiteCredit(m.creditCost);
    totalFromMessages += cost ?? 0;

    const reasonRaw = typeof m.creditReason === 'string' ? m.creditReason.trim() : '';
    const rawBasis = normalizeCreditBasis(reasonRaw) ?? 'unknown_message';
    const basisKey = rawBasis === 'suggested_question_message' ? 'text_message' : rawBasis;
    const kindLabel = basisKey === 'text_message' ? 'Text message' : chargedKindDisplay(reasonRaw);
    const preview = shortenPreview(conversationMessageBodyText(m));

    const notBillable = /_not_billable$/i.test(reasonRaw);
    if (notBillable) notBillableMessages += 1;

    const breakdown = parseBreakdown(m.creditBreakdown);
    let dictationSessions: number | null = null;
    const dsRaw = (m.voiceMeta as { dictationSessionCount?: unknown } | undefined)?.dictationSessionCount;
    if (typeof dsRaw === 'number' && Number.isFinite(dsRaw)) {
      dictationSessions = Math.max(0, Math.round(dsRaw));
      totalDictationSessions += dictationSessions;
    }

    if (basisKey === 'attachment_message' || reasonRaw === 'attachment_message_not_billable') attachmentOnlyMessageCount += 1;

    const cur = rollupReasonMap.get(basisKey);
    const rowCredits = cost ?? 0;
    if (!cur) {
      rollupReasonMap.set(basisKey, { count: 1, credits: rowCredits, label: kindLabel });
    } else {
      cur.count += 1;
      cur.credits += rowCredits;
      cur.label = kindLabel;
    }

    if (breakdown) {
      for (const row of breakdown) {
        const canonKey = row.key === 'suggested_question_message' ? 'text_message' : row.key;
        const creditsUsed = typeof row.creditsUsed === 'number' && Number.isFinite(row.creditsUsed) ? row.creditsUsed : 0;
        const billedUnits = typeof row.count === 'number' && Number.isFinite(row.count) ? row.count : 0;
        const label =
          canonKey === 'text_message'
            ? 'Text message'
            : row.label || BASIS_LABEL[row.key] || row.key;
        const curC = componentMap.get(canonKey);
        if (!curC) componentMap.set(canonKey, { key: canonKey, label, billedUnits: 0, creditsUsed: 0 });
        const slot = componentMap.get(canonKey)!;
        slot.label = label;
        slot.billedUnits += billedUnits;
        slot.creditsUsed += creditsUsed;
      }
    }

    tableRows.push({
      key: m.messageId || m.id || `${m.createdAt ?? 't'}-${i}`,
      timeAbsolute: m.createdAt ? formatConversationAbsolute(m.createdAt) : '—',
      chargedKind: kindLabel,
      creditCost: cost,
      creditReason: reasonRaw || undefined,
      breakdownAvailable: breakdown != null,
      hadAttachment,
      dictationSessions,
      preview: preview || (hadAttachment ? 'Attachment' : '—'),
      notBillable,
    });
  }

  const rollupByStoredReason = [...rollupReasonMap.entries()]
    .map(([, v]) => ({ label: v.label, messageCount: v.count, credits: v.credits }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const rollupByBreakdownComponents = [...componentMap.values()].sort((a, b) => a.label.localeCompare(b.label));

  return {
    totalFromMessages,
    rollupByStoredReason,
    rollupByBreakdownComponents,
    messagesWithAttachments,
    totalDictationSessions,
    attachmentOnlyMessageCount,
    notBillableMessages,
    quotaPeriods: [...quota].sort(),
    rows: tableRows.slice().reverse(),
  };
}
