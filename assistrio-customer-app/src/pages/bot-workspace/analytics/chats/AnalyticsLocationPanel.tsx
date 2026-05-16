import type { CustomerChatsAnalyticsCityRow, CustomerChatsAnalyticsCountryRow } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { formatCountryCodeWithNameLabel } from '@/pages/bot-workspace/leads/leadsFilterCountryOptions';

type Props = {
  countries: CustomerChatsAnalyticsCountryRow[];
  cities: CustomerChatsAnalyticsCityRow[];
};

function CountryBar({ row, maxTotal }: { row: CustomerChatsAnalyticsCountryRow; maxTotal: number }) {
  const sum = row.conversations + row.messages;
  const w = maxTotal > 0 ? Math.round((sum / maxTotal) * 100) : 0;
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
          {formatAnalyticsInteger(row.conversations)} / {formatAnalyticsInteger(row.messages)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-600/85"
          style={{ width: `${Math.min(100, Math.max(4, w))}%` }}
        />
      </div>
    </div>
  );
}

export function AnalyticsLocationPanel({ countries, cities }: Props) {
  const hasCountries = countries.some((c) => c.conversations > 0 || c.messages > 0);
  const hasCities = cities.some((c) => c.conversations > 0 || c.messages > 0);
  const maxCountryTotal = Math.max(
    1,
    ...countries.map((c) => c.conversations + c.messages),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Top countries</h3>
        {!hasCountries ? (
          <p className="mt-3 mb-0 text-sm text-slate-500">No location data yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {countries.slice(0, 8).map((c, i) => (
              <CountryBar key={`${c.countryCode ?? ''}-${c.country ?? ''}-${i}`} row={c} maxTotal={maxCountryTotal} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Top cities</h3>
        {!hasCities ? (
          <p className="mt-3 mb-0 text-sm text-slate-500">No city data yet.</p>
        ) : (
          <div className="mt-3 max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[320px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">City</th>
                  <th className="px-3 py-2 font-semibold">Country</th>
                  <th className="px-3 py-2 text-right font-semibold">Chats</th>
                  <th className="px-3 py-2 text-right font-semibold">Msgs</th>
                </tr>
              </thead>
              <tbody>
                {cities.slice(0, 12).map((c, i) => (
                  <tr key={`${c.city}-${c.countryCode}-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{c.city?.trim() || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {c.countryCode ? formatCountryCodeWithNameLabel(c.countryCode) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {formatAnalyticsInteger(c.conversations)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {formatAnalyticsInteger(c.messages)}
                    </td>
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
