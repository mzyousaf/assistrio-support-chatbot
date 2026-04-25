import { normalizeLauncherIcon } from "./launcherIconNormalize";
import type { WidgetInitResponse, WidgetPreviewOverrides } from "../types";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergePlainRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val === undefined) continue;
    const prev = out[key];
    if (isPlainRecord(prev) && isPlainRecord(val)) {
      out[key] = mergePlainRecords(prev, val);
      continue;
    }
    out[key] = val;
  }
  return out;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s ? s : undefined;
}

function hasOwnOverride(overrides: WidgetPreviewOverrides, key: keyof WidgetPreviewOverrides): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, key);
}

/** When the key is present on overrides, use trimmed string or `undefined` (clears). Otherwise inherit from init bot. */
function pickOptionalStringField(
  overrides: WidgetPreviewOverrides,
  key: "botName" | "avatarUrl" | "avatarEmoji" | "tagline" | "description",
  inherit: unknown,
): unknown {
  if (!hasOwnOverride(overrides, key)) return inherit;
  const v = overrides[key];
  if (typeof v !== "string") return inherit;
  return v.trim() || undefined;
}

function suggestedQuestionsFromResponse(response: WidgetInitResponse): string[] {
  const source = response.bot?.suggestedQuestions ?? response.bot?.exampleQuestions ?? [];
  if (!Array.isArray(source)) return [];
  return source
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Applies preview overrides to a baseline init response (from `/preview/init` **without**
 * `previewOverrides` in the body). Mirrors `buildInitResponse` in
 * `ai-platform-backend/.../widget-preview.controller.ts` for display-only updates.
 */
export function mergePreviewInitResponse(
  base: WidgetInitResponse,
  overrides: WidgetPreviewOverrides | undefined,
): WidgetInitResponse {
  if (!overrides) return base;

  const baseChatUI = isPlainRecord(base.settings?.chatUI) ? base.settings!.chatUI : {};
  const mergedChatUI = overrides.chatUI
    ? mergePlainRecords(baseChatUI, overrides.chatUI as Record<string, unknown>)
    : baseChatUI;
  if (overrides.launcherPosition) {
    mergedChatUI.launcherPosition = overrides.launcherPosition;
  }
  mergedChatUI.launcherIcon = normalizeLauncherIcon(mergedChatUI.launcherIcon);
  if (mergedChatUI.launcherIcon === "bot-avatar") {
    delete mergedChatUI.launcherAvatarUrl;
  }

  const savedSuggestedQuestions = suggestedQuestionsFromResponse(base);
  const suggestedQuestions = Array.isArray(overrides.suggestedQuestions)
    ? overrides.suggestedQuestions
    : savedSuggestedQuestions;

  const brandingMessage =
    toNonEmptyString(overrides.brandingMessage) ??
    toNonEmptyString(mergedChatUI.brandingMessage);
  const privacyText =
    toNonEmptyString(overrides.privacyText) ??
    toNonEmptyString(
      isPlainRecord(overrides.chatUI)
        ? (overrides.chatUI as { privacyText?: unknown }).privacyText
        : undefined,
    );

  const bot = base.bot ?? {};
  const welcomeEnabled = hasOwnOverride(overrides, "welcomeMessageEnabled")
    ? overrides.welcomeMessageEnabled !== false
    : bot.welcomeMessageEnabled !== false;
  const welcomeText = hasOwnOverride(overrides, "welcomeMessage")
    ? typeof overrides.welcomeMessage === "string"
      ? overrides.welcomeMessage.trim() || undefined
      : undefined
    : typeof bot.welcomeMessage === "string"
      ? bot.welcomeMessage.trim() || undefined
      : undefined;
  const showWelcome = welcomeEnabled && Boolean(welcomeText);

  const visitorMultiFromOverrides =
    overrides.visitorMultiChatEnabled !== undefined
      ? {
          visitorMultiChatEnabled: overrides.visitorMultiChatEnabled === true,
          visitorMultiChatMax:
            overrides.visitorMultiChatEnabled === true
              ? overrides.visitorMultiChatMax === null || overrides.visitorMultiChatMax === undefined
                ? null
                : typeof overrides.visitorMultiChatMax === "number" && Number.isFinite(overrides.visitorMultiChatMax)
                  ? (() => {
                      const n = Math.floor(overrides.visitorMultiChatMax as number);
                      if (n <= 0) return null;
                      return Math.max(2, n);
                    })()
                  : null
              : null,
        }
      : null;

  return {
    ...base,
    bot: {
      ...bot,
      name: hasOwnOverride(overrides, "botName")
        ? (toNonEmptyString(overrides.botName) ?? "")
        : typeof bot.name === "string"
          ? bot.name
          : "",
      imageUrl: pickOptionalStringField(overrides, "avatarUrl", bot.imageUrl) as typeof bot.imageUrl,
      avatarEmoji: pickOptionalStringField(overrides, "avatarEmoji", bot.avatarEmoji) as typeof bot.avatarEmoji,
      tagline: pickOptionalStringField(overrides, "tagline", bot.tagline) as typeof bot.tagline,
      description: pickOptionalStringField(overrides, "description", bot.description) as typeof bot.description,
      welcomeMessage: showWelcome ? welcomeText : undefined,
      welcomeMessageEnabled: welcomeEnabled,
      suggestedQuestions,
      exampleQuestions: suggestedQuestions,
    },
    settings: {
      ...base.settings,
      chatUI: mergedChatUI,
      ...(brandingMessage ? { brandingMessage } : {}),
      ...(privacyText ? { privacyText } : {}),
      ...(visitorMultiFromOverrides ?? {}),
    },
  };
}
