import { Download } from 'lucide-react';
import type { CustomerConversationMessage, CustomerConversationMessageAttachment } from '@/api/types';
import { Button } from '@/components/ui';
import { InlineLoader } from '@/components/PageLoader';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import { conversationInsightsDetailOuterClassName } from './ConversationInsightsSheet';
import {
  formatAttachmentSizeBytes,
  shortAttachmentTypeLabel,
} from './messageAttachmentFormat';
import { ConversationAttachmentFileIcon } from './messageAttachmentFileIcon';
import { normalizeCustomerMessageAttachment, type AttachmentLike } from './messageAttachmentPreview.util';

type MsgState = 'idle' | 'loading' | 'ok' | 'error';

function flattenedConversationAttachments(messages: CustomerConversationMessage[]) {
  const out: Array<{
    key: string;
    raw: CustomerConversationMessageAttachment;
    createdAt: string;
  }> = [];

  messages.forEach((message, messageIndex) => {
    const atts = message.attachments;
    if (!atts?.length) return;
    const msgRef = message.messageId || message.id || `${message.createdAt}-${messageIndex}`;
    atts.forEach((raw, idx) => {
      out.push({
        key: `${msgRef}:${idx}`,
        raw,
        createdAt: message.createdAt ?? '',
      });
    });
  });
  return out;
}

export function ConversationInsightsAttachmentsTab({
  messages,
  msgState,
  msgError,
  onRetryMessages,
}: {
  messages: CustomerConversationMessage[] | null;
  msgState: MsgState;
  msgError: string;
  onRetryMessages: () => void;
}) {
  if (msgState === 'loading' || msgState === 'idle') {
    return (
      <div className={conversationInsightsDetailOuterClassName}>
        <div className="flex min-h-[12rem] flex-col justify-center py-12">
          <InlineLoader title="Loading attachments…" className="py-10" />
        </div>
      </div>
    );
  }

  if (msgState === 'error') {
    return (
      <div className={conversationInsightsDetailOuterClassName}>
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center" role="alert">
          <p className="m-0 text-sm font-medium text-slate-800">Couldn&apos;t load attachments</p>
          {msgError ? <p className="m-0 max-w-md text-xs text-slate-500">{safeClientString(msgError)}</p> : null}
          <Button type="button" variant="outlinePrimary" size="sm" onClick={onRetryMessages}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const rows = messages ? flattenedConversationAttachments(messages) : [];

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <header className="mb-4 min-w-0">
        <h2 className="m-0 text-[15px] font-semibold leading-tight tracking-tight text-slate-900">All Attachments</h2>
        {rows.length > 0 ? (
          <p className="m-0 mt-1 text-[13px] leading-snug text-slate-500">
            <span className="tabular-nums">{rows.length}</span> file{rows.length === 1 ? '' : 's'} from this conversation
          </p>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-slate-200/95 bg-gradient-to-b from-slate-50/80 to-white px-6 py-14 text-center"
          role="status"
        >
          <p className="m-0 text-[13px] font-medium text-slate-700">Nothing attached yet</p>
          <p className="m-0 mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-slate-500">
            Visitor-uploaded files from this conversation will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {rows.map((row) => {
              const a = normalizeCustomerMessageAttachment(row.raw as AttachmentLike);
              const kind = shortAttachmentTypeLabel(a.mimeType, a.name);
              const sizeLabel = formatAttachmentSizeBytes(a.size);
              const hasUrl = Boolean(a.safeUrl);
              const whenAbsolute = row.createdAt ? formatConversationAbsolute(row.createdAt) : '';
              const whenRel = row.createdAt ? formatConversationRelative(row.createdAt) : '';
              const leftMeta = [kind, sizeLabel].filter(Boolean).join(' · ');
              const showMetaRow = Boolean(kind || sizeLabel || whenRel);

              const body = (
                <>
                  <ConversationAttachmentFileIcon fileName={a.name} mimeType={a.mimeType} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-semibold leading-snug text-slate-900" title={a.name}>
                      {a.name}
                    </p>
                    {showMetaRow ? (
                      <p className="m-0 mt-0.5 truncate text-[11px] tabular-nums leading-snug text-slate-500">
                        {leftMeta}
                        {leftMeta && whenRel ? ' · ' : null}
                        {whenRel ? <span title={whenAbsolute || undefined}>{whenRel}</span> : null}
                      </p>
                    ) : null}
                    {!hasUrl ? (
                      <p className="m-0 mt-1 text-[11px] leading-snug text-amber-900/90">No download link for this file.</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {hasUrl ? (
                      <span className="inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-slate-500 group-hover:text-teal-800">
                        <Download className="size-3.5 shrink-0 opacity-85 group-hover:opacity-100" strokeWidth={2} aria-hidden />
                        Download
                      </span>
                    ) : (
                      <span className="w-5 shrink-0 sm:w-6" aria-hidden />
                    )}
                  </div>
                </>
              );

              const rowInteractive = cn(
                'flex min-h-[3.5rem] w-full items-center gap-3 px-3 py-3 text-left outline-none transition-colors sm:px-4',
                hasUrl &&
                  'group cursor-pointer hover:bg-teal-50/40 focus-visible:bg-teal-50/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/35',
                !hasUrl && 'cursor-default bg-slate-50/35',
              );

              return (
                <li key={row.key} className="m-0 min-w-0 p-0">
                  {hasUrl ? (
                    <a
                      href={a.safeUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Download ${a.name}`}
                      className={cn(rowInteractive, 'no-underline')}
                    >
                      {body}
                    </a>
                  ) : (
                    <div className={rowInteractive}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
