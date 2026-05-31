import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BillingCreditAutoTopUpService,
  parseCreditAutoTopUpEnabledInput,
} from './billing-credit-auto-topup.service';

describe('BillingCreditAutoTopUpService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(overrides?: {
    aiCreditsAutoTopUpPromptEnabled?: boolean;
    entitlements?: {
      isTrialExpired?: boolean;
      addonsAllowed?: boolean;
    };
  }) {
    const doc = {
      workspaceId,
      aiCreditsAutoTopUpPromptEnabled: overrides?.aiCreditsAutoTopUpPromptEnabled ?? false,
      creditAutoTopUpEnabled: false,
    };
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve(doc),
      }),
    });
    const subscriptionModel = { findOneAndUpdate };
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        isTrialExpired: overrides?.entitlements?.isTrialExpired ?? false,
        addonsAllowed: overrides?.entitlements?.addonsAllowed ?? true,
      }),
    };
    const service = new BillingCreditAutoTopUpService(
      subscriptionModel as never,
      entitlementsService as never,
    );
    return { service, findOneAndUpdate, entitlementsService };
  }

  it('enables auto top-up prompt on subscription', async () => {
    const { service, findOneAndUpdate } = createService({ aiCreditsAutoTopUpPromptEnabled: true });
    const result = await service.setAutoTopUpPromptEnabled(workspaceId, true);
    expect(result).toEqual({ ok: true, autoTopUpPromptEnabled: true });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: expect.anything() }),
      {
        $set: {
          aiCreditsAutoTopUpPromptEnabled: true,
          creditAutoTopUpEnabled: false,
        },
      },
      { new: true },
    );
  });

  it('rejects enabling on expired free trial', async () => {
    const { service } = createService({
      entitlements: { isTrialExpired: true, addonsAllowed: false },
    });
    await expect(service.setAutoTopUpPromptEnabled(workspaceId, true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when subscription is missing', async () => {
    const subscriptionModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve(null),
        }),
      }),
    };
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({ isTrialExpired: false, addonsAllowed: true }),
    };
    const service = new BillingCreditAutoTopUpService(
      subscriptionModel as never,
      entitlementsService as never,
    );
    await expect(service.setAutoTopUpPromptEnabled(workspaceId, false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('parseCreditAutoTopUpEnabledInput', () => {
  it('accepts booleans and common string forms', () => {
    expect(parseCreditAutoTopUpEnabledInput(true)).toBe(true);
    expect(parseCreditAutoTopUpEnabledInput(false)).toBe(false);
    expect(parseCreditAutoTopUpEnabledInput('true')).toBe(true);
    expect(parseCreditAutoTopUpEnabledInput('false')).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(() => parseCreditAutoTopUpEnabledInput('maybe')).toThrow(BadRequestException);
  });
});
