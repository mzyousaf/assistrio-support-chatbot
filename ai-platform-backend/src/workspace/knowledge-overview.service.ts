import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, ExtractJob, TrainJob } from '../models';
import { getKnowledgeTrainingSettings } from '../knowledge/bot-knowledge-training-settings.util';
import {
  computeTrainingTimeEstimateSeconds,
  trainingTimeEstimateLabel,
} from '../knowledge/knowledge-queue-estimate.util';
import {
  KnowledgeBaseItemService,
  type ApplyTrainNowInput,
  type KnowledgeTrainNowAffectedKbType,
} from '../knowledge/knowledge-base-item.service';
import { KnowledgeStatsService } from '../knowledge/knowledge-stats.service';
import { KnowledgeTrainingJobService } from '../knowledge/knowledge-training-job.service';
import {
  agentTrainingCanonicalDisplayLabel,
  legacyTrainingStatusFieldFromDisplayPhase,
  resolveCanonicalAgentTrainingDisplayPhase,
} from '../knowledge/agent-training-status-priority.util';
import type { AgentTrainingDataSourceRow } from '../knowledge/agent-training-data-source.types';
import { IngestionService } from '../ingestion/ingestion.service';
import { DocumentsService } from '../documents/documents.service';
import { kbTrainingLog } from '../knowledge/kb-training-log.util';
import type { BotKnowledgeStats, BotKnowledgeTypeStats, BotKnowledgeStatsByType } from '../models/bot-knowledge-stats.schema';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { KnowledgeUsageService } from '../knowledge/knowledge-usage.service';
import { knowledgeUsageBreakdownToApiPayload, type KnowledgeUsageApiPayload } from '../knowledge/knowledge-usage.util';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES,
  pipelineTouchCutoffFromStaleMinutes,
} from '../knowledge/agent-training-pipeline-staleness.util';
import {
  normalizeKnowledgeReplyPrioritySettings,
  type KnowledgeReplyPrioritySettings,
} from '../knowledge/knowledge-reply-priority.util';

export type TrainNowKnowledgePayloadType =
  | 'faq'
  | 'note'
  | 'table'
  | 'document'
  | 'suggestion'
  | 'all';

export function parseAndValidateTrainNow(
  body: unknown,
): { ok: true; value: ApplyTrainNowInput } | { ok: false; message: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Body must be an object' };
  }
  const o = body as Record<string, unknown>;
  const rawType = o.type;
  const allowed = new Set(['faq', 'note', 'table', 'document', 'suggestion', 'all']);
  if (typeof rawType !== 'string' || !allowed.has(rawType)) {
    return { ok: false, message: `type must be ${[...allowed].join('|')}` };
  }
  const type = rawType as TrainNowKnowledgePayloadType;
  let itemId: string | undefined;
  if ('itemId' in o && o.itemId !== undefined && o.itemId !== null) {
    if (typeof o.itemId !== 'string' || !o.itemId.trim()) {
      return { ok: false, message: 'itemId must be a non-empty string when provided' };
    }
    itemId = o.itemId.trim();
  }
  let forceRetrain = false;
  if ('forceRetrain' in o && o.forceRetrain !== undefined) {
    if (typeof o.forceRetrain !== 'boolean') {
      return { ok: false, message: 'forceRetrain must be a boolean when provided' };
    }
    forceRetrain = o.forceRetrain;
  }
  let includeFailed: boolean | undefined;
  if ('includeFailed' in o && o.includeFailed !== undefined) {
    if (typeof o.includeFailed !== 'boolean') {
      return { ok: false, message: 'includeFailed must be a boolean when provided' };
    }
    includeFailed = o.includeFailed;
  }
  const value: ApplyTrainNowInput = { type };
  if (itemId != null) value.itemId = itemId;
  if (forceRetrain) value.forceRetrain = true;
  if (includeFailed !== undefined) value.includeFailed = includeFailed;
  return { ok: true, value };
}

