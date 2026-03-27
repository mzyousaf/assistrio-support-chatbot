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
} from "./types";

export type { EmbedWidgetRootProps } from "./widget-root";

/** Browser/IIFE entry for host pages: `src/embed/browser.ts` → `npm run build:embed:js` → `dist/embed/assistrio-chat.js`. */

