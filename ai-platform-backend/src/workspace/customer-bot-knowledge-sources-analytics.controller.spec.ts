import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerBotKnowledgeSourcesAnalyticsController } from './customer-bot-knowledge-sources-analytics.controller';

describe('CustomerBotKnowledgeSourcesAnalyticsController', () => {
  const getMock = jest.fn();
  const findOneMock = jest.fn();
  const canAccessMock = jest.fn();

  const ctrl = new CustomerBotKnowledgeSourcesAnalyticsController(
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
      ctrl.knowledgeSourcesAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'b1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('throws Forbidden when workspace denies bot access', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(false);
    await expect(
      ctrl.knowledgeSourcesAnalytics({ user: { _id: 'u1', role: 'member' } } as never, 'bot1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('calls analytics service when access granted', async () => {
    findOneMock.mockResolvedValue({ _id: 'bot1' });
    canAccessMock.mockResolvedValue(true);
    getMock.mockResolvedValue({ range: { from: '', to: '', granularity: 'day' } });
    const res = await ctrl.knowledgeSourcesAnalytics(
      { user: { _id: 'u1', role: 'member' } } as never,
      'bot1',
      { includePreview: 'false', granularity: 'week', sourceType: 'document' },
    );
    expect(res).toEqual({ range: { from: '', to: '', granularity: 'day' } });
    expect(getMock).toHaveBeenCalledWith('bot1', {
      from: undefined,
      to: undefined,
      granularity: 'week',
      sourceType: 'document',
      includePreview: 'false',
    });
  });
});
