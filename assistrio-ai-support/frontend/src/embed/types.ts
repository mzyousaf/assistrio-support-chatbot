import type { BotChatUI } from "@/models/Bot";

export type EmbedPosition = "left" | "right";
export type WidgetMode = "runtime" | "preview";
export type LauncherPosition = "bottom-left" | "bottom-right";
export type WidgetInitStatus = "ok" | "error";

export type WidgetPreviewOverrides = {
  botName?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  tagline?: string;
  description?: string;
  welcomeMessage?: string;
  suggestedQuestions?: string[];
  brandingMessage?: string;
  privacyText?: string;
  launcherPosition?: LauncherPosition;
  chatUI?: Partial<BotChatUI>;
};

export type EmbedChatConfig = {
  botId: string;
  apiBaseUrl: string;
  mode?: WidgetMode;
  accessKey?: string;
  secretKey?: string;
  widgetInitPath?: string;
  chatPostPath?: string;
  platformVisitorId?: string;
  chatVisitorId?: string;
  authToken?: string;
  position?: EmbedPosition;
  previewOverrides?: WidgetPreviewOverrides;
  disableRemoteConfig?: boolean;
};

export interface WidgetInitRequest {
  botId: string;
  mode?: WidgetMode;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  platformVisitorId?: string;
  authToken?: string;
  previewOverrides?: WidgetPreviewOverrides;
}

export interface WidgetInitResponse {
  status?: WidgetInitStatus;
  error?: string;
  errorCode?: string;
  chatVisitorId?: string;
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
