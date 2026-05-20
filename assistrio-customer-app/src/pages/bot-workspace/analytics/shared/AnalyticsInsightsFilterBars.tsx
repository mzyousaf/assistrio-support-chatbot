import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { CustomerChatsAnalyticsStartedFromKey, CustomerSentimentLabelId } from '@/api/types';
import { FieldRow, FilterCapsule, Input } from '@/components/ui';
import { CHATS_ANALYTICS_DEFAULTS, type ChatsAnalyticsUiState } from '@/lib/chatsAnalyticsQuery';
import type { LeadsAnalyticsUiState, LeadsFieldCaptureStatusFilter } from '@/lib/leadsAnalyticsQuery';
import { LEADS_ANALYTICS_DEFAULTS } from '@/lib/leadsAnalyticsQuery';
import type { SentimentAnalyticsUiState } from '@/lib/sentimentAnalyticsQuery';
import { SENTIMENT_ANALYTICS_DEFAULTS } from '@/lib/sentimentAnalyticsQuery';
import type { TopicsAnalyticsUiState, TopicsMessageTopicScope } from '@/lib/topicsAnalyticsQuery';
import { TOPICS_ANALYTICS_DEFAULTS } from '@/lib/topicsAnalyticsQuery';
import type { AgentResourcesAnalyticsUiState } from '@/lib/agentResourcesAnalyticsQuery';
import { AGENT_RESOURCES_ANALYTICS_DEFAULTS } from '@/lib/agentResourcesAnalyticsQuery';
import { customYmdRangeIsValid } from '@/lib/analyticsQueryDates';
import { formatAnalyticsGranularityViewCaption, resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import { computeDateRangeFromAnalyticsPreset } from '@/lib/chatsAnalyticsQuery';
import { getLeadsFilterCountryOptions } from '@/pages/bot-workspace/leads/leadsFilterCountryOptions';
import { SENTIMENT_DISPLAY_FALLBACK, SENTIMENT_STACK_ORDER } from '@/pages/bot-workspace/analytics/sentiment/sentimentChartTheme';
import {
  ANALYTICS_DATE_PRESET_OPTIONS,
  analyticsDateRangeValueLabel,
  seedCustomRangeIfEmpty,
  type StandardDateControlValues,
} from './analyticsFilterCapsuleUtils';
import {
  WIDGET_CHANNEL_FIELD_LABEL,
  WIDGET_CHANNEL_SECTIONS,
  widgetStartedFromUiLabel,
} from './widgetChannelLabels';

export { WIDGET_CHANNEL_FIELD_LABEL, WIDGET_CHANNEL_SECTIONS, widgetStartedFromUiLabel };

type CapsuleKey = string | null;

export const ANALYTICS_DEVICE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
];

const PREVIEW_CHANNEL_IDS: CustomerChatsAnalyticsStartedFromKey[] = ['shared_preview', 'playground_preview'];

export function widgetChannelValueLabel(v: StandardDateControlValues): string {
  if (!v.includePreview && v.startedFromKeys.length === 0) return 'No preview traffic';
  if (v.startedFromKeys.length > 0) {
    const labels = v.startedFromKeys.map((id) => widgetStartedFromUiLabel(id));
    if (labels.length <= 3) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  }
  return 'All channels';
}

function sortedChannelKeysSig(keys: CustomerChatsAnalyticsStartedFromKey[]): string {
  return [...keys].sort().join('\0');
}

export function widgetChannelMatchesDefault(v: StandardDateControlValues, d: StandardDateControlValues): boolean {
  return (
    v.includePreview === d.includePreview &&
    sortedChannelKeysSig(v.startedFromKeys) === sortedChannelKeysSig(d.startedFromKeys)
  );
}

function toggleWidgetChannelSelection(
  values: StandardDateControlValues,
  id: CustomerChatsAnalyticsStartedFromKey,
): StandardDateControlValues {
  const has = values.startedFromKeys.includes(id);
  const nextKeys = has ? values.startedFromKeys.filter((k) => k !== id) : [...values.startedFromKeys, id];
  let includePreview = values.includePreview;
  if (nextKeys.some((k) => PREVIEW_CHANNEL_IDS.includes(k))) {
    includePreview = true;
  }
  return { ...values, startedFromKeys: nextKeys, includePreview };
}

