import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CustomerBotLeadsListParams, CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import { getCustomerBotLeads } from '@/api/customerApi';
import { useBotWorkspace } from './BotWorkspaceContext';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { Button } from '@/components/ui';
import { safeClientString } from '@/lib/safeClientString';
import { LeadDetailDrawer } from './leads/LeadDetailDrawer';
import { apiParamsToLeadsDraft, defaultLeadsFiltersDraft, hasAnyLeadsFilters, leadsDraftToApiParams } from './leads/leadsFiltersModel';
import {
  countLoadedLeadsAnalyticsComplete,
  leadsInboxTableColumns,
} from './leads/leadsUiHelpers';
import {
  buildLeadsCsvLines,
  downloadLeadsCsv,
  leadsExportFilenameDate,
} from './leads/leadsCsvExport';
import { appToast } from '@/lib/app-toast';
import { LeadsSummaryCards } from './leads/LeadsSummaryCards';
import { LeadsHeader } from './leads/LeadsHeader';
import { LeadsToolbar, useSyncedLeadsSearchInput } from './leads/LeadsToolbar';
import { LeadsFilterCapsules } from './leads/LeadsFilterCapsules';
import { LeadsTable } from './leads/LeadsTable';
import { LeadsLoadingSkeleton } from './leads/LeadsLoadingSkeleton';
import { LeadsEmptyState } from './leads/LeadsEmptyState';
import {
  clampKnowledgeSourcesPageSize,
  KnowledgeSourcesPagination,
} from './knowledge/knowledgeSourcesListUi';

/** Match KB documents list default (`KnowledgeSection` `docPerPage`). */
const LEADS_PAGE_SIZE_INITIAL = 10;
/** Live search: wait this long after the last keystroke before calling the API. */
const LEADS_SEARCH_DEBOUNCE_MS = 350;

