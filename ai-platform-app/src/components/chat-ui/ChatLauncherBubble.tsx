"use client";

import React from "react";
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
  /** Custom icon when closed (chat). If not provided, default chat icon is used. */
  closedIcon?: React.ReactNode;
  /** Custom icon when open (close). If not provided, default X icon is used. Ignored when alwaysShowSameIcon. */
  openIcon?: React.ReactNode;
  /** When set, shown in the bubble (e.g. bot avatar). When alwaysShowSameIcon, this or closedIcon/chat icon is always shown instead of close icon. */
  avatar?: React.ReactNode;
  /** When true, always show avatar or closedIcon/default chat icon; never show close (X) icon when open. */
  alwaysShowSameIcon?: boolean;
  /** Accessible label when closed (default "Open chat"). */
  openLabel?: string;
  /** Accessible label when open (default "Close chat"). */
  closeLabel?: string;
  /** When true, button is in-flow (no fixed positioning); use for embedding in layout (e.g. right pane). */
  inline?: boolean;
  /** Size in pixels (default 48). */
  size?: number;
  /** Shadow intensity: "none" | "low" | "medium" | "high" (default "medium"). */
  shadowIntensity?: "none" | "low" | "medium" | "high";
  /** When true and avatar is set, avatar is inset so button background shows as a ring (e.g. bot avatar with background). */
  avatarWithBackground?: boolean;
  /** When avatarWithBackground, ring width as percentage (0–30). 0 = no ring; default 18. */
  avatarRingWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ChatIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="w-6 h-6"
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

const shadowClasses: Record<"none" | "low" | "medium" | "high", string> = {
  none: "",
  low: "shadow-[0_2px_12px_rgba(0,0,0,0.15)]",
  medium: "shadow-[0_10px_35px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.08)]",
  high: "shadow-[0_16px_48px_rgba(0,0,0,0.38),0_0_0_1px_rgba(0,0,0,0.1)]",
};

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
  alwaysShowSameIcon = false,
  openLabel = "Open chat",
  closeLabel = "Close chat",
  inline = false,
  size = 48,
  shadowIntensity = "medium",
  avatarWithBackground = false,
  avatarRingWidth = 18,
  className,
  style,
}: ChatLauncherBubbleProps) {
  const showBadge =
    typeof unreadCount === "number" && unreadCount > 0 && !isOpen;
  const label = isOpen ? closeLabel : openLabel;

  const showSameIcon = alwaysShowSameIcon || avatar != null;
  const intensity = shadowIntensity === "none" || shadowIntensity === "low" || shadowIntensity === "high" ? shadowIntensity : "medium";
  const iconContent = showSameIcon
    ? (avatar ?? closedIcon ?? <ChatIcon />)
    : isOpen
      ? (openIcon ?? <CloseIcon />)
      : (closedIcon ?? <ChatIcon />);

  const sizePx = typeof size === "number" && size > 0 ? Math.round(size) : 48;
  const ringPct =
    avatarWithBackground && avatar != null && typeof avatarRingWidth === "number" && avatarRingWidth >= 0 && avatarRingWidth <= 30
      ? avatarRingWidth
      : avatarWithBackground && avatar != null
        ? 18
        : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={isOpen}
      className={cx(
        "flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 overflow-hidden",
        shadowClasses[intensity],
        dark
          ? "text-white focus-visible:ring-offset-gray-900"
          : "text-white focus-visible:ring-offset-white",
        !inline && "fixed z-[9999]",
        !inline && positionClasses[position],
        className
      )}
      style={{
        width: sizePx,
        height: sizePx,
        backgroundColor: accentColor,
        ...style,
      }}
    >
      <span
        className={cx(
          "relative flex items-center justify-center w-full h-full",
          ringPct > 0 ? "[&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:rounded-full" : "[&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:rounded-full"
        )}
        style={ringPct > 0 ? { padding: `${ringPct}%` } : undefined}
      >
        {iconContent}
        {showBadge && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-xs font-semibold bg-white text-gray-900"
            aria-hidden
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </span>
    </button>
  );
}
