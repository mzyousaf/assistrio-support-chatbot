import type { CustomerConversationMessageCreditBreakdownRow } from '@/api/types';
import { cn } from '@/lib/utils';
import { MessageCreditBadge, shouldShowMessageCreditBadge } from './MessageCreditBadge';

type Props = {
  creditCost?: number;
  creditReason?: string;
  creditBreakdown?: CustomerConversationMessageCreditBreakdownRow[] | null;
  className?: string;
};

export function UserMessageFooter({ creditCost, creditReason, creditBreakdown, className }: Props) {
  if (!shouldShowMessageCreditBadge(creditCost, creditReason, creditBreakdown)) return null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 pt-1 text-[11px]',
        className,
      )}
    >
      <MessageCreditBadge creditCost={creditCost} creditReason={creditReason} creditBreakdown={creditBreakdown} />
    </div>
  );
}
