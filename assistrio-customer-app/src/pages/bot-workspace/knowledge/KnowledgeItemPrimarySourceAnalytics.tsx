import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerChatsAnalyticsGranularity } from '@/api/types';
import { getCustomerBotKnowledgeItemPrimarySourceAnalytics } from '@/api/customerApi';
import type { CustomerKnowledgeItemPrimarySourceAnalyticsResponse } from '@/api/types';
import {
  buildAgentResourcesAnalyticsApiParams,
  KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS,
  type AgentResourcesAnalyticsUiState,
} from '@/lib/agentResourcesAnalyticsQuery';
import { formatAnalyticsDateLabel, formatAnalyticsInteger, formatAnalyticsNumber } from '@/lib/analyticsFormat';
import { formatConversationAbsolute } from '@/lib/conversationDateFormat';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import {
  CoreDateGranularityPreviewCapsules,
  dateRangeMatchesDefault,
  widgetChannelMatchesDefault,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsInsightsFilterBars';
import type { StandardDateControlValues } from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import {
  ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
  CHART,
} from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { Tooltip } from '@/components/ui';

function SummaryCard({
  label,
  tooltipDescription,
  children,
}: {
  label: string;
  tooltipDescription: string;
  children: ReactNode;
}) {
  return (
    <Tooltip
      fullWidth
      side="top"
      panelClassName="max-w-[min(22rem,calc(100vw-16px))] px-3 py-2.5"
      content={
        <p className="m-0 text-left text-[0.6875rem] font-normal leading-snug text-slate-100">
          {tooltipDescription}
        </p>
      }
    >
      <div
        tabIndex={0}
        className={cn(
          'min-w-0 rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-3 outline-none sm:px-4 sm:py-3.5',
          'shadow-[0_1px_2px_rgba(15,23,42,0.03)]',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)]/20',
        )}
      >
        <p className="m-0 text-xs font-semibold text-slate-600">{label}</p>
        <p className="m-0 mt-1.5 min-w-0 text-sm font-normal tabular-nums leading-snug text-slate-900">{children}</p>
      </div>
    </Tooltip>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
  granularity,
}: {
  active?: boolean;
  label?: string;
  payload?: readonly { payload?: Record<string, unknown> }[];
  granularity: CustomerChatsAnalyticsGranularity;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as
    | {
        primarySourceUses?: number;
        conversations?: number;
        averageScore?: number | null;
      }
    | undefined;
  const uses = Math.trunc(Number(datum?.primarySourceUses ?? 0));
  const conv = Math.trunc(Number(datum?.conversations ?? 0));
  const avgRaw = datum?.averageScore;
  const avg = typeof avgRaw === 'number' && Number.isFinite(avgRaw) ? avgRaw : null;
  const dateLabel =
    label && typeof label === 'string' ? formatAnalyticsDateLabel(label, granularity) : label;

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1.5 font-semibold text-slate-700">{dateLabel}</p>
      <ul className="m-0 list-none space-y-1 p-0 tabular-nums text-slate-600">
        <li className="flex justify-between gap-4">
          <span>Answers Powered</span>
          <span className="font-semibold text-slate-900">{formatAnalyticsInteger(uses)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Conversations</span>
          <span className="font-semibold text-slate-900">{formatAnalyticsInteger(conv)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Average match score</span>
          <span className="font-semibold text-slate-900">
            {avg != null ? formatAnalyticsNumber(avg, { maximumFractionDigits: 4 }) : '—'}
          </span>
        </li>
      </ul>
    </div>
  );
}

type Props = {
  botId: string;
  knowledgeItemId: string | null | undefined;
};

/** Chart rows (tooltip reads {@link CustomerKnowledgeItemPrimarySourceAnalyticsResponse} points via Recharts datum). */
function chartRowsFromResponse(rows: CustomerKnowledgeItemPrimarySourceAnalyticsResponse['timeSeries']) {
  return rows.map((r) => ({
    ...r,
    averageScore: r.averageScore ?? null,
  }));
}

export function KnowledgeItemPrimarySourceAnalytics({ botId, knowledgeItemId }: Props) {
  const trimmedId = typeof knowledgeItemId === 'string' ? knowledgeItemId.trim() : '';

  const [filterUi, setFilterUi] = useState<AgentResourcesAnalyticsUiState>(() => ({
    ...KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS,
  }));
  const [openCapsule, setOpenCapsule] = useState<string | null>(null);
  const closeAll = useCallback(() => setOpenCapsule(null), []);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);

  const [data, setData] = useState<CustomerKnowledgeItemPrimarySourceAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const apiParams = useMemo(() => buildAgentResourcesAnalyticsApiParams(filterUi), [filterUi]);

  const coreDef: StandardDateControlValues = useMemo(
    () => ({
      preset: KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.preset,
      customFrom: KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.customFrom,
      customTo: KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.customTo,
      includePreview: KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.includePreview,
      startedFromKeys: KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.startedFromKeys,
    }),
    [],
  );

  const capsuleValues: StandardDateControlValues = useMemo(
    () => ({
      preset: filterUi.preset,
      customFrom: filterUi.customFrom,
      customTo: filterUi.customTo,
      includePreview: filterUi.includePreview,
      startedFromKeys: filterUi.startedFromKeys,
    }),
    [filterUi],
  );

  const dateAtDefault = useMemo(
    () => dateRangeMatchesDefault(capsuleValues, coreDef),
    [capsuleValues, coreDef],
  );
  const widgetAtDefault = useMemo(
    () => widgetChannelMatchesDefault(capsuleValues, coreDef),
    [capsuleValues, coreDef],
  );
  const dateQuietValueRow = !dateEngaged && dateAtDefault;
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;

  const load = useCallback(async () => {
    if (!trimmedId || !botId.trim()) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotKnowledgeItemPrimarySourceAnalytics(botId.trim(), trimmedId, apiParams);
    if (!res.ok) {
      setData(null);
      setLoadState('error');
      setErrorMessage(safeClientString(res.error, 'Something went wrong.'));
      return;
    }
    setData(res.data);
    setLoadState('ok');
  }, [botId, trimmedId, apiParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartRows = useMemo(() => chartRowsFromResponse(data?.timeSeries ?? []), [data?.timeSeries]);
  const granularity = (apiParams.granularity ?? 'day') as CustomerChatsAnalyticsGranularity;
  const summary = data?.summary;
  const summaryLoading = loadState === 'loading' && !summary;
  const emptyOk =
    loadState === 'ok' && summary != null && Math.max(0, Math.trunc(summary.primarySourceUses)) === 0;

  const poweredStr = summaryLoading ? '…' : formatAnalyticsInteger(summary?.primarySourceUses ?? 0);
  const conversationsStr = summaryLoading ? '…' : formatAnalyticsInteger(summary?.conversations ?? 0);
  const avgStr =
    summaryLoading
      ? '…'
      : summary?.averagePrimarySourceScore != null
        ? formatAnalyticsNumber(summary.averagePrimarySourceScore, { maximumFractionDigits: 4 })
        : '—';
  const lastUsedStr =
    summaryLoading ? '…' : summary?.lastUsedAt ? formatConversationAbsolute(summary.lastUsedAt) : '—';

  if (!trimmedId) {
    return (
      <div className="mt-8 border-t border-slate-200/90 pt-6">
        <p className="m-0 text-sm text-slate-600">Usage analytics are available after this item is saved.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-slate-200/90 pt-6" data-testid="kb-item-primary-source-analytics">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 text-sm font-semibold text-slate-900">Source Usage</h2>
        <p className="m-0 text-xs text-slate-500">
          Counts assistant replies where this item was the primary source.
        </p>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
        <CoreDateGranularityPreviewCapsules
          values={capsuleValues}
          onValuesChange={(v) =>
            setFilterUi((prev) => ({
              ...prev,
              preset: v.preset,
              customFrom: v.customFrom,
              customTo: v.customTo,
              includePreview: v.includePreview,
              startedFromKeys: [...v.startedFromKeys],
            }))
          }
          disabled={loadState === 'loading'}
          open={openCapsule}
          setOpen={setOpenCapsule}
          closeAll={closeAll}
          defaults={coreDef}
          autoGranularityRangeFallbackDays={7}
          topicsDateEngagement={{
            quietValueRow: dateQuietValueRow,
            onEngagement: setDateEngaged,
          }}
          widgetTopicsEngagement={{
            quietValueRow: widgetQuietValueRow,
            onEngagement: setWidgetEngaged,
          }}
        />
      </div>

      {loadState === 'error' ? <p className="mt-4 m-0 text-sm text-red-600">{errorMessage}</p> : null}

      <div
        className="m-0 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="kb-item-primary-source-summary-cards"
      >
        <SummaryCard
          label="Answers Powered"
          tooltipDescription="How many assistant replies used this KB item as the main source."
        >
          {summaryLoading ? <span className="text-slate-400">…</span> : poweredStr}
        </SummaryCard>
        <SummaryCard
          label="Conversations"
          tooltipDescription="Distinct conversations that included at least one assistant reply where this item was the main source."
        >
          {summaryLoading ? <span className="text-slate-400">…</span> : conversationsStr}
        </SummaryCard>
        <SummaryCard
          label="Average match score"
          tooltipDescription="Mean relevance score when this item was the main source (numeric scores only)."
        >
          {summaryLoading ? <span className="text-slate-400">…</span> : avgStr}
        </SummaryCard>
        <SummaryCard
          label="Last used"
          tooltipDescription="Most recent assistant reply in this range where this item was the main source."
        >
          {summaryLoading ? <span className="text-slate-400">…</span> : lastUsedStr}
        </SummaryCard>
      </div>

      <div className="mt-6">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Source usage over time
        </h3>
        <div
          className="mt-3 w-full min-w-0"
          style={{ minHeight: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX, height: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX }}
          data-testid="kb-item-primary-source-chart"
        >
          {loadState === 'loading' && !data ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading chart…</div>
          ) : emptyOk ? (
            <AnalyticsChartEmpty message="No source usage for this range." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  tickFormatter={(v) =>
                    typeof v === 'string' ? formatAnalyticsDateLabel(v, granularity) : String(v)
                  }
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  allowDecimals={false}
                  width={44}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: CHART.slate500, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  allowDecimals={false}
                  width={44}
                />
                <RechartsTooltip
                  content={<ChartTooltip granularity={granularity} />}
                  cursor={{ stroke: CHART.slate300, strokeOpacity: 0.85 }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="primarySourceUses"
                  name="Answers Powered"
                  stroke={CHART.teal600}
                  fill={CHART.teal600}
                  fillOpacity={0.22}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversations"
                  name="Conversations"
                  stroke={CHART.slate500}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <div
          className="mt-2 flex flex-row flex-nowrap items-center justify-center gap-x-5 text-[11px] leading-snug"
          role="note"
          aria-label="Chart legend"
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: CHART.teal600 }}
              aria-hidden
            />
            <span className="font-medium text-slate-600">Answers Powered per period.</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART.slate500 }}
              aria-hidden
            />
            <span className="font-medium text-slate-600">Distinct conversations.</span>
          </span>
        </div>
      </div>
    </div>
  );
}
