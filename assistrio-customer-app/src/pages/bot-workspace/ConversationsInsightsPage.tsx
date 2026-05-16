import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  CustomerBotConversationsListParams,
  CustomerConversationDetail,
  CustomerConversationListItem,
  CustomerConversationMessage,
} from '@/api/types';
import {
  getCustomerBotConversationDetail,
  getCustomerBotConversationMessages,
  getCustomerBotConversations,
} from '@/api/customerApi';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { conversationInsightsAdminTabEnabled } from './conversations/conversationInsightsFormatting';
import type { ConversationInsightsPrimaryTab } from './conversations/conversationInsightsTabs.types';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { Button } from '@/components/ui';
import { ConversationDetailHeader } from './conversations/ConversationDetailHeader';
import { ConversationDetailPanel } from './conversations/ConversationDetailPanel';
import { ConversationMessageList } from './conversations/ConversationMessageList';
import { conversationInsightsDetailOuterClassName } from './conversations/conversationInsightsTabPanels';
import { ConversationFilters } from './conversations/ConversationFilters';
import { ConversationList } from './conversations/ConversationList';
import { ConversationListSkeleton } from './conversations/ConversationListSkeleton';
import { ConversationListToolbar } from './conversations/ConversationListToolbar';
import {
  apiParamsToConversationDraft,
  conversationDraftToApiParams,
  countActiveConversationFilters,
  hasAnyConversationFilters,
} from './conversations/conversationFiltersModel';
import { conversationListItemPlaceholder } from './conversations/conversationListItemPlaceholder';

/** Chat logs list: explicit viewport height (see `--insights-*` in `style.css`). */
const insightsChatLogsScrollStyle: CSSProperties = {
  height:
    'calc(100dvh - var(--nav-height) - var(--insights-chat-logs-header-height) - var(--insights-list-error-offset, 0px))',
};

/**
 * Customer workspace: read-only visitor conversations.
 * Route: `/bots/:id/insights/conversations` (admin uses `/admin/bots/:id/insights/conversations`).
 */
