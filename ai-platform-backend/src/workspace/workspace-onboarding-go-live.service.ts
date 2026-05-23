import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { botIsEffectivelyDeleted, botNotDeletedClause } from '../bots/bot-not-deleted.util';
import type { AllowedOrigin } from '../bots/origin-validation.util';
import { coerceAllowedOriginsFromBotDoc } from '../bots/origin-validation.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { Bot, Workspace, WorkspaceOnboardingDraft } from '../models';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceOnboardingService } from '../workspaces/workspace-onboarding.service';
import { WorkspaceOnboardingKnowledgeStagingService } from '../workspaces/workspace-onboarding-knowledge-staging.service';
import type {
  WorkspaceOnboardingDraftSnapshot,
  WorkspaceOnboardingGoLiveRequest,
  WorkspaceOnboardingGoLiveResponse,
} from '../workspaces/workspace-onboarding.types';
import {
  mergeAllowedOriginInput,
  validateOnboardingDraftForGoLive,
} from '../workspaces/workspace-onboarding-go-live.validation';
import { assertOnboardingAllowedOriginsLimit } from '../workspaces/workspace-onboarding-allowed-origins.util';
import { WorkspaceOnboardingKbTransferJobService } from './workspace-onboarding-kb-transfer-job.service';
import { normalizeOnboardingKnowledge } from '../workspaces/workspace-onboarding-knowledge-normalize.util';
import { legacyOnboardingDraftBotArchiveFilter } from './legacy-onboarding-draft-bot.util';

type WorkspaceDoc = {
  _id: Types.ObjectId;
  onboardingStatus?: string;
  onboardingCurrentStep?: string;
  onboardingDraftId?: Types.ObjectId;
  onboardingCreatedBotId?: Types.ObjectId;
};

const GO_LIVE_KNOWLEDGE_PROCESSING_MESSAGE =
  'Your agent is live. Knowledge is being prepared.';

type GoLiveTimings = Record<string, number>;

