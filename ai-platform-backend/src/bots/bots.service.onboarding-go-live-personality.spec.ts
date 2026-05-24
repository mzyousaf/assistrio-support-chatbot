import { Types } from 'mongoose';
import { BotsService } from './bots.service';
import type { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';

describe('BotsService.createPublishedBotFromWorkspaceOnboarding personality mapping', () => {
  const workspaceId = String(new Types.ObjectId());
  const userId = String(new Types.ObjectId());
  const userDescription =
    'Be helpful when answering customer questions about pricing, product features, refunds, and support policies for our online store.';

  function buildService() {
    const botModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    } as never;

    const workspaceEntitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({}),
    } as never;

    const workspaceBotLimitService = {
      assertCanAddBotToWorkspace: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceBotLimitService;

    const svc = new BotsService(
      {} as never,
      botModel,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workspaceBotLimitService,
      workspaceEntitlementsService,
    );

    let capturedCreatePayload: Record<string, unknown> | null = null;
    jest.spyOn(svc, 'create').mockImplementation(async (payload) => {
      capturedCreatePayload = payload as Record<string, unknown>;
      return {
        _id: new Types.ObjectId(),
        slug: 'ada-bot',
        accessKey: 'ak_test',
        secretKey: 'sk_test',
        visibility: 'public',
      } as never;
    });
    jest.spyOn(svc, 'generateUniqueSlug').mockResolvedValue('ada-bot');

    return { svc, captured: () => capturedCreatePayload };
  }

  it('maps onboarding fields through default preset with clean generated copy', async () => {
    const { svc, captured } = buildService();

    await svc.createPublishedBotFromWorkspaceOnboarding({
      workspaceId,
      createdByUserId: userId,
      profile: {
        name: 'Ada Bot',
        shortDescription: 'Helper',
        description: '',
        brandColor: '#336699',
        categories: ['support'],
        avatarSource: 'none',
        imageUrl: '',
        avatarEmoji: '',
      },
      instructions: {
        description: userDescription,
        systemPrompt: userDescription,
        tone: 'friendly',
        behaviorPreset: 'default',
        responseLength: 'medium',
        maxTokens: 160,
      },
      allowedOrigins: [{ origin: 'https://example.com', isActive: true }],
    });

    const payload = captured();
    expect(payload).not.toBeNull();
    expect(payload!.description).not.toBe(userDescription);
    expect(String(payload!.description)).toMatch(/This AI agent helps customers/i);
    expect(payload!.shortDescription).toBe('Helper');
    expect(payload!.welcomeMessage).toContain('{{Name}}');
    expect(payload!.visitorMultiChatEnabled).toBe(true);
    expect(payload!.visitorMultiChatMax).toBe(5);

    const chatUI = payload!.chatUI as Record<string, unknown>;
    expect(chatUI.primaryColor).toBe('#336699');
    expect(chatUI.menuQuickLinks).toEqual([{ text: 'Visit website', route: 'https://example.com' }]);
    expect(chatUI.composerControlStyle).toBe('brand');
    expect(chatUI.allowFileUpload).toBe(true);

    expect(Array.isArray(payload!.exampleQuestions)).toBe(true);
    expect((payload!.exampleQuestions as string[]).length).toBeGreaterThan(0);
    expect((payload!.exampleQuestions as string[]).some((q) => /pricing/i.test(q))).toBe(true);

    expect(payload!.config).toEqual({
      temperature: 0.5,
      maxTokens: 96,
      responseLength: 'short',
      answerMode: 'knowledge_first',
    });

    const personality = payload!.personality as Record<string, string>;
    expect(personality.tone).toBe('friendly');
    expect(personality.behaviorPreset).toBe('default');
    expect(personality.description).toContain(userDescription);
    expect(personality.description).toContain('Business context:');
    expect(personality.systemPrompt).toContain('Additional behavior:');
    expect(personality.systemPrompt).not.toContain('Fallback response:');
    expect(personality.thingsToAvoid).toContain('- Do not invent information.');
    expect(personality.thingsToAvoid).not.toContain(userDescription);
  });
});