export function CustomerLeadsPage() {
  const { botId } = useBotWorkspace();
  const navigate = useNavigate();
  const leadsSearchInputId = useId();
  const leadsPerPageSelectId = useId();

  const [leadFieldDefinitions, setLeadFieldDefinitions] = useState<CustomerLeadFieldDefinition[]>([]);
  const [leads, setLeads] = useState<CustomerLeadListItem[]>([]);
  const [listMeta, setListMeta] = useState({
    totalMatching: 0,
    matchingCompleteLeadsCount: 0,
    matchingPartialLeadsCount: 0,
    latestMatchingCapturedAt: null as string | null,
  });
  const [listState, setListState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [listErr, setListErr] = useState('');
  const [listRefreshing, setListRefreshing] = useState(false);

  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(LEADS_PAGE_SIZE_INITIAL);

  const [appliedFilters, setAppliedFilters] = useState<CustomerBotLeadsListParams>(() =>
    leadsDraftToApiParams(defaultLeadsFiltersDraft()),
  );
  const [detailConversationId, setDetailConversationId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailReloadKey, setDetailReloadKey] = useState(0);

  const filterKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const filtersActive = useMemo(() => hasAnyLeadsFilters(apiParamsToLeadsDraft(appliedFilters)), [appliedFilters]);

  const [searchInput, setSearchInput] = useSyncedLeadsSearchInput(appliedFilters.search, filterKey);

  const listRef = useRef(leads);
  listRef.current = leads;
  const fetchSeq = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  const cancelSearchDebounce = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
  }, []);

  /** Push current `searchInput` into `appliedFilters` (used by Enter and debounce flush). */
  const commitSearchToApplied = useCallback(() => {
    const s = searchInputRef.current.trim();
    setAppliedFilters((prev) => {
      const next = { ...prev };
      const prevS = prev.search?.trim() ?? '';
      if (!s && !prevS) return prev;
      if (s === prevS) return prev;
      if (s) next.search = s;
      else delete next.search;
      return next;
    });
  }, []);

  /** Live search: debounce API updates while typing. */
  useEffect(() => {
    const appliedNorm = appliedFilters.search?.trim() ?? '';
    const inputNorm = searchInput.trim();
    if (inputNorm === appliedNorm) {
      cancelSearchDebounce();
      return;
    }

    cancelSearchDebounce();
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      commitSearchToApplied();
    }, LEADS_SEARCH_DEBOUNCE_MS);

    return () => cancelSearchDebounce();
  }, [searchInput, appliedFilters.search, cancelSearchDebounce, commitSearchToApplied]);

  const inboxColumns = useMemo(() => leadsInboxTableColumns(leadFieldDefinitions), [leadFieldDefinitions]);

  const countryCodesFromLeads = useMemo(() => {
    const s = new Set<string>();
    for (const lead of leads) {
      const cc = lead.location?.countryCode?.trim().toUpperCase();
      if (cc && /^[A-Z]{2}$/.test(cc)) s.add(cc);
    }
    return Array.from(s);
  }, [leads]);

  useLayoutEffect(() => {
    setListPage(1);
  }, [filterKey]);

  const fetchFirstPage = useCallback(async () => {
    if (!botId) return;
    const seq = ++fetchSeq.current;
    const hadRows = listRef.current.length > 0;
    if (hadRows) setListRefreshing(true);
    else setListState('loading');
    setListErr('');
    const res = await getCustomerBotLeads(botId, { ...appliedFilters, limit: listPageSize, page: listPage });
    if (seq !== fetchSeq.current) return;
    if (!res.ok) {
      if (!hadRows) {
        setListState('error');
        setLeads([]);
        setLeadFieldDefinitions([]);
        setListMeta({
          totalMatching: 0,
          matchingCompleteLeadsCount: 0,
          matchingPartialLeadsCount: 0,
          latestMatchingCapturedAt: null,
        });
      } else {
        setListErr(res.error || 'Could not refresh leads.');
      }
      setListRefreshing(false);
      return;
    }
    const d = res.data;
    setLeadFieldDefinitions(d.leadFieldDefinitions);
    setLeads(d.leads);
    const totalMatching = d.totalMatching ?? d.leads.length;
    const completeFb = countLoadedLeadsAnalyticsComplete(d.leads, d.leadFieldDefinitions);
    const completeN = d.matchingCompleteLeadsCount ?? completeFb;
    const partialN =
      d.matchingPartialLeadsCount ??
      (d.matchingCompleteLeadsCount !== undefined
        ? Math.max(0, totalMatching - d.matchingCompleteLeadsCount)
        : Math.max(0, d.leads.length - completeFb));
    setListMeta({
      totalMatching,
      matchingCompleteLeadsCount: completeN,
      matchingPartialLeadsCount: partialN,
      latestMatchingCapturedAt: d.latestMatchingCapturedAt ?? null,
    });
    setListState('ok');
    setListRefreshing(false);
  }, [botId, appliedFilters, listPage, listPageSize]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  const handleRefresh = useCallback(() => {
    void fetchFirstPage();
    setDetailReloadKey((k) => k + 1);
  }, [fetchFirstPage]);

  const handleRetryList = useCallback(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  const applySearch = useCallback(() => {
    cancelSearchDebounce();
    commitSearchToApplied();
  }, [cancelSearchDebounce, commitSearchToApplied]);

  const clearSearch = useCallback(() => {
    cancelSearchDebounce();
    setAppliedFilters((prev) => {
      const next = { ...prev };
      delete next.search;
      return next;
    });
  }, [cancelSearchDebounce]);

  const setFiltersParams = useCallback((next: CustomerBotLeadsListParams) => {
    setAppliedFilters(next);
  }, []);

  const pageCountForPagination = useMemo(() => {
    if (listMeta.totalMatching <= 0) return 1;
    return Math.max(1, Math.ceil(listMeta.totalMatching / listPageSize));
  }, [listMeta.totalMatching, listPageSize]);

  useEffect(() => {
    if (listPage > pageCountForPagination) {
      setListPage(pageCountForPagination);
    }
  }, [listPage, pageCountForPagination]);

  const handleLeadsPageChange = useCallback(
    (p: number) => {
      if (p <= 0 || p > pageCountForPagination) return;
      setListPage(p);
    },
    [pageCountForPagination],
  );

  const openDetail = (conversationId: string) => {
    setDetailConversationId(conversationId);
    setDetailDrawerOpen(true);
  };

  const closeDetail = () => {
    setDetailDrawerOpen(false);
  };

  const handleExportCsv = useCallback(() => {
    if (leads.length === 0) {
      appToast.info('No loaded leads to export');
      return;
    }
    try {
      const lines = buildLeadsCsvLines(leads, leadFieldDefinitions);
      downloadLeadsCsv(leadsExportFilenameDate(), lines.join('\r\n'));
      appToast.success(`Exported ${leads.length} lead${leads.length === 1 ? '' : 's'} from this page`, {
        description: 'Open other pages and export again to include additional rows.',
      });
    } catch {
      appToast.error('Could not export CSV');
    }
  }, [leads, leadFieldDefinitions]);

  const clearAllFilters = useCallback(() => {
    cancelSearchDebounce();
    setAppliedFilters(leadsDraftToApiParams(defaultLeadsFiltersDraft()));
  }, [cancelSearchDebounce]);

  if (!botId) return null;

  const listBusy = listState === 'loading' || listRefreshing;
  const disableRefresh = listBusy;
  const showSkeleton = listState === 'loading' && leads.length === 0;

  return (
    <WorkspaceContentContainer size="full">
      <LeadDetailDrawer
        open={detailDrawerOpen}
        botId={botId}
        conversationId={detailConversationId}
        listFieldDefinitions={leadFieldDefinitions}
        detailReloadKey={detailReloadKey}
        onClose={closeDetail}
      />
      <div className="flex min-h-[calc(100dvh-var(--nav-height))] max-h-[calc(100dvh-var(--nav-height))] min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-slate-50/80 to-white">
        <LeadsHeader
          exportDisabled={leads.length === 0}
          onExport={handleExportCsv}
          refreshDisabled={disableRefresh}
          refreshLoading={listRefreshing}
          onRefresh={handleRefresh}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="shrink-0 px-4 py-2.5 sm:px-5">
            <LeadsSummaryCards
              leads={leads}
              totalMatching={listMeta.totalMatching}
              matchingCompleteLeadsCount={listMeta.matchingCompleteLeadsCount}
              matchingPartialLeadsCount={listMeta.matchingPartialLeadsCount}
              latestMatchingCapturedAt={listMeta.latestMatchingCapturedAt}
            />
          </div>

          <div
            className="mx-4 mb-4 rounded-xl border border-slate-200/80 bg-white shadow-sm sm:mx-5"
            style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 78%, transparent)' }}
          >
            <div className="shrink-0">
              <LeadsToolbar
                filtersSlot={
                  <LeadsFilterCapsules
                    applied={appliedFilters}
                    fieldDefinitions={leadFieldDefinitions}
                    countryCodesFromLeads={countryCodesFromLeads}
                    onAppliedChange={setFiltersParams}
                    onClearAll={clearAllFilters}
                  />
                }
                searchInputId={leadsSearchInputId}
                searchValue={searchInput}
                onSearchChange={setSearchInput}
                onSearchSubmit={applySearch}
                onSearchClear={clearSearch}
              />
            </div>

            {listErr && leads.length > 0 ? (
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                <div className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2.5 text-sm text-red-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words">{safeClientString(listErr, 'Could not refresh leads.')}</span>
                    <Button type="button" variant="outlinePrimary" size="sm" onClick={() => void handleRetryList()}>
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {listState === 'error' && leads.length === 0 ? (
              <div className="px-4 py-8 sm:px-5">
                <div
                  className="mx-auto flex max-w-md flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50/85 px-6 py-12 text-center shadow-sm"
                  role="alert"
                >
                  <p className="m-0 text-base font-semibold text-red-900">We couldn&apos;t load leads</p>
                  <p className="m-0 mt-2 text-sm leading-relaxed text-red-800/90">
                    {safeClientString(listErr, 'Check your connection and try again.')}
                  </p>
                  <Button type="button" variant="primary" size="md" className="mt-6" onClick={() => void handleRetryList()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}

            {showSkeleton ? <LeadsLoadingSkeleton /> : null}

            {!showSkeleton && listState === 'ok' && leads.length === 0 ? (
              <div className="px-4 pb-8 pt-4 sm:px-5">
                <LeadsEmptyState
                  botId={botId}
                  variant={filtersActive ? 'filtered' : 'empty'}
                  onClearFilters={filtersActive ? clearAllFilters : undefined}
                />
              </div>
            ) : null}

            {!showSkeleton && leads.length > 0 ? (
              <>
                <LeadsTable
                  botId={botId}
                  leads={leads}
                  leadFieldDefinitions={leadFieldDefinitions}
                  inboxColumns={inboxColumns}
                  onOpenDetail={openDetail}
                  onOpenChat={(path) => navigate(path)}
                />
                <KnowledgeSourcesPagination
                  page={listPage}
                  pageCount={pageCountForPagination}
                  totalFiltered={listMeta.totalMatching}
                  pageSize={listPageSize}
                  perPageSelectId={leadsPerPageSelectId}
                  onPageSizeChange={(s) => {
                    setListPageSize(clampKnowledgeSourcesPageSize(s));
                    setListPage(1);
                  }}
                  onPageChange={(p) => handleLeadsPageChange(p)}
                  barClassName="px-4 pb-3 sm:px-5 sm:pb-4"
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
