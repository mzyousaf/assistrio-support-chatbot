import { useCallback, useEffect, useState } from 'react';
import { getCustomerBotConversationMessages, getCustomerBotConversations } from '../../api/customerApi';
import { useBotWorkspace } from './BotWorkspaceContext';
import { cn } from '@/lib/utils';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { Filter, MessageSquare, RefreshCw } from 'lucide-react';
import { InlineLoader } from '../../components/PageLoader';

type ConversationRow = {
  id: string;
  lastActivityAt: string;
  chatVisitorId: string;
  userPreview: string;
  assistantPreview: string;
};

type MessageRow = { role: string; content: string; createdAt: string };

function relTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

/**
 * Customer workspace: read-only visitor conversations.
 * Route: `/bots/:id/insights/conversations` (admin uses `/admin/bots/:id/insights/conversations`).
 */
export function ConversationsInsightsPage() {
  const { botId } = useBotWorkspace();
  const [list, setList] = useState<ConversationRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listState, setListState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [listErr, setListErr] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [msgState, setMsgState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msgErr, setMsgErr] = useState('');
  const [rightTab, setRightTab] = useState<'chat' | 'details'>('chat');

  const refresh = useCallback(async () => {
    if (!botId) return;
    setListState('loading');
    setListErr('');
    const res = await getCustomerBotConversations(botId, { limit: 40 });
    if (!res.ok) {
      setListState('error');
      setListErr(res.error);
      return;
    }
    const data = res.data;
    setList(data.conversations);
    setNextCursor(data.nextCursor);
    setListState('ok');
    const first = data.conversations[0];
    if (first) {
      setSelectedId(first.id);
    } else {
      setSelectedId(null);
      setMessages(null);
    }
  }, [botId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!botId || !nextCursor) return;
    const res = await getCustomerBotConversations(botId, { limit: 40, before: nextCursor });
    if (!res.ok) {
      setListErr('Could not load more.');
      return;
    }
    setList((prev) => [...prev, ...res.data.conversations]);
    setNextCursor(res.data.nextCursor);
  }, [botId, nextCursor]);

  useEffect(() => {
    if (!botId || !selectedId) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    setMsgState('loading');
    setMsgErr('');
    void (async () => {
      const res = await getCustomerBotConversationMessages(botId, selectedId);
      if (cancelled) return;
      if (!res.ok) {
        setMsgState('error');
        setMsgErr(res.error);
        setMessages(null);
        return;
      }
      setMessages(res.data.messages);
      setMsgState('ok');
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, selectedId]);

  if (!botId) return null;

  const selected = list.find((c) => c.id === selectedId);

  if (listState === 'loading' && list.length === 0) {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <InlineLoader title="Loading conversations…" />
          </div>
        </div>
      </WorkspaceContentContainer>
    );
  }

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <div
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden border-0 border-slate-200/80 bg-white dark:bg-slate-950/20 md:flex-row md:overflow-hidden"
          style={{ borderColor: 'var(--border-soft, rgba(0,0,0,0.08))' }}
        >
        <div
          className="flex w-full min-h-0 min-h-[32vh] shrink-0 flex-col border-b border-slate-200/80 max-md:max-h-[50vh] md:min-h-0 md:max-h-none md:w-[35%] md:shrink-0 md:border-b-0 md:border-r"
          style={{ background: 'oklch(98.5% 0 0)' }}
        >
          <div className="flex min-h-[4.75rem] shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 px-3 py-2.5 sm:min-h-[5.25rem] sm:px-3.5 sm:py-3">
            <h2 className="m-0 min-w-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
              Chat logs
            </h2>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50"
                title="Filter"
                aria-label="Filter chat logs"
              >
                <Filter size={15} className="text-teal-600" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50"
                title="Refresh"
                aria-label="Refresh chat logs"
              >
                <RefreshCw
                  size={15}
                  className={cn('text-teal-600', listState === 'loading' && 'animate-spin')}
                  strokeWidth={2}
                />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
            {listState === 'error' && (
              <p className="m-0 px-1 text-sm text-red-600">{listErr || 'Could not load chat logs.'}</p>
            )}
            {listState === 'ok' && list.length === 0 && (
              <div
                className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-8 text-center"
                role="status"
                aria-label="No chats"
              >
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"
                  aria-hidden
                >
                  <MessageSquare className="h-6 w-6" strokeWidth={2} />
                </div>
                <p className="m-0 text-base font-semibold text-slate-900">No chats found</p>
                <p className="m-0 mt-2 max-w-[20rem] text-sm leading-relaxed text-slate-500">
                  Try adjusting your filters or check back later for new conversations.
                </p>
              </div>
            )}
            {list.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'mb-1.5 w-full rounded-lg border px-2.5 py-2 text-left text-sm transition',
                    active
                      ? 'border-teal-500/80 bg-white shadow-sm'
                      : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white/80',
                  )}
                >
                  <p className="m-0 line-clamp-2 font-semibold text-slate-900">
                    {c.assistantPreview || '—'}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {c.userPreview || 'No user messages'}
                  </p>
                  <p className="mt-1 text-right text-[11px] text-slate-400">{relTime(c.lastActivityAt)}</p>
                </button>
              );
            })}
            {listState === 'ok' && nextCursor && (
              <button
                type="button"
                className="mt-1 w-full rounded-md py-2 text-center text-xs font-medium text-teal-700 hover:underline"
                onClick={() => void loadMore()}
              >
                Load more
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-h-[36vh] w-full flex-1 flex-col overflow-hidden bg-white max-md:min-h-[50vh] md:min-h-0 md:w-[65%]">
          {!selected ? (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              role="status"
            >
              <p className="m-0 text-base font-semibold text-slate-900">Select a conversation</p>
              <p className="m-0 mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Choose a conversation from the list to view its details and messages.
              </p>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-200/60">
                <div className="mb-4 flex min-h-[4.75rem] items-center px-4 py-2.5 sm:mb-5 sm:min-h-[5.25rem] sm:py-3">
                  <h2 className="m-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                    Playground
                  </h2>
                </div>
                <div
                  className="flex items-end justify-start gap-6 border-b border-slate-200/60 px-4"
                  role="tablist"
                  aria-label="Playground: Chat and Details"
                >
                  {(['chat', 'details'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={rightTab === tab}
                      onClick={() => setRightTab(tab)}
                      className={cn(
                        '-mb-px inline-flex shrink-0 border-b-2 px-0.5 pb-2.5 pt-1 text-sm font-medium transition',
                        rightTab === tab
                          ? 'border-teal-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800',
                      )}
                    >
                      {tab === 'chat' ? 'Chat' : 'Details'}
                    </button>
                  ))}
                </div>
              </div>
              {rightTab === 'chat' && (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {msgState === 'loading' && <p className="m-0 text-sm text-slate-500">Loading messages…</p>}
                  {msgState === 'error' && <p className="m-0 text-sm text-red-600">{msgErr}</p>}
                  {msgState === 'ok' &&
                    messages &&
                    messages.map((m) => {
                      const isUser = m.role === 'user';
                      return (
                        <div
                          key={`${m.createdAt}-${m.role}-${m.content.slice(0, 20)}`}
                          className={cn('mb-3 flex w-full', isUser ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[min(100%,32rem)] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                              isUser
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-800',
                            )}
                          >
                            {m.content}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {rightTab === 'details' && (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm text-slate-700">
                  <dl className="m-0 space-y-3">
                    <div>
                      <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Conversation</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs text-slate-800">{selected.id}</dd>
                    </div>
                    <div>
                      <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Last activity</dt>
                      <dd className="mt-0.5 text-slate-800">{relTime(selected.lastActivityAt)}</dd>
                    </div>
                    {selected.chatVisitorId ? (
                      <div>
                        <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Session</dt>
                        <dd className="mt-0.5 break-all font-mono text-xs text-slate-800">
                          …{selected.chatVisitorId.slice(-8)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
