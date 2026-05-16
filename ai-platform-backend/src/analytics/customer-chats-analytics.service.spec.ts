import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CustomerChatsAnalyticsService } from './customer-chats-analytics.service';
import { Conversation, Message, UsageLedger } from '../models';

describe('CustomerChatsAnalyticsService', () => {
  let service: CustomerChatsAnalyticsService;

  const conversationModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };
  const messageModel = {
    aggregate: jest.fn(),
  };
  const usageLedgerModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    usageLedgerModel.countDocuments.mockResolvedValue(0);
    conversationModel.countDocuments.mockResolvedValue(0);
    conversationModel.aggregate.mockResolvedValue([]);
    usageLedgerModel.aggregate.mockResolvedValue([]);
    messageModel.aggregate.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerChatsAnalyticsService,
        { provide: getModelToken(Conversation.name), useValue: conversationModel },
        { provide: getModelToken(Message.name), useValue: messageModel },
        { provide: getModelToken(UsageLedger.name), useValue: usageLedgerModel },
      ],
    }).compile();

    service = module.get(CustomerChatsAnalyticsService);
  });

  it('summary exposes thumb counts from assistant feedback aggregation only', async () => {
    messageModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const groupStages = pipeline.filter(
        (s): s is { $group: { _id: unknown } } =>
          typeof s === 'object' && s !== null && '$group' in s,
      );
      const groupId = groupStages[groupStages.length - 1]?.$group?._id;
      if (typeof groupId === 'object' && groupId !== null && groupId !== undefined && 'b' in groupId) {
        return Promise.resolve([]);
      }
      const m0 = pipeline[0] as { $match?: Record<string, unknown> };
      if (m0?.$match?.role === 'assistant' && m0?.$match?.['feedback.rating']) {
        return Promise.resolve([
          { _id: 'up', n: 4 },
          { _id: 'down', n: 1 },
        ]);
      }
      return Promise.resolve([]);
    });

    const botId = new Types.ObjectId().toString();
    const res = await service.get(botId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      includePreview: 'true',
    });

    expect(res.summary.totalThumbsUp).toBe(4);
    expect(res.summary.totalThumbsDown).toBe(1);
    expect(res.summary).toMatchObject({
      totalConversations: 0,
      totalMessages: 0,
      averageMessagesPerConversation: 0,
    });
    expect(res.summary).not.toHaveProperty('totalCreditsUsed');
    expect(res.summary).not.toHaveProperty('totalLeads');
  });

  it('feedback aggregate pipeline applies preview exclusion when includePreview is false', async () => {
    let feedbackPipeline: unknown[] | null = null;
    messageModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const groupStages = pipeline.filter(
        (s): s is { $group: { _id: unknown } } =>
          typeof s === 'object' && s !== null && '$group' in s,
      );
      const groupId = groupStages[groupStages.length - 1]?.$group?._id;
      if (typeof groupId === 'object' && groupId !== null && groupId !== undefined && 'b' in groupId) {
        return Promise.resolve([]);
      }
      const m0 = pipeline[0] as { $match?: Record<string, unknown> };
      if (m0?.$match?.role === 'assistant' && m0?.$match?.['feedback.rating']) {
        feedbackPipeline = pipeline;
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const botId = new Types.ObjectId().toString();
    await service.get(botId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      includePreview: 'false',
    });

    const s = JSON.stringify(feedbackPipeline);
    expect(s).toContain('$nin');
    expect(s).toContain('playground_preview');
    expect(s).toContain('shared_preview');
  });

  it('returns topPagesBreakdown with normalized pages (no query/hash)', async () => {
    conversationModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const group = pipeline.find(
        (s) => typeof s === 'object' && s !== null && '$group' in s,
      ) as { $group?: { _id?: unknown } } | undefined;
      const id = group?.$group?._id;
      if (id && typeof id === 'object' && id !== null && 'pageUrl' in id) {
        return Promise.resolve([
          {
            _id: {
              pageUrl: 'https://shop.example.com/help?utm=secret#x',
              websiteOrigin: 'https://shop.example.com',
            },
            conversations: 2,
            messageRollup: 5,
          },
        ]);
      }
      if (id && typeof id === 'object' && id !== null && '$switch' in id) {
        return Promise.resolve([
          { _id: 'runtime_widget', conversations: 2 },
        ]);
      }
      return Promise.resolve([]);
    });

    const botId = new Types.ObjectId().toString();
    const res = await service.get(botId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });

    expect(res.topPagesBreakdown).toHaveLength(1);
    expect(res.topPagesBreakdown[0]).toMatchObject({
      page: 'shop.example.com/help',
      pageLabel: 'shop.example.com/help',
      websiteOrigin: 'shop.example.com',
      conversations: 2,
      messages: 5,
    });
    expect(res.topPagesBreakdown[0]?.page).not.toContain('?');
    expect(res.topPagesBreakdown[0]?.page).not.toContain('#');
  });

  it('maps missing pageUrl to Unknown page in topPagesBreakdown', async () => {
    conversationModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const group = pipeline.find(
        (s) => typeof s === 'object' && s !== null && '$group' in s,
      ) as { $group?: { _id?: unknown } } | undefined;
      const id = group?.$group?._id;
      if (id && typeof id === 'object' && id !== null && 'pageUrl' in id) {
        return Promise.resolve([
          { _id: { pageUrl: null, websiteOrigin: null }, conversations: 1, messageRollup: 0 },
        ]);
      }
      return Promise.resolve([]);
    });

    const botId = new Types.ObjectId().toString();
    const res = await service.get(botId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });

    expect(res.topPagesBreakdown[0]?.page).toBe('Unknown page');
    expect(res.topPagesBreakdown[0]?.pageLabel).toBe('Unknown page');
  });

  it('returns startedFromBreakdown with friendly labels', async () => {
    conversationModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const group = pipeline.find(
        (s) => typeof s === 'object' && s !== null && '$group' in s,
      ) as { $group?: { _id?: unknown } } | undefined;
      const id = group?.$group?._id;
      if (id && typeof id === 'object' && id !== null && '$switch' in id) {
        return Promise.resolve([
          { _id: 'runtime_iframe', conversations: 3 },
        ]);
      }
      return Promise.resolve([]);
    });
    messageModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const group = pipeline.find(
        (s) => typeof s === 'object' && s !== null && '$group' in s,
      ) as { $group?: { _id?: unknown } } | undefined;
      const id = group?.$group?._id;
      if (id && typeof id === 'object' && id !== null && '$switch' in id) {
        return Promise.resolve([{ _id: 'runtime_iframe', messages: 8 }]);
      }
      return Promise.resolve([]);
    });

    const botId = new Types.ObjectId().toString();
    const res = await service.get(botId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });

    expect(res.startedFromBreakdown).toEqual([
      {
        key: 'runtime_iframe',
        label: 'Runtime IFrame',
        conversations: 3,
        messages: 8,
      },
    ]);
  });

  it('excludes preview sources from startedFrom when includePreview is false', async () => {
    let convMatchJson = '';
    conversationModel.countDocuments.mockImplementation((match: Record<string, unknown>) => {
      convMatchJson = JSON.stringify(match);
      return Promise.resolve(0);
    });

    const botId = new Types.ObjectId().toString();
    await service.get(botId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      includePreview: 'false',
    });

    expect(convMatchJson).toContain('playground_preview');
    expect(convMatchJson).toContain('shared_preview');
  });
});
