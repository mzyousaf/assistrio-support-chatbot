import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import {
  PLAN_LIMIT_SHARE_PREVIEW_CODE,
  WorkspaceSharePreviewEntitlementService,
} from '../entitlements/workspace-share-preview-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CustomerBotShareController } from './customer-bot-share.controller';

describe('CustomerBotShareController', () => {
  let ctrl: CustomerBotShareController;
  const findOneMock = jest.fn();
  const updateMock = jest.fn();
  const canAccessMock = jest.fn();
  const assertManageMock = jest.fn();
  const assertSharePreviewMock = jest.fn();
  const generateSlugMock = jest.fn();

  const workspaceId = new Types.ObjectId();
  const botId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    findOneMock.mockReset();
    updateMock.mockReset();
    canAccessMock.mockReset();
    assertManageMock.mockReset();
    assertSharePreviewMock.mockReset();
    generateSlugMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBotShareController],
      providers: [
        { provide: BotsService, useValue: { findOne: findOneMock, update: updateMock, generateUniqueShareSlug: generateSlugMock } },
        {
          provide: WorkspacesService,
          useValue: {
            canUserAccessWorkspaceBot: canAccessMock,
            assertCanManageWorkspaceBot: assertManageMock,
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://app.example.com') },
        },
        {
          provide: WorkspaceSharePreviewEntitlementService,
          useValue: { assertCanUseSharePreview: assertSharePreviewMock },
        },
      ],
    })
      .overrideGuard(CustomerSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(CustomerBotShareController);
  });

  function mockBot(overrides: Record<string, unknown> = {}) {
    return {
      _id: new Types.ObjectId(botId),
      workspaceId,
      shareChat: {},
      ...overrides,
    };
  }

  it('blocks create share link for Free trial workspace', async () => {
    findOneMock.mockResolvedValue(mockBot());
    canAccessMock.mockResolvedValue(true);
    assertManageMock.mockResolvedValue(undefined);
    assertSharePreviewMock.mockRejectedValue(
      new HttpException(
        { errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE, message: 'blocked' },
        HttpStatus.FORBIDDEN,
      ),
    );

    await expect(
      ctrl.createShareLink({ user: { _id: 'u1', role: 'owner' } } as never, botId, { expiresInHours: 24 }),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows create share link for entitled workspace', async () => {
    findOneMock
      .mockResolvedValueOnce(mockBot())
      .mockResolvedValueOnce(mockBot({ shareChat: { enabled: true, slug: 'abc' } }));
    canAccessMock.mockResolvedValue(true);
    assertManageMock.mockResolvedValue(undefined);
    assertSharePreviewMock.mockResolvedValue(undefined);
    generateSlugMock.mockResolvedValue('abc123');
    updateMock.mockResolvedValue(undefined);

    const res = await ctrl.createShareLink({ user: { _id: 'u1', role: 'owner' } } as never, botId, {
      expiresInHours: 24,
    });
    expect(assertSharePreviewMock).toHaveBeenCalledWith(String(workspaceId));
    expect(res.enabled).toBe(true);
  });

  it('blocks enable share link for Free trial workspace', async () => {
    findOneMock.mockResolvedValue(
      mockBot({
        shareChat: {
          enabled: false,
          slug: 'abc123',
          tokenHash: 'a'.repeat(64),
          expiresAt: new Date(Date.now() + 86400000),
        },
      }),
    );
    canAccessMock.mockResolvedValue(true);
    assertManageMock.mockResolvedValue(undefined);
    assertSharePreviewMock.mockRejectedValue(
      new HttpException(
        { errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE, message: 'blocked' },
        HttpStatus.FORBIDDEN,
      ),
    );

    await expect(
      ctrl.patchShareLink({ user: { _id: 'u1', role: 'owner' } } as never, botId, { enabled: true }),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
  });
});
