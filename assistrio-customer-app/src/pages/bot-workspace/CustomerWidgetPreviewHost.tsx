import { lazy, Suspense, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import type { EmbedChatConfig } from '@assistrio/chat-widget';
import { useBotWorkspace } from './BotWorkspaceContext';
import { toEmbedPreviewOverrides, useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { CUSTOMER_PREVIEW_STAGE_H, CUSTOMER_PREVIEW_STAGE_W } from './ChatWidgetPreview';

const EmbedWidgetRoot = lazy(() =>
  import('@assistrio/chat-widget').then((m) => ({ default: m.EmbedWidgetRoot })),
);

function resolveApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
}

/**
 * Inline `EmbedWidgetRoot` (contained) portaled into the active preview surface when a surface is
 * registered. Profile tab additionally mounts a hidden floating instance to warm that code path.
 */
export function CustomerWidgetPreviewHost() {
  const { botId, loadState } = useBotWorkspace();
  const { pathname } = useLocation();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const { getActiveSurfaceElement, previewEpoch, previewOverrides } = useCustomerWidgetPreview();
  /** Profile tab: hidden floating init in addition to the inline preview. */
  const mountFloatingShadowInit = /\/playground\/profile\/?$/.test(pathname);
  const [fallbackEl, setFallbackEl] = useState<HTMLDivElement | null>(null);

  /** Prefer registered inline/drawer surfaces; fallback only when none are connected + usable (see `pickActiveSurfaceElement`). */
  const activeSurface = useMemo(() => {
    void previewEpoch;
    return getActiveSurfaceElement();
  }, [getActiveSurfaceElement, previewEpoch]);

  const portalTarget = activeSurface ?? fallbackEl;

  const previewBase = useMemo((): Partial<EmbedChatConfig> | null => {
    if (loadState !== 'ok' || !botId || !apiBaseUrl) return null;
    const po = toEmbedPreviewOverrides(previewOverrides);
    return {
      botId,
      apiBaseUrl,
      mode: 'preview',
      sessionPreview: true,
      ...(po ? { previewOverrides: po } : {}),
    };
  }, [apiBaseUrl, botId, loadState, previewOverrides]);

  const containedRawConfig = useMemo((): Partial<EmbedChatConfig> | null => {
    if (!previewBase) return null;
    return {
      ...previewBase,
      presentation: 'contained',
      showContainedLauncherPreview: true,
      containedInlineSize: {
        collapsedWidth: CUSTOMER_PREVIEW_STAGE_W,
        collapsedHeight: CUSTOMER_PREVIEW_STAGE_H,
        expandedWidth: 560,
        expandedHeight: '75vh',
      },
    };
  }, [previewBase]);

  const floatingRawConfig = useMemo((): Partial<EmbedChatConfig> | null => {
    if (!previewBase) return null;
    return { ...previewBase, presentation: 'floating' };
  }, [previewBase]);

  return (
    <>
      <div
        ref={setFallbackEl}
        aria-hidden
        data-customer-widget-preview-fallback
        className="pointer-events-none fixed left-0 top-0 -z-10 h-[560px] w-[400px] max-h-[100vh] max-w-[100vw] overflow-hidden opacity-0"
      />
      {containedRawConfig && portalTarget
        ? createPortal(
            <div className="inline-flex max-w-full flex-col">
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center" aria-hidden>
                    <div className="h-9 w-9 animate-pulse rounded-full bg-slate-300/90" />
                  </div>
                }
              >
                {/* `key={botId}` remounts only when switching assistants; rawConfig is memoized for override edits. */}
                <EmbedWidgetRoot key={botId} rawConfig={containedRawConfig} />
              </Suspense>
            </div>,
            portalTarget,
          )
        : null}
      {floatingRawConfig && mountFloatingShadowInit ? (
        <div
          aria-hidden
          data-customer-widget-preview-floating-shadow-init
          className="pointer-events-none fixed left-0 top-0 -z-10 h-px w-px overflow-hidden opacity-0"
          style={{ transform: 'translateZ(0)' }}
        >
          <Suspense fallback={null}>
            <EmbedWidgetRoot key={`${botId}__preview_floating_shadow`} rawConfig={floatingRawConfig} />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}
