import React, { useEffect, useRef, useState } from "react";
import { cx } from "./utils";
import { Chat } from "./Chat";
import { ChatLauncherBubble } from "./ChatLauncherBubble";
import type { ChatProps } from "./Chat";
import type { ChatLauncherBubbleProps } from "./ChatLauncherBubble";
import { normalizeChatOpenAnimation } from "../../lib/chatOpenAnimationNormalize";
import type { ChatLauncherWhenOpen, ChatOpenAnimation } from "../../models/botChatUI";
import { chatShadowIntensityClass } from "./chatShadowStyles";

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
  /** Initially open (default false). Maps from `chatUI.openChatOnLoad` in embeds. */
  defaultOpen?: boolean;
  /** Bubble diameter in px (`chatUI.launcherSize`). */
  launcherSize?: number;
  launcherShadowIntensity?: ChatLauncherBubbleProps["shadowIntensity"];
  launcherAvatar?: ChatLauncherBubbleProps["avatar"];
  launcherAvatarWithBackground?: ChatLauncherBubbleProps["avatarWithBackground"];
  launcherAvatarRingWidth?: ChatLauncherBubbleProps["avatarRingWidth"];
  /** What the launcher shows while chat is open (default down arrow). */
  launcherWhenOpen?: ChatLauncherWhenOpen;
  launcherAlwaysShowSameIcon?: ChatLauncherBubbleProps["alwaysShowSameIcon"];
  /** How the floating panel enters when opened (`chatUI.chatOpenAnimation`). */
  panelOpenAnimation?: ChatOpenAnimation;
  /** `aria-label` for the dialog wrapper (default "Chat"). */
  dialogAriaLabel?: string;
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
  launcherSize,
  launcherShadowIntensity,
  launcherAvatar,
  launcherAvatarWithBackground,
  launcherAvatarRingWidth,
  launcherWhenOpen,
  launcherAlwaysShowSameIcon,
  panelOpenAnimation = "slide-up-fade",
  dialogAriaLabel = "Chat",
  accentColor = "#6366f1",
  dark = true,
  width = 380,
  height = 560,
  onClose,
  ...chatProps
}: ChatWithLauncherProps) {
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const prevPanelOpenRef = useRef(false);

  const {
    showChatBorder = true,
    chatPanelBorderWidth = 1,
    shadowIntensity = "medium",
    style: chatStyle,
    className: chatClassName,
    ...restChatProps
  } = chatProps;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [panelEntered, setPanelEntered] = useState(false);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPanelEntered(false);
      return;
    }
    setPanelEntered(false);
    /** Double rAF so the browser paints the “enter” state before transitioning to “entered”. */
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [isOpen, panelOpenAnimation]);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => {
        composerTextAreaRef.current?.focus();
      });
      prevPanelOpenRef.current = true;
      return () => cancelAnimationFrame(id);
    }
    const wasOpen = prevPanelOpenRef.current;
    prevPanelOpenRef.current = false;
    if (wasOpen) {
      launcherButtonRef.current?.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const anim: ChatOpenAnimation = normalizeChatOpenAnimation(panelOpenAnimation);
  const expandOrigin =
    launcherPosition === "bottom-left" ? "bottom left" : "bottom right";
  const sizeTransition = "width 0.28s ease-out, height 0.28s ease-out";
  /** Distinct presets matching admin labels: Slide up + fade, Fade, Expand. */
  const panelMotionStyle: React.CSSProperties =
    anim === "fade"
      ? {
          opacity: panelEntered ? 1 : 0,
          transform: "none",
          transition: `opacity 0.32s ease-out, ${sizeTransition}`,
        }
      : anim === "expand"
        ? {
            opacity: panelEntered ? 1 : 0.88,
            transform: panelEntered ? "scale(1)" : "scale(0.82)",
            transformOrigin: expandOrigin,
            transition: `opacity 0.28s ease-out, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), ${sizeTransition}`,
          }
        : {
            opacity: panelEntered ? 1 : 0,
            transform: panelEntered ? "translateY(0)" : "translateY(20px)",
            transition: `opacity 0.28s ease-out, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), ${sizeTransition}`,
          };

  return (
    <div className="assistrio-chat-widget">
      <ChatLauncherBubble
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        buttonRef={launcherButtonRef}
        accentColor={accentColor}
        dark={dark}
        position={launcherPosition}
        unreadCount={launcherUnreadCount}
        openLabel={launcherOpenLabel}
        closeLabel={launcherCloseLabel}
        size={launcherSize}
        shadowIntensity={launcherShadowIntensity}
        avatar={launcherAvatar}
        avatarWithBackground={launcherAvatarWithBackground}
        avatarRingWidth={launcherAvatarRingWidth}
        launcherWhenOpen={launcherWhenOpen}
        alwaysShowSameIcon={launcherAlwaysShowSameIcon}
      />
      {isOpen && (
        <div
          className={cx(
            "fixed z-[9998] flex flex-col overflow-hidden rounded-2xl",
            chatShadowIntensityClass(shadowIntensity),
            panelPositionClasses[launcherPosition],
            dark ? "dark bg-gray-900" : "bg-white",
            chatClassName,
          )}
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            height: typeof height === "number" ? `${height}px` : height,
            ...panelMotionStyle,
            ...(showChatBorder && accentColor && chatPanelBorderWidth > 0
              ? { border: `${chatPanelBorderWidth}px solid ${accentColor}99` }
              : {}),
            ...chatStyle,
          }}
          role="dialog"
          aria-label={dialogAriaLabel}
        >
          <Chat
            {...restChatProps}
            width="100%"
            height="100%"
            dark={dark}
            accentColor={accentColor}
            onClose={handleClose}
            showChatBorder={false}
            shadowIntensity="none"
            composerTextAreaRef={composerTextAreaRef}
          />
        </div>
      )}
    </div>
  );
}
