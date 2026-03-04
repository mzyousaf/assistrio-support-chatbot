import mongoose, { Document, Model, Schema } from "mongoose";

export interface RateLimitDocument extends Document {
  key: string; // e.g. "demo_chat:visitorId"
  windowStart: Date; // rounded to minute
  count: number; // number of requests in this window
}

const RateLimitSchema = new Schema<RateLimitDocument>({
  key: { type: String, required: true, index: true },
  windowStart: { type: Date, required: true, index: true },
  count: { type: Number, required: true, default: 0 },
});

RateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

export const RateLimit: Model<RateLimitDocument> =
  mongoose.models.RateLimit ||
  mongoose.model<RateLimitDocument>("RateLimit", RateLimitSchema);
