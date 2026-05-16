import { X } from 'lucide-react';
import type { CustomerBotLeadsListParams, CustomerLeadFieldDefinition } from '@/api/types';
import { formatStartedFromLabel } from '../conversations/ConversationStartedFromBadge';
import { formatCountryCodeWithNameLabel } from './leadsFilterCountryOptions';
import type { LeadsFilterChipId } from './leadsFiltersModel';

function fieldLabelForKey(defs: CustomerLeadFieldDefinition[], key: string): string {
  const k = key.trim();
  const d = defs.find((f) => f.key.trim() === k);
  return d?.label?.trim() || k;
}

function formatYmdForDisplay(iso: string): string {
  const t = iso.trim();
  if (!t) return '';
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return t.slice(0, 10);
  try {
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return t.slice(0, 10);
  }
}

export function listLeadsFilterChips(
  applied: CustomerBotLeadsListParams,
  fieldDefinitions: CustomerLeadFieldDefinition[],
): { id: LeadsFilterChipId; label: string }[] {
  const chips: { id: LeadsFilterChipId; label: string }[] = [];
  if (applied.dateFrom?.trim()) {
    chips.push({ id: 'dateFrom', label: `From date: ${formatYmdForDisplay(applied.dateFrom)}` });
  }
  if (applied.dateTo?.trim()) {
    chips.push({ id: 'dateTo', label: `To date: ${formatYmdForDisplay(applied.dateTo)}` });
  }
  if (applied.startedFrom?.trim()) {
    const raw = applied.startedFrom.trim();
    chips.push({
      id: 'startedFrom',
      label: `Started from: ${formatStartedFromLabel(raw) || raw.replace(/_/g, ' ')}`,
    });
  }
  if (applied.countryCode?.trim()) {
    const cc = applied.countryCode.trim();
    chips.push({
      id: 'countryCode',
      label: `Location: ${formatCountryCodeWithNameLabel(cc) || cc.toUpperCase()}`,
    });
  }
  if (applied.fieldKey?.trim()) {
    chips.push({
      id: 'fieldKey',
      label: `Field: ${fieldLabelForKey(fieldDefinitions, applied.fieldKey.trim())}`,
    });
  }
  if (applied.search?.trim()) {
    chips.push({ id: 'search', label: `Search: ${applied.search.trim()}` });
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
