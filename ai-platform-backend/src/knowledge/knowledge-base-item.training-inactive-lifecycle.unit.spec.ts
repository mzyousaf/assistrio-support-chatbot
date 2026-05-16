import { Types } from 'mongoose';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import type { KnowledgeTrainingSettingsResolved } from './bot-knowledge-training-settings.util';
import { knowledgeItemExcludeDeletedOnlyClause } from './knowledge-base-item-access.service';

describe('KnowledgeBaseItemService training lifecycle (active:false semantics)', () => {
  const now = new Date('2026-05-09T12:00:00.000Z');

  function callBuildTrainable(
    settings: KnowledgeTrainingSettingsResolved,
    args: {
      needsRetrain: boolean;
      hasTrainedBefore: boolean;
      smartSchedule?: { kind: 'faq' };
      currentStatus?: 'pending' | 'queued' | 'processing' | 'failed' | 'ready';
    },
  ): ReturnType<KnowledgeBaseItemService['buildTrainableContentStatus']> {
    return (KnowledgeBaseItemService.prototype as unknown as {
      buildTrainableContentStatus: KnowledgeBaseItemService['buildTrainableContentStatus'];
    }).buildTrainableContentStatus(settings, {
      needsRetrain: args.needsRetrain,
      now,
      hasTrainedBefore: args.hasTrainedBefore,
      smartSchedule: args.smartSchedule,
      currentStatus: args.currentStatus,
    });
  }

  /**
   * `buildTrainableContentStatus` ignores “use in replies” — inactive rows follow the same training queue rules.
   */
  describe('buildTrainableContentStatus', () => {
    const off: KnowledgeTrainingSettingsResolved = {
      autoTrainEnabled: false,
      trainingDelayMinutes: 60,
      scheduleMode: 'fixed',
    };
    const on: KnowledgeTrainingSettingsResolved = {
      autoTrainEnabled: true,
      trainingDelayMinutes: 42,
      scheduleMode: 'fixed',
    };

    it('needsRetrain + autoTrain OFF → pending, clears queue fields', () => {
      const r = callBuildTrainable(off, {
        needsRetrain: true,
        hasTrainedBefore: false,
        smartSchedule: { kind: 'faq' },
      });
      expect((r as { $set?: { status?: string } }).$set?.status).toBe('pending');
      expect((r as { $unset?: Record<string, 1> }).$unset?.runAfter).toBe(1);
    });

    it('needsRetrain + autoTrain ON + first train → queued, runAfter ≈ now', () => {
      const r = callBuildTrainable(on, {
        needsRetrain: true,
        hasTrainedBefore: false,
        smartSchedule: { kind: 'faq' },
      }) as { $set: { status?: string; runAfter?: Date; lastQueuedAt?: Date } };
      expect(r.$set.status).toBe('queued');
      expect(r.$set.lastQueuedAt?.getTime()).toBe(now.getTime());
      expect(r.$set.runAfter?.getTime()).toBe(now.getTime());
    });

    it('needsRetrain + autoTrain ON + already trained → queued, delayed runAfter', () => {
      /** Omit `smartSchedule` so spacing uses bot `trainingDelayMinutes` (not FAQ smart pacing). */
      const r = callBuildTrainable(on, {
        needsRetrain: true,
        hasTrainedBefore: true,
      }) as { $set: { status?: string; runAfter?: Date; lastQueuedAt?: Date } };
      expect(r.$set.status).toBe('queued');
      const delayMs = 42 * 60_000;
      expect(r.$set.runAfter?.getTime()).toBe(now.getTime() + delayMs);
    });
  });

  it('aggregateAgentTrainingLifecycleBundle loads non-soft-deleted rows without active filter', async () => {
    const botId = new Types.ObjectId().toString();
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find };
    svc.loadDocumentIngestJobContext = jest.fn().mockResolvedValue({
      mergedIngestByKbId: new Map(),
      embedByKbId: new Map(),
    });

    await svc.aggregateAgentTrainingLifecycleBundle(botId, now);

    expect(find).toHaveBeenCalledWith(
      expect.not.objectContaining({ active: { $ne: false } }),
    );
    expect(find).toHaveBeenCalledWith({
      botId: expect.any(Types.ObjectId),
      sourceType: { $in: expect.arrayContaining(['document', 'faq', 'note', 'table', 'suggestion']) },
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    });
  });

  it('listPendingTrainingItemSummaries maps processing rows to in_training', async () => {
    const botId = new Types.ObjectId().toString();
    const kbId = new Types.ObjectId();
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: kbId,
              sourceType: 'faq',
              status: 'processing',
              title: 'Q one',
              runAfter: null,
            },
          ]),
        }),
      }),
    });

    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find };
    svc.displayTitleForPendingKbItem = jest.fn((r: { title?: string }) => String(r.title ?? ''));

    const out = await svc.listPendingTrainingItemSummaries(botId);

    expect(out).toEqual([
      expect.objectContaining({
        id: kbId.toString(),
        sourceType: 'faq',
        title: 'Q one',
        displayStatus: 'in_training',
      }),
    ]);
  });

  it('listPendingTrainingItemSummaries maps due queued rows to training_queued', async () => {
    const botId = new Types.ObjectId().toString();
    const kbId = new Types.ObjectId();
    const dueAt = new Date(Date.now() - 120_000);
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: kbId,
              sourceType: 'note',
              status: 'queued',
              title: 'N1',
              runAfter: null,
            },
            {
              _id: new Types.ObjectId(),
              sourceType: 'faq',
              status: 'queued',
              title: 'Q due',
              runAfter: dueAt,
            },
          ]),
        }),
      }),
    });

    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find };
    svc.displayTitleForPendingKbItem = jest.fn((r: { title?: string }) => String(r.title ?? ''));

    const out = await svc.listPendingTrainingItemSummaries(botId);

    expect(out).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: kbId.toString(),
          sourceType: 'note',
          title: 'N1',
          displayStatus: 'training_queued',
        }),
        expect.objectContaining({
          sourceType: 'faq',
          title: 'Q due',
          displayStatus: 'training_queued',
          nextRunAfter: dueAt.toISOString(),
        }),
      ]),
    );
    expect(out).toHaveLength(2);
  });

  it('listPendingTrainingItemSummaries query includes inactive rows (exclude deleted only)', async () => {
    const botId = new Types.ObjectId().toString();
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find };
    svc.displayTitleForPendingKbItem = jest.fn(() => '');
    svc.getBotTrainingSettings = jest.fn().mockResolvedValue({});

    await svc.listPendingTrainingItemSummaries(botId);

    const arg = find.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg).toBeDefined();
    expect(arg).not.toMatchObject({ active: { $ne: false } });
    expect(arg.$and).toEqual(expect.arrayContaining([knowledgeItemExcludeDeletedOnlyClause()]));
  });
});
