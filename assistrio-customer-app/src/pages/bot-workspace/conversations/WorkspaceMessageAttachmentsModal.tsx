import { Download } from 'lucide-react';
import type { CustomerConversationMessageAttachment } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatAttachmentMetaLine } from './messageAttachmentFormat';
import { ConversationAttachmentFileIcon } from './messageAttachmentFileIcon';
import { normalizeCustomerMessageAttachment, type AttachmentLike } from './messageAttachmentPreview.util';

type Props = {
  open: boolean;
  onClose: () => void;
  attachments: CustomerConversationMessageAttachment[];
};

export function WorkspaceMessageAttachmentsModal({ open, onClose, attachments }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attachments"
      description="Use the download icon to save or open each file in your browser."
      size="lg"
      closeOnBackdropClick
      bodyClassName="min-w-0 overflow-x-hidden pb-3 pt-1.5 sm:px-5 sm:pb-4 sm:pt-2"
      footer={
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!attachments?.length ? (
        <p className="m-0 py-5 text-center text-sm text-slate-500">No files on this message.</p>
      ) : (
        <ul className="m-0 max-w-full min-w-0 list-none space-y-1.5 p-0">
          {attachments.map((raw, i) => {
            const a = normalizeCustomerMessageAttachment(raw as AttachmentLike);
            const meta = formatAttachmentMetaLine(a.mimeType, a.name, a.size);
            const hasUrl = Boolean(a.safeUrl);
            const inner = (
              <>
                <ConversationAttachmentFileIcon
                  fileName={a.name}
                  mimeType={a.mimeType}
                  className="h-9 max-h-9 ring-slate-200/90"
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="m-0 truncate text-sm font-semibold leading-tight text-slate-900" title={a.name}>
                    {a.name}
                  </p>
                  {meta ? (
                    <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500 tabular-nums">{meta}</p>
                  ) : null}
                  {!hasUrl ? (
                    <p className="m-0 mt-0.5 text-[10px] leading-snug text-amber-800/90">No download link for this file.</p>
                  ) : null}
                </div>
                {hasUrl ? (
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-teal-700 group-hover:text-teal-800"
                    aria-hidden
                  >
                    <Download className="size-4 opacity-90 sm:size-[15px]" strokeWidth={2} />
                  </span>
                ) : (
                  <span className="w-7 shrink-0 sm:w-8" aria-hidden />
                )}
              </>
            );

            const rowClass = cn(
              'flex min-w-0 max-w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 sm:gap-3 sm:px-3 sm:py-2',
              hasUrl
                ? 'group border-slate-200/90 bg-white hover:border-teal-200/80 hover:bg-teal-50/40'
                : 'cursor-default border-slate-200/60 bg-slate-50/90',
            );

            return (
              <li key={`${a.name}-${i}`} className="min-w-0 max-w-full">
                {hasUrl ? (
                  <a
                    href={a.safeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Download or open ${a.name}`}
                    className={cn(
                      rowClass,
                      'no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35',
                    )}
                  >
                    {inner}
                  </a>
                ) : (
                  <div className={rowClass}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
