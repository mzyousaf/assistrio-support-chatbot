import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS } from '../knowledge/knowledge-bot-upsert.options';
import { WorkspaceOnboardingKnowledgeStaging } from '../models/workspace-onboarding-knowledge-staging.schema';
import type { WorkspaceOnboardingDraftSnapshot } from '../workspaces/workspace-onboarding.types';
import { normalizeOnboardingKnowledge } from '../workspaces/workspace-onboarding-knowledge-normalize.util';

type StagingRow = {
  _id: Types.ObjectId;
  sourceType: 'document' | 'datasheet';
  originalName: string;
  mimeType?: string;
  sizeBytes: number;
  storageKey: string;
  s3Bucket?: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdKnowledgeItemId?: Types.ObjectId;
};

const ONBOARDING_DOCUMENT_INGEST_TIMES = (at: Date) => ({
  lastQueuedAt: at,
  runAfter: at,
});

const RETRYABLE_STAGING_STATUSES = ['uploaded', 'failed', 'transfer_pending'] as const;

@Injectable()
export class WorkspaceOnboardingKnowledgeTransferService {
  private readonly logger = new Logger(WorkspaceOnboardingKnowledgeTransferService.name);

  constructor(
    @InjectModel(WorkspaceOnboardingKnowledgeStaging.name)
    private readonly stagingModel: Model<WorkspaceOnboardingKnowledgeStaging>,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
  ) {}

  /** Inline snippets/Q&A plus staged documents/datasheets for onboarding go-live. Idempotent upserts. */
  async transferDraftKnowledgeForBot(
    botId: string,
    draft: WorkspaceOnboardingDraftSnapshot,
    draftId: string,
  ): Promise<void> {
    const normalized = normalizeOnboardingKnowledge(
      draft.knowledge as unknown as Parameters<typeof normalizeOnboardingKnowledge>[0],
    );

    if (normalized.snippets.length > 0) {
      await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(
        botId,
        normalized.snippets.map((s) => ({
          title: s.title,
          snippet: s.description,
          active: true,
        })),
        ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS,
      );
    }

    if (normalized.qas.length > 0) {
      await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(
        botId,
        normalized.qas.map((q) => ({
          title: q.title,
          questions: q.questions,
          answer: q.answer,
          active: true,
        })),
        ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS,
      );
    }

    if (draftId) {
      await this.transferStagedKnowledgeForBot(botId, draftId);
    }
  }

  async transferStagedKnowledgeForBot(botId: string, draftId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(draftId)) return;

    const rows = (await this.stagingModel
      .find({
        onboardingDraftId: new Types.ObjectId(draftId),
        status: { $in: [...RETRYABLE_STAGING_STATUSES] },
      })
      .sort({ createdAt: 1 })
      .lean()) as StagingRow[];