export function dateRangeMatchesDefault(v: StandardDateControlValues, d: StandardDateControlValues): boolean {
  return (
    v.preset === d.preset &&
    v.customFrom.trim() === d.customFrom.trim() &&
    v.customTo.trim() === d.customTo.trim()
  );
}

const dateInputCls =
  'h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-[var(--color-teal-600)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-600)]/20';

export function CoreDateGranularityPreviewCapsules({
  values,
  onValuesChange,
  disabled,
  open,
  setOpen,
  closeAll,
  defaults,
  granularityPlacement = 'capsule',
  capsuleClearable = true,
  widgetSourceVariant = 'full',
  widgetTopicsEngagement,
  topicsDateEngagement,
  autoGranularityRangeFallbackDays = 30,
}: {
  values: StandardDateControlValues;
  onValuesChange: (next: StandardDateControlValues) => void;
  disabled?: boolean;
  open: CapsuleKey;
  setOpen: (k: CapsuleKey) => void;
  closeAll: () => void;
  defaults: StandardDateControlValues;
  /** @deprecated Kept for layout compatibility; chart bucketing is always automatic from the date range. */
  granularityPlacement?: 'capsule' | 'inDatePanel';
  /** When false, date / preview capsules use Plus only (no X reset). Default true. */
  capsuleClearable?: boolean;
  /** `hidden`: omit Widget Channel (e.g. reports whose API has no per-source filter). `full`: grouped channel pickers. */
  widgetSourceVariant?: 'full' | 'hidden';
  /**
   * Topics analytics only: “pristine” quiet chip at defaults until the user picks from the menu;
   * capsule X returns to pristine quiet defaults (no “All channels” row — default is label-only).
   */
  widgetTopicsEngagement?: {
    quietValueRow: boolean;
    onEngagement: (engaged: boolean) => void;
  };
  /**
   * Topics analytics only: quiet / engaged / X reset for the date capsule when it sits beside other topic filters.
   */
  topicsDateEngagement?: {
    quietValueRow: boolean;
    onEngagement: (engaged: boolean) => void;
  };
  /** Fallback window (days) when custom range inputs are invalid — must match the page’s API builder. */
  autoGranularityRangeFallbackDays?: number;
}) {
  const customInvalid =
    values.preset === 'custom' &&
    values.customFrom.trim() &&
    values.customTo.trim() &&
    !customYmdRangeIsValid(values.customFrom, values.customTo);

  const dateLabel = analyticsDateRangeValueLabel({
    preset: values.preset,
    customFrom: values.customFrom,
    customTo: values.customTo,
  });

  const resolvedGranularity = useMemo(() => {
    const { from, to } = computeDateRangeFromAnalyticsPreset(
      { preset: values.preset, customFrom: values.customFrom, customTo: values.customTo },
      { invalidCustomFallbackLastDays: autoGranularityRangeFallbackDays },
    );
    return resolveAnalyticsGranularity(from, to);
  }, [values.preset, values.customFrom, values.customTo, autoGranularityRangeFallbackDays]);

  const viewCaption = formatAnalyticsGranularityViewCaption(resolvedGranularity);

  const widgetChannelLabel = widgetChannelValueLabel(values);
  const widgetAtDefault = widgetChannelMatchesDefault(values, defaults);
  const widgetTopicsMode = widgetTopicsEngagement !== undefined;
  const widgetQuiet = Boolean(widgetTopicsMode && widgetTopicsEngagement.quietValueRow);
  const widgetChipHighlighted = widgetTopicsMode ? !widgetQuiet : !widgetAtDefault;

  const dateChipLabel =
    granularityPlacement === 'inDatePanel' ? `${dateLabel} · ${viewCaption}` : dateLabel;

  const topicsDateMode = topicsDateEngagement !== undefined && granularityPlacement === 'capsule';
  const dateQuiet = Boolean(topicsDateMode && topicsDateEngagement.quietValueRow);
  const dateChipHighlighted = topicsDateMode ? !dateQuiet : true;

  /** Non–Topics analytics: date chip always reads as selected (teal). Topics: driven by engagement + defaults. */
  const dateCapsuleApplied = !topicsDateMode;

  return (
    <>
      <FilterCapsule
        title="Date range"
        valueLabel={dateChipLabel}
        applied={dateCapsuleApplied}
        quietValueRow={dateQuiet}
        selectionVisible={dateChipHighlighted}
        clearable={topicsDateMode ? dateChipHighlighted : capsuleClearable}
        open={open === 'date'}
        onToggle={() => setOpen(open === 'date' ? null : 'date')}
        onClose={closeAll}
        onClear={() => {
          if (topicsDateMode) topicsDateEngagement.onEngagement(false);
          onValuesChange({
            ...values,
            preset: defaults.preset,
            customFrom: defaults.customFrom,
            customTo: defaults.customTo,
          });
          closeAll();
        }}
      >
        <div className="flex max-h-[min(24rem,70vh)] min-w-[15rem] flex-col gap-2 overflow-y-auto p-0.5">
          <ul className="m-0 list-none space-y-0.5 p-0 py-0.5">
            {ANALYTICS_DATE_PRESET_OPTIONS.map((opt) => {
              const selected = values.preset === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => {
                      if (opt.id === 'custom' && !values.customFrom.trim() && !values.customTo.trim()) {
                        onValuesChange({ ...values, preset: 'custom', ...seedCustomRangeIfEmpty() });
                      } else {
                        onValuesChange({ ...values, preset: opt.id });
                      }
                      if (topicsDateMode) topicsDateEngagement.onEngagement(true);
                      if (opt.id !== 'custom') closeAll();
                    }}
                  >
                    <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                      {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {values.preset === 'custom' ? (
            <div className="border-t border-slate-100 pt-2">
              <FieldRow label="From" htmlFor="analytics-cap-from">
                <input
                  id="analytics-cap-from"
                  type="date"
                  disabled={disabled}
                  value={values.customFrom}
                  onChange={(e) => {
                    onValuesChange({ ...values, customFrom: e.target.value });
                    if (topicsDateMode) topicsDateEngagement.onEngagement(true);
                  }}
                  className={dateInputCls}
                />
              </FieldRow>
              <FieldRow label="To" htmlFor="analytics-cap-to">
                <input
                  id="analytics-cap-to"
                  type="date"
                  disabled={disabled}
                  value={values.customTo}
                  onChange={(e) => {
                    onValuesChange({ ...values, customTo: e.target.value });
                    if (topicsDateMode) topicsDateEngagement.onEngagement(true);
                  }}
                  className={dateInputCls}
                />
              </FieldRow>
              {customInvalid ? (
                <p className="m-0 text-[0.7rem] leading-snug text-amber-700">End date must be on or after start date.</p>
              ) : null}
              <p className="m-0 text-[0.7rem] leading-snug text-slate-500">Uses your local timezone.</p>
            </div>
          ) : null}
          <div className="border-t border-slate-100 pt-2">
            <p className="m-0 text-[0.7rem] leading-snug text-slate-600">{viewCaption}</p>
            <p className="m-0 mt-0.5 text-[0.65rem] leading-snug text-slate-500">Based on the selected date range.</p>
          </div>
        </div>
      </FilterCapsule>

      {widgetSourceVariant !== 'hidden' ? (
      <FilterCapsule
        title={WIDGET_CHANNEL_FIELD_LABEL}
        valueLabel={widgetChannelLabel}
        applied={false}
        quietValueRow={widgetQuiet}
        selectionVisible={widgetChipHighlighted}
        clearable={widgetChipHighlighted}
        open={open === 'preview'}
        onToggle={() => setOpen(open === 'preview' ? null : 'preview')}
        onClose={closeAll}
        onClear={() => {
          if (widgetTopicsMode) widgetTopicsEngagement.onEngagement(false);
          onValuesChange({
            ...values,
            includePreview: defaults.includePreview,
            startedFromKeys: defaults.startedFromKeys ?? [],
          });
          closeAll();
        }}
      >
        <div className="m-0 max-h-[min(24rem,70vh)] min-w-[15rem] space-y-2 overflow-y-auto p-0 py-0.5">
          {WIDGET_CHANNEL_SECTIONS.map((sec) => (
            <div key={sec.title}>
              <p className="m-0 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{sec.title}</p>
              <ul className="m-0 list-none space-y-0.5 p-0">
                {sec.options.map((opt) => {
                  const selected = values.startedFromKeys.includes(opt.id);
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        disabled={disabled}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => {
                          onValuesChange(toggleWidgetChannelSelection(values, opt.id));
                          if (widgetTopicsMode) widgetTopicsEngagement.onEngagement(true);
                        }}
                      >
                        <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                          {selected ? (
                            <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </FilterCapsule>
      ) : null}
    </>
  );
}

function fieldCaptureFilterChipLabel(v: LeadsFieldCaptureStatusFilter): string {
  switch (v) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'deleted':
      return 'Deleted';
    default:
      return 'All';
  }
}

/** Mirrors {@link SentimentCapsule}: default shows “All” on the chip only; menu lists concrete statuses (no “All” row). */
function FieldCaptureCapsule({
  value,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
}: {
  value: LeadsFieldCaptureStatusFilter;
  onChange: (v: LeadsFieldCaptureStatusFilter) => void;
  disabled?: boolean;
  open: CapsuleKey;
  setOpen: (k: CapsuleKey) => void;
  closeAll: () => void;
}) {
  const applied = Boolean(value);
  const valueLabel = fieldCaptureFilterChipLabel(value);
  const captureStatuses: Exclude<LeadsFieldCaptureStatusFilter, ''>[] = ['active', 'inactive', 'deleted'];
  return (
    <FilterCapsule
      title="Captured fields"
      valueLabel={valueLabel}
      applied={applied}
      quietValueRow={!applied}
      open={open === 'fieldCapture'}
      onToggle={() => setOpen(open === 'fieldCapture' ? null : 'fieldCapture')}
      onClose={closeAll}
      onClear={() => {
        onChange('');
        closeAll();
      }}
    >
      <ul className="m-0 max-h-52 min-w-[12rem] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
        {captureStatuses.map((id) => {
          const selected = value === id;
          const lb = fieldCaptureFilterChipLabel(id);
          return (
            <li key={id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  onChange(id);
                  closeAll();
                }}
              >
                <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                  {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1">{lb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </FilterCapsule>
  );
}

export function CountryCapsule({
  value,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
  countryOptions,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  open: CapsuleKey;
  setOpen: (k: CapsuleKey) => void;
  closeAll: () => void;
  countryOptions: ReturnType<typeof getLeadsFilterCountryOptions>;
}) {
  const [countryQuery, setCountryQuery] = useState('');
  useEffect(() => {
    if (open !== 'country') setCountryQuery('');
  }, [open]);

  const applied = value.trim().length === 2;
  const selectedLine = applied
    ? countryOptions.find((c) => c.code === value.trim().toUpperCase())?.name ?? value
    : 'All';
  const quietValueRow = !applied;

  const filtered = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countryOptions;
    return countryOptions.filter(({ code, name }) => {
      const line = name.includes(`(${code})`) ? name : `${name} (${code})`;
      return line.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    });
  }, [countryOptions, countryQuery]);

  return (
    <FilterCapsule
      title="Country"
      valueLabel={selectedLine}
      applied={applied}
      quietValueRow={quietValueRow}
      selectionVisible={applied}
      clearable={applied}
      open={open === 'country'}
      onToggle={() => setOpen(open === 'country' ? null : 'country')}
      onClose={closeAll}
      onClear={() => {
        onChange('');
        closeAll();
      }}
    >
      <div className="flex min-w-[16rem] flex-col gap-2 p-0.5">
        <Input
          quiet
          inputSize="sm"
          value={countryQuery}
          onChange={(e) => setCountryQuery(e.target.value)}
          placeholder="Search country…"
          leadingIcon={<Search size={14} strokeWidth={2} className="text-slate-400" aria-hidden />}
          autoComplete="off"
          aria-label="Search countries"
        />
        <div className="my-0.5 border-t border-slate-200" role="separator" />
        <ul className="m-0 max-h-52 list-none space-y-0.5 overflow-y-auto p-0 py-0.5" role="listbox">
          {filtered.map(({ code, name }) => {
            const line = name.includes(`(${code})`) ? name : `${name} (${code})`;
            const selected = value.trim().toUpperCase() === code;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => {
                    onChange(code);
                    closeAll();
                  }}
                >
                  <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                    {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">{line}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </FilterCapsule>
  );
}

export function DeviceCapsule({
  value,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
  deviceOptions = ANALYTICS_DEVICE_FILTER_OPTIONS,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  open: CapsuleKey;
  setOpen: (k: CapsuleKey) => void;
  closeAll: () => void;
  deviceOptions?: { value: string; label: string }[];
}) {
  const trimmed = value.trim();
  const applied = Boolean(trimmed);
  const label = applied ? deviceOptions.find((d) => d.value === trimmed)?.label ?? trimmed : 'All';
  const quietValueRow = !applied;

  return (
    <FilterCapsule
      title="Device"
      valueLabel={label}
      applied={applied}
      quietValueRow={quietValueRow}
      selectionVisible={applied}
      clearable={applied}
      open={open === 'device'}
      onToggle={() => setOpen(open === 'device' ? null : 'device')}
      onClose={closeAll}
      onClear={() => {
        onChange('');
        closeAll();
      }}
    >
      <ul className="m-0 max-h-52 min-w-[11rem] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
        {deviceOptions.map((opt) => {
          const selected = value === opt.value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  onChange(opt.value);
                  closeAll();
                }}
              >
                <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                  {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </FilterCapsule>
  );
}

function AnalysisCapsule({
  value,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
  topicTagsEngagement,
}: {
  value: TopicsMessageTopicScope;
  onChange: (v: TopicsMessageTopicScope) => void;
  disabled?: boolean;
  open: CapsuleKey;
  setOpen: (k: CapsuleKey) => void;
  closeAll: () => void;
  topicTagsEngagement?: { engaged: boolean; setEngaged: (v: boolean) => void };
}) {
  const valueLabel = value === 'primary' ? 'Primary only' : 'All tags';
  const engaged = topicTagsEngagement?.engaged ?? false;
  const setEngaged = topicTagsEngagement?.setEngaged;
  const quietValueRow = Boolean(topicTagsEngagement && !engaged && value === 'primary');
  const chipHighlighted = topicTagsEngagement ? engaged || value !== 'primary' : value !== 'primary';

  return (
    <FilterCapsule
      title="Topic tags"
      valueLabel={valueLabel}
      applied={false}
      quietValueRow={quietValueRow}
      selectionVisible={chipHighlighted}
      clearable={chipHighlighted}
      open={open === 'analysis'}
      onToggle={() => setOpen(open === 'analysis' ? null : 'analysis')}
      onClose={closeAll}
      onClear={() => {
        onChange('primary');
        setEngaged?.(false);
        closeAll();
      }}
    >
      <div className="min-w-[15rem] px-1 py-0.5">
        <ul className="m-0 list-none space-y-0.5 p-0 py-0.5">
          <li key="accurate">
            <button
              type="button"
              role="option"
              aria-selected={value === 'primary'}
              disabled={disabled}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => {
                onChange('primary');
                setEngaged?.(true);
                closeAll();
              }}
            >
              <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                {value === 'primary' ? (
                  <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">Primary topic only</span>
            </button>
          </li>
          <li key="possibility">
            <button
              type="button"
              role="option"
              aria-selected={value === 'all'}
              disabled={disabled}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => {
                onChange('all');
                setEngaged?.(true);
                closeAll();
              }}
            >
              <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                {value === 'all' ? (
                  <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">All topic tags on the message</span>
            </button>
          </li>
        </ul>
      </div>
    </FilterCapsule>
  );
}

function SentimentCapsule({
  value,
  onChange,
  disabled,
  open,
  setOpen,
  closeAll,
  sentimentLabels,
}: {
  value: '' | CustomerSentimentLabelId;
  onChange: (v: '' | CustomerSentimentLabelId) => void;
  disabled?: boolean;
  open: CapsuleKey;
  setOpen: (k: CapsuleKey) => void;
  closeAll: () => void;
  sentimentLabels: Partial<Record<CustomerSentimentLabelId, string>>;
}) {
  const applied = Boolean(value);
  const valueLabel = applied
    ? sentimentLabels[value as CustomerSentimentLabelId] ??
      SENTIMENT_DISPLAY_FALLBACK[value as CustomerSentimentLabelId] ??
      value
    : 'All';
  return (
    <FilterCapsule
      title="Sentiment"
      valueLabel={valueLabel}
      applied={applied}
      quietValueRow={!applied}
      open={open === 'sentiment'}
      onToggle={() => setOpen(open === 'sentiment' ? null : 'sentiment')}
      onClose={closeAll}
      onClear={() => {
        onChange('');
        closeAll();
      }}
    >
      <ul className="m-0 max-h-52 min-w-[12rem] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
        {SENTIMENT_STACK_ORDER.map((id) => {
          const selected = value === id;
          const lb = sentimentLabels[id] ?? SENTIMENT_DISPLAY_FALLBACK[id] ?? id;
          return (
            <li key={id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  onChange(id);
                  closeAll();
                }}
              >
                <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                  {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1">{lb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </FilterCapsule>
  );
}

export function ChatsAnalyticsFilterBar({
  state,
  onChange,
  disabled,
}: {
  state: ChatsAnalyticsUiState;
  onChange: (next: ChatsAnalyticsUiState) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<CapsuleKey>(null);
  const closeAll = useCallback(() => setOpen(null), []);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);

  const values: StandardDateControlValues = {
    preset: state.preset,
    customFrom: state.customFrom,
    customTo: state.customTo,
    includePreview: state.includePreview,
    startedFromKeys: state.startedFromKeys,
  };
  const coreDef: StandardDateControlValues = {
    preset: CHATS_ANALYTICS_DEFAULTS.preset,
    customFrom: CHATS_ANALYTICS_DEFAULTS.customFrom,
    customTo: CHATS_ANALYTICS_DEFAULTS.customTo,
    includePreview: CHATS_ANALYTICS_DEFAULTS.includePreview,
    startedFromKeys: CHATS_ANALYTICS_DEFAULTS.startedFromKeys,
  };
  const widgetAtDefault = widgetChannelMatchesDefault(values, coreDef);
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;
  const dateAtDefault = dateRangeMatchesDefault(values, coreDef);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;
  const countryOptions = useMemo(() => getLeadsFilterCountryOptions(), []);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CoreDateGranularityPreviewCapsules
        values={values}
        onValuesChange={(v) => onChange({ ...state, ...v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        defaults={coreDef}
        topicsDateEngagement={{
          quietValueRow: dateQuietValueRow,
          onEngagement: setDateEngaged,
        }}
        autoGranularityRangeFallbackDays={7}
        widgetTopicsEngagement={{
          quietValueRow: widgetQuietValueRow,
          onEngagement: setWidgetEngaged,
        }}
      />
      <DeviceCapsule
        value={state.deviceType}
        onChange={(v) => onChange({ ...state, deviceType: v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
      />
      <CountryCapsule
        value={state.countryCode}
        onChange={(v) => onChange({ ...state, countryCode: v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        countryOptions={countryOptions}
      />
    </div>
  );
}

export function TopicsAnalyticsFilterBar({
  state,
  onChange,
  disabled,
}: {
  state: TopicsAnalyticsUiState;
  onChange: (next: TopicsAnalyticsUiState) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<CapsuleKey>(null);
  const closeAll = useCallback(() => setOpen(null), []);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [topicTagsEngaged, setTopicTagsEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);
  const values: StandardDateControlValues = {
    preset: state.preset,
    customFrom: state.customFrom,
    customTo: state.customTo,
    includePreview: state.includePreview,
    startedFromKeys: state.startedFromKeys,
  };
  const coreDef: StandardDateControlValues = {
    preset: TOPICS_ANALYTICS_DEFAULTS.preset,
    customFrom: TOPICS_ANALYTICS_DEFAULTS.customFrom,
    customTo: TOPICS_ANALYTICS_DEFAULTS.customTo,
    includePreview: TOPICS_ANALYTICS_DEFAULTS.includePreview,
    startedFromKeys: TOPICS_ANALYTICS_DEFAULTS.startedFromKeys,
  };
  const widgetAtDefault = widgetChannelMatchesDefault(values, coreDef);
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;
  const dateAtDefault = dateRangeMatchesDefault(values, coreDef);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;
  return (
  <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CoreDateGranularityPreviewCapsules
        values={values}
        onValuesChange={(v) => onChange({ ...state, ...v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        defaults={coreDef}
        topicsDateEngagement={{
          quietValueRow: dateQuietValueRow,
          onEngagement: setDateEngaged,
        }}
        autoGranularityRangeFallbackDays={7}
        widgetTopicsEngagement={{
          quietValueRow: widgetQuietValueRow,
          onEngagement: setWidgetEngaged,
        }}
      />
      {state.metricMode === 'messages' ? (
        <AnalysisCapsule
          value={state.messageTopicScope}
          onChange={(messageTopicScope) => onChange({ ...state, messageTopicScope })}
          disabled={disabled}
          open={open}
          setOpen={setOpen}
          closeAll={closeAll}
          topicTagsEngagement={{ engaged: topicTagsEngaged, setEngaged: setTopicTagsEngaged }}
        />
      ) : null}
    </div>
  );
}

export function SentimentAnalyticsFilterBar({
  state,
  onChange,
  disabled,
  sentimentLabels,
}: {
  state: SentimentAnalyticsUiState;
  onChange: (next: SentimentAnalyticsUiState) => void;
  disabled?: boolean;
  sentimentLabels: Partial<Record<CustomerSentimentLabelId, string>>;
}) {
  const [open, setOpen] = useState<CapsuleKey>(null);
  const closeAll = useCallback(() => setOpen(null), []);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);
  const values: StandardDateControlValues = {
    preset: state.preset,
    customFrom: state.customFrom,
    customTo: state.customTo,
    includePreview: state.includePreview,
    startedFromKeys: state.startedFromKeys,
  };
  const coreDef: StandardDateControlValues = {
    preset: SENTIMENT_ANALYTICS_DEFAULTS.preset,
    customFrom: SENTIMENT_ANALYTICS_DEFAULTS.customFrom,
    customTo: SENTIMENT_ANALYTICS_DEFAULTS.customTo,
    includePreview: SENTIMENT_ANALYTICS_DEFAULTS.includePreview,
    startedFromKeys: SENTIMENT_ANALYTICS_DEFAULTS.startedFromKeys,
  };
  const widgetAtDefault = widgetChannelMatchesDefault(values, coreDef);
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;
  const dateAtDefault = dateRangeMatchesDefault(values, coreDef);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CoreDateGranularityPreviewCapsules
        values={values}
        onValuesChange={(v) => onChange({ ...state, ...v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        defaults={coreDef}
        topicsDateEngagement={{
          quietValueRow: dateQuietValueRow,
          onEngagement: setDateEngaged,
        }}
        autoGranularityRangeFallbackDays={7}
        widgetTopicsEngagement={{
          quietValueRow: widgetQuietValueRow,
          onEngagement: setWidgetEngaged,
        }}
      />
      <SentimentCapsule
        value={state.sentiment}
        onChange={(v) => onChange({ ...state, sentiment: v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        sentimentLabels={sentimentLabels}
      />
    </div>
  );
}

export function AgentResourcesAnalyticsFilterBar({
  state,
  onChange,
  disabled,
}: {
  state: AgentResourcesAnalyticsUiState;
  onChange: (next: AgentResourcesAnalyticsUiState) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<CapsuleKey>(null);
  const closeAll = useCallback(() => setOpen(null), []);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);

  const values: StandardDateControlValues = {
    preset: state.preset,
    customFrom: state.customFrom,
    customTo: state.customTo,
    includePreview: state.includePreview,
    startedFromKeys: state.startedFromKeys,
  };
  const coreDef: StandardDateControlValues = {
    preset: AGENT_RESOURCES_ANALYTICS_DEFAULTS.preset,
    customFrom: AGENT_RESOURCES_ANALYTICS_DEFAULTS.customFrom,
    customTo: AGENT_RESOURCES_ANALYTICS_DEFAULTS.customTo,
    includePreview: AGENT_RESOURCES_ANALYTICS_DEFAULTS.includePreview,
    startedFromKeys: AGENT_RESOURCES_ANALYTICS_DEFAULTS.startedFromKeys,
  };
  const widgetAtDefault = widgetChannelMatchesDefault(values, coreDef);
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;
  const dateAtDefault = dateRangeMatchesDefault(values, coreDef);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CoreDateGranularityPreviewCapsules
        values={values}
        onValuesChange={(v) => onChange({ ...state, ...v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        defaults={coreDef}
        topicsDateEngagement={{
          quietValueRow: dateQuietValueRow,
          onEngagement: setDateEngaged,
        }}
        autoGranularityRangeFallbackDays={30}
        widgetTopicsEngagement={{
          quietValueRow: widgetQuietValueRow,
          onEngagement: setWidgetEngaged,
        }}
      />
    </div>
  );
}

export function LeadsAnalyticsFilterBar({
  state,
  onChange,
  disabled,
}: {
  state: LeadsAnalyticsUiState;
  onChange: (next: LeadsAnalyticsUiState) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<CapsuleKey>(null);
  const closeAll = useCallback(() => setOpen(null), []);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);
  const countryOptions = useMemo(() => getLeadsFilterCountryOptions(), []);
  const values: StandardDateControlValues = {
    preset: state.preset,
    customFrom: state.customFrom,
    customTo: state.customTo,
    includePreview: state.includePreview,
    startedFromKeys: state.startedFromKeys,
  };
  const coreDef: StandardDateControlValues = {
    preset: LEADS_ANALYTICS_DEFAULTS.preset,
    customFrom: LEADS_ANALYTICS_DEFAULTS.customFrom,
    customTo: LEADS_ANALYTICS_DEFAULTS.customTo,
    includePreview: LEADS_ANALYTICS_DEFAULTS.includePreview,
    startedFromKeys: LEADS_ANALYTICS_DEFAULTS.startedFromKeys,
  };
  const widgetAtDefault = widgetChannelMatchesDefault(values, coreDef);
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;
  const dateAtDefault = dateRangeMatchesDefault(values, coreDef);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CoreDateGranularityPreviewCapsules
        values={values}
        onValuesChange={(v) => onChange({ ...state, ...v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        defaults={coreDef}
        topicsDateEngagement={{
          quietValueRow: dateQuietValueRow,
          onEngagement: setDateEngaged,
        }}
        autoGranularityRangeFallbackDays={7}
        widgetTopicsEngagement={{
          quietValueRow: widgetQuietValueRow,
          onEngagement: setWidgetEngaged,
        }}
      />
      <FieldCaptureCapsule
        value={state.fieldCaptureStatus}
        onChange={(fieldCaptureStatus) => onChange({ ...state, fieldCaptureStatus })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
      />
      <CountryCapsule
        value={state.countryCode}
        onChange={(v) => onChange({ ...state, countryCode: v })}
        disabled={disabled}
        open={open}
        setOpen={setOpen}
        closeAll={closeAll}
        countryOptions={countryOptions}
      />
    </div>
  );
}