export function parseAndValidatePatchTraining(
  body: unknown,
  partial: boolean,
):
  | { ok: true; value: { autoTrainEnabled?: boolean; trainingDelayMinutes?: number } }
  | { ok: false; message: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Body must be an object' };
  }
  const o = body as Record<string, unknown>;
  let autoTrainEnabled: boolean | undefined;
  let trainingDelayMinutes: number | undefined;
  if ('autoTrainEnabled' in o) {
    if (typeof o.autoTrainEnabled !== 'boolean') {
      return { ok: false, message: 'autoTrainEnabled must be a boolean when provided' };
    }
    autoTrainEnabled = o.autoTrainEnabled;
  } else if (!partial) {
    return { ok: false, message: 'autoTrainEnabled is required' };
  }
  if ('trainingDelayMinutes' in o) {
    const n = Number(o.trainingDelayMinutes);
    if (!Number.isFinite(n) || n < 0 || n > 1440) {
      return { ok: false, message: 'trainingDelayMinutes must be a number from 0 to 1440' };
    }
    trainingDelayMinutes = Math.floor(n);
  } else if (!partial) {
    return { ok: false, message: 'trainingDelayMinutes is required' };
  }
  return { ok: true, value: { autoTrainEnabled, trainingDelayMinutes } };
}

export type PendingTrainingSectionType = 'document' | 'faq' | 'note' | 'table' | 'suggestion';

/** GET `/knowledge/training/pending-items` — action-needed + in-flight embedding rows, grouped for modal */
export type PendingTrainingItemDisplayStatus =
  | 'needs_training'
  | 'failed'
  | 'scheduled'
  | 'extraction_failed'
  | 'in_training'
  | 'training_queued';

export type PendingTrainingItemsResponse = {
  total: number;
  sections: Array<{
    type: PendingTrainingSectionType;
    label: string;
    count: number;
    items: Array<{
      id: string;
      title: string;
      displayStatus: PendingTrainingItemDisplayStatus;
      /** ISO `runAfter` when {@link PendingTrainingItemDisplayStatus} is `scheduled` (future) or `training_queued` (due / unset). */
      nextRunAfter?: string | null;
    }>;
  }>;
};

/** Sections touched by POST `/knowledge/training/retrain-agent` (“Retrain Agent” runs `all`). */
export const AGENT_RETRAIN_AFFECTED_KB_TYPES = [
  'document',
  'faq',
  'note',
  'table',
  'suggestion',
] as const;
export type AgentTrainingAffectedKbTypes = typeof AGENT_RETRAIN_AFFECTED_KB_TYPES;

/** Canonical headline phase for customer UI — matches {@link AgentTrainingCanonicalDisplayPhase} on backend util. */
export type AgentTrainingDisplayPhase =
  | 'empty'
  | 'ready'
  | 'training_required'
  | 'extracting'
  | 'importing'
  | 'training'
  | 'partially_ready'
  | 'failed';

/** Response for GET `/knowledge/training/status` — pipeline-active flags use staleness (see `AGENT_TRAINING_PIPELINE_STALE_MINUTES`). */
export type AgentTrainingStatusResponse = {
  status: 'trained' | 'training' | 'needs_training' | 'failed';
  /** Short headline label (localized English in API). Prefer {@link displayPhase} for styling. */
  label: string;
  /**
   * Single canonical phase for sidebar/overview — source of truth for headline priority.
   * @since Added for import/extraction vs training_required ordering.
   */
  displayPhase: AgentTrainingDisplayPhase;
  isTraining: boolean;
  /** True when any {@link dataSources} row has `trainingQueued` &gt; 0 (lifecycle `queued`, including scheduled). */
  training_queued: boolean;
  /** True while at least one document KB row is mid-extraction (`extractionStatus` not terminal). */
  isTextExtracting: boolean;
  /** Same signal as {@link isTextExtracting}; preferred for customer clients. */
  isExtracting: boolean;
  /** True while at least one datasheet/table row is mid-async import (`import_queued` / `importing`). */
  isImporting: boolean;
  isTrained: boolean;
  needsTraining: boolean;
  hasFailed: boolean;
  /**
   * `pending` = action-needed count (pending + failed + queued with future runAfter + extraction failed where applicable).
   * `queued` = due queued only (runAfter missing/null or <= now), excluding future-scheduled rows.
   */
  counts: {
    pending: number;
    queued: number;
    processing: number;
    ready: number;
    failed: number;
    total: number;
  };
  characters: {
    pending: number;
    queued: number;
    processing: number;
    ready: number;
    failed: number;
    total: number;
  };
  lastQueuedAt: string | null;
  lastTrainingStartedAt: string | null;
  lastTrainedAt: string | null;
  nextRunAfter: string | null;
  estimatedTrainingSeconds: number;
  estimatedLabel: string;
  /**
   * Per data-source training counts (overview “Data sources” / tags).
   * Order: documents, qna, snippets, datasheets, suggestions.
   */
  dataSources: AgentTrainingDataSourceRow[];
  /** UTF-8 byte usage vs storage quota (matches GET `/knowledge/overview`). */
  knowledgeUsage: KnowledgeUsageApiPayload;
  /** Item counts: extraction phases vs training phases (`KnowledgeBaseItem.extractionStatus` vs `.status`). */
  lifecycleCounts: {
    extractingCount: number;
    extractionFailedCount: number;
    datasheetImportPipelineCount: number;
    trainingQueuedCount: number;
    trainingProcessingCount: number;
    trainingFailedCount: number;
    readyCount: number;
  };
};

