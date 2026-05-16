import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerBotUsageController } from './customer-bot-usage.controller';

describe('CustomerBotUsageController', () => {
  const getMock = jest.fn();
  const findOneMock = jest.fn();
  const canAccessMock = jest.fn();

  const ctrl = new CustomerBotUsageController(
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
      ctrl.usage({ user: { _id: 'u1', role: 'member' } } as never, 'b1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('throws Forbidden when workspace denies bot access', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(false);
    await expect(
      ctrl.usage({ user: { _id: 'u1', role: 'member' } } as never, 'bot1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('calls usage service when access granted', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(true);
    getMock.mockResolvedValue({ range: { from: '', to: '', granularity: 'day' } });
    const res = await ctrl.usage(
      { user: { _id: 'u1', role: 'member' } } as never,
      'bot1',
      { includePreview: 'false', granularity: 'week', usageType: 'text_message' },
    );
    expect(res).toEqual({ range: { from: '', to: '', granularity: 'day' } });
    expect(getMock).toHaveBeenCalledWith('bot1', {
      from: undefined,
      to: undefined,
      granularity: 'week',
      includePreview: 'false',
      usageType: 'text_message',
    });
  });
});
