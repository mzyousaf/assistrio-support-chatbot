import { mockFreeWorkspaceEntitlements } from '../entitlements/test/workspace-entitlements.fixture';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from '../knowledge/bot-knowledge-total-limit.service';
import {
  assertOnboardingKbWithinLimit,
  buildOnboardingKbUsageSnapshot,
  resolveOnboardingKbLimitBytes,
} from './workspace-onboarding-knowledge-limit.util';

describe('workspace onboarding knowledge limit', () => {
  const entitlements = mockFreeWorkspaceEntitlements({
    workspaceId: 'ws1',
    monthlyAiCredits: 100,
  });

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
    expect(resolveOnboardingKbLimitBytes(entitlements)).toBe(5 * 1024 * 1024);
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