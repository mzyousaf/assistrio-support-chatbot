"use client";

import React, { useCallback, useEffect, useState } from "react";

import { AdminLiveChatAdapter } from "@/components/chat";
import { ChatLauncherBubble } from "@/components/chat-ui";
import type { BotChatUI, ChatOpenAnimation, ChatShadowIntensity } from "@/models/Bot";

const DEFAULT_ACCENT = "#14B8A6";
const CHAT_ANIMATION_MS = 250;

const CHAT_SHADOW_CLASSES: Record<Exclude<ChatShadowIntensity, undefined>, string> = {
  none: "",
  low: "shadow-[0_2px_12px_rgba(0,0,0,0.15)]",
  medium: "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4),0_0_0_1px_rgba(0,0,0,0.05)]",
  high: "shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.08)]",
};

const SLIDE_DISTANCE = 16;
const EXPAND_SCALE_START = 0.4;

function getAnimationState(
  animation: ChatOpenAnimation,
  phase: "entering" | "closing" | "open",
  position: "bottom-left" | "bottom-right"
): { opacity: number; transform: string; transformOrigin?: string; pointerEvents?: string } {
  const pointerEvents = phase === "closing" ? "none" : undefined;
  const expandOrigin = position === "bottom-left" ? "bottom left" : "bottom right";
  switch (animation) {
    case "slide-up-fade":
      return {
        opacity: phase === "open" ? 1 : 0,
        transform: phase === "open" ? "translateY(0) scale(1)" : `translateY(${SLIDE_DISTANCE}px) scale(1)`,
        pointerEvents,
      };
    case "fade":
      return {
        opacity: phase === "open" ? 1 : 0,
        transform: "translateY(0) scale(1)",
        pointerEvents,
      };
    case "expand":
      return {
        opacity: phase === "open" ? 1 : 0,
        transform: phase === "open" ? "scale(1)" : `scale(${EXPAND_SCALE_START})`,
        transformOrigin: expandOrigin,
        pointerEvents,
      };
    default:
      return {
        opacity: phase === "open" ? 1 : 0,
        transform: phase === "open" ? "translateY(0) scale(1)" : `translateY(${SLIDE_DISTANCE}px) scale(1)`,
        pointerEvents,
      };
  }
}

export interface EditBotWorkspaceLayoutProps {
  botId: string;
  botName: string;
  botAvatarUrl?: string;
  /** Live preview from form (name, imageUrl, chatUI, tagline, description, welcomeMessage, suggestedQuestions) – chat reflects edits in real time */
  livePreview?: { name: string; imageUrl?: string; chatUI?: BotChatUI; tagline?: string; description?: string; welcomeMessage?: string; suggestedQuestions?: string[] } | null;
  /** When true, chat opens automatically on first render (default true). Pass from bot.chatUI.openChatOnLoad when available. */
  defaultChatOpen?: boolean;
  /** URL to open when user chooses "Expand chat" in menu (e.g. /demo/:slug) */
  expandHref?: string;
  /** Left pane: editor content (BotEditorPane) */
  children: React.ReactNode;
}

