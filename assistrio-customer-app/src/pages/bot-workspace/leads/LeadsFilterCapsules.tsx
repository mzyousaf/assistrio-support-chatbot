import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { CustomerBotLeadsListParams, CustomerLeadFieldDefinition } from '@/api/types';
import { FieldRow, FilterCapsule, Input } from '@/components/ui';
import { formatStartedFromLabel } from '../conversations/ConversationStartedFromBadge';
import {
  apiParamsToLeadsDraft,
  hasAnyLeadsFilters,
  leadsDraftToApiParams,
  leadsFilterFieldKeyOptions,
  type LeadsFiltersDraft,
  type StartedFromLeadsFilterValue,
} from './leadsFiltersModel';
import { getLeadsFilterCountryOptions, formatCountryCodeWithNameLabel } from './leadsFilterCountryOptions';

type OpenKey = null | 'date' | 'started' | 'country' | 'field';

type StartedFromMenuId = Exclude<StartedFromLeadsFilterValue, ''>;

const STARTED_OPTIONS: { id: StartedFromMenuId; label: string }[] = [
  { id: 'playground_preview', label: 'Playground' },
  { id: 'shared_preview', label: 'Shared preview' },
  { id: 'runtime_widget', label: 'Widget' },
  { id: 'runtime_iframe', label: 'IFrame' },
  { id: 'unknown', label: 'Unknown' },
];

