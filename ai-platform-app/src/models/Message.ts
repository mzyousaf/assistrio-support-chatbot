import mongoose, { HydratedDocument, Model, Schema, Types } from "mongoose";

export interface Message {
  conversationId: Types.ObjectId;
  botId: Types.ObjectId;
  visitorId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export type MessageDocument = HydratedDocument<Message>;

const MessageSchema = new Schema<Message>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
  visitorId: { type: String, required: true },
  role: { type: String, required: true, enum: ["user", "assistant"] },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Message =
  (mongoose.models.Message as Model<Message>) ||
  mongoose.model<Message>("Message", MessageSchema);
