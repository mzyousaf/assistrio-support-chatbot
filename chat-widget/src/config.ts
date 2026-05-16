import type {
  ContainedInlineSize,
  EmbedChatConfig,
  EmbedPosition,
  EmbedPresentation,
  WidgetMode,
  WidgetStrings,
} from "./types";


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

function normalizePresentation(value: unknown): EmbedPresentation | undefined {
  if (value === "contained") return "contained";
  if (value === "floating") return "floating";
  return undefined;
}

function parseContainedInlineSize(value: unknown): ContainedInlineSize | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  const n = (k: string): number | undefined => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;
  };
  const collapsedWidth = n("collapsedWidth");
  const collapsedHeight = n("collapsedHeight");
  const expandedWidth = n("expandedWidth");
  const expandedHeight =
    typeof o.expandedHeight === "string" && o.expandedHeight.trim()
      ? o.expandedHeight.trim()
      : typeof o.expandedHeight === "number" && Number.isFinite(o.expandedHeight)
        ? Math.round(o.expandedHeight)
        : undefined;
  if (
    collapsedWidth == null &&
    collapsedHeight == null &&
    expandedWidth == null &&
    expandedHeight === undefined
  ) {
    return undefined;
  }
  return { collapsedWidth, collapsedHeight, expandedWidth, expandedHeight };
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
    /** Chat thread identity; stored locally when `persistChatSession` allows. */
    chatVisitorId: toNonEmptyString(cfg.chatVisitorId),
    authToken: toNonEmptyString(cfg.authToken),
    position: normalizePosition(cfg.position),
    ...((): { presentation?: EmbedPresentation } => {
      const presentation = normalizePresentation(cfg.presentation);
      return presentation ? { presentation } : {};
    })(),
    previewOverrides:
      cfg.previewOverrides && typeof cfg.previewOverrides === "object"
        ? (cfg.previewOverrides as EmbedChatConfig["previewOverrides"])
        : undefined,
    disableRemoteConfig:
      typeof cfg.disableRemoteConfig === "boolean" ? cfg.disableRemoteConfig : undefined,
    ...(typeof cfg.sessionPreview === "boolean" ? { sessionPreview: cfg.sessionPreview } : {}),
    ...(typeof cfg.persistChatSession === "boolean" ? { persistChatSession: cfg.persistChatSession } : {}),
    ...((): { embedOrigin?: string } => {
      const embedOrigin = toNonEmptyString(cfg.embedOrigin);
      return embedOrigin ? { embedOrigin } : {};
    })(),
    ...(widgetInitPath ? { widgetInitPath } : {}),
    ...(chatPostPath ? { chatPostPath } : {}),
    ...(toNonEmptyString(cfg.locale) ? { locale: toNonEmptyString(cfg.locale) } : {}),
    ...(toNonEmptyString(cfg.previewSourcePage)
      ? { previewSourcePage: toNonEmptyString(cfg.previewSourcePage) }
      : {}),
    ...(toNonEmptyString(cfg.previewVisitorScope)
      ? { previewVisitorScope: toNonEmptyString(cfg.previewVisitorScope) }
      : {}),
    ...(cfg.widgetStrings && typeof cfg.widgetStrings === "object"
      ? { widgetStrings: cfg.widgetStrings as Partial<WidgetStrings> }
      : {}),
    ...((): { containedInlineSize?: ContainedInlineSize } => {
      const containedInlineSize = parseContainedInlineSize(cfg.containedInlineSize);
      return containedInlineSize ? { containedInlineSize } : {};
    })(),
    ...(typeof cfg.showContainedLauncherPreview === "boolean"
      ? { showContainedLauncherPreview: cfg.showContainedLauncherPreview }
      : {}),
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
    chatVisitorId: toNonEmptyString(input.chatVisitorId),
    authToken: toNonEmptyString(input.authToken),
    sessionPreview: input.sessionPreview === true,
    persistChatSession:
      typeof input.persistChatSession === "boolean"
        ? input.persistChatSession
        : !toNonEmptyString(input.authToken) && input.sessionPreview !== true,
    position: normalizePosition(input.position),
    presentation: normalizePresentation(input.presentation) ?? "floating",
    containedInlineSize: input.containedInlineSize,
    showContainedLauncherPreview: input.showContainedLauncherPreview === true,
    onContainedPanelExpandChange:
      typeof input.onContainedPanelExpandChange === "function" ? input.onContainedPanelExpandChange : undefined,
    previewOverrides: input.previewOverrides,
    disableRemoteConfig:
      typeof input.disableRemoteConfig === "boolean" ? input.disableRemoteConfig : undefined,
    embedOrigin: toNonEmptyString(input.embedOrigin),
    locale: toNonEmptyString(input.locale),
    previewSourcePage: toNonEmptyString(input.previewSourcePage),
    previewVisitorScope: toNonEmptyString(input.previewVisitorScope),
    widgetStrings: input.widgetStrings,
  };
}

export function readEmbedConfig(input: unknown): EmbedChatConfig {
  const parsed = parseObjectConfig(input);
  return normalizeEmbedConfig(parsed);
}
