import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerChatsAnalyticsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX, CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import { CHATS_MESSAGE_MODALITY_SERIES } from './chatsMessageModalityChartTheme';

const CHART_ANIM_MS = 520;

type OuterRow = { key: string; name: string; value: number };
type InnerRow = { id: string; name: string; value: number; color: string };

function outerSliceColor(index: number, total: number): string {
  if (total <= 0) return CHART.teal600;
  if (total === 1) return CHART.teal600;
  const t = index / (total - 1);
  const lightness = 38 + t * 28;
  return `hsl(173 58% ${lightness}%)`;
}

type Props = {
  timeSeries: CustomerChatsAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  userTotal: number;
  userText: number;
  userVoice: number;
  hiddenSeriesIds: string[];
  fillHeight?: boolean;
};

const CHART_MOUNT_STYLE: { minHeight: number; height: number | string } = {
  minHeight: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
  height: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
};

function userMessagesForBucket(p: CustomerChatsAnalyticsTimeSeriesPoint): number {
  const um = p.userMessages;
  if (um != null && Number.isFinite(um)) return Math.max(0, Math.trunc(um));
  return Math.max(0, Math.trunc((p.textMessages ?? 0) + (p.voiceMessages ?? 0)));
}

/**
 * Same layout as {@link AgentResourcesUsageDistributionPieChart}: outer ring = user messages per time
 * bucket (matches Message trends teal area scale). Inner disk = text / voice / other split for the range.
 */
