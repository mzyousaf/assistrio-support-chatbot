import type { WorkspaceEntitlements } from '../entitlements/workspace-entitlements.types';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from '../knowledge/bot-knowledge-total-limit.service';
import {
  assertOnboardingKbWithinLimit,
  buildOnboardingKbUsageSnapshot,
  resolveOnboardingKbLimitBytes,
} from './workspace-onboarding-knowledge-limit.util';

describe('workspace onboarding knowledge limit', () => {
  const entitlements = {
    workspaceId: 'ws1',
    planKey: 'free',
    planName: 'Free',
    subscriptionStatus: 'free' as const,
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 100,
    kbStorageMbPerBot: 10,
    kbStorageBytesPerBot: 10 * 1024 * 1024,
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: 40 * 1024 * 1024,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  } as WorkspaceEntitlements;

  const draft = {
    profile: {
      name: 'Bot',
      shortDescription: '',
      description: 'Desc',
      categories: [],
      avatarSource: '',
      imageUrl: '',
      avatarEmoji: '',
      avatarStorageKey: '',
      brandColor: '',
    },
    instructions: {
      description: 'x'.repeat(80),
      systemPrompt: '',
      tone: 'friendly',
      behaviorPreset: 'default',
      responseLength: 'medium' as const,
      maxTokens: 160,
    },
    knowledge: { knowledgeDescription: '', faqs: [], snippets: [], qas: [] },
    goLive: { allowedOrigins: [] },
    stepsCompleted: [],
    createdAt: null,
    updatedAt: null,
  };

  it('caps limit at 40 MB', () => {
    expect(resolveOnboardingKbLimitBytes(entitlements)).toBe(10 * 1024 * 1024);
  });

  it('throws plan_limit_bot_kb_total when upload exceeds cap', () => {
    expect(() =>
      assertOnboardingKbWithinLimit({
        entitlements,
        draft,
        stagedFileBytes: entitlements.kbStorageBytesPerBot - 1000,
        incomingBytes: 2000,
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errorCode: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
          currentBytes: expect.any(Number),
          limitBytes: entitlements.kbStorageBytesPerBot,
        }),
      }),
    );
  });

  it('includes staged file bytes in usage snapshot', () => {
    const usage = buildOnboardingKbUsageSnapshot(entitlements, draft, 5000);
    expect(usage.currentBytes).toBe(5000);
  });
});