import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import { RagService } from '../rag/rag.service';
import { KnowledgeBaseRetrievalService } from './knowledge-base-retrieval.service';

describe('KnowledgeBaseRetrievalService (fair chunk retrieval)', () => {
  let service: KnowledgeBaseRetrievalService;
  let chunkAggregate: jest.Mock;
  let itemFind: jest.Mock;
  let botFindById: jest.Mock;

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
    itemFind = jest.fn();
    botFindById = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseRetrievalService,
        { provide: RagService, useValue: { embedText: jest.fn().mockResolvedValue(embedVec) } },
        { provide: getModelToken(Bot.name), useValue: { findById: botFindById } },
        {
          provide: getModelToken(KnowledgeBaseItem.name),
          useValue: { find: itemFind, findOne: jest.fn() },
        },
        {
          provide: getModelToken(KnowledgeBaseChunk.name),
          useValue: {
            aggregate: (...args: unknown[]) => ({
              exec: () => chunkAggregate(...args),
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(KnowledgeBaseRetrievalService);
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

    chunkAggregate.mockResolvedValue([...domChunks, answerChunk]);

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

    expect(chunkAggregate).toHaveBeenCalledTimes(1);
    const pipeline = chunkAggregate.mock.calls[0][0] as object[];
    expect(pipeline.some((stage) => '$setWindowFields' in stage)).toBe(true);
    expect(pipeline.some((stage) => '$match' in stage && JSON.stringify(stage).includes('rowNumber'))).toBe(
      true,
    );
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

    chunkAggregate.mockResolvedValue([]);

    await service.getRelevantKnowledgeItemsFromKnowledgeBase(botId, 'x', {});

    const pipeline = chunkAggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    const matchRowNumber = pipeline.find((s) => '$match' in s && (s.$match as { rowNumber?: unknown })?.rowNumber) as
      | { $match: { rowNumber: { $lte: number } } }
      | undefined;
    expect(matchRowNumber?.$match?.rowNumber?.$lte).toBe(500);
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
    chunkAggregate.mockResolvedValue([
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
    chunkAggregate.mockResolvedValue([
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
    chunkAggregate.mockResolvedValue([
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
    chunkAggregate.mockResolvedValue([
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
    chunkAggregate.mockResolvedValue([
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
    const inactiveFaqRes = await service.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      'refund policy details',
      {},
    );
    expect(inactiveFaqRes.items.some((i) => i.sourceType === 'faq')).toBe(false);
    expect(inactiveFaqRes.items[0]?.sourceType).toBe('document');
  });
});
