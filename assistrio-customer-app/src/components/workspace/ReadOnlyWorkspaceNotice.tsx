import {
  BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE,
  BOT_WORKSPACE_READ_ONLY_NOTE,
} from '@/lib/botsListMessages';
import { cn } from '@/lib/utils';

export type ReadOnlyWorkspaceNoticeProps = {
  variant?: 'default' | 'knowledge';
  className?: string;
};

export function ReadOnlyWorkspaceNotice({ variant = 'default', className }: ReadOnlyWorkspaceNoticeProps) {
  const message = variant === 'knowledge' ? BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE : BOT_WORKSPACE_READ_ONLY_NOTE;
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200/90 bg-slate-50 px-3.5 py-2.5 text-[0.8125rem] text-slate-600',
        className,
      )}
      role="status"
    >
      {message}
    </div>
  );
}
