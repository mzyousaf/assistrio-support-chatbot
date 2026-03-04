import mongoose, { Model, Schema } from "mongoose";

export interface BotFaq {
  question: string;
  answer: string;
}

export interface BotPersonality {
  name?: string;
  description?: string;
  systemPrompt?: string;
  tone?: "friendly" | "formal" | "playful" | "technical";
  language?: string;
}

export interface BotConfig {
  temperature?: number;
  maxTokens?: number;
  responseLength?: "short" | "medium" | "long";
}

export type LeadFieldType = "text" | "email" | "phone" | "number" | "url";

export interface BotLeadField {
  key: string;
  label: string;
  type: LeadFieldType;
  required?: boolean;
}

export interface BotLeadCaptureV2 {
  enabled?: boolean;
  fields?: BotLeadField[];
}

export interface BotLeadCaptureLegacy {
  collectName?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
}

export type ChatBackgroundStyle = "auto" | "light" | "dark";
export type ChatBubbleStyle = "rounded" | "squared";
export type ChatLauncherPosition = "bottom-right" | "bottom-left";
export type ChatFont = "system" | "inter" | "poppins";
export type ChatAvatarStyle = "emoji" | "image" | "none";

export interface BotChatUI {
  primaryColor?: string;
  backgroundStyle?: ChatBackgroundStyle;
  bubbleStyle?: ChatBubbleStyle;
  avatarStyle?: ChatAvatarStyle;
  launcherPosition?: ChatLauncherPosition;
  font?: ChatFont;
  showBranding?: boolean;
}

export interface BotDocument {
  name: string;
  slug: string;
  type: "showcase" | "visitor-own";
  ownerVisitorId?: string;
  isPublic: boolean;
  shortDescription?: string;
  category?: string;
  categories?: string[];
  avatarEmoji?: string;
  imageUrl?: string;
  openaiApiKeyOverride?: string;
  clientDraftId?: string;
  status?: "draft" | "published";
  welcomeMessage?: string;
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  description?: string;
  knowledgeDescription?: string;
  faqs?: BotFaq[];
  personality?: BotPersonality;
  config?: BotConfig;
  createdAt: Date;
}

const BotSchema = new Schema<BotDocument>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  type: { type: String, required: true, enum: ["showcase", "visitor-own"] },
  ownerVisitorId: { type: String },
  isPublic: { type: Boolean, default: false },
  shortDescription: { type: String },
  category: { type: String },
  categories: { type: [String], default: [] },
  avatarEmoji: { type: String },
  imageUrl: { type: String },
  openaiApiKeyOverride: { type: String },
  clientDraftId: { type: String },
  status: {
    type: String,
    enum: ["draft", "published"],
    default: "draft",
    index: true,
  },
  welcomeMessage: { type: String },
  leadCapture: {
    enabled: { type: Boolean, default: false },
    fields: {
      type: [
        new Schema(
          {
            key: { type: String, required: true },
            label: { type: String, required: true },
            type: {
              type: String,
              enum: ["text", "email", "phone", "number", "url"],
              default: "text",
            },
            required: { type: Boolean, default: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    collectName: { type: Boolean },
    collectEmail: { type: Boolean },
    collectPhone: { type: Boolean },
  },
  chatUI: {
    primaryColor: { type: String, default: "#14B8A6" },
    backgroundStyle: {
      type: String,
      enum: ["auto", "light", "dark"],
      default: "light",
    },
    bubbleStyle: {
      type: String,
      enum: ["rounded", "squared"],
      default: "rounded",
    },
    avatarStyle: {
      type: String,
      enum: ["emoji", "image", "none"],
      default: "emoji",
    },
    launcherPosition: {
      type: String,
      enum: ["bottom-right", "bottom-left"],
      default: "bottom-right",
    },
    font: {
      type: String,
      enum: ["system", "inter", "poppins"],
      default: "inter",
    },
    showBranding: { type: Boolean, default: true },
  },
  description: { type: String },
  knowledgeDescription: { type: String },
  faqs: [
    {
      question: { type: String, required: true },
      answer: { type: String, required: true },
    },
  ],
  personality: {
    name: { type: String },
    description: { type: String },
    systemPrompt: { type: String },
    tone: {
      type: String,
      enum: ["friendly", "formal", "playful", "technical"],
    },
    language: { type: String },
  },
  config: {
    temperature: { type: Number, min: 0, max: 1 },
    maxTokens: { type: Number },
    responseLength: {
      type: String,
      enum: ["short", "medium", "long"],
    },
  },
  createdAt: { type: Date, default: Date.now },
});

BotSchema.index(
  { clientDraftId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "draft",
      type: "showcase",
      clientDraftId: { $type: "string" },
    },
  },
);

export const Bot =
  (mongoose.models.Bot as Model<BotDocument>) ||
  mongoose.model<BotDocument>("Bot", BotSchema);