/** POST `/knowledge/training/retrain-agent` adds `affectedTypes` for frontend section refetches. */
export type AgentTrainingRetrainAgentResponse = AgentTrainingStatusResponse & {
  /** KB sections whose rows were updated by Retrain Agent (queued / bumped). Empty if nothing matched. */
  affectedTypes: KnowledgeTrainNowAffectedKbType[];
};

export function parseAndValidateRetrainAgent(
  body: unknown,
): { ok: true; value: { includeFailed: boolean; forceRetrain: boolean } } | { ok: false; message: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Body must be an object' };
  }
  const o = body as Record<string, unknown>;
  let includeFailed = true;
  let forceRetrain = false;
  if ('includeFailed' in o && o.includeFailed !== undefined) {
    if (typeof o.includeFailed !== 'boolean') {
      return { ok: false, message: 'includeFailed must be a boolean when provided' };
    }
    includeFailed = o.includeFailed;
  }
  if ('forceRetrain' in o && o.forceRetrain !== undefined) {
    if (typeof o.forceRetrain !== 'boolean') {
      return { ok: false, message: 'forceRetrain must be a boolean when provided' };
    }
    forceRetrain = o.forceRetrain;
  }
  return { ok: true, value: { includeFailed, forceRetrain } };
}

type ByTypeView = {
  snippets: { items: number; characters: number; rows?: number };
  qna: { items: number; characters: number; rows?: number };
  documents: { items: number; characters: number; rows?: number };
  datasheets: { items: number; characters: number; rows?: number };
  suggestions: { items: number; characters: number; rows?: number };
};

export type KnowledgeOverviewResponse = {
  botId: string;
  knowledgeTraining: { autoTrainEnabled: boolean; trainingDelayMinutes: number; scheduleMode: 'smart' | 'fixed' };
  knowledgeReplyPriority: KnowledgeReplyPrioritySettings;
  knowledgeStats: {
    totalCharacters: number;
    totalItems: number;
    readyCharacters: number;
    pendingCharacters: number;
    queuedCharacters: number;
    processingCharacters: number;
    failedCharacters: number;
    uiOnlyCharacters: number;
    readyItems: number;
    pendingItems: number;
    queuedItems: number;
    processingItems: number;
    failedItems: number;
    uiOnlyItems: number;
    byType: ByTypeView;
    lastUpdatedAt?: string;
    lastQueuedAt?: string;
    lastTrainingStartedAt?: string;
    lastTrainedAt?: string;
  };
  queue: {
    queuedItems: number;
    queuedCharacters: number;
    processingItems: number;
    processingCharacters: number;
    nextRunAfter?: string;
    lastQueuedAt?: string;
    estimatedTrainingSeconds: number;
    estimatedLabel: string;
  };
  pending: { items: number; characters: number };
  failed: { items: number; characters: number };
  /** Active trainable KB UTF-8 byte usage vs bot storage quota (see {@link KnowledgeUsageService}). */
  knowledgeUsage: KnowledgeUsageApiPayload;
};

function mapByTypeToView(by: BotKnowledgeStatsByType | undefined): ByTypeView {
  const b = by ?? ({} as BotKnowledgeStatsByType);
  const m = (x: BotKnowledgeTypeStats | undefined) => ({
    items: x?.items ?? 0,
    characters: x?.characters ?? 0,
    ...(x && 'rows' in x && (x as { rows?: number }).rows != null
      ? { rows: (x as { rows: number }).rows }
      : { rows: 0 }),
  });
  return {
    snippets: m(b.snippets),
    qna: m(b.qna),
    documents: m(b.documents),
    datasheets: m(b.datasheets),
    suggestions: m(b.suggestions),
  };
}

