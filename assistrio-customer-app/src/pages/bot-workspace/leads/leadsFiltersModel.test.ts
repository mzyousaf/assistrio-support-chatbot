import { describe, expect, it } from 'vitest';
import {
  apiParamsToLeadsDraft,
  countActiveLeadsFilters,
  defaultLeadsFiltersDraft,
  leadsDraftToApiParams,
  leadsFilterFieldKeyOptions,
  matchesDefaultLeadsDateFilters,
  matchesDefaultLeadsWidgetFilters,
} from './leadsFiltersModel';

describe('leadsFiltersModel', () => {
  it('maps draft to API params with uppercase country, startedFrom csv, includePreview, and trimmed search', () => {
    const p = leadsDraftToApiParams({
      ...defaultLeadsFiltersDraft(),
      datePreset: 'custom',
      customFrom: '2024-01-02',
      customTo: '2024-01-31',
      startedFromKeys: ['runtime_widget'],
      includePreview: false,
      countryCode: 'us',
      fieldKey: 'email',
      search: '  acme ',
    });
    expect(p.startedFrom).toBe('runtime_widget');
    expect(p.includePreview).toBe(false);
    expect(p.countryCode).toBe('US');
    expect(p.fieldKey).toBe('email');
    expect(p.search).toBe('acme');
    expect(p.dateFrom).toBeTruthy();
    expect(p.dateTo).toBeTruthy();
    expect(p.leadCompletion).toBeUndefined();
  });

  it('omits startedFrom and includePreview when using default widget filters', () => {
    const p = leadsDraftToApiParams(defaultLeadsFiltersDraft());
    expect(p.startedFrom).toBeUndefined();
    expect(p.includePreview).toBeUndefined();
  });

  it('maps leadCompletion to API when set', () => {
    const p = leadsDraftToApiParams({
      ...defaultLeadsFiltersDraft(),
      leadCompletion: 'partial',
    });
    expect(p.leadCompletion).toBe('partial');
  });

  it('counts active filters', () => {
    expect(countActiveLeadsFilters(apiParamsToLeadsDraft({}))).toBe(0);
    expect(countActiveLeadsFilters(apiParamsToLeadsDraft({ search: 'x' }))).toBe(1);
  });

  it('default date and widget filters are not counted as active filters', () => {
    const d = defaultLeadsFiltersDraft();
    expect(matchesDefaultLeadsDateFilters(d)).toBe(true);
    expect(matchesDefaultLeadsWidgetFilters(d)).toBe(true);
    expect(countActiveLeadsFilters(d)).toBe(0);
  });

  it('field key options respect order and include inactive or removed keys', () => {
    const keys = leadsFilterFieldKeyOptions([
      { key: 'z', label: 'Z', type: 'text', required: false, order: 2, disabled: false },
      { key: 'a', label: 'A', type: 'text', required: false, order: 0, disabled: true, fieldStatus: 'inactive' },
      { key: 'm', label: 'M', type: 'text', required: false, order: 1, disabled: false },
    ]);
    expect(keys).toEqual(['a', 'm', 'z']);
  });
});
