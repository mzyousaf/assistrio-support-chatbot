import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BotsService } from './bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { VisitorsService } from '../visitors/visitors.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import {
  PLAN_LIMIT_SHARE_PREVIEW_CODE,
  WorkspaceSharePreviewEntitlementService,
} from '../entitlements/workspace-share-preview-entitlement.service';
import { WidgetSpeechService } from '../chat/widget-speech.service';
import { hashSharePreviewToken } from './share-preview-token.util';
import { SharedChatController } from './shared-chat.controller';

describe('SharedChatController share preview entitlement', () => {
  let ctrl: SharedChatController;
  const findShareBotMock = jest.fn();
  const assertBotLimitMock = jest.fn();
  const assertSharePreviewMock = jest.fn();

  const workspaceId = new Types.ObjectId();
  const shareToken = 'a'.repeat(64);

  beforeEach(async () => {
    findShareBotMock.mockReset();
    assertBotLimitMock.mockReset();
    assertSharePreviewMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharedChatController],
      providers: [
        { provide: BotsService, useValue: { findShareBotByShareSlug: findShareBotMock, sanitizeRuntimeChatUiForBot: jest.fn().mockResolvedValue({}) } },
        { provide: VisitorsService, useValue: { getOrCreateChatVisitor: jest.fn().mockResolvedValue(undefined) } },
        { provide: KnowledgeBaseItemService, useValue: { getPublicSuggestionChipsForBot: jest.fn().mockResolvedValue([]) } },
        { provide: ChatEngineService, useValue: {} },
        { provide: WidgetSpeechService, useValue: {} },
        { provide: WorkspaceBotLimitService, useValue: { assertBotDocWithinEffectiveLimitIfWorkspaceScoped: assertBotLimitMock } },
        {
          provide: WorkspaceSharePreviewEntitlementService,
          useValue: { assertCanUseSharePreviewForBot: assertSharePreviewMock },
        },
      ],
    }).compile();
    ctrl = module.get(SharedChatController);
  });

  function mockShareBot() {
    return {
      _id: new Types.ObjectId(),
      workspaceId,
      name: 'Test Bot',
      shareChat: {
        enabled: true,
        slug: 'test-slug',
        tokenHash: hashSharePreviewToken(shareToken),
        expiresAt: new Date(Date.now() + 86400000),
      },
    };
  }

  it('blocks init for Free trial workspace', async () => {
    findShareBotMock.mockResolvedValue(mockShareBot());
    assertSharePreviewMock.mockRejectedValue(
      new HttpException(
        { errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE, message: 'blocked' },
        HttpStatus.FORBIDDEN,
      ),
    );

    await expect(
      ctrl.init('test-slug', undefined, shareToken, { headers: {}, ip: '127.0.0.1' } as never),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(assertBotLimitMock).not.toHaveBeenCalled();
  });

  it('allows init for entitled workspace', async () => {
    findShareBotMock.mockResolvedValue(mockShareBot());
    assertSharePreviewMock.mockResolvedValue(undefined);
    assertBotLimitMock.mockResolvedValue(undefined);

    const res = await ctrl.init('test-slug', undefined, shareToken, { headers: {}, ip: '127.0.0.1' } as never);
    expect(res.status).toBe('ok');
    expect(assertSharePreviewMock).toHaveBeenCalled();
  });
});
