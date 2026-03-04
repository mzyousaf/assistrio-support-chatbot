import mongoose, { Document as MDoc, Model, Schema } from "mongoose";

export interface DocumentDocument extends MDoc {
  botId: mongoose.Types.ObjectId;
  title: string;
  sourceType: "upload" | "url" | "manual";
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  text?: string;
  createdAt: Date;
}

const DocumentSchema = new Schema<DocumentDocument>({
  botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
  title: { type: String, required: true },
  sourceType: { type: String, required: true, enum: ["upload", "url", "manual"] },
  fileName: { type: String },
  fileType: { type: String },
  fileSize: { type: Number },
  url: { type: String },
  text: { type: String },
  createdAt: { type: Date, default: () => new Date() },
});

DocumentSchema.index({ botId: 1, createdAt: -1 });

export const DocumentModel: Model<DocumentDocument> =
  mongoose.models.Document || mongoose.model<DocumentDocument>("Document", DocumentSchema);
