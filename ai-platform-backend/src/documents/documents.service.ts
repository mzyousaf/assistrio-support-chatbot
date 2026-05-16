import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExtractJob, TrainJob } from '../models';
import type { IngestJobStatus } from '../models';
import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';
import type { KnowledgeTrainingSettingsResolved } from '../knowledge/bot-knowledge-training-settings.util';
import { normalizeKnowledgeTrainingStatus } from '../knowledge/knowledge-training-status.util';
import {
  normalizeDocumentUploadStatus,
  type DocumentUploadStatus,
} from './document-upload-status.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseItemAccessService } from '../knowledge/knowledge-base-item-access.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import {
  kbLastSuccessfulTrainInstant,
  kbTrainingFailureMessage,
} from '../knowledge/knowledge-base-item-canonical.util';
import { getSignedGetUrl } from '../lib/s3';
import { isExtractManualRetrySuggested } from '../ingestion/extract-job-retry.policy.util';
import {
  isTrainingManualRetrySuggested,
  resolveTrainingFailureCode,
} from '../knowledge/knowledge-manual-retry-suggested.util';
import type { DocumentPipelineDisplay, DocumentPipelineStage } from './document-pipeline-display.util';
import { computeKbDocumentTrainingDisplay } from '../knowledge/document-effective-training-status.util';
import { deriveDocumentPipelineDisplay } from './document-pipeline-display.util';
import { effectiveKbDocumentFileMetaLean } from '../knowledge/knowledge-base-document-sync-fields.util';
import {
  deriveKnowledgeBaseItemDisplayFields,
  finalizeCustomerKbItemApiDisplayBundle,
  type KnowledgeItemWorkflowDisplayStatus,
} from '../knowledge/knowledge-item-display-status.util';
import { kbTrainingVerboseLogsEnabled } from '../knowledge/kb-training-log.util';
import { resolveCustomerDocumentPresentationNames } from './customer-document-presentation.util';
import { KNOWLEDGE_DOCUMENTS_MAX } from '../workspace/shared/bot-field-limits';
import {
  INGESTION_STUCK_TIMEOUT_MINUTES,
  KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES,
} from '../knowledge/knowledge-pipeline-retry.constants';
import { mergeDocumentPipelineJobsForCustomerRead } from '../knowledge/document-pipeline-merge-for-read.util';
import { normalizeKbDocumentBodyForHash } from '../knowledge/knowledge-content-hash.util';
import { kbDocumentManualPatchIsNoop } from '../knowledge/kb-document-manual-patch.util';
import { isTrainableExtractedDocumentText } from '../knowledge/knowledge-text-metrics';
import { documentEligibleForTrainingBuckets } from '../knowledge/knowledge-extraction-status.util';

function documentPipelineFromWorkflowDisplay(
  displayStatus: KnowledgeItemWorkflowDisplayStatus,
  displayMessage: string,
): DocumentPipelineDisplay {
  const stageMap: Partial<Record<KnowledgeItemWorkflowDisplayStatus, DocumentPipelineStage>> = {
    uploading: 'uploading',
    waiting_for_source: 'pending_extraction',
    waiting_to_extract: 'extract_queued',
    extracting_text: 'extract_processing',
    extraction_failed: 'extract_failed',
    waiting_for_training: 'training_required',
    training_queued: 'training_queued',
    training: 'training',
    ready: 'passed',
    training_failed: 'training_failed',
    import_queued: 'training_required',
    importing_table: 'training',
    import_failed: 'extract_failed',
    out_of_storage: 'training_failed',
  };
  return { stage: stageMap[displayStatus] ?? 'training_required', label: displayMessage };
}

