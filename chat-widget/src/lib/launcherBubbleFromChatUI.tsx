import type { ReactNode } from "react";
import { Bot, MessageCircle } from "lucide-react";

import { normalizeLauncherIcon } from "./launcherIconNormalize";
import { normalizeLauncherWhenOpen } from "./launcherWhenOpenNormalize";
import type { BotChatUI, ChatLauncherWhenOpen } from "../models/botChatUI";

/** Bot glyph: fallback for “Bot avatar” when no image/emoji, and for “Custom” when no custom URL is set. */
export function LauncherAvatarPlaceholder() {
  return (
    <span className="flex h-full w-full items-center justify-center text-white" aria-hidden>
      <Bot className="h-[55%] w-[55%] min-h-[18px] min-w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

/**
 * Maps Appearance launcher settings to `ChatLauncherBubble` props (floating embed only).
 * — default: chat icon with optional ring (launcherAvatarRingWidth); when open uses `launcherWhenOpen`.
 * — bot-avatar: bot profile image, else emoji, else bot placeholder.
 * — custom: custom URL if set; otherwise bot placeholder until a URL is added.
 */
export function launcherBubbleFromChatUI(
  chatUI: BotChatUI | undefined,
  avatarUrl?: string,
  avatarEmoji?: string,
): {
  size?: number;
  shadowIntensity?: "none" | "low" | "medium" | "high";
  avatar?: ReactNode;
  avatarWithBackground?: boolean;
  avatarRingWidth?: number;
  launcherWhenOpen: ChatLauncherWhenOpen;
} {
  const icon = normalizeLauncherIcon(chatUI?.launcherIcon);
  const launcherWhenOpen = normalizeLauncherWhenOpen(chatUI?.launcherWhenOpen);
  const size =
    typeof chatUI?.launcherSize === "number" && chatUI.launcherSize > 0
      ? Math.min(96, Math.max(32, Math.round(chatUI.launcherSize)))
      : undefined;
  const shadowIntensity =
    chatUI?.shadowIntensity === "none" ||
      chatUI?.shadowIntensity === "low" ||
      chatUI?.shadowIntensity === "medium" ||
      chatUI?.shadowIntensity === "high"
      ? chatUI.shadowIntensity
      : undefined;
  const ring =
    typeof chatUI?.launcherAvatarRingWidth === "number"
      ? Math.max(0, Math.min(30, chatUI.launcherAvatarRingWidth))
      : 18;

  if (icon === "bot-avatar") {
    const img = avatarUrl?.trim() ? (
      <img src={avatarUrl.trim()} alt="" className="h-full w-full object-cover rounded-full" />
    ) : avatarEmoji?.trim() ? (
      <span
        className="assistrio-emoji-presentation flex h-full w-full items-center justify-center text-2xl"
        aria-hidden
      >
        {avatarEmoji.trim()}
      </span>
    ) : (
      <LauncherAvatarPlaceholder />
    );
    return {
      size,
      shadowIntensity,
      avatar: img,
      avatarWithBackground: true,
      avatarRingWidth: ring,
      launcherWhenOpen,
    };
  }
  if (icon === "custom") {
    const customUrl = chatUI?.launcherAvatarUrl?.trim();
    if (customUrl) {
      return {
        size,
        shadowIntensity,
        avatar: (
          <img
            src={customUrl}
            alt=""
            className="h-full w-full object-cover rounded-full"
          />
        ),
        avatarWithBackground: true,
        avatarRingWidth: ring,
        launcherWhenOpen,
      };
    }
    return {
      size,
      shadowIntensity,
      avatar: <LauncherAvatarPlaceholder />,
      avatarWithBackground: true,
      avatarRingWidth: ring,
      launcherWhenOpen,
    };
  }
  return {
    size,
    shadowIntensity,
    avatar: (
      <span className="flex h-full w-full items-center justify-center text-white" aria-hidden>
        <MessageCircle className="h-[55%] w-[55%] min-h-[18px] min-w-[18px]" strokeWidth={2} />
      </span>
    ),
    avatarWithBackground: true,
    avatarRingWidth: ring,
    launcherWhenOpen,
  };
}
