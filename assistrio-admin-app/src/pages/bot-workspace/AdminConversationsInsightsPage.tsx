import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  AdminBotConversationsListParams,
  AdminConversationDetail,
  AdminConversationListItem,
  AdminConversationMessage,
} from '@/api/types';
import {
  getAdminBotConversationDetail,
  getAdminBotConversationMessages,
  getAdminBotConversations,
} from '@/api/adminApi';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { conversationInsightsAdminTabEnabled } from './conversations/conversationInsightsFormatting';
import type { ConversationInsightsPrimaryTab } from './conversations/conversationInsightsTabs.types';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { ConversationDetailHeader } from './conversations/ConversationDetailHeader';
import { ConversationDetailPanel } from './conversations/ConversationDetailPanel';
import { ConversationMessageList } from './conversations/ConversationMessageList';
import { conversationInsightsDetailOuterClassName } from './conversations/conversationInsightsTabPanels';
import { isPlaygroundChatLogConversation } from './conversations/conversationInsightsFormatting';
import { ConversationFilters } from './conversations/ConversationFilters';
import { ConversationList } from './conversations/ConversationList';
import { ConversationListSkeleton } from './conversations/ConversationListSkeleton';
import { ConversationListToolbar } from './conversations/ConversationListToolbar';
import {
  apiParamsToConversationDraft,
  conversationAppliedFiltersSummary,
  conversationDraftToApiParams,
  countActiveConversationFilters,
  hasAnyConversationFilters,
  removeAppliedConversationFilterByChipId,
} from './conversations/conversationFiltersModel';
import { conversationListItemPlaceholder } from './conversations/conversationListItemPlaceholder';
import { ChatLogTagsSettingsModal } from './conversations/ChatLogTagsSettingsModal';
import { useInsightsChatLogTagPreferences } from './conversations/useInsightsChatLogTagPreferences';
import { TranscriptLoadingSkeleton } from './conversations/TranscriptLoadingSkeleton';

/** Page size for chat log list pagination (matches scroll “load next” batches). */
const CHAT_LOGS_PAGE_SIZE = 20;

/**
 * Customer workspace: read-only visitor conversations.
 * Route: `/bots/:id/conversations`.
 *
 * Chat logs list column: the scroll area uses `flex-1 min-h-0` so the header (including filter chips) can grow.
 */
