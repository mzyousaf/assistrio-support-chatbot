import mongoose, { HydratedDocument, Model, Schema } from "mongoose";

export interface Visitor {
  visitorId: string;
  name?: string;
  email?: string;
  phone?: string;
  limitOverrideMessages?: number;
  showcaseMessageCount: number;
  ownBotMessageCount: number;
  createdAt: Date;
  lastSeenAt: Date;
}

export type VisitorDocument = HydratedDocument<Visitor>;

const VisitorSchema = new Schema<Visitor>(
  {
    visitorId: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    limitOverrideMessages: { type: Number },
    showcaseMessageCount: { type: Number, default: 0 },
    ownBotMessageCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

VisitorSchema.index({ visitorId: 1 });

export const Visitor =
  (mongoose.models.Visitor as Model<Visitor>) ||
  mongoose.model<Visitor>("Visitor", VisitorSchema);
