import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWidgetPreviewShell } from '@/layout/workspace-layout';
import { ws } from './workspace';
import { cn } from '@/lib/utils';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';

/**
 * Contained **chat panel** (dark box) default height. Matches widget `PANEL_COLLAPSED_HEIGHT` / embed
 * `containedInlineSize.collapsedHeight` for the live preview.
 */
export const CUSTOMER_PREVIEW_PANEL_H = 730;

/**
 * Space reserved **below** the panel for the decorative contained launcher (`ContainedLauncherPreview`:
 * `bottom: -N` + ring). The widget shrinks the panel by `containedLauncherPreviewBottomOutsetPx`
 * when the launcher is shown; this cap is only for the portal surface’s `max-height` (N peaks near
 * ~84px at 96px launcher, plus margin).
 */
export const CUSTOMER_PREVIEW_LAUNCHER_RESERVE_PX = 100;

/** Kept for reference; portal `max-height` uses {@link CUSTOMER_PREVIEW_PORTAL_MAX_H_COLLAPSED} / {@link CUSTOMER_PREVIEW_PORTAL_MAX_H_EXPANDED}. */
export const CUSTOMER_PREVIEW_STAGE_H = CUSTOMER_PREVIEW_PANEL_H + CUSTOMER_PREVIEW_LAUNCHER_RESERVE_PX;

/** Default collapsed `containedInlineSize.collapsedWidth` in the playground embed. */
export const CUSTOMER_PREVIEW_STAGE_W = 404;

/**
 * Portal surface `max-width` must be at least embed `expandedWidth` (560) or “Expand chat” is clipped.
 */
export const CUSTOMER_PREVIEW_PORTAL_MAX_W = 560;

/** `maxHeight: min(100%, N)` on the preview portal when the contained panel is **collapsed**. */
export const CUSTOMER_PREVIEW_PORTAL_MAX_H_COLLAPSED = 850;

/** `maxHeight: min(100%, N)` when the contained panel is **expanded** (from widget callback). */
export const CUSTOMER_PREVIEW_PORTAL_MAX_H_EXPANDED = 1000;

export type ChatWidgetPreviewProps = {
  /** Stable id for the portal mount surface (from `WidgetPreviewContainer` `previewMountId`). */
  mountId?: string;
};

function resolveApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
}

/**
 * Right-lane preview chrome + **portal surface** only. The live widget is rendered by
 * `CustomerWidgetPreviewHost` (single instance per workspace).
 */
export function ChatWidgetPreview({ mountId }: ChatWidgetPreviewProps) {
  const { pathname } = useLocation();
  const isPlaygroundRoute = /\/playground\//.test(pathname);
  const { botId } = useBotWorkspace();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { registerSurface, setInlineSlotWantsContained, containedPanelExpanded } = useCustomerWidgetPreview();
  const shell = useWidgetPreviewShell();

  /** No cleanup that sets `false` — it runs before the next page’s effect and briefly flips to floating (remount). */
  useLayoutEffect(() => {
    if (!isPlaygroundRoute) {
      setInlineSlotWantsContained(false);
      return;
    }
    if (!botId || !apiBaseUrl) {
      setInlineSlotWantsContained(false);
      return;
    }
    if (!shell) {
      setInlineSlotWantsContained(false);
      return;
    }
    const { breakpoint, isInlineCollapsed, isFloatingPreviewOpen } = shell;
    const inlineVisible =
      breakpoint === 'xlarge' ||
      (breakpoint === 'large' && !isInlineCollapsed) ||
      ((breakpoint === 'small' || breakpoint === 'medium') && isFloatingPreviewOpen);
    setInlineSlotWantsContained(inlineVisible);
  }, [apiBaseUrl, botId, isPlaygroundRoute, setInlineSlotWantsContained, shell, shell?.breakpoint, shell?.isInlineCollapsed, shell?.isFloatingPreviewOpen]);

  useLayoutEffect(() => {
    if (!botId || !apiBaseUrl || !mountId) return undefined;
    const el = surfaceRef.current;
    if (!el) return undefined;
    const priority = shell?.isFloatingPreviewOpen ? 10 : 0;
    return registerSurface({ id: mountId, element: el, priority });
  }, [apiBaseUrl, botId, mountId, registerSurface, shell?.isFloatingPreviewOpen]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden" data-widget-preview-workspace>
      <div
        className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden bg-transparent"
        data-widget-preview-frame
      >
        <div
          id={mountId}
          data-widget-preview-stage
          data-widget-preview-mount-root
          className="flex min-h-0 flex-1 flex-col bg-transparent"
        >
          {!botId ? (
            <p className={cn(ws.workspaceEditorPreviewBody, 'm-auto px-4 py-6 text-center text-slate-600')}>
              Open an assistant to see the widget preview.
            </p>
          ) : !apiBaseUrl ? (
            <p className={cn(ws.workspaceEditorPreviewBody, 'm-auto px-4 py-6 text-center text-slate-600')}>
              Set <code className="text-xs">VITE_API_BASE_URL</code> to your API origin for preview.
            </p>
          ) : (
            <div
              className="flex h-full max-h-full min-h-0 w-full min-w-0 flex-1 flex-col"
              data-widget-preview-measure
            >
              <div className="flex h-full max-h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center">
                <div
                  ref={surfaceRef}
                  data-widget-preview-portal-surface
                  data-widget-preview-panel-expanded={containedPanelExpanded ? 'true' : 'false'}
                  className="box-border flex h-full min-h-0 w-full min-w-0 max-h-full max-w-full flex-1 flex-col self-center overflow-x-hidden"
                  style={{
                    maxWidth: `min(100%, ${CUSTOMER_PREVIEW_PORTAL_MAX_W}px)`,
                    maxHeight: `min(100%, ${
                      containedPanelExpanded
                        ? CUSTOMER_PREVIEW_PORTAL_MAX_H_EXPANDED
                        : CUSTOMER_PREVIEW_PORTAL_MAX_H_COLLAPSED
                    }px)`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Pane heading / subcopy for `WidgetPreviewContainer` — use on every workspace page for consistency. */
export const WORKSPACE_WIDGET_PREVIEW_PANE = {
  title: 'Widget preview',
  description: 'Live preview when the embed is connected.',
} as const;
