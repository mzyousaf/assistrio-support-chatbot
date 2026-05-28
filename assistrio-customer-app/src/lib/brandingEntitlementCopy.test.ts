import { describe, expect, it } from 'vitest';
import {
  applyBrandingEntitlementToLocalChatUi,
  BRANDING_REMOVAL_LOCKED_HELPER,
  PLAN_LIMIT_REMOVE_BRANDING_MESSAGE,
  resolveBrandingSaveErrorMessage,
} from './brandingEntitlementCopy';

describe('brandingEntitlementCopy', () => {
  it('maps plan_limit_remove_branding to friendly save error', () => {
    expect(
      resolveBrandingSaveErrorMessage({
        errorCode: 'plan_limit_remove_branding',
        error: 'Removing Assistrio branding requires the branding removal add-on.',
      }),
    ).toBe(PLAN_LIMIT_REMOVE_BRANDING_MESSAGE);
  });

  it('forces showAssistrioBrandingPaid on in local chat UI when locked', () => {
    expect(applyBrandingEntitlementToLocalChatUi({ showBranding: false, showAssistrioBrandingPaid: false }, false)).toMatchObject({
      showBranding: false,
      showAssistrioBrandingPaid: true,
    });
  });

  it('exports locked helper copy', () => {
    expect(BRANDING_REMOVAL_LOCKED_HELPER).toContain('branding add-on');
  });
});
