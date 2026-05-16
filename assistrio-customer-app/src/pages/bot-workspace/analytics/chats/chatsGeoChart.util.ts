import type { CustomerChatsAnalyticsCountryRow } from '@/api/types';

/** Google GeoChart data table: ISO 3166-1 alpha-2 codes + conversation counts. */
export type GeoChartDataTable = [['Country', 'Chats'], ...Array<[string, number]>];

/** GeoChart does not support a style role column; dim non-hovered values instead. */
const GEO_CHART_HOVER_DIM_FACTOR = 0.12;

/** ISO 3166-1 alpha-2 from GeoChart regionMouseOver / regionMouseOut events. */
export function isoCountryCodeFromGeoChartRegion(region: string | undefined | null): string | null {
  if (!region) return null;
  const code = region.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return code.length === 2 ? code : null;
}

export function countryCodeForGeoChart(row: CustomerChatsAnalyticsCountryRow): string | null {
  const cc = row.countryCode?.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return cc && cc.length === 2 ? cc : null;
}

/** Display label for ranking list (not sent to GeoChart). */
export function countryLabelForGeoChart(row: CustomerChatsAnalyticsCountryRow): string | null {
  const rawName = row.country?.trim();
  if (rawName && rawName.length > 1 && !/^unknown$/i.test(rawName)) {
    return rawName;
  }
  const cc = countryCodeForGeoChart(row);
  if (!cc) return null;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(cc);
    return name && name !== cc ? name : cc;
  } catch {
    return cc;
  }
}

export function hasChatsCountrySignal(countries: CustomerChatsAnalyticsCountryRow[]): boolean {
  return countries.some((c) => c.conversations > 0);
}

/** True when GeoChart has at least one country row (not just the header). */
export function hasChatsGeoChartDataRows(data: GeoChartDataTable): boolean {
  return data.length > 1;
}

/** Build GeoChart rows keyed by ISO country code; merges duplicates. Always includes header row. */
export function buildChatsGeoChartData(countries: CustomerChatsAnalyticsCountryRow[]): GeoChartDataTable {
  const totals = new Map<string, number>();
  for (const row of countries) {
    const code = countryCodeForGeoChart(row);
    if (!code || row.conversations <= 0) continue;
    totals.set(code, (totals.get(code) ?? 0) + row.conversations);
  }
  const rows = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, conversations]) => [code, conversations] as [string, number]);
  return [['Country', 'Chats'], ...rows];
}

/** Same 2-column GeoChart shape; lowers non-hovered values so the color axis emphasizes one country. */
export function buildChatsGeoChartHoverData(
  countries: CustomerChatsAnalyticsCountryRow[],
  highlightedCountryCode: string | null,
): GeoChartDataTable {
  const base = buildChatsGeoChartData(countries);
  if (!highlightedCountryCode || base.length <= 1) return base;

  const highlight = highlightedCountryCode.trim().toUpperCase();
  const hasHighlight = base.slice(1).some(([code]) => String(code).toUpperCase() === highlight);
  if (!hasHighlight) return base;

  return [
    base[0],
    ...base.slice(1).map((row) => {
      const [code, conversations] = row as [string, number];
      const iso = String(code).toUpperCase();
      if (iso === highlight) return [code, conversations] as [string, number];
      return [code, Math.max(1, Math.floor(conversations * GEO_CHART_HOVER_DIM_FACTOR))] as [string, number];
    }),
  ];
}

/** GeoChart options: teal scale when data exists, neutral world map when empty. */
export function buildChatsGeoChartOptions(hasData: boolean, height = 550): Record<string, unknown> {
  const base = {
    backgroundColor: 'transparent',
    datalessRegionColor: '#f1f5f9',
    legend: 'none' as const,
    tooltip: { trigger: 'focus' as const },
    keepAspectRatio: false,
    height,
  };
  if (hasData) {
    return {
      ...base,
      colorAxis: { colors: ['#e2e8f0', '#0d9488'] },
    };
  }
  return {
    ...base,
    colorAxis: { minValue: 0, maxValue: 1, colors: ['#e2e8f0', '#e2e8f0'] },
  };
}

export type CountryRankingRow = {
  label: string;
  conversations: number;
  isUnknown: boolean;
  /** ISO 3166-1 alpha-2; null for Unknown (no map region). */
  countryCode: string | null;
};

/** Countries shown in the Chats by Country sidebar before "View all". */
export const CHATS_COUNTRY_RANKING_COLLAPSED_LIMIT = 10;

/** Side ranking: country label with chat (conversation) counts only. */
export function buildChatsCountryRankingRows(countries: CustomerChatsAnalyticsCountryRow[]): CountryRankingRow[] {
  const map = new Map<string, CountryRankingRow>();
  for (const row of countries) {
    const label = countryLabelForGeoChart(row) ?? 'Unknown';
    const isUnknown = label === 'Unknown';
    const code = countryCodeForGeoChart(row);
    const cur = map.get(label) ?? { label, conversations: 0, isUnknown, countryCode: code };
    if (!cur.countryCode && code) cur.countryCode = code;
    cur.conversations += row.conversations;
    map.set(label, cur);
  }
  return [...map.values()]
    .filter((r) => r.conversations > 0)
    .sort((a, b) => b.conversations - a.conversations || (a.isUnknown ? 1 : 0) - (b.isUnknown ? 1 : 0));
}
