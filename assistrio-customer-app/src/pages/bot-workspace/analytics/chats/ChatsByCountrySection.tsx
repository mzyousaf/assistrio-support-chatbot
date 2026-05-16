import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CustomerChatsAnalyticsCountryRow } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { ChatsGeoChart } from './ChatsGeoChart';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import {
  buildChatsCountryRankingRows,
  buildChatsGeoChartData,
  buildChatsGeoChartHoverData,
  CHATS_COUNTRY_RANKING_COLLAPSED_LIMIT,
  hasChatsGeoChartDataRows,
  type CountryRankingRow,
} from './chatsGeoChart.util';

/** Map column height for Chats by Country section. */
export const GEO_CHART_MAP_HEIGHT_PX = 550;

/** Country list column: scales between 13rem and 22rem with viewport (lg+ side-by-side layout). */
const CHATS_COUNTRY_LIST_GRID_COL = 'clamp(11rem,14vw,16rem)';

/** Approximate modal chrome (header + footer + padding) for map height in View all. */
const GEO_CHART_MODAL_CHROME_PX = 220;

function geoChartMapHeightForModal(): number {
  if (typeof window === 'undefined') return GEO_CHART_MAP_HEIGHT_PX;
  return Math.max(GEO_CHART_MAP_HEIGHT_PX, Math.floor(window.innerHeight * 0.9 - GEO_CHART_MODAL_CHROME_PX));
}

function isElementVisibleInScrollContainer(element: HTMLElement, container: HTMLElement): boolean {
  const er = element.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  return er.top < cr.bottom && er.bottom > cr.top;
}

type Props = {
  countries: CustomerChatsAnalyticsCountryRow[];
  /** Card heading (default: Chats by Country). */
  sectionTitle?: string;
  /** Modal heading when expanding all countries. */
  modalTitle?: string;
  /** Subtitle under the section title. */
  sectionDescription?: string;
};

function CountryUnknownTag() {
  return (
    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      Unknown
    </span>
  );
}