    for (const row of rows) {
      if (row.sourceType === 'document') {
        await this.transferDocument(botId, row);
      } else if (row.sourceType === 'datasheet') {
        await this.transferDatasheet(botId, row);
      }
    }
  }

  private async transferDocument(botId: string, row: StagingRow): Promise<void> {
    if (row.status === 'transferred') return;

    if (row.status === 'transfer_pending' && row.createdKnowledgeItemId) {
      await this.resumeDocumentTransfer(botId, row);
      return;
    }

    if (row.status === 'failed' && row.createdKnowledgeItemId) {
      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { status: 'transfer_pending', errorMessage: '' } },
      );
      await this.resumeDocumentTransfer(botId, { ...row, status: 'transfer_pending' });
      return;
    }

    const claimed = await this.stagingModel.updateOne(
      { _id: row._id, status: { $in: ['uploaded', 'failed'] } },
      { $set: { status: 'transfer_pending', errorMessage: '' } },
    );
    if (claimed.modifiedCount === 0 && row.status !== 'transfer_pending') {
      return;
    }

    try {
      const title = row.originalName.trim() || 'Document';
      const contentType = String(row.mimeType ?? '').trim() || 'application/octet-stream';
      const now = new Date();
      const created = await this.documentsService.create({
        botId,
        title,
        sourceType: 'upload',
        fileName: row.originalName,
        fileType: contentType,
        fileSize: row.sizeBytes,
        storage: 's3',
        s3Bucket: row.s3Bucket ?? '',
        s3Key: row.storageKey,
        status: 'queued',
      });

      const docId =
        (created as { _id?: { toString?: () => string } })._id?.toString?.() ??
        String((created as { _id?: unknown })._id);
      const docOid = new Types.ObjectId(docId);

      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { createdKnowledgeItemId: docOid } },
      );

      await this.ingestionService.createQueuedJob(botId, docId, {
        markTrainingQueued: true,
        timesOverride: ONBOARDING_DOCUMENT_INGEST_TIMES(now),
      });

      await this.markTransferred(row._id, botId, docOid);
      this.logger.log(`Transferred onboarding document stagedId=${String(row._id)} botId=${botId} docId=${docId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { status: 'failed', errorMessage: msg.slice(0, 500) } },
      );
      this.logger.error(`Failed onboarding document transfer stagedId=${String(row._id)} botId=${botId}: ${msg}`);
      throw err;
    }
  }

  private async resumeDocumentTransfer(botId: string, row: StagingRow): Promise<void> {
    const docId = String(row.createdKnowledgeItemId);
    const now = new Date();
    try {
      await this.ingestionService.createQueuedJob(botId, docId, {
        markTrainingQueued: true,
        timesOverride: ONBOARDING_DOCUMENT_INGEST_TIMES(now),
      });
      await this.markTransferred(row._id, botId, row.createdKnowledgeItemId!);
      this.logger.log(
        `Resumed onboarding document transfer stagedId=${String(row._id)} botId=${botId} docId=${docId}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { status: 'failed', errorMessage: msg.slice(0, 500) } },
      );
      this.logger.error(
        `Failed resumed onboarding document transfer stagedId=${String(row._id)} botId=${botId}: ${msg}`,
      );
      throw err;
    }
  }

  private async transferDatasheet(botId: string, row: StagingRow): Promise<void> {
    if (row.status === 'transferred') return;

    const meta = row.metadata ?? {};
    const columns = Array.isArray(meta.columns)
      ? (meta.columns as unknown[]).map((c) => String(c ?? ''))
      : [];
    const gridRows = Array.isArray(meta.rows)
      ? (meta.rows as unknown[][]).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
      : [];
    const title = String(meta.sheetName ?? row.originalName.replace(/\.[^.]+$/, '')).trim() || 'Datasheet';

    if (!columns.length || !gridRows.length) {
      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { status: 'failed', errorMessage: 'Missing parsed datasheet metadata.' } },
      );
      return;
    }

    if (row.status === 'transfer_pending') {
      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { status: 'uploaded', errorMessage: '' } },
      );
    }

    const claimed = await this.stagingModel.updateOne(
      { _id: row._id, status: { $in: ['uploaded', 'failed'] } },
      { $set: { status: 'transfer_pending', errorMessage: '' } },
    );
    if (claimed.modifiedCount === 0) {
      return;
    }

    try {
      await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(botId, [
        {
          title,
          columns,
          rows: gridRows,
          active: true,
          importFileName: row.originalName,
          importFileSize: row.sizeBytes,
        },
      ], ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS);

      await this.stagingModel.updateOne(
        { _id: row._id },
        {
          $set: {
            status: 'transferred',
            transferredBotId: new Types.ObjectId(botId),
            errorMessage: '',
          },
        },
      );
      this.logger.log(`Transferred onboarding datasheet stagedId=${String(row._id)} botId=${botId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.stagingModel.updateOne(
        { _id: row._id },
        { $set: { status: 'failed', errorMessage: msg.slice(0, 500) } },
      );
      this.logger.error(`Failed onboarding datasheet transfer stagedId=${String(row._id)} botId=${botId}: ${msg}`);
      throw err;
    }
  }

  private async markTransferred(
    stagedId: Types.ObjectId,
    botId: string,
    knowledgeItemOrDocId: Types.ObjectId,
  ): Promise<void> {
    await this.stagingModel.updateOne(
      { _id: stagedId },
      {
        $set: {
          status: 'transferred',
          transferredBotId: new Types.ObjectId(botId),
          createdKnowledgeItemId: knowledgeItemOrDocId,
          errorMessage: '',
        },
      },
    );
  }
}
