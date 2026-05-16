import type { CustomerLeadsCityRow, CustomerLeadsCountryRow } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { formatCountryCodeWithNameLabel } from '@/pages/bot-workspace/leads/leadsFilterCountryOptions';

type Props = {
  countries: CustomerLeadsCountryRow[];
  cities: CustomerLeadsCityRow[];
};

function CountryRowBar({ row, maxLeads }: { row: CustomerLeadsCountryRow; maxLeads: number }) {
  const leads = Math.max(0, Math.trunc(row.leads ?? 0));
  const conv = Math.max(0, Math.trunc(row.conversations ?? 0));
  const w = maxLeads > 0 ? Math.round((leads / maxLeads) * 100) : 0;
  const label =
    row.country?.trim() ||
    (row.countryCode ? formatCountryCodeWithNameLabel(row.countryCode) : '') ||
    'Unknown';

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-slate-700" title={label}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-slate-500">
          {formatAnalyticsInteger(leads)} leads · {formatAnalyticsInteger(conv)} chats
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-600/85" style={{ width: `${Math.min(100, Math.max(leads > 0 ? 8 : 0, w))}%` }} />
      </div>
    </div>
  );
}

export function LeadsLocationPanel({ countries, cities }: Props) {
  const rankedCountries = [...countries]
    .filter((c) => (c.leads ?? 0) > 0 || (c.conversations ?? 0) > 0)
    .sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0) || (b.conversations ?? 0) - (a.conversations ?? 0));

  const maxLeads = Math.max(1, ...rankedCountries.map((c) => Math.max(0, Math.trunc(c.leads ?? 0))));

  const rankedCities = [...cities]
    .filter((c) => (c.leads ?? 0) > 0 || (c.conversations ?? 0) > 0)
    .sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0));

  const hasCountries = rankedCountries.length > 0;
  const hasCities = rankedCities.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <div className="min-w-0">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Leads by country</h3>
        <p className="mt-1 mb-0 text-[11px] leading-snug text-slate-500">Aggregate counts only (no precise location).</p>
        {!hasCountries ? (
          <p className="mt-4 mb-0 text-sm text-slate-500">No country data for this range.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {rankedCountries.slice(0, 12).map((c, i) => (
              <CountryRowBar key={`${c.countryCode ?? ''}-${c.country ?? ''}-${i}`} row={c} maxLeads={maxLeads} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Top cities</h3>
        <p className="mt-1 mb-0 text-[11px] leading-snug text-slate-500">City and country labels only.</p>
        {!hasCities ? (
          <p className="mt-4 mb-0 text-sm text-slate-500">No city data for this range.</p>
        ) : (
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[280px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">City</th>
                  <th className="px-3 py-2 font-semibold">Country</th>
                  <th className="px-3 py-2 text-right font-semibold">Leads</th>
                  <th className="px-3 py-2 text-right font-semibold">Chats</th>
                </tr>
              </thead>
              <tbody>
                {rankedCities.slice(0, 12).map((c, i) => (
                  <tr key={`${c.city}-${c.countryCode}-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{c.city?.trim() || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {c.countryCode ? formatCountryCodeWithNameLabel(c.countryCode) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{formatAnalyticsInteger(c.leads)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatAnalyticsInteger(c.conversations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