export function ConversationsInsightsPage() {
  const { botId } = useBotWorkspace();
  const { customer } = useCustomerAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversationId')?.trim() || null;
  const highlightMessageId = searchParams.get('messageId')?.trim() || null;

  const selectConversation = useCallback(
    (id: string | null, opts?: { keepMessageIdIfSameConversation?: boolean }) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const t = id?.trim();
          const prevConv = prev.get('conversationId')?.trim() || null;
          if (!t) {
            p.delete('conversationId');
            p.delete('messageId');
            return p;
          }
          p.set('conversationId', t);
          if (opts?.keepMessageIdIfSameConversation && prevConv === t) {
            // preserve ?messageId= for the same conversation (list refresh)
          } else {
            p.delete('messageId');
          }
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const insightsAdvancedAllowed = conversationInsightsAdminTabEnabled(customer?.role);

  const primaryTabs = useMemo((): ReadonlyArray<{ id: ConversationInsightsPrimaryTab; label: string }> => {
    const tabs: Array<{ id: ConversationInsightsPrimaryTab; label: string }> = [
      { id: 'chat', label: 'Chat' },
      { id: 'general', label: 'General details' },
      { id: 'attachments', label: 'Attachments' },
      { id: 'lead', label: 'Lead' },
      { id: 'usage', label: 'Usage' },
      { id: 'visitor', label: 'Visitor tracking' },
    ];
    if (insightsAdvancedAllowed) {
      tabs.push({ id: 'advanced', label: 'Advanced' });
    }
    return tabs;
  }, [insightsAdvancedAllowed]);
  const [list, setList] = useState<CustomerConversationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listState, setListState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [listErr, setListErr] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState<CustomerBotConversationsListParams>({});
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [messages, setMessages] = useState<CustomerConversationMessage[] | null>(null);
  const [msgState, setMsgState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msgErr, setMsgErr] = useState('');
  const [primaryTab, setPrimaryTab] = useState<ConversationInsightsPrimaryTab>('chat');

  useEffect(() => {
    if (highlightMessageId && selectedId) {
      setPrimaryTab('chat');
    }
  }, [highlightMessageId, selectedId]);

  const [listVersion, setListVersion] = useState(0);
  const [messageRetryNonce, setMessageRetryNonce] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [detail, setDetail] = useState<CustomerConversationDetail | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [detailErr, setDetailErr] = useState('');

  const filterKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const activeFilterCount = useMemo(() => countActiveConversationFilters(appliedFilters), [appliedFilters]);
  const filtersActive = useMemo(() => hasAnyConversationFilters(appliedFilters), [appliedFilters]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return list.find((c) => c.id === selectedId) ?? conversationListItemPlaceholder(selectedId);
  }, [list, selectedId]);

  const listRef = useRef(list);
  listRef.current = list;
  const fetchSeq = useRef(0);
  const insightsPrimaryTablistRef = useRef<HTMLDivElement | null>(null);
  const insightsPrimaryTabBtnRefs = useRef<Partial<Record<ConversationInsightsPrimaryTab, HTMLButtonElement | null>>>(
    {},
  );

  useEffect(() => {
    if (!insightsAdvancedAllowed && primaryTab === 'advanced') {
      setPrimaryTab('general');
    }
  }, [insightsAdvancedAllowed, primaryTab]);

  const [insightsPrimaryTabUnderline, setInsightsPrimaryTabUnderline] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const syncInsightsPrimaryTabUnderline = useCallback(() => {
    const root = insightsPrimaryTablistRef.current;
    const btn = insightsPrimaryTabBtnRefs.current[primaryTab];
    if (!root || !btn) return;
    const rr = root.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setInsightsPrimaryTabUnderline({
      left: br.left - rr.left + root.scrollLeft,
      width: br.width,
    });
  }, [primaryTab]);

  useLayoutEffect(() => {
    syncInsightsPrimaryTabUnderline();
    const root = insightsPrimaryTablistRef.current;
    const removeResizeListener = () => window.removeEventListener('resize', syncInsightsPrimaryTabUnderline);
    window.addEventListener('resize', syncInsightsPrimaryTabUnderline);
    if (!root || typeof ResizeObserver === 'undefined') {
      return removeResizeListener;
    }
    const ro = new ResizeObserver(() => syncInsightsPrimaryTabUnderline());
    ro.observe(root);
    return () => {
      ro.disconnect();
      removeResizeListener();
    };
  }, [syncInsightsPrimaryTabUnderline, primaryTabs, selectedId]);

  const pickSelection = useCallback((rows: CustomerConversationListItem[], previous: string | null) => {
    const ids = new Set(rows.map((c) => c.id));
    if (previous && ids.has(previous)) return previous;
    /** Keep URL selection even when this page of results does not include it (deep link / pagination). */
    if (previous && !ids.has(previous)) return previous;
    return rows[0]?.id ?? null;
  }, []);

  const fetchFirstPage = useCallback(async () => {
    if (!botId) return;
    const seq = ++fetchSeq.current;
    const hadRows = listRef.current.length > 0;
    if (hadRows) setListRefreshing(true);
    else setListState('loading');
    setListErr('');
    const res = await getCustomerBotConversations(botId, { limit: 40, ...appliedFilters });
    if (seq !== fetchSeq.current) return;
    if (!res.ok) {
      if (!hadRows) {
        setListState('error');
        setList([]);
        setNextCursor(null);
        selectConversation(null);
      } else {
        setListErr(res.error || 'Could not refresh chat logs.');
      }
      setListRefreshing(false);
      return;
    }
    const data = res.data;
    setList(data.conversations);
    setNextCursor(data.nextCursor);
    setListState('ok');
    const nextSel = pickSelection(data.conversations, selectedId);
    if (nextSel !== selectedId) {
      selectConversation(nextSel);
    } else {
      selectConversation(nextSel, { keepMessageIdIfSameConversation: true });
    }
    setListVersion((v) => v + 1);
    setListRefreshing(false);
  }, [botId, appliedFilters, pickSelection, selectedId, selectConversation]);

  useEffect(() => {
    void fetchFirstPage();
  }, [botId, filterKey, fetchFirstPage]);

  const handleRefresh = useCallback(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  const handleRetryList = useCallback(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (!botId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setListErr('');
    const res = await getCustomerBotConversations(botId, { limit: 40, before: nextCursor, ...appliedFilters });
    setLoadingMore(false);
    if (!res.ok) {
      setListErr('Could not load more.');
      return;
    }
    setList((prev) => [...prev, ...res.data.conversations]);
    setNextCursor(res.data.nextCursor);
  }, [botId, nextCursor, loadingMore, appliedFilters]);

  useEffect(() => {
    if (!botId || !selectedId) {
      setMessages(null);
      setMsgState('idle');
      return;
    }
    let cancelled = false;
    setMessages(null);
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
  }, [botId, selectedId, listVersion, messageRetryNonce]);

  const handleRetryMessages = useCallback(() => {
    setMessageRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!botId || !selectedId) {
      setDetail(null);
      setDetailState('idle');
      setDetailErr('');
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailState('loading');
    setDetailErr('');
    void (async () => {
      const res = await getCustomerBotConversationDetail(botId, selectedId);
      if (cancelled) return;
      if (!res.ok) {
        setDetailState('error');
        setDetailErr(res.error);
        setDetail(null);
        return;
      }
      setDetail(res.data);
      setDetailState('ok');
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, selectedId, listVersion, detailVersion]);

  const handleRetryDetail = useCallback(() => {
    setDetailVersion((v) => v + 1);
  }, []);

  if (!botId) return null;

  const listBusy = listState === 'loading' || listRefreshing;
  const disableRefresh = listBusy;
  const showListSkeleton = listState === 'loading' && list.length === 0;

  return (
    <WorkspaceContentContainer size="full">
      <ConversationFilters
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        initialDraft={apiParamsToConversationDraft(appliedFilters)}
        onApply={(draft) => {
          setAppliedFilters(conversationDraftToApiParams(draft));
        }}
        onClear={() => {
          setAppliedFilters({});
        }}
      />
      <div className="flex h-[calc(100dvh-var(--nav-height))] max-h-[calc(100dvh-var(--nav-height))] min-h-0 w-full flex-col overflow-hidden">
        <div
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden border-0 border-slate-200/80 bg-white md:flex-row md:overflow-hidden"
          style={{ borderColor: 'var(--border-soft, rgba(0,0,0,0.08))' }}
        >
          <div
            data-insights-chat-logs-column
            data-insights-list-error={listErr && list.length > 0 ? 'true' : 'false'}
            className="flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-b border-slate-200/80 md:w-[35%] md:shrink-0 md:border-b-0 md:border-r"
            style={{ background: 'oklch(98.5% 0 0)' }}
          >
            <ConversationListToolbar
              title="Chat logs"
              activeFilterCount={activeFilterCount}
              filterOpen={filterModalOpen}
              onFilterClick={() => setFilterModalOpen(true)}
              onRefreshClick={() => void handleRefresh()}
              refreshDisabled={disableRefresh}
              refreshLoading={listRefreshing}
            />
            {listErr && list.length > 0 ? (
              <div className="shrink-0 border-b border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words">{safeClientString(listErr, 'Could not refresh chat logs.')}</span>
                  <Button type="button" variant="outlinePrimary" size="sm" onClick={() => void handleRetryList()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}
            <div
              className="insights-slim-scroll min-h-0 w-full shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
              style={insightsChatLogsScrollStyle}
            >
              {showListSkeleton ? (
                <div className="p-2" aria-busy>
                  <ConversationListSkeleton />
                </div>
              ) : (
                <ConversationList
                  conversations={list}
                  selectedId={selectedId}
                  onSelect={selectConversation}
                  listState={listState}
                  listError={listErr}
                  hasActiveFilters={filtersActive}
                  nextCursor={nextCursor}
                  loadingMore={loadingMore}
                  onLoadMore={() => void loadMore()}
                  onRetry={() => void handleRetryList()}
                />
              )}
            </div>
          </div>

          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white md:w-[65%]">
            {!selected ? (
              <div
                className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center"
                role="status"
              >
                <p className="m-0 text-base font-semibold text-slate-900">Select a conversation</p>
                <p className="m-0 mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  Pick a thread to browse the transcript plus visitor, usage, and lead panels.
                </p>
              </div>
            ) : (
              <>
                <div className="shrink-0">
                  <div className="px-4 py-2 sm:py-2.5">
                    <div className="flex min-h-[4.25rem] flex-col justify-center sm:min-h-[4.75rem]">
                      <ConversationDetailHeader
                        listItem={selected}
                        detail={detailState === 'ok' ? detail : null}
                      />
                    </div>
                  </div>
                  <div
                    ref={insightsPrimaryTablistRef}
                    className="relative flex flex-wrap items-end gap-x-2 gap-y-1 border-b border-slate-200/70 px-2 sm:gap-x-2 sm:px-3"
                    role="tablist"
                    aria-label="Conversation insights"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'insights-primary-tab-underline pointer-events-none absolute bottom-0 z-[3] h-0.5 rounded-full bg-teal-600',
                        insightsPrimaryTabUnderline.width <= 0 && 'opacity-0',
                      )}
                      style={{
                        left: insightsPrimaryTabUnderline.left,
                        width: Math.max(0, insightsPrimaryTabUnderline.width),
                      }}
                    />
                    {primaryTabs.map((tab) => {
                      const selected = primaryTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          ref={(node) => {
                            insightsPrimaryTabBtnRefs.current[tab.id] = node;
                          }}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setPrimaryTab(tab.id)}
                          className={cn(
                            'relative z-[1] shrink-0 rounded-none px-2.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors duration-200 motion-reduce:transition-none',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                            selected ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800',
                          )}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div
                  className={cn(
                    'insights-slim-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden',
                    primaryTab === 'chat'
                      ? 'overflow-y-hidden pb-0'
                      : 'overflow-y-auto pb-0',
                  )}
                >
                  <div
                    key={primaryTab}
                    className={cn(
                      'insights-tab-panel-mount flex min-w-0 flex-col',
                      primaryTab === 'chat' ? 'min-h-0 flex-1' : 'w-full',
                    )}
                  >
                    {primaryTab === 'chat' ? (
                      <div
                        className={cn(
                          conversationInsightsDetailOuterClassName,
                          'insights-slim-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto',
                        )}
                      >
                        <ConversationMessageList
                          botId={botId}
                          messages={messages}
                          msgState={msgState}
                          msgError={msgErr}
                          onRetryMessages={handleRetryMessages}
                          highlightMessageId={highlightMessageId}
                          scrollConversationVersion={
                            selectedId
                              ? `${selectedId}:${listVersion}:${messageRetryNonce}:${highlightMessageId ?? ''}`
                              : ''
                          }
                        />
                      </div>
                    ) : (
                      <ConversationDetailPanel
                        listItem={selected}
                        detail={detail}
                        detailState={detailState}
                        detailError={detailErr}
                        onRetryDetail={handleRetryDetail}
                        messages={messages}
                        msgState={msgState}
                        msgError={msgErr}
                        onRetryMessages={handleRetryMessages}
                        insightsTab={primaryTab}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