function CountryRankingList({
  rows,
  mapHoveredCountryCode = null,
  listScrollRef,
}: {
  rows: CountryRankingRow[];
  mapHoveredCountryCode?: string | null;
  listScrollRef?: RefObject<HTMLDivElement | null>;
}) {
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [highlightedInView, setHighlightedInView] = useState<string | null>(null);
  const maxConv = Math.max(1, ...rows.map((r) => r.conversations));

  useLayoutEffect(() => {
    const syncHighlight = () => {
      if (!mapHoveredCountryCode) {
        setHighlightedInView(null);
        return;
      }
      const code = mapHoveredCountryCode;
      const row = rows.find((r) => r.countryCode === code);
      if (!row?.countryCode) {
        setHighlightedInView(null);
        return;
      }
      const el = itemRefs.current.get(code);
      const container = listScrollRef?.current;
      if (!el || !container) {
        setHighlightedInView(null);
        return;
      }
      setHighlightedInView(isElementVisibleInScrollContainer(el, container) ? code : null);
    };

    syncHighlight();
    const container = listScrollRef?.current;
    container?.addEventListener('scroll', syncHighlight, { passive: true });
    return () => container?.removeEventListener('scroll', syncHighlight);
  }, [mapHoveredCountryCode, rows, listScrollRef]);

  const listAnimationKey = useMemo(
    () => rows.map((r) => `${r.label}:${r.conversations}`).join('\u0001'),
    [rows],
  );

  return (
    <ul key={listAnimationKey} className="m-0 flex w-full list-none flex-col gap-2.5 p-0">
      {rows.map((row, index) => {
        const w = Math.min(100, Math.max(4, Math.round((row.conversations / maxConv) * 100)));
        const isHighlighted = Boolean(row.countryCode && row.countryCode === highlightedInView);
        return (
          <li
            key={row.label}
            ref={(node) => {
              if (!row.countryCode) return;
              if (node) itemRefs.current.set(row.countryCode, node);
              else itemRefs.current.delete(row.countryCode);
            }}
            className={cn(
              'w-full min-w-0 rounded-md px-1 py-0.5 transition-colors',
              isHighlighted && 'bg-teal-50/80 ring-1 ring-teal-200/70',
            )}
          >
            <div className="flex w-full items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="min-w-0 truncate font-medium text-slate-700" title={row.label}>
                  {row.label}
                </span>
                {row.isUnknown ? <CountryUnknownTag /> : null}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {formatAnalyticsInteger(row.conversations)}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="chats-country-bar-fill h-full rounded-full bg-teal-600/85"
                style={{ width: `${w}%`, animationDelay: `${index * 50}ms` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MapStatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center text-sm text-slate-500"
      style={{
        height: GEO_CHART_MAP_HEIGHT_PX,
        minHeight: GEO_CHART_MAP_HEIGHT_PX,
      }}
    >
      {children}
    </div>
  );
}

function CountryRankingColumn({
  rows,
  mapHoveredCountryCode,
  listScrollRef,
  onViewAll,
}: {
  rows: CountryRankingRow[];
  mapHoveredCountryCode?: string | null;
  listScrollRef?: RefObject<HTMLDivElement | null>;
  onViewAll?: () => void;
}) {
  const visible = rows.slice(0, CHATS_COUNTRY_RANKING_COLLAPSED_LIMIT);
  const hasMore = rows.length > CHATS_COUNTRY_RANKING_COLLAPSED_LIMIT;

  if (rows.length === 0) {
    return <p className="m-0 text-sm text-slate-500">No country data yet.</p>;
  }

  return (
    <div className="w-full">
      <CountryRankingList
        rows={visible}
        mapHoveredCountryCode={mapHoveredCountryCode}
        listScrollRef={listScrollRef}
      />
      {onViewAll && hasMore ? (
        <div className="mt-2 flex w-full justify-end">
        <button
          type="button"
          className="inline-flex w-fit max-w-full cursor-pointer select-none items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/50 px-2.5 py-1.5 text-left text-[11px] font-semibold text-teal-700 transition-colors hover:border-teal-200/80 hover:bg-teal-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 sm:text-xs"
          aria-label={`View all countries — ${rows.length} total`}
          onClick={onViewAll}
        >
          <span>View all</span>
          <ChevronRight className="h-3 w-3 shrink-0 text-teal-600 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
        </div>
      ) : null}
    </div>
  );
}

function ChatsByCountryBody({
  countries,
  modalTitle = 'Chats by Country',
}: Pick<Props, 'countries' | 'modalTitle'>) {
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [mapHoveredCountryCode, setMapHoveredCountryCode] = useState<string | null>(null);
  const sidebarListScrollRef = useRef<HTMLDivElement>(null);
  const modalListScrollRef = useRef<HTMLDivElement>(null);
  const baseGeoData = useMemo(() => buildChatsGeoChartData(countries), [countries]);
  const hasGeoData = hasChatsGeoChartDataRows(baseGeoData);
  const geoData = useMemo(
    () => buildChatsGeoChartHoverData(countries, mapHoveredCountryCode),
    [countries, mapHoveredCountryCode],
  );
  const rankingRows = useMemo(() => buildChatsCountryRankingRows(countries), [countries]);
  const modalMapHeight = useMemo(
    () => (viewAllOpen ? geoChartMapHeightForModal() : GEO_CHART_MAP_HEIGHT_PX),
    [viewAllOpen],
  );

  const renderMapBlock = (mapHeight: number) => (
    <div
      className="min-h-0 w-full"
      style={{
        height: mapHeight,
        minHeight: mapHeight,
      }}
    >
      <ChatsGeoChart
        data={geoData}
        hasData={hasGeoData}
        height={mapHeight}
        onRegionHover={setMapHoveredCountryCode}
        loader={<MapStatusMessage>Loading map…</MapStatusMessage>}
        errorElement={<MapStatusMessage>Couldn&apos;t load map.</MapStatusMessage>}
      />
    </div>
  );

  return (
    <>
      <div
        className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_var(--chats-country-list-col)]"
        style={{ ['--chats-country-list-col' as string]: CHATS_COUNTRY_LIST_GRID_COL }}
      >
        <div className="min-w-0 w-full">{renderMapBlock(GEO_CHART_MAP_HEIGHT_PX)}</div>
        <div className="flex w-full min-w-0 flex-col lg:max-w-[var(--chats-country-list-col)]">
          <div className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Country</span>
            <span className="shrink-0">Chats</span>
          </div>
          <div
            ref={sidebarListScrollRef}
            className="mt-3 w-full max-h-[min(680px,72vh)] overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-gutter:stable]"
          >
            <CountryRankingColumn
              rows={rankingRows}
              mapHoveredCountryCode={mapHoveredCountryCode}
              listScrollRef={sidebarListScrollRef}
              onViewAll={() => setViewAllOpen(true)}
            />
          </div>
        </div>
      </div>

      <Modal
        open={viewAllOpen}
        onClose={() => {
          setViewAllOpen(false);
          setMapHoveredCountryCode(null);
        }}
        title={modalTitle}
        description="All countries with chat volume in this period."
        size="lg"
        className="h-[90vh] w-[90vw] max-h-[90vh] max-w-[90vw]"
        closeOnBackdropClick
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5"
        footer={
          <Button type="button" variant="primary" size="sm" onClick={() => setViewAllOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:items-stretch">
          <div className="min-h-0 min-w-0 flex-1">{renderMapBlock(modalMapHeight)}</div>
          <aside
            className="flex min-h-0 w-full min-w-0 shrink-0 flex-col lg:w-[var(--chats-country-list-col)] lg:max-w-[var(--chats-country-list-col)]"
            style={{ ['--chats-country-list-col' as string]: CHATS_COUNTRY_LIST_GRID_COL }}
          >
            <div className="flex w-full shrink-0 items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Country</span>
              <span className="shrink-0">Chats</span>
            </div>
            <div
              ref={modalListScrollRef}
              className="mt-3 min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-gutter:stable]"
            >
              <CountryRankingList
                rows={rankingRows}
                mapHoveredCountryCode={mapHoveredCountryCode}
                listScrollRef={modalListScrollRef}
              />
            </div>
          </aside>
        </div>
      </Modal>
    </>
  );
}

export function ChatsByCountrySection({
  countries,
  sectionTitle = 'Chats by Country',
  modalTitle = 'Chats by Country',
  sectionDescription = 'Where conversations are coming from.',
}: Props) {
  return (
    <AnalyticsChartCard
      title={sectionTitle}
      description={sectionDescription}
      noMaxHeight
      bodyClassName="overflow-x-hidden overflow-y-hidden"
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
      )}
    >
      <ChatsByCountryBody countries={countries} modalTitle={modalTitle} />
    </AnalyticsChartCard>
  );
}
