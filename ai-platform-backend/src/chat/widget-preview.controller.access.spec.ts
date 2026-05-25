import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { WidgetPreviewController } from './widget-preview.controller';
import {
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
} from '../workspaces/workspace-bot-member-visibility.util';

function verifyPreviewAccess(
  controller: WidgetPreviewController,
  request: { headers: Record<string, string | undefined> },
  bot: Record<string, unknown>,
  authToken?: string,
): Promise<string> {
  return (controller as unknown as {
    verifyPreviewAccessOrThrow: (
      request: { headers: Record<string, string | undefined> },
      bot: Record<string, unknown>,
      authToken?: string,
    ) => Promise<string>;
  }).verifyPreviewAccessOrThrow(request, bot, authToken);
}

describe('WidgetPreviewController preview access', () => {
  const ownerUserId = '507f1f77bcf86cd799439010';
  const memberUserId = '507f1f77bcf86cd799439013';
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439020';

  const workspaceBot = {
    _id: new Types.ObjectId(botId),
    workspaceId: new Types.ObjectId(workspaceId),
    ownerId: new Types.ObjectId(ownerUserId),
    workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
  };

  const legacyBot = {
    _id: new Types.ObjectId(botId),
    ownerId: new Types.ObjectId(ownerUserId),
  };

  function buildController(options?: {
    authUser?: { _id: string; email: string; role: string } | null;
    assertPreview?: jest.Mock;
    canPreviewAsOwner?: boolean;
  }) {
    const authService = {
      getAuthenticatedUser: jest.fn().mockResolvedValue(options?.authUser ?? null),
    };

    const workspacesService = {
      assertCanPreviewWorkspaceBot:
        options?.assertPreview ??
        jest.fn().mockResolvedValue(undefined),
      canUserPreviewBotAsOwner: jest.fn().mockReturnValue(options?.canPreviewAsOwner ?? false),
    };

    const controller = new WidgetPreviewController(
      { get: jest.fn().mockReturnValue('development') } as never,
      authService as never,
      {} as never,
      {} as never,
      {} as never,
      workspacesService as never,
      {} as never,
      {} as never,
    );

    const harness = controller;
    const request = { headers: {} };
    const authToken = 'session-token';

    return { harness, authService, workspacesService, request, authToken };
  }

  it('allows workspace member when assertCanPreviewWorkspaceBot succeeds', async () => {
    const member = { _id: memberUserId, email: 'member@test.com', role: 'customer' };
    const { harness, workspacesService, request, authToken } = buildController({ authUser: member });

    await expect(
      verifyPreviewAccess(harness, request, workspaceBot, authToken),
    ).resolves.toBe(memberUserId);

    expect(workspacesService.assertCanPreviewWorkspaceBot).toHaveBeenCalledWith(
      memberUserId,
      'customer',
      workspaceBot,
    );
    expect(workspacesService.canUserPreviewBotAsOwner).not.toHaveBeenCalled();
  });

  it('returns workspace_bot_preview_access_denied for workspace member without preview access', async () => {
    const member = { _id: memberUserId, email: 'member@test.com', role: 'customer' };
    const assertPreview = jest.fn().mockRejectedValue(
      new ForbiddenException({
        message: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
        error: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
        errorCode: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
      }),
    );
    const { harness, request, authToken } = buildController({ authUser: member, assertPreview });

    await expect(
      verifyPreviewAccess(harness, request, workspaceBot, authToken),
    ).rejects.toMatchObject({
      response: {
        errorCode: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
        message: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
      },
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('uses PREVIEW_FORBIDDEN for legacy bot when user is not owner', async () => {
    const member = { _id: memberUserId, email: 'member@test.com', role: 'customer' };
    const { harness, workspacesService, request, authToken } = buildController({
      authUser: member,
      canPreviewAsOwner: false,
    });

    await expect(
      verifyPreviewAccess(harness, request, legacyBot, authToken),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PREVIEW_FORBIDDEN',
        error: 'Preview is only available to the bot owner. Sign in as the account that owns this agent.',
      },
      status: HttpStatus.FORBIDDEN,
    });

    expect(workspacesService.assertCanPreviewWorkspaceBot).not.toHaveBeenCalled();
    expect(workspacesService.canUserPreviewBotAsOwner).toHaveBeenCalled();
  });

  it('allows legacy bot owner preview', async () => {
    const owner = { _id: ownerUserId, email: 'owner@test.com', role: 'customer' };
    const { harness, workspacesService, request, authToken } = buildController({
      authUser: owner,
      canPreviewAsOwner: true,
    });

    await expect(
      verifyPreviewAccess(harness, request, legacyBot, authToken),
    ).resolves.toBe(ownerUserId);

    expect(workspacesService.assertCanPreviewWorkspaceBot).not.toHaveBeenCalled();
  });

  it('treats bot with workspaceId as workspace-scoped even when visibility fields were missing from query', async () => {
    const member = { _id: memberUserId, email: 'member@test.com', role: 'customer' };
    const botWithoutVisibilityFields = {
      _id: new Types.ObjectId(botId),
      workspaceId: new Types.ObjectId(workspaceId),
      ownerId: new Types.ObjectId(ownerUserId),
    };
    const { harness, workspacesService, request, authToken } = buildController({ authUser: member });

    await verifyPreviewAccess(harness, request, botWithoutVisibilityFields, authToken);

    expect(workspacesService.assertCanPreviewWorkspaceBot).toHaveBeenCalledWith(
      memberUserId,
      'customer',
      botWithoutVisibilityFields,
    );
  });

  it('returns PREVIEW_UNAUTHORIZED when session is missing', async () => {
    const { harness, request } = buildController({ authUser: null });

    await expect(verifyPreviewAccess(harness, request, workspaceBot)).rejects.toMatchObject({
      response: { errorCode: 'PREVIEW_UNAUTHORIZED' },
      status: HttpStatus.UNAUTHORIZED,
    });
  });
});

describe('WidgetPreviewController init with external runtime bot shape', () => {
  it('findOneByIdForExternalRuntime select includes workspace preview fields', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../bots/bots.service.ts'),
      'utf8',
    );
    expect(source).toMatch(/findOneByIdForExternalRuntime[\s\S]*workspaceId workspaceMemberVisibility/);
  });
});
