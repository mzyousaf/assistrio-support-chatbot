import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

type Props = {
  createdAt: string;
  align: 'start' | 'end';
  variant?: 'default' | 'mutedOnDark';
  className?: string;
};

export function ConversationMessageTimestamp({ createdAt, align, variant = 'default', className }: Props) {
  const rel = formatConversationRelative(createdAt);
  const abs = formatConversationAbsolute(createdAt);
  return (
    <Tooltip content={abs} side="top" panelClassName="max-w-xs text-xs">
      <span
        className={cn(
          'cursor-default text-[11px]',
          align === 'end' ? 'text-right' : 'text-left',
          variant === 'mutedOnDark' ? 'text-slate-400' : 'text-slate-500',
          className,
        )}
      >
        {rel}
      </span>
    </Tooltip>
  );
}
