import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { CustomerChatsAnalyticsService } from '../analytics/customer-chats-analytics.service';
import { BotsService } from '../bots/bots.service';
import { WorkspaceAnalyticsEntitlementService } from '../entitlements/workspace-analytics-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CustomerBotChatsAnalyticsController } from './customer-bot-chats-analytics.controller';

describe('CustomerBotChatsAnalyticsController', () => {
  let ctrl: CustomerBotChatsAnalyticsController;
  const getMock = jest.fn();
  const findOneMock = jest.fn();
  const canAccessMock = jest.fn();
  const resolveHistoryMock = jest.fn();

  beforeEach(async () => {
    getMock.mockReset();
    findOneMock.mockReset();
    canAccessMock.mockReset();
    resolveHistoryMock.mockReset();
    resolveHistoryMock.mockResolvedValue(7);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBotChatsAnalyticsController],
      providers: [
        { provide: CustomerChatsAnalyticsService, useValue: { get: getMock } },
        { provide: BotsService, useValue: { findOne: findOneMock } },
        { provide: WorkspacesService, useValue: { canUserAccessWorkspaceBot: canAccessMock } },
        {
          provide: WorkspaceAnalyticsEntitlementService,
          useValue: { resolveAnalyticsHistoryDays: resolveHistoryMock },
        },
      ],
    })
      .overrideGuard(CustomerSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(CustomerBotChatsAnalyticsController);
  });

  it('throws NotFound when bot missing', async () => {
    findOneMock.mockResolvedValue(null);
    await expect(
      ctrl.chatsAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'bot1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('throws Forbidden when workspace denies bot access', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1', workspaceId: 'ws1' });
    canAccessMock.mockResolvedValue(false);
    await expect(
      ctrl.chatsAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'bot1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('passes analyticsHistoryDays to analytics service when access granted', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1', workspaceId: 'ws1' });
    canAccessMock.mockResolvedValue(true);
    resolveHistoryMock.mockResolvedValue(7);
    getMock.mockResolvedValue({
      range: { from: '', to: '', granularity: 'day' },
      analyticsWindow: { analyticsWindowApplied: true, analyticsHistoryDays: 7 },
    });
    await ctrl.chatsAnalytics(
      { user: { _id: 'u1', role: 'member' } } as never,
      'bot1',
      { includePreview: 'false', granularity: 'week' },
    );
    expect(getMock).toHaveBeenCalledWith(
      'bot1',
      expect.objectContaining({ granularity: 'week', includePreview: 'false' }),
      { analyticsHistoryDays: 7 },
    );
  });
});