function iso(d: Date | undefined | null): string | undefined {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const PENDING_SECTION_ORDER: ReadonlyArray<{ type: PendingTrainingSectionType; label: string }> = [
  { type: 'document', label: 'Documents' },
  { type: 'faq', label: 'Q&A' },
  { type: 'note', label: 'Snippets' },
  { type: 'table', label: 'Datasheets' },
  { type: 'suggestion', label: 'Suggestions' },
];

/**
 * Aligns KB `sourceType` with modal sections (matches stats: url/html/url-like → documents bucket).
 * Exported for tests.
 */
export function mapKbSourceTypeToPendingSection(sourceType: string): PendingTrainingSectionType | null {
  switch (sourceType) {
    case 'faq':
      return 'faq';
    case 'note':
      return 'note';
    case 'table':
      return 'table';
    case 'suggestion':
      return 'suggestion';
    case 'document':
    case 'url':
    case 'html':
      return 'document';
    default:
      return null;
  }
}

function emptyStatsView(): KnowledgeOverviewResponse['knowledgeStats'] {
  return {
    totalCharacters: 0,
    totalItems: 0,
    readyCharacters: 0,
    pendingCharacters: 0,
    queuedCharacters: 0,
    processingCharacters: 0,
    failedCharacters: 0,
    uiOnlyCharacters: 0,
    readyItems: 0,
    pendingItems: 0,
    queuedItems: 0,
    processingItems: 0,
    failedItems: 0,
    uiOnlyItems: 0,
    byType: mapByTypeToView(undefined),
  };
}

/** From {@link KnowledgeBaseItemService.aggregateCustomerTrainingLifecycleMetrics}; optional to avoid duplicate aggregation. */
export type CustomerTrainingLifecycleMetrics = Awaited<
  ReturnType<KnowledgeBaseItemService['aggregateCustomerTrainingLifecycleMetrics']>
>;

@Injectable()
export class KnowledgeOverviewService {
  constructor(
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    private readonly knowledgeTrainingJobService: KnowledgeTrainingJobService,
    private readonly ingestionService: IngestionService,
    private readonly documentsService: DocumentsService,
    private readonly knowledgeUsageService: KnowledgeUsageService,
    private readonly configService: ConfigService,
  ) {}

  private liveBotFilter(botId: string) {
    return { $and: [{ _id: new Types.ObjectId(botId) }, botNotDeletedClause()] };
  }

  private botNotFoundEx(): HttpException {
    return new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
  }

  private async assertWorkspaceBotLive(botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const b = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!b) throw this.botNotFoundEx();
  }

  /** @param lifecyclePrecomputed When provided (e.g. from `getAgentTrainingStatus`), skips a second lifecycle aggregation. */
  async getOverviewForBot(
    botId: string,
    lifecyclePrecomputed?: CustomerTrainingLifecycleMetrics,
  ): Promise<KnowledgeOverviewResponse> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel
      .findOne(this.liveBotFilter(botId))
      .select('knowledgeStats knowledgeTraining botConfig knowledgeReplyPriority')
      .lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }

    let stats: BotKnowledgeStats | undefined = (bot as { knowledgeStats?: BotKnowledgeStats }).knowledgeStats;
    if (!stats) {
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      const again = await this.botModel.findOne(this.liveBotFilter(botId)).select('knowledgeStats').lean();
      stats = (again as { knowledgeStats?: BotKnowledgeStats } | null)?.knowledgeStats;
    }

    /** Embedded stats persisted before character-only metrics — recompute once so overview APIs stay consistent. */
    const legacyKs = stats as Record<string, unknown> | undefined;
    if (
      stats &&
      legacyKs &&
      ('totalWords' in legacyKs || 'readyWords' in legacyKs || 'queuedWords' in legacyKs)
    ) {
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      const againLegacy = await this.botModel.findOne(this.liveBotFilter(botId)).select('knowledgeStats').lean();
      stats = (againLegacy as { knowledgeStats?: BotKnowledgeStats } | null)?.knowledgeStats;
    }

    const kt = (bot as { knowledgeTraining?: { autoTrainEnabled?: boolean; trainingDelayMinutes?: number } })
      .knowledgeTraining;
    const settings = getKnowledgeTrainingSettings({ knowledgeTraining: kt } as Bot);

    const lifecycle =
      lifecyclePrecomputed ??
      (await this.knowledgeBaseItemService.aggregateCustomerTrainingLifecycleMetrics(botId));

    const [pending, failed, qOnly, qProc, rowsQueuedProcessing, nextRun, lastJobQueuedAt, docQueued] =
      await Promise.all([
        this.knowledgeBaseItemService.sumActiveMetricsByStatuses(botId, ['pending']),
        this.knowledgeBaseItemService.sumActiveMetricsByStatuses(botId, ['failed']),
        this.knowledgeBaseItemService.sumActiveMetricsByStatuses(botId, ['queued']),
        this.knowledgeBaseItemService.sumActiveMetricsByStatuses(botId, ['queued', 'processing']),
        this.knowledgeBaseItemService.sumDatasheetRowsForTableStatuses(botId, ['queued', 'processing']),
        this.earliestNextRunAfter(botId),
        this.maxJobQueuedAt(botId),
        this.knowledgeBaseItemService.countActiveItems(botId, 'document', ['queued', 'processing']),
      ]);

    const st = stats as BotKnowledgeStats | undefined;
    const now = new Date();
    const nextRunTime = nextRun;
    const waitSec =
      nextRunTime instanceof Date && !isNaN(nextRunTime.getTime())
        ? Math.max(0, Math.floor((nextRunTime.getTime() - now.getTime()) / 1000))
        : 0;

    let workChars =
      lifecycle.trainingPipelineCharacters > 0
        ? lifecycle.trainingPipelineCharacters
        : (st?.queuedCharacters ?? 0) + (st?.processingCharacters ?? 0);
    if (workChars <= 0) {
      workChars = qProc.characters > 0 ? qProc.characters : 0;
    }
    const estSeconds = computeTrainingTimeEstimateSeconds({
      workloadCharacters: workChars,
      datasheetRowCount: rowsQueuedProcessing,
      documentItemCount: docQueued,
      waitUntilStartSeconds: waitSec,
    });

    const statsView = st
      ? {
          totalCharacters: st.totalCharacters ?? 0,
          totalItems: st.totalItems ?? 0,
          readyCharacters: st.readyCharacters ?? 0,
          pendingCharacters: st.pendingCharacters ?? 0,
          queuedCharacters: st.queuedCharacters ?? 0,
          processingCharacters: st.processingCharacters ?? 0,
          failedCharacters: st.failedCharacters ?? 0,
          uiOnlyCharacters: 0,
          readyItems: st.readyItems ?? 0,
          pendingItems: st.pendingItems ?? 0,
          queuedItems: st.queuedItems ?? 0,
          processingItems: st.processingItems ?? 0,
          failedItems: st.failedItems ?? 0,
          uiOnlyItems: 0,
          byType: mapByTypeToView(st.byType),
          lastUpdatedAt: iso(st.lastUpdatedAt),
          lastQueuedAt: iso(st.lastQueuedAt),
          lastTrainingStartedAt: iso(st.lastTrainingStartedAt),
          lastTrainedAt: iso(st.lastTrainedAt),
        }
      : emptyStatsView();

    const usageBreakdown = await this.knowledgeUsageService.getActiveBotKnowledgeUsage(botId, bot);
    const knowledgeUsage = knowledgeUsageBreakdownToApiPayload(usageBreakdown);

    return {
      botId,
      knowledgeTraining: {
        autoTrainEnabled: settings.autoTrainEnabled,
        trainingDelayMinutes: settings.trainingDelayMinutes,
        scheduleMode: settings.scheduleMode,
      },
      knowledgeReplyPriority: normalizeKnowledgeReplyPrioritySettings(
        (bot as { knowledgeReplyPriority?: unknown }).knowledgeReplyPriority,
      ),
      knowledgeStats: statsView,
      queue: {
        queuedItems: st?.queuedItems ?? 0,
        queuedCharacters: qOnly.characters,
        processingItems: st?.processingItems ?? 0,
        processingCharacters: st?.processingCharacters ?? 0,
        nextRunAfter: nextRunTime ? nextRunTime.toISOString() : undefined,
        lastQueuedAt: iso(lastJobQueuedAt) ?? statsView.lastQueuedAt,
        estimatedTrainingSeconds: estSeconds,
        estimatedLabel: trainingTimeEstimateLabel(estSeconds),
      },
      pending: { items: pending.items, characters: pending.characters },
      failed: { items: failed.items, characters: failed.characters },
      knowledgeUsage,
    };
  }

  async patchTrainingSettings(botId: string, body: unknown): Promise<KnowledgeOverviewResponse> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }
    const parsed = parseAndValidatePatchTraining(body, true);
    if (!parsed.ok) {
      throw new HttpException({ error: parsed.message }, HttpStatus.BAD_REQUEST);
    }
    const { autoTrainEnabled, trainingDelayMinutes } = parsed.value;
    if (autoTrainEnabled === undefined && trainingDelayMinutes === undefined) {
      throw new HttpException(
        { error: 'Provide at least one of autoTrainEnabled, trainingDelayMinutes' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const $set: Record<string, unknown> = {};
    if (autoTrainEnabled !== undefined) {
      $set['knowledgeTraining.autoTrainEnabled'] = autoTrainEnabled;
    }
    if (trainingDelayMinutes !== undefined) {
      $set['knowledgeTraining.trainingDelayMinutes'] = trainingDelayMinutes;
    }
    const up = await this.botModel.updateOne(this.liveBotFilter(botId), { $set });
    if (up.matchedCount === 0) {
      throw this.botNotFoundEx();
    }
    return this.getOverviewForBot(botId);
  }

  async queuePendingItems(botId: string): Promise<KnowledgeOverviewResponse> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }
    const { scopes, documentIds } = await this.knowledgeBaseItemService.markTrainableItemsQueuedFromLifecycle(
      botId,
      'pending',
    );
    if (scopes.length > 0) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, scopes, {
        bypassAutoTrainGate: true,
      });
    }
    await this.ingestionService.ensureQueuedIngestJobsForDocumentIds(botId, documentIds);
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return this.getOverviewForBot(botId);
  }

  async retryFailedItems(botId: string): Promise<KnowledgeOverviewResponse> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }
    const { scopes, documentIds } = await this.knowledgeBaseItemService.markTrainableItemsQueuedFromLifecycle(
      botId,
      'failed',
    );
    if (scopes.length > 0) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, scopes, {
        bypassAutoTrainGate: true,
      });
    }
    await this.ingestionService.ensureQueuedIngestJobsForDocumentIds(botId, documentIds);
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return this.getOverviewForBot(botId);
  }

  /**
   * Manual train (overview "Train now", sections, optional single-item).
   * Defaults `includeFailed` true (retry failures); section UIs pass `false` for pending-only.
   */
  /** Aggregated UX status for sidebar + polls (cheap mapping over overview stats). */
  async getPendingTrainingItems(botId: string): Promise<PendingTrainingItemsResponse> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }
    const rows = await this.knowledgeBaseItemService.listPendingTrainingItemSummaries(botId);
    const byType = new Map<PendingTrainingSectionType, typeof rows>();
    for (const r of rows) {
      const t = mapKbSourceTypeToPendingSection(r.sourceType);
      if (!t) continue;
      const list = byType.get(t) ?? [];
      list.push(r);
      byType.set(t, list);
    }
    const sections: PendingTrainingItemsResponse['sections'] = [];
    for (const sec of PENDING_SECTION_ORDER) {
      const list = byType.get(sec.type);
      if (!list || list.length === 0) continue;
      const sorted = [...list].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
      sections.push({
        type: sec.type,
        label: sec.label,
        count: sorted.length,
        items: sorted.map((i) => ({
          id: i.id,
          title: i.title,
          displayStatus: i.displayStatus,
          ...(i.nextRunAfter != null && `${i.nextRunAfter}`.trim()
            ? { nextRunAfter: `${i.nextRunAfter}`.trim() }
            : {}),
        })),
      });
    }
    const totalFromSections = sections.reduce((sum, sec) => sum + sec.count, 0);
    if (totalFromSections !== rows.length) {
      console.warn('[knowledge-overview] pending-items partition mismatch', {
        rowCount: rows.length,
        sectionSum: totalFromSections,
        botId,
      });
    }
    return { total: totalFromSections, sections };
  }

  async getAgentTrainingStatus(botId: string): Promise<AgentTrainingStatusResponse> {
    await this.assertWorkspaceBotLive(botId);
    const now = new Date();
    const staleMinutesRaw = this.configService.get<number>('agentTrainingPipelineStaleMinutes');
    const staleMinutes =
      typeof staleMinutesRaw === 'number' && Number.isFinite(staleMinutesRaw)
        ? staleMinutesRaw
        : DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES;
    const pipelineOpts = {
      pipelineTouchCutoff: pipelineTouchCutoffFromStaleMinutes(now, staleMinutes),
    };
    const bundle = await this.knowledgeBaseItemService.aggregateAgentTrainingLifecycleBundle(botId, now, pipelineOpts);
    const lm = bundle.lm;
    const dataSources = bundle.dataSources;
    const lifecycleCounts = bundle.lifecycleCounts;
    const overview = await this.getOverviewForBot(botId, lm);
    const ks = overview.knowledgeStats;
    const q = overview.queue;

    const trainingPipeline = lm.trainingPipelineItems;
    const actionable = lm.actionableItems;
    const fail = lm.failedItems;

    const displayPhase = resolveCanonicalAgentTrainingDisplayPhase({
      totalTrackedItems: lm.totalTrackedItems,
      readyItems: lm.readyItems,
      failedItems: fail,
      actionableItems: actionable,
      trainingPipelineItems: trainingPipeline,
      extractingCount: lifecycleCounts.extractingCount,
      datasheetImportPipelineCount: lifecycleCounts.datasheetImportPipelineCount,
      trainingQueuedCount: lifecycleCounts.trainingQueuedCount,
      trainingProcessingCount: lifecycleCounts.trainingProcessingCount,
    });

    const label = agentTrainingCanonicalDisplayLabel(displayPhase);
    const status = legacyTrainingStatusFieldFromDisplayPhase(displayPhase);

    const isTextExtracting = lifecycleCounts.extractingCount > 0;
    const isImporting = lifecycleCounts.datasheetImportPipelineCount > 0;
    const isTraining = displayPhase === 'training';
    const training_queued = dataSources.some((d) => d.trainingQueued > 0);

    return {
      status,
      label,
      displayPhase,
      isTraining,
      training_queued,
      isTextExtracting,
      isExtracting: isTextExtracting,
      isImporting,
      isTrained: displayPhase === 'ready' || displayPhase === 'partially_ready',
      needsTraining: displayPhase === 'training_required',
      hasFailed: fail > 0,
      counts: {
        pending: actionable,
        queued: lm.dueQueuedItems,
        processing: lm.processingItems,
        ready: lm.readyItems,
        failed: fail,
        total: lm.totalTrackedItems,
      },
      characters: {
        pending: lm.actionableCharacters,
        queued: lm.dueQueuedCharacters,
        processing: lm.processingCharacters,
        ready: lm.readyCharacters,
        failed: lm.failedCharacters,
        total: lm.totalCharacters,
      },
      lastQueuedAt: q.lastQueuedAt ?? ks.lastQueuedAt ?? null,
      lastTrainingStartedAt: ks.lastTrainingStartedAt ?? null,
      lastTrainedAt: ks.lastTrainedAt ?? null,
      nextRunAfter: q.nextRunAfter ?? null,
      estimatedTrainingSeconds: q.estimatedTrainingSeconds ?? 0,
      estimatedLabel: q.estimatedLabel ?? '',
      dataSources,
      knowledgeUsage: overview.knowledgeUsage,
      lifecycleCounts,
    };
  }

  async retrainAgent(botId: string, body: unknown): Promise<AgentTrainingRetrainAgentResponse> {
    await this.assertWorkspaceBotLive(botId);
    const parsed = parseAndValidateRetrainAgent(body);
    if (!parsed.ok) {
      throw new HttpException({ error: parsed.message }, HttpStatus.BAD_REQUEST);
    }
    const trainParsed = parseAndValidateTrainNow({
      type: 'all',
      includeFailed: parsed.value.includeFailed,
      forceRetrain: parsed.value.forceRetrain,
    });
    if (!trainParsed.ok) {
      throw new HttpException({ error: trainParsed.message }, HttpStatus.BAD_REQUEST);
    }
    const { affectedKbSectionTypes } = await this.runApplyTrainNowSideEffects(botId, trainParsed.value);
    const status = await this.getAgentTrainingStatus(botId);
    return {
      ...status,
      affectedTypes: affectedKbSectionTypes,
    };
  }

  /**
   * Queue work from {@link KnowledgeBaseItemService.applyTrainNow}: embedding jobs + document ingest bumps.
   * Returns KB section kinds that had at least one row updated so UIs can refetch `GET …/knowledge/status`.
   */
  private async runApplyTrainNowSideEffects(
    botId: string,
    input: ApplyTrainNowInput,
  ): Promise<{ affectedKbSectionTypes: KnowledgeTrainNowAffectedKbType[] }> {
    const { scopesForJob, documentIdsForIngest, affectedKbSectionTypes } =
      await this.knowledgeBaseItemService.applyTrainNow(botId, input);
    kbTrainingLog('retrain sideFx', {
      botId,
      scopesForJob: scopesForJob.join('|'),
      affectedTypes: affectedKbSectionTypes.join('|'),
      docJobCount: documentIdsForIngest.length,
    });
    if (scopesForJob.length > 0) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, scopesForJob, {
        bypassAutoTrainGate: true,
      });
    }
    if (documentIdsForIngest.length > 0) {
      await this.ingestionService.ensureQueuedIngestJobsForDocumentIds(botId, documentIdsForIngest);
    }
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return { affectedKbSectionTypes };
  }

  async trainKnowledgeNow(botId: string, body: unknown): Promise<KnowledgeOverviewResponse> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }
    const parsed = parseAndValidateTrainNow(body);
    if (!parsed.ok) {
      throw new HttpException({ error: parsed.message }, HttpStatus.BAD_REQUEST);
    }

    await this.runApplyTrainNowSideEffects(botId, parsed.value);
    return this.getOverviewForBot(botId);
  }

  async listKnowledgeItemStatus(
    botId: string,
    type?: string,
    itemId?: string,
  ): Promise<{
    items: Awaited<ReturnType<KnowledgeBaseItemService['listLightweightTrainingStatuses']>>;
  }> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findOne(this.liveBotFilter(botId)).select('_id').lean();
    if (!bot) {
      throw this.botNotFoundEx();
    }
    const allowed = new Set(['faq', 'note', 'table', 'document', 'suggestion', 'all']);
    if (type !== undefined && type !== '') {
      if (!allowed.has(type)) {
        throw new HttpException({ error: 'Invalid type query parameter' }, HttpStatus.BAD_REQUEST);
      }
    }
    const t = type !== undefined && type !== '' ? (type as ApplyTrainNowInput['type']) : undefined;
    const trimmedItem = typeof itemId === 'string' ? itemId.trim() : '';
    if (trimmedItem && (!t || t === 'all')) {
      throw new HttpException(
        { error: 'itemId requires a specific type query (faq, note, table, document, or suggestion)' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const itemsRaw = await this.knowledgeBaseItemService.listLightweightTrainingStatuses(
      botId,
      t === 'all' ? undefined : t,
      trimmedItem || undefined,
    );
    const items = await this.documentsService.enrichLightweightKbDocumentStatuses(
      botId,
      itemsRaw as unknown as Array<Record<string, unknown>>,
    );
    return { items: items as Awaited<ReturnType<KnowledgeBaseItemService['listLightweightTrainingStatuses']>> };
  }

  private async earliestNextRunAfter(botId: string): Promise<Date | undefined> {
    if (!Types.ObjectId.isValid(botId)) return undefined;
    const botOid = new Types.ObjectId(botId);
    const [a, b] = await Promise.all([
      this.trainJobModel.find({ botId: botOid, status: 'queued' }).select('runAfter').lean(),
      this.extractJobModel.find({ botId: botOid, status: 'queued' }).select('runAfter').lean(),
    ]);
    const rows = [...a, ...b] as { runAfter?: Date }[];
    if (rows.length === 0) return undefined;
    let minT = Infinity;
    for (const r of rows) {
      if (r.runAfter instanceof Date && !isNaN(r.runAfter.getTime())) {
        minT = Math.min(minT, r.runAfter.getTime());
      } else {
        minT = Math.min(minT, Date.now());
      }
    }
    if (minT === Infinity) return undefined;
    return new Date(minT);
  }

  private async maxJobQueuedAt(botId: string): Promise<Date | undefined> {
    if (!Types.ObjectId.isValid(botId)) return undefined;
    const botOid = new Types.ObjectId(botId);
    const [a, b] = await Promise.all([
      this.trainJobModel.find({ botId: botOid, status: 'queued' }).select('queuedAt').lean(),
      this.extractJobModel.find({ botId: botOid, status: 'queued' }).select('queuedAt').lean(),
    ]);
    const dates: Date[] = [];
    for (const x of [...a, ...b] as { queuedAt?: Date }[]) {
      if (x.queuedAt instanceof Date && !isNaN(x.queuedAt.getTime())) {
        dates.push(x.queuedAt);
      }
    }
    if (dates.length === 0) return undefined;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }
}
