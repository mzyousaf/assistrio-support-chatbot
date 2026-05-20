import { Tooltip } from '@/components/ui';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { assistantFooterTimePillClass } from './assistantMessageFooterStyles';
import { cn } from '@/lib/utils';

type Props = {
  createdAt: string;
  className?: string;
};

export function AssistantMessageTimePill({ createdAt, className }: Props) {
  const absTime = formatConversationAbsolute(createdAt);
  return (
    <Tooltip content={absTime} side="top" panelClassName="max-w-xs text-xs">
      <span className={cn(assistantFooterTimePillClass, className)}>
        {formatConversationRelative(createdAt)}
      </span>
    </Tooltip>
  );
}
