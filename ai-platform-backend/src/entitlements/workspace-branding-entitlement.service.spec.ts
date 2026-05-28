import { HttpException, HttpStatus } from '@nestjs/common';
import {
  applyBrandingEntitlementToChatUi,
  DEFAULT_POWERED_BY_BRANDING_MESSAGE,
  PLAN_LIMIT_REMOVE_BRANDING_CODE,
  PLAN_LIMIT_REMOVE_BRANDING_MESSAGE,
} from './workspace-branding-entitlement.util';
import { WorkspaceBrandingEntitlementService } from './workspace-branding-entitlement.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

const workspaceId = '507f1f77bcf86cd799439011';

function entitlements(canRemoveBranding: boolean) {
  return {
    workspaceId,
    planKey: 'free' as const,
    planName: 'Free',
    subscriptionStatus: 'free' as const,
    botLimit: 1,
    memberLimit: 3,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    kbStorageBytesPerBot: 5 * 1024 * 1024,
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: 40 * 1024 * 1024,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    canRemoveBranding,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  };
}

describe('workspace-branding-entitlement.util', () => {
  it('forces showAssistrioBrandingPaid when removal is not allowed', () => {
    expect(
      applyBrandingEntitlementToChatUi({ showBranding: false, showAssistrioBrandingPaid: false, brandingMessage: '' }, false),
    ).toEqual({
      showBranding: false,
      showAssistrioBrandingPaid: true,
      brandingMessage: '',
    });
  });

  it('preserves generic branding line when removal is not allowed', () => {
    expect(
      applyBrandingEntitlementToChatUi({ showBranding: false, brandingMessage: 'Custom footer' }, false),
    ).toEqual({
      showBranding: false,
      showAssistrioBrandingPaid: true,
      brandingMessage: 'Custom footer',
    });
  });

  it('preserves hidden Assistrio branding when removal is allowed', () => {
    expect(
      applyBrandingEntitlementToChatUi({ showAssistrioBrandingPaid: false }, true),
    ).toEqual({
      showAssistrioBrandingPaid: false,
    });
  });
});

describe('WorkspaceBrandingEntitlementService', () => {
  function createService(canRemoveBranding: boolean) {
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue(entitlements(canRemoveBranding)),
    } as unknown as WorkspaceEntitlementsService;
    return {
      service: new WorkspaceBrandingEntitlementService(entitlementsService),
      entitlementsService,
    };
  }

  it('blocks chatUI updates that hide Assistrio branding when canRemoveBranding=false', async () => {
    const { service } = createService(false);
    await expect(
      service.assertCanHideBranding(workspaceId, { showAssistrioBrandingPaid: false }),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        message: PLAN_LIMIT_REMOVE_BRANDING_MESSAGE,
        errorCode: PLAN_LIMIT_REMOVE_BRANDING_CODE,
      },
    });
  });

  it('allows hiding generic branding line when canRemoveBranding=false', async () => {
    const { service } = createService(false);
    await expect(
      service.assertCanHideBranding(workspaceId, { showBranding: false }),
    ).resolves.toBeUndefined();
  });

  it('allows hidden Assistrio branding when canRemoveBranding=true', async () => {
    const { service } = createService(true);
    await expect(
      service.assertCanHideBranding(workspaceId, { showAssistrioBrandingPaid: false }),
    ).resolves.toBeUndefined();
  });

  it('returns runtime chatUI with Assistrio branding visible when entitlement false', async () => {
    const { service } = createService(false);
    const out = await service.applyBrandingEntitlementToChatUi(workspaceId, {
      showBranding: false,
      showAssistrioBrandingPaid: false,
      brandingMessage: 'Custom footer',
    });
    expect(out.showBranding).toBe(false);
    expect(out.showAssistrioBrandingPaid).toBe(true);
    expect(out.brandingMessage).toBe('Custom footer');
  });
});
