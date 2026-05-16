import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { CustomerChatsAnalyticsService } from '../analytics/customer-chats-analytics.service';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CustomerBotChatsAnalyticsController } from './customer-bot-chats-analytics.controller';

describe('CustomerBotChatsAnalyticsController', () => {
  let ctrl: CustomerBotChatsAnalyticsController;
  const getMock = jest.fn();
  const findOneMock = jest.fn();
  const canAccessMock = jest.fn();

  beforeEach(async () => {
    getMock.mockReset();
    findOneMock.mockReset();
    canAccessMock.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBotChatsAnalyticsController],
      providers: [
        { provide: CustomerChatsAnalyticsService, useValue: { get: getMock } },
        { provide: BotsService, useValue: { findOne: findOneMock } },
        { provide: WorkspacesService, useValue: { canUserAccessWorkspaceBot: canAccessMock } },
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
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(false);
    await expect(
      ctrl.chatsAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'bot1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('calls analytics service when access granted', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(true);
    getMock.mockResolvedValue({ range: { from: '', to: '', granularity: 'day' } });
    const res = await ctrl.chatsAnalytics(
      { user: { _id: 'u1', role: 'member' } } as never,
      'bot1',
      { includePreview: 'false', granularity: 'week' },
    );
    expect(res).toEqual({ range: { from: '', to: '', granularity: 'day' } });
    expect(getMock).toHaveBeenCalledWith('bot1', {
      from: undefined,
      to: undefined,
      granularity: 'week',
      includePreview: 'false',
      startedFrom: undefined,
      countryCode: undefined,
      deviceType: undefined,
    });
  });
});
