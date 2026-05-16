import type { CustomerConversationListItem } from '@/api/types';
import { Button } from '@/components/ui';
import { ConversationEmptyState } from './ConversationEmptyState';
import { ConversationListItem } from './ConversationListItem';

type Props = {
  conversations: CustomerConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  listState: 'loading' | 'ok' | 'error';
  listError: string;
  hasActiveFilters: boolean;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  listState,
  listError,
  hasActiveFilters,
  nextCursor,
  loadingMore,
  onLoadMore,
  onRetry,
}: Props) {
  if (listState === 'error' && conversations.length === 0) {
    return (
      <ConversationEmptyState
        hasActiveFilters={hasActiveFilters}
        listError={listError || 'Could not load chat logs.'}
        onRetry={onRetry}
      />
    );
  }

  if (listState === 'ok' && conversations.length === 0) {
    return <ConversationEmptyState hasActiveFilters={hasActiveFilters} />;
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col p-2">
        {conversations.map((c) => (
          <ConversationListItem key={c.id} conversation={c} active={c.id === selectedId} onSelect={onSelect} />
        ))}
        {listState === 'ok' && nextCursor ? (
          <div className="sticky bottom-0 border-t border-slate-100/90 bg-[oklch(98.5%_0_0)]/95 px-1 pt-2 pb-1 backdrop-blur-[2px]">
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              className="w-full"
              disabled={loadingMore}
              onClick={() => onLoadMore()}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
        {listState === 'ok' && !nextCursor && conversations.length > 0 ? (
          <p className="px-2 py-2 text-center text-[11px] text-slate-400">End of matching conversations.</p>
        ) : null}
      </div>
    </div>
  );
}
