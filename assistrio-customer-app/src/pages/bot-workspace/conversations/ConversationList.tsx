import type { CustomerConversationListItem } from '@/api/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ChatLogTagPreferences } from './insightsChatLogTagPreferences';
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
  /** Scroll viewport (Insights list column) used as IntersectionObserver root for infinite scroll. */
  listScrollParent: HTMLElement | null;
  onLoadMore: () => void;
  onRetry: () => void;
  chatLogTagVisibility: ChatLogTagPreferences;
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
  listScrollParent,
  onLoadMore,
  onRetry,
  chatLogTagVisibility,
}: Props) {
  const chatLogCount = conversations.length;
  const chatsLabel =
    chatLogCount === 1 ? '1 chat log' : `${chatLogCount.toLocaleString()} chat logs`;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  /** Latest callback wiring (avoid stale closures). */
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  /**
   * Infinite scroll: re-attach observer when pagination advances (`conversations.length`) so the next
   * page loads even if the sentinel stayed visible inside the scroll root (fresh observe runs an initial check).
   */
  useEffect(() => {
    const root = listScrollParent;
    const el = sentinelRef.current;
    if (!root || !el || listState !== 'ok' || nextCursor == null) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || !nextCursorRef.current) return;
        if (loadingMoreRef.current) return;
        onLoadMoreRef.current();
      },
      {
        root,
        rootMargin: '120px',
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [listScrollParent, listState, nextCursor, conversations.length]);

  if (listState === 'error' && conversations.length === 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col border-t border-slate-200/70">
        <ConversationEmptyState
          hasActiveFilters={hasActiveFilters}
          listError={listError || 'Could not load chat logs.'}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (listState === 'ok' && conversations.length === 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col border-t border-slate-200/70">
        <ConversationEmptyState hasActiveFilters={hasActiveFilters} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col p-2">
        {conversations.map((c) => (
          <ConversationListItem
            key={c.id}
            conversation={c}
            active={c.id === selectedId}
            onSelect={onSelect}
            tagVisibility={chatLogTagVisibility}
          />
        ))}
        {listState === 'ok' && nextCursor ? (
          <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-1">
            <div ref={sentinelRef} className="h-2 w-full shrink-0 bg-transparent" aria-hidden />
            {loadingMore ? (
              <span className="inline-flex items-center gap-2 pb-2 text-[11px] font-medium text-slate-500">
                <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
                Loading more…
              </span>
            ) : null}
          </div>
        ) : null}
        {listState === 'ok' && !nextCursor && conversations.length > 0 ? (
          <p className="px-2 py-2 text-center text-[11px] text-slate-400">
            End of filtered results · {chatsLabel}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
