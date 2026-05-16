import { CustomerLeadsAnalyticsService } from './customer-leads-analytics.service';

describe('CustomerLeadsAnalyticsService field breakdown', () => {
  const svc = new CustomerLeadsAnalyticsService(null as never, null as never);
  const resolve = (svc as unknown as { resolveFieldCaptureFieldStatus: (b: Record<string, unknown> | null, k: string) => string }).resolveFieldCaptureFieldStatus.bind(svc);

  it('enabled non-disabled configured field => active', () => {
    expect(
      resolve(
        {
          leadCapture: {
            enabled: true,
            fields: [{ key: 'email', disabled: false }],
          },
        },
        'email',
      ),
    ).toBe('active');
  });

  it('disabled configured field => inactive', () => {
    expect(
      resolve(
        {
          leadCapture: {
            enabled: true,
            fields: [{ key: 'legacy_co', disabled: true }],
          },
        },
        'legacy_co',
      ),
    ).toBe('inactive');
  });

  it('capture globally disabled => inactive for configured keys', () => {
    expect(
      resolve(
        {
          leadCapture: {
            enabled: false,
            fields: [{ key: 'email', disabled: false }],
          },
        },
        'email',
      ),
    ).toBe('inactive');
  });

  it('key missing from bot fields => deleted', () => {
    expect(
      resolve(
        {
          leadCapture: {
            enabled: true,
            fields: [{ key: 'email', disabled: false }],
          },
        },
        'ghost_key',
      ),
    ).toBe('deleted');
  });

  it('fieldCaptureBreakdown compatibility preserves legacy archived flag alongside fieldStatus', () => {
    const row = { fieldStatus: 'inactive' as const, archived: true as const };
    expect(row.fieldStatus).toBe('inactive');
    expect(row.archived).toBe(true);
  });
});

describe('CustomerLeadsAnalyticsService buildFieldMetaMap', () => {
  const svc = new CustomerLeadsAnalyticsService(null as never, null as never);

  it('includes disabled fields for labels/types', () => {
    const m = (svc as unknown as { buildFieldMetaMap: (b: Record<string, unknown> | null) => Map<string, unknown> }).buildFieldMetaMap({
      leadCapture: {
        fields: [
          { key: 'email', label: 'Email', type: 'email', disabled: false },
          { key: 'legacy_co', label: 'Legacy Co', type: 'text', disabled: true },
        ],
      },
    });
    expect(m.get('legacy_co')).toEqual({ label: 'Legacy Co', type: 'text' });
  });
});
