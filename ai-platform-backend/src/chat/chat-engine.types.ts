export type ChatMode = 'demo' | 'trial' | 'super_admin';

export interface BotLike {
  _id: { toString(): string };
  openaiApiKeyOverride?: string;
  welcomeMessage?: string;
  personality?: {
    tone?: 'friendly' | 'formal' | 'playful' | 'technical';
    language?: string;
    systemPrompt?: string;
    thingsToAvoid?: string;
  };
  config?: {
    temperature?: number;
    maxTokens?: number;
    responseLength?: 'short' | 'medium' | 'long';
  };
  faqs?: Array<{ question: string; answer: string }>;
}

export interface RunChatInput {
  bot: BotLike;
  visitorId: string;
  message: string;
  mode: ChatMode;
  userApiKey?: string;
}

export interface ChatSource {
  chunkId: string;
  docId: string;
  docTitle: string;
  preview: string;
  score?: number;
}

export type RunChatResult =
  | {
      ok: true;
      conversationId: string;
      assistantMessage: string;
      sources?: ChatSource[];
      isNewConversation: boolean;
    }
  | {
      ok: false;
      error: 'missing_openai_key';
    };
