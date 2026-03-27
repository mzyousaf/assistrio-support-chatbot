"use client";

import React, { useState } from "react";
import { cx } from "./utils";
import { Chat } from "./Chat";
import { ChatLauncherBubble } from "./ChatLauncherBubble";
import type { ChatProps } from "./Chat";
import type { ChatLauncherBubbleProps } from "./ChatLauncherBubble";

export interface ChatWithLauncherProps extends Omit<ChatProps, "onClose"> {
  /** Called when chat panel is closed. */
  onClose?: () => void;
  /** Launcher bubble position (default "bottom-right"). */
  launcherPosition?: ChatLauncherBubbleProps["position"];
  /** Unread count badge on bubble when chat is closed. */
  launcherUnreadCount?: number;
  /** Accessible label when chat is closed (default "Open chat"). */
  launcherOpenLabel?: string;
  /** Accessible label when chat is open (default "Close chat"). */
  launcherCloseLabel?: string;
  /** Initially open (default false). */
  defaultOpen?: boolean;
}

const panelPositionClasses = {
  "bottom-right": "bottom-20 right-4",
  "bottom-left": "bottom-20 left-4",
  "top-right": "top-20 right-4",
  "top-left": "top-20 left-4",
} as const;

/**
 * Renders a floating launcher bubble and a chat panel that opens/closes when the bubble is clicked.
 * Use this for embedded or widget-style chat (e.g. bottom-right corner of a page).
 */
export function ChatWithLauncher({
  launcherPosition = "bottom-right",
  launcherUnreadCount,
  launcherOpenLabel,
  launcherCloseLabel,
  defaultOpen = false,
  accentColor = "#6366f1",
  dark = true,
  width = 380,
  height = 560,
  onClose,
  ...chatProps
}: ChatWithLauncherProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  return (
    <>
      <ChatLauncherBubble
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        accentColor={accentColor}
        dark={dark}
        position={launcherPosition}
        unreadCount={launcherUnreadCount}
        openLabel={launcherOpenLabel}
        closeLabel={launcherCloseLabel}
      />
      {isOpen && (
        <div
          className={cx(
            "fixed z-[9998] flex flex-col overflow-hidden rounded-2xl shadow-2xl",
            panelPositionClasses[launcherPosition],
            dark ? "bg-gray-900 border border-gray-700" : "bg-white border border-gray-200"
          )}
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            height: typeof height === "number" ? `${height}px` : height,
          }}
          role="dialog"
          aria-label="Chat"
        >
          <Chat
            {...chatProps}
            width="100%"
            height="100%"
            dark={dark}
            accentColor={accentColor}
            onClose={handleClose}
            style={{ border: "none", boxShadow: "none" }}
          />
        </div>
      )}
    </>
  );
}
