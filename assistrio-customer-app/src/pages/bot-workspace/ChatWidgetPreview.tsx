import { useLayoutEffect, useMemo, useRef } from 'react';
import { useWidgetPreviewShell } from '@/layout/workspace-layout';
import { ws } from './workspace';
import { cn } from '@/lib/utils';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';

/** Default contained inline panel size (must match `CustomerWidgetPreviewHost` `containedInlineSize`). */
export const CUSTOMER_PREVIEW_STAGE_W = 398;
export const CUSTOMER_PREVIEW_STAGE_H = 698;

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
  const { botId } = useBotWorkspace();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { registerSurface } = useCustomerWidgetPreview();
  const shell = useWidgetPreviewShell();

  useLayoutEffect(() => {
    if (!botId || !apiBaseUrl || !mountId) return undefined;
    const el = surfaceRef.current;
    if (!el) return undefined;
    const priority = shell?.isFloatingPreviewOpen ? 10 : 0;
    return registerSurface({ id: mountId, element: el, priority });
  }, [apiBaseUrl, botId, mountId, registerSurface, shell?.isFloatingPreviewOpen]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col" data-widget-preview-workspace>
      <div
        className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-transparent"
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
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-4">
              <div
                ref={surfaceRef}
                data-widget-preview-portal-surface
                className="inline-flex max-w-[min(100%,calc(100vw-1.5rem))] shrink-0 flex-col overflow-visible rounded-2xl border border-slate-200/95 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]"
              />
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
