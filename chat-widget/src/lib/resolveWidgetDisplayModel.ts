import { mergePreviewInitResponse } from "./preview-display-merge";
import { normalizeWidgetSettings } from "../normalize";
import type { EmbedChatConfig, NormalizedWidgetSettings, WidgetInitResponse } from "../types";

/**
 * Single place that turns init response + embed config into normalized widget display settings.
 * Preview mode merges `config.previewOverrides` here (same merge as server-side preview display).
 * Runtime uses init as-is. Both paths then share `normalizeWidgetSettings`.
 */
export function resolveWidgetDisplayModel(
  initResponse: WidgetInitResponse | null,
  config: EmbedChatConfig,
): NormalizedWidgetSettings | null {
  if (!initResponse) return null;
  if (config.mode === "runtime") {
    return normalizeWidgetSettings(initResponse, config);
  }
  const merged = mergePreviewInitResponse(initResponse, config.previewOverrides);
  return normalizeWidgetSettings(merged, config);
}
