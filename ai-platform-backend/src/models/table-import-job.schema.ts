import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type TableImportJobStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * Background parse + persist for large CSV/XLSX datasheets (never uses document {@link ExtractJob}).
 */
@Schema({ timestamps: true, collection: 'table_import_jobs' })
export class TableImportJob {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'KnowledgeBaseItem', required: true })
  knowledgeBaseItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TableImportSession', required: true })
  importSessionId: Types.ObjectId;

  @Prop({ required: true })
  s3Bucket: string;

  @Prop({ required: true })
  s3Key: string;

  @Prop({ required: true })
  originalFileName: string;

  /** Source byte size from upload session (used for XLSX/worker guards without a HEAD request). */
  @Prop({ min: 0 })
  sourceFileSizeBytes?: number;

  @Prop({
    required: true,
    enum: ['queued', 'processing', 'done', 'failed'],
  })
  status: TableImportJobStatus;

  @Prop()
  error?: string;

  /** Machine-oriented code (e.g. `empty_file`, `header_only`). */
  @Prop()
  errorCode?: string;

  @Prop()
  queuedAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ default: 0, min: 0 })
  importAutoRetryCycles?: number;

  /** Optional column drops from confirm (0-based indices into header). */
  @Prop({ type: [Number], default: undefined })
  dropColumnIndices?: number[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const TableImportJobSchema = SchemaFactory.createForClass(TableImportJob);

export const TABLE_IMPORT_JOB_MONGO_COLLECTION =
  TableImportJobSchema.get('collection') || 'table_import_jobs';

TableImportJobSchema.index({ botId: 1 });
/** Idempotent confirm path (`confirmTableImport`) resolves existing job by import session id. */
TableImportJobSchema.index({ importSessionId: 1 });
TableImportJobSchema.index({ status: 1, queuedAt: 1, createdAt: 1 });
/** Fair import worker: `status: queued` + per-bot ordering for oldest-job-per-bot aggregation. */
TableImportJobSchema.index({ status: 1, botId: 1, queuedAt: 1, createdAt: 1 });
/** Manual retry/live-state reads fetch latest job rows for one table KB item. */
TableImportJobSchema.index({ botId: 1, knowledgeBaseItemId: 1, createdAt: -1 });
/** At most one live import job per table KB row. */
TableImportJobSchema.index(
  { botId: 1, knowledgeBaseItemId: 1 },
  {
    unique: true,
    name: 'botId_1_knowledgeBaseItemId_1_live_table_import_unique',
    partialFilterExpression: {
      status: { $in: ['queued', 'processing'] },
      knowledgeBaseItemId: { $exists: true, $type: 'objectId' },
    },
  },
);
