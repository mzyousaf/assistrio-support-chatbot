import type { CustomerLeadListItem } from '@/api/types';
import { describe, expect, it } from 'vitest';
import {
  displayLeadFieldValue,
  formatLeadSourcePage,
  formatLeadUrlInboxDisplay,
  countLoadedLeadsWithName,
  isLeadsTableNameFieldColumn,
  leadPrimaryIdentity,
  leadQualityFromCaptured,
  leadTableDynamicDefinitions,
  visibleLeadFieldDefinitions,
} from './leadsUiHelpers';

describe('leadsUiHelpers', () => {
  it('visibleLeadFieldDefinitions drops disabled and sorts by order', () => {
    const v = visibleLeadFieldDefinitions([
      { key: 'b', label: 'B', type: 'text', required: false, order: 2 },
      { key: 'a', label: 'A', type: 'text', required: false, order: 1, disabled: true },
      { key: 'c', label: 'C', type: 'text', required: false, order: 0 },
    ]);
    expect(v.map((x) => x.key)).toEqual(['c', 'b']);
  });

  it('displayLeadFieldValue uses em dash when missing', () => {
    expect(displayLeadFieldValue({}, 'name')).toBe('—');
    expect(displayLeadFieldValue({ name: '  ' }, 'name')).toBe('—');
    expect(displayLeadFieldValue({ name: 'Ann' }, 'name')).toBe('Ann');
    expect(displayLeadFieldValue({ Name: 'Ann' }, 'name')).toBe('Ann');
    expect(displayLeadFieldValue({ name: 'Bob' }, 'Name')).toBe('Bob');
  });

  it('formatLeadSourcePage prefers page URL', () => {
    expect(
      formatLeadSourcePage({
        pageUrl: 'https://ex.com/p',
        websiteOrigin: 'https://ex.com',
        referrer: 'https://ref.com',
      }),
    ).toBe('https://ex.com/p');
  });

  it('leadPrimaryIdentity prefers name then email', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(leadPrimaryIdentity({ email: 'a@b.co', name: 'Alex' }, id).headline).toBe('Alex');
    expect(leadPrimaryIdentity({ email: 'a@b.co' }, id).headline).toBe('a@b.co');
    expect(leadPrimaryIdentity({ phone: '+1 555' }, id).headline).toBe('+1 555');
    expect(leadPrimaryIdentity({}, id).headline).toBe('Unknown lead');
  });

  it('formatLeadUrlInboxDisplay uses host and path segments', () => {
    const s = formatLeadUrlInboxDisplay('http://localhost:3002/share/sc-f8747abcdef0123');
    expect(s).toContain('localhost:3002');
    expect(s).toContain('share');
  });

  it('leadQualityFromCaptured detects partial, missing email, and complete', () => {
    const withRequired = [
      { key: 'name', label: 'Name', type: 'text', required: true, order: 0 },
      { key: 'email', label: 'Email', type: 'email', required: false, order: 1 },
    ];
    expect(leadQualityFromCaptured({}, withRequired).kind).toBe('partial');
    expect(leadQualityFromCaptured({ name: 'Ada' }, withRequired).kind).toBe('missing_email');
    expect(leadQualityFromCaptured({ name: 'Ada', email: 'a@b.co' }, withRequired).kind).toBe('complete');

    const sparse = [
      { key: 'a', label: 'A', type: 'text', required: false, order: 0 },
      { key: 'b', label: 'B', type: 'text', required: false, order: 1 },
      { key: 'c', label: 'C', type: 'text', required: false, order: 2 },
    ];
    expect(leadQualityFromCaptured({ a: '1' }, sparse).kind).toBe('partial');
  });

  it('countLoadedLeadsWithName uses name-like defs and fallbacks', () => {
    const defs = [
      { key: 'name', label: 'Name', type: 'text', required: false, order: 0 },
      { key: 'email', label: 'Email', type: 'email', required: false, order: 1 },
    ];
    const leads = [
      { conversationId: '1', capturedLeadData: { name: 'Ada' } },
      { conversationId: '2', capturedLeadData: { email: 'a@b.co' } },
      { conversationId: '3', capturedLeadData: { Full_Name: 'Bob' } },
    ] as CustomerLeadListItem[];
    expect(countLoadedLeadsWithName(leads, defs)).toBe(2);
  });

  it('isLeadsTableNameFieldColumn matches name-like keys and labels', () => {
    expect(isLeadsTableNameFieldColumn({ key: 'name', label: 'Name', type: 'text', required: false, order: 0 })).toBe(
      true,
    );
    expect(isLeadsTableNameFieldColumn({ key: 'full_name', label: 'X', type: 'text', required: false, order: 0 })).toBe(
      true,
    );
    expect(
      isLeadsTableNameFieldColumn({ key: 'custom', label: 'Full name', type: 'text', required: false, order: 0 }),
    ).toBe(true);
    expect(isLeadsTableNameFieldColumn({ key: 'company', label: 'Co', type: 'text', required: false, order: 0 })).toBe(
      false,
    );
  });

  it('leadTableDynamicDefinitions keeps all defs including headline key', () => {
    const defs = [
      { key: 'name', label: 'Name', type: 'text', required: false, order: 0 },
      { key: 'company', label: 'Co', type: 'text', required: false, order: 1 },
    ];
    const t = leadTableDynamicDefinitions(defs, 'name');
    expect(t.map((d) => d.key)).toEqual(['name', 'company']);
  });
});
