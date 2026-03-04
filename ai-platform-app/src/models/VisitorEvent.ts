import mongoose, { Document, Model, Schema } from "mongoose";

export type VisitorEventType =
  | "page_view"
  | "demo_chat_started"
  | "trial_bot_created"
  | "trial_chat_started";

export interface VisitorEventDocument extends Document {
  visitorId: string;
  type: VisitorEventType;
  path?: string;
  botSlug?: string;
  botId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const VisitorEventSchema = new Schema<VisitorEventDocument>({
  visitorId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      "page_view",
      "demo_chat_started",
      "trial_bot_created",
      "trial_chat_started",
    ],
  },
  path: { type: String },
  botSlug: { type: String, index: true },
  botId: { type: Schema.Types.ObjectId, ref: "Bot" },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: () => new Date() },
});

VisitorEventSchema.index({ visitorId: 1, createdAt: -1 });
VisitorEventSchema.index({ type: 1, createdAt: -1 });

export const VisitorEvent: Model<VisitorEventDocument> =
  mongoose.models.VisitorEvent ||
  mongoose.model<VisitorEventDocument>("VisitorEvent", VisitorEventSchema);
