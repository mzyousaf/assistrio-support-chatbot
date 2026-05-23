import { Types } from 'mongoose';
import { ONBOARDING_KB_TRANSFER_JOB_TYPE } from '../models/onboarding-kb-transfer-job.schema';
import { WorkspaceOnboardingKbTransferJobService } from './workspace-onboarding-kb-transfer-job.service';

describe('WorkspaceOnboardingKbTransferJobService', () => {
  const workspaceId = new Types.ObjectId();
  const botId = new Types.ObjectId();
  const draftId = new Types.ObjectId();
  const jobId = new Types.ObjectId();

  function completeOnboardingResponse() {
    return {
      workspaceId: String(workspaceId),
      onboardingDraftId: String(draftId),
      draft: {
        profile: {
          name: 'Ada',
          shortDescription: '',
          description: '',
          categories: [],
          avatarSource: '',
          imageUrl: '',
          avatarEmoji: '',
          avatarStorageKey: '',
          brandColor: '',
        },
        instructions: {
          description: 'Help users with product questions and support.',
          systemPrompt: 'Help users',
          tone: 'friendly',
          behaviorPreset: 'default',
          responseLength: 'medium' as const,
          maxTokens: 160,
        },
        knowledge: {
          snippets: [{ id: 's1', title: 'Overview', description: 'Overview', createdAt: null, updatedAt: null }],
          qas: [],
          knowledgeDescription: '',
          faqs: [],
        },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
        createdAt: null,
        updatedAt: null,
      },
    };
  }

  function buildService(overrides?: {
    jobs?: Array<Record<string, unknown>>;
    createImpl?: jest.Mock;
  }) {
    const jobs = [...(overrides?.jobs ?? [])];

    const jobModel = {
      findOne: jest.fn((filter: Record<string, unknown>) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            const ws = (filter as { workspaceId?: Types.ObjectId }).workspaceId;
            const status = (filter as { status?: unknown }).status;
            const match = jobs.find((job) => {
              if (ws && String(job.workspaceId) !== String(ws)) return false;
              if (status && typeof status === 'object' && '$in' in (status as object)) {
                const allowed = (status as { $in: string[] }).$in;
                return allowed.includes(String(job.status));
              }
              if (typeof status === 'string' && job.status !== status) return false;
              return true;
            });
            return match ?? null;
          }),
        })),
      })),
      findOneAndUpdate: jest.fn(
        (filter: Record<string, unknown>, update: Record<string, unknown>, opts?: { new?: boolean }) => {
          const executeUpdate = async () => {
            const idx = jobs.findIndex((job) => {
              if (filter._id && String(job._id) !== String(filter._id)) return false;
              if (filter.workspaceId && String(job.workspaceId) !== String(filter.workspaceId)) return false;
              if (filter.botId && String(job.botId) !== String(filter.botId)) return false;
              if (filter.status && job.status !== filter.status) return false;
              return true;
            });
            if (idx < 0) return null;
            const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
            jobs[idx] = { ...jobs[idx], ...set };
            return opts?.new ? jobs[idx] : jobs[idx];
          };
          const chain = {
            lean: jest.fn(() => executeUpdate()),
            then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
              executeUpdate().then(onFulfilled, onRejected),
          };
          return chain;
        },
      ),
      create:
        overrides?.createImpl ??
        jest.fn(async (doc: Record<string, unknown>) => {
          const row = { _id: jobId, ...doc };
          jobs.push(row);
          return row;
        }),
      updateOne: jest.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const idx = jobs.findIndex((job) => String(job._id) === String(filter._id));
        if (idx < 0) return { modifiedCount: 0 };
        const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
        const inc = (update as { $inc?: Record<string, number> }).$inc ?? {};
        jobs[idx] = {
          ...jobs[idx],
          ...set,
          retryCount: Number(jobs[idx].retryCount ?? 0) + Number(inc.retryCount ?? 0),
        };
        return { modifiedCount: 1 };
      }),
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          limit: jest.fn(() => ({
            select: jest.fn(() => ({
              lean: jest.fn(async () => jobs.filter((j) => j.status === 'failed')),
            })),
          })),
        })),
        select: jest.fn(() => ({
          lean: jest.fn(async () => jobs.filter((j) => j.status === 'processing')),
        })),
      })),
    };

    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn(async () => completeOnboardingResponse()),
    };

    const workspaceOnboardingKnowledgeTransferService = {
      transferDraftKnowledgeForBot: jest.fn(async () => undefined),
    };

    const service = new WorkspaceOnboardingKbTransferJobService(
      jobModel as never,
      workspaceOnboardingService as never,
      workspaceOnboardingKnowledgeTransferService as never,
    );

    return {
      service,
      jobModel,
      jobs,
      workspaceOnboardingKnowledgeTransferService,
    };
  }

  it('creates a queued onboarding KB transfer job', async () => {
    const { service, jobs } = buildService();

    const result = await service.ensureQueuedTransferJob({
      workspaceId: String(workspaceId),
      botId: String(botId),
      onboardingDraftId: String(draftId),
    });

    expect(result.created).toBe(true);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
      status: 'queued',
      workspaceId,
      botId,
      onboardingDraftId: draftId,
    });
  });

  it('does not create duplicate job when one is already queued', async () => {
    const existingJobId = new Types.ObjectId();
    const { service, jobModel, jobs } = buildService({
      jobs: [
        {
          _id: existingJobId,
          type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
          workspaceId,
          botId,
          onboardingDraftId: draftId,
          status: 'queued',
        },
      ],
    });

    const result = await service.ensureQueuedTransferJob({
      workspaceId: String(workspaceId),
      botId: String(botId),
      onboardingDraftId: String(draftId),
    });

    expect(result).toEqual({ jobId: String(existingJobId), created: false });
    expect(jobModel.create).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(1);
  });

  it('requeues failed job on go-live retry without creating duplicate', async () => {
    const failedJobId = new Types.ObjectId();
    const { service, jobs } = buildService({
      jobs: [
        {
          _id: failedJobId,
          type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
          workspaceId,
          botId,
          onboardingDraftId: draftId,
          status: 'failed',
          error: 'S3 copy failed',
        },
      ],
    });

    const result = await service.ensureQueuedTransferJob({
      workspaceId: String(workspaceId),
      botId: String(botId),
      onboardingDraftId: String(draftId),
    });

    expect(result).toEqual({ jobId: String(failedJobId), created: false });
    expect(jobs[0].status).toBe('queued');
    expect(jobs[0].error).toBeUndefined();
  });

  it('claims queued job and runs transferDraftKnowledgeForBot', async () => {
    const queuedJobId = new Types.ObjectId();
    const { service, workspaceOnboardingKnowledgeTransferService } = buildService({
      jobs: [
        {
          _id: queuedJobId,
          type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
          workspaceId,
          botId,
          onboardingDraftId: draftId,
          status: 'queued',
          queuedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const claimed = await service.claimQueuedTransferJob();
    expect(claimed).not.toBeNull();
    expect(claimed?.status).toBe('processing');

    await service.processTransferJob(claimed!);

    expect(workspaceOnboardingKnowledgeTransferService.transferDraftKnowledgeForBot).toHaveBeenCalledWith(
      String(botId),
      expect.objectContaining({
        knowledge: expect.objectContaining({
          snippets: expect.arrayContaining([expect.objectContaining({ title: 'Overview' })]),
        }),
      }),
      String(draftId),
    );
  });

  it('marks job failed with retry count', async () => {
    const queuedJobId = new Types.ObjectId();
    const { service, jobs } = buildService({
      jobs: [
        {
          _id: queuedJobId,
          type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
          workspaceId,
          botId,
          onboardingDraftId: draftId,
          status: 'processing',
          retryCount: 1,
        },
      ],
    });

    const job = {
      _id: queuedJobId,
      workspaceId,
      botId,
      onboardingDraftId: draftId,
      status: 'processing' as const,
      type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
      retryCount: 1,
      stuckRecoveryCycles: 0,
    };

    await service.markJobFailed(job as never, 'transfer failed');

    expect(jobs[0]).toMatchObject({
      status: 'failed',
      error: 'transfer failed',
      retryCount: 2,
    });
  });
});
