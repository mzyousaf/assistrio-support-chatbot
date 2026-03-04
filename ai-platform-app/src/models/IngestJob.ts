import mongoose, { Document as MDoc, Model, Schema } from "mongoose";

export type IngestJobStatus = "queued" | "processing" | "done" | "failed";

export interface IngestJobDocument extends MDoc {
  botId: mongoose.Types.ObjectId;
  docId: mongoose.Types.ObjectId;
  status: IngestJobStatus;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IngestJobSchema = new Schema<IngestJobDocument>(
  {
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    docId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    status: {
      type: String,
      required: true,
      enum: ["queued", "processing", "done", "failed"],
      index: true,
    },
    error: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true },
);

IngestJobSchema.index({ status: 1, createdAt: 1 });
IngestJobSchema.index({ botId: 1, createdAt: -1 });
IngestJobSchema.index({ docId: 1 });

export const IngestJob: Model<IngestJobDocument> =
  mongoose.models.IngestJob || mongoose.model<IngestJobDocument>("IngestJob", IngestJobSchema);

export default IngestJob;
