import React, { useEffect, useMemo, useState } from "react";

import { AdminLiveChatAdapter } from "./components/AdminLiveChatAdapter";
import { validateAndInitWidget } from "./api";
import { normalizeEmbedConfig } from "./config";
import { mergePreviewInitResponse } from "./lib/preview-display-merge";
import { normalizeWidgetSettings } from "./normalize";
import type { EmbedChatConfig, NormalizedWidgetSettings, WidgetInitResponse } from "./types";

type Phase = "loading" | "error" | "ready";

function chatVisitorIdStorageKey(botId: string, mode: "runtime" | "preview"): string {
  return mode === "preview"
    ? `assistrio_chat_visitor_preview_id:${botId}`
    : `assistrio_chat_visitor_id:${botId}`;
}

/** Init re-fetch only when identity/session/config changes — not on every previewOverrides tweak. */
function initKeyFromRawConfig(raw: Partial<EmbedChatConfig> | undefined): string {
  const rc = raw ?? {};
  if (rc.mode === "preview") {
    const { previewOverrides: _omit, ...rest } = rc as Record<string, unknown>;
    return JSON.stringify(rest);
  }
  return JSON.stringify(rc);
}

export interface EmbedWidgetRootProps {
  rawConfig: Partial<EmbedChatConfig>;
}

export function EmbedWidgetRoot({ rawConfig }: EmbedWidgetRootProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [initResponse, setInitResponse] = useState<WidgetInitResponse | null>(null);
  const [chatVisitorId, setChatVisitorId] = useState<string | null>(null);

  const config = useMemo(() => normalizeEmbedConfig(rawConfig), [rawConfig]);

  const initKey = useMemo(() => initKeyFromRawConfig(rawConfig), [rawConfig]);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");

    void (async () => {
      try {
        const normalized = normalizeEmbedConfig(rawConfig);
        const mode = normalized.mode ?? "runtime";
        const authPreview =
          (typeof normalized.authToken === "string" && normalized.authToken.trim() !== "") ||
          normalized.sessionPreview === true;

        const storageKey = chatVisitorIdStorageKey(normalized.botId, mode);
        const persistChatSession = normalized.persistChatSession !== false;
        const existingChatVisitorId =
          !authPreview && persistChatSession && typeof window !== "undefined"
            ? window.localStorage.getItem(storageKey)
            : null;

        const initRequestConfig: Partial<EmbedChatConfig> = {
          ...rawConfig,
          ...(existingChatVisitorId ? { chatVisitorId: existingChatVisitorId } : {}),
        };
        if (authPreview) {
          delete (initRequestConfig as { chatVisitorId?: string }).chatVisitorId;
        }
        if (mode === "preview") {
          delete initRequestConfig.previewOverrides;
        }

        const init = await validateAndInitWidget(initRequestConfig);
        if (cancelled) return;
        setInitResponse(init);

        const resolvedChatVisitorId =
          typeof init.chatVisitorId === "string" && init.chatVisitorId.trim()
            ? init.chatVisitorId
            : existingChatVisitorId;

        if (resolvedChatVisitorId) {
          if (persistChatSession) {
            window.localStorage.setItem(storageKey, resolvedChatVisitorId);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewOverrides excluded from initKey; rawConfig read when initKey changes
  }, [initKey]);

  const displaySettings = useMemo((): NormalizedWidgetSettings | null => {
    if (!initResponse) return null;
    if (config.mode === "runtime") {
      return normalizeWidgetSettings(initResponse, config);
    }
    const merged = mergePreviewInitResponse(initResponse, config.previewOverrides);
    return normalizeWidgetSettings(merged, config);
  }, [initResponse, config]);

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

  if (phase === "error" || !displaySettings) {
    return null;
  }
  if (!chatVisitorId) {
    return null;
  }

  const chatUIWithBranding = {
    ...displaySettings.chatUI,
    ...(displaySettings.brandingMessage?.trim()
      ? { brandingMessage: displaySettings.brandingMessage.trim() }
      : {}),
  };

  return (
    <AdminLiveChatAdapter
      botId={displaySettings.botId}
      mode={config.mode ?? "runtime"}
      botName={displaySettings.botName}
      avatarUrl={displaySettings.avatarUrl}
      avatarEmoji={displaySettings.avatarEmoji}
      chatUI={chatUIWithBranding}
      tagline={displaySettings.tagline}
      description={displaySettings.description}
      welcomeMessage={displaySettings.welcomeMessage}
      suggestedQuestions={displaySettings.suggestedQuestions}
      apiBaseUrl={config.apiBaseUrl}
      chatPostPath={config.chatPostPath}
      accessKey={config.accessKey}
      secretKey={config.secretKey}
      chatVisitorId={chatVisitorId}
      platformVisitorId={config.platformVisitorId}
      authToken={config.authToken}
      previewOverrides={config.mode === "preview" ? config.previewOverrides : undefined}
      debug={false}
      footerPrivacyText={displaySettings.privacyText}
      useFloatingLauncher
    />
  );
}
