'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { WIDGET_PREVIEW_EDITOR_MAX_PX, WIDGET_PREVIEW_PREVIEW_MIN_PX } from './constants';
import { PreviewCollapseHeaderButton, PreviewExpandEyeButton } from './PreviewCollapseRail';
import { PreviewPane } from './PreviewPane';

export { WIDGET_PREVIEW_EDITOR_MAX_PX, WIDGET_PREVIEW_PREVIEW_MIN_PX } from './constants';

export type WidgetPreviewBreakpoint = 'small' | 'medium' | 'large' | 'xlarge';

export type WidgetPreviewShellContextValue = {
  breakpoint: WidgetPreviewBreakpoint;
  /** Reserved; preview opens from the docked preview control on the editor edge */
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

/**
 * KB item detail + edit (`KnowledgeItemDetailPageShell` / edit forms).
 * Fixes editor column height so scrolling happens inside the surfaced card, not the whole playground column.
 * Excludes datasheet `…/fullscreen` and list routes.
 */
function isPlaygroundKnowledgeItemDetailOrEditPath(pathname: string): boolean {
  if (!/\/playground\/knowledgebase\//.test(pathname)) return false;
  return (
    /\/playground\/knowledgebase\/documents\/[^/]+(\/edit)?\/?$/.test(pathname) ||
    /\/playground\/knowledgebase\/faqs\/[^/]+(\/edit)?\/?$/.test(pathname) ||
    /\/playground\/knowledgebase\/snippets\/[^/]+(\/edit)?\/?$/.test(pathname) ||
    /\/playground\/knowledgebase\/suggestions\/[^/]+(\/edit)?\/?$/.test(pathname) ||
    /\/playground\/knowledgebase\/datasheets\/[^/]+\/?$/.test(pathname) ||
    /\/playground\/knowledgebase\/datasheets\/[^/]+\/edit\/?$/.test(pathname)
  );
}

function tierFromMedia(ge1080: boolean, ge1440: boolean, ge1920: boolean): WidgetPreviewBreakpoint {
  if (!ge1080) return 'small';
  if (!ge1440) return 'medium';
  if (!ge1920) return 'large';
  return 'xlarge';
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
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
  /**
   * Optional class for `PreviewPane` scroll body (e.g. tighter padding for widget preview).
   * When omitted, default preview padding is used.
   */
  previewBodyClassName?: string;
  /**
   * When true, the preview pane body scrolls vertically (playground widget lane). Keeps editor scroll
   * separate from the preview column on tall pages.
   */
  previewBodyScrollable?: boolean;
  className?: string;
  /**
   * When there is no preview, the editor is normally centered with `max-w` (see `WIDGET_PREVIEW_EDITOR_MAX_PX`).
   * Set true for routes that should use the full main width (e.g. datasheet full screen).
   */
  editorFullWidth?: boolean;
};

/**
 * Responsive workspace shell: editor + optional preview.
 * - &lt;1440: editor only; open preview via docked edge control (full-width or drawer)
 * - 1440–1920: inline preview + collapse control, or docked edge control when collapsed
 * - ≥1920: inline preview (grid, no rail)
 */
export function WidgetPreviewContainer({
  children,
  preview,
  previewMountId,
  previewTitle = 'Preview',
  previewDescription,
  previewBodyClassName,
  previewBodyScrollable = false,
  className,
  editorFullWidth = false,
}: WidgetPreviewContainerProps) {
  const { pathname } = useLocation();
  const suppressEditorBodyScrollY = isPlaygroundKnowledgeItemDetailOrEditPath(pathname);
  const tier = useWidgetPreviewBreakpoint();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [floatingOpen, setFloatingOpen] = useState(false);
  /** Drives CSS transition after mount / before unmount (floating small & medium only) */
  const [floatingEntered, setFloatingEntered] = useState(false);
  /** True while the exit animation runs (avoids stale transitionend + unlocks backdrop hits) */
  const [floatingClosing, setFloatingClosing] = useState(false);
  const floatingClosingRef = useRef(false);
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
  /** Editor + preview columns both visible — popovers must not clip on the editor edge or paint under the preview lane. */
  const dualPaneInlinePreview =
    hasResolvedPreview && (useXlargeGrid || (useLargeCollapsibleGrid && !inlineCollapsed));

  useEffect(() => {
    if (tier === 'xlarge' || tier === 'large') {
      setFloatingOpen(false);
      setFloatingEntered(false);
      floatingClosingRef.current = false;
      setFloatingClosing(false);
    }
    if (tier === 'xlarge') setInlineCollapsed(false);
  }, [tier]);

  useEffect(() => {
    const isFloatTier = tier === 'small' || tier === 'medium';
    if (!floatingOpen || !isFloatTier) {
      setFloatingEntered(false);
      return;
    }
    if (prefersReducedMotion) {
      setFloatingEntered(true);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFloatingEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [floatingOpen, tier, prefersReducedMotion]);

  const finishFloatingClose = useCallback(() => {
    floatingClosingRef.current = false;
    setFloatingClosing(false);
    setFloatingOpen(false);
    setFloatingEntered(false);
  }, []);

  const requestCloseFloating = useCallback(() => {
    if (prefersReducedMotion) {
      finishFloatingClose();
      return;
    }
    floatingClosingRef.current = true;
    setFloatingClosing(true);
    setFloatingEntered(false);
  }, [prefersReducedMotion, finishFloatingClose]);

  const onFloatingPanelTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const p = e.propertyName;
      if (p !== 'transform' && p !== '-webkit-transform') return;
      /** Opening also transitions transform; only commit unmount after a user-initiated close */
      if (!floatingClosingRef.current) return;
      finishFloatingClose();
    },
    [finishFloatingClose],
  );

  /** If transitionend never fires (browser quirks), still tear down the modal layer */
  useEffect(() => {
    if (!floatingClosing) return;
    const id = window.setTimeout(() => {
      finishFloatingClose();
    }, 420);
    return () => window.clearTimeout(id);
  }, [floatingClosing, finishFloatingClose]);

  useEffect(() => {
    if (!floatingOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestCloseFloating();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [floatingOpen, requestCloseFloating]);

  const closeFloating = requestCloseFloating;

  const openPreview = useCallback(() => {
    if (tier === 'large' && inlineCollapsed) setInlineCollapsed(false);
    else if (tier === 'small' || tier === 'medium') {
      floatingClosingRef.current = false;
      setFloatingClosing(false);
      setFloatingOpen(true);
    }
  }, [tier, inlineCollapsed]);

  const closePreview = useCallback(() => {
    if (tier === 'small' || tier === 'medium') requestCloseFloating();
  }, [tier, requestCloseFloating]);

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

  const editorColumn = (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 w-full flex-col',
        dualPaneInlinePreview
          ? 'z-10 overflow-visible'
          : useLargeCollapsibleGrid
            ? 'overflow-x-hidden overflow-y-hidden'
            : 'overflow-hidden',
        /** Preview aside is after this node in the grid; when collapsed, stack editor (and docked expand control) above a 0-width lane */
        useLargeCollapsibleGrid && inlineCollapsed && 'z-30',
        !useLargeCollapsibleGrid && !useXlargeGrid && 'flex-1',
      )}
    >
      {useLargeCollapsibleGrid && inlineCollapsed ? (
        <PreviewExpandEyeButton onExpand={toggleLargeInline} />
      ) : null}
      {hasResolvedPreview && (tier === 'small' || tier === 'medium') && !floatingOpen ? (
        <PreviewExpandEyeButton onExpand={openPreview} />
      ) : null}
      <div
        className={cn(
          'flex min-h-0 min-w-0 w-full flex-1 flex-col',
          !dualPaneInlinePreview && 'overflow-x-hidden',
          suppressEditorBodyScrollY ? 'overflow-y-hidden' : 'overflow-y-auto overscroll-y-contain',
          'px-4 pt-6 pb-6 sm:px-6 md:px-8 md:pt-8 md:pb-6',
        )}
      >
        {/** Horizontal + top padding; bottom padding only here (single source) so it isn’t stacked with layouts/pages. */}
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">{children}</div>
      </div>
    </div>
  );

  const previewAside = (
    <aside
      className={cn(
        'relative flex h-full min-h-0 min-w-0 flex-col border-l border-slate-200/80 bg-white',
        dualPaneInlinePreview && 'z-0',
        useLargeCollapsibleGrid ? 'overflow-x-hidden overflow-y-hidden' : 'overflow-hidden',
        useLargeCollapsibleGrid && inlineCollapsed && 'pointer-events-none',
      )}
      aria-label="Preview"
      aria-hidden={useLargeCollapsibleGrid && inlineCollapsed ? true : undefined}
    >
      <PreviewPane
        title={previewTitle}
        description={previewDescription}
        bodyClassName={previewBodyClassName}
        bodyScrollable={previewBodyScrollable}
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
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 overflow-x-hidden',
            suppressEditorBodyScrollY ? 'overflow-y-hidden' : 'overflow-y-auto overscroll-y-contain',
            editorFullWidth
              ? 'min-h-0 flex flex-1 flex-col'
              : 'justify-center px-4 pt-6 pb-8 sm:px-6 md:px-8 md:pt-8 md:pb-10',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col',
              !editorFullWidth && 'max-w-[var(--editor-max)]',
            )}
            style={
              editorFullWidth
                ? undefined
                : { ['--editor-max' as string]: `${WIDGET_PREVIEW_EDITOR_MAX_PX}px` }
            }
          >
            {children}
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
              className={cn(
                'fixed z-[35] cursor-default border-0 bg-slate-900/25 transition-opacity duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none',
                floatingEntered ? 'opacity-100' : 'opacity-0',
                /** Exit: full-screen hit target was staying above the editor at opacity-0 → “stuck” UI */
                floatingClosing && 'pointer-events-none',
              )}
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
                'fixed z-40 flex flex-col overflow-hidden bg-white shadow-2xl will-change-transform',
                'transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:will-change-auto',
                floatingClosing && 'pointer-events-none',
                tier === 'small'
                  ? 'inset-x-0 bottom-0 top-[var(--nav-height)] border-t border-slate-200/80'
                  : 'bottom-0 right-0 top-[var(--nav-height)] w-[min(440px,100%)] max-w-full border-l border-slate-200/80',
                tier === 'small' &&
                  (floatingEntered ? 'translate-y-0' : 'translate-y-full'),
                tier === 'medium' &&
                  (floatingEntered ? 'translate-x-0' : 'translate-x-full'),
              )}
              role="dialog"
              aria-modal="true"
              aria-label={previewTitle}
              onTransitionEnd={onFloatingPanelTransitionEnd}
            >
              <PreviewPane
                title={previewTitle}
                description={previewDescription}
                bodyClassName={previewBodyClassName}
                bodyScrollable={previewBodyScrollable}
                headerTrailing={
                  <PreviewCollapseHeaderButton onCollapse={closeFloating} />
                }
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
