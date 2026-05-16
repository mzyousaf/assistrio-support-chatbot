import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CustomerConversationMessage, CustomerLeadDetail, CustomerLeadFieldDefinition } from '@/api/types';
import { SquareArrowOutUpRight } from 'lucide-react';
import { formatConversationAbsolute } from '@/lib/conversationDateFormat';
import { conversationMessageBodyText } from '../conversations/conversationMessageText';
import { ConversationInsightsSheetSection } from '../conversations/ConversationInsightsSheet';
import { customerConversationInsightsPath } from './conversationInsightsDeepLink';
import { leadDetailFieldLabel, leadDetailSheetSectionClassName } from './leadsUiHelpers';

const LEAD_FIELDS_FROM_MESSAGES_TITLE = 'Captured Fields from messages';

function messageStableId(m: CustomerConversationMessage): string {
  return String(m.messageId || m.id || '').trim();
}

function roleIsUser(role: string | undefined): boolean {
  return (role ?? '').toLowerCase() === 'user';
}

type CaptureRow = {
  messageId: string;
  createdAt: string;
  preview: string;
  fields: { key: string; label: string }[];
};

type Props = {
  botId: string;
  detail: CustomerLeadDetail;
  definitions: CustomerLeadFieldDefinition[];
  messages: CustomerConversationMessage[] | null;
  msgLoadState: 'idle' | 'loading' | 'ok' | 'error';
};

function LeadCaptureMessagesLoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-slate-100/90 bg-slate-50/40 p-3"
          style={{ animationDelay: `${i * 55}ms` }}
        >
          <div className="mb-2 h-3 w-36 animate-pulse rounded bg-slate-200/80" />
          <div className="mb-2 h-4 w-full max-w-md animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 max-w-sm animate-pulse rounded bg-slate-100" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <div className="h-6 w-14 animate-pulse rounded-md bg-slate-200/70" />
            <div className="h-6 w-20 animate-pulse rounded-md bg-slate-200/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeadCaptureMessagesSection({ botId, detail, definitions, messages, msgLoadState }: Props) {
  const navigate = useNavigate();

  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of definitions) {
      map.set(d.key, leadDetailFieldLabel(d));
    }
    return map;
  }, [definitions]);

  const rows = useMemo((): CaptureRow[] => {
    const data = detail.capturedLeadData ?? {};
    const srcMap = detail.capturedLeadFieldMessageIds ?? {};
    const fallbackMsg = detail.leadSourceMessageId?.trim() ?? '';
    const byMsg = new Map<string, { key: string; label: string }[]>();

    for (const key of Object.keys(data)) {
      const val = String(data[key] ?? '').trim();
      if (!val) continue;
      const mid = srcMap[key]?.trim() || fallbackMsg;
      if (!mid) continue;
      const label = labelByKey.get(key) ?? key;
      const arr = byMsg.get(mid) ?? [];
      arr.push({ key, label });
      byMsg.set(mid, arr);
    }

    const msgById = new Map<string, CustomerConversationMessage>();
    if (messages) {
      for (const m of messages) {
        const id = messageStableId(m);
        if (id) msgById.set(id, m);
      }
    }

    const out: CaptureRow[] = [];
    for (const [messageId, fields] of byMsg) {
      const m = msgById.get(messageId);
      const createdAt = m?.createdAt ?? '';
      const previewRaw =
        m && roleIsUser(m.role) ? conversationMessageBodyText(m).trim() : '';
      const fromLegacyPreview =
        messageId === detail.leadSourceMessageId?.trim() ? (detail.leadSourceMessagePreview ?? '').trim() : '';
      const preview = previewRaw || fromLegacyPreview || '—';
      const truncated = preview.length > 280 ? `${preview.slice(0, 280)}…` : preview;
      out.push({
        messageId,
        createdAt,
        preview: truncated,
        fields: [...fields].sort((a, b) => a.label.localeCompare(b.label)),
      });
    }

    out.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
    return out;
  }, [detail, labelByKey, messages]);

  if (msgLoadState === 'loading') {
    return (
      <ConversationInsightsSheetSection title={LEAD_FIELDS_FROM_MESSAGES_TITLE} className={leadDetailSheetSectionClassName}>
        <LeadCaptureMessagesLoadingSkeleton />
      </ConversationInsightsSheetSection>
    );
  }

  if (msgLoadState === 'error') {
    return (
      <ConversationInsightsSheetSection title={LEAD_FIELDS_FROM_MESSAGES_TITLE} className={leadDetailSheetSectionClassName}>
        <p className="m-0 text-[13px] text-slate-500">Could not load transcript for this conversation.</p>
      </ConversationInsightsSheetSection>
    );
  }

  if (!rows.length) {
    return (
      <ConversationInsightsSheetSection title={LEAD_FIELDS_FROM_MESSAGES_TITLE} className={leadDetailSheetSectionClassName}>
        <p className="m-0 text-[13px] leading-relaxed text-slate-500">
          No message-level capture history is stored for this lead (usually older conversations). Open the conversation
          to browse the full transcript.
        </p>
      </ConversationInsightsSheetSection>
    );
  }

  return (
    <ConversationInsightsSheetSection title={LEAD_FIELDS_FROM_MESSAGES_TITLE} className={leadDetailSheetSectionClassName}>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.messageId}
            className="rounded-md border border-slate-200/80 bg-slate-50/50 px-3 py-2.5"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {row.createdAt ? (
                  <p className="m-0 min-w-0 flex-1 text-[11px] text-slate-500">
                    {formatConversationAbsolute(row.createdAt)}
                  </p>
                ) : (
                  <div className="min-w-0 flex-1" />
                )}
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-left text-[11px] font-semibold text-teal-700 underline decoration-teal-600/35 underline-offset-2 transition-colors hover:text-teal-900 hover:decoration-teal-700/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600/30"
                  title="Open message in conversation"
                  onClick={() =>
                    navigate(customerConversationInsightsPath(botId, detail.conversationId, row.messageId))
                  }
                >
                  <SquareArrowOutUpRight size={13} strokeWidth={2} className="shrink-0" aria-hidden />
                  View message
                </button>
              </div>
              <p className="m-0 line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-slate-800">
                {row.preview}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.fields.map((f) => (
                <span
                  key={`${row.messageId}-${f.key}`}
                  className="inline-flex items-center rounded-md border border-teal-200/80 bg-teal-50/90 px-2 py-0.5 text-[11px] font-medium text-teal-900"
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ConversationInsightsSheetSection>
  );
}
