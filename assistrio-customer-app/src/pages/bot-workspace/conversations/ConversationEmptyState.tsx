import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';
import { safeClientString } from '@/lib/safeClientString';

type Props = {
  hasActiveFilters: boolean;
  listError?: string;
  onRetry?: () => void;
};

export function ConversationEmptyState({ hasActiveFilters, listError, onRetry }: Props) {
  if (listError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-8 text-center" role="alert">
        <p className="m-0 max-w-md break-words text-sm font-medium text-red-700">{safeClientString(listError)}</p>
        {onRetry ? (
          <Button type="button" variant="outlinePrimary" size="sm" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const title = hasActiveFilters ? 'No chats match these filters' : 'No chats yet';
  const body = hasActiveFilters
    ? 'Try clearing filters or widening the date range.'
    : 'When visitors chat with your assistant, threads will appear here.';

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-8 text-center"
      role="status"
    >
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"
        aria-hidden
      >
        <MessageSquare className="h-6 w-6" strokeWidth={2} />
      </div>
      <p className="m-0 text-base font-semibold text-slate-900">{title}</p>
      <p className="m-0 mt-2 max-w-[20rem] text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