function inferMimeFromFileName(name: unknown): string {
  const base = String(name ?? '').toLowerCase().trim();
  const ext = base.includes('.') ? (base.split('.').pop() ?? '').trim() : '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}

export interface CreateDocumentDto {
  botId: string;
  title: string;
  sourceType: 'upload' | 'url' | 'manual';
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  status?: string;
  text?: string;
  storage?: string;
  s3Bucket?: string;
  s3Key?: string;
  uploadSessionId?: string;
}

function withDocumentUploadFields<D extends Record<string, unknown>>(doc: D, err?: unknown): D & { documentStatus: DocumentUploadStatus } {
  const raw = typeof doc.status === 'string' ? doc.status : '';
  const e =
    err !== undefined
      ? String(err)
      : typeof (doc as { error?: unknown }).error === 'string'
        ? String((doc as { error?: string }).error)
        : undefined;
  const documentStatus = normalizeDocumentUploadStatus(raw, e);
  return { ...(doc as D), status: documentStatus, documentStatus };
}

function mapKbItemToDocumentShape(r: Record<string, unknown>): Record<string, unknown> {
  const id = String((r._id as Types.ObjectId)?.toString?.() ?? r._id ?? '');
  const botIdRaw = String((r.botId as Types.ObjectId)?.toString?.() ?? r.botId ?? '');
  const fm = effectiveKbDocumentFileMetaLean(r);
  const presentation = resolveCustomerDocumentPresentationNames(r);

  const fileUploadRaw = typeof fm.uploadStatus === 'string' ? fm.uploadStatus : '';
  const uploadStatus = normalizeDocumentUploadStatus(fileUploadRaw || '', undefined);

  const originalNameFromFm =
    typeof fm.originalName === 'string' && fm.originalName.trim() ? fm.originalName.trim() : '';
  const originalName = (presentation.originalFilename ?? '').trim() || originalNameFromFm;
  const mimeType =
    typeof fm.mimeType === 'string' && fm.mimeType.trim()
      ? fm.mimeType.trim()
      : '';
  const sizeBytesRaw =
    typeof fm.sizeBytes === 'number' && Number.isFinite(fm.sizeBytes) ? fm.sizeBytes : 0;

  const bucket = String(fm.storageBucket ?? '').trim();
  const key = String(fm.storageKey ?? '').trim();
  const smUrlRaw = typeof fm.url === 'string' ? fm.url.trim() : '';
  /** True when a downloadable source exists (private S3 or public URL); never emits raw URLs in this mapper. */
  const hasFile =
    (Boolean(bucket && key) && uploadStatus !== 'upload_failed') ||
    (Boolean(smUrlRaw) && /^https?:\/\//i.test(smUrlRaw) && uploadStatus !== 'upload_failed');

  const downloadUrlPath =
    botIdRaw && id ? `bots/${botIdRaw}/documents/${id}/download-url` : undefined;

  const upLegacy: DocumentUploadStatus = uploadStatus;

  return {
    _id: id,
    id,
    botId: botIdRaw,
    title: presentation.titleHeadline,
    displayName: presentation.displayName,
    ...(presentation.originalFilename ? { originalFilename: presentation.originalFilename } : {}),
    originalName,
    mimeType,
    sizeBytes: sizeBytesRaw,
    uploadStatus,
    sourceType: 'upload',
    active: r.active !== false,
    text: typeof r.content === 'string' ? r.content : '',
    fileName: originalName || presentation.displayName,
    fileType: mimeType,
    fileSize: sizeBytesRaw,
    status: upLegacy,
    documentStatus: upLegacy,
    trainingStatus: normalizeKnowledgeTrainingStatus(String(r.status ?? 'pending')),
    knowledgeItemId: id,
    characterCount: typeof r.characterCount === 'number' ? r.characterCount : 0,
    isContentExtracted: (r as { isContentExtracted?: unknown }).isContentExtracted === true,
    extractedTextLength: typeof r.content === 'string' ? r.content.length : 0,
    extractionStatus: typeof (r as { extractionStatus?: unknown }).extractionStatus === 'string'
      ? String((r as { extractionStatus: string }).extractionStatus)
      : undefined,
    extractionError:
      typeof (r as { extractionError?: unknown }).extractionError === 'string'
        ? String((r as { extractionError: string }).extractionError)
        : (r as { extractionError?: null }).extractionError === null
          ? null
          : undefined,
    lastQueuedAt: r.lastQueuedAt,
    runAfter: r.runAfter,
    lastTrainingStartedAt: r.lastTrainingStartedAt,
    lastTrainedAt: kbLastSuccessfulTrainInstant(r as { lastTrainedAt?: Date }),
    trainingError: kbTrainingFailureMessage(r as { trainingError?: string | null }),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    hasFile,
    ...(downloadUrlPath ? { downloadUrlPath } : {}),
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseItemAccess: KnowledgeBaseItemAccessService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
  ) {}

  getKnowledgeTrainingSettingsForBot(botId: string): Promise<KnowledgeTrainingSettingsResolved> {
    return this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(botId);
  }

  /**
   * Merges ingest + chunk “effective” training for **file-backed document KB rows** only.
   * Other `sourceType`s (FAQ, table, …) are unchanged — never key snapshots off non-document ids.
   *
   * Route ids match `/documents` pagination: **`id` is KB `_id`.**
   */
  async enrichLightweightKbDocumentStatuses(
    botId: string,
    items: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    const docIds: string[] = [];
    for (const it of items) {
      const st = typeof (it as { sourceType?: string }).sourceType === 'string' ? (it as { sourceType: string }).sourceType.trim() : '';
      if (st !== 'document') continue;
      const kbId = typeof (it as { id?: string }).id === 'string' ? (it as { id: string }).id.trim() : '';
      if (Types.ObjectId.isValid(kbId)) docIds.push(kbId);
    }
    const unique = [...new Set(docIds)];
    if (unique.length === 0) return items;
    const snap = await this.loadDocumentTrainingSnapshots(botId, unique);
    const verboseKbLogs = kbTrainingVerboseLogsEnabled();
    const iso = (d: unknown): string | null | undefined => {
      if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
      return undefined;
    };
    return items.map((it) => {
      const st = typeof (it as { sourceType?: string }).sourceType === 'string' ? (it as { sourceType: string }).sourceType.trim() : '';
      if (st !== 'document') return it;

      const kbId = typeof (it as { id?: string }).id === 'string' ? String((it as { id: string }).id).trim() : '';
      const row = kbId && Types.ObjectId.isValid(kbId) ? snap.get(kbId) : undefined;
      if (!row) return it;

      const trainingErr =
        row.trainingError != null && `${row.trainingError}`.trim() ? `${row.trainingError}`.trim() : null;

      const lifecycleRaw = String(row.knowledgeItemStatus ?? 'pending');
      const extractedFlag = row.isContentExtracted === true;
      const rawTraining = normalizeKnowledgeTrainingStatus(lifecycleRaw);
      const extractionErr =
        row.kbExtractionError != null && `${row.kbExtractionError}`.trim()
          ? `${row.kbExtractionError}`.trim()
          : null;

      const { displayStatus: wfDisp, displayMessage: wfMsg } = deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: lifecycleRaw,
        extractionStatus: row.kbExtractionStatus ?? null,
        isContentExtracted: extractedFlag,
        content: '',
        fileMeta: {} as Record<string, unknown>,
        uploadDocumentStatus: row.uploadDocumentStatus,
        trainingError: trainingErr,
        extractionError: extractionErr,
      });
      const bundle = finalizeCustomerKbItemApiDisplayBundle(
        { displayStatus: wfDisp, displayMessage: wfMsg },
        { sourceType: 'document', status: lifecycleRaw },
      );
      const pipe = documentPipelineFromWorkflowDisplay(wfDisp, bundle.displayMessage);
      const customerTrainingStatus = bundle.trainingStatus;

      const lastTrainedAt =
        rawTraining === 'ready'
          ? (iso(row.kbLastTrainedAt) ?? iso(row.ingestJobFinishedAt) ?? null)
          : (iso(row.kbLastTrainedAt) ?? null);

      const out: Record<string, unknown> = {
        ...it,
        status: rawTraining,
        trainingStatus: customerTrainingStatus,
        extractionStatus: row.kbExtractionStatus ?? 'not_required',
        extractionError: extractionErr,
        displayStatus: bundle.displayStatus,
        displayLabel: bundle.displayLabel,
        displayMessage: bundle.displayMessage,
        isTraining: bundle.isTraining,
        isExtracting: bundle.isExtracting,
        isImporting: bundle.isImporting,
        lastQueuedAt: iso(row.kbLastQueuedAt) ?? null,
        runAfter: iso(row.kbRunAfter) ?? null,
        lastTrainingStartedAt: iso(row.kbLastTrainingStartedAt) ?? null,
        lastTrainedAt,
        trainingError: trainingErr,
        /** Same funnel stage as `/documents` after ingest/chunk reconcile. */
        documentStatus: pipe.stage,
        statusLabel: pipe.label,
        knowledgeItemStatus: rawTraining,
        latestIngestJobStatus: row.latestIngestJobStatus ?? null,
        extractManualRetrySuggested: row.extractManualRetrySuggested === true,
        trainingManualRetrySuggested: row.trainingManualRetrySuggested === true,
        extractAutoRetryCycles: typeof row.extractAutoRetryCycles === 'number' ? row.extractAutoRetryCycles : 0,
        isContentExtracted: extractedFlag,
      };
      if (row.knowledgeItemId) {
        out.knowledgeItemId = row.knowledgeItemId;
        out.id = row.knowledgeItemId;
      }
      if (verboseKbLogs) {
        out.embeddedChunkCount = row.embeddedChunkCount;
      }
      return out;
    });
  }

  private async loadLatestIngestJobsForRouteIds(
    botOid: Types.ObjectId,
    routeOids: Types.ObjectId[],
  ): Promise<{
    mergedByRoute: Map<
      string,
      {
        status: IngestJobStatus;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
      }
    >;
    extractLatestByRoute: Map<
      string,
      { status: IngestJobStatus; extractAutoRetryCycles: number; extractLastError?: string }
    >;
  }> {
    const emptyMerged = (): {
      mergedByRoute: Map<
        string,
        {
          status: IngestJobStatus;
          queuedAt?: Date;
          runAfter?: Date;
          finishedAt?: Date;
        }
      >;
      extractLatestByRoute: Map<
        string,
        { status: IngestJobStatus; extractAutoRetryCycles: number; extractLastError?: string }
      >;
    } => ({
      mergedByRoute: new Map(),
      extractLatestByRoute: new Map(),
    });

    if (routeOids.length === 0) {
      return emptyMerged();
    }
    const wanted = new Set(routeOids.map((o) => o.toString()));
    const orClause = [{ knowledgeBaseItemId: { $in: routeOids } }];
    const [extractJobs, trainJobs] = await Promise.all([
      this.extractJobModel
        .find({
          botId: botOid,
          $or: orClause,
        })
        .sort({ createdAt: -1 })
        .lean(),
      this.trainJobModel
        .find({
          botId: botOid,
          kind: 'document',
          $or: orClause,
        })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const exByRoute = new Map<
      string,
      {
        status: IngestJobStatus;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
        extractAutoRetryCycles: number;
        extractLastError?: string;
      }
    >();
    for (const j of extractJobs) {
      const row = j as {
        knowledgeBaseItemId?: Types.ObjectId;
        status: IngestJobStatus;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
        extractAutoRetryCycles?: number;
        error?: string;
      };
      const cyc =
        typeof row.extractAutoRetryCycles === 'number' ? Math.max(0, Math.floor(row.extractAutoRetryCycles)) : 0;
      const k = row.knowledgeBaseItemId;
      if (!k) continue;
      const ks = k.toString();
      if (wanted.has(ks) && !exByRoute.has(ks)) {
        const errRaw = row.error;
        exByRoute.set(ks, {
          status: row.status,
          queuedAt: row.queuedAt,
          runAfter: row.runAfter,
          finishedAt: row.finishedAt,
          extractAutoRetryCycles: cyc,
          extractLastError: typeof errRaw === 'string' && errRaw.trim() ? errRaw : undefined,
        });
      }
    }

    const trByRoute = new Map<
      string,
      { status: IngestJobStatus; queuedAt?: Date; runAfter?: Date; finishedAt?: Date }
    >();
    for (const j of trainJobs) {
      const row = j as {
        knowledgeBaseItemId?: Types.ObjectId;
        status: IngestJobStatus;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
      };
      const k = row.knowledgeBaseItemId;
      if (!k) continue;
      const ks = k.toString();
      if (wanted.has(ks) && !trByRoute.has(ks)) {
        trByRoute.set(ks, {
          status: row.status,
          queuedAt: row.queuedAt,
          runAfter: row.runAfter,
          finishedAt: row.finishedAt,
        });
      }
    }

    const mergedByRoute = new Map<
      string,
      {
        status: IngestJobStatus;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
      }
    >();
    const extractLatestByRoute = new Map<
      string,
      { status: IngestJobStatus; extractAutoRetryCycles: number; extractLastError?: string }
    >();
    const extractStaleMs = Math.max(1, INGESTION_STUCK_TIMEOUT_MINUTES) * 60_000;
    const trainStaleMs = Math.max(1, KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES) * 60_000;

    for (const oid of routeOids) {
      const ks = oid.toString();
      const ex = exByRoute.get(ks);
      const tr = trByRoute.get(ks);
      const merged = mergeDocumentPipelineJobsForCustomerRead(ex, tr, extractStaleMs, trainStaleMs);
      if (merged) {
        mergedByRoute.set(ks, merged);
      }
      if (ex) {
        extractLatestByRoute.set(ks, {
          status: ex.status,
          extractAutoRetryCycles: ex.extractAutoRetryCycles,
          extractLastError: ex.extractLastError,
        });
      }
    }
    return { mergedByRoute, extractLatestByRoute };
  }

  private async loadDocumentTrainingSnapshots(botId: string, docIds: string[]): Promise<
    Map<
      string,
      {
        uploadDocumentStatus: DocumentUploadStatus;
        knowledgeItemStatus: string;
        knowledgeItemId: string;
        latestIngestJobStatus: IngestJobStatus | undefined;
        kbLastQueuedAt?: Date;
        kbRunAfter?: Date;
        kbLastTrainingStartedAt?: Date;
        kbLastTrainedAt?: Date;
        /** When the KB row lags but the latest ingest job is already `done`. */
        ingestJobFinishedAt?: Date;
        trainingError?: string | null;
        embeddedChunkCount: number;
        /** Latest ExtractJob-only status (distinct from merged train+extract `latestIngestJobStatus`). */
        latestExtractJobStatus?: IngestJobStatus;
        extractAutoRetryCycles?: number;
        extractManualRetrySuggested?: boolean;
        trainingManualRetrySuggested?: boolean;
        isContentExtracted?: boolean;
        kbExtractionStatus?: string;
        kbExtractionError?: string | null;
      }
    >
  > {
    const out = new Map<
      string,
      {
        uploadDocumentStatus: DocumentUploadStatus;
        knowledgeItemStatus: string;
        knowledgeItemId: string;
        latestIngestJobStatus: IngestJobStatus | undefined;
        kbLastQueuedAt?: Date;
        kbRunAfter?: Date;
        kbLastTrainingStartedAt?: Date;
        kbLastTrainedAt?: Date;
        ingestJobFinishedAt?: Date;
        trainingError?: string | null;
        embeddedChunkCount: number;
        latestExtractJobStatus?: IngestJobStatus;
        extractAutoRetryCycles?: number;
        extractManualRetrySuggested?: boolean;
        trainingManualRetrySuggested?: boolean;
        isContentExtracted?: boolean;
        kbExtractionStatus?: string;
        kbExtractionError?: string | null;
      }
    >();
    if (!Types.ObjectId.isValid(botId) || docIds.length === 0) return out;
    const botOid = new Types.ObjectId(botId);
    const docOids = docIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (docOids.length === 0) return out;

    const [kbItems, ingestData] = await Promise.all([
      this.knowledgeBaseItemAccess.findDocumentKbItemsByDocumentIds(botId, docOids),
      this.loadLatestIngestJobsForRouteIds(botOid, docOids),
    ]);
    const ingestByDoc = ingestData.mergedByRoute;
    const extractLatestByRoute = ingestData.extractLatestByRoute;

    const kbItemIdsForChunks: Types.ObjectId[] = [];
    const docIdOrder: string[] = [];
    for (const oid of docOids) {
      docIdOrder.push(oid.toString());
      const kb = kbItems.get(oid.toString());
      if (kb) kbItemIdsForChunks.push(kb._id);
    }

    const embedByKbId = await this.knowledgeBaseChunkService.countChunksWithValidEmbeddingsByKnowledgeItemIds(
      kbItemIdsForChunks,
    );

    for (const docId of docIdOrder) {
      const k = kbItems.get(docId);
      const kRec = k as unknown as Record<string, unknown> | undefined;
      const fm = effectiveKbDocumentFileMetaLean(kRec);
      const rawUpload = typeof fm.uploadStatus === 'string' ? fm.uploadStatus : '';
      const uploadSt = normalizeDocumentUploadStatus(rawUpload, undefined);
      const kbSt = k
        ? normalizeKnowledgeTrainingStatus(typeof k.status === 'string' ? k.status : '')
        : 'pending';
      const knowledgeItemId = k ? String(k._id) : '';
      const embeddedChunkCount = k ? embedByKbId.get(String(k._id)) ?? 0 : 0;
      const inj = ingestByDoc.get(docId) as
        | { status: IngestJobStatus; queuedAt?: Date; runAfter?: Date; finishedAt?: Date }
        | undefined;
      const ej = extractLatestByRoute.get(docId);
      const rawTrainingErr =
        k != null ? ((k as { trainingError?: string | null }).trainingError ?? null) : null;
      const te = kbTrainingFailureMessage(
        (k ?? {}) as { trainingError?: string | null; error?: string | null },
      );

      out.set(docId, {
        uploadDocumentStatus: uploadSt,
        knowledgeItemStatus: kbSt,
        knowledgeItemId,
        latestIngestJobStatus: inj?.status,
        kbLastQueuedAt: k?.lastQueuedAt,
        kbRunAfter: k?.runAfter,
        kbLastTrainingStartedAt: k?.lastTrainingStartedAt,
        kbLastTrainedAt: kbLastSuccessfulTrainInstant(
          (k ?? {}) as { lastTrainedAt?: Date | null },
        ),
        ingestJobFinishedAt: inj?.status === 'done' ? inj.finishedAt : undefined,
        trainingError: te,
        embeddedChunkCount,
        latestExtractJobStatus: ej?.status,
        extractAutoRetryCycles: ej?.extractAutoRetryCycles ?? 0,
        extractManualRetrySuggested: isExtractManualRetrySuggested({
          extractStatus: ej?.status,
          extractAutoRetryCycles: ej?.extractAutoRetryCycles ?? 0,
          latestExtractError: ej?.extractLastError,
        }),
        trainingManualRetrySuggested: isTrainingManualRetrySuggested({
          knowledgeItemTrainingStatus: kbSt,
          trainingError: te,
          trainingFailureCode: resolveTrainingFailureCode(rawTrainingErr),
        }),
        isContentExtracted: k != null ? (k as { isContentExtracted?: boolean }).isContentExtracted === true : false,
        kbExtractionStatus: (k as { extractionStatus?: string } | undefined)?.extractionStatus,
        kbExtractionError: (() => {
          const raw = (k as { extractionError?: string | null } | undefined)?.extractionError;
          return raw != null && String(raw).trim() ? String(raw).trim() : null;
        })(),
      });
    }

    return out;
  }

  private async applyEffectiveDocumentStatusToRows(
    botId: string,
    rows: Array<Record<string, unknown>>,
  ): Promise<void> {
    const docIds = rows
      .map((r) => {
        const id = (r as { _id?: unknown })._id;
        if (id && typeof id === 'object' && id !== null && 'toString' in id) {
          return String((id as { toString(): string }).toString());
        }
        return typeof id === 'string' ? id : '';
      })
      .filter((id) => Types.ObjectId.isValid(id));
    if (docIds.length === 0) return;
    const snap = await this.loadDocumentTrainingSnapshots(botId, docIds);
    const verboseKbLogs = kbTrainingVerboseLogsEnabled();
    for (const row of rows) {
      const idRaw = (row as { _id?: unknown })._id;
      const id =
        idRaw && typeof idRaw === 'object' && idRaw !== null && 'toString' in idRaw
          ? String((idRaw as { toString(): string }).toString())
          : String(idRaw ?? '');
      const s = snap.get(id);
      if (!s) continue;
      const eff = computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: s.knowledgeItemStatus,
        latestIngestJobStatus: s.latestIngestJobStatus,
        embeddedChunkCount: s.embeddedChunkCount,
      }) as KnowledgeBaseItemTrainingStatus;
      const iso = (d: unknown): string | null | undefined => {
        if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
        return undefined;
      };
      row.uploadStatus = s.uploadDocumentStatus;
      if (s.knowledgeItemId) row.knowledgeItemId = s.knowledgeItemId;
      row.latestIngestJobStatus = s.latestIngestJobStatus ?? null;
      row.lastQueuedAt = iso(s.kbLastQueuedAt) ?? null;
      row.runAfter = iso(s.kbRunAfter) ?? null;
      row.lastTrainingStartedAt = iso(s.kbLastTrainingStartedAt) ?? null;
      row.lastTrainedAt =
        eff === 'ready' ? (iso(s.kbLastTrainedAt) ?? iso(s.ingestJobFinishedAt) ?? null) : (iso(s.kbLastTrainedAt) ?? null);
      row.trainingError = s.trainingError ?? null;
      const extractedFlag = s.isContentExtracted === true;
      row.isContentExtracted = extractedFlag;
      const pipe = deriveDocumentPipelineDisplay({
        uploadDocumentStatus: s.uploadDocumentStatus,
        isContentExtracted: extractedFlag,
        latestExtractJobStatus: s.latestExtractJobStatus ?? null,
        trainingDisplayStatus: eff,
      });
      row.status = pipe.stage;
      row.documentStatus = pipe.stage;
      row.statusLabel = pipe.label;
      const lifecycleRaw = String(s.knowledgeItemStatus ?? 'pending');
      const trainErrPoll =
        s.trainingError != null && `${s.trainingError}`.trim() ? `${s.trainingError}`.trim() : null;
      const wfDisp = deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: eff,
        extractionStatus: s.kbExtractionStatus ?? null,
        isContentExtracted: extractedFlag,
        content: '',
        fileMeta: {} as Record<string, unknown>,
        uploadDocumentStatus: s.uploadDocumentStatus,
        trainingError: trainErrPoll,
        extractionError: s.kbExtractionError ?? null,
      });
      const cust = finalizeCustomerKbItemApiDisplayBundle(wfDisp, {
        sourceType: 'document',
        status: lifecycleRaw,
      });
      row.trainingStatus = cust.trainingStatus;
      row.displayStatus = cust.displayStatus;
      row.displayLabel = cust.displayLabel;
      row.displayMessage = cust.displayMessage;
      row.isTraining = cust.isTraining;
      row.isExtracting = cust.isExtracting;
      row.isImporting = cust.isImporting;
      if (typeof s.extractManualRetrySuggested === 'boolean') {
        row.extractManualRetrySuggested = s.extractManualRetrySuggested;
      }
      if (typeof s.trainingManualRetrySuggested === 'boolean') {
        row.trainingManualRetrySuggested = s.trainingManualRetrySuggested;
      }
      if (typeof s.extractAutoRetryCycles === 'number') {
        row.extractAutoRetryCycles = s.extractAutoRetryCycles;
      }
      if (s.latestExtractJobStatus) {
        row.latestExtractJobStatus = s.latestExtractJobStatus;
      }
      if (verboseKbLogs) {
        row.embeddedChunkCount = s.embeddedChunkCount;
      }
    }
  }

  async create(data: CreateDocumentDto) {
    const existingDocs = await this.countByBot(data.botId);
    if (existingDocs >= KNOWLEDGE_DOCUMENTS_MAX) {
      throw new HttpException(
        {
          error: `Each agent can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. Remove one before adding another.`,
          errorCode: 'plan_limit_knowledge_documents_count',
          maxDocuments: KNOWLEDGE_DOCUMENTS_MAX,
          currentDocuments: existingDocs,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const settings = await this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(data.botId);
    const trainingInitial: KnowledgeBaseItemTrainingStatus =
      data.status !== undefined && data.status !== null && `${data.status}`.trim() !== ''
        ? normalizeKnowledgeTrainingStatus(String(data.status))
        : settings.autoTrainEnabled
          ? 'queued'
          : 'pending';
    const uploadSt: DocumentUploadStatus =
      data.status !== undefined && data.status !== null && `${data.status}`.trim().toLowerCase() === 'upload_failed'
        ? 'upload_failed'
        : 'uploaded';
    const now = new Date();
    const trimmedUrl = typeof data.url === 'string' ? data.url.trim() : '';
    const httpDocumentUrl =
      data.sourceType === 'url' && trimmedUrl && /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : undefined;
    const mimeResolved =
      (typeof data.fileType === 'string' && data.fileType.trim()) || inferMimeFromFileName(data.fileName);
    const { id } = await this.knowledgeBaseItemService.createKbDocumentUploadItem({
      botId: data.botId,
      title: data.title,
      file: {
        originalName: data.fileName ?? 'document',
        mimeType: mimeResolved,
        sizeBytes: typeof data.fileSize === 'number' ? data.fileSize : 0,
        storageKey: data.s3Key ?? '',
        storageBucket: data.s3Bucket ?? '',
        storageProvider: 's3',
        uploadStatus: uploadSt === 'upload_failed' ? 'upload_failed' : 'uploaded',
      },
      ...(httpDocumentUrl ? { httpDocumentUrl } : {}),
      trainingStatus: trainingInitial,
      ...(trainingInitial === 'queued' ? { lastQueuedAt: now, runAfter: now } : {}),
    });
    const trainStNorm = normalizeKnowledgeTrainingStatus(trainingInitial);
    const uploadStNorm = normalizeDocumentUploadStatus(uploadSt, undefined);
    const createPipe = deriveDocumentPipelineDisplay({
      uploadDocumentStatus: uploadStNorm,
      isContentExtracted: false,
      latestExtractJobStatus: null,
      trainingDisplayStatus: trainStNorm,
    });
    return {
      _id: id,
      botId: data.botId,
      title: data.title,
      sourceType: data.sourceType,
      uploadStatus: uploadStNorm,
      status: createPipe.stage,
      documentStatus: createPipe.stage,
      statusLabel: createPipe.label,
      trainingStatus: trainStNorm,
      fileName: data.fileName,
      fileType: mimeResolved,
      fileSize: data.fileSize,
      knowledgeItemId: id,
      id,
      createdAt: now,
    };
  }

  async findByBot(botId: string) {
    if (!Types.ObjectId.isValid(botId)) return [];
    const { rows } = await this.knowledgeBaseItemService.listKbDocumentRowsPaginated(botId, 1, 500);
    const out = rows.map((r) => mapKbItemToDocumentShape(r));
    await this.applyEffectiveDocumentStatusToRows(botId, out);
    return out;
  }

  async countByBot(botId: string): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    return this.knowledgeBaseItemService.countKbDocumentRows(botId);
  }

  async findByBotPaginated(
    botId: string,
    page: number,
    limit: number,
  ): Promise<{ documents: Array<Record<string, unknown>>; total: number }> {
    if (!Types.ObjectId.isValid(botId)) {
      return { documents: [], total: 0 };
    }
    const { rows, total } = await this.knowledgeBaseItemService.listKbDocumentRowsPaginated(botId, page, limit);
    const documents = rows.map((r) => mapKbItemToDocumentShape(r));
    await this.applyEffectiveDocumentStatusToRows(botId, documents);
    return {
      documents,
      total,
    };
  }

  /**
   * Detail GET: optional short-lived signed URL (or public https) for open/download — list responses omit this.
   */
  private async attachSignedDownloadUrlForDetail(botId: string, row: Record<string, unknown>): Promise<void> {
    if (row.hasFile !== true) return;
    const routeId =
      typeof row.knowledgeItemId === 'string' && row.knowledgeItemId.trim()
        ? row.knowledgeItemId.trim()
        : typeof row.id === 'string'
          ? row.id
          : String((row._id as Types.ObjectId)?.toString?.() ?? '');
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return;
    const url = await this.resolveFileDownloadUrlForBot(botId, routeId);
    if (url) {
      row.downloadUrl = url;
    }
  }

  async findOneByBotAndDoc(botId: string, docId: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return null;
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, docId);
    if (!kb) return null;
    const normalized = mapKbItemToDocumentShape(kb as unknown as Record<string, unknown>);
    await this.applyEffectiveDocumentStatusToRows(botId, [normalized]);
    await this.attachSignedDownloadUrlForDetail(botId, normalized);
    return normalized;
  }

  /**
   * Public gallery: signed S3 URL or original HTTP URL for a ready, active document owned by the bot.
   * Returns null when the file is not available (manual text-only, missing keys, etc.).
   */
  async resolveFileDownloadUrlForBot(botId: string, documentId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return null;
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, documentId);
    if (!kb || kb.active === false) return null;
    const fm = effectiveKbDocumentFileMetaLean(kb as unknown as Record<string, unknown>);
    if (fm.uploadStatus === 'upload_failed') return null;

    const bucket = String(fm.storageBucket ?? '').trim();
    const key = String(fm.storageKey ?? '').trim();
    if (bucket && key) {
      try {
        return await getSignedGetUrl(bucket, key, 900);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[documents] signed download URL failed', { botId, documentId, msg });
        return null;
      }
    }
    const u = typeof fm.url === 'string' ? fm.url.trim() : '';
    if (u && /^https?:\/\//i.test(u)) return u;
    return null;
  }

  async getHealthSummary(botId: string) {
    const botOid = Types.ObjectId.isValid(botId) ? new Types.ObjectId(botId) : null;
    if (!botOid) {
      return {
        docsTotal: 0,
        docsPending: 0,
        docsQueued: 0,
        docsProcessing: 0,
        docsReady: 0,
        docsFailed: 0,
        docsIndexedBytes: 0,
        lastIngestedAt: undefined,
        lastFailedDoc: undefined,
      };
    }
    const [
      docsTotal,
      docsPending,
      docsQueued,
      docsProcessing,
      docsReady,
      docsFailed,
      indexedAgg,
      lastReadyTime,
      lastFailedKb,
    ] = await Promise.all([
      this.knowledgeBaseItemService.countKbDocumentRows(botId),
      this.knowledgeBaseItemService.countActiveItems(botId, 'document', ['pending']),
      this.knowledgeBaseItemService.countActiveItems(botId, 'document', ['queued']),
      this.knowledgeBaseItemService.countActiveItems(botId, 'document', ['processing']),
      this.knowledgeBaseItemService.countActiveItems(botId, 'document', ['ready']),
      this.knowledgeBaseItemService.countActiveItems(botId, 'document', ['failed']),
      this.knowledgeBaseItemService.sumIndexedBytesReadyDocuments(botId),
      this.knowledgeBaseItemService.peekLatestReadyDocumentKbTimestamp(botId),
      this.knowledgeBaseItemService.peekLatestFailedDocumentKb(botId),
    ]);

    const docsIndexedBytes = indexedAgg;

    const lastIngestedAtValue = lastReadyTime;
    let lastFailedDoc: { docId: string; title: string; error: string; updatedAt?: string } | undefined;
    if (lastFailedKb) {
      const msg = kbTrainingFailureMessage(lastFailedKb) ?? '';
      lastFailedDoc = {
        docId: String(lastFailedKb.kbItemId),
        title: String(lastFailedKb.title ?? ''),
        error: msg.trim() || 'failed',
        updatedAt:
          lastFailedKb.updatedAt instanceof Date
            ? lastFailedKb.updatedAt.toISOString()
            : undefined,
      };
    }
    return {
      docsTotal,
      docsPending,
      docsQueued,
      docsProcessing,
      docsReady,
      docsFailed,
      docsIndexedBytes,
      lastIngestedAt: lastIngestedAtValue ? new Date(lastIngestedAtValue).toISOString() : undefined,
      lastFailedDoc,
    };
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) return { deleted: id };
    const meta = await this.knowledgeBaseItemService.getBotIdForKbDocumentRouteId(id);
    const oid = new Types.ObjectId(id);
    if (!meta) {
      return { deleted: id };
    }
    await this.knowledgeBaseItemService.assertKbContentPatchTrainingGate(meta.botId, id);
    await this.knowledgeBaseItemService.softDeleteKbDocumentRoutesByIds(meta.botId, [oid]);
    return { deleted: id };
  }

  async removeByBotAndDoc(botId: string, docId: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.knowledgeBaseItemService.assertKbContentPatchTrainingGate(botId, docId);
    const docOid = new Types.ObjectId(docId);
    await this.knowledgeBaseItemService.softDeleteKbDocumentRoutesByIds(botId, [docOid]);
  }

  async removeByBotAndDocIds(botId: string, docIds: string[]): Promise<number> {
    if (!Types.ObjectId.isValid(botId) || !Array.isArray(docIds) || docIds.length === 0) return 0;
    const validIds = docIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (validIds.length === 0) return 0;
    for (const oid of validIds) {
      await this.knowledgeBaseItemService.assertKbContentPatchTrainingGate(botId, String(oid));
    }
    return this.knowledgeBaseItemService.softDeleteKbDocumentRoutesByIds(botId, validIds);
  }

  async setActive(botId: string, docId: string, active: boolean): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, docId, { active });
  }

  async updateFieldsById(botId: string, docId: string, set: Record<string, unknown>): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    const title =
      typeof set.title === 'string' ? set.title.trim() : undefined;
    const text =
      typeof set.text === 'string'
        ? set.text
        : undefined;
    if (title !== undefined || text !== undefined || set.active !== undefined) {
      const cur = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, docId);
      if (!cur) return;
      const settings = await this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(botId);
      const explicitTitleUpdate = typeof set.title === 'string';
      const explicitTextUpdate = typeof set.text === 'string';
      /** Editor save: match {@link upsertDocumentKnowledgeItemAfterContentChange} so `sameHash` does not keep `ready`. */
      const trainingStatusForUpsert: KnowledgeBaseItemTrainingStatus =
        explicitTitleUpdate || explicitTextUpdate
          ? settings.autoTrainEnabled
            ? 'queued'
            : 'pending'
          : normalizeKnowledgeTrainingStatus(String((cur as { status?: string }).status ?? 'pending'));
      await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
        _id: cur._id as Types.ObjectId,
        botId: cur.botId as Types.ObjectId,
        title: title ?? (typeof cur.title === 'string' ? cur.title : 'Document'),
        trainingStatus: trainingStatusForUpsert,
        active:
          typeof set.active === 'boolean'
            ? set.active
            : cur.active !== false,
        text: text ?? ((cur as { content?: string }).content ?? ''),
        ...(() => {
          const fm = effectiveKbDocumentFileMetaLean(cur as unknown as Record<string, unknown>);
          return {
            fileName: fm.originalName,
            fileType: fm.mimeType,
            fileSize: fm.sizeBytes,
            url: fm.url,
            storage: fm.storage ?? 's3',
            s3Bucket: fm.storageBucket,
            s3Key: fm.storageKey,
          };
        })(),
      });
    }
  }

  /**
   * After title/text/active change: sync KB item for ingest/train.
   * When `autoTrainEnabled` is off, training stays **`pending`** and callers must **not** enqueue ingest jobs.
   */
  async upsertDocumentKnowledgeItemAfterContentChange(
    botId: string,
    docId: string,
    trainingSettings?: KnowledgeTrainingSettingsResolved,
  ): Promise<void> {
    const doc = await this.findOneByBotAndDoc(botId, docId);
    if (!doc) return;
    const settings =
      trainingSettings ?? (await this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(botId));
    const knowledgeHint: KnowledgeBaseItemTrainingStatus = settings.autoTrainEnabled ? 'queued' : 'pending';
    const d = doc as Record<string, unknown>;
    await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
      _id: d._id as Types.ObjectId,
      botId: d.botId as Types.ObjectId,
      title: String(d.title ?? 'Document'),
      trainingStatus: knowledgeHint,
      active: d.active !== false,
      text: typeof d.text === 'string' ? d.text : '',
      fileName: d.fileName as string | undefined,
      fileType: d.fileType as string | undefined,
      fileSize: d.fileSize as number | undefined,
      url: d.url as string | undefined,
      storage: d.storage as string | undefined,
      s3Bucket: d.s3Bucket as string | undefined,
      s3Key: d.s3Key as string | undefined,
      uploadSessionId: d.uploadSessionId as string | undefined,
    });
  }

  async findActiveDocumentIds(botId: string): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(botId)) return [];
    const { rows } = await this.knowledgeBaseItemService.listKbDocumentRowsPaginated(botId, 1, 5000);
    return rows.map((r) => (r as { _id: Types.ObjectId })._id);
  }

  async setQueued(botId: string, docId: string, opts?: { setTrainingStatusQueued?: boolean }) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    const now = new Date();
    await this.knowledgeBaseItemService.markDocumentIngestionQueued(botId, docId, {
      lastQueuedAt: now,
      runAfter: now,
    }, opts);
  }

  /**
   * True when the document KB row may set training `status=queued` together with ingest requeue
   * (`extractionStatus=done` or legacy `isContentExtracted`).
   */
  async documentKbAlignTrainingQueuedWithIngest(botId: string, docId: string): Promise<boolean> {
    const kb = await this.knowledgeBaseItemService.findDocumentKbItemLeanForDebug(botId, docId);
    if (!kb) return false;
    const extr = String((kb as { extractionStatus?: string }).extractionStatus ?? '').trim();
    if (extr === 'done') return true;
    return (kb as { isContentExtracted?: boolean }).isContentExtracted === true;
  }

  /**
   * True when PATCH title/body may skip creating a new {@link ExtractJob}: text is already extracted and trainable,
   * matching the worker fast-path (`tryFinishExtractJobIfAlreadyExtracted`).
   */
  /**
   * When true, PATCH title/text/active matches the live KB row fingerprint and active flag — skip DB writes and job churn.
   */
  async documentKbManualPatchIsNoop(
    botId: string,
    docId: string,
    nextTitle: string,
    nextText: string,
    nextActive: boolean,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return false;
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, docId);
    return kbDocumentManualPatchIsNoop(
      kb as { contentHash?: string; active?: boolean } | null,
      nextTitle,
      nextText,
      nextActive,
    );
  }

  async documentManualPatchShouldSkipExtractJob(botId: string, docId: string): Promise<boolean> {
    if (!(await this.documentKbAlignTrainingQueuedWithIngest(botId, docId))) return false;
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, docId);
    if (!kb || kb.isContentExtracted !== true) return false;
    const body = normalizeKbDocumentBodyForHash(String(kb.content ?? ''));
    return body.length > 0 && isTrainableExtractedDocumentText(body);
  }

  /**
   * Block PATCH updates to stored title/text until extraction has persisted trainable document text on the KB row,
   * matching {@link documentEligibleForTrainingBuckets} (documents only).
   */
  assertDocumentPresentationEligibleForKbManualPatch(enrichedDocument: Record<string, unknown>): void {
    if (
      !documentEligibleForTrainingBuckets({
        sourceType: 'document',
        extractionStatus:
          typeof enrichedDocument.extractionStatus === 'string' ? enrichedDocument.extractionStatus : undefined,
        isContentExtracted: enrichedDocument.isContentExtracted === true,
      })
    ) {
      throw new HttpException(
        {
          error: 'Editing is available after text extraction finishes for this document.',
          errorCode: 'document_extraction_pending',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Document PATCH: delegates to shared {@link KnowledgeBaseItemService.assertKbContentPatchTrainingGate}. */
  async assertKbDocumentContentPatchTrainingGate(botId: string, docId: string): Promise<void> {
    await this.knowledgeBaseItemService.assertKbContentPatchTrainingGate(botId, docId);
  }

  async setFailed(botId: string, docId: string, errorMessage: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, docId, {
      status: 'failed',
      failureReason: errorMessage,
    });
  }

  /**
   * GET `.../documents/:id/knowledge-debug` — KB item + chunk counts (auth-checked by controller).
   */
  async getDocumentKnowledgeDebug(
    botId: string,
    docId: string,
  ): Promise<{
    documentId: string;
    documentStatus: string | undefined;
    documentError: unknown;
    ingestedAt: unknown;
    knowledgeItem: Record<string, unknown> | null;
    chunkCount: number;
    activeChunkCount: number;
    characterCount?: number;
    extractedTextLength: number;
  } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return null;
    const kb = await this.knowledgeBaseItemService.findDocumentKbItemLeanForDebug(botId, docId);
    if (!kb) return null;

    const fm = effectiveKbDocumentFileMetaLean(kb as unknown as Record<string, unknown>);
    const uploadRaw = typeof fm.uploadStatus === 'string' ? fm.uploadStatus : '';
    const documentStatus = normalizeDocumentUploadStatus(uploadRaw || '', undefined);

    const content = typeof kb.content === 'string' ? kb.content : '';
    const extractedTextLength = content.length;
    const characterCount = typeof kb.characterCount === 'number' ? kb.characterCount : undefined;

    const chunkCount = await this.knowledgeBaseChunkService.countChunksForDocument(botId, docId);
    const activeChunkCount =
      await this.knowledgeBaseChunkService.countChunksWithValidEmbeddingsForDocument(botId, docId);
    return {
      documentId: docId,
      documentStatus,
      documentError: (kb as { trainingError?: unknown }).trainingError,
      ingestedAt: (kb as { lastTrainedAt?: unknown }).lastTrainedAt,
      knowledgeItem: kb,
      chunkCount,
      activeChunkCount,
      characterCount,
      extractedTextLength,
    };
  }
}
