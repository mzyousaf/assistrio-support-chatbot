export { readEmbedConfig, normalizeEmbedConfig, validateEmbedConfig } from "./config";
export { validateAndInitWidget } from "./api";
export { normalizeWidgetSettings } from "./normalize";
export { mountEmbedWidget, unmountEmbedWidget, getMountedEmbedWidget } from "./bootstrap";
export { EmbedWidgetRoot } from "./widget-root";
export { AdminLiveChatAdapter } from "./components/AdminLiveChatAdapter";
export { ClampedTextWithSeeMore } from "./components/chat-ui/ClampedTextWithSeeMore";
export type { AdminLiveChatAdapterProps } from "./components/AdminLiveChatAdapter";
export type { ClampedTextWithSeeMoreProps } from "./components/chat-ui/ClampedTextWithSeeMore";

export type {
  AssistrioChatGlobal,
  ContainedInlineSize,
  EmbedChatConfig,
  EmbedPresentation,
  EmbedPosition,
  EmbedRuntimeState,
  LauncherPosition,
  NormalizedWidgetSettings,
  SuggestedQuestionChip,
  WidgetInitRequest,
  WidgetInitResponse,
  WidgetInitStatus,
  WidgetMode,
  WidgetPreviewOverrides,
  WidgetStrings,
} from "./types";

export {
  PANEL_COLLAPSED_HEIGHT_PX,
  PANEL_COLLAPSED_WIDTH_PX,
  PANEL_EXPANDED_HEIGHT_MAX_PX,
  PANEL_EXPANDED_WIDTH_PX,
} from "./lib/embedPanelConstraints";
export { resolveWidgetDisplayModel } from "./lib/resolveWidgetDisplayModel";
export { mergeWidgetStrings, DEFAULT_WIDGET_STRINGS_EN } from "./lib/widgetStrings";
export type { WidgetLocale } from "./lib/widgetStrings";

export type { EmbedWidgetRootProps } from "./widget-root";

export {
  QUICK_LINK_ICON_IDS,
  getQuickLinkIcon,
  isQuickLinkIconId,
} from "./lib/quickLinkIcons";
export type { QuickLinkIconId } from "./lib/quickLinkIcons";

export { createStablePreviewOverridesKey } from "./lib/stablePreviewOverridesKey";
export {
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_MESSAGE,
  AI_CREDITS_USAGE_UNAVAILABLE_CODE,
  AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE,
  resolveChatRuntimeErrorMessage,
} from "./lib/resolveChatRuntimeErrorMessage";
export type { ChatRuntimeErrorInput, ResolveChatRuntimeErrorOptions } from "./lib/resolveChatRuntimeErrorMessage";
