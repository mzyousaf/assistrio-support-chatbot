import { normalizeChatOpenAnimation } from "./lib/chatOpenAnimationNormalize";
import { normalizeLauncherIcon } from "./lib/launcherIconNormalize";
import { normalizeLauncherWhenOpen } from "./lib/launcherWhenOpenNormalize";
import type { BotChatUI } from "./models/botChatUI";
import type {
  EmbedChatConfig,
  LauncherPosition,
  NormalizedWidgetSettings,
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
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
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

  return {
    botId: config.botId,
    botName,
    avatarUrl: response.bot?.imageUrl,
    avatarEmoji: response.bot?.avatarEmoji,
    tagline: response.bot?.tagline,
    description: response.bot?.description,
    welcomeMessage: response.bot?.welcomeMessage,
    suggestedQuestions: normalizeSuggestedQuestions(response),
    chatUI: {
      ...chatUI,
      launcherPosition,
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
