import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import { RagService } from '../rag/rag.service';
import { KnowledgeBaseRetrievalService } from './knowledge-base-retrieval.service';
import { retrievalResultCache } from '../rag/retrieval-result-cache.util';

describe('KnowledgeBaseRetrievalService (fair chunk retrieval)', () => {
  let service: KnowledgeBaseRetrievalService;
  let chunkAggregate: jest.Mock;
  let chunkFind: jest.Mock;
  let itemFind: jest.Mock;
  let itemFindOne: jest.Mock;
  let itemAggregate: jest.Mock;
  let botFindById: jest.Mock;

  const defaultKbVersionMs = new Date('2024-06-01T00:00:00.000Z').getTime();

  function mockKbVersionStamp() {
    itemAggregate.mockReturnValue({
      exec: async () => [{ maxUpdated: new Date(defaultKbVersionMs) }],
    });
  }

  function setChunkRows(rows: unknown[]) {
    chunkFind.mockResolvedValue(rows);
    chunkAggregate.mockResolvedValue(rows);
  }

  const botId = new Types.ObjectId().toString();
  const botOid = new Types.ObjectId(botId);
  const itemDomId = new Types.ObjectId();
  const itemAnswerId = new Types.ObjectId();

  const embedVec = Array.from({ length: 8 }, (_, i) => (i === 0 ? 1 : 0));

  function setBotFlags(flags?: { includeNotesInKnowledge?: boolean; knowledgeReplyPriority?: unknown }) {
    botFindById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          includeNotesInKnowledge: true,
          ...(flags ?? {}),
        }),
      }),
    });
  }

  beforeEach(async () => {
    chunkAggregate = jest.fn();
    chunkFind = jest.fn();
    itemFind = jest.fn();
    itemFindOne = jest.fn().mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: async () => null,
        }),
      }),
    });
    itemAggregate = jest.fn();
    mockKbVersionStamp();
    botFindById = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseRetrievalService,
        { provide: RagService, useValue: { embedText: jest.fn().mockResolvedValue(embedVec) } },
        { provide: getModelToken(Bot.name), useValue: { findById: botFindById } },
        {
          provide: getModelToken(KnowledgeBaseItem.name),
          useValue: {
            find: itemFind,
            findOne: itemFindOne,
            aggregate: (...args: unknown[]) => ({
              exec: () => itemAggregate(...args),
            }),
          },
        },
        {
          provide: getModelToken(KnowledgeBaseChunk.name),
          useValue: {
            aggregate: (...args: unknown[]) => ({
              exec: () => chunkAggregate(...args),
            }),
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                  lean: () => chunkFind(),
                }),
              }),
            }),
            collection: { name: 'knowledgebasechunks' },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(KnowledgeBaseRetrievalService);
    retrievalResultCache.clear();
  });

  it('still surfaces a matching chunk from a KB item that would be starved by a global 500 cap', async () => {
    setBotFlags();

    const domChunks = Array.from({ length: 120 }, (_, i) => ({
      _id: new Types.ObjectId(),
      knowledgeBaseItemId: itemDomId,
      text: `dom filler segment ${i} `.repeat(20),
      embedding: embedVec,
      chunkIndex: i,
    }));

    const answerText =
      'SPECIAL_WIDGET_SERIAL_9F3C the warranty extension applies when registered within 30 days.';
    const answerChunk = {
      _id: new Types.ObjectId(),
      knowledgeBaseItemId: itemAnswerId,
      text: answerText,
      embedding: embedVec,
      chunkIndex: 0,
    };

    setChunkRows([...domChunks, answerChunk]);

    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDomId,
            botId: botOid,
            title: 'Huge doc',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
          {
            _id: itemAnswerId,
            botId: botOid,
            title: 'FAQ',
            sourceType: 'faq',
            active: true,
            deletedAt: null,
            status: 'ready',
            extractionStatus: 'not_required',
          },
        ],
      }),
    });

    const query = 'SPECIAL_WIDGET_SERIAL_9F3C warranty extension';
    const { items } = await service.getRelevantKnowledgeItemsFromKnowledgeBase(botId, query, {});

    const texts = items.map((i) => i.text);
    expect(texts.some((t) => t.includes('SPECIAL_WIDGET_SERIAL_9F3C'))).toBe(true);

    expect(chunkFind).toHaveBeenCalled();
  });

  it('uses a 500 rowNumber cap when only one eligible KB item exists (legacy scale)', async () => {
    setBotFlags();

    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDomId,
            botId: botOid,
            title: 'Only doc',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
        ],
      }),
    });

    setChunkRows([]);

    await service.getRelevantKnowledgeItemsFromKnowledgeBase(botId, 'x', {});

    expect(chunkFind).toHaveBeenCalled();
  });

  it('priority mode prefers FAQ when relevance is similarly close', async () => {
    setBotFlags({
      knowledgeReplyPriority: {
        mode: 'priority',
        sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
      },
    });

    const itemDocId = new Types.ObjectId();
    const itemFaqId = new Types.ObjectId();
    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDocId,
            botId: botOid,
            title: 'Document policy',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
          {
            _id: itemFaqId,
            botId: botOid,
            title: 'Refund FAQ',
            sourceType: 'faq',
            active: true,
            deletedAt: null,
            status: 'ready',
            extractionStatus: 'not_required',
          },
        ],
      }),
    });
    setChunkRows([
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemDocId,
        text: 'refund policy details and terms',
        embedding: embedVec,
        chunkIndex: 0,
      },
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemFaqId,
        text: 'refund policy details and terms',
        embedding: embedVec,
        chunkIndex: 0,
      },
    ]);

    const res = await service.getRelevantKnowledgeItemsFromKnowledgeBase(botId, 'refund policy details', {});
    expect(res.items[0]?.sourceType).toBe('faq');
  });

  it('priority mode still keeps clearly higher relevance above source preference', async () => {
    setBotFlags({
      knowledgeReplyPriority: {
        mode: 'priority',
        sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
      },
    });

    const itemDocId = new Types.ObjectId();
    const itemFaqId = new Types.ObjectId();
    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDocId,
            botId: botOid,
            title: 'Document exact answer',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
          {
            _id: itemFaqId,
            botId: botOid,
            title: 'FAQ weak',
            sourceType: 'faq',
            active: true,
            deletedAt: null,
            status: 'ready',
            extractionStatus: 'not_required',
          },
        ],
      }),
    });
    setChunkRows([
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemDocId,
        text: 'SPECIAL_DOC_ONLY_TOKEN warranty period is 48 months',
        embedding: embedVec,
        chunkIndex: 0,
      },
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemFaqId,
        text: 'general FAQ text',
        embedding: [0, 1, 0, 0, 0, 0, 0, 0],
        chunkIndex: 0,
      },
    ]);

    const res = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'SPECIAL_DOC_ONLY_TOKEN warranty period',
      {},
    );
    expect(res.items[0]?.sourceType).toBe('document');
  });

  it('default vs priority mode through retrieval path (including inactive FAQ exclusion)', async () => {
    const itemDocId = new Types.ObjectId();
    const itemFaqId = new Types.ObjectId();
    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDocId,
            botId: botOid,
            title: 'Document policy',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
          {
            _id: itemFaqId,
            botId: botOid,
            title: 'Refund FAQ',
            sourceType: 'faq',
            active: true,
            deletedAt: null,
            status: 'ready',
            extractionStatus: 'not_required',
          },
        ],
      }),
    });
    setChunkRows([
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemDocId,
        text: 'refund policy details and terms from document',
        embedding: embedVec,
        chunkIndex: 0,
      },
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemFaqId,
        text: 'refund policy details and terms from faq',
        embedding: embedVec,
        chunkIndex: 0,
      },
    ]);

    // 1) Default mode: existing score-first behavior preserved.
    setBotFlags();
    const baselineRes = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'refund policy details',
      {},
    );
    setBotFlags({
      knowledgeReplyPriority: {
        mode: 'default',
        sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
      },
    });
    const defaultRes = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'refund policy details',
      {},
    );
    expect(defaultRes.items[0]?.sourceType).toBe(baselineRes.items[0]?.sourceType);

    // 2) Priority mode: similar relevance allows FAQ preference.
    setBotFlags({
      knowledgeReplyPriority: {
        mode: 'priority',
        sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
      },
    });
    const priorityRes = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'refund policy details',
      {},
    );
    expect(priorityRes.items[0]?.sourceType).toBe('faq');

    // 3) Priority mode still keeps clearly stronger document first.
    setChunkRows([
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemDocId,
        text: 'SPECIAL_DOC_ONLY_TOKEN warranty period is 48 months',
        embedding: embedVec,
        chunkIndex: 0,
      },
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemFaqId,
        text: 'generic FAQ text unrelated',
        embedding: [0, 1, 0, 0, 0, 0, 0, 0],
        chunkIndex: 0,
      },
    ]);
    const strongDocRes = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'SPECIAL_DOC_ONLY_TOKEN warranty period',
      {},
    );
    expect(strongDocRes.items[0]?.sourceType).toBe('document');

    // 4) Inactive high-priority FAQ is excluded.
    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDocId,
            botId: botOid,
            title: 'Document policy',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
          {
            _id: itemFaqId,
            botId: botOid,
            title: 'Refund FAQ',
            sourceType: 'faq',
            active: false,
            deletedAt: null,
            status: 'ready',
            extractionStatus: 'not_required',
          },
        ],
      }),
    });
    setChunkRows([
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemDocId,
        text: 'refund policy details and terms from document',
        embedding: embedVec,
        chunkIndex: 0,
      },
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemFaqId,
        text: 'refund policy details and terms from faq',
        embedding: embedVec,
        chunkIndex: 0,
      },
    ]);
    retrievalResultCache.clear();
    const inactiveFaqRes = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'refund policy details',
      {},
    );
    expect(inactiveFaqRes.items.some((i) => i.sourceType === 'faq')).toBe(false);
    expect(inactiveFaqRes.items[0]?.sourceType).toBe('document');
  });

  it('returns retrieval result cache hit on repeated query without reloading chunks', async () => {
    setBotFlags();
    itemFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            _id: itemDomId,
            botId: botOid,
            title: 'About',
            sourceType: 'document',
            active: true,
            deletedAt: null,
            status: 'ready',
            isContentExtracted: true,
            extractionStatus: 'done',
          },
        ],
      }),
    });
    setChunkRows([
      {
        _id: new Types.ObjectId(),
        knowledgeBaseItemId: itemDomId,
        text: 'Assistrio is a support automation platform.',
        embedding: embedVec,
        chunkIndex: 0,
      },
    ]);

    const opts = {
      answerMode: 'knowledge_first',
      maxEvidenceItems: 8,
      maxEvidenceTokens: 2200,
    };
    const query = 'Tell me about Assistrio';
    const first = await service.getRelevantKnowledgeItemsFromKnowledgeBase(botId, query, opts);
    expect(first.items.length).toBeGreaterThan(0);

    chunkFind.mockClear();
    chunkAggregate.mockClear();
    const second = await service.getRelevantKnowledgeItemsFromKnowledgeBase(botId, query, opts);
    expect(second.timing?.retrievalResultCacheHit).toBe(true);
    expect(second.timing?.chunkAggregateMs).toBe(0);
    expect(chunkFind).not.toHaveBeenCalled();
    expect(chunkAggregate).not.toHaveBeenCalled();
  });
});
