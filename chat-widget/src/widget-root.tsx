import React, { useEffect, useMemo, useState } from "react";

import { AdminLiveChatAdapter } from "./components/AdminLiveChatAdapter";
import { validateAndInitWidget } from "./api";
import { normalizeEmbedConfig } from "./config";
import { normalizeWidgetSettings } from "./normalize";
import type { EmbedChatConfig, NormalizedWidgetSettings } from "./types";

type Phase = "loading" | "error" | "ready";

function chatVisitorIdStorageKey(botId: string, mode: "runtime" | "preview"): string {
  return mode === "preview"
    ? `assistrio_chat_visitor_preview_id:${botId}`
    : `assistrio_chat_visitor_id:${botId}`;
}

export interface EmbedWidgetRootProps {
  rawConfig: Partial<EmbedChatConfig>;
}

export function EmbedWidgetRoot({ rawConfig }: EmbedWidgetRootProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [config, setConfig] = useState<EmbedChatConfig | null>(null);
  const [settings, setSettings] = useState<NormalizedWidgetSettings | null>(null);
  const [chatVisitorId, setChatVisitorId] = useState<string | null>(null);

  const configKey = useMemo(() => JSON.stringify(rawConfig ?? {}), [rawConfig]);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");

    void (async () => {
      try {
        const normalized = normalizeEmbedConfig(rawConfig);
        const mode = normalized.mode ?? "runtime";

        const storageKey = chatVisitorIdStorageKey(normalized.botId, mode);
        const existingChatVisitorId =
          typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;

        const initRequestConfig: Partial<EmbedChatConfig> = {
          ...rawConfig,
          ...(existingChatVisitorId ? { chatVisitorId: existingChatVisitorId } : {}),
        };

        const init = await validateAndInitWidget(initRequestConfig);
        const normSettings = normalizeWidgetSettings(init, normalized);
        if (cancelled) return;
        setConfig(normalized);
        setSettings(normSettings);
        const resolvedChatVisitorId =
          typeof init.chatVisitorId === "string" && init.chatVisitorId.trim()
            ? init.chatVisitorId
            : existingChatVisitorId;

        if (resolvedChatVisitorId) {
          window.localStorage.setItem(storageKey, resolvedChatVisitorId);
          setChatVisitorId(resolvedChatVisitorId);
        }
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
  if (!chatVisitorId) {
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
      mode={config.mode ?? "runtime"}
      botName={settings.botName}
      avatarUrl={settings.avatarUrl}
      avatarEmoji={settings.avatarEmoji}
      chatUI={chatUIWithBranding}
      tagline={settings.tagline}
      description={settings.description}
      welcomeMessage={settings.welcomeMessage}
      suggestedQuestions={settings.suggestedQuestions}
      apiBaseUrl={config.apiBaseUrl}
      chatPostPath={config.chatPostPath}
      accessKey={config.accessKey}
      secretKey={config.secretKey}
      chatVisitorId={chatVisitorId}
      platformVisitorId={config.platformVisitorId}
      authToken={config.authToken}
      previewOverrides={config.mode === "preview" ? config.previewOverrides : undefined}
      debug={false}
      footerPrivacyText={settings.privacyText}
      useFloatingLauncher
    />
  );
}
