import type { AdminConversationMessageAttachment } from '@/api/types';
import { cn } from '@/lib/utils';
import { normalizeCustomerMessageAttachment } from './messageAttachmentPreview.util';
import { formatAttachmentMetaLine } from './messageAttachmentFormat';

type Props = {
  attachments: AdminConversationMessageAttachment[];
  /** User bubbles are dark; assistant bubbles are light. */
  variant?: 'user' | 'assistant';
  className?: string;
};

export function MessageAttachmentPreview({ attachments, variant = 'assistant', className }: Props) {
  if (!attachments?.length) return null;
  const user = variant === 'user';
  return (
    <ul className={cn('m-0 max-w-[min(100%,32rem)] list-none space-y-1.5 p-0', className)}>
      {attachments.map((raw, i) => {
        const a = normalizeCustomerMessageAttachment(raw as AdminConversationMessageAttachment & Record<string, unknown>);
        const meta = formatAttachmentMetaLine(a.mimeType, a.name, a.size);
        const safeLink = Boolean(a.safeUrl);
        return (
          <li
            key={`${a.name}-${i}`}
            className={cn(
              'rounded-md border px-2 py-1.5 text-[11px]',
              user
                ? 'border-white/10 bg-black/15 text-slate-200'
                : 'border-slate-200/90 bg-slate-50/90 text-slate-800',
            )}
          >
            <div className={cn('font-medium', user ? 'text-slate-100' : 'text-slate-900')}>{a.name}</div>
            {meta ? (
              <div className={cn('mt-0.5', user ? 'text-slate-400' : 'text-slate-500')}>{meta}</div>
            ) : null}
            {safeLink ? (
              <a
                href={a.safeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  'mt-1 inline-block font-medium underline underline-offset-2',
                  user
                    ? 'text-teal-300 decoration-teal-400/40 hover:text-teal-200'
                    : 'text-teal-700 decoration-teal-600/30 hover:text-teal-800',
                )}
              >
                Open / download
              </a>
            ) : (
              <p className={cn('m-0 mt-1 text-[10px] leading-snug opacity-75', user ? 'text-slate-500' : 'text-slate-500')}>
                Secure link unavailable.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
