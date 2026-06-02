import React from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { ChatLauncherWhenOpen } from "../../models/botChatUI";
import { AssistrioPageLoaderSpinner } from "./AssistrioPageLoaderSpinner";
import { chatShadowIntensityClass } from "./chatShadowStyles";
import { cx } from "./utils";

export interface ChatLauncherBubbleProps {
  /** When true, chat is open; bubble shows close icon. When false, shows chat icon. */
  isOpen: boolean;
  /** Called when the bubble is clicked (toggle open/close). */
  onToggle: () => void;
  /** Accent color for the bubble (default #6366f1). */
  accentColor?: string;
  /** Dark theme for bubble (default true). */
  dark?: boolean;
  /** Position of the bubble on screen (default "bottom-right"). */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Optional unread count badge (e.g. new messages). Hidden when 0 or undefined. */
  unreadCount?: number;
  /** Custom icon when closed. If not provided, default chat icon is used. */
  closedIcon?: React.ReactNode;
  /** Custom icon when open and `launcherWhenOpen` is "close". If not provided, default X icon is used. */
  openIcon?: React.ReactNode;
  /** When set, shown in the bubble when closed (e.g. bot avatar). */
  avatar?: React.ReactNode;
  /**
   * What to show when chat is open: X, down arrow (default), or same content as when closed.
   * Ignored legacy: `alwaysShowSameIcon` maps to "same" when `launcherWhenOpen` is omitted.
   */
  launcherWhenOpen?: ChatLauncherWhenOpen;
  /** @deprecated Prefer `launcherWhenOpen: "same"`. When true and `launcherWhenOpen` is omitted, open state matches closed. */
  alwaysShowSameIcon?: boolean;
  /** Accessible label when closed (default "Open chat"). */
  openLabel?: string;
  /** Accessible label when open (default "Close chat"). */
  closeLabel?: string;
  /** Show bootstrap spinner on the bubble while the widget is preparing (panel stays closed). */
  loading?: boolean;
  /** When true, button is in-flow (no fixed positioning); use for embedding in layout (e.g. right pane). */
  inline?: boolean;
  /** Size in pixels (default 40). */
  size?: number;
  /** Shadow intensity: "none" | "low" | "medium" | "high" (default "medium"). */
  shadowIntensity?: "none" | "low" | "medium" | "high";
  /** Return focus here when the panel closes (accessibility). */
  buttonRef?: React.Ref<HTMLButtonElement>;
  /** When true and avatar is set, avatar is inset so button background shows as a ring (e.g. bot avatar with background). */
  avatarWithBackground?: boolean;
  /** When avatarWithBackground, ring width as percentage (0–30). 0 = no ring; default 18. */
  avatarRingWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Default launcher: chat bubble icon when mode is “default” (no avatar image). */
const DefaultChatLauncherGlyph = () => (
  <MessageCircle className="w-5 h-5" strokeWidth={2} aria-hidden />
);

const CloseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const positionClasses = {
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
} as const;

export function ChatLauncherBubble({
  isOpen,
  onToggle,
  accentColor = "#6366f1",
  dark = true,
  position = "bottom-right",
  unreadCount,
  closedIcon,
  openIcon,
  avatar,
  launcherWhenOpen: launcherWhenOpenProp,
  alwaysShowSameIcon = false,
  openLabel = "Open chat",
  closeLabel = "Close chat",
  loading = false,
  inline = false,
  size = 40,
  shadowIntensity = "medium",
  avatarWithBackground = false,
  avatarRingWidth = 18,
  buttonRef,
  className,
  style,
}: ChatLauncherBubbleProps) {
  const showBadge =
    typeof unreadCount === "number" && unreadCount > 0 && !isOpen && !loading;
  const label = loading && !isOpen ? "Loading chat" : isOpen ? closeLabel : openLabel;

  const whenOpen: ChatLauncherWhenOpen =
    launcherWhenOpenProp ?? (alwaysShowSameIcon ? "same" : "chevron-down");

  const closedGlyph = avatar ?? closedIcon ?? <DefaultChatLauncherGlyph />;
  const openGlyph =
    whenOpen === "same"
      ? closedGlyph
      : whenOpen === "close"
        ? (openIcon ?? <CloseIcon />)
        : (
          <ChevronDown className="w-5 h-5" strokeWidth={2} aria-hidden />
        );

  const intensity =
    shadowIntensity === "none" || shadowIntensity === "low" || shadowIntensity === "medium" || shadowIntensity === "high"
      ? shadowIntensity
      : "medium";
  const sizePx = typeof size === "number" && size > 0 ? Math.round(size) : 40;
  const showLauncherLoader = loading && !isOpen;
  const iconContent = showLauncherLoader ? (
    <AssistrioPageLoaderSpinner size="page" decorative />
  ) : isOpen ? (
    openGlyph
  ) : (
    closedGlyph
  );

  const useAvatarRing =
    avatarWithBackground &&
    avatar != null &&
    (!isOpen || whenOpen === "same");
  const ringPct =
    useAvatarRing && typeof avatarRingWidth === "number" && avatarRingWidth >= 0 && avatarRingWidth <= 30
      ? avatarRingWidth
      : useAvatarRing
        ? 18
        : 0;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={isOpen}
      aria-busy={loading && !isOpen ? true : undefined}
      disabled={loading && !isOpen}
      className={cx(
        "flex items-center justify-center transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        showLauncherLoader
          ? "overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none hover:scale-100 cursor-wait focus-visible:ring-teal-500/35"
          : "overflow-hidden rounded-full hover:scale-105",
        !showLauncherLoader && chatShadowIntensityClass(intensity),
        !showLauncherLoader &&
          (dark
            ? "text-white focus-visible:ring-offset-gray-900"
            : "text-white focus-visible:ring-offset-white"),
        !inline && "fixed z-[9999]",
        !inline && positionClasses[position],
        className
      )}
      style={{
        width: sizePx,
        height: sizePx,
        backgroundColor: showLauncherLoader ? "transparent" : accentColor,
        ...style,
      }}
    >
      {showLauncherLoader ? (
        iconContent
      ) : (
      <span
        className={cx(
          "relative flex h-full w-full items-center justify-center",
          ringPct > 0 ? "[&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:rounded-full" : "[&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:rounded-full"
        )}
        style={ringPct > 0 ? { padding: `${ringPct}%` } : undefined}
      >
        {iconContent}
        {showBadge && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-0.5 text-[10px] font-semibold text-gray-900"
            aria-hidden
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </span>
      )}
    </button>
  );
}
