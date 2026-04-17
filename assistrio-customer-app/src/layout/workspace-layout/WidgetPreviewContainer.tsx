'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { WIDGET_PREVIEW_EDITOR_MAX_PX, WIDGET_PREVIEW_PREVIEW_MIN_PX } from './constants';
import { PreviewCollapseHeaderButton, PreviewExpandEyeButton } from './PreviewCollapseRail';
import { PreviewPane } from './PreviewPane';

export { WIDGET_PREVIEW_EDITOR_MAX_PX, WIDGET_PREVIEW_PREVIEW_MIN_PX } from './constants';

export type WidgetPreviewBreakpoint = 'small' | 'medium' | 'large' | 'xlarge';

export type WidgetPreviewShellContextValue = {
  breakpoint: WidgetPreviewBreakpoint;
  /** Preview / Open preview / Agent Preview (large collapsed) in the section header */
  showHeaderPreviewTrigger: boolean;
  headerPreviewLabel: 'Preview' | 'Open preview' | 'Agent Preview' | null;
  openPreview: () => void;
  closePreview: () => void;
  /** Overlay or drawer is open (width &lt; 1440) */
  isFloatingPreviewOpen: boolean;
  /** 1440–1920: inline preview hidden */
  isInlineCollapsed: boolean;
};

const WidgetPreviewShellContext = createContext<WidgetPreviewShellContextValue | null>(null);

export function useWidgetPreviewShell(): WidgetPreviewShellContextValue | null {
  return useContext(WidgetPreviewShellContext);
}

/** @deprecated Prefer useWidgetPreviewShell */
export function useWidgetPreviewMobile() {
  const shell = useWidgetPreviewShell();
  if (!shell) return null;
  return { openMobilePreview: shell.openPreview };
}

function tierFromMedia(ge1080: boolean, ge1440: boolean, ge1920: boolean): WidgetPreviewBreakpoint {
  if (!ge1080) return 'small';
  if (!ge1440) return 'medium';
  if (!ge1920) return 'large';
  return 'xlarge';
}

function useWidgetPreviewBreakpoint(): WidgetPreviewBreakpoint {
  const [tier, setTier] = useState<WidgetPreviewBreakpoint>(() =>
    typeof window === 'undefined'
      ? 'small'
      : tierFromMedia(
          window.matchMedia('(min-width: 1080px)').matches,
          window.matchMedia('(min-width: 1440px)').matches,
          window.matchMedia('(min-width: 1920px)').matches,
        ),
  );

  useEffect(() => {
    const m1080 = window.matchMedia('(min-width: 1080px)');
    const m1440 = window.matchMedia('(min-width: 1440px)');
    const m1920 = window.matchMedia('(min-width: 1920px)');
    const sync = () => setTier(tierFromMedia(m1080.matches, m1440.matches, m1920.matches));
    sync();
    m1080.addEventListener('change', sync);
    m1440.addEventListener('change', sync);
    m1920.addEventListener('change', sync);
    return () => {
      m1080.removeEventListener('change', sync);
      m1440.removeEventListener('change', sync);
      m1920.removeEventListener('change', sync);
    };
  }, []);

  return tier;
}

export type WidgetPreviewRenderArgs = {
  /** Pass to your preview root if it hosts a portal target */
  mountId?: string;
};

export type WidgetPreviewContainerProps = {
  children: ReactNode;
  /** Optional right-lane preview; when omitted, children are centered with max width */
  preview?: ReactNode | ((args: WidgetPreviewRenderArgs) => ReactNode);
  /** Stable id for createPortal targets (e.g. widget preview iframe mount) */
  previewMountId?: string;
  previewTitle?: string;
  previewDescription?: string;
  className?: string;
};

/**
 * Responsive workspace shell: editor + optional preview.
 * - &lt;1080: editor only; floating full-width preview from header
 * - 1080–1440: editor only; right drawer preview
 * - 1440–1920: inline preview + animated collapse rail between panes
 * - ≥1920: inline preview (grid, no rail)
 */