export function AdminConversationsInsightsPage() {
  const { botId, bot } = useAdminBotWorkspace();
    const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversationId')?.trim() || null;
  const highlightMessageId = searchParams.get('messageId')?.trim() || null;

  /** Keeps list refresh stable when ?conversationId= changes — avoids refetching the list + bumping listVersion on every selection. */
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

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

  const selectConversationRef = useRef(selectConversation);
  selectConversationRef.current = selectConversation;

  const insightsAdvancedAllowed = conversationInsightsAdminTabEnabled("superadmin");

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
  const [list, setList] = useState<AdminConversationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listState, setListState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [listErr, setListErr] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [listScrollParentEl, setListScrollParentEl] = useState<HTMLDivElement | null>(null);
  /** Prevents overlapping pagination requests when the intersection observer fires repeatedly. */
  const loadMoreInFlightRef = useRef(false);

  const [appliedFilters, setAppliedFilters] = useState<AdminBotConversationsListParams>({});
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [chatLogTagsModalOpen, setChatLogTagsModalOpen] = useState(false);
  const { preferences: chatLogTagPrefs, savePreferences: saveChatLogTagPreferences } =
    useInsightsChatLogTagPreferences(botId);

  const [messages, setMessages] = useState<AdminConversationMessage[] | null>(null);
  const [msgState, setMsgState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msgErr, setMsgErr] = useState('');
  const [primaryTab, setPrimaryTab] = useState<ConversationInsightsPrimaryTab>('chat');

  const [listVersion, setListVersion] = useState(0);
  const [messageRetryNonce, setMessageRetryNonce] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [detail, setDetail] = useState<AdminConversationDetail | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [detailErr, setDetailErr] = useState('');

  const filterKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const activeFilterCount = useMemo(() => countActiveConversationFilters(appliedFilters), [appliedFilters]);
  const filtersActive = useMemo(() => hasAnyConversationFilters(appliedFilters), [appliedFilters]);
  const filterSummaryChips = useMemo(() => conversationAppliedFiltersSummary(appliedFilters), [appliedFilters]);

  const removeFilterSummaryChip = useCallback((chipId: string) => {
    setAppliedFilters((prev) => removeAppliedConversationFilterByChipId(prev, chipId));
  }, []);
  const clearAllAppliedFilters = useCallback(() => {
    setAppliedFilters({});
  }, []);

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
  }, [syncInsightsPrimaryTabUnderline, primaryTabs, primaryTab, selectedId]);

  const pickSelection = useCallback((rows: AdminConversationListItem[], previous: string | null) => {
    const ids = new Set(rows.map((c) => c.id));
    if (previous && ids.has(previous)) return previous;
    /** Keep URL selection even when this page of results does not include it (deep link / pagination). */
    if (previous && !ids.has(previous)) return previous;
    return rows[0]?.id ?? null;
  }, []);

  /** Matches {@link pickSelection} in {@link fetchFirstPage} so UI does not wait for `?conversationId=` to sync. */
  const resolvedConversationId = useMemo((): string | null => {
    if (listState !== 'ok') return selectedId;
    return pickSelection(list, selectedId);
  }, [list, listState, selectedId, pickSelection]);

  const selected = useMemo(() => {
    if (!resolvedConversationId) return null;
    return (
      list.find((c) => c.id === resolvedConversationId) ?? conversationListItemPlaceholder(resolvedConversationId)
    );
  }, [list, resolvedConversationId]);

  const playgroundTranscript = useMemo(
    () =>
      selected
        ? isPlaygroundChatLogConversation({
            startedFrom: detail?.startedFrom ?? selected.startedFrom,
            sessionSource: detail?.sessionSource ?? selected.sessionSource,
          })
        : false,
    [selected, detail],
  );

  useEffect(() => {
    if (highlightMessageId && resolvedConversationId) {
      setPrimaryTab('chat');
    }
  }, [highlightMessageId, resolvedConversationId]);

  const fetchFirstPage = useCallback(async (opts?: { bumpTranscript?: boolean }) => {
    if (!botId) return;
    const seq = ++fetchSeq.current;
    const hadRows = listRef.current.length > 0;
    if (hadRows) setListRefreshing(true);
    else setListState('loading');
    setListErr('');
    const res = await getAdminBotConversations(botId, { limit: CHAT_LOGS_PAGE_SIZE, ...appliedFilters });
    if (seq !== fetchSeq.current) return;
    if (!res.ok) {
      if (!hadRows) {
        setListState('error');
        setList([]);
        setNextCursor(null);
        selectConversationRef.current(null);
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
    const urlSelectedId = selectedIdRef.current;
    const nextSel = pickSelection(data.conversations, urlSelectedId);
    if (nextSel !== urlSelectedId) {
      selectConversationRef.current(nextSel);
    }
    // Only bump when the user explicitly refreshes the list; filter changes should hit the list API only
    // (messages/detail still refetch when `resolvedConversationId` changes).
    if (hadRows && opts?.bumpTranscript) setListVersion((v) => v + 1);
    setListRefreshing(false);
  }, [botId, appliedFilters, pickSelection]);

  useEffect(() => {
    void fetchFirstPage();
  }, [botId, filterKey, fetchFirstPage]);

  const handleRefresh = useCallback(() => {
    void fetchFirstPage({ bumpTranscript: true });
  }, [fetchFirstPage]);

  const handleRetryList = useCallback(() => {
    void fetchFirstPage({ bumpTranscript: true });
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (!botId || !nextCursor || loadMoreInFlightRef.current) return;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setListErr('');
    try {
      const res = await getAdminBotConversations(botId, {
        limit: CHAT_LOGS_PAGE_SIZE,
        before: nextCursor,
        ...appliedFilters,
      });
      if (!res.ok) {
        setListErr('Could not load more.');
        return;
      }
      setList((prev) => [...prev, ...res.data.conversations]);
      setNextCursor(res.data.nextCursor);
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [botId, nextCursor, appliedFilters]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  useEffect(() => {
    if (!botId || !resolvedConversationId) {
      setMessages(null);
      setMsgState('idle');
      return;
    }
    let cancelled = false;
    setMessages(null);
    setMsgState('loading');
    setMsgErr('');
    void (async () => {
      const res = await getAdminBotConversationMessages(botId, resolvedConversationId);
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
  }, [botId, resolvedConversationId, listVersion, messageRetryNonce]);

  const handleRetryMessages = useCallback(() => {
    setMessageRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!botId || !resolvedConversationId) {
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
      const res = await getAdminBotConversationDetail(botId, resolvedConversationId);
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
  }, [botId, resolvedConversationId, listVersion, detailVersion]);

  const handleRetryDetail = useCallback(() => {
    setDetailVersion((v) => v + 1);
  }, []);

  if (!botId) return null;

  const listBusy = listState === 'loading' || listRefreshing;
  const disableRefresh = listBusy;
  const showListSkeleton = listState === 'loading' && list.length === 0;

  return (
    <>
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
      <ChatLogTagsSettingsModal
        open={chatLogTagsModalOpen}
        onClose={() => setChatLogTagsModalOpen(false)}
        preferences={chatLogTagPrefs}
        onSave={saveChatLogTagPreferences}
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
              filterSummaryChips={filterSummaryChips}
              onRemoveFilterChip={removeFilterSummaryChip}
              onClearAllFilters={clearAllAppliedFilters}
              activeFilterCount={activeFilterCount}
              filterOpen={filterModalOpen}
              onFilterClick={() => setFilterModalOpen(true)}
              onChatLogTagSettingsClick={() => setChatLogTagsModalOpen(true)}
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
              ref={setListScrollParentEl}
              className="insights-slim-scroll flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
            >
              {showListSkeleton ? (
                <div className="p-2" aria-busy>
                  <ConversationListSkeleton rows={8} />
                </div>
              ) : (
                <ConversationList
                  conversations={list}
                  selectedId={resolvedConversationId}
                  onSelect={selectConversation}
                  listState={listState}
                  listError={listErr}
                  hasActiveFilters={filtersActive}
                  nextCursor={nextCursor}
                  loadingMore={loadingMore}
                  listScrollParent={listScrollParentEl}
                  onLoadMore={handleLoadMore}
                  onRetry={() => void handleRetryList()}
                  chatLogTagVisibility={chatLogTagPrefs}
                />
              )}
            </div>
          </div>

          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white md:w-[65%]">
            {showListSkeleton ? (
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                aria-busy="true"
                aria-live="polite"
                role="status"
              >
                <div className="shrink-0 border-b border-slate-200/70 px-4 py-1.5 sm:py-2">
                  <div className="flex min-h-[2.875rem] flex-col justify-center gap-1.5 sm:min-h-[3rem]">
                    <div className="h-6 w-40 max-w-[90%] animate-pulse rounded-md bg-slate-200/90" aria-hidden />
                    <div className="h-3.5 w-52 max-w-[95%] animate-pulse rounded-md bg-slate-100" aria-hidden />
                  </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <TranscriptLoadingSkeleton ariaLabel="Loading chat logs" className="min-h-0 flex-1 overflow-y-auto" />
                </div>
              </div>
            ) : !selected ? (
              <div
                className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center"
                role="status"
              >
                <p className="m-0 text-base font-semibold text-slate-900">Select a chat</p>
                <p className="m-0 mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  Pick a chat to browse the transcript plus visitor, usage, and lead panels.
                </p>
              </div>
            ) : (
              <>
                <div className="shrink-0">
                  <div className="px-4 py-1.5 sm:py-2">
                    <div className="flex min-h-[2.875rem] flex-col justify-center sm:min-h-[3rem]">
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
                    aria-label="Chat insights"
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
                        data-insights-transcript-root
                        className={cn(
                          conversationInsightsDetailOuterClassName,
                          'insights-slim-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto',
                        )}
                      >
                        <ConversationMessageList
                          botId={botId}
                          bot={bot}
                          messages={messages}
                          msgState={msgState}
                          msgError={msgErr}
                          onRetryMessages={handleRetryMessages}
                          playgroundTranscript={playgroundTranscript}
                          highlightMessageId={highlightMessageId}
                          scrollConversationVersion={
                            resolvedConversationId
                              ? `${resolvedConversationId}:${listVersion}:${messageRetryNonce}:${highlightMessageId ?? ''}`
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
    </>
  );
}
