export { readEmbedConfig, normalizeEmbedConfig, validateEmbedConfig } from "./config";
export { validateAndInitWidget } from "./api";
export { normalizeWidgetSettings } from "./normalize";
export { mountEmbedWidget, unmountEmbedWidget, getMountedEmbedWidget } from "./bootstrap";
export { EmbedWidgetRoot } from "./widget-root";

export type {
  AssistrioChatGlobal,
  EmbedChatConfig,
  EmbedPosition,
  EmbedRuntimeState,
  LauncherPosition,
  NormalizedWidgetSettings,
  WidgetInitRequest,
  WidgetInitResponse,
  WidgetInitStatus,
  WidgetMode,
  WidgetPreviewOverrides,
  WidgetStrings,
} from "./types";

export { mergeWidgetStrings, DEFAULT_WIDGET_STRINGS_EN } from "./lib/widgetStrings";
export type { WidgetLocale } from "./lib/widgetStrings";

export type { EmbedWidgetRootProps } from "./widget-root";

export {
  QUICK_LINK_ICON_IDS,
  getQuickLinkIcon,
  isQuickLinkIconId,
} from "./lib/quickLinkIcons";
export type { QuickLinkIconId } from "./lib/quickLinkIcons";
