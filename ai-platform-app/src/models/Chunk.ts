import mongoose, { Document as MDoc, Model, Schema } from "mongoose";

export interface ChunkDocument extends MDoc {
  botId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  text: string;
  embedding: number[];
  createdAt: Date;
}

const ChunkSchema = new Schema<ChunkDocument>({
  botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  createdAt: { type: Date, default: () => new Date() },
});

ChunkSchema.index({ botId: 1, createdAt: -1 });

export const Chunk: Model<ChunkDocument> =
  mongoose.models.Chunk || mongoose.model<ChunkDocument>("Chunk", ChunkSchema);
