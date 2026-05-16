import { describe, expect, it } from 'vitest';
import { CHATS_GEO_CHART_PACKAGES } from './chatsGeoChartLoader';

describe('chatsGeoChartLoader', () => {
  it('loads corechart and geochart packages', () => {
    expect(CHATS_GEO_CHART_PACKAGES).toContain('corechart');
    expect(CHATS_GEO_CHART_PACKAGES).toContain('geochart');
  });
});