@Injectable()
export class WorkspaceOnboardingGoLiveService {
  private readonly log = new Logger(WorkspaceOnboardingGoLiveService.name);

  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceOnboardingDraft.name)
    private readonly draftModel: Model<WorkspaceOnboardingDraft>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly workspaceOnboardingService: WorkspaceOnboardingService,
    private readonly workspaceOnboardingKnowledgeStagingService: WorkspaceOnboardingKnowledgeStagingService,
    private readonly workspaceOnboardingKbTransferJobService: WorkspaceOnboardingKbTransferJobService,
    private readonly botsService: BotsService,
    private readonly workspaceBotLimitService: WorkspaceBotLimitService,
  ) {}

  async goLive(
    workspaceId: string,
    createdByUserId: string,
    body: WorkspaceOnboardingGoLiveRequest,
  ): Promise<WorkspaceOnboardingGoLiveResponse> {
    const totalStart = Date.now();
    const timings: GoLiveTimings = {};

    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const workspace = (await this.workspaceModel.findById(wsOid).lean()) as WorkspaceDoc | null;
    if (!workspace) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const existingBotId = workspace.onboardingCreatedBotId ? String(workspace.onboardingCreatedBotId) : null;
    if (existingBotId && Types.ObjectId.isValid(existingBotId)) {
      const existingBot = await this.loadInstallBot(existingBotId);
      if (existingBot) {
        const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
        const draftId = onboarding.onboardingDraftId;
        let readKbStatusStart = Date.now();
        const knowledgeProcessingPending = await this.hasKnowledgeToTransfer(
          onboarding.draft,
          draftId ?? '',
        );
        timings.readKbStatus = Date.now() - readKbStatusStart;

        if (knowledgeProcessingPending && draftId) {
          let enqueueStart = Date.now();
          await this.ensureOnboardingKbTransferJob(workspaceId, existingBotId, draftId);
          timings.enqueueKnowledgeTransfer = Date.now() - enqueueStart;
        }
        await this.ensureWorkspaceLivePendingInstall(workspaceId, workspace.onboardingDraftId);

        let buildStart = Date.now();
        const response = this.buildResponse(workspaceId, existingBot, {
          knowledgeProcessingPending,
        });
        timings.buildResponse = Date.now() - buildStart;
        this.logGoLiveTimings(workspaceId, totalStart, timings);
        return response;
      }
    }

    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftSnapshot = onboarding.draft;
    const draftId = onboarding.onboardingDraftId;

    let allowedOrigins = draftSnapshot.goLive.allowedOrigins.map((row) => ({
      origin: row.origin,
      ...(row.label ? { label: row.label } : {}),
      isActive: row.isActive !== false,
    })) as AllowedOrigin[];

    if (body.origin) {
      let saveOriginStart = Date.now();
      allowedOrigins = mergeAllowedOriginInput(allowedOrigins, body.origin, body.label);
      assertOnboardingAllowedOriginsLimit(allowedOrigins);
      await this.workspaceOnboardingService.patchGoLive(workspaceId, { allowedOrigins });
      draftSnapshot.goLive.allowedOrigins = allowedOrigins.map((row) => ({
        origin: row.origin,
        label: row.label,
        isActive: row.isActive !== false,
      }));
      timings.saveAllowedOrigin = Date.now() - saveOriginStart;
    }

    let readKbStatusStart = Date.now();
    const stagedCounts = draftId
      ? await this.workspaceOnboardingKnowledgeStagingService.countPendingStagedKnowledge(draftId)
      : { documentCount: 0, datasheetCount: 0 };
    timings.readKbStatus = Date.now() - readKbStatusStart;

    let validateStart = Date.now();
    validateOnboardingDraftForGoLive(
      {
        ...draftSnapshot,
        goLive: {
          allowedOrigins: allowedOrigins.map((row) => ({
            origin: row.origin,
            label: row.label,
            isActive: row.isActive !== false,
          })),
        },
      },
      {
        hasStagedDocuments: stagedCounts.documentCount > 0,
        hasStagedDatasheets: stagedCounts.datasheetCount > 0,
      },
    );
    timings.validateOnboarding = Date.now() - validateStart;

    let publishStart = Date.now();
    await this.archiveLegacyOnboardingDraftBots(workspaceId, existingBotId);
    await this.workspaceBotLimitService.assertCanAddBotToWorkspace(workspaceId);

    const created = await this.botsService.createPublishedBotFromWorkspaceOnboarding({
      workspaceId,
      createdByUserId,
      profile: draftSnapshot.profile,
      instructions: draftSnapshot.instructions,
      allowedOrigins,
    });

    const botIdForTransfer = await this.attachOnboardingCreatedBot(workspaceId, created.botId);
    const createdInstallBot = this.toInstallBot(created);
    timings.publishBot = Date.now() - publishStart;

    const knowledgeProcessingPending = await this.hasKnowledgeToTransfer(draftSnapshot, draftId ?? '');
    if (knowledgeProcessingPending && draftId) {
      let enqueueStart = Date.now();
      await this.ensureOnboardingKbTransferJob(workspaceId, botIdForTransfer, draftId);
      timings.enqueueKnowledgeTransfer = Date.now() - enqueueStart;
    }

    await this.markGoLiveStepCompleted(
      workspace.onboardingDraftId != null
        ? String(workspace.onboardingDraftId)
        : onboarding.onboardingDraftId,
    );

    const finalBot =
      botIdForTransfer === created.botId
        ? createdInstallBot
        : (await this.loadInstallBot(botIdForTransfer));
    if (!finalBot) {
      throw new NotFoundException({ error: 'Published onboarding bot not found after go live.' });
    }

    let buildStart = Date.now();
    const response = this.buildResponse(workspaceId, finalBot, {
      knowledgeProcessingPending,
    });
    timings.buildResponse = Date.now() - buildStart;
    this.logGoLiveTimings(workspaceId, totalStart, timings);
    return response;
  }

  private logGoLiveTimings(workspaceId: string, totalStart: number, timings: GoLiveTimings): void {
    const totalMs = Date.now() - totalStart;
    const slowest = Object.entries(timings).sort((a, b) => b[1] - a[1])[0];
    this.log.log(
      `Go-live timing workspaceId=${workspaceId} totalMs=${totalMs} steps=${JSON.stringify(timings)}` +
        (slowest ? ` slowest=${slowest[0]}(${slowest[1]}ms)` : ''),
    );
  }

  private async hasKnowledgeToTransfer(
    draft: WorkspaceOnboardingDraftSnapshot,
    draftId: string,
  ): Promise<boolean> {
    const normalized = normalizeOnboardingKnowledge(
      draft.knowledge as unknown as Parameters<typeof normalizeOnboardingKnowledge>[0],
    );
    if (normalized.snippets.length > 0 || normalized.qas.length > 0) {
      return true;
    }
    if (!draftId) {
      return false;
    }
    const staged = await this.workspaceOnboardingKnowledgeStagingService.countPendingStagedKnowledge(draftId);
    return staged.documentCount > 0 || staged.datasheetCount > 0;
  }

  private async ensureOnboardingKbTransferJob(
    workspaceId: string,
    botId: string,
    onboardingDraftId: string,
  ): Promise<void> {
    await this.workspaceOnboardingKbTransferJobService.ensureQueuedTransferJob({
      workspaceId,
      botId,
      onboardingDraftId,
    });
  }

  private toInstallBot(created: {
    botId: string;
    slug: string;
    name: string;
    status: 'published';
    accessKey: string;
    secretKey: string;
    visibility: 'public' | 'private';
    allowedOrigins: AllowedOrigin[];
  }): {
    botId: string;
    slug: string;
    name: string;
    status: 'published';
    accessKey: string;
    secretKey: string;
    visibility: 'public' | 'private';
    allowedOrigins: AllowedOrigin[];
  } {
    return {
      botId: created.botId,
      slug: created.slug,
      name: created.name,
      status: created.status,
      accessKey: created.accessKey,
      secretKey: created.secretKey,
      visibility: created.visibility,
      allowedOrigins: created.allowedOrigins,
    };
  }

  private async attachOnboardingCreatedBot(workspaceId: string, botId: string): Promise<string> {
    const wsOid = new Types.ObjectId(workspaceId);
    const attached = await this.workspaceModel
      .findOneAndUpdate(
        {
          _id: wsOid,
          $or: [{ onboardingCreatedBotId: { $exists: false } }, { onboardingCreatedBotId: null }],
        },
        {
          $set: {
            onboardingCreatedBotId: new Types.ObjectId(botId),
            onboardingStatus: 'live_pending_install',
            onboardingCurrentStep: 'you-are-live',
          },
        },
        { new: true },
      )
      .lean();

    if (attached) {
      return botId;
    }

    await this.botModel.deleteOne({ _id: new Types.ObjectId(botId) });
    const latest = (await this.workspaceModel.findById(wsOid).lean()) as WorkspaceDoc | null;
    const winnerBotId = latest?.onboardingCreatedBotId ? String(latest.onboardingCreatedBotId) : null;
    if (!winnerBotId) {
      throw new NotFoundException({ error: 'Workspace onboarding bot could not be attached.' });
    }
    return winnerBotId;
  }

  private async archiveLegacyOnboardingDraftBots(
    workspaceId: string,
    preserveBotId?: string | null,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;
    const filter = legacyOnboardingDraftBotArchiveFilter(workspaceId, { excludeBotId: preserveBotId });
    const drafts = await this.botModel.find(filter).select('_id clientDraftId status').lean();
    if (drafts.length === 0) return;
    for (const row of drafts) {
      const botId = String((row as { _id: Types.ObjectId })._id);
      await this.botsService.remove(botId);
    }
    this.log.log(
      `Archived ${drafts.length} legacy onboarding draft bot(s) (clientDraftId) for workspace ${workspaceId} before go-live`,
    );
  }

  private async markGoLiveStepCompleted(draftId: string | null | undefined): Promise<void> {
    if (!draftId || !Types.ObjectId.isValid(String(draftId))) return;
    await this.draftModel.findByIdAndUpdate(new Types.ObjectId(String(draftId)), {
      $addToSet: { stepsCompleted: 'go-live' },
    });
  }

  private async ensureWorkspaceLivePendingInstall(
    workspaceId: string,
    draftId: Types.ObjectId | string | null | undefined,
  ): Promise<void> {
    const ws = (await this.workspaceModel.findById(new Types.ObjectId(workspaceId)).lean()) as WorkspaceDoc | null;
    if (ws?.onboardingStatus === 'completed') {
      return;
    }
    await this.workspaceModel.findByIdAndUpdate(new Types.ObjectId(workspaceId), {
      $set: {
        onboardingStatus: 'live_pending_install',
        onboardingCurrentStep: 'you-are-live',
      },
    });
    await this.markGoLiveStepCompleted(draftId != null ? String(draftId) : null);
  }

  private async loadInstallBot(botId: string): Promise<{
    botId: string;
    slug: string;
    name: string;
    status: 'published';
    accessKey: string;
    secretKey: string;
    visibility: 'public' | 'private';
    allowedOrigins: AllowedOrigin[];
  } | null> {
    const bot = await this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(botId) }, botNotDeletedClause()] })
      .select('_id name slug status accessKey secretKey visibility allowedOrigins')
      .lean();
    if (!bot || botIsEffectivelyDeleted(bot as { active?: boolean; deletedAt?: Date | null })) {
      return null;
    }
    const row = bot as Record<string, unknown>;
    return {
      botId: String(row._id),
      slug: String(row.slug ?? ''),
      name: String(row.name ?? ''),
      status: 'published',
      accessKey: String(row.accessKey ?? ''),
      secretKey: String(row.secretKey ?? ''),
      visibility: row.visibility === 'private' ? 'private' : 'public',
      allowedOrigins: coerceAllowedOriginsFromBotDoc(row.allowedOrigins),
    };
  }

  private buildResponse(
    workspaceId: string,
    bot: {
      botId: string;
      slug: string;
      name: string;
      status: 'published';
      accessKey: string;
      secretKey: string;
      visibility: 'public' | 'private';
      allowedOrigins: AllowedOrigin[];
    },
    opts?: { knowledgeProcessingPending?: boolean },
  ): WorkspaceOnboardingGoLiveResponse {
    const knowledgeProcessingPending = opts?.knowledgeProcessingPending === true;
    return {
      workspaceId,
      onboardingStatus: 'live_pending_install',
      onboardingCurrentStep: 'you-are-live',
      bot: {
        id: bot.botId,
        name: bot.name,
        slug: bot.slug,
        status: bot.status,
        accessKey: bot.accessKey,
        ...(bot.visibility === 'private' && bot.secretKey ? { secretKey: bot.secretKey } : {}),
        visibility: bot.visibility,
        allowedOrigins: bot.allowedOrigins.map((row) => ({
          origin: row.origin,
          label: row.label,
          isActive: row.isActive !== false,
        })),
      },
      ...(knowledgeProcessingPending
        ? {
            knowledgeProcessingPending: true,
            knowledgeProcessingMessage: GO_LIVE_KNOWLEDGE_PROCESSING_MESSAGE,
          }
        : {}),
    };
  }
}
