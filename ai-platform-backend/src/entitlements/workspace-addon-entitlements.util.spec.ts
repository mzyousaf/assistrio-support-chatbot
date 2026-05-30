import { megabytesToBytes } from './plan-catalog';
import { applyWorkspaceAddonEntitlements, resolveKbEntitlementsForBot } from './workspace-addon-entitlements.util';

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
  it('extra_bot increases botLimit by 1 (MVP)', () => {
    const applied = applyWorkspaceAddonEntitlements(base, [
      { addonKey: 'extra_bot', status: 'active' },
      { addonKey: 'extra_bot', status: 'active' },
    ]);
    expect(applied.botLimit).toBe(2);
    expect(applied.activeAddons).toContain('extra_bot');
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

  it('ignores cancelled add-ons', () => {
    const applied = applyWorkspaceAddonEntitlements(base, [
      { addonKey: 'extra_bot', status: 'cancelled' },
    ]);
    expect(applied.botLimit).toBe(1);
    expect(applied.activeAddons).toHaveLength(0);
  });
});
