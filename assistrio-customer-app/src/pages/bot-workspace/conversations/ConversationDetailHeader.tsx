import type { CustomerConversationDetail, CustomerConversationListItem } from '@/api/types';
import { formatConversationRelative } from '@/lib/conversationDateFormat';

type Props = {
  listItem: CustomerConversationListItem;
  detail: CustomerConversationDetail | null;
};

export function ConversationDetailHeader({ listItem, detail }: Props) {
  const lastAt = detail?.lastActivityAt ?? listItem.lastActivityAt;

  return (
    <div className="min-w-0">
      <h2 className="m-0 line-clamp-3 break-words text-base font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg">
        Playground
      </h2>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500 sm:text-xs">
        <span className="min-w-0">
          Last activity{' '}
          <span className="font-medium text-slate-600">{formatConversationRelative(lastAt)}</span>
        </span>
      </div>
    </div>
  );
}