export function ChatsMessageModalityDistributionDonut({
  timeSeries,
  granularity,
  userTotal,
  userText,
  userVoice,
  hiddenSeriesIds,
  fillHeight = false,
}: Props) {
  const { outerPieData, innerPieData } = useMemo(() => {
    const outer: OuterRow[] = [];
    for (const p of timeSeries) {
      const v = userMessagesForBucket(p);
      if (!Number.isFinite(v) || v <= 0) continue;
      outer.push({
        key: String(p.date),
        name: formatAnalyticsDateLabel(p.date, granularity),
        value: v,
      });
    }

    const text = Math.max(0, Math.trunc(userText));
    const voice = Math.max(0, Math.trunc(userVoice));
    const total = Math.max(0, Math.trunc(userTotal));
    const other = Math.max(0, total - text - voice);

    const inner: InnerRow[] = [];
    if (text > 0 && !hiddenSeriesIds.includes('textMessages')) {
      inner.push({
        id: 'textMessages',
        name: CHATS_MESSAGE_MODALITY_SERIES[1].label,
        value: text,
        color: CHATS_MESSAGE_MODALITY_SERIES[1].color,
      });
    }
    if (voice > 0 && !hiddenSeriesIds.includes('voiceMessages')) {
      inner.push({
        id: 'voiceMessages',
        name: CHATS_MESSAGE_MODALITY_SERIES[2].label,
        value: voice,
        color: CHATS_MESSAGE_MODALITY_SERIES[2].color,
      });
    }
    if (other > 0) {
      inner.push({
        id: 'otherUserMessages',
        name: 'Other user messages',
        value: other,
        color: CHART.slate400,
      });
    }

    return { outerPieData: outer, innerPieData: inner };
  }, [timeSeries, granularity, userTotal, userText, userVoice, hiddenSeriesIds]);

  const outerTotal = useMemo(() => outerPieData.reduce((a, b) => a + b.value, 0), [outerPieData]);
  const innerTotal = useMemo(() => innerPieData.reduce((a, b) => a + b.value, 0), [innerPieData]);

  const hasSignal =
    timeSeries.length > 0 &&
    timeSeries.some((p) => userMessagesForBucket(p) > 0 || (p.textMessages ?? 0) + (p.voiceMessages ?? 0) > 0);

  if (!timeSeries.length || !hasSignal || outerPieData.length === 0) {
    return (
      <div
        className={fillHeight ? 'flex h-full min-h-0 w-full flex-1 flex-col' : 'w-full min-w-0'}
        style={fillHeight ? undefined : CHART_MOUNT_STYLE}
        data-testid="chats-message-modality-distribution-chart"
      >
        <AnalyticsChartEmpty
          message="No user messages in this range for this split."
          className={fillHeight ? 'h-full min-h-[12rem] w-full flex-1' : 'min-h-[12rem] w-full'}
        />
      </div>
    );
  }

  const showInnerDisk = innerPieData.length > 0;

  const tooltipOuter = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly { payload?: OuterRow }[];
  }) => {
    if (!active || !payload?.[0]) return null;
    const row = payload[0].payload as OuterRow;
    const pct = outerTotal > 0 ? (100 * row.value) / outerTotal : 0;
    const pctLabel =
      Number.isFinite(pct) && pct > 0
        ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)}%)`
        : '';
    return (
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
        <p className="m-0 mb-1 font-semibold text-slate-800">{row.name}</p>
        <p className="m-0 tabular-nums text-slate-600">
          {formatAnalyticsInteger(row.value)} user messages
          {pctLabel} of range total
        </p>
      </div>
    );
  };

  const tooltipInner = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly { payload?: InnerRow }[];
  }) => {
    if (!active || !payload?.[0]) return null;
    const row = payload[0].payload as InnerRow;
    const pct = innerTotal > 0 ? (100 * row.value) / innerTotal : 0;
    const pctLabel =
      Number.isFinite(pct) && pct > 0
        ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)}%)`
        : '';
    return (
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
        <p className="m-0 mb-1 font-semibold text-slate-800">{row.name}</p>
        <p className="m-0 tabular-nums text-slate-600">
          {formatAnalyticsInteger(row.value)}
          {pctLabel} of modality split
        </p>
      </div>
    );
  };

  const outerCount = outerPieData.length;

  const caption = (
    <p className="m-0 mt-1 shrink-0 text-center text-[10px] leading-snug text-slate-500 sm:text-[11px]">
      {showInnerDisk ? (
        <>
          Outer ring · user messages per time bucket (same scale as the teal trend). Inner disk · text / voice / other mix for the
          range.
        </>
      ) : (
        <>
          Outer ring only · user messages per time bucket (enable text or voice in the list for the inner modality split).
        </>
      )}
    </p>
  );

  const chartSection = (
    <>
      <div className={fillHeight ? 'min-h-0 w-full flex-1' : 'h-full min-h-[12rem] w-full'}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            {showInnerDisk ? (
              <Pie
                data={innerPieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="42%"
                paddingAngle={1}
                stroke="#fff"
                strokeWidth={1}
                label={false}
                labelLine={false}
                isAnimationActive
                animationDuration={CHART_ANIM_MS}
                animationEasing="ease-out"
              >
                {innerPieData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
            ) : null}
            <Pie
              data={outerPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={showInnerDisk ? '52%' : '28%'}
              outerRadius="74%"
              paddingAngle={0.6}
              stroke="#fff"
              strokeWidth={1}
              label={false}
              labelLine={false}
              isAnimationActive
              animationDuration={CHART_ANIM_MS}
              animationEasing="ease-out"
            >
              {outerPieData.map((entry, i) => (
                <Cell key={entry.key} fill={outerSliceColor(i, outerCount)} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const payload = props.payload as readonly { payload?: OuterRow | InnerRow }[];
                const sample = payload[0]?.payload;
                if (sample && 'key' in sample) return tooltipOuter({ active: props.active, payload: payload as never });
                return tooltipInner({ active: props.active, payload: payload as never });
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {caption}
    </>
  );

  if (fillHeight) {
    return (
      <div
        className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col transition-opacity duration-300 ease-out"
        data-testid="chats-message-modality-distribution-chart"
        key={`${outerPieData.map((r) => r.key).join('|')}-${innerPieData.map((r) => r.id).join(',')}`}
      >
        {chartSection}
      </div>
    );
  }

  return (
    <div
      className="flex w-full min-w-0 shrink-0 flex-col"
      style={CHART_MOUNT_STYLE}
      data-testid="chats-message-modality-distribution-chart"
      key={`${outerPieData.map((r) => r.key).join('|')}-${innerPieData.map((r) => r.id).join(',')}`}
    >
      {chartSection}
    </div>
  );
}
