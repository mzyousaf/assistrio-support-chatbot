import {
  evaluateLeadCompleteFromCapturedData,
  parseLeadCompletenessConfigFromBot,
} from './customer-leads-analytics-completeness.util';

describe('parseLeadCompletenessConfigFromBot', () => {
  it('collects required keys only from enabled capture fields (disabled omitted)', () => {
    const cfg = parseLeadCompletenessConfigFromBot({
      leadCapture: {
        enabled: true,
        fields: [
          { key: 'a', label: 'A', disabled: true, required: true },
          { key: 'b', label: 'B', required: true },
          { key: 'c', label: 'C', required: false },
        ],
      },
    } as Record<string, unknown>);
    expect(cfg.requiredKeys).toEqual(['b']);
    expect(cfg.requiredKeys).not.toContain('a');
    expect(cfg.requiredKeys).not.toContain('c');
  });

  it('treats schema-default required when required flag is omitted', () => {
    const cfg = parseLeadCompletenessConfigFromBot({
      leadCapture: {
        enabled: true,
        fields: [{ key: 'name', label: 'Name', type: 'text' }],
      },
    } as Record<string, unknown>);
    expect(cfg.requiredKeys).toEqual(['name']);
  });

  it('detects email and phone keys from type or key name', () => {
    const cfg = parseLeadCompletenessConfigFromBot({
      leadCapture: {
        enabled: true,
        fields: [
          { key: 'company_email', label: 'Co', type: 'email' },
          { key: 'mobile', label: 'M', type: 'text' },
          { key: 'fax', label: 'F', type: 'text', disabled: true },
        ],
      },
    } as Record<string, unknown>);
    expect(cfg.emailKeys).toContain('company_email');
    expect(cfg.phoneKeys).toContain('mobile');
    expect(cfg.emailKeys).not.toContain('fax');
  });

  it('returns empty config when capture is disabled and no fields', () => {
    const cfg = parseLeadCompletenessConfigFromBot({
      leadCapture: { enabled: false, fields: [] },
    } as Record<string, unknown>);
    expect(cfg.requiredKeys).toEqual([]);
    expect(cfg.emailKeys).toEqual([]);
    expect(cfg.phoneKeys).toEqual([]);
  });

  it('infers capture on when enabled omitted but fields exist', () => {
    const cfg = parseLeadCompletenessConfigFromBot({
      leadCapture: { fields: [{ key: 'x', label: 'X', required: true }] },
    } as Record<string, unknown>);
    expect(cfg.requiredKeys).toEqual(['x']);
  });
});

describe('evaluateLeadCompleteFromCapturedData', () => {
  it('is complete when every active required field is non-empty', () => {
    const cfg = {
      requiredKeys: ['a', 'b'],
      emailKeys: [] as string[],
      phoneKeys: [] as string[],
    };
    expect(evaluateLeadCompleteFromCapturedData({ a: '1', b: '2' }, cfg)).toBe(true);
    expect(evaluateLeadCompleteFromCapturedData({ a: '1', b: '' }, cfg)).toBe(false);
    expect(evaluateLeadCompleteFromCapturedData({ a: '1' }, cfg)).toBe(false);
  });

  it('ignores extra captured keys for required-mode completeness', () => {
    const cfg = {
      requiredKeys: ['name'],
      emailKeys: [] as string[],
      phoneKeys: [] as string[],
    };
    expect(evaluateLeadCompleteFromCapturedData({ name: 'Ada', legacy_old: 'x' }, cfg)).toBe(true);
  });

  it('with no required keys, uses configured email or phone when present', () => {
    const cfg = {
      requiredKeys: [] as string[],
      emailKeys: ['company_email'],
      phoneKeys: ['mobile'],
    };
    expect(evaluateLeadCompleteFromCapturedData({ company_email: 'a@b.co' }, cfg)).toBe(true);
    expect(evaluateLeadCompleteFromCapturedData({ mobile: '+1' }, cfg)).toBe(true);
    expect(evaluateLeadCompleteFromCapturedData({ other: 'x' }, cfg)).toBe(false);
  });

  it('with only email keys configured, phone capture alone does not satisfy contact rule', () => {
    const cfg = {
      requiredKeys: [] as string[],
      emailKeys: ['company_email'],
      phoneKeys: [] as string[],
    };
    expect(evaluateLeadCompleteFromCapturedData({ mobile: '+1' }, cfg)).toBe(false);
  });

  it('falls back to >= 2 non-empty fields when no required/contact keys', () => {
    const cfg = {
      requiredKeys: [] as string[],
      emailKeys: [] as string[],
      phoneKeys: [] as string[],
    };
    expect(evaluateLeadCompleteFromCapturedData({ a: '1', b: '2' }, cfg)).toBe(true);
    expect(evaluateLeadCompleteFromCapturedData({ a: '1' }, cfg)).toBe(false);
    expect(evaluateLeadCompleteFromCapturedData({}, cfg)).toBe(false);
  });

  it('treats whitespace-only values as empty', () => {
    const cfg = {
      requiredKeys: ['a'],
      emailKeys: [] as string[],
      phoneKeys: [] as string[],
    };
    expect(evaluateLeadCompleteFromCapturedData({ a: '   ' }, cfg)).toBe(false);
  });
});
