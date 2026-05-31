import {
  buildEnrichedAddonCatalog,
  mapExtraBotAddonsForSummary,
  resolveAddonCatalogDisplayStatus,
} from './workspace-billing-addon-summary.util';

describe('workspace-billing-addon-summary.util', () => {
  const usage = {
    bots: { current: 1, limit: 2 },
    members: { current: 1, pendingInvites: 0, used: 1, limit: 3, isOverMemberLimit: false },
    aiCredits: {
      periodStart: '',
      periodEnd: '',
      monthlyCredits: 500,
      monthlyCreditsUsed: 0,
      monthlyCreditsRemaining: 500,
      topUpCreditsRemaining: 250,
      totalCreditsAvailable: 750,
      totalCreditsRemaining: 750,
      isOverLimit: false,
      byBot: [],
    },
    trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
  };

  it('returns all catalog add-ons with inactive status by default', () => {
    const catalog = buildEnrichedAddonCatalog({
      checkoutAvailableForAddon: () => true,
      addonRows: [],
      usage,
      topUps: [],
    });

    expect(catalog).toHaveLength(3);
    expect(catalog.every((item) => item.status === 'inactive')).toBe(true);
    expect(catalog.every((item) => item.active === false)).toBe(true);
  });

  it('marks active recurring add-on with period end date', () => {
    const catalog = buildEnrichedAddonCatalog({
      checkoutAvailableForAddon: () => true,
      addonRows: [
        {
          addonKey: 'extra_bot',
          status: 'active',
          targetBotId: null,
          targetBotName: null,
          currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
      ],
      usage,
      topUps: [],
    });

    const extraBot = catalog.find((item) => item.key === 'extra_bot');
    expect(extraBot?.status).toBe('active');
    expect(extraBot?.currentPeriodEnd).toBe('2026-06-01T00:00:00.000Z');
    expect(extraBot?.effectLabel).toContain('+1 agent');
  });

  it('shows cancel-at-period-end status for scheduled cancellation', () => {
    const status = resolveAddonCatalogDisplayStatus({
      addonKey: 'remove_branding',
      rows: [
        {
          addonKey: 'remove_branding',
          status: 'active',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        },
      ],
    });

    expect(status).toBe('cancel_at_period_end');
  });

  it('marks past_due recurring add-on for billing summary', () => {
    const catalog = buildEnrichedAddonCatalog({
      checkoutAvailableForAddon: () => true,
      addonRows: [
        {
          addonKey: 'remove_branding',
          status: 'past_due',
          targetBotId: null,
          targetBotName: null,
          currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
      ],
      usage,
      topUps: [],
    });

    const branding = catalog.find((item) => item.key === 'remove_branding');
    expect(branding?.status).toBe('past_due');
    expect(branding?.active).toBe(true);
  });

  it('maps each active extra_bot row to a numbered billing instance', () => {
    const instances = mapExtraBotAddonsForSummary({
      addonRows: [
        {
          id: 'extra-1',
          addonKey: 'extra_bot',
          status: 'active',
          targetBotId: null,
          targetBotName: null,
          currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
        {
          id: 'extra-2',
          addonKey: 'extra_bot',
          status: 'active',
          targetBotId: null,
          targetBotName: null,
          currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
      ],
    });

    expect(instances).toHaveLength(2);
    expect(instances.map((row) => row.id)).toEqual(['extra-1', 'extra-2']);
  });

  it('includes top-up credits effect on ai_credits_1000 card', () => {
    const catalog = buildEnrichedAddonCatalog({
      checkoutAvailableForAddon: () => true,
      addonRows: [],
      usage,
      topUps: [
        {
          creditsPurchased: 1000,
          creditsRemaining: 250,
          expiresAt: '2027-05-01T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
          amountFormatted: '$30.00',
        },
      ],
    });

    const topUp = catalog.find((item) => item.key === 'ai_credits_1000');
    expect(topUp?.effectLabel).toContain('1,000');
    expect(topUp?.effectLabel).toContain('250 remaining');
  });

  it('includes auto top-up preference on ai_credits_1000 card', () => {
    const catalog = buildEnrichedAddonCatalog({
      checkoutAvailableForAddon: () => true,
      addonRows: [],
      usage,
      topUps: [],
      creditAutoTopUpPromptEnabled: true,
    });

    const topUp = catalog.find((item) => item.key === 'ai_credits_1000');
    expect(topUp?.autoTopUpPromptEnabled).toBe(true);

    const other = catalog.find((item) => item.key === 'extra_bot');
    expect(other?.autoTopUpPromptEnabled).toBeUndefined();
  });
});
