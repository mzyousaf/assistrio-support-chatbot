import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Bot, Conversation, Message, User, Visitor, VisitorEvent, WorkspaceMembership } from '../models';
import { DocumentsService } from '../documents/documents.service';
import { AnalyticsService } from './analytics.service';
import { platformBotsMatchClause } from './admin-bots-summary-scope.util';

const customerId = '507f1f77bcf86cd799439011';
const platformBotId = new Types.ObjectId();
const tenantBotId = new Types.ObjectId();

describe('AnalyticsService admin scope', () => {
  let service: AnalyticsService;
  const botFind = jest.fn();
  const botLean = jest.fn();
  const userFindOne = jest.fn();
  const membershipFind = jest.fn();
  const messageAggregate = jest.fn();
  const conversationAggregate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    botFind.mockReturnValue({ select: () => ({ lean: botLean }) });
    botLean.mockResolvedValue([]);
    userFindOne.mockReturnValue({ lean: () => Promise.resolve({ _id: customerId, role: 'customer', email: 'a@b.com' }) });
    membershipFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
    messageAggregate.mockResolvedValue([]);
    conversationAggregate.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getModelToken(VisitorEvent.name), useValue: {} },
        { provide: getModelToken(Visitor.name), useValue: {} },
        {
          provide: getModelToken(Bot.name),
          useValue: { find: botFind, findById: jest.fn() },
        },
        {
          provide: getModelToken(Conversation.name),
          useValue: { aggregate: conversationAggregate, countDocuments: jest.fn() },
        },
        {
          provide: getModelToken(Message.name),
          useValue: { aggregate: messageAggregate, countDocuments: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getModelToken(User.name),
          useValue: { findOne: userFindOne },
        },
        {
          provide: getModelToken(WorkspaceMembership.name),
          useValue: { find: membershipFind },
        },
        { provide: DocumentsService, useValue: { countByBot: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AnalyticsService);
  });

  it('getBotsSummary defaults to scope all with empty bot filter', async () => {
    await service.getBotsSummary({ scope: 'all' });
    expect(botFind).toHaveBeenCalledWith({});
  });

  it('getBotsSummary scope=platform filters isPlatformBot', async () => {
    await service.getBotsSummary({ scope: 'platform' });
    expect(botFind).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([platformBotsMatchClause()]),
      }),
    );
  });

  it('getBotsSummary customerId uses accessible customer match', async () => {
    await service.getBotsSummary({ scope: 'customer', customerId });
    expect(userFindOne).toHaveBeenCalled();
    expect(botFind).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.any(Array),
          }),
        ]),
      }),
    );
  });

  it('getBotsSummary rows include ownership fields', async () => {
    const platformBot = {
      _id: platformBotId,
      name: 'Platform',
      slug: 'platform',
      isPlatformBot: true,
      platformBotType: 'landing_demo' as const,
      status: 'published',
      createdAt: new Date('2025-01-01'),
    };
    botLean.mockResolvedValue([platformBot]);
    const res = await service.getBotsSummary({ scope: 'platform' });
    expect(res.bots[0]).toMatchObject({
      isPlatformBot: true,
      platformBotType: 'landing_demo',
    });
  });

  it('getLeadsSummary scope=platform returns filter metadata', async () => {
    botLean.mockResolvedValueOnce([{ _id: platformBotId }]);
    conversationAggregate.mockResolvedValue([]);
    const res = await service.getLeadsSummary({ scope: 'platform' });
    expect(res.filter).toEqual({ scope: 'platform' });
    expect(res.totals.conversationsWithCapturedLeads).toBe(0);
  });

  it('getCustomerAnalyticsOverview aggregates customer bots', async () => {
    botLean.mockResolvedValueOnce([
      {
        _id: tenantBotId,
        name: 'Tenant',
        status: 'draft',
        isPlatformBot: false,
        createdAt: new Date('2025-02-01'),
      },
    ]);
    messageAggregate.mockResolvedValueOnce([
      { _id: tenantBotId, messageCount: 5, showcaseRuntimeUserMessages: 0, trialRuntimeUserMessages: 0 },
    ]);
    conversationAggregate
      .mockResolvedValueOnce([{ _id: tenantBotId, conversationCount: 2 }])
      .mockResolvedValue([]);

    const res = await service.getCustomerAnalyticsOverview(customerId, {});
    expect(res.ok).toBe(true);
    expect(res.customer.id).toBe(customerId);
    expect(res.totals.botCount).toBe(1);
    expect(res.totals.messageCount).toBe(5);
    expect(res.totals.conversationCount).toBe(2);
    expect(res.bots[0].botId).toBe(String(tenantBotId));
    expect(res.bots[0].isPlatformBot).toBe(false);
  });
});
