import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { uploadPublic } from '../lib/s3';
import {
  DEFAULT_WORKSPACE_ONBOARDING_STATUS,
  DEFAULT_WORKSPACE_ONBOARDING_STEP,
  nextOnboardingFlowStep,
  type WorkspaceOnboardingStatus,
  type WorkspaceOnboardingStep,
} from '../models/workspace-onboarding.constants';
import {
  Workspace,
  WorkspaceOnboardingDraft,
  type WorkspaceOnboardingDraftAllowedOrigin,
  type WorkspaceOnboardingDraftGoLive,
  type WorkspaceOnboardingDraftInstructions,
  type WorkspaceOnboardingDraftKnowledge,
  type WorkspaceOnboardingDraftProfile,
} from '../models';
import type {
  WorkspaceOnboardingDraftGoLiveDto,
  WorkspaceOnboardingDraftInstructionsDto,
  WorkspaceOnboardingDraftKnowledgeDto,
  WorkspaceOnboardingDraftProfileDto,
  WorkspaceOnboardingDraftSnapshot,
  WorkspaceOnboardingProgressPatch,
  WorkspaceOnboardingResponse,
  WorkspaceOnboardingSummary,
} from './workspace-onboarding.types';
import { WORKSPACE_ONBOARDING_COMPLETE_ERROR_CODES } from './workspace-onboarding.types';
import { MIN_AGENT_INSTRUCTIONS_LENGTH } from './workspace-onboarding.validation';
import { normalizeOnboardingKnowledge } from './workspace-onboarding-knowledge-normalize.util';
import { sortOnboardingKbItemsLatestFirst } from './workspace-onboarding-knowledge-sort.util';
import {
  dedupeOnboardingAllowedOrigins,
  assertOnboardingAllowedOriginsLimit,
} from './workspace-onboarding-allowed-origins.util';

type WorkspaceDoc = {
  _id: Types.ObjectId;
  onboardingStatus?: WorkspaceOnboardingStatus;
  onboardingCurrentStep?: WorkspaceOnboardingStep;
  onboardingDraftId?: Types.ObjectId;
  onboardingCreatedBotId?: Types.ObjectId;
  onboardingCompletedAt?: Date;
};

type DraftDoc = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  profile?: WorkspaceOnboardingDraftProfile;
  instructions?: WorkspaceOnboardingDraftInstructions;
  knowledge?: WorkspaceOnboardingDraftKnowledge;
  goLive?: WorkspaceOnboardingDraftGoLive;
  stepsCompleted?: WorkspaceOnboardingStep[];
  createdAt?: Date;
  updatedAt?: Date;
};

function oidString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return Types.ObjectId.isValid(s) ? s : null;
}

