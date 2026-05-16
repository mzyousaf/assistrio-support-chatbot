import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import {
  countLoadedLeadsWithEmail,
  countLoadedLeadsWithName,
  latestLeadCapturedDisplay,
  latestLeadCapturedDisplayFromIso,
} from './leadsUiHelpers';
import { Users, User, Mail, Clock } from 'lucide-react';

type Props = {
  leads: CustomerLeadListItem[];
  leadFieldDefinitions: CustomerLeadFieldDefinition[];
  /** When set (API), summary uses filtered totals instead of the current `leads` page. */
  totalMatching?: number;
  matchingWithNameCount?: number;
  matchingWithEmailCount?: number;
  latestMatchingCapturedAt?: string | null;
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="relative flex gap-2.5 overflow-hidden rounded-lg border border-slate-200/85 bg-white py-2.5 pl-3 pr-3 shadow-sm"
      style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 72%, transparent)' }}
    >
      <div className="absolute left-0 top-0 h-full w-0.5 bg-teal-500/90" aria-hidden />
      <div className="flex shrink-0 items-start pt-0.5 text-teal-600/90">
        <Icon size={15} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pl-2">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="m-0 mt-0.5 text-base font-semibold tabular-nums leading-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function LeadsSummaryCards({
  leads,
  leadFieldDefinitions,
  totalMatching,
  matchingWithNameCount,
  matchingWithEmailCount,
  latestMatchingCapturedAt,
}: Props) {
  const nameN = matchingWithNameCount ?? countLoadedLeadsWithName(leads, leadFieldDefinitions);
  const emailN = matchingWithEmailCount ?? countLoadedLeadsWithEmail(leads, leadFieldDefinitions);
  const total = totalMatching ?? leads.length;
  const latest =
    latestMatchingCapturedAt !== undefined
      ? latestLeadCapturedDisplayFromIso(latestMatchingCapturedAt)
      : latestLeadCapturedDisplay(leads);

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <StatCard icon={Users} label="Total Leads" value={total} />
      <StatCard icon={User} label="With name" value={nameN} />
      <StatCard icon={Mail} label="With email" value={emailN} />
      <StatCard icon={Clock} label="Latest captured" value={latest === '—' ? '—' : latest} />
    </div>
  );
}
