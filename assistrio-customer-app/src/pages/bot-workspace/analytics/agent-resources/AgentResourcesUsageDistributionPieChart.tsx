import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageTimePoint,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import { formatAnalyticsCreditsWithUnit, formatAnalyticsDateLabel } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import {
  buildUsageCreditRuleLookup,
  usageCreditSplitFromTimePoint,
} from './agentResourcesUsageCredits.util';
import { AGENT_RESOURCES_USAGE_SERIES } from './agentResourcesUsageTrendTheme';

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
  points: CustomerAgentResourcesUsageTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  creditRules: CustomerAgentResourcesUsageCreditRule[];
  hiddenSeriesIds: string[];
  fillHeight?: boolean;
};

const CHART_MOUNT_STYLE: { minHeight: number; height: string } = {
  minHeight: 260,
  height: 'clamp(260px, min(360px, 55vh), 560px)',
};

export function AgentResourcesUsageDistributionPieChart({
  points,
  granularity,
  creditRules,
  hiddenSeriesIds,
  fillHeight = false,
}: Props) {
  const ruleByUsageType = useMemo(() => buildUsageCreditRuleLookup(creditRules), [creditRules]);

  const visibleBarSeries = useMemo(
    () =>
      AGENT_RESOURCES_USAGE_SERIES.filter(
        (s) => s.id !== 'totalCreditsUsed' && !hiddenSeriesIds.includes(s.id),
      ),
    [hiddenSeriesIds],
  );

  const { outerPieData, innerPieData } = useMemo(() => {
    const outer: OuterRow[] = [];
    for (const p of points) {
      const split = usageCreditSplitFromTimePoint(p, ruleByUsageType);
      const v = split.totalCreditsUsed;
      if (!Number.isFinite(v) || v <= 0) continue;
      outer.push({
        key: String(p.date),
        name: formatAnalyticsDateLabel(p.date, granularity),
        value: v,
      });
    }

    const sums = {
      textCredits: 0,
      voiceCredits: 0,
      dictationCredits: 0,
    };
    for (const p of points) {
      const split = usageCreditSplitFromTimePoint(p, ruleByUsageType);
      sums.textCredits += split.textCredits;
      sums.voiceCredits += split.voiceCredits;
      sums.dictationCredits += split.dictationCredits;
    }

    const inner: InnerRow[] = [];
    for (const s of visibleBarSeries) {
      const v = Number(sums[s.id as keyof typeof sums] ?? 0);
      if (!Number.isFinite(v) || v <= 0) continue;
      inner.push({
        id: s.id,
        name: s.label,
        value: v,
        color: s.color,
      });
    }

    return { outerPieData: outer, innerPieData: inner };
  }, [points, granularity, ruleByUsageType, visibleBarSeries]);

  const outerTotal = useMemo(() => outerPieData.reduce((a, b) => a + b.value, 0), [outerPieData]);
  const innerTotal = useMemo(() => innerPieData.reduce((a, b) => a + b.value, 0), [innerPieData]);

  const hasSignal =
    points.length > 0 &&
    points.some((p) => {
      const split = usageCreditSplitFromTimePoint(p, ruleByUsageType);
      return (
        split.textCredits > 0 ||
        split.voiceCredits > 0 ||
        split.dictationCredits > 0 ||
        split.totalCreditsUsed > 0
      );
    });

  if (!points.length || !hasSignal || outerPieData.length === 0) {
    return (
      <div
        className={fillHeight ? 'flex h-full min-h-0 w-full flex-1 flex-col' : 'w-full min-w-0'}
        style={fillHeight ? undefined : CHART_MOUNT_STYLE}
        data-testid="agent-resources-usage-distribution-chart"
      >
        <AnalyticsChartEmpty
          message="No AI Credits Usage in this range yet. AI Credits apply when visitors message your assistant."
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
      Number.isFinite(pct) && pct > 0 ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)}%)` : '';
    return (
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
        <p className="m-0 mb-1 font-semibold text-slate-800">{row.name}</p>
        <p className="m-0 tabular-nums text-slate-600">
          {formatAnalyticsCreditsWithUnit(row.value)}
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
      Number.isFinite(pct) && pct > 0 ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)}%)` : '';
    return (
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
        <p className="m-0 mb-1 font-semibold text-slate-800">{row.name}</p>
        <p className="m-0 tabular-nums text-slate-600">
          {formatAnalyticsCreditsWithUnit(row.value)}
          {pctLabel} of usage split
        </p>
      </div>
    );
  };

  const outerCount = outerPieData.length;

  const caption = (
    <p className="m-0 mt-1 shrink-0 text-center text-[10px] leading-snug text-slate-500 sm:text-[11px]">
      {showInnerDisk ? (
        <>
          Outer ring · AI Credits per time bucket (matches teal trend scale). Inner disk · modality AI Credits mix (matches stacked
          bars).
        </>
      ) : (
        <>
          Outer ring only · AI Credits per time bucket (enable text, voice, or dictation in the list for the inner usage split).
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
        data-testid="agent-resources-usage-distribution-chart"
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
      data-testid="agent-resources-usage-distribution-chart"
      key={`${outerPieData.map((r) => r.key).join('|')}-${innerPieData.map((r) => r.id).join(',')}`}
    >
      {chartSection}
    </div>
  );
}