function isoDate(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function normalizeWorkspaceOnboardingSummary(doc: WorkspaceDoc | null | undefined): WorkspaceOnboardingSummary {
  return {
    onboardingStatus: doc?.onboardingStatus ?? DEFAULT_WORKSPACE_ONBOARDING_STATUS,
    onboardingCurrentStep: doc?.onboardingCurrentStep ?? DEFAULT_WORKSPACE_ONBOARDING_STEP,
    onboardingCreatedBotId: oidString(doc?.onboardingCreatedBotId),
  };
}

function normalizeProfile(profile: WorkspaceOnboardingDraftProfile | undefined): WorkspaceOnboardingDraftSnapshot['profile'] {
  const brandRaw = String(profile?.brandColor ?? '').trim();
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(brandRaw) ? brandRaw.toUpperCase() : brandRaw ? brandRaw : '';
  return {
    name: String(profile?.name ?? '').trim(),
    shortDescription: String(profile?.shortDescription ?? '').trim(),
    description: String(profile?.description ?? '').trim(),
    brandColor,
    categories: Array.isArray(profile?.categories)
      ? profile.categories.map((c) => String(c ?? '').trim()).filter(Boolean)
      : [],
    avatarSource: String(profile?.avatarSource ?? '').trim(),
    imageUrl: String(profile?.imageUrl ?? '').trim(),
    avatarEmoji: String(profile?.avatarEmoji ?? '').trim(),
    avatarStorageKey: String(profile?.avatarStorageKey ?? '').trim(),
  };
}

function normalizeInstructions(
  instructions: WorkspaceOnboardingDraftInstructions | undefined,
): WorkspaceOnboardingDraftSnapshot['instructions'] {
  return {
    description: String(instructions?.description ?? '').trim(),
    systemPrompt: String(instructions?.systemPrompt ?? instructions?.description ?? '').trim(),
    tone: String(instructions?.tone ?? 'friendly').trim() || 'friendly',
    behaviorPreset: String(instructions?.behaviorPreset ?? 'default').trim() || 'default',
    responseLength:
      instructions?.responseLength === 'short' ||
      instructions?.responseLength === 'long' ||
      instructions?.responseLength === 'medium'
        ? instructions.responseLength
        : 'medium',
    maxTokens:
      typeof instructions?.maxTokens === 'number' && Number.isFinite(instructions.maxTokens) && instructions.maxTokens > 0
        ? Math.floor(instructions.maxTokens)
        : 160,
  };
}

function normalizeKnowledge(
  knowledge: WorkspaceOnboardingDraftKnowledge | undefined,
): WorkspaceOnboardingDraftSnapshot['knowledge'] {
  const normalized = normalizeOnboardingKnowledge(knowledge);
  return {
    snippets: sortOnboardingKbItemsLatestFirst(normalized.snippets),
    qas: sortOnboardingKbItemsLatestFirst(normalized.qas),
    knowledgeDescription: normalized.knowledgeDescription,
    faqs: normalized.faqs,
  };
}

function normalizeAllowedOrigins(
  origins: WorkspaceOnboardingDraftAllowedOrigin[] | undefined,
): WorkspaceOnboardingDraftSnapshot['goLive']['allowedOrigins'] {
  if (!Array.isArray(origins)) return [];
  const mapped = origins
    .map((row) => ({
      origin: String(row?.origin ?? '').trim(),
      label: String(row?.label ?? '').trim() || undefined,
      isActive: row?.isActive !== false,
    }))
    .filter((row) => row.origin);
  const deduped = dedupeOnboardingAllowedOrigins(mapped);
  assertOnboardingAllowedOriginsLimit(deduped);
  return deduped;
}

function serializeDraft(doc: DraftDoc): WorkspaceOnboardingDraftSnapshot {
  return {
    profile: normalizeProfile(doc.profile),
    instructions: normalizeInstructions(doc.instructions),
    knowledge: normalizeKnowledge(doc.knowledge),
    goLive: { allowedOrigins: normalizeAllowedOrigins(doc.goLive?.allowedOrigins) },
    stepsCompleted: Array.isArray(doc.stepsCompleted)
      ? doc.stepsCompleted.filter((step): step is WorkspaceOnboardingStep => typeof step === 'string')
      : [],
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}

function buildOnboardingResponse(workspace: WorkspaceDoc, draft: DraftDoc): WorkspaceOnboardingResponse {
  return {
    workspaceId: String(workspace._id),
    onboardingStatus: workspace.onboardingStatus ?? DEFAULT_WORKSPACE_ONBOARDING_STATUS,
    onboardingCurrentStep: workspace.onboardingCurrentStep ?? DEFAULT_WORKSPACE_ONBOARDING_STEP,
    onboardingDraftId: oidString(workspace.onboardingDraftId),
    onboardingCreatedBotId: oidString(workspace.onboardingCreatedBotId),
    onboardingCompletedAt: isoDate(workspace.onboardingCompletedAt),
    draft: serializeDraft(draft),
  };
}

@Injectable()
export class WorkspaceOnboardingService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceOnboardingDraft.name)
    private readonly draftModel: Model<WorkspaceOnboardingDraft>,
  ) {}

  async getWorkspaceOnboardingSummary(workspaceId: string): Promise<WorkspaceOnboardingSummary | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const doc = await this.workspaceModel
      .findById(new Types.ObjectId(workspaceId))
      .select('onboardingStatus onboardingCurrentStep onboardingCreatedBotId')
      .lean();
    if (!doc) return null;
    return normalizeWorkspaceOnboardingSummary(doc as WorkspaceDoc);
  }

  async getOnboardingForWorkspace(workspaceId: string): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    return buildOnboardingResponse(workspace, draft);
  }

  async getDraftForWorkspace(workspaceId: string): Promise<WorkspaceOnboardingResponse | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const workspace = await this.workspaceModel.findById(new Types.ObjectId(workspaceId)).lean();
    if (!workspace) return null;
    const ws = workspace as WorkspaceDoc;
    if (!ws.onboardingDraftId) {
      return buildOnboardingResponse(ws, {
        _id: new Types.ObjectId(),
        workspaceId: new Types.ObjectId(workspaceId),
      });
    }
    const draft = await this.draftModel.findById(ws.onboardingDraftId).lean();
    if (!draft) {
      return buildOnboardingResponse(ws, {
        _id: ws.onboardingDraftId,
        workspaceId: new Types.ObjectId(workspaceId),
      });
    }
    return buildOnboardingResponse(ws, draft as DraftDoc);
  }

  async getOrCreateDraftForWorkspace(workspaceId: string): Promise<{ workspace: WorkspaceDoc; draft: DraftDoc }> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }
    const wsOid = new Types.ObjectId(workspaceId);
    const workspace = await this.workspaceModel.findById(wsOid).lean();
    if (!workspace) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }
    const ws = workspace as WorkspaceDoc;

    if (ws.onboardingDraftId) {
      const existing = await this.draftModel.findById(ws.onboardingDraftId).lean();
      if (existing) {
        return { workspace: ws, draft: existing as DraftDoc };
      }
    }

    const createdDraft = await this.draftModel.create({
      workspaceId: wsOid,
      profile: {},
      instructions: {},
      knowledge: { faqs: [] },
      goLive: { allowedOrigins: [] },
      stepsCompleted: [],
    });

    const attached = await this.workspaceModel
      .findOneAndUpdate(
        {
          _id: wsOid,
          $or: [{ onboardingDraftId: { $exists: false } }, { onboardingDraftId: null }],
        },
        {
          $set: {
            onboardingDraftId: createdDraft._id,
            onboardingStatus: 'in_progress',
            onboardingCurrentStep: ws.onboardingCurrentStep ?? DEFAULT_WORKSPACE_ONBOARDING_STEP,
          },
        },
        { new: true },
      )
      .lean();

    if (attached) {
      return { workspace: attached as WorkspaceDoc, draft: createdDraft.toObject() as DraftDoc };
    }

    const latestWorkspace = (await this.workspaceModel.findById(wsOid).lean()) as WorkspaceDoc | null;
    if (!latestWorkspace?.onboardingDraftId) {
      throw new NotFoundException({ error: 'Workspace onboarding draft could not be attached.' });
    }

    await this.draftModel.deleteOne({ _id: createdDraft._id });

    const winnerDraft = await this.draftModel.findById(latestWorkspace.onboardingDraftId).lean();
    if (!winnerDraft) {
      throw new NotFoundException({ error: 'Workspace onboarding draft not found.' });
    }

    return { workspace: latestWorkspace, draft: winnerDraft as DraftDoc };
  }

  async patchProfile(workspaceId: string, payload: WorkspaceOnboardingDraftProfileDto): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const $set: Record<string, unknown> = {};
    if (payload.name !== undefined) $set['profile.name'] = payload.name;
    if (payload.description !== undefined) $set['profile.description'] = payload.description ?? '';
    if (payload.shortDescription !== undefined) $set['profile.shortDescription'] = payload.shortDescription ?? '';
    if (payload.brandColor !== undefined) $set['profile.brandColor'] = payload.brandColor ?? '';
    if (payload.categories !== undefined) $set['profile.categories'] = payload.categories ?? [];
    if (payload.avatarSource !== undefined) $set['profile.avatarSource'] = payload.avatarSource ?? '';
    if (payload.imageUrl !== undefined) $set['profile.imageUrl'] = payload.imageUrl ?? '';
    if (payload.avatarEmoji !== undefined) $set['profile.avatarEmoji'] = payload.avatarEmoji ?? '';
    if (payload.avatarStorageKey !== undefined) $set['profile.avatarStorageKey'] = payload.avatarStorageKey ?? '';

    if (Object.keys($set).length === 0) {
      throw new BadRequestException({ error: 'At least one profile field is required.' });
    }

    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        { $set },
        { new: true },
      )
      .lean();
    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, workspace.onboardingCurrentStep);
    return buildOnboardingResponse(workspaceAfter, (updatedDraft ?? draft) as DraftDoc);
  }

  async patchInstructions(
    workspaceId: string,
    payload: WorkspaceOnboardingDraftInstructionsDto,
  ): Promise<WorkspaceOnboardingResponse> {
    const description = String(payload.description ?? '').trim();
    if (description.length < MIN_AGENT_INSTRUCTIONS_LENGTH) {
      throw new BadRequestException({
        error: 'Describe your AI Agent in at least 80 characters.',
      });
    }

    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const normalized = normalizeInstructions({
      description: payload.description,
      systemPrompt: payload.systemPrompt ?? payload.description,
      tone: payload.tone,
      behaviorPreset: payload.behaviorPreset,
      responseLength: payload.responseLength as WorkspaceOnboardingDraftInstructions['responseLength'],
      maxTokens: payload.maxTokens,
    });

    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        {
          $set: {
            'instructions.description': normalized.description,
            'instructions.systemPrompt': normalized.systemPrompt,
            'instructions.tone': normalized.tone,
            'instructions.behaviorPreset': normalized.behaviorPreset,
            'instructions.responseLength': normalized.responseLength,
            'instructions.maxTokens': normalized.maxTokens,
          },
        },
        { new: true },
      )
      .lean();
    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, workspace.onboardingCurrentStep);
    return buildOnboardingResponse(workspaceAfter, (updatedDraft ?? draft) as DraftDoc);
  }

  async patchKnowledge(
    workspaceId: string,
    payload: WorkspaceOnboardingDraftKnowledgeDto,
  ): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const faqs = Array.isArray(payload.faqs)
      ? payload.faqs
          .map((row) => ({
            question: String(row?.question ?? '').trim(),
            answer: String(row?.answer ?? '').trim(),
          }))
          .filter((row) => row.question || row.answer)
      : undefined;
    const $set: Record<string, unknown> = {};
    if (payload.knowledgeDescription !== undefined) {
      $set['knowledge.knowledgeDescription'] = payload.knowledgeDescription ?? '';
    }
    if (faqs !== undefined) {
      $set['knowledge.faqs'] = faqs;
    }
    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        { $set },
        { new: true },
      )
      .lean();
    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, workspace.onboardingCurrentStep);
    return buildOnboardingResponse(workspaceAfter, (updatedDraft ?? draft) as DraftDoc);
  }

  async patchGoLive(
    workspaceId: string,
    payload: WorkspaceOnboardingDraftGoLiveDto,
  ): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const allowedOrigins = normalizeAllowedOrigins(
      payload.allowedOrigins as WorkspaceOnboardingDraftAllowedOrigin[] | undefined,
    );
    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        { $set: { 'goLive.allowedOrigins': allowedOrigins } },
        { new: true },
      )
      .lean();
    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, workspace.onboardingCurrentStep);
    return buildOnboardingResponse(workspaceAfter, (updatedDraft ?? draft) as DraftDoc);
  }

  async markStepCompleted(workspaceId: string, stepId: WorkspaceOnboardingStep): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        { $addToSet: { stepsCompleted: stepId } },
        { new: true },
      )
      .lean();
    const nextStep = nextOnboardingFlowStep(stepId);
    const currentStep = nextStep ?? stepId;
    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, currentStep);
    return buildOnboardingResponse(workspaceAfter, (updatedDraft ?? draft) as DraftDoc);
  }

  async updateCurrentStep(workspaceId: string, stepId: WorkspaceOnboardingStep): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, stepId);
    return buildOnboardingResponse(workspaceAfter ?? workspace, draft);
  }

  async patchProgress(workspaceId: string, patch: WorkspaceOnboardingProgressPatch): Promise<WorkspaceOnboardingResponse> {
    let response: WorkspaceOnboardingResponse | null = null;
    if (patch.completedStep) {
      response = await this.markStepCompleted(workspaceId, patch.completedStep);
    }
    if (patch.currentStep) {
      response = await this.updateCurrentStep(workspaceId, patch.currentStep);
    }
    return response ?? this.getOnboardingForWorkspace(workspaceId);
  }

  async completeOnboarding(workspaceId: string): Promise<WorkspaceOnboardingResponse> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const workspace = (await this.workspaceModel.findById(wsOid).lean()) as WorkspaceDoc | null;
    if (!workspace) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    if (workspace.onboardingStatus === 'completed') {
      return this.getOnboardingForWorkspace(workspaceId);
    }

    const createdBotId = oidString(workspace.onboardingCreatedBotId);
    const isLiveEligible =
      workspace.onboardingStatus === 'live_pending_install' || createdBotId != null;

    if (!createdBotId || !isLiveEligible) {
      throw new BadRequestException({
        error: 'Complete onboarding after your agent is live.',
        message: 'Complete onboarding after your agent is live.',
        errorCode: WORKSPACE_ONBOARDING_COMPLETE_ERROR_CODES.notLive,
      });
    }

    const { draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const completedAt = new Date();

    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        { $addToSet: { stepsCompleted: 'you-are-live' } },
        { new: true },
      )
      .lean();

    const updatedWorkspace = (await this.workspaceModel
      .findByIdAndUpdate(
        wsOid,
        {
          $set: {
            onboardingStatus: 'completed',
            onboardingCurrentStep: 'you-are-live',
            onboardingCompletedAt: completedAt,
          },
        },
        { new: true },
      )
      .lean()) as WorkspaceDoc | null;

    if (!updatedWorkspace) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    return buildOnboardingResponse(updatedWorkspace, (updatedDraft ?? draft) as DraftDoc);
  }

  async uploadAvatar(
    workspaceId: string,
    file: { buffer: Buffer; originalName: string; mime: string },
  ): Promise<WorkspaceOnboardingResponse> {
    const { workspace, draft } = await this.getOrCreateDraftForWorkspace(workspaceId);
    const draftId = String(draft._id);

    let uploaded: { url: string; key: string };
    try {
      uploaded = await uploadPublic({
        prefix: `uploads/onboarding-drafts/${draftId}/avatar`,
        originalName: file.originalName,
        contentType: file.mime,
        body: file.buffer,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[workspace-onboarding] avatar upload failed', { workspaceId, draftId, msg });
      throw new ServiceUnavailableException({
        error: 'Avatar storage is not available. Try again later.',
      });
    }

    const updatedDraft = await this.draftModel
      .findByIdAndUpdate(
        draft._id,
        {
          $set: {
            'profile.avatarSource': 'upload',
            'profile.imageUrl': uploaded.url,
            'profile.avatarStorageKey': uploaded.key,
            'profile.avatarEmoji': '',
          },
        },
        { new: true },
      )
      .lean();

    const workspaceAfter = await this.markWorkspaceInProgress(workspaceId, workspace.onboardingCurrentStep);
    return buildOnboardingResponse(workspaceAfter, (updatedDraft ?? draft) as DraftDoc);
  }

  private async markWorkspaceInProgress(
    workspaceId: string,
    currentStep?: WorkspaceOnboardingStep,
  ): Promise<WorkspaceDoc> {
    const wsOid = new Types.ObjectId(workspaceId);
    const updated = await this.workspaceModel
      .findByIdAndUpdate(
        wsOid,
        {
          $set: {
            onboardingStatus: 'in_progress',
            ...(currentStep ? { onboardingCurrentStep: currentStep } : {}),
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }
    return updated as WorkspaceDoc;
  }
}
