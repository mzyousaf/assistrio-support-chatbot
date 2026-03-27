import type { BotChatUI } from "./models/botChatUI";

export type EmbedPosition = "left" | "right";
export type WidgetMode = "runtime" | "preview";

export type LauncherPosition = "bottom-left" | "bottom-right";

export type WidgetInitStatus = "ok" | "error";

export type EmbedChatConfig = {
  botId: string;
  apiBaseUrl: string;
  mode?: WidgetMode;
  accessKey?: string;
  secretKey?: string;
  /**
   * Optional endpoint override for widget init.
   * Useful when the host app proxies widget endpoints (e.g. same-origin preview routes).
   */
  widgetInitPath?: string;
  /**
   * Optional endpoint override for chat posting.
   * Useful when the host app proxies widget endpoints (e.g. same-origin preview routes).
   */
  chatPostPath?: string;
  /**
   * Platform visitor identity (platformVisitorId).
   * Used for trial quota enforcement + preview authorization.
   */
  platformVisitorId?: string;

  /**
   * Optional chat visitor identity (chatVisitorId).
   * Usually omitted by callers; the widget will load/create it from localStorage.
   */
  chatVisitorId?: string;
  authToken?: string;
  /**
   * When false, `chatVisitorId` is not loaded from or saved to `localStorage`.
   * Defaults to false when `authToken` is set (authenticated sessions), true otherwise.
   */
  persistChatSession?: boolean;
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

export interface WidgetChatRequest {
  botId: string;
  message: string;
  mode?: WidgetMode;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId: string;
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

export interface WidgetPreviewOverrides {
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
