import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerBotLeadsAnalyticsController } from './customer-bot-leads-analytics.controller';

describe('CustomerBotLeadsAnalyticsController', () => {
  const getMock = jest.fn();
  const findOneMock = jest.fn();
  const canAccessMock = jest.fn();

  const ctrl = new CustomerBotLeadsAnalyticsController(
    { get: getMock } as never,
    { findOne: findOneMock } as never,
    { canUserAccessWorkspaceBot: canAccessMock } as never,
  );

  beforeEach(() => {
    getMock.mockReset();
    findOneMock.mockReset();
    canAccessMock.mockReset();
  });

  it('throws NotFound when bot missing', async () => {
    findOneMock.mockResolvedValue(null);
    await expect(
      ctrl.leadsAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'b1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('throws Forbidden when workspace denies bot access', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(false);
    await expect(
      ctrl.leadsAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'bot1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('calls analytics service when access granted', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(true);
    getMock.mockResolvedValue({ range: { from: '', to: '', granularity: 'day' } });
    const res = await ctrl.leadsAnalytics(
      { user: { _id: 'u1', role: 'member' } } as never,
      'bot1',
      { includePreview: 'false', granularity: 'week', countryCode: 'us' },
    );
    expect(res).toEqual({ range: { from: '', to: '', granularity: 'day' } });
    expect(getMock).toHaveBeenCalledWith('bot1', {
      from: undefined,
      to: undefined,
      granularity: 'week',
      includePreview: 'false',
      startedFrom: undefined,
      countryCode: 'us',
    });
  });
});
