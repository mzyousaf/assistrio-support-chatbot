import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Short-lived server-side session after datasheet preview upload (S3 pointer + preview grid).
 * Consumed once on {@link TableImportJob} creation.
 */
@Schema({ timestamps: true, collection: 'table_import_sessions' })
export class TableImportSession {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;

  @Prop({ required: true })
  s3Bucket: string;

  @Prop({ required: true })
  s3Key: string;

  @Prop({ required: true })
  originalFileName: string;

  @Prop({ min: 0, required: true })
  fileSizeBytes: number;

  @Prop()
  contentType?: string;

  @Prop({ type: [String], default: [] })
  columns: string[];

  @Prop({ type: [[String]], default: [] })
  previewRows: string[][];

  /** Best-effort (e.g. CSV newline estimate); may be undefined for some XLSX paths. */
  @Prop({ min: 0 })
  estimatedDataRows?: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  consumedAt?: Date;

  /** User abandoned preview; confirm must return `import_session_cancelled`. */
  @Prop()
  cancelledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'KnowledgeBaseItem' })
  resultKnowledgeBaseItemId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TableImportJob' })
  resultImportJobId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TableImportSessionSchema = SchemaFactory.createForClass(TableImportSession);

export const TABLE_IMPORT_SESSION_MONGO_COLLECTION =
  TableImportSessionSchema.get('collection') || 'table_import_sessions';

TableImportSessionSchema.index({ botId: 1, expiresAt: 1 });
/** TTL removed: expired/cancelled preview rows are purged (S3 first) by {@link TableImportService.cleanupStaleTableImportPreviewSessions}. */
