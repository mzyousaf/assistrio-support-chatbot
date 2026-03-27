import type { BotChatUI } from "@/models/Bot";

export type EmbedPosition = "left" | "right";

export type LauncherPosition = "bottom-left" | "bottom-right";

export type WidgetInitStatus = "ok" | "error";

export type EmbedChatConfig = {
  botId: string;
  apiBaseUrl: string;
  mode?: "runtime" | "preview";
  accessKey?: string;
  secretKey?: string;
  /**
   * Platform visitor identity (platformVisitorId).
   * Used for trial quota enforcement + preview authorization.
   */
  platformVisitorId?: string;
  /**
   * Optional chat visitor identity (chatVisitorId).
   * The widget will load/create it from localStorage when omitted.
   */
  chatVisitorId?: string;
  authToken?: string;
  previewOverrides?: {
    botName?: string;
    avatarUrl?: string;
    avatarEmoji?: string;
    tagline?: string;
    description?: string;
    welcomeMessage?: string;
    suggestedQuestions?: string[];
    brandingMessage?: string;
    privacyText?: string;
    launcherPosition?: "bottom-left" | "bottom-right";
    chatUI?: Partial<BotChatUI>;
  };
  widgetInitPath?: string;
  chatPostPath?: string;
  disableRemoteConfig?: boolean;
  position?: EmbedPosition;
};

export interface WidgetInitRequest {
  botId: string;
  accessKey?: string;
}

/**
 * Minimal contract for widget boot data. Keep fields optional
 * so backend can evolve without forcing broad refactors.
 */
export interface WidgetInitResponse {
  status?: WidgetInitStatus;
  error?: string;
  errorCode?: string;
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

/**
 * Runtime-ready settings normalized for existing chat and launcher components.
 */
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

/** Global API attached to `window.AssistrioChat` by the browser bundle (`browser.ts`). */
export type AssistrioChatGlobal = {
  mount: (config?: Partial<EmbedChatConfig>) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

