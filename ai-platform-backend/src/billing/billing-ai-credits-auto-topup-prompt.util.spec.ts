import { resolveCanAutoTopUpPrompt } from './billing-ai-credits-auto-topup-prompt.util';

describe('resolveCanAutoTopUpPrompt', () => {
  it('returns true when prompt enabled on paid plan with no credits left', () => {
    expect(
      resolveCanAutoTopUpPrompt({
        subscription: { aiCreditsAutoTopUpPromptEnabled: true },
        entitlements: {
          isTrialExpired: false,
          addonsAllowed: true,
          isTrialPlan: false,
          planKey: 'starter',
        },
        totalCreditsRemaining: 0,
      }),
    ).toBe(true);
  });

  it('returns false when prompt disabled', () => {
    expect(
      resolveCanAutoTopUpPrompt({
        subscription: { aiCreditsAutoTopUpPromptEnabled: false },
        entitlements: {
          isTrialExpired: false,
          addonsAllowed: true,
          isTrialPlan: false,
          planKey: 'starter',
        },
        totalCreditsRemaining: 0,
      }),
    ).toBe(false);
  });

  it('returns false for expired free trial workspaces', () => {
    expect(
      resolveCanAutoTopUpPrompt({
        subscription: { aiCreditsAutoTopUpPromptEnabled: true },
        entitlements: {
          isTrialExpired: true,
          addonsAllowed: false,
          isTrialPlan: true,
          planKey: 'free',
        },
        totalCreditsRemaining: 0,
      }),
    ).toBe(false);
  });

  it('reads legacy creditAutoTopUpEnabled when new field is absent', () => {
    expect(
      resolveCanAutoTopUpPrompt({
        subscription: { creditAutoTopUpEnabled: true },
        entitlements: {
          isTrialExpired: false,
          addonsAllowed: true,
          isTrialPlan: false,
          planKey: 'pro',
        },
        totalCreditsRemaining: 0,
      }),
    ).toBe(true);
  });
});
