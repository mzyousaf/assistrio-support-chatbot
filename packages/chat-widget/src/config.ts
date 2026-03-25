import type { EmbedChatConfig, EmbedPosition } from "./types";

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > 0 ? v : undefined;
}

function normalizeApiBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

function normalizePosition(value: unknown): EmbedPosition | undefined {
  if (value === "left" || value === "right") return value;
  return undefined;
}

function parseObjectConfig(input: unknown): Partial<EmbedChatConfig> {
  if (!input || typeof input !== "object") return {};
  const cfg = input as Record<string, unknown>;
  const widgetInitPath = toNonEmptyString(cfg.widgetInitPath);
  const chatPostPath = toNonEmptyString(cfg.chatPostPath);
  return {
    botId: toNonEmptyString(cfg.botId),
    apiBaseUrl: toNonEmptyString(cfg.apiBaseUrl),
    accessKey: toNonEmptyString(cfg.accessKey),
    position: normalizePosition(cfg.position),
    ...(widgetInitPath ? { widgetInitPath } : {}),
    ...(chatPostPath ? { chatPostPath } : {}),
  };
}

export function validateEmbedConfig(input: Partial<EmbedChatConfig>): asserts input is EmbedChatConfig {
  const botId = toNonEmptyString(input.botId);
  const apiBaseUrl = toNonEmptyString(input.apiBaseUrl);
  const position = normalizePosition(input.position);

  if (!botId) {
    throw new Error("Embed config is invalid: botId is required.");
  }
  if (!apiBaseUrl) {
    throw new Error("Embed config is invalid: apiBaseUrl is required.");
  }
  if (input.position != null && !position) {
    throw new Error('Embed config is invalid: position must be "left" or "right".');
  }
}

export function normalizeEmbedConfig(input: Partial<EmbedChatConfig>): EmbedChatConfig {
  validateEmbedConfig(input);
  return {
    botId: input.botId.trim(),
    apiBaseUrl: normalizeApiBaseUrl(input.apiBaseUrl.trim()),
    accessKey: toNonEmptyString(input.accessKey),
    position: normalizePosition(input.position),
  };
}

export function readEmbedConfig(input: unknown): EmbedChatConfig {
  const parsed = parseObjectConfig(input);
  return normalizeEmbedConfig(parsed);
}
