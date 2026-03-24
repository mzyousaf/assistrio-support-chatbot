"use client";

import React, { useEffect, useMemo, useState } from "react";

import { AdminLiveChatAdapter } from "@/components/chat/AdminLiveChatAdapter";

import { validateAndInitWidget } from "./api";
import { normalizeEmbedConfig } from "./config";
import { normalizeWidgetSettings } from "./normalize";
import type { EmbedChatConfig, NormalizedWidgetSettings } from "./types";

type Phase = "loading" | "error" | "ready";

export interface EmbedWidgetRootProps {
  rawConfig: Partial<EmbedChatConfig>;
}

/**
 * Embeddable widget body: validates config, loads widget settings from API, then renders
 * {@link AdminLiveChatAdapter} with floating launcher (existing chat + launcher stack).
 */
export function EmbedWidgetRoot({ rawConfig }: EmbedWidgetRootProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [config, setConfig] = useState<EmbedChatConfig | null>(null);
  const [settings, setSettings] = useState<NormalizedWidgetSettings | null>(null);

  const configKey = useMemo(() => JSON.stringify(rawConfig ?? {}), [rawConfig]);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");

    void (async () => {
      try {
        const normalized = normalizeEmbedConfig(rawConfig);
        const init = await validateAndInitWidget(rawConfig);
        const normSettings = normalizeWidgetSettings(init, normalized);
        if (cancelled) return;
        setConfig(normalized);
        setSettings(normSettings);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Chat unavailable.";
        if (typeof console !== "undefined" && console.error) {
          console.error("[Assistrio embed]", msg);
        }
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Init runs when serialized config changes; object identity of `rawConfig` is not always stable for embed callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rawConfig captured via configKey
  }, [configKey]);

  const loadingPositionClass =
    rawConfig?.position === "left" ? "bottom-4 left-4" : "bottom-4 right-4";

  if (phase === "loading") {
    return (
      <div
        aria-hidden
        className={`fixed z-[9999] h-2 w-2 rounded-full bg-gray-400 opacity-50 ${loadingPositionClass}`}
      />
    );
  }

  if (phase === "error" || !config || !settings) {
    return null;
  }

  const chatUIWithBranding = {
    ...settings.chatUI,
    ...(settings.brandingMessage?.trim()
      ? { brandingMessage: settings.brandingMessage.trim() }
      : {}),
  };

  return (
    <AdminLiveChatAdapter
      botId={settings.botId}
      botName={settings.botName}
      avatarUrl={settings.avatarUrl}
      avatarEmoji={settings.avatarEmoji}
      chatUI={chatUIWithBranding}
      tagline={settings.tagline}
      description={settings.description}
      welcomeMessage={settings.welcomeMessage}
      suggestedQuestions={settings.suggestedQuestions}
      apiBaseUrl={config.apiBaseUrl}
      accessKey={config.accessKey}
      debug={false}
      footerPrivacyText={settings.privacyText}
      useFloatingLauncher
    />
  );
}
