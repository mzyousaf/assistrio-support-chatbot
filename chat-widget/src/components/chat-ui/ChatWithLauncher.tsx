import React, { useEffect, useRef, useState } from "react";
import { cx } from "./utils";
import { Chat } from "./Chat";
import { ChatLauncherBubble } from "./ChatLauncherBubble";
import type { ChatProps } from "./Chat";
import type { ChatLauncherBubbleProps } from "./ChatLauncherBubble";
import { normalizeChatOpenAnimation } from "../../lib/chatOpenAnimationNormalize";
import type { ChatLauncherWhenOpen, ChatOpenAnimation } from "../../models/botChatUI";
import { chatPanelOutlineStyle } from "./chatPanelChrome";
import { chatShadowIntensityClass } from "./chatShadowStyles";
import {
  containedPanelAboveLauncherAnchorStyle,
  containedWidgetAnchorStyle,
  DEFAULT_LAUNCHER_DIAMETER_PX,
  LAUNCHER_EDGE_INSET_PX,
  PANEL_ABOVE_LAUNCHER_GAP_PX,
} from "../../lib/embedPanelConstraints";

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
  /** While true and the panel is closed, show a spinner on the launcher bubble. */
  launcherLoading?: boolean;
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
  /**
   * `viewport` (default): fixed launcher/panel on the browser window.
   * `contained`: absolute positioning inside a `position: relative` stage host.
   */
  anchorMode?: "viewport" | "contained";
}

const panelHorizontalClasses = {
  "bottom-right": "right-4",
  "bottom-left": "left-4",
  "top-right": "right-4",
  "top-left": "left-4",
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
  launcherLoading = false,
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
  width = 404,
  height = 730,
  onClose,
  anchorMode = "viewport",
  ...chatProps
}: ChatWithLauncherProps) {
  const containedAnchor = anchorMode === "contained";
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const prevPanelOpenRef = useRef(false);

  const {
    showChatBorder = true,
    chatPanelBorderColor = "primary",
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

  const effectiveLauncherDiameterPx =
    typeof launcherSize === "number" && Number.isFinite(launcherSize) && launcherSize > 0
      ? launcherSize
      : DEFAULT_LAUNCHER_DIAMETER_PX;
  /** Panel anchor from viewport edge so it sits above/below the launcher for any size (e.g. 96px). */
  const panelEdgeInsetPx =
    LAUNCHER_EDGE_INSET_PX + effectiveLauncherDiameterPx + PANEL_ABOVE_LAUNCHER_GAP_PX;
  const panelVerticalStyle: React.CSSProperties =
    launcherPosition === "bottom-right" || launcherPosition === "bottom-left"
      ? { bottom: panelEdgeInsetPx, top: "auto" }
      : { top: panelEdgeInsetPx, bottom: "auto" };

  const containedLauncherAnchorStyle = containedWidgetAnchorStyle(launcherPosition);
  const containedPanelAnchorStyle = containedPanelAboveLauncherAnchorStyle(
    launcherPosition,
    effectiveLauncherDiameterPx,
  );

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
    <div
      className={cx(
        "assistrio-chat-widget",
        containedAnchor && "relative h-full w-full min-h-0 pointer-events-none",
      )}
    >
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
        inline={containedAnchor}
        loading={!isOpen && launcherLoading}
        className={containedAnchor ? "!absolute z-[20] pointer-events-auto" : undefined}
        style={containedAnchor ? containedLauncherAnchorStyle : undefined}
      />
      {isOpen && (
        <div
          className={cx(
            containedAnchor ? "absolute z-[19] pointer-events-auto" : "fixed z-[9998]",
            "flex flex-col overflow-hidden rounded-2xl",
            chatShadowIntensityClass(shadowIntensity),
            !containedAnchor && panelHorizontalClasses[launcherPosition],
            dark ? "dark bg-gray-900" : "bg-white",
            chatClassName,
          )}
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            height: typeof height === "number" ? `${height}px` : height,
            ...(containedAnchor ? containedPanelAnchorStyle : panelVerticalStyle),
            ...panelMotionStyle,
            ...chatPanelOutlineStyle(
              showChatBorder,
              chatPanelBorderWidth,
              chatPanelBorderColor,
              accentColor,
              Boolean(dark),
            ),
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
