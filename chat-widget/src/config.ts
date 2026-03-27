import type { EmbedChatConfig, EmbedPosition, WidgetMode } from "./types";

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

function normalizeMode(value: unknown): WidgetMode | undefined {
  if (value === "runtime" || value === "preview") return value;
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
    mode: normalizeMode(cfg.mode),
    accessKey: toNonEmptyString(cfg.accessKey),
    secretKey: toNonEmptyString(cfg.secretKey),
    platformVisitorId: toNonEmptyString(cfg.platformVisitorId),
    chatVisitorId: toNonEmptyString(cfg.chatVisitorId),
    authToken: toNonEmptyString(cfg.authToken),
    position: normalizePosition(cfg.position),
    previewOverrides:
      cfg.previewOverrides && typeof cfg.previewOverrides === "object"
        ? (cfg.previewOverrides as EmbedChatConfig["previewOverrides"])
        : undefined,
    disableRemoteConfig:
      typeof cfg.disableRemoteConfig === "boolean" ? cfg.disableRemoteConfig : undefined,
    ...(typeof cfg.sessionPreview === "boolean" ? { sessionPreview: cfg.sessionPreview } : {}),
    ...(typeof cfg.persistChatSession === "boolean" ? { persistChatSession: cfg.persistChatSession } : {}),
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
    mode: normalizeMode(input.mode) ?? "runtime",
    accessKey: toNonEmptyString(input.accessKey),
    secretKey: toNonEmptyString(input.secretKey),
    widgetInitPath: toNonEmptyString(input.widgetInitPath),
    chatPostPath: toNonEmptyString(input.chatPostPath),
    platformVisitorId: toNonEmptyString(input.platformVisitorId),
    chatVisitorId: toNonEmptyString(input.chatVisitorId),
    authToken: toNonEmptyString(input.authToken),
    sessionPreview: input.sessionPreview === true,
    persistChatSession:
      typeof input.persistChatSession === "boolean"
        ? input.persistChatSession
        : !toNonEmptyString(input.authToken) && input.sessionPreview !== true,
    position: normalizePosition(input.position),
    previewOverrides: input.previewOverrides,
    disableRemoteConfig:
      typeof input.disableRemoteConfig === "boolean" ? input.disableRemoteConfig : undefined,
  };
}

export function readEmbedConfig(input: unknown): EmbedChatConfig {
  const parsed = parseObjectConfig(input);
  return normalizeEmbedConfig(parsed);
}
