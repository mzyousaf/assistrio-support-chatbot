import { BadRequestException } from '@nestjs/common';
import { parseCustomerUsageQuery, usageLedgerUsageTypeLabel } from './customer-usage-analytics.util';

describe('customer-usage-analytics.util', () => {
  it('parseCustomerUsageQuery defaults granularity day and includePreview true', () => {
    const q = parseCustomerUsageQuery({});
    expect(q.granularity).toBe('day');
    expect(q.includePreview).toBe(true);
  });

  it('parseCustomerUsageQuery rejects invalid granularity', () => {
    expect(() => parseCustomerUsageQuery({ granularity: 'quarter' })).toThrow(BadRequestException);
  });

  it('parseCustomerUsageQuery accepts hour', () => {
    const q = parseCustomerUsageQuery({ granularity: 'hour' });
    expect(q.granularity).toBe('hour');
  });

  it('parseCustomerUsageQuery rejects invalid usageType', () => {
    expect(() => parseCustomerUsageQuery({ usageType: 'nope' })).toThrow(BadRequestException);
  });

  it('parseCustomerUsageQuery accepts valid usageType', () => {
    const q = parseCustomerUsageQuery({ usageType: 'voice_message' });
    expect(q.usageType).toBe('voice_message');
  });

  it('parseCustomerUsageQuery rejects invalid startedFrom', () => {
    expect(() => parseCustomerUsageQuery({ startedFrom: 'nope' })).toThrow(BadRequestException);
  });

  it('parseCustomerUsageQuery parses startedFrom', () => {
    expect(parseCustomerUsageQuery({ startedFrom: 'runtime_iframe' }).startedFrom).toEqual(['runtime_iframe']);
  });

  it('parseCustomerUsageQuery parses comma-separated startedFrom', () => {
    expect(parseCustomerUsageQuery({ startedFrom: 'runtime_iframe,runtime_widget' }).startedFrom).toEqual([
      'runtime_iframe',
      'runtime_widget',
    ]);
  });

  it('usageLedgerUsageTypeLabel maps known types', () => {
    expect(usageLedgerUsageTypeLabel('dictation_message')).toBe('Dictation message');
  });
});
