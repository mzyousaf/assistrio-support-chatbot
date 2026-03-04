import mongoose, { HydratedDocument, Model, Schema, Types } from "mongoose";

export interface Conversation {
  botId: Types.ObjectId;
  visitorId: string;
  createdAt: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;

const ConversationSchema = new Schema<Conversation>({
  botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
  visitorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Conversation =
  (mongoose.models.Conversation as Model<Conversation>) ||
  mongoose.model<Conversation>("Conversation", ConversationSchema);
