import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import type { EmbedChatConfig } from '@assistrio/chat-widget';
import { useBotWorkspace } from './BotWorkspaceContext';
import { toEmbedPreviewOverrides, useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import {
  CUSTOMER_PREVIEW_PANEL_H,
  CUSTOMER_PREVIEW_PORTAL_MAX_H_EXPANDED,
  CUSTOMER_PREVIEW_PORTAL_MAX_W,
  CUSTOMER_PREVIEW_STAGE_W,
} from './ChatWidgetPreview';

const EmbedWidgetRoot = lazy(() =>
  import('@assistrio/chat-widget').then((m) => ({ default: m.EmbedWidgetRoot })),
);

function resolveApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
}

/**
 * Live widget **only** under `/bots/:id/playground/...`. Inside playground: contained when the
 * inline slot is open, else floating. A stable off-screen portal root keeps the same React tree
 * when switching playground sections (brief gap with no surface) so the widget does not remount.
 */
export function CustomerWidgetPreviewHost() {
  const { botId, loadState } = useBotWorkspace();
  const { pathname } = useLocation();
  const isPlaygroundRoute = /\/playground\//.test(pathname);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const {
    getActiveSurfaceElement,
    previewEpoch,
    previewOverrides,
    inlineSlotWantsContained,
    setInlineSlotWantsContained,
    setContainedPanelExpanded,
  } = useCustomerWidgetPreview();

  useLayoutEffect(() => {
    if (!isPlaygroundRoute) setInlineSlotWantsContained(false);
  }, [isPlaygroundRoute, setInlineSlotWantsContained]);
  const [fallbackEl, setFallbackEl] = useState<HTMLDivElement | null>(null);

  const activeSurface = useMemo(() => {
    void previewEpoch;
    return getActiveSurfaceElement();
  }, [getActiveSurfaceElement, previewEpoch]);

  const previewBase = useMemo((): Partial<EmbedChatConfig> | null => {
    if (loadState !== 'ok' || !botId || !apiBaseUrl) return null;
    const po = toEmbedPreviewOverrides(previewOverrides);
    const forcedPreviewOverrides = {
      ...(po ?? {}),
      chatUI: {
        ...((po as { chatUI?: Record<string, unknown> } | null)?.chatUI ?? {}),
        openChatOnLoad: true,
      },
    } as NonNullable<EmbedChatConfig['previewOverrides']>;
    return {
      botId,
      apiBaseUrl,
      mode: 'preview',
      sessionPreview: true,
      position: 'right',
      previewOverrides: forcedPreviewOverrides,
    };
  }, [apiBaseUrl, botId, loadState, previewOverrides]);

  const onContainedPanelExpandChange = useCallback(
    (expanded: boolean) => {
      setContainedPanelExpanded(expanded);
    },
    [setContainedPanelExpanded],
  );

  const containedRawConfig = useMemo((): Partial<EmbedChatConfig> | null => {
    if (!previewBase) return null;
    return {
      ...previewBase,
      presentation: 'contained',
      showContainedLauncherPreview: true,
      onContainedPanelExpandChange,
      containedInlineSize: {
        collapsedWidth: CUSTOMER_PREVIEW_STAGE_W,
        collapsedHeight: CUSTOMER_PREVIEW_PANEL_H,
        expandedWidth: 560,
        expandedHeight: '75vh',
      },
    };
  }, [onContainedPanelExpandChange, previewBase]);

  const floatingRawConfig = useMemo((): Partial<EmbedChatConfig> | null => {
    if (!previewBase) return null;
    return { ...previewBase, presentation: 'floating' };
  }, [previewBase]);

  // Only the playground flow uses "contained" — keep false on insights/elsewhere (must not depend on early return: hooks run every render).
  const isDeployPlayground = isPlaygroundRoute && /\/playground\/deploy\/?$/.test(pathname);
  const useContained = isPlaygroundRoute && inlineSlotWantsContained && !isDeployPlayground;
  const rawConfig = isPlaygroundRoute
    ? useContained
      ? containedRawConfig
      : floatingRawConfig
    : null;

  useLayoutEffect(() => {
    if (!useContained) {
      setContainedPanelExpanded(false);
    }
  }, [setContainedPanelExpanded, useContained]);

  if (!isPlaygroundRoute) return null;
  if (!rawConfig) return null;

  const root = (
    <Suspense
      fallback={
        useContained ? (
          <div className="flex flex-1 items-center justify-center" aria-hidden>
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-300/90" />
          </div>
        ) : null
      }
    >
      {/** One key per bot so section changes / surface handoff do not remount the tree */}
      <EmbedWidgetRoot key={botId} rawConfig={rawConfig} />
    </Suspense>
  );
  const wrapped = (
    <div className="flex h-full max-h-full min-h-0 w-full max-w-full flex-col items-center">
      {root}
    </div>
  );

  if (useContained) {
    const target = activeSurface ?? fallbackEl;
    return (
      <>
        <div
          ref={setFallbackEl}
          aria-hidden
          data-customer-widget-preview-fallback
          className="pointer-events-none fixed left-0 top-0 -z-10 max-h-[100vh] max-w-[100vw] overflow-hidden opacity-0"
          style={{
            width: CUSTOMER_PREVIEW_PORTAL_MAX_W,
            height: CUSTOMER_PREVIEW_PORTAL_MAX_H_EXPANDED,
            minHeight: 0,
          }}
        />
        {target && typeof document !== 'undefined' ? createPortal(wrapped, target) : null}
      </>
    );
  }

  return typeof document !== 'undefined' ? createPortal(wrapped, document.body) : null;
}
