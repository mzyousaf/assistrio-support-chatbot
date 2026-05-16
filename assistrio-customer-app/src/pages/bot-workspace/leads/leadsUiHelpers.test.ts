import type { CustomerLeadListItem } from '@/api/types';
import { describe, expect, it } from 'vitest';
import {
  activeLeadFieldDefinitions,
  displayLeadFieldValue,
  formatLeadSourcePage,
  formatLeadUrlInboxDisplay,
  countLoadedLeadsWithName,
  inferLeadFieldStatus,
  isLeadsTableNameFieldColumn,
  leadCsvColumnHeaderLabel,
  leadCapturedFieldTagItemsForRow,
  leadPrimaryIdentity,
  leadPrimaryIdentityKindLabel,
  leadQualityFromCaptured,
  leadTableDynamicDefinitions,
  visibleLeadFieldDefinitions,
} from './leadsUiHelpers';

describe('leadsUiHelpers', () => {
  it('inferLeadFieldStatus prefers explicit fieldStatus over archived/source', () => {
    expect(
      inferLeadFieldStatus({
        key: 'x',
        label: 'X',
        type: 'text',
        required: false,
        order: 0,
        archived: true,
        fieldStatus: 'active',
      }),
    ).toBe('active');
  });

  it('visibleLeadFieldDefinitions keeps inactive/deleted columns and sorts by order', () => {
    const v = visibleLeadFieldDefinitions([
      { key: 'email', label: 'Email', type: 'email', required: false, order: 0 },
      {
        key: 'legacy',
        label: 'Legacy',
        type: 'text',
        required: false,
        order: 2,
        archived: true,
        disabled: true,
      },
      { key: 'name', label: 'Name', type: 'text', required: false, order: 1 },
    ]);
    expect(v.map((x) => x.key)).toEqual(['email', 'name', 'legacy']);
  });

  it('activeLeadFieldDefinitions excludes inactive/deleted defs', () => {
    const a = activeLeadFieldDefinitions([
      { key: 'email', label: 'Email', type: 'email', required: false, order: 0 },
      { key: 'legacy', label: 'Legacy', type: 'text', required: false, order: 1, archived: true },
    ]);
    expect(a.map((x) => x.key)).toEqual(['email']);
  });

  it('leadCsvColumnHeaderLabel uses Deleted vs Inactive suffix from source', () => {
    expect(
      leadCsvColumnHeaderLabel({
        key: 'company_size',
        label: 'Company size',
        type: 'text',
        required: false,
        order: 0,
        archived: true,
        source: 'captured_data',
      }),
    ).toBe('Company size (Deleted)');
    expect(
      leadCsvColumnHeaderLabel({
        key: 'budget',
        label: 'Budget',
        type: 'text',
        required: false,
        order: 0,
        archived: true,
        source: 'current',
      }),
    ).toBe('Budget (Inactive)');
    expect(
      leadCsvColumnHeaderLabel({
        key: 'email',
        label: 'Email',
        type: 'email',
        required: false,
        order: 0,
      }),
    ).toBe('Email');
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

  it('leadCapturedFieldTagItemsForRow skips excluded keys and follows definition order', () => {
    const defs = [
      { key: 'email', label: 'Email', type: 'email', required: false, order: 0 },
      { key: 'name', label: 'Name', type: 'text', required: false, order: 1 },
      { key: 'phone', label: 'Phone', type: 'tel', required: false, order: 2 },
    ];
    const items = leadCapturedFieldTagItemsForRow(
      { name: 'A', email: 'a@b.co', phone: '1' },
      defs,
      ['name'],
    );
    expect(items.map((x) => x.key)).toEqual(['email', 'phone']);
    expect(
      leadCapturedFieldTagItemsForRow(
        { name: 'A', email: 'a@b.co', phone: '1' },
        defs,
        [],
      ).map((x) => x.key),
    ).toEqual(['email', 'name', 'phone']);
    expect(
      leadCapturedFieldTagItemsForRow(
        { name: 'A', email: 'a@b.co', phone: '1' },
        defs,
        ['email', 'phone'],
      ).map((x) => x.key),
    ).toEqual(['name']);
  });

  it('leadPrimaryIdentity falls back to first Captured Fields tag (inactive/deleted defs) when canonical keys empty', () => {
    const id = '507f1f77bcf86cd799439011';
    const defs = [
      {
        key: 'legacy_budget',
        label: 'Budget',
        type: 'text',
        required: false,
        order: 0,
        archived: true,
        fieldStatus: 'inactive' as const,
      },
    ];
    expect(leadPrimaryIdentity({ legacy_budget: '900' }, id, defs).headline).toBe('900');
    expect(leadPrimaryIdentity({ legacy_budget: '900' }, id).headline).toBe('Unknown lead');
  });

  it('leadPrimaryIdentity prefers name then email', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(leadPrimaryIdentity({ email: 'a@b.co', name: 'Alex' }, id).headline).toBe('Alex');
    expect(leadPrimaryIdentity({ email: 'a@b.co' }, id).headline).toBe('a@b.co');
    expect(leadPrimaryIdentity({ phone: '+1 555' }, id).headline).toBe('+1 555');
    expect(leadPrimaryIdentity({ company: 'Acme' }, id).headline).toBe('Acme');
    expect(leadPrimaryIdentity({}, id).headline).toBe('Unknown lead');
  });

  it('leadPrimaryIdentityKindLabel maps keys and defs to a short kind', () => {
    const defs = [
      { key: 'name', label: 'Name', type: 'text', required: false, order: 0 },
      { key: 'custom_budget', label: 'Budget', type: 'text', required: false, order: 1 },
    ];
    expect(leadPrimaryIdentityKindLabel(null, 'x', defs)).toBe('Unknown');
    expect(leadPrimaryIdentityKindLabel('email', 'Unknown lead', defs)).toBe('Unknown');
    expect(leadPrimaryIdentityKindLabel('name', 'Alex', defs)).toBe('Name');
    expect(leadPrimaryIdentityKindLabel('email', 'a@b.co', [])).toBe('Email');
    expect(leadPrimaryIdentityKindLabel('phone', '+1', [])).toBe('Phone');
    expect(leadPrimaryIdentityKindLabel('company', 'Acme', [])).toBe('Company');
    expect(leadPrimaryIdentityKindLabel('custom_budget', '500', defs)).toBe('Budget');
    expect(leadPrimaryIdentityKindLabel('orphan_key', 'val', [])).toBe('Orphan Key');
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
