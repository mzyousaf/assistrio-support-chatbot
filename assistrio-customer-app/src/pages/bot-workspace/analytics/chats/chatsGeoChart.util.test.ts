import { describe, expect, it } from 'vitest';
import type { CustomerChatsAnalyticsCountryRow } from '@/api/types';
import {
  buildChatsCountryRankingRows,
  buildChatsGeoChartData,
  buildChatsGeoChartHoverData,
  buildChatsGeoChartOptions,
  countryCodeForGeoChart,
  countryLabelForGeoChart,
  isoCountryCodeFromGeoChartRegion,
  hasChatsCountrySignal,
  hasChatsGeoChartDataRows,
} from './chatsGeoChart.util';

const row = (
  partial: Partial<CustomerChatsAnalyticsCountryRow> & Pick<CustomerChatsAnalyticsCountryRow, 'conversations'>,
): CustomerChatsAnalyticsCountryRow => ({
  country: null,
  countryCode: null,
  messages: 0,
  ...partial,
});

describe('chatsGeoChart.util', () => {
  it('returns header-only GeoChart data when countries are empty', () => {
    const data = buildChatsGeoChartData([]);
    expect(data).toEqual([['Country', 'Chats']]);
    expect(hasChatsGeoChartDataRows(data)).toBe(false);
  });

  it('builds GeoChart data with ISO country codes', () => {
    const data = buildChatsGeoChartData([
      row({ country: 'Pakistan', countryCode: 'PK', conversations: 12 }),
      row({ countryCode: 'US', conversations: 8 }),
    ]);
    expect(data[0]).toEqual(['Country', 'Chats']);
    expect(data).toContainEqual(['PK', 12]);
    expect(data).toContainEqual(['US', 8]);
    expect(data.some((r) => r[0] === 'Pakistan')).toBe(false);
    expect(hasChatsGeoChartDataRows(data)).toBe(true);
  });

  it('merges duplicate country codes', () => {
    const data = buildChatsGeoChartData([
      row({ country: 'Pakistan', countryCode: 'PK', conversations: 5 }),
      row({ countryCode: 'PK', conversations: 7 }),
    ]);
    expect(data).toEqual([
      ['Country', 'Chats'],
      ['PK', 12],
    ]);
  });

  it('uses neutral color axis when there is no data', () => {
    const opts = buildChatsGeoChartOptions(false);
    expect(opts.colorAxis).toEqual({ minValue: 0, maxValue: 1, colors: ['#e2e8f0', '#e2e8f0'] });
  });

  it('uses teal color axis when data exists', () => {
    const opts = buildChatsGeoChartOptions(true);
    expect(opts.colorAxis).toEqual({ colors: ['#e2e8f0', '#0d9488'] });
  });

  it('hasChatsCountrySignal is false when all zero', () => {
    expect(hasChatsCountrySignal([row({ conversations: 0, messages: 0 })])).toBe(false);
  });

  it('isoCountryCodeFromGeoChartRegion parses GeoChart region ids', () => {
    expect(isoCountryCodeFromGeoChartRegion('us')).toBe('US');
    expect(isoCountryCodeFromGeoChartRegion('')).toBeNull();
  });

  it('countryCodeForGeoChart normalizes codes', () => {
    expect(countryCodeForGeoChart(row({ countryCode: ' us ', conversations: 1 }))).toBe('US');
  });

  it('countryLabelForGeoChart prefers stored country name for ranking', () => {
    expect(countryLabelForGeoChart(row({ country: 'Germany', countryCode: 'DE', conversations: 1 }))).toBe(
      'Germany',
    );
  });

  it('buildChatsGeoChartHoverData keeps 2 columns and dims non-hovered countries', () => {
    const data = buildChatsGeoChartHoverData(
      [
        row({ country: 'Pakistan', countryCode: 'PK', conversations: 12 }),
        row({ countryCode: 'US', conversations: 8 }),
      ],
      'PK',
    );
    expect(data[0]).toEqual(['Country', 'Chats']);
    expect(data).toContainEqual(['PK', 12]);
    expect(data).toContainEqual(['US', 1]);
  });

  it('buildChatsGeoChartHoverData matches base data when not hovering', () => {
    const countries = [row({ countryCode: 'DE', conversations: 4 })];
    expect(buildChatsGeoChartHoverData(countries, null)).toEqual(buildChatsGeoChartData(countries));
  });

  it('buildChatsCountryRankingRows uses conversations only', () => {
    const rows = buildChatsCountryRankingRows([
      row({ country: 'Pakistan', countryCode: 'PK', conversations: 3, messages: 10 }),
    ]);
    expect(rows[0]).toEqual({
      label: 'Pakistan',
      conversations: 3,
      isUnknown: false,
      countryCode: 'PK',
    });
  });

  it('marks rows without country as Unknown', () => {
    const rows = buildChatsCountryRankingRows([
      row({ country: null, countryCode: null, conversations: 5 }),
      row({ country: 'Germany', countryCode: 'DE', conversations: 2 }),
    ]);
    const unknown = rows.find((r) => r.isUnknown);
    expect(unknown).toMatchObject({ label: 'Unknown', conversations: 5, isUnknown: true });
  });
});
