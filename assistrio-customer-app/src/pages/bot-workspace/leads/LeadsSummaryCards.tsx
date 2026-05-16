import type { CustomerLeadListItem } from '@/api/types';
import { latestLeadCapturedDisplay, latestLeadCapturedDisplayFromIso } from './leadsUiHelpers';
import { Users, ClipboardCheck, Clipboard, Clock } from 'lucide-react';

type Props = {
  leads: CustomerLeadListItem[];
  /** When set (API), total uses filtered count across pages. */
  totalMatching?: number;
  matchingCompleteLeadsCount: number;
  matchingPartialLeadsCount: number;
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
      className="relative flex gap-3 overflow-hidden rounded-lg border border-slate-200/85 bg-white py-3.5 pl-3.5 pr-3.5 shadow-sm sm:py-4 sm:pl-4 sm:pr-4"
      style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 72%, transparent)' }}
    >
      <div className="absolute left-0 top-0 h-full w-0.5 bg-teal-500/90" aria-hidden />
      <div className="flex shrink-0 items-start pt-0.5 text-teal-600/90">
        <Icon size={17} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pl-2">
        <p className="m-0 text-[11px] font-normal uppercase tracking-wide text-slate-500">{label}</p>
        <p className="m-0 mt-1 text-lg font-normal tabular-nums leading-snug text-slate-900 sm:text-xl">{value}</p>
      </div>
    </div>
  );
}

export function LeadsSummaryCards({
  leads,
  totalMatching,
  matchingCompleteLeadsCount,
  matchingPartialLeadsCount,
  latestMatchingCapturedAt,
}: Props) {
  const total = totalMatching ?? leads.length;
  const latest =
    latestMatchingCapturedAt !== undefined
      ? latestLeadCapturedDisplayFromIso(latestMatchingCapturedAt)
      : latestLeadCapturedDisplay(leads);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={Users} label="Total Leads" value={total} />
      <StatCard icon={ClipboardCheck} label="Complete leads" value={matchingCompleteLeadsCount} />
      <StatCard icon={Clipboard} label="Partial leads" value={matchingPartialLeadsCount} />
      <StatCard icon={Clock} label="Latest captured" value={latest === '—' ? '—' : latest} />
    </div>
  );
}
