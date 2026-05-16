import { describe, expect, it } from 'vitest';
import {
  apiParamsToLeadsDraft,
  countActiveLeadsFilters,
  leadsDraftToApiParams,
  leadsFilterFieldKeyOptions,
} from './leadsFiltersModel';

describe('leadsFiltersModel', () => {
  it('maps draft to API params with uppercase country and trimmed search', () => {
    const p = leadsDraftToApiParams({
      dateFrom: '2024-01-02',
      dateTo: '',
      startedFrom: 'runtime_widget',
      countryCode: 'us',
      fieldKey: 'email',
      search: '  acme ',
    });
    expect(p.startedFrom).toBe('runtime_widget');
    expect(p.countryCode).toBe('US');
    expect(p.fieldKey).toBe('email');
    expect(p.search).toBe('acme');
    expect(p.dateFrom).toBeTruthy();
    expect(p.dateTo).toBeUndefined();
  });

  it('counts active filters', () => {
    expect(countActiveLeadsFilters(apiParamsToLeadsDraft({}))).toBe(0);
    expect(countActiveLeadsFilters(apiParamsToLeadsDraft({ search: 'x' }))).toBe(1);
  });

  it('field key options respect order and skip disabled', () => {
    const keys = leadsFilterFieldKeyOptions([
      { key: 'z', label: 'Z', type: 'text', required: false, order: 2, disabled: false },
      { key: 'a', label: 'A', type: 'text', required: false, order: 0, disabled: true },
      { key: 'm', label: 'M', type: 'text', required: false, order: 1, disabled: false },
    ]);
    expect(keys).toEqual(['m', 'z']);
  });
});