function formatYmdChip(ymd: string): string {
  const t = ymd.trim();
  if (!t) return '';
  const d = new Date(`${t}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return t;
  try {
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return t;
  }
}

type Props = {
  applied: CustomerBotLeadsListParams;
  fieldDefinitions: CustomerLeadFieldDefinition[];
  /** ISO country/region codes seen on loaded leads (merged into location filter list). */
  countryCodesFromLeads?: string[];
  onAppliedChange: (next: CustomerBotLeadsListParams) => void;
  /** Clears every filter dimension (including search) at once. */
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

  const closeAll = useCallback(() => setOpenFilter(null), []);

  const commit = useCallback(
    (partial: Partial<LeadsFiltersDraft>) => {
      const d = apiParamsToLeadsDraft(applied);
      const nextDraft: LeadsFiltersDraft = { ...d, ...partial };
      onAppliedChange(leadsDraftToApiParams(nextDraft));
    },
    [applied, onAppliedChange],
  );

  const dateApplied = Boolean(draft.dateFrom.trim() || draft.dateTo.trim());
  const dateValueLabel = (() => {
    const a = draft.dateFrom.trim();
    const b = draft.dateTo.trim();
    if (a && b) return `${formatYmdChip(a)} – ${formatYmdChip(b)}`;
    if (a) return `From ${formatYmdChip(a)}`;
    if (b) return `Until ${formatYmdChip(b)}`;
    return '';
  })();

  const startedApplied = Boolean(draft.startedFrom);
  const startedLabel = draft.startedFrom
    ? formatStartedFromLabel(draft.startedFrom) || draft.startedFrom.replace(/_/g, ' ')
    : '';

  const countryApplied = draft.countryCode.trim().length === 2;
  const countryValueLabel = countryApplied ? formatCountryCodeWithNameLabel(draft.countryCode) : '';

  const fieldKeys = useMemo(() => leadsFilterFieldKeyOptions(fieldDefinitions), [fieldDefinitions]);
  const fieldApplied = Boolean(draft.fieldKey.trim());
  const fieldValueLabel = (() => {
    if (!fieldApplied) return '';
    const k = draft.fieldKey.trim();
    const def = fieldDefinitions.find((f) => f.key.trim() === k);
    return def?.label?.trim() || k;
  })();

  const [fieldQuery, setFieldQuery] = useState('');
  useEffect(() => {
    if (openFilter === 'field') setFieldQuery('');
  }, [openFilter]);

  const [countryQuery, setCountryQuery] = useState('');
  useEffect(() => {
    if (openFilter === 'country') setCountryQuery('');
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

  const filteredCountryOptions = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countryOptions;
    return countryOptions.filter(({ code, name }) => {
      const line = name.includes(`(${code})`) ? name : `${name} (${code})`;
      return line.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    });
  }, [countryOptions, countryQuery]);

  return (
    <>
      <FilterCapsule
        title="Date"
        valueLabel={dateValueLabel}
        applied={dateApplied}
        open={openFilter === 'date'}
        onToggle={() => setOpenFilter((f) => (f === 'date' ? null : 'date'))}
        onClose={closeAll}
        onClear={() => {
          commit({ dateFrom: '', dateTo: '' });
          closeAll();
        }}
      >
        <div className="flex min-w-[15rem] flex-col gap-3 p-0.5">
          <FieldRow label="From" htmlFor="leads-cap-from">
            <input
              id="leads-cap-from"
              type="date"
              value={draft.dateFrom}
              onChange={(e) => commit({ dateFrom: e.target.value })}
              className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-[var(--color-teal-600)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-600)]/20"
              aria-label="Captured from date"
            />
          </FieldRow>
          <FieldRow label="To" htmlFor="leads-cap-to">
            <input
              id="leads-cap-to"
              type="date"
              value={draft.dateTo}
              onChange={(e) => commit({ dateTo: e.target.value })}
              className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-[var(--color-teal-600)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-600)]/20"
              aria-label="Captured to date"
            />
          </FieldRow>
          <p className="m-0 text-[0.7rem] leading-snug text-slate-500">
            Uses your local timezone. Matches when the lead was captured.
          </p>
        </div>
      </FilterCapsule>

      <FilterCapsule
        title="Started from"
        valueLabel={startedLabel}
        applied={startedApplied}
        open={openFilter === 'started'}
        onToggle={() => setOpenFilter((f) => (f === 'started' ? null : 'started'))}
        onClose={closeAll}
        onClear={() => {
          commit({ startedFrom: '' });
          closeAll();
        }}
      >
        <ul className="m-0 max-h-52 min-w-[12rem] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
          {STARTED_OPTIONS.map((opt) => {
            const selected = (draft.startedFrom || '') === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    commit({ startedFrom: opt.id });
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

      <FilterCapsule
        title="Location"
        valueLabel={countryValueLabel}
        applied={countryApplied}
        open={openFilter === 'country'}
        onToggle={() => setOpenFilter((f) => (f === 'country' ? null : 'country'))}
        onClose={closeAll}
        onClear={() => {
          commit({ countryCode: '' });
          closeAll();
        }}
      >
        <div className="flex min-w-[16rem] flex-col gap-2 p-0.5">
          <Input
            quiet
            inputSize="sm"
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="Select Location"
            leadingIcon={<Search size={14} strokeWidth={2} className="text-slate-400" aria-hidden />}
            autoComplete="off"
            id="leads-loc-search"
            aria-label="Search location by name or code"
          />
          <div className="my-0.5 border-t border-slate-200" role="separator" />
          {filteredCountryOptions.length === 0 ? (
            <p className="m-0 px-2 py-3 text-center text-xs text-slate-500">No matches</p>
          ) : (
            <ul className="m-0 max-h-52 list-none space-y-0.5 overflow-y-auto p-0 py-0.5" role="listbox" aria-label="Locations">
              {filteredCountryOptions.map(({ code, name }) => {
                const line = name.includes(`(${code})`) ? name : `${name} (${code})`;
                const selected = draft.countryCode.trim().toUpperCase() === code;
                return (
                  <li key={code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        commit({ countryCode: code });
                        closeAll();
                      }}
                    >
                      <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                        {selected ? (
                          <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">{line}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </FilterCapsule>

      <FilterCapsule
        title="Field"
        valueLabel={fieldValueLabel}
        applied={fieldApplied}
        open={openFilter === 'field'}
        onToggle={() => setOpenFilter((f) => (f === 'field' ? null : 'field'))}
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
    </>
  );
}
