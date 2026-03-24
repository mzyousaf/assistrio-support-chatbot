import type { BotChatUI } from "./models/botChatUI";

export type EmbedPosition = "left" | "right";

export type LauncherPosition = "bottom-left" | "bottom-right";

export type WidgetInitStatus = "ok" | "error";

export type EmbedChatConfig = {
  botId: string;
  apiBaseUrl: string;
  accessKey?: string;
  position?: EmbedPosition;
};

export interface WidgetInitRequest {
  botId: string;
  accessKey?: string;
}

export interface WidgetInitResponse {
  status?: WidgetInitStatus;
  error?: string;
  bot?: {
    id?: string;
    name?: string;
    imageUrl?: string;
    avatarEmoji?: string;
    tagline?: string;
    description?: string;
    welcomeMessage?: string;
    suggestedQuestions?: string[];
    exampleQuestions?: string[];
  };
  settings?: {
    chatUI?: BotChatUI;
    brandingMessage?: string;
    privacyText?: string;
  };
}

export interface NormalizedWidgetSettings {
  botId: string;
  botName: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  tagline?: string;
  description?: string;
  welcomeMessage?: string;
  suggestedQuestions: string[];
  chatUI: BotChatUI;
  launcherPosition: LauncherPosition;
  brandingMessage?: string;
  privacyText?: string;
}

export interface EmbedRuntimeState {
  config: Required<Pick<EmbedChatConfig, "botId" | "apiBaseUrl">> &
    Pick<EmbedChatConfig, "accessKey" | "position">;
  initResponse: WidgetInitResponse;
  settings: NormalizedWidgetSettings;
}

export type AssistrioChatGlobal = {
  mount: (config?: Partial<EmbedChatConfig>) => void;
  unmount: () => void;
  isMounted: () => boolean;
};
