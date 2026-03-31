import type { BotChatUI } from "./models/botChatUI";
import type { WidgetStrings } from "./lib/widgetStrings";

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
  /**
   * Override for embed origin checks (defaults to `window.location.origin` in the browser on runtime).
   */
  embedOrigin?: string;
  authToken?: string;
  /**
   * Preview mode: authenticate with the same `user_token` HttpOnly cookie as private APIs
   * (`fetch` with `credentials: "include"` to the API origin). Omits keys and `chatVisitorId`
   * from init; do not set `authToken` in the JSON body.
   */
  sessionPreview?: boolean;
  /**
   * When false, `chatVisitorId` is not loaded from or saved to `localStorage`.
   * Defaults to false when `authToken` or `sessionPreview` is set, true otherwise.
   */
  persistChatSession?: boolean;
  position?: EmbedPosition;
  previewOverrides?: WidgetPreviewOverrides;
  disableRemoteConfig?: boolean;
  /**
   * BCP 47-ish locale hint (default `"en"`). Reserved for future translations; strings still merge from `widgetStrings`.
   */
  locale?: string;
  /** Override default English labels for embed shell + chat UI. */
  widgetStrings?: Partial<WidgetStrings>;
};

export type { WidgetStrings };

export interface WidgetInitRequest {
  botId: string;
  mode?: WidgetMode;
  accessKey?: string;
  secretKey?: string;
  /** Page origin (e.g. https://www.example.com). Sent on runtime init when the embedding site is known. */
  embedOrigin?: string;
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
  embedOrigin?: string;
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
    /** Owner allows multiple saved threads per site visitor */
    visitorMultiChatEnabled?: boolean;
    /** Max threads when enabled; null = unlimited */
    visitorMultiChatMax?: number | null;
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
  visitorMultiChatEnabled: boolean;
  visitorMultiChatMax: number | null;
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
  /** When set, overrides `settings` from preview/init so the editor matches unsaved access toggles. */
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
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