export function WidgetPreviewContainer({
  children,
  preview,
  previewMountId,
  previewTitle = 'Preview',
  previewDescription,
  className,
}: WidgetPreviewContainerProps) {
  const tier = useWidgetPreviewBreakpoint();
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [inlineCollapsed, setInlineCollapsed] = useState(false);

  const resolvedPreview = useMemo(() => {
    if (preview == null) return null;
    if (typeof preview === 'function') {
      return preview({ mountId: previewMountId });
    }
    return preview;
  }, [preview, previewMountId]);

  const hasResolvedPreview = resolvedPreview != null;
  const useLargeCollapsibleGrid = tier === 'large' && hasResolvedPreview;
  const useXlargeGrid = tier === 'xlarge' && hasResolvedPreview;

  useEffect(() => {
    if (tier === 'xlarge' || tier === 'large') setFloatingOpen(false);
    if (tier === 'xlarge') setInlineCollapsed(false);
  }, [tier]);

  useEffect(() => {
    if (!floatingOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFloatingOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [floatingOpen]);

  const closeFloating = useCallback(() => setFloatingOpen(false), []);

  const openPreview = useCallback(() => {
    if (tier === 'large' && inlineCollapsed) setInlineCollapsed(false);
    else if (tier === 'small' || tier === 'medium') setFloatingOpen(true);
  }, [tier, inlineCollapsed]);

  const closePreview = useCallback(() => {
    if (tier === 'small' || tier === 'medium') setFloatingOpen(false);
  }, [tier]);

  const toggleLargeInline = useCallback(() => {
    if (tier === 'large') setInlineCollapsed((c) => !c);
  }, [tier]);

  const shellValue = useMemo<WidgetPreviewShellContextValue>(() => {
    const showHeader =
      tier === 'small' || tier === 'medium' || (tier === 'large' && inlineCollapsed);
    let label: WidgetPreviewShellContextValue['headerPreviewLabel'] = null;
    if (showHeader) {
      if (tier === 'small') label = 'Preview';
      else if (tier === 'medium') label = 'Open preview';
      else label = 'Agent Preview';
    }
    return {
      breakpoint: tier,
      showHeaderPreviewTrigger: showHeader,
      headerPreviewLabel: label,
      openPreview,
      closePreview,
      isFloatingPreviewOpen: floatingOpen && (tier === 'small' || tier === 'medium'),
      isInlineCollapsed: tier === 'large' && inlineCollapsed,
    };
  }, [tier, inlineCollapsed, floatingOpen, openPreview, closePreview]);

  const floatingLeadingToolbar = (
    <div className="flex items-center gap-1 border-b border-slate-200/80 px-2 py-2 sm:px-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 px-2 text-slate-700"
        onClick={closeFloating}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Editor
      </Button>
    </div>
  );

  const editorColumn = (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 w-full flex-col',
        useLargeCollapsibleGrid ? 'overflow-x-hidden overflow-y-hidden' : 'overflow-hidden',
        !useLargeCollapsibleGrid && !useXlargeGrid && 'flex-1',
      )}
    >
      {useLargeCollapsibleGrid && inlineCollapsed ? (
        <PreviewExpandEyeButton onExpand={toggleLargeInline} />
      ) : null}
      <div className="flex min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 py-6 pb-12 sm:px-6 md:px-8 md:py-8">
          <div className="w-full min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );

  const previewAside = (
    <aside
      className={cn(
        'relative flex h-full min-h-0 min-w-0 flex-col border-l border-slate-200/80 bg-white',
        useLargeCollapsibleGrid ? 'overflow-x-hidden overflow-y-hidden' : 'overflow-hidden',
      )}
      aria-label="Preview"
    >
      <PreviewPane
        title={previewTitle}
        description={previewDescription}
        headerTrailing={
          useLargeCollapsibleGrid && !inlineCollapsed ? (
            <PreviewCollapseHeaderButton onCollapse={toggleLargeInline} />
          ) : undefined
        }
        className={cn(
          'min-h-0 min-w-0 flex-1 border-l-0',
          useLargeCollapsibleGrid && 'min-w-0 overflow-x-hidden',
        )}
      >
        {resolvedPreview}
      </PreviewPane>
    </aside>
  );

  const workspaceGridStyle = useMemo(() => {
    if (useLargeCollapsibleGrid) {
      return {
        gridTemplateColumns: inlineCollapsed
          ? `minmax(0, 1fr) minmax(0, 0fr)`
          : `minmax(0, ${WIDGET_PREVIEW_EDITOR_MAX_PX}px) minmax(${WIDGET_PREVIEW_PREVIEW_MIN_PX}px, 1fr)`,
      } as CSSProperties;
    }
    if (useXlargeGrid) {
      return {
        gridTemplateColumns: `minmax(0, ${WIDGET_PREVIEW_EDITOR_MAX_PX}px) minmax(${WIDGET_PREVIEW_PREVIEW_MIN_PX}px, 1fr)`,
      } as CSSProperties;
    }
    return undefined;
  }, [useLargeCollapsibleGrid, useXlargeGrid, inlineCollapsed]);

  if (resolvedPreview == null) {
    return (
      <div
        className={cn(
          'flex h-[calc(100dvh-var(--nav-height))] min-h-0 min-w-0 w-full flex-col overflow-x-hidden overflow-y-hidden',
          className,
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 justify-center overflow-x-hidden overflow-y-auto">
          <div
            className="flex min-h-0 w-full min-w-0 max-w-[var(--editor-max)] flex-1 flex-col px-4 py-6 pb-12 sm:px-6 md:px-8 md:py-8"
            style={{ ['--editor-max' as string]: `${WIDGET_PREVIEW_EDITOR_MAX_PX}px` }}
          >
            <div className="w-full min-w-0">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WidgetPreviewShellContext.Provider value={shellValue}>
      <div
        className={cn(
          'relative flex h-[calc(100dvh-var(--nav-height))] min-h-0 min-w-0 w-full flex-col',
          'overflow-x-hidden overflow-y-hidden',
          className,
        )}
      >
        <div
          className={cn(
            'min-h-0 min-w-0 flex-1',
            'overflow-x-hidden overflow-y-hidden',
            (useLargeCollapsibleGrid || useXlargeGrid) && 'grid',
            useLargeCollapsibleGrid &&
              'transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none',
            !useLargeCollapsibleGrid && !useXlargeGrid && 'flex min-h-0 min-w-0 flex-row',
          )}
          style={workspaceGridStyle}
        >
          {useLargeCollapsibleGrid ? (
            <>
              {editorColumn}
              {previewAside}
            </>
          ) : useXlargeGrid ? (
            <>
              {editorColumn}
              {previewAside}
            </>
          ) : (
            editorColumn
          )}
        </div>

        {floatingOpen && (tier === 'small' || tier === 'medium') ? (
          <>
            <button
              type="button"
              className="fixed z-[35] cursor-default border-0 bg-slate-900/25"
              style={{
                top: 'var(--nav-height)',
                left: 0,
                right: 0,
                bottom: 0,
              }}
              aria-label="Close preview"
              onClick={closeFloating}
            />
            <div
              className={cn(
                'fixed z-40 flex flex-col overflow-hidden bg-white shadow-2xl',
                tier === 'small'
                  ? 'inset-x-0 bottom-0 top-[var(--nav-height)] border-t border-slate-200/80'
                  : 'bottom-0 right-0 top-[var(--nav-height)] w-[min(440px,100%)] max-w-full border-l border-slate-200/80',
              )}
              role="dialog"
              aria-modal="true"
              aria-label={previewTitle}
            >
              <PreviewPane
                title={previewTitle}
                description={previewDescription}
                leadingToolbar={floatingLeadingToolbar}
                className="min-h-0 min-w-0 flex-1 border-l-0 border-t-0"
              >
                {resolvedPreview}
              </PreviewPane>
            </div>
          </>
        ) : null}
      </div>
    </WidgetPreviewShellContext.Provider>
  );
}
