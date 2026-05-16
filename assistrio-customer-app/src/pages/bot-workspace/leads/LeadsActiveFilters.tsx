import { X } from 'lucide-react';
import type { CustomerBotLeadsListParams, CustomerLeadFieldDefinition } from '@/api/types';
import type { StandardDateControlValues } from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import { analyticsDateRangeValueLabel } from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import { dateRangeMatchesDefault, widgetChannelValueLabel } from '@/pages/bot-workspace/analytics/shared/AnalyticsInsightsFilterBars';
import { formatCountryCodeWithNameLabel } from './leadsFilterCountryOptions';
import {
  apiParamsToLeadsDraft,
  defaultLeadsFiltersDraft,
  matchesDefaultLeadsWidgetFilters,
  type LeadsFilterChipId,
} from './leadsFiltersModel';

function fieldLabelForKey(defs: CustomerLeadFieldDefinition[], key: string): string {
  const k = key.trim();
  const d = defs.find((f) => f.key.trim() === k);
  return d?.label?.trim() || k;
}

function draftToStandard(d: ReturnType<typeof apiParamsToLeadsDraft>): StandardDateControlValues {
  return {
    preset: d.datePreset,
    customFrom: d.customFrom,
    customTo: d.customTo,
    includePreview: d.includePreview,
    startedFromKeys: d.startedFromKeys,
  };
}

export function listLeadsFilterChips(
  applied: CustomerBotLeadsListParams,
  fieldDefinitions: CustomerLeadFieldDefinition[],
): { id: LeadsFilterChipId; label: string }[] {
  const draft = apiParamsToLeadsDraft(applied);
  const chips: { id: LeadsFilterChipId; label: string }[] = [];

  const defDraft = defaultLeadsFiltersDraft();
  const coreStd = draftToStandard(defDraft);
  const curStd = draftToStandard(draft);

  if (!dateRangeMatchesDefault(curStd, coreStd)) {
    chips.push({
      id: 'dateRange',
      label: `Date range: ${analyticsDateRangeValueLabel({
        preset: draft.datePreset,
        customFrom: draft.customFrom,
        customTo: draft.customTo,
      })}`,
    });
  }

  if (!matchesDefaultLeadsWidgetFilters(draft)) {
    chips.push({
      id: 'widgetChannel',
      label: `Widget channel: ${widgetChannelValueLabel(curStd)}`,
    });
  }

  if (draft.countryCode.trim().length === 2) {
    const cc = draft.countryCode.trim();
    chips.push({
      id: 'countryCode',
      label: `Country: ${formatCountryCodeWithNameLabel(cc) || cc.toUpperCase()}`,
    });
  }
  if (draft.fieldKey.trim()) {
    chips.push({
      id: 'fieldKey',
      label: `Captured fields: ${fieldLabelForKey(fieldDefinitions, draft.fieldKey.trim())}`,
    });
  }
  if (draft.search.trim()) {
    chips.push({ id: 'search', label: `Search: ${draft.search.trim()}` });
  }
  if (draft.leadCompletion === 'complete' || draft.leadCompletion === 'partial') {
    chips.push({
      id: 'leadCompletion',
      label: `Lead status: ${draft.leadCompletion === 'complete' ? 'Complete' : 'Partial'}`,
    });
  }
  return chips;
}

type Props = {
  applied: CustomerBotLeadsListParams;
  fieldDefinitions: CustomerLeadFieldDefinition[];
  onRemoveChip: (id: LeadsFilterChipId) => void;
  onClearAll: () => void;
};

export function LeadsActiveFilters({ applied, fieldDefinitions, onRemoveChip, onClearAll }: Props) {
  const chips = listLeadsFilterChips(applied, fieldDefinitions);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/40 px-4 py-2.5 sm:px-5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active</span>
      {chips.map((c) => (
        <button
          key={`${c.id}-${c.label}`}
          type="button"
          onClick={() => onRemoveChip(c.id)}
          className="group inline-flex max-w-[min(100%,20rem)] items-center gap-1 rounded-full border border-teal-200/90 bg-white py-1 pl-2.5 pr-1 text-left text-xs font-medium text-teal-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/90"
        >
          <span className="min-w-0 truncate">{c.label}</span>
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-teal-700 hover:bg-teal-100"
            aria-hidden
          >
            <X size={12} strokeWidth={2.5} />
          </span>
          <span className="sr-only">Remove {c.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-xs font-semibold text-teal-700 underline-offset-2 hover:text-teal-900 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
