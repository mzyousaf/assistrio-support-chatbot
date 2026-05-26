import { HttpException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  BotKnowledgeTotalLimitService,
  PLAN_LIMIT_BOT_KB_TOTAL_CODE,
  isPlanLimitBotKbTotalHttpException,
} from './bot-knowledge-total-limit.service';

function mockBotModelLean(botLean: unknown) {
  return {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(botLean) }),
    }),
  };
}

function mockItemFindLean(rows: unknown[]) {
  return {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) }),
    }),
  };
}

describe('BotKnowledgeTotalLimitService', () => {
  const botId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId();

  function buildSvc(input: {
    botLean: unknown;
    knowledgeSizeResolver?: { resolveForBotLean: jest.Mock };
    knowledgeUsageService?: { getActiveBotKnowledgeUsage: jest.Mock };
    itemModel?: ReturnType<typeof mockItemFindLean>;
  }) {
    const knowledgeSizeResolver = input.knowledgeSizeResolver ?? {
      resolveForBotLean: jest.fn().mockResolvedValue({ maxBytes: 50 * 1024 * 1024 }),
    };
    const knowledgeUsageService = input.knowledgeUsageService ?? {
      getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({ totalBytes: 50 * 1024 * 1024 }),
    };
    const itemModel = input.itemModel ?? mockItemFindLean([]);
    const botModel = mockBotModelLean(input.botLean);
    return new BotKnowledgeTotalLimitService(
      knowledgeUsageService as never,
      knowledgeSizeResolver as never,
      itemModel as never,
      botModel as never,
    );
  }

  it('throws HttpException with plan_limit_bot_kb_total payload when over default maxBytes', async () => {
    const svc = buildSvc({ botLean: null });
    try {
      await svc.assertWithinLimit(botId, { incomingBytes: 1 });
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(isPlanLimitBotKbTotalHttpException(e)).toBe(true);
      const res = (e as HttpException).getResponse() as Record<string, unknown>;
      expect(res.errorCode).toBe(PLAN_LIMIT_BOT_KB_TOTAL_CODE);
      expect(res.maxBytes).toBe(50 * 1024 * 1024);
      expect(res.currentBytes).toBe(50 * 1024 * 1024);
      expect(res.incomingBytes).toBe(1);
      expect(res.projectedBytes).toBe(50 * 1024 * 1024 + 1);
      expect(res.oldItemBytes).toBe(0);
      expect(res.newItemBytes).toBe(1);
      expect(res.remainingBytes).toBe(0);
    }
  });

  it('uses custom botConfig.knowledgeSize.maxBytes', async () => {
    const svc = buildSvc({
      botLean: {
        botConfig: {
          knowledgeSize: { type: 'custom', maxBytes: 1000, baseMaxBytes: 1000, extraMaxBytes: 0 },
        },
      },
      knowledgeSizeResolver: {
        resolveForBotLean: jest.fn().mockResolvedValue({ maxBytes: 1000 }),
      },
      knowledgeUsageService: {
        getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({ totalBytes: 900 }),
      },
    });
    await expect(svc.assertWithinLimit(botId, { incomingBytes: 101 })).rejects.toBeInstanceOf(HttpException);
    await expect(svc.assertWithinLimit(botId, { incomingBytes: 100 })).resolves.toBeUndefined();
  });

  it('subtracts replacing document bytes before comparing', async () => {
    const replacingId = new Types.ObjectId();
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              sourceType: 'document',
              active: true,
              content: 'hello',
              isContentExtracted: true,
              extractionStatus: 'done',
            },
          ]),
        }),
      }),
    };
    const svc = buildSvc({
      botLean: {
        botConfig: {
          knowledgeSize: { type: 'custom', maxBytes: 1000, baseMaxBytes: 1000, extraMaxBytes: 0 },
        },
      },
      knowledgeSizeResolver: {
        resolveForBotLean: jest.fn().mockResolvedValue({ maxBytes: 1000 }),
      },
      knowledgeUsageService: {
        getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({ totalBytes: 1000 }),
      },
      itemModel,
    });
    await expect(
      svc.assertWithinLimit(botId, { replacingItemIds: [replacingId], incomingBytes: 500 }),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      svc.assertWithinLimit(botId, { replacingItemIds: [replacingId], incomingBytes: 4 }),
    ).resolves.toBeUndefined();
  });

  it('assertStoredBytesBelowCapForNewContent throws when stored usage is at cap', async () => {
    const svc = buildSvc({ botLean: null });
    await expect(svc.assertStoredBytesBelowCapForNewContent(botId)).rejects.toBeInstanceOf(HttpException);
  });

  it('allows replace shrink while over max when new bytes are <= replaced bytes', async () => {
    const replacingId = new Types.ObjectId();
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              sourceType: 'document',
              active: true,
              content: 'a'.repeat(500),
              isContentExtracted: true,
              extractionStatus: 'done',
            },
          ]),
        }),
      }),
    };
    const svc = buildSvc({
      botLean: {
        botConfig: {
          knowledgeSize: { type: 'custom', maxBytes: 1000, baseMaxBytes: 1000, extraMaxBytes: 0 },
        },
      },
      knowledgeSizeResolver: {
        resolveForBotLean: jest.fn().mockResolvedValue({ maxBytes: 1000 }),
      },
      knowledgeUsageService: {
        getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({ totalBytes: 1200 }),
      },
      itemModel,
    });
    await expect(
      svc.assertWithinLimit(botId, { replacingItemIds: [replacingId], incomingBytes: 400 }),
    ).resolves.toBeUndefined();
  });

  it('blocks replacement growth when already over max and new bytes exceed old item bytes', async () => {
    const replacingId = new Types.ObjectId();
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              sourceType: 'document',
              active: true,
              content: 'a'.repeat(500),
              isContentExtracted: true,
              extractionStatus: 'done',
            },
          ]),
        }),
      }),
    };
    const svc = buildSvc({
      botLean: {
        botConfig: {
          knowledgeSize: { type: 'custom', maxBytes: 1000, baseMaxBytes: 1000, extraMaxBytes: 0 },
        },
      },
      knowledgeSizeResolver: {
        resolveForBotLean: jest.fn().mockResolvedValue({ maxBytes: 1000 }),
      },
      knowledgeUsageService: {
        getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({ totalBytes: 1200 }),
      },
      itemModel,
    });
    await expect(
      svc.assertWithinLimit(botId, { replacingItemIds: [replacingId], incomingBytes: 600 }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('workspace bot missing knowledgeSize uses resolver plan quota in limit payload', async () => {
    const planBytes = 10 * 1024 * 1024;
    const svc = buildSvc({
      botLean: { workspaceId, botConfig: {} },
      knowledgeSizeResolver: {
        resolveForBotLean: jest.fn().mockResolvedValue({ maxBytes: planBytes }),
      },
      knowledgeUsageService: {
        getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({ totalBytes: planBytes }),
      },
    });
    try {
      await svc.assertWithinLimit(botId, { incomingBytes: 1 });
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(isPlanLimitBotKbTotalHttpException(e)).toBe(true);
      const res = (e as HttpException).getResponse() as Record<string, unknown>;
      expect(res.maxBytes).toBe(planBytes);
      expect(res.currentBytes).toBe(planBytes);
      expect(res.errorCode).toBe(PLAN_LIMIT_BOT_KB_TOTAL_CODE);
    }
    await expect(svc.assertStoredBytesBelowCapForNewContent(botId)).rejects.toBeInstanceOf(HttpException);
  });
});
