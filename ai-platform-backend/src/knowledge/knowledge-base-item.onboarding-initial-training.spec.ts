import { Types } from 'mongoose';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import type { KnowledgeTrainingSettingsResolved } from './bot-knowledge-training-settings.util';
import { ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS } from './knowledge-bot-upsert.options';

describe('KnowledgeBaseItemService onboarding initial training', () => {
  const now = new Date('2026-05-09T12:00:00.000Z');
  const autoTrainOff: KnowledgeTrainingSettingsResolved = {
    autoTrainEnabled: false,
    trainingDelayMinutes: 60,
    scheduleMode: 'fixed',
  };
  const autoTrainOn: KnowledgeTrainingSettingsResolved = {
    autoTrainEnabled: true,
    trainingDelayMinutes: 42,
    scheduleMode: 'fixed',
  };

  function proto() {
    return KnowledgeBaseItemService.prototype as unknown as {
      buildForcedInitialTrainingStatus: KnowledgeBaseItemService['buildForcedInitialTrainingStatus'];
      newKbItemTrainingFields: KnowledgeBaseItemService['newKbItemTrainingFields'];
      resolveTrainableContentStatusPatch: KnowledgeBaseItemService['resolveTrainableContentStatusPatch'];
    };
  }

  it('forceInitialTraining queues new snippet fields with immediate runAfter when autoTrain is off', () => {
    const row = proto().newKbItemTrainingFields(autoTrainOff, now, {
      forceInitialTraining: true,
      hasContent: true,
      active: true,
      smartSchedule: { kind: 'note' },
    });
    expect(row).toMatchObject({
      status: 'queued',
      lastQueuedAt: now,
      runAfter: now,
      active: true,
    });
  });

  it('normal upsert without forceInitialTraining stays pending when autoTrain is off', () => {
    const row = proto().newKbItemTrainingFields(autoTrainOff, now, {
      hasContent: true,
      active: true,
      smartSchedule: { kind: 'faq' },
    });
    expect(row).toEqual({ status: 'pending', active: true });
  });

  it('normal upsert with autoTrain on uses existing first-train queue timing (not forceInitialTraining)', () => {
    const row = proto().newKbItemTrainingFields(autoTrainOn, now, {
      hasContent: true,
      active: true,
      smartSchedule: { kind: 'note' },
    });
    expect(row).toMatchObject({
      status: 'queued',
      lastQueuedAt: now,
      runAfter: now,
    });
  });

  it('resolveTrainableContentStatusPatch without forceInitialTraining keeps autoTrain off as pending', () => {
    const patch = proto().resolveTrainableContentStatusPatch(
      autoTrainOff,
      {
        needsRetrain: true,
        now,
        hasTrainedBefore: false,
        smartSchedule: { kind: 'note' },
      },
      undefined,
    );
    expect((patch as { $set: { status?: string } }).$set.status).toBe('pending');
  });

  it('forceInitialTraining preserves queued lifecycle on idempotent retry', () => {
    const patch = proto().buildForcedInitialTrainingStatus({
      needsRetrain: false,
      now,
      hasTrainedBefore: false,
      currentStatus: 'queued',
    });
    expect(patch).toEqual({ $set: {}, preserveTrainingLifecycle: true });
  });

  it('forceInitialTraining never marks untrained content ready on first create path', () => {
    const patch = proto().resolveTrainableContentStatusPatch(
      autoTrainOff,
      {
        needsRetrain: true,
        now,
        hasTrainedBefore: false,
        smartSchedule: { kind: 'faq' },
      },
      ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS,
    );
    expect((patch as { $set: { status?: string; runAfter?: Date } }).$set).toMatchObject({
      status: 'queued',
      runAfter: now,
    });
  });

  describe('upsertFaqKnowledgeItemsForBot with forceInitialTraining', () => {
    const botId = new Types.ObjectId().toString();

    function makeService() {
      const createdRows: Record<string, unknown>[] = [];
      const itemModel = {
        find: jest.fn(() => ({
          select: jest.fn(() => ({
            lean: jest.fn(async () => []),
          })),
        })),
        create: jest.fn(async (doc: Record<string, unknown>) => {
          createdRows.push(doc);
          return { _id: new Types.ObjectId() };
        }),
        updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
        countDocuments: jest.fn(async () => 0),
      };
      const botModel = {
        findById: jest.fn(() => ({
          select: jest.fn(() => ({
            lean: jest.fn(async () => ({
              knowledgeTraining: { autoTrainEnabled: false, trainingDelayMinutes: 5 },
            })),
          })),
        })),
      };
      const knowledgeTrainingJobService = {
        scheduleTrainingForScopes: jest.fn(async () => undefined),
      };
      const botKbTotalLimit = {
        assertWithinLimit: jest.fn(async () => undefined),
      };
      const svc = Object.create(KnowledgeBaseItemService.prototype) as KnowledgeBaseItemService;
      Object.assign(svc, {
        itemModel,
        botModel,
        knowledgeTrainingJobService,
        botKbTotalLimit,
        softDeleteDuplicateFaqRowsByFaqIndex: jest.fn(async () => undefined),
        deactivateMissingFaqKnowledgeItemsForBot: jest.fn(async () => 0),
        refreshBotKnowledgeStats: jest.fn(async () => undefined),
        kickOosReconcile: jest.fn(async () => undefined),
      });
      return { svc, createdRows, knowledgeTrainingJobService };
    }

    it('creates queued FAQ row and schedules training with bypassAutoTrainGate when autoTrain is off', async () => {
      const { svc, createdRows, knowledgeTrainingJobService } = makeService();

      await svc.upsertFaqKnowledgeItemsForBot(
        botId,
        [{ title: 'Hours', questions: ['When open?'], answer: '9-5' }],
        ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS,
      );

      expect(createdRows[0]).toMatchObject({
        status: 'queued',
        runAfter: expect.any(Date),
        lastQueuedAt: expect.any(Date),
      });
      expect(createdRows[0]?.status).not.toBe('ready');
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).toHaveBeenCalledWith(
        botId,
        ['faq'],
        { bypassAutoTrainGate: true, immediateJob: true },
      );
    });

    it('creates pending FAQ row without scheduling when forceInitialTraining is absent', async () => {
      const { svc, createdRows, knowledgeTrainingJobService } = makeService();

      await svc.upsertFaqKnowledgeItemsForBot(botId, [
        { title: 'Hours', questions: ['When open?'], answer: '9-5' },
      ]);

      expect(createdRows[0]).toMatchObject({ status: 'pending' });
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalled();
    });
  });

  describe('normal KB flow regression (no forceInitialTraining)', () => {
    const botId = new Types.ObjectId().toString();

    function makeService(training: { autoTrainEnabled: boolean; trainingDelayMinutes: number }) {
      const createdRows: Record<string, unknown>[] = [];
      const itemModel = {
        find: jest.fn(() => ({
          select: jest.fn(() => ({
            lean: jest.fn(async () => []),
          })),
        })),
        create: jest.fn(async (doc: Record<string, unknown>) => {
          createdRows.push(doc);
          return { _id: new Types.ObjectId() };
        }),
        updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
        countDocuments: jest.fn(async () => 0),
      };
      const botModel = {
        findById: jest.fn(() => ({
          select: jest.fn(() => ({
            lean: jest.fn(async () => ({ knowledgeTraining: training })),
          })),
        })),
      };
      const knowledgeTrainingJobService = {
        scheduleTrainingForScopes: jest.fn(async () => undefined),
      };
      const botKbTotalLimit = {
        assertWithinLimit: jest.fn(async () => undefined),
      };
      const svc = Object.create(KnowledgeBaseItemService.prototype) as KnowledgeBaseItemService;
      Object.assign(svc, {
        itemModel,
        botModel,
        knowledgeTrainingJobService,
        botKbTotalLimit,
        softDeleteDuplicateFaqRowsByFaqIndex: jest.fn(async () => undefined),
        deactivateMissingFaqKnowledgeItemsForBot: jest.fn(async () => 0),
        deactivateMissingSnippetKnowledgeItemsForBot: jest.fn(async () => 0),
        softDeleteKnowledgeItemsMatching: jest.fn(async () => 0),
        refreshBotKnowledgeStats: jest.fn(async () => undefined),
        kickOosReconcile: jest.fn(async () => undefined),
      });
      return { svc, createdRows, knowledgeTrainingJobService };
    }

    it('normal snippet with autoTrain off remains pending', async () => {
      const { svc, createdRows, knowledgeTrainingJobService } = makeService({
        autoTrainEnabled: false,
        trainingDelayMinutes: 5,
      });

      await svc.upsertSnippetKnowledgeItemsForBot(botId, [
        { title: 'Tip', snippet: 'Helpful tip body text.', active: true },
      ]);

      expect(createdRows[0]).toMatchObject({ status: 'pending' });
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalled();
    });

    it('normal snippet with autoTrain on queues and schedules without bypassAutoTrainGate', async () => {
      const { svc, createdRows, knowledgeTrainingJobService } = makeService({
        autoTrainEnabled: true,
        trainingDelayMinutes: 42,
      });

      await svc.upsertSnippetKnowledgeItemsForBot(botId, [
        { title: 'Tip', snippet: 'Helpful tip body text.', active: true },
      ]);

      expect(createdRows[0]).toMatchObject({ status: 'queued' });
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).toHaveBeenCalledWith(botId, ['note']);
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalledWith(
        botId,
        ['note'],
        expect.objectContaining({ bypassAutoTrainGate: true }),
      );
    });

    it('normal table upsert with autoTrain off remains pending', async () => {
      const { svc, createdRows, knowledgeTrainingJobService } = makeService({
        autoTrainEnabled: false,
        trainingDelayMinutes: 5,
      });

      await svc.upsertTableKnowledgeItemsForBot(botId, [
        {
          title: 'Products',
          columns: ['SKU'],
          rows: [['1']],
          active: true,
        },
      ]);

      expect(createdRows[0]).toMatchObject({ status: 'pending' });
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalled();
    });

    it('onboarding Go Live still queues immediately with bypassAutoTrainGate', async () => {
      const { svc, createdRows, knowledgeTrainingJobService } = makeService({
        autoTrainEnabled: false,
        trainingDelayMinutes: 5,
      });

      await svc.upsertSnippetKnowledgeItemsForBot(
        botId,
        [{ title: 'Tip', snippet: 'Onboarding snippet.', active: true }],
        ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS,
      );

      expect(createdRows[0]).toMatchObject({ status: 'queued' });
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).toHaveBeenCalledWith(
        botId,
        ['note'],
        { bypassAutoTrainGate: true, immediateJob: true },
      );
    });
  });
});
