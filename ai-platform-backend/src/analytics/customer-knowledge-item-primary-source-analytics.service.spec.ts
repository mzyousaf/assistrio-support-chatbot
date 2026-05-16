import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerKnowledgeItemPrimarySourceAnalyticsService } from './customer-knowledge-item-primary-source-analytics.service';

describe('CustomerKnowledgeItemPrimarySourceAnalyticsService', () => {
  const botId = new Types.ObjectId().toString();
  const itemId = new Types.ObjectId().toString();
  const otherBotId = new Types.ObjectId();

  function svc(opts: {
    kbRow: Record<string, unknown> | null;
    summaryExec: jest.Mock;
    tsExec: jest.Mock;
  }) {
    const knowledgeBaseItemService = {
      findKnowledgeItemById: jest.fn().mockImplementation(async (id: string) => {
        if (id !== itemId) return null;
        return opts.kbRow;
      }),
    };
    let aggCall = 0;
    const messageModel = {
      aggregate: jest.fn().mockImplementation(() => {
        aggCall += 1;
        return {
          exec: aggCall === 1 ? opts.summaryExec : opts.tsExec,
        };
      }),
    };
    return new CustomerKnowledgeItemPrimarySourceAnalyticsService(
      messageModel as never,
      knowledgeBaseItemService as never,
    );
  }

  it('throws when KB item missing', async () => {
    const summaryExec = jest.fn().mockResolvedValue([]);
    const tsExec = jest.fn().mockResolvedValue([]);
    const s = svc({ kbRow: null, summaryExec, tsExec });
    await expect(s.get(botId, itemId, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(summaryExec).not.toHaveBeenCalled();
  });

  it('throws when KB item belongs to another bot', async () => {
    const summaryExec = jest.fn().mockResolvedValue([]);
    const tsExec = jest.fn().mockResolvedValue([]);
    const s = svc({
      kbRow: {
        _id: new Types.ObjectId(itemId),
        botId: otherBotId,
        title: 'X',
        sourceType: 'faq',
      },
      summaryExec,
      tsExec,
    });
    await expect(s.get(botId, itemId, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest on invalid item id', async () => {
    const summaryExec = jest.fn().mockResolvedValue([]);
    const tsExec = jest.fn().mockResolvedValue([]);
    const s = svc({
      kbRow: { _id: new Types.ObjectId(itemId), botId: new Types.ObjectId(botId), title: 'T', sourceType: 'note' },
      summaryExec,
      tsExec,
    });
    await expect(s.get(botId, 'not-an-objectid', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns summary + timeSeries and omits unsafe URLs', async () => {
    const summaryExec = jest.fn().mockResolvedValue([
      {
        primarySourceUses: 2,
        conversations: 2,
        scoreSum: 0.5,
        scoreN: 2,
        lastUsedAt: new Date('2026-01-10T12:00:00.000Z'),
      },
    ]);
    const tsExec = jest.fn().mockResolvedValue([
      {
        _id: new Date('2026-01-09T00:00:00.000Z'),
        primarySourceUses: 2,
        conversations: 1,
        scoreSum: 0.5,
        scoreN: 2,
      },
    ]);
    const s = svc({
      kbRow: {
        _id: new Types.ObjectId(itemId),
        botId: new Types.ObjectId(botId),
        title: ' Hello ',
        sourceType: 'faq',
        fileMeta: { url: 's3://bucket/key' },
      },
      summaryExec,
      tsExec,
    });
    const res = await s.get(botId, itemId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-15T23:59:59.999Z',
      granularity: 'day',
      includePreview: 'true',
    });
    expect(res.source.knowledgeBaseItemId).toBe(itemId);
    expect(res.source.sourceTitle).toBe('Hello');
    expect(res.source.sourceType).toBe('faq');
    expect(res.source.safeUrl).toBeNull();
    expect(res.summary.primarySourceUses).toBe(2);
    expect(res.summary.conversations).toBe(2);
    expect(res.summary.averagePrimarySourceScore).toBe(0.25);
    expect(res.summary.lastUsedAt).toBe('2026-01-10T12:00:00.000Z');
    expect(res.timeSeries.length).toBeGreaterThan(0);
    expect(res.timeSeries.some((p) => p.primarySourceUses === 2)).toBe(true);
    expect(summaryExec).toHaveBeenCalled();
    expect(tsExec).toHaveBeenCalled();
  });

  it('maps https fileMeta.url into safeUrl', async () => {
    const summaryExec = jest.fn().mockResolvedValue([]);
    const tsExec = jest.fn().mockResolvedValue([]);
    const s = svc({
      kbRow: {
        _id: new Types.ObjectId(itemId),
        botId: new Types.ObjectId(botId),
        title: 'Doc',
        sourceType: 'document',
        fileMeta: { url: 'https://example.com/a.pdf' },
      },
      summaryExec,
      tsExec,
    });
    const res = await s.get(botId, itemId, {});
    expect(res.source.safeUrl).toBe('https://example.com/a.pdf');
  });

  it('pipelines include primary knowledgeBaseItemId match', async () => {
    const knowledgeBaseItemService = {
      findKnowledgeItemById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(itemId),
        botId: new Types.ObjectId(botId),
        title: 'T',
        sourceType: 'note',
      }),
    };
    const captured: unknown[][] = [];
    const messageModel = {
      aggregate: jest.fn().mockImplementation((pipeline: unknown[]) => {
        captured.push(pipeline);
        return { exec: jest.fn().mockResolvedValue([]) };
      }),
    };
    const s = new CustomerKnowledgeItemPrimarySourceAnalyticsService(
      messageModel as never,
      knowledgeBaseItemService as never,
    );
    await s.get(botId, itemId, {});
    expect(captured.length).toBe(2);
    const blob = JSON.stringify(captured);
    expect(blob).toContain('primarySourceElem.knowledgeBaseItemId');
  });

  it('pipelines exclude preview conversations when includePreview is false', async () => {
    const knowledgeBaseItemService = {
      findKnowledgeItemById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(itemId),
        botId: new Types.ObjectId(botId),
        title: 'T',
        sourceType: 'note',
      }),
    };
    const captured: unknown[][] = [];
    const messageModel = {
      aggregate: jest.fn().mockImplementation((pipeline: unknown[]) => {
        captured.push(pipeline);
        return { exec: jest.fn().mockResolvedValue([]) };
      }),
    };
    const s = new CustomerKnowledgeItemPrimarySourceAnalyticsService(
      messageModel as never,
      knowledgeBaseItemService as never,
    );
    await s.get(botId, itemId, { includePreview: 'false' });
    const blob = JSON.stringify(captured);
    expect(blob).toContain('_conv.startedFrom');
    expect(blob).toContain('playground_preview');
    expect(blob).toContain('shared_preview');
    expect(blob).toContain('$nin');
  });

  it('pipelines apply startedFrom runtime_widget filter', async () => {
    const knowledgeBaseItemService = {
      findKnowledgeItemById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(itemId),
        botId: new Types.ObjectId(botId),
        title: 'T',
        sourceType: 'note',
      }),
    };
    const captured: unknown[][] = [];
    const messageModel = {
      aggregate: jest.fn().mockImplementation((pipeline: unknown[]) => {
        captured.push(pipeline);
        return { exec: jest.fn().mockResolvedValue([]) };
      }),
    };
    const s = new CustomerKnowledgeItemPrimarySourceAnalyticsService(
      messageModel as never,
      knowledgeBaseItemService as never,
    );
    await s.get(botId, itemId, { startedFrom: 'runtime_widget' });
    expect(JSON.stringify(captured)).toContain('runtime_widget');
  });

  it('response JSON never includes message or chunk payload keys', async () => {
    const summaryExec = jest.fn().mockResolvedValue([]);
    const tsExec = jest.fn().mockResolvedValue([]);
    const s = svc({
      kbRow: {
        _id: new Types.ObjectId(itemId),
        botId: new Types.ObjectId(botId),
        title: 'Hello',
        sourceType: 'faq',
      },
      summaryExec,
      tsExec,
    });
    const res = await s.get(botId, itemId, {});
    const blob = JSON.stringify(res);
    expect(blob).not.toMatch(/"body"\s*:/);
    expect(blob).not.toMatch(/"chunks"\s*:/);
    expect(blob).not.toMatch(/"embedding"\s*:/);
    expect(blob).not.toMatch(/"prompt"\s*:/);
  });
});
