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
      name: toNonEmptyString(overrides.botName) ?? (typeof bot.name === "string" ? bot.name : ""),
      imageUrl: toNonEmptyString(overrides.avatarUrl) ?? bot.imageUrl,
      avatarEmoji: toNonEmptyString(overrides.avatarEmoji) ?? bot.avatarEmoji,
      tagline: toNonEmptyString(overrides.tagline) ?? bot.tagline,
      description: toNonEmptyString(overrides.description) ?? bot.description,
      welcomeMessage: toNonEmptyString(overrides.welcomeMessage) ?? bot.welcomeMessage,
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
