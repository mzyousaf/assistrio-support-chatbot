import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getAdminVisitorDetail } from '@/api/adminVisitorsApi';
import type { AdminVisitorDetailResponse, AdminVisitorEventRow } from '@/api/types';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { InlineLoader } from '@/components/PageLoader';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAdminDateTime } from '@/lib/formatAdminDate';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import {
  filterVisitorEvents,
  shortVisitorId,
  visitorEventLabel,
  visitorHasContact,
  visitorTypeLabel,
} from './adminVisitorsUtils';

type DetailTab = 'overview' | 'timeline' | 'conversations' | 'lead';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'lead', label: 'Lead' },
];

export function AdminVisitorDetailPage() {
  const { visitorId: routeVisitorId = '' } = useParams<{ visitorId: string }>();
  const visitorId = decodeURIComponent(routeVisitorId);
  const [data, setData] = useState<AdminVisitorDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [eventFilter, setEventFilter] = useState('all');

  const load = useCallback(async () => {
    if (!visitorId) return;
    setLoading(true);
    setError(null);
    const res = await getAdminVisitorDetail(visitorId);
    if (!res.ok) {
      setError(res.error);
      setData(null);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }, [visitorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const events = data?.events ?? [];
  const filteredEvents = useMemo(
    () => filterVisitorEvents(events, eventFilter),
    [events, eventFilter],
  );

  const eventTypes = useMemo(() => {
    const set = new Set(events.map((e) => String(e.type)));
    return [...set].sort();
  }, [events]);

  const pageViewCount = useMemo(
    () => events.filter((e) => e.type === 'page_view').length,
    [events],
  );

  const showLeadTab = data ? visitorHasContact(data.visitor) : false;

  useEffect(() => {
    if (tab === 'lead' && !showLeadTab) setTab('overview');
  }, [tab, showLeadTab]);

  return (
    <DataPageLayout
      embedded
      title={data?.visitor.name?.trim() || 'Visitor details'}
      description={
        data ? (
          <span className="font-mono text-[0.8125rem] text-slate-500" title={data.visitor.visitorId}>
            {data.visitor.visitorId}
          </span>
        ) : (
          'Marketing funnel visitor'
        )
      }
      containerSize="full"
    >
      <div className="mb-6">
        <Link
          to="/insights/marketing-visitors"
          className="inline-flex items-center gap-1.5 rounded-[var(--ui-radius)] px-2 py-1 text-[0.8125rem] font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
        >
          <ArrowLeft size={16} aria-hidden />
          Marketing visitors
        </Link>
      </div>

      {loading ? (
        <div className="py-12">
          <InlineLoader title="Loading visitor…" />
        </div>
      ) : null}

      {error && !loading ? (
        <WorkspaceLoadFailureCard
          icon="generic"
          title="Could not load visitor"
          description={error}
          onPrimary={() => void load()}
        />
      ) : null}

      {!loading && !error && data ? (
        <div className="flex flex-col gap-6">
          <nav className="flex flex-wrap gap-1 border-b border-slate-200/80" aria-label="Visitor sections">
            {TABS.filter((t) => t.id !== 'lead' || showLeadTab).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'cursor-pointer rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                  tab === id
                    ? 'border border-b-white border-slate-200/80 bg-white text-teal-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === 'overview' ? <OverviewPanel data={data} pageViewCount={pageViewCount} /> : null}
          {tab === 'timeline' ? (
            <TimelinePanel
              events={filteredEvents}
              allEvents={events}
              allCount={events.length}
              eventFilter={eventFilter}
              onEventFilterChange={setEventFilter}
              eventTypes={eventTypes}
            />
          ) : null}
          {tab === 'conversations' ? <ConversationsPanel data={data} /> : null}
          {tab === 'lead' && showLeadTab ? <LeadPanel visitor={data.visitor} /> : null}
        </div>
      ) : null}
    </DataPageLayout>
  );
}

function OverviewPanel({
  data,
  pageViewCount,
}: {
  data: AdminVisitorDetailResponse;
  pageViewCount: number;
}) {
  const v = data.visitor;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-[0.8125rem]">
          <DetailRow label="Visitor ID" value={v.visitorId} mono />
          <DetailRow label="Short ID" value={shortVisitorId(v.visitorId)} />
          <DetailRow label="Type" value={visitorTypeLabel(String(v.visitorType))} />
          <DetailRow label="First seen" value={formatAdminDateTime(v.createdAt)} />
          <DetailRow label="Last seen" value={formatAdminDateTime(v.lastSeenAt)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Activity (from events sample)</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-[0.8125rem]">
          <DetailRow label="Events loaded" value={String(data.events.length)} hint="Last 50 events max" />
          <DetailRow label="Page views (in sample)" value={String(pageViewCount)} />
          <DetailRow label="Showcase messages" value={formatAnalyticsInteger(v.showcaseMessageCount)} />
          <DetailRow label="Own-bot messages" value={formatAnalyticsInteger(v.ownBotMessageCount)} />
          <DetailRow
            label="Linked conversations"
            value={formatAnalyticsInteger(data.conversationsCount)}
            hint="API currently returns 0"
          />
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardBody className="text-[0.75rem] text-slate-500">
          {/* TODO: location, device, browser, referrer, UTM — not serialized on visitor or event detail yet. */}
          Geo, device, referrer, and UTM fields are not returned by GET /api/admin/visitors/:id (events include type, path, botSlug only).
        </CardBody>
      </Card>
    </div>
  );
}

function TimelinePanel({
  events,
  allEvents,
  allCount,
  eventFilter,
  onEventFilterChange,
  eventTypes,
}: {
  events: AdminVisitorEventRow[];
  allEvents: AdminVisitorEventRow[];
  allCount: number;
  eventFilter: string;
  onEventFilterChange: (v: string) => void;
  eventTypes: string[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Funnel events</CardTitle>
        <div className="min-w-[12rem]">
          <Select
            value={eventFilter}
            onChange={(e) => onEventFilterChange(e.target.value)}
            triggerClassName="h-8 text-[0.8125rem]"
            aria-label="Filter by event type"
          >
            <option value="all">All types ({allCount})</option>
            {eventTypes.map((t) => {
              const count = allEvents.filter((e) => String(e.type) === t).length;
              return (
                <option key={t} value={t}>
                  {visitorEventLabel(t)} ({count})
                </option>
              );
            })}
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {events.length === 0 ? (
          <p className="m-0 text-[0.875rem] text-slate-500">No events match this filter.</p>
        ) : (
          <ol className="m-0 list-none space-y-0 p-0">
            {events.map((ev) => (
              <li
                key={ev._id}
                className="relative border-l-2 border-teal-200/80 py-3 pl-4 last:pb-0"
              >
                <div className="absolute -left-[5px] top-4 size-2 rounded-full bg-teal-600" aria-hidden />
                <p className="m-0 text-[0.8125rem] font-semibold text-slate-900">
                  {visitorEventLabel(ev.type)}
                </p>
                <p className="m-0 mt-0.5 text-[0.75rem] text-slate-500">
                  {formatAdminDateTime(ev.createdAt)}
                  {ev.path ? ` · ${ev.path}` : ''}
                  {ev.botSlug ? ` · bot: ${ev.botSlug}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
        {allCount >= 50 ? (
          <p className="mb-0 mt-4 text-[0.75rem] text-amber-700">Showing the 50 most recent events from the API.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ConversationsPanel({ data }: { data: AdminVisitorDetailResponse }) {
  if (data.conversationsCount > 0 || data.bots.length > 0) {
    return (
      <Card>
        <CardBody>
          <p className="m-0 text-[0.875rem] text-slate-700">
            {formatAnalyticsInteger(data.conversationsCount)} linked conversation(s).
          </p>
          {data.bots.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-[0.8125rem] text-slate-600">
              {data.bots.map((b) => (
                <li key={b._id}>{b.name ?? b.slug ?? b._id}</li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardBody className="py-10 text-center">
        <p className="m-0 text-[0.9375rem] font-medium text-slate-800">No linked conversations</p>
        <p className="mx-auto m-0 mt-2 max-w-md text-[0.8125rem] text-slate-500">
          The admin visitor detail API does not attach conversations yet (`conversationsCount` is always 0).
        </p>
      </CardBody>
    </Card>
  );
}

function LeadPanel({ visitor }: { visitor: AdminVisitorDetailResponse['visitor'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2 text-[0.8125rem]">
        <DetailRow label="Name" value={visitor.name?.trim() || '—'} />
        <DetailRow label="Email" value={visitor.email?.trim() || '—'} />
        <DetailRow label="Phone" value={visitor.phone?.trim() || '—'} />
        <p className="mb-0 mt-3 text-[0.75rem] text-slate-500">
          Lead fields come from the visitor record only — not from captured conversation lead forms.
        </p>
      </CardBody>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className="shrink-0 font-medium text-slate-500 sm:w-36">{label}</span>
      <span className={cn('min-w-0 text-slate-900', mono && 'font-mono text-[0.75rem] break-all')}>{value}</span>
      {hint ? <span className="text-[0.6875rem] text-slate-400 sm:col-span-2 sm:pl-36">{hint}</span> : null}
    </div>
  );
}
