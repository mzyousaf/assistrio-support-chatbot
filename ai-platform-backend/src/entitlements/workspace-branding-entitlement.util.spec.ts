import { applyBrandingEntitlementToChatUi } from './workspace-branding-entitlement.util';

describe('applyBrandingEntitlementToChatUi', () => {
  it('forces Assistrio branding on when remove_branding entitlement is inactive', () => {
    const chatUI = { showBranding: false, showAssistrioBrandingPaid: false };
    const result = applyBrandingEntitlementToChatUi(chatUI, false);
    expect(result.showAssistrioBrandingPaid).toBe(true);
    expect(result.showBranding).toBe(false);
  });

  it('preserves hidden Assistrio branding when entitlement is active', () => {
    const chatUI = { showBranding: true, showAssistrioBrandingPaid: false };
    const result = applyBrandingEntitlementToChatUi(chatUI, true);
    expect(result.showAssistrioBrandingPaid).toBe(false);
  });
});
