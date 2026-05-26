import { useCallback, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { CustomerBotListItem } from '@/api/types';
import { FilterCapsule } from '@/components/ui';
import type { StandardDateControlValues } from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import {
  CoreDateGranularityPreviewCapsules,
  dateRangeMatchesDefault,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsInsightsFilterBars';
import { CHATS_ANALYTICS_DEFAULTS } from '@/lib/chatsAnalyticsQuery';

export const USAGE_DATE_FILTER_DEFAULTS: StandardDateControlValues = {
  preset: CHATS_ANALYTICS_DEFAULTS.preset,
  customFrom: CHATS_ANALYTICS_DEFAULTS.customFrom,
  customTo: CHATS_ANALYTICS_DEFAULTS.customTo,
  includePreview: CHATS_ANALYTICS_DEFAULTS.includePreview,
  startedFromKeys: [],
};

export type UsageFilterValues = {
  date: StandardDateControlValues;
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
  const [dateEngaged, setDateEngaged] = useState(false);
  const dateAtDefault = dateRangeMatchesDefault(values.date, USAGE_DATE_FILTER_DEFAULTS);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <CoreDateGranularityPreviewCapsules
        values={values.date}
        onValuesChange={(date) => onChange({ ...values, date })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        defaults={USAGE_DATE_FILTER_DEFAULTS}
        widgetSourceVariant="hidden"
        maxHistoryDays={maxHistoryDays}
        topicsDateEngagement={{
          quietValueRow: dateQuietValueRow,
          onEngagement: setDateEngaged,
        }}
        autoGranularityRangeFallbackDays={30}
        compactPanel
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
