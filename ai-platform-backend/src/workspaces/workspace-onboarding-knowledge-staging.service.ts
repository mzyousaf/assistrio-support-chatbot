import { HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { uploadToS3 } from '../lib/s3';
import {
  WorkspaceOnboardingKnowledgeStaging,
  type OnboardingKnowledgeStagingSourceType,
} from '../models/workspace-onboarding-knowledge-staging.schema';
import {
  guessContentTypeByExt,
  readDatasheetFileFromMultipart,
} from '../workspace/datasheet-import-request.util';
import {
  parseDatasheetFileBuffer,
  validateDatasheetGridOrThrow,
  TableDatasheetValidationError,
} from '../workspace/datasheet-import.util';
import type { WorkspaceOnboardingDraftSnapshot, WorkspaceOnboardingResponse } from './workspace-onboarding.types';
import {
  assertOnboardingKbWithinLimit,
  buildOnboardingKbUsageSnapshot,
  estimateStagedTableBytes,
  sumStagedFileBytes,
} from './workspace-onboarding-knowledge-limit.util';
import {
  ONBOARDING_KNOWLEDGE_DATASHEETS_MAX,
  ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX,
  ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES,
} from './workspace-onboarding-knowledge-limits.constants';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { sortOnboardingKbItemsLatestFirst } from './workspace-onboarding-knowledge-sort.util';

export type WorkspaceOnboardingStagedKnowledgeItemDto = {
  id: string;
  sourceType: OnboardingKnowledgeStagingSourceType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage?: string;
  createdAt: string | null;
  updatedAt: string | null;
  metadata?: Record<string, unknown>;
};

export type WorkspaceOnboardingStagedKnowledgeDto = {
  documents: WorkspaceOnboardingStagedKnowledgeItemDto[];
  datasheets: WorkspaceOnboardingStagedKnowledgeItemDto[];
};

type StagingLean = {
  _id: Types.ObjectId;
  sourceType: OnboardingKnowledgeStagingSourceType;
  originalName: string;
  mimeType?: string;
  sizeBytes: number;
  status: string;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
};

function guessDocumentContentType(ext: string, fileMimetype: string): string {
  if (fileMimetype) return fileMimetype;
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}

function serializeStagedItem(row: StagingLean): WorkspaceOnboardingStagedKnowledgeItemDto {
  return {
    id: String(row._id),
    sourceType: row.sourceType,
    originalName: row.originalName,
    mimeType: String(row.mimeType ?? ''),
    sizeBytes: row.sizeBytes,
    status: row.status,
    ...(row.errorMessage ? { errorMessage: row.errorMessage } : {}),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    ...(row.metadata && Object.keys(row.metadata).length > 0 ? { metadata: row.metadata } : {}),
  };
}

@Injectable()
export class WorkspaceOnboardingKnowledgeStagingService {
  constructor(
    @InjectModel(WorkspaceOnboardingKnowledgeStaging.name)
    private readonly stagingModel: Model<WorkspaceOnboardingKnowledgeStaging>,
    private readonly workspaceOnboardingService: WorkspaceOnboardingService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  async countPendingStagedKnowledge(
    draftId: string,
  ): Promise<{ documentCount: number; datasheetCount: number }> {
    if (!Types.ObjectId.isValid(draftId)) {
      return { documentCount: 0, datasheetCount: 0 };
    }
    const draftOid = new Types.ObjectId(draftId);
    const base = { onboardingDraftId: draftOid, status: { $ne: 'transferred' } };
    const [documentCount, datasheetCount] = await Promise.all([
      this.stagingModel.countDocuments({ ...base, sourceType: 'document' }),
      this.stagingModel.countDocuments({ ...base, sourceType: 'datasheet' }),
    ]);
    return { documentCount, datasheetCount };
  }

  async listStagedKnowledge(draftId: string): Promise<WorkspaceOnboardingStagedKnowledgeDto> {
    if (!Types.ObjectId.isValid(draftId)) {
      return { documents: [], datasheets: [] };
    }
    const rows = (await this.stagingModel
      .find({
        onboardingDraftId: new Types.ObjectId(draftId),
        status: { $ne: 'transferred' },
      })
      .sort({ createdAt: -1 })
      .lean()) as StagingLean[];

    const documents: WorkspaceOnboardingStagedKnowledgeItemDto[] = [];
    const datasheets: WorkspaceOnboardingStagedKnowledgeItemDto[] = [];
    for (const row of rows) {
      const dto = serializeStagedItem(row);
      if (row.sourceType === 'document') documents.push(dto);
      else if (row.sourceType === 'datasheet') datasheets.push(dto);
    }
    return {
      documents: sortOnboardingKbItemsLatestFirst(documents),
      datasheets: sortOnboardingKbItemsLatestFirst(datasheets),
    };
  }

  async attachStagedKnowledgeToResponse(
    response: WorkspaceOnboardingResponse,
  ): Promise<WorkspaceOnboardingResponse> {
    const draftId = response.onboardingDraftId;
    if (!draftId) {
      return { ...response, stagedKnowledge: { documents: [], datasheets: [] } };
    }
    const stagedKnowledge = await this.listStagedKnowledge(draftId);
    return { ...response, stagedKnowledge };
  }

  hasStagedKnowledge(staged: WorkspaceOnboardingStagedKnowledgeDto | undefined): boolean {
    return (staged?.documents.length ?? 0) > 0 || (staged?.datasheets.length ?? 0) > 0;
  }

  async uploadDocuments(
    workspaceId: string,
    files: Array<{ buffer: Buffer; originalName: string; fileMimetype: string; ext: string }>,
  ): Promise<WorkspaceOnboardingResponse> {
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    if (!draftId) {
      throw new NotFoundException({ error: 'Onboarding draft not found.' });
    }

    const stagedKnowledge = await this.listStagedKnowledge(draftId);
    const currentDocCount = stagedKnowledge.documents.length;
    if (currentDocCount + files.length > ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX) {
      throw new HttpException(
        {
          error: `At most ${ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX} documents can be added during onboarding.`,
          errorCode: 'onboarding_documents_limit_reached',
          currentCount: currentDocCount,
          maxCount: ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const file of files) {
      if (file.buffer.length > ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES) {
        throw new HttpException(
          {
            error: 'File exceeds the 20 MB limit.',
            errorCode: 'onboarding_file_too_large',
            maxBytes: ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const existing = await this.listActiveStagingRows(draftId);
    const stagedFileBytes = sumStagedFileBytes(existing);
    const stagedTableBytes = estimateStagedTableBytes(this.extractTableMeta(existing));

    const incomingBytes = files.reduce((sum, f) => sum + f.buffer.length, 0);
    assertOnboardingKbWithinLimit({
      entitlements,
      draft: onboarding.draft,
      stagedFileBytes,
      stagedTableBytes,
      incomingBytes,
    });

    const draftOid = new Types.ObjectId(draftId);
    const wsOid = new Types.ObjectId(workspaceId);
    const prefix = `uploads/onboarding-drafts/${draftId}/documents`;

    for (const file of files) {
      const contentType = guessDocumentContentType(file.ext, file.fileMimetype);
      let uploaded: { bucket: string; key: string };
      try {
        uploaded = await uploadToS3({
          visibility: 'private',
          prefix,
          originalName: file.originalName,
          contentType,
          body: file.buffer,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[onboarding-knowledge] document upload failed', { workspaceId, draftId, msg });
        throw new ServiceUnavailableException({
          error: 'Document storage is not available. Try again later.',
        });
      }

      await this.stagingModel.create({
        workspaceId: wsOid,
        onboardingDraftId: draftOid,
        sourceType: 'document',
        originalName: file.originalName,
        mimeType: contentType,
        sizeBytes: file.buffer.length,
        storageKey: uploaded.key,
        s3Bucket: uploaded.bucket,
        status: 'uploaded',
        metadata: { extension: file.ext, sourceType: 'upload' },
      });
    }

    const refreshed = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    return this.attachStagedKnowledgeToResponse(refreshed);
  }

  async uploadDatasheet(
    workspaceId: string,
    file: { buffer: Buffer; originalName: string; fileMimetype: string },
  ): Promise<WorkspaceOnboardingResponse> {
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    if (!draftId) {
      throw new NotFoundException({ error: 'Onboarding draft not found.' });
    }

    const parsed = parseDatasheetFileBuffer(file.buffer, file.originalName);
    if (parsed.parseError || !parsed.columns.length) {
      throw new HttpException(
        { error: parsed.parseError ?? 'Could not parse datasheet.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const title = file.originalName.replace(/\.[^.]+$/, '').trim() || file.originalName;
    try {
      validateDatasheetGridOrThrow(title, parsed.columns, parsed.rows);
    } catch (e) {
      const msg = e instanceof TableDatasheetValidationError ? e.message : 'Invalid datasheet.';
      throw new HttpException({ error: msg }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const stagedKnowledge = await this.listStagedKnowledge(draftId);
    if (stagedKnowledge.datasheets.length >= ONBOARDING_KNOWLEDGE_DATASHEETS_MAX) {
      throw new HttpException(
        {
          error: `At most ${ONBOARDING_KNOWLEDGE_DATASHEETS_MAX} datasheets can be added during onboarding.`,
          errorCode: 'onboarding_datasheets_limit_reached',
          currentCount: stagedKnowledge.datasheets.length,
          maxCount: ONBOARDING_KNOWLEDGE_DATASHEETS_MAX,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (file.buffer.length > ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES) {
      throw new HttpException(
        {
          error: 'File exceeds the 20 MB limit.',
          errorCode: 'onboarding_file_too_large',
          maxBytes: ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const existing = await this.listActiveStagingRows(draftId);
    const stagedFileBytes = sumStagedFileBytes(existing);
    const stagedTableBytes = estimateStagedTableBytes(this.extractTableMeta(existing));

    const tableBytes = estimateStagedTableBytes([
      { title, columns: parsed.columns, rows: parsed.rows },
    ]);
    assertOnboardingKbWithinLimit({
      entitlements,
      draft: onboarding.draft,
      stagedFileBytes,
      stagedTableBytes,
      incomingBytes: file.buffer.length + tableBytes,
    });

    const ext = file.originalName.split('.').pop()?.toLowerCase() ?? '';
    const contentType = file.fileMimetype || guessContentTypeByExt(ext);
    const draftOid = new Types.ObjectId(draftId);
    const wsOid = new Types.ObjectId(workspaceId);
    const prefix = `uploads/onboarding-drafts/${draftId}/datasheets`;

    let uploaded: { bucket: string; key: string };
    try {
      uploaded = await uploadToS3({
        visibility: 'private',
        prefix,
        originalName: file.originalName,
        contentType,
        body: file.buffer,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[onboarding-knowledge] datasheet upload failed', { workspaceId, draftId, msg });
      throw new ServiceUnavailableException({
        error: 'Datasheet storage is not available. Try again later.',
      });
    }

    await this.stagingModel.create({
      workspaceId: wsOid,
      onboardingDraftId: draftOid,
      sourceType: 'datasheet',
      originalName: file.originalName,
      mimeType: contentType,
      sizeBytes: file.buffer.length,
      storageKey: uploaded.key,
      s3Bucket: uploaded.bucket,
      status: 'uploaded',
      metadata: {
        sheetName: title,
        rowCount: parsed.rows.length,
        columnHeaders: parsed.columns,
        importMode: 'full',
        columns: parsed.columns,
        rows: parsed.rows,
      },
    });

    const refreshed = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    return this.attachStagedKnowledgeToResponse(refreshed);
  }

  async deleteStagedItem(workspaceId: string, stagedItemId: string, sourceType: OnboardingKnowledgeStagingSourceType) {
    if (!Types.ObjectId.isValid(stagedItemId)) {
      throw new NotFoundException({ error: 'Staged item not found.' });
    }
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    if (!draftId) {
      throw new NotFoundException({ error: 'Onboarding draft not found.' });
    }

    const deleted = await this.stagingModel.findOneAndDelete({
      _id: new Types.ObjectId(stagedItemId),
      workspaceId: new Types.ObjectId(workspaceId),
      onboardingDraftId: new Types.ObjectId(draftId),
      sourceType,
      status: { $ne: 'transferred' },
    });
    if (!deleted) {
      throw new NotFoundException({ error: 'Staged item not found.' });
    }

    const refreshed = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    return this.attachStagedKnowledgeToResponse(refreshed);
  }

  async bulkDeleteStagedItems(
    workspaceId: string,
    stagedItemIds: readonly string[],
    sourceType: OnboardingKnowledgeStagingSourceType,
  ): Promise<WorkspaceOnboardingResponse & { deletedCount: number }> {
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    if (!draftId) {
      throw new NotFoundException({ error: 'Onboarding draft not found.' });
    }

    const objectIds = stagedItemIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    let deletedCount = 0;
    if (objectIds.length > 0) {
      const result = await this.stagingModel.deleteMany({
        _id: { $in: objectIds },
        workspaceId: new Types.ObjectId(workspaceId),
        onboardingDraftId: new Types.ObjectId(draftId),
        sourceType,
        status: { $ne: 'transferred' },
      });
      deletedCount = result.deletedCount ?? 0;
    }

    const refreshed = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const response = await this.attachStagedKnowledgeToResponse(refreshed);
    return { ...response, deletedCount };
  }

  async getKbUsageForDraft(
    workspaceId: string,
    draft: WorkspaceOnboardingDraftSnapshot,
    draftId: string,
  ) {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const existing = await this.listActiveStagingRows(draftId);
    return buildOnboardingKbUsageSnapshot(
      entitlements,
      draft,
      sumStagedFileBytes(existing),
      estimateStagedTableBytes(this.extractTableMeta(existing)),
    );
  }

  async listPendingTransferRows(draftId: string) {
    if (!Types.ObjectId.isValid(draftId)) return [];
    return this.stagingModel
      .find({
        onboardingDraftId: new Types.ObjectId(draftId),
        status: { $in: ['uploaded', 'failed'] },
      })
      .sort({ createdAt: 1 })
      .lean();
  }

  private async listActiveStagingRows(draftId: string) {
    if (!Types.ObjectId.isValid(draftId)) return [];
    return this.stagingModel
      .find({
        onboardingDraftId: new Types.ObjectId(draftId),
        status: { $ne: 'transferred' },
      })
      .lean();
  }

  private extractTableMeta(
    rows: Array<{ sourceType?: string; metadata?: Record<string, unknown> }>,
  ): Array<{ title: string; columns: string[]; rows: string[][] }> {
    const out: Array<{ title: string; columns: string[]; rows: string[][] }> = [];
    for (const row of rows) {
      if (row.sourceType !== 'datasheet') continue;
      const meta = row.metadata ?? {};
      const columns = Array.isArray(meta.columns)
        ? (meta.columns as unknown[]).map((c) => String(c ?? ''))
        : Array.isArray(meta.columnHeaders)
          ? (meta.columnHeaders as unknown[]).map((c) => String(c ?? ''))
          : [];
      const gridRows = Array.isArray(meta.rows)
        ? (meta.rows as unknown[][]).map((r) =>
            Array.isArray(r) ? r.map((c) => String(c ?? '')) : [],
          )
        : [];
      if (!columns.length || !gridRows.length) continue;
      const title = String(meta.sheetName ?? 'Datasheet').trim() || 'Datasheet';
      out.push({ title, columns, rows: gridRows });
    }
    return out;
  }
}
