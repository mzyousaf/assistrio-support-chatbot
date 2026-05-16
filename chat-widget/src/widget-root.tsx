import { useEffect, useMemo, useRef, useState } from "react";

import { AdminLiveChatAdapter } from "./components/AdminLiveChatAdapter";
import { EmbedInitFailureCard } from "./components/EmbedInitFailureCard";
import { validateAndInitWidget } from "./api";
import { normalizeEmbedConfig } from "./config";
import { resolveEmbedInitFailurePresentation } from "./lib/embedInitFailurePresentation";
import { createStablePreviewOverridesKey } from "./lib/stablePreviewOverridesKey";
import { mergeWidgetStrings } from "./lib/widgetStrings";
import { resolveWidgetDisplayModel } from "./lib/resolveWidgetDisplayModel";
import { PANEL_COLLAPSED_HEIGHT_PX, PANEL_COLLAPSED_WIDTH_PX } from "./lib/embedPanelConstraints";
import type { EmbedChatConfig, WidgetInitResponse } from "./types";

type Phase = "loading" | "error" | "ready";

function chatVisitorIdStorageKey(botId: string, mode: "runtime" | "preview", previewVisitorScope?: string): string {
  const scope = previewVisitorScope?.trim();
  if (mode === "preview") {
    return scope
      ? `assistrio_chat_visitor_preview_id:${botId}:${scope}`
      : `assistrio_chat_visitor_preview_id:${botId}`;
  }
  return `assistrio_chat_visitor_id:${botId}`;
}

/** Init re-fetch when identity/session or non-preview-display embed fields change (`previewStableKey` drives display merges separately). */
function initKeyFromRawConfig(raw: Partial<EmbedChatConfig> | undefined): string {
  const rest = { ...(raw ?? {}) } as Record<string, unknown>;
  delete rest.previewOverrides;
  /** Layout-only; does not change init payload or server identity. */
  delete rest.presentation;
  delete rest.containedInlineSize;
  delete rest.showContainedLauncherPreview;
  delete rest.onContainedPanelExpandChange;
  /** Stable key order: avoid spurious init when object insertion order differs between renders. */
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(rest).sort()) {
    sorted[k] = rest[k];
  }
  return JSON.stringify(sorted);
}

