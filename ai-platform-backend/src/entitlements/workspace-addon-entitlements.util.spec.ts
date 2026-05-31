import { megabytesToBytes } from './plan-catalog';
import {
  applyWorkspaceAddonEntitlements,
  countActiveExtraBotAddons,
  isWorkspaceAddonEntitlementActive,
  resolveKbEntitlementsForBot,
} from './workspace-addon-entitlements.util';

const base = {
  botLimit: 1,
  canRemoveBranding: false,
  activeAddons: [] as string[],
  kbStorageMbPerBot: 15,
  maxKbStorageMbPerBot: 40,
  kbStorageBytesPerBot: megabytesToBytes(15),
  maxKbStorageBytesPerBot: megabytesToBytes(40),
  kbStorageBonusMbByBotId: {},
};

describe('workspace-addon-entitlements.util', () => {
  it('each active extra_bot increases botLimit by 1', () => {
    const applied = applyWorkspaceAddonEntitlements(base, [
      { addonKey: 'extra_bot', status: 'active' },
      { addonKey: 'extra_bot', status: 'active' },
    ]);
    expect(applied.botLimit).toBe(3);
    expect(countActiveExtraBotAddons([
      { addonKey: 'extra_bot', status: 'active' },
      { addonKey: 'extra_bot', status: 'active' },
    ])).toBe(2);
  });

  it('cancel-at-period-end extra_bot still counts until period end', () => {
    const future = new Date('2026-12-01T00:00:00.000Z');
    const applied = applyWorkspaceAddonEntitlements(
      base,
      [
        {
          addonKey: 'extra_bot',
          status: 'active',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: future.toISOString(),
        },
      ],
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(applied.botLimit).toBe(2);
    expect(
      isWorkspaceAddonEntitlementActive(
        {
          addonKey: 'extra_bot',
          status: 'active',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: future.toISOString(),
        },
        new Date('2026-06-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('expired extra_bot does not count', () => {
    const applied = applyWorkspaceAddonEntitlements(base, [
      { addonKey: 'extra_bot', status: 'expired' },
    ]);
    expect(applied.botLimit).toBe(1);
  });

  it('remove_branding enables canRemoveBranding', () => {
    const applied = applyWorkspaceAddonEntitlements(base, [
      { addonKey: 'remove_branding', status: 'active' },
    ]);
    expect(applied.canRemoveBranding).toBe(true);
  });

  it('ignores legacy KB add-ons for entitlements', () => {
    const botId = '507f1f77bcf86cd799439012';
    const applied = applyWorkspaceAddonEntitlements(base, [
      { addonKey: 'kb_storage_10mb', targetBotId: botId, status: 'active' },
    ]);
    expect(applied.kbStorageBonusMbByBotId).toEqual({});
    expect(applied.activeAddons).toHaveLength(0);

    const kb = resolveKbEntitlementsForBot(
      { ...base, planName: 'Starter', kbStorageBonusMbByBotId: applied.kbStorageBonusMbByBotId },
      botId,
    );
    expect(kb.kbStorageBytesPerBot).toBe(megabytesToBytes(15));
    expect(kb.maxKbStorageBytesPerBot).toBe(megabytesToBytes(40));
  });

  it('ignores cancelled add-ons after period end', () => {
    const applied = applyWorkspaceAddonEntitlements(
      base,
      [
        {
          addonKey: 'extra_bot',
          status: 'cancelled',
          currentPeriodEnd: '2026-01-01T00:00:00.000Z',
        },
      ],
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(applied.botLimit).toBe(1);
    expect(applied.activeAddons).toHaveLength(0);
  });
});
