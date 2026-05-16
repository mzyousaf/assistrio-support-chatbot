import { normalizeChatOpenAnimation } from "./lib/chatOpenAnimationNormalize";
import { normalizeLauncherIcon } from "./lib/launcherIconNormalize";
import { normalizeLauncherWhenOpen } from "./lib/launcherWhenOpenNormalize";
import type { BotChatUI } from "./models/botChatUI";
import type {
  EmbedChatConfig,
  LauncherPosition,
  NormalizedWidgetSettings,
  SuggestedQuestionChip,
  WidgetInitResponse,
} from "./types";

const DEFAULT_BOT_NAME = "Assistant";
const DEFAULT_PRIMARY_COLOR = "#14B8A6";

/** Minimum 2 saved threads when capped (current chat + at least one other). */
function normalizeVisitorMultiChatMax(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(2, n);
}

function normalizeSuggestedQuestions(response: WidgetInitResponse): string[] {
  const source = response.bot?.suggestedQuestions ?? response.bot?.exampleQuestions ?? [];
  if (!Array.isArray(source)) return [];
  return source
    .map((q) => {
      if (typeof q === "string") return q.trim();
      if (q && typeof q === "object" && typeof (q as { label?: string }).label === "string") {
        return (q as { label: string }).label.trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeSuggestedQuestionChips(response: WidgetInitResponse): SuggestedQuestionChip[] | undefined {
  const raw = response.bot?.suggestedQuestionChips;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SuggestedQuestionChip[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const label = typeof (c as { label?: string }).label === "string" ? (c as { label: string }).label.trim() : "";
    if (!label) continue;
    const sidRaw = (c as { suggestionId?: string }).suggestionId;
    const suggestionId = typeof sidRaw === "string" && sidRaw.trim() ? sidRaw.trim() : undefined;
    const hideRaw = (c as { hideChipTextInChat?: unknown }).hideChipTextInChat;
    const hideChipTextInChat = hideRaw === true ? true : undefined;
    out.push({
      label,
      ...(suggestionId ? { suggestionId } : {}),
      ...(hideChipTextInChat ? { hideChipTextInChat: true } : {}),
    });
    if (out.length >= 6) break;
  }
  return out.length > 0 ? out : undefined;
}

function normalizeChatUI(response: WidgetInitResponse): BotChatUI {
  const chatUI = response.settings?.chatUI ?? {};
  const primaryColor =
    typeof chatUI.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor)
      ? chatUI.primaryColor
      : DEFAULT_PRIMARY_COLOR;

  return {
    ...chatUI,
    primaryColor,
    launcherIcon: normalizeLauncherIcon(chatUI.launcherIcon),
    launcherWhenOpen: normalizeLauncherWhenOpen(chatUI.launcherWhenOpen),
    chatOpenAnimation: normalizeChatOpenAnimation(chatUI.chatOpenAnimation),
    showPrivacyText: chatUI.showPrivacyText !== false,
  };
}

function mapConfigPositionToLauncherPosition(position?: EmbedChatConfig["position"]): LauncherPosition | undefined {
  if (position === "left") return "bottom-left";
  if (position === "right") return "bottom-right";
  return undefined;
}

function resolveLauncherPosition(chatUI: BotChatUI, config: EmbedChatConfig): LauncherPosition {
  if (chatUI.launcherPosition === "bottom-left" || chatUI.launcherPosition === "bottom-right") {
    return chatUI.launcherPosition;
  }
  return mapConfigPositionToLauncherPosition(config.position) ?? "bottom-right";
}

export function normalizeWidgetSettings(
  response: WidgetInitResponse,
  config: EmbedChatConfig
): NormalizedWidgetSettings {
  const chatUI = normalizeChatUI(response);
  const launcherPosition = resolveLauncherPosition(chatUI, config);
  const botName = (response.bot?.name ?? "").trim() || DEFAULT_BOT_NAME;

  const settings = response.settings as
    | {
        visitorMultiChatEnabled?: boolean;
        visitorMultiChatMax?: number | null;
      }
    | undefined;
  const visitorMultiChatMax = normalizeVisitorMultiChatMax(settings?.visitorMultiChatMax);

  const isPreview = config.mode === "preview";

  return {
    botId: config.botId,
    botName,
    avatarUrl: response.bot?.imageUrl,
    avatarEmoji: response.bot?.avatarEmoji,
    tagline: response.bot?.tagline,
    description: response.bot?.description,
    welcomeMessage:
      response.bot?.welcomeMessageEnabled === false ? undefined : response.bot?.welcomeMessage,
    suggestedQuestions: normalizeSuggestedQuestions(response),
    suggestedQuestionChips: normalizeSuggestedQuestionChips(response),
    chatUI: {
      ...chatUI,
      launcherPosition,
      /** Live embed never exposes citation sources; preview may when `showSources` is enabled in workspace. */
      ...(!isPreview ? { showSources: false } : {}),
    },
    launcherPosition,
    brandingMessage: response.settings?.brandingMessage ?? chatUI.brandingMessage,
    privacyText:
      response.settings?.privacyText ??
      (typeof (chatUI as { privacyText?: string }).privacyText === "string"
        ? (chatUI as { privacyText: string }).privacyText.trim() || undefined
        : undefined),
    visitorMultiChatEnabled: settings?.visitorMultiChatEnabled === true,
    visitorMultiChatMax,
  };
}