/** Indeterminate arc spinner (matches ChatMessages + header loaders). */
function EmbedInitSpinnerGlyph({ className }: { className: string }) {
  return (
    <svg className={`${className} shrink-0 animate-spin motion-reduce:animate-none text-slate-500`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="26 58" />
    </svg>
  );
}

export interface EmbedWidgetRootProps {
  rawConfig: Partial<EmbedChatConfig>;
}

export function EmbedWidgetRoot({ rawConfig }: EmbedWidgetRootProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [initResponse, setInitResponse] = useState<WidgetInitResponse | null>(null);
  const [chatVisitorId, setChatVisitorId] = useState<string | null>(null);
  const [initErrorMessage, setInitErrorMessage] = useState<string>("");
  const [retryNonce, setRetryNonce] = useState(0);

  /** Dedupes concurrent in-flight inits (e.g. React Strict Mode runs the effect twice in dev). */
  const initInflightRef = useRef(new Map<string, Promise<WidgetInitResponse>>());

  const previewStableKey = createStablePreviewOverridesKey(
    (rawConfig as { previewOverrides?: unknown })?.previewOverrides,
  );

  /** Stable primitive: do not depend on `rawConfig` object identity (host may pass a new object each render). */
  const initKey = useMemo(() => initKeyFromRawConfig(rawConfig), [
    rawConfig?.botId,
    rawConfig?.apiBaseUrl,
    rawConfig?.mode,
    rawConfig?.accessKey,
    rawConfig?.secretKey,
    rawConfig?.authToken,
    rawConfig?.sessionPreview,
    rawConfig?.previewVisitorScope,
    rawConfig?.persistChatSession,
    rawConfig?.position,
    rawConfig?.chatPostPath,
    rawConfig?.widgetInitPath,
    rawConfig?.embedOrigin,
    rawConfig?.locale,
    rawConfig?.disableRemoteConfig,
    rawConfig?.chatVisitorId,
  ]);

  const config = useMemo(() => normalizeEmbedConfig(rawConfig), [rawConfig, previewStableKey]);

  const shellStrings = useMemo(
    () => mergeWidgetStrings(config.widgetStrings, config.locale),
    [config.widgetStrings, config.locale],
  );

  useEffect(() => {
    const compositeKey = `${initKey}:${retryNonce}`;
    let cancelled = false;
    setPhase("loading");
    setInitErrorMessage("");

    const inflight = initInflightRef.current;
    let flight = inflight.get(compositeKey);
    if (!flight) {
      flight = (async (): Promise<WidgetInitResponse> => {
        const normalized = normalizeEmbedConfig(rawConfig);
        const mode = normalized.mode ?? "runtime";
        const authPreview =
          (typeof normalized.authToken === "string" && normalized.authToken.trim() !== "") ||
          normalized.sessionPreview === true;

        const storageKey = chatVisitorIdStorageKey(
          normalized.botId,
          mode,
          normalized.mode === "preview" ? normalized.previewVisitorScope : undefined,
        );
        const persistChatSession = normalized.persistChatSession !== false;
        const existingRuntimeVisitorId =
          !authPreview && persistChatSession && typeof window !== "undefined" && window.localStorage
            ? window.localStorage.getItem(storageKey)
            : null;
        const existingPreviewSessionVisitorId =
          authPreview && mode === "preview" && typeof window !== "undefined" && window.sessionStorage
            ? window.sessionStorage.getItem(storageKey)
            : null;

        const initRequestConfig: Partial<EmbedChatConfig> = {
          ...rawConfig,
          ...((existingRuntimeVisitorId ?? existingPreviewSessionVisitorId)
            ? { chatVisitorId: (existingRuntimeVisitorId ?? existingPreviewSessionVisitorId) as string }
            : {}),
        };
        if (authPreview && !existingPreviewSessionVisitorId) {
          delete (initRequestConfig as { chatVisitorId?: string }).chatVisitorId;
        }
        if (mode === "preview") {
          delete initRequestConfig.previewOverrides;
        }

        return validateAndInitWidget(initRequestConfig);
      })();

      inflight.set(compositeKey, flight);
      flight.finally(() => {
        if (inflight.get(compositeKey) === flight) inflight.delete(compositeKey);
      });
    }

    const applyInitResult = (init: WidgetInitResponse) => {
      if (cancelled) return;

      const normalized = normalizeEmbedConfig(rawConfig);
      const mode = normalized.mode ?? "runtime";
      const authPreview =
        (typeof normalized.authToken === "string" && normalized.authToken.trim() !== "") ||
        normalized.sessionPreview === true;

      const storageKey = chatVisitorIdStorageKey(
        normalized.botId,
        mode,
        normalized.mode === "preview" ? normalized.previewVisitorScope : undefined,
      );
      const persistChatSession = normalized.persistChatSession !== false;
      const existingRuntimeVisitorId =
        !authPreview && persistChatSession && typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem(storageKey)
          : null;

      setInitResponse(init);

      if (authPreview && !(typeof init.chatVisitorId === "string" && init.chatVisitorId.trim())) {
        setChatVisitorId("");
      } else if (typeof init.chatVisitorId === "string" && init.chatVisitorId.trim()) {
        const id = init.chatVisitorId.trim();
        if (typeof window !== "undefined") {
          if (authPreview && mode === "preview" && window.sessionStorage) {
            window.sessionStorage.setItem(storageKey, id);
          } else if (persistChatSession && !authPreview && window.localStorage) {
            window.localStorage.setItem(storageKey, id);
          }
        }
        setChatVisitorId(id);
      } else if (existingRuntimeVisitorId) {
        setChatVisitorId(existingRuntimeVisitorId);
      } else {
        setChatVisitorId(null);
      }
      setPhase("ready");
    };

    void flight.then(applyInitResult).catch((e: unknown) => {
      if (cancelled) return;
      const msg = e instanceof Error ? e.message : "Chat unavailable.";
      if (typeof console !== "undefined" && console.error) {
        console.error("[Assistrio embed]", msg);
      }
      setInitResponse(null);
      setInitErrorMessage(msg);
      setPhase("error");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewOverrides excluded from initKey (would re-hit /preview/init and clear threads); previewStableKey only refreshes merged display via memos below
  }, [initKey, retryNonce]);

  const displaySettings = useMemo(
    () => resolveWidgetDisplayModel(initResponse, config),
    /** `previewStableKey` is order-insensitive on plain objects so preview stays live without spurious fingerprint churn. */
    [initResponse, config, previewStableKey],
  );

  const loadingPositionClass =
    rawConfig?.position === "left" ? "bottom-4 left-4" : "bottom-4 right-4";
  const contained = (config.presentation ?? "floating") === "contained";

  const containedCollapsedW =
    typeof config.containedInlineSize?.collapsedWidth === "number" &&
    Number.isFinite(config.containedInlineSize.collapsedWidth)
      ? Math.round(config.containedInlineSize.collapsedWidth)
      : PANEL_COLLAPSED_WIDTH_PX;
  const containedCollapsedH =
    typeof config.containedInlineSize?.collapsedHeight === "number" &&
    Number.isFinite(config.containedInlineSize.collapsedHeight)
      ? Math.round(config.containedInlineSize.collapsedHeight)
      : PANEL_COLLAPSED_HEIGHT_PX;

  if (phase === "loading") {
    if (contained) {
      return (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading chat"
          className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/80"
          style={{ width: containedCollapsedW, height: containedCollapsedH }}
        >
          <EmbedInitSpinnerGlyph className="h-9 w-9 max-h-[min(2.25rem,100%)] max-w-[min(2.25rem,100%)]" />
        </div>
      );
    }
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading chat"
        className={`fixed z-[9999] flex h-10 w-10 items-center justify-center ${loadingPositionClass}`}
      >
        <EmbedInitSpinnerGlyph className="h-7 w-7" />
      </div>
    );
  }

  if (phase === "error") {
    const pres = resolveEmbedInitFailurePresentation(initErrorMessage);
    const err = initErrorMessage.trim();
    const showDetail = Boolean(err && pres.icon !== "network" && err !== pres.description.trim());

    const errorCard = (
      <EmbedInitFailureCard
        icon={pres.icon}
        title={pres.title}
        description={pres.description}
        detail={showDetail ? initErrorMessage : null}
        primaryLabel={shellStrings.initErrorRetry}
        onPrimary={() => setRetryNonce((n) => n + 1)}
      />
    );
    if (contained) {
      return (
        <div
          className="inline-flex max-w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/80 p-2"
          style={{ width: containedCollapsedW, minWidth: 0, minHeight: containedCollapsedH }}
          role="alert"
        >
          <div className="min-h-0 w-full min-w-0 overflow-auto">{errorCard}</div>
        </div>
      );
    }
    return (
      <div
        className={`fixed z-[9999] w-[min(100vw-2rem,26rem)] max-w-[min(100vw-2rem,26rem)] ${loadingPositionClass}`}
        role="alert"
      >
        {errorCard}
      </div>
    );
  }

  if (!displaySettings) {
    return null;
  }
  if (chatVisitorId === null) {
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
      suggestedQuestionChips={displaySettings.suggestedQuestionChips}
      apiBaseUrl={config.apiBaseUrl}
      chatPostPath={config.chatPostPath}
      accessKey={config.accessKey}
      secretKey={config.secretKey}
      chatVisitorId={chatVisitorId}
      authToken={config.authToken}
      previewOverrides={config.mode === "preview" ? config.previewOverrides : undefined}
      debug={false}
      footerPrivacyText={displaySettings.privacyText}
      useFloatingLauncher={!contained}
      visitorMultiChatEnabled={displaySettings.visitorMultiChatEnabled}
      visitorMultiChatMax={displaySettings.visitorMultiChatMax}
      widgetStrings={shellStrings}
      inlinePanelCollapsedWidth={config.containedInlineSize?.collapsedWidth}
      inlinePanelCollapsedHeight={config.containedInlineSize?.collapsedHeight}
      inlinePanelExpandedWidth={config.containedInlineSize?.expandedWidth}
      inlinePanelExpandedHeight={config.containedInlineSize?.expandedHeight}
      showContainedLauncherPreview={contained && config.showContainedLauncherPreview === true}
      onContainedPanelExpandChange={config.onContainedPanelExpandChange}
      serverConversationIdFromInit={initResponse?.conversationId}
      previewSourcePage={config.previewSourcePage}
      previewVisitorScope={config.mode === "preview" ? config.previewVisitorScope : undefined}
    />
  );
}
