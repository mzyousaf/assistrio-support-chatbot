import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { CustomerBotLeadsListParams, CustomerLeadFieldDefinition } from '@/api/types';
import { FilterCapsule, Input } from '@/components/ui';
import type { StandardDateControlValues } from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import {
  CoreDateGranularityPreviewCapsules,
  CountryCapsule,
  dateRangeMatchesDefault,
  widgetChannelMatchesDefault,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsInsightsFilterBars';
import {
  apiParamsToLeadsDraft,
  defaultLeadsFiltersDraft,
  hasAnyLeadsFilters,
  leadsDraftToApiParams,
  leadsFilterFieldKeyOptions,
  type LeadsFiltersDraft,
} from './leadsFiltersModel';
import { getLeadsFilterCountryOptions } from './leadsFilterCountryOptions';

type OpenKey = string | null;

const LEAD_STATUS_MENU: { id: 'complete' | 'partial'; label: string }[] = [
  { id: 'complete', label: 'Complete' },
  { id: 'partial', label: 'Partial' },
];

function draftToStandard(d: LeadsFiltersDraft): StandardDateControlValues {
  return {
    preset: d.datePreset,
    customFrom: d.customFrom,
    customTo: d.customTo,
    includePreview: d.includePreview,
    startedFromKeys: d.startedFromKeys,
  };
}

type Props = {
  applied: CustomerBotLeadsListParams;
  fieldDefinitions: CustomerLeadFieldDefinition[];
  countryCodesFromLeads?: string[];
  onAppliedChange: (next: CustomerBotLeadsListParams) => void;
  onClearAll?: () => void;
};

export function LeadsFilterCapsules({
  applied,
  fieldDefinitions,
  countryCodesFromLeads,
  onAppliedChange,
  onClearAll,
}: Props) {
  const draft = useMemo(() => apiParamsToLeadsDraft(applied), [applied]);
  const anyActive = useMemo(() => hasAnyLeadsFilters(draft), [draft]);
  const [openFilter, setOpenFilter] = useState<OpenKey>(null);
  const [widgetEngaged, setWidgetEngaged] = useState(false);
  const [dateEngaged, setDateEngaged] = useState(false);

  const closeAll = useCallback(() => setOpenFilter(null), []);

  const coreStandard = useMemo(() => draftToStandard(defaultLeadsFiltersDraft()), []);

  const standardValues = useMemo(() => draftToStandard(draft), [draft]);

  const commit = useCallback(
    (partial: Partial<LeadsFiltersDraft>) => {
      const d = apiParamsToLeadsDraft(applied);
      onAppliedChange(leadsDraftToApiParams({ ...d, ...partial }));
    },
    [applied, onAppliedChange],
  );

  const onStandardChange = useCallback(
    (v: StandardDateControlValues) => {
      const d = apiParamsToLeadsDraft(applied);
      onAppliedChange(
        leadsDraftToApiParams({
          ...d,
          datePreset: v.preset,
          customFrom: v.customFrom,
          customTo: v.customTo,
          includePreview: v.includePreview,
          startedFromKeys: v.startedFromKeys,
        }),
      );
    },
    [applied, onAppliedChange],
  );

  const widgetAtDefault = widgetChannelMatchesDefault(standardValues, coreStandard);
  const widgetQuietValueRow = !widgetEngaged && widgetAtDefault;
  const dateAtDefault = dateRangeMatchesDefault(standardValues, coreStandard);
  const dateQuietValueRow = !dateEngaged && dateAtDefault;

  const fieldKeys = useMemo(() => leadsFilterFieldKeyOptions(fieldDefinitions), [fieldDefinitions]);
  const fieldApplied = Boolean(draft.fieldKey.trim());
  const fieldValueLabel = (() => {
    if (!fieldApplied) return 'All';
    const k = draft.fieldKey.trim();
    const def = fieldDefinitions.find((f) => f.key.trim() === k);
    return def?.label?.trim() || k;
  })();

  const leadStatusApplied = Boolean(draft.leadCompletion);
  const leadStatusLabel =
    draft.leadCompletion === 'complete'
      ? 'Complete'
      : draft.leadCompletion === 'partial'
        ? 'Partial'
        : 'All';

  const [fieldQuery, setFieldQuery] = useState('');
  useEffect(() => {
    if (openFilter !== 'inboxField') setFieldQuery('');
  }, [openFilter]);

  const countryOptions = useMemo(() => {
    const extras: string[] = [...(countryCodesFromLeads ?? [])];
    const cur = applied.countryCode?.trim().toUpperCase();
    if (cur && cur.length === 2) extras.push(cur);
    return getLeadsFilterCountryOptions(extras);
  }, [countryCodesFromLeads, applied.countryCode]);

  const filteredFieldKeys = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase();
    if (!q) return fieldKeys;
    return fieldKeys.filter((k) => {
      const def = fieldDefinitions.find((f) => f.key === k);
      const label = (def?.label?.trim() || k).toLowerCase();
      return label.includes(q) || k.toLowerCase().includes(q);
    });
  }, [fieldKeys, fieldDefinitions, fieldQuery]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CoreDateGranularityPreviewCapsules
        values={standardValues}
        onValuesChange={onStandardChange}
        disabled={false}
        open={openFilter}
        setOpen={setOpenFilter}
        closeAll={closeAll}
        defaults={coreStandard}
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
      <CountryCapsule
        value={draft.countryCode}
        onChange={(countryCode) => commit({ countryCode })}
        disabled={false}
        open={openFilter}
        setOpen={setOpenFilter}
        closeAll={closeAll}
        countryOptions={countryOptions}
      />
      <FilterCapsule
        title="Captured fields"
        valueLabel={fieldValueLabel}
        applied={fieldApplied}
        quietValueRow={!fieldApplied}
        open={openFilter === 'inboxField'}
        onToggle={() => setOpenFilter((f) => (f === 'inboxField' ? null : 'inboxField'))}
        onClose={closeAll}
        onClear={() => {
          commit({ fieldKey: '' });
          closeAll();
        }}
      >
        <div className="flex min-w-[14rem] flex-col gap-2">
          <Input
            quiet
            inputSize="sm"
            value={fieldQuery}
            onChange={(e) => setFieldQuery(e.target.value)}
            placeholder="Search fields…"
            leadingIcon={<Search size={14} strokeWidth={2} className="text-slate-400" aria-hidden />}
            autoComplete="off"
            aria-label="Search lead field names"
          />
          <div className="my-1 border-t border-slate-200" role="separator" />
          <ul className="m-0 max-h-52 space-y-0.5 overflow-y-auto py-0.5">
            {filteredFieldKeys.map((k) => {
              const selected = draft.fieldKey.trim() === k;
              const def = fieldDefinitions.find((f) => f.key === k);
              const label = def?.label?.trim() || k;
              return (
                <li key={k}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      commit({ fieldKey: k });
                      closeAll();
                    }}
                  >
                    <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </FilterCapsule>
      <FilterCapsule
        title="Lead status"
        valueLabel={leadStatusLabel}
        applied={leadStatusApplied}
        quietValueRow={!leadStatusApplied}
        open={openFilter === 'leadStatus'}
        onToggle={() => setOpenFilter((f) => (f === 'leadStatus' ? null : 'leadStatus'))}
        onClose={closeAll}
        onClear={() => {
          commit({ leadCompletion: '' });
          closeAll();
        }}
      >
        <ul className="m-0 max-h-52 min-w-[12rem] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
          {LEAD_STATUS_MENU.map((opt) => {
            const selected = draft.leadCompletion === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    commit({ leadCompletion: opt.id });
                    closeAll();
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
      </FilterCapsule>
      {anyActive && onClearAll ? (
        <button
          type="button"
          className="h-9 shrink-0 border-0 bg-transparent px-0.5 text-left text-xs font-medium text-slate-600 underline decoration-slate-400/80 underline-offset-[0.2em] transition-[color,text-decoration-color] hover:bg-transparent hover:text-slate-900 hover:decoration-slate-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal-600)]/35"
          onClick={() => {
            closeAll();
            onClearAll();
          }}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