export function EditBotWorkspaceLayout({
  botId,
  botName,
  botAvatarUrl,
  livePreview,
  defaultChatOpen = true,
  expandHref,
  children,
}: EditBotWorkspaceLayoutProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [liveChatOpen, setLiveChatOpen] = useState(defaultChatOpen !== false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(defaultChatOpen !== false);
  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  const requestClose = useCallback(() => {
    setIsClosing(true);
  }, []);

  const requestOpen = useCallback(() => {
    setLiveChatOpen(true);
    setIsEntering(true);
  }, []);

  useEffect(() => {
    if (!isClosing) return;
    const t = setTimeout(() => {
      setLiveChatOpen(false);
      setIsClosing(false);
    }, CHAT_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [isClosing]);

  useEffect(() => {
    if (liveChatOpen && !isClosing && isEntering) {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsEntering(false));
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [liveChatOpen, isClosing, isEntering]);

  const chatUI = livePreview?.chatUI;
  const accentColor =
    (typeof chatUI?.primaryColor === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor) &&
      chatUI.primaryColor) ||
    DEFAULT_ACCENT;

  const shadowIntensity: ChatShadowIntensity =
    chatUI?.shadowIntensity === "none" || chatUI?.shadowIntensity === "low" || chatUI?.shadowIntensity === "high"
      ? chatUI.shadowIntensity
      : "medium";
  const launcherPosition = chatUI?.launcherPosition === "bottom-left" ? "bottom-left" : "bottom-right";
  const launcherIcon = chatUI?.launcherIcon ?? "default";
  const launcherSize = typeof chatUI?.launcherSize === "number" && chatUI.launcherSize >= 32 && chatUI.launcherSize <= 96
    ? chatUI.launcherSize
    : 48;
  const rawAnimation = chatUI?.chatOpenAnimation ?? "slide-up-fade";
  const openAnimation: ChatOpenAnimation =
    rawAnimation === "fade"
      ? "fade"
      : rawAnimation === "expand" || (rawAnimation as string) === "scale"
        ? "expand"
        : "slide-up-fade";
  const phase =
    isEntering && !isClosing ? "entering" : isClosing ? "closing" : "open";
  const animStyle = getAnimationState(openAnimation, phase, launcherPosition);

  const launcherImageUrl =
    launcherIcon === "bot-avatar"
      ? (livePreview?.imageUrl ?? botAvatarUrl)
      : launcherIcon === "custom" && typeof chatUI?.launcherAvatarUrl === "string" && chatUI.launcherAvatarUrl.trim()
        ? chatUI.launcherAvatarUrl.trim()
        : undefined;
  const launcherAvatar = launcherImageUrl ? (
    <img src={launcherImageUrl} alt="" className="w-full h-full object-cover rounded-full" />
  ) : undefined;
  const launcherAvatarWithBackground = launcherIcon === "bot-avatar" && launcherAvatar != null;
  const launcherRingWidth =
    launcherIcon === "bot-avatar" &&
      typeof chatUI?.launcherAvatarRingWidth === "number" &&
      chatUI.launcherAvatarRingWidth >= 0 &&
      chatUI.launcherAvatarRingWidth <= 30
      ? Math.round(chatUI.launcherAvatarRingWidth)
      : 18;

  return (
    <div className="max-w-[1400px] w-full mx-auto px-6 xl:px-8 py-6">
      <div className="min-h-0">
        {children}
      </div>

      {/* Desktop: fixed widget (chat + launcher); position from chatUI (bottom-left or bottom-right). */}
      <div
        className={[
          "hidden lg:flex fixed bottom-4 z-[9998] flex-col gap-2",
          launcherPosition === "bottom-left" ? "left-4 items-start" : "right-4 items-end",
        ].join(" ")}
      >
        {(liveChatOpen || isClosing) && (
          <div
            className={["rounded-2xl overflow-hidden flex-shrink-0", CHAT_SHADOW_CLASSES[shadowIntensity]].join(" ")}
            style={{
              opacity: animStyle.opacity,
              transform: animStyle.transform,
              transformOrigin: animStyle.transformOrigin,
              pointerEvents: animStyle.pointerEvents,
              transition: "opacity 250ms ease-out, transform 250ms ease-out",
            }}
          >
            <AdminLiveChatAdapter
              botId={botId}
              botName={livePreview?.name ?? botName}
              avatarUrl={livePreview?.imageUrl ?? botAvatarUrl}
              chatUI={livePreview?.chatUI}
              tagline={livePreview?.tagline}
              description={livePreview?.description}
              welcomeMessage={livePreview?.welcomeMessage}
              suggestedQuestions={livePreview?.suggestedQuestions}
              expandHref={expandHref}
              onClose={requestClose}
            />
          </div>
        )}
        <ChatLauncherBubble
          isOpen={liveChatOpen}
          onToggle={() => (liveChatOpen ? requestClose() : requestOpen())}
          accentColor={accentColor}
          dark={true}
          inline
          avatar={launcherAvatar}
          alwaysShowSameIcon
          size={launcherSize}
          shadowIntensity={shadowIntensity}
          avatarWithBackground={launcherAvatarWithBackground}
          avatarRingWidth={launcherRingWidth}
          openLabel="Open chat"
          closeLabel="Close chat"
        />
      </div>

      {/* Mobile: Live Chat launcher – icon only (GCP-style) */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={openMobileDrawer}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-colors"
          aria-label="Open live chat"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          </svg>
        </button>
      </div>

      {/* Mobile: drawer – close button in chat header closes drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Live Chat"
        >
          <button
            type="button"
            onClick={closeMobileDrawer}
            className="absolute inset-0 bg-black/50"
            aria-label="Close overlay"
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm flex flex-col bg-gray-950 overflow-y-auto">
            <div className="flex flex-col items-stretch p-4 min-h-full">
              <AdminLiveChatAdapter
                botId={botId}
                botName={livePreview?.name ?? botName}
                avatarUrl={livePreview?.imageUrl ?? botAvatarUrl}
                chatUI={livePreview?.chatUI}
                tagline={livePreview?.tagline}
                description={livePreview?.description}
                welcomeMessage={livePreview?.welcomeMessage}
                suggestedQuestions={livePreview?.suggestedQuestions}
                expandHref={expandHref}
                onClose={closeMobileDrawer}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
