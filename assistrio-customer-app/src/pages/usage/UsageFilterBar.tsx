import { useCallback, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { CustomerBotListItem } from '@/api/types';
import { FilterCapsule } from '@/components/ui';
import {
  DateRangeFilter,
  fromDateRangeFilterValue,
  toDateRangeFilterValue,
} from '@/components/analytics/DateRangeFilter';
import {
  filterAnalyticsDatePresetsForHistoryLimit,
  minAnalyticsCustomFromYmd,
} from '@/lib/analyticsEntitlementWindow';
import {
  USAGE_DATE_FILTER_DEFAULTS,
  usageDateRangeMatchesDefault,
  usageDateRangeValueLabel,
  type UsageDateFilterValues,
} from '@/lib/usageAnalyticsQuery';
import { cn } from '@/lib/utils';

export type UsageFilterValues = {
  date: UsageDateFilterValues;
  /** Empty = all agents. */
  agentIds: string[];
};

export const USAGE_FILTER_DEFAULTS: UsageFilterValues = {
  date: USAGE_DATE_FILTER_DEFAULTS,
  agentIds: [],
};

type Props = {
  values: UsageFilterValues;
  onChange: (next: UsageFilterValues) => void;
  agents: CustomerBotListItem[];
  disabled?: boolean;
  maxHistoryDays?: number | null;
};

function agentFilterValueLabel(selectedIds: string[], agents: CustomerBotListItem[]): string {
  if (selectedIds.length === 0) return 'All agents';
  if (selectedIds.length === 1) {
    const bot = agents.find((item) => item._id === selectedIds[0]);
    return bot?.name?.trim() || '1 agent';
  }
  return `${selectedIds.length} agents`;
}

function toggleAgentSelection(selectedIds: string[], botId: string): string[] {
  return selectedIds.includes(botId)
    ? selectedIds.filter((id) => id !== botId)
    : [...selectedIds, botId];
}

function UsageDateRangeCapsule({
  values,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
  maxHistoryDays,
}: {
  values: UsageDateFilterValues;
  onChange: (next: UsageDateFilterValues) => void;
  disabled?: boolean;
  open: string | null;
  setOpen: (key: string | null) => void;
  closeAll: () => void;
  maxHistoryDays?: number | null;
}) {
  const [engaged, setEngaged] = useState(false);
  const dateAtDefault = usageDateRangeMatchesDefault(values);
  const quietValueRow = !engaged && dateAtDefault;
  const datePresetOptions = useMemo(
    () =>
      filterAnalyticsDatePresetsForHistoryLimit(
        [
          { id: '7d', label: 'Last 7 days' },
          { id: '30d', label: 'Last 30 days' },
          { id: '90d', label: 'Last 90 days' },
          { id: 'custom', label: 'Custom range' },
        ],
        maxHistoryDays,
      ),
    [maxHistoryDays],
  );
  const customFromMin = minAnalyticsCustomFromYmd(maxHistoryDays);

  return (
    <FilterCapsule
      title="Date range"
      valueLabel={usageDateRangeValueLabel(values)}
      applied
      quietValueRow={quietValueRow}
      selectionVisible={!quietValueRow}
      clearable={!dateAtDefault}
      open={open === 'date'}
      onToggle={() => setOpen(open === 'date' ? null : 'date')}
      onClose={closeAll}
      onClear={() => {
        onChange(USAGE_DATE_FILTER_DEFAULTS);
        setEngaged(false);
        closeAll();
      }}
    >
      <div className="min-w-[11rem] p-0.5">
        <DateRangeFilter
          value={toDateRangeFilterValue({
            preset: values.preset,
            customFrom: values.customFrom,
            customTo: values.customTo,
          })}
          onChange={(next) => {
            setEngaged(true);
            onChange(fromDateRangeFilterValue(next) as UsageDateFilterValues);
          }}
          presets={datePresetOptions}
          disabled={disabled}
          align="right"
          compact
          minFromYmd={customFromMin}
          onAfterPresetSelect={closeAll}
          onAfterCustomApply={closeAll}
          footer={
            <p className={cn('m-0 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500')}>
              Applies to usage trend and AI credits by agent.
            </p>
          }
        />
      </div>
    </FilterCapsule>
  );
}

function UsageAgentFilterCapsule({
  agents,
  selectedIds,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
}: {
  agents: CustomerBotListItem[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  open: string | null;
  setOpen: (key: string | null) => void;
  closeAll: () => void;
}) {
  const [engaged, setEngaged] = useState(false);
  const applied = selectedIds.length > 0;
  const quietValueRow = !engaged && !applied;
  const valueLabel = agentFilterValueLabel(selectedIds, agents);
  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );

  return (
    <FilterCapsule
      title="Agent"
      valueLabel={valueLabel}
      applied={applied}
      quietValueRow={quietValueRow}
      selectionVisible={applied}
      clearable={applied}
      open={open === 'agent'}
      onToggle={() => setOpen(open === 'agent' ? null : 'agent')}
      onClose={closeAll}
      onClear={() => {
        onChange([]);
        setEngaged(false);
        closeAll();
      }}
    >
      <ul className="m-0 max-h-36 min-w-[11rem] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
        {sortedAgents.length === 0 ? (
          <li className="px-2 py-1 text-xs text-slate-500">No agents in this workspace.</li>
        ) : (
          sortedAgents.map((bot) => {
            const selected = selectedIds.includes(bot._id);
            return (
              <li key={bot._id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setEngaged(true);
                    onChange(toggleAgentSelection(selectedIds, bot._id));
                  }}
                >
                  <span className="flex w-3.5 shrink-0 justify-center" aria-hidden>
                    {selected ? (
                      <Check className="h-3 w-3 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{bot.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </FilterCapsule>
  );
}

export function UsageFilterBar({
  values,
  onChange,
  agents,
  disabled,
  maxHistoryDays = null,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const closeAll = useCallback(() => setOpen(null), []);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <UsageDateRangeCapsule
        values={values.date}
        onChange={(date) => onChange({ ...values, date })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        maxHistoryDays={maxHistoryDays}
      />
      <UsageAgentFilterCapsule
        agents={agents}
        selectedIds={values.agentIds}
        onChange={(agentIds) => onChange({ ...values, agentIds })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
      />
    </div>
  );
}

export function matchesUsageAgentFilter(botId: string, agentIds: string[]): boolean {
  return agentIds.length === 0 || agentIds.includes(botId);
}
