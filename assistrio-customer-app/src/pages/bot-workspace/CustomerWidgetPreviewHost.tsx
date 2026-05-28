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
 * Playground path after `/bots/:id/playground/` — isolates preview widget init + sessionStorage.
 * Top-level sections use their first segment only; **Knowledge Base** uses the nested path (lists vs item)
 * but **detail and `/edit` share one scope** so opening an editor route does not remount the preview.
 */
function normalizeKnowledgebasePreviewScope(restNormalized: string): string {
  return restNormalized.replace(/\/edit\/?$/, '').replace(/\/$/, '') || 'knowledgebase';
}

function resolvePlaygroundPreviewVisitorScope(pathname: string, botId: string | undefined): string {
  if (!botId) return 'playground';
  const prefix = `/bots/${botId}/playground/`;
  if (!pathname.startsWith(prefix)) return 'playground';
  const rest = pathname.slice(prefix.length).replace(/\/$/, '');
  const segments = rest.split('/').filter(Boolean);
  const head = segments[0] ?? '';
  if (head === 'knowledgebase') return normalizeKnowledgebasePreviewScope(rest || 'knowledgebase');
  return head || 'playground';
}

/** Routes without the inline preview lane (`PlaygroundLayout` hides the right column). */
function isPlaygroundInlinePreviewHidden(pathname: string): boolean {
  return (
    /\/playground\/deploy\/?$/.test(pathname) ||
    /\/playground\/knowledgebase\/datasheets\/[^/]+\/fullscreen\/?$/.test(pathname)
  );
}

/** No widget preview at all (not even floating). */
function isPlaygroundWidgetPreviewFullyHidden(pathname: string): boolean {
  return /\/playground\/knowledgebase\/datasheets\/[^/]+\/fullscreen\/?$/.test(pathname);
}

/**
 * Live widget **only** under `/bots/:id/playground/...` (customer dashboard). Inside playground:
 * contained when the inline slot is open, else floating (bottom-right). Deploy & Go Live uses floating only.
 */
export function CustomerWidgetPreviewHost() {
  const { botId, loadState } = useBotWorkspace();
  const { pathname } = useLocation();
  const isPlaygroundRoute = /\/playground\//.test(pathname);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const {
    getActiveSurfaceElement,
    previewEpoch,
    previewWidgetGeneration,
    previewOverrides,
    inlineSlotWantsContained,
    setInlineSlotWantsContained,
    setContainedPanelExpanded,
  } = useCustomerWidgetPreview();

  useLayoutEffect(() => {
    if (!isPlaygroundRoute || isPlaygroundInlinePreviewHidden(pathname)) {
      setInlineSlotWantsContained(false);
    }
  }, [isPlaygroundRoute, pathname, setInlineSlotWantsContained]);
  const [fallbackEl, setFallbackEl] = useState<HTMLDivElement | null>(null);

  const activeSurface = useMemo(() => {
    void previewEpoch;
    return getActiveSurfaceElement();
  }, [getActiveSurfaceElement, previewEpoch]);

  const playgroundPreviewScope = resolvePlaygroundPreviewVisitorScope(pathname, botId);

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
      previewVisitorScope: playgroundPreviewScope,
      previewSourcePage:
        typeof window !== 'undefined' ? window.location.pathname.slice(0, 512) : playgroundPreviewScope,
      previewOverrides: forcedPreviewOverrides,
    };
  }, [apiBaseUrl, botId, loadState, playgroundPreviewScope, previewOverrides]);

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

  const hideInlinePreview = isPlaygroundInlinePreviewHidden(pathname);
  const hideWidgetPreviewEntirely = isPlaygroundWidgetPreviewFullyHidden(pathname);
  const useContained = isPlaygroundRoute && inlineSlotWantsContained && !hideInlinePreview;
  const rawConfig =
    isPlaygroundRoute && !hideWidgetPreviewEntirely
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
      {/** `previewVisitorScope` + key: fresh `/preview/init` and sessionStorage per playground sidebar section */}
      <EmbedWidgetRoot
        key={`${botId}:${playgroundPreviewScope}:${previewWidgetGeneration}`}
        rawConfig={rawConfig}
      />
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

  return typeof document !== 'undefined' ? createPortal(root, document.body) : null;
}
