import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalTone = 'default' | 'danger' | 'warning';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Plain string or custom node (e.g. icon + text). Wrapped in `<h2>` for accessibility. */
  title: ReactNode;
  description?: ReactNode;
  tone?: ModalTone;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Wider panel for forms */
  size?: 'md' | 'lg';
  /** Extra classes on the fixed overlay wrapper (e.g. z-index when stacking modals). */
  overlayClassName?: string;
  /** Merged into the `<h2>` title (e.g. `text-sm` for a denser header). */
  titleClassName?: string;
  /** Merged into the footer strip (e.g. override default footer button text size). */
  footerClassName?: string;
  /** Extra classes on the scrollable body region (default `px-4 py-4 sm:px-5`). */
  bodyClassName?: string;
  /** When true, does not set `document.body.style.overflow` (use for nested modals). */
  skipBodyScrollLock?: boolean;
  /** When false, hides the header close control and blocks Escape from calling `onClose`. Backdrop click follows {@link closeOnBackdropClick} when {@link allowDismiss} is true. */
  allowDismiss?: boolean;
  /**
   * When true, clicking the dimmed backdrop calls `onClose`. Defaults to false so confirmations and forms are not dismissed accidentally.
   * Opt in for lightweight browse dialogs (e.g. data-source picker).
   */
  closeOnBackdropClick?: boolean;
  /**
   * Extra id(s) for `aria-describedby` when the primary description lives outside {@link description} (e.g. in the scrollable body).
   * Space-separated ids are allowed.
   */
  ariaDescribedBy?: string;
  /** Hide the default title row when custom chrome lives in `children`. Set {@link dialogAriaLabel} for the accessible name. */
  hideHeader?: boolean;
  /** Used as `aria-label` on the dialog when {@link hideHeader} is true. */
  dialogAriaLabel?: string;
  /**
   * When `"right"`, the panel slides in from the right with opacity on the backdrop.
   * Keeps the portal mounted briefly after `open` becomes false so the close animation can finish.
   */
  slideFrom?: 'none' | 'right';
};

/**
 * Focused overlay dialog. Use `tone="danger"` for destructive confirmations and `tone="warning"` for cautious flows.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  tone = 'default',
  children,
  footer,
  className,
  size = 'md',
  overlayClassName,
  titleClassName,
  footerClassName,
  bodyClassName,
  skipBodyScrollLock = false,
  allowDismiss = true,
  closeOnBackdropClick = false,
  ariaDescribedBy,
  hideHeader = false,
  dialogAriaLabel,
  slideFrom = 'none',
}: ModalProps) {
  const [slideMounted, setSlideMounted] = useState(false);
  const [slideEntered, setSlideEntered] = useState(false);
  const slideCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideEnterRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (slideFrom !== 'right') return;
    if (open) {
      if (slideCloseTimerRef.current) {
        clearTimeout(slideCloseTimerRef.current);
        slideCloseTimerRef.current = null;
      }
      setSlideMounted(true);
      setSlideEntered(false);
      slideEnterRafRef.current = window.requestAnimationFrame(() => {
        slideEnterRafRef.current = null;
        setSlideEntered(true);
      });
      return () => {
        if (slideEnterRafRef.current != null) {
          cancelAnimationFrame(slideEnterRafRef.current);
          slideEnterRafRef.current = null;
        }
      };
    }
    setSlideEntered(false);
    slideCloseTimerRef.current = setTimeout(() => {
      slideCloseTimerRef.current = null;
      setSlideMounted(false);
    }, 280);
    return () => {
      if (slideCloseTimerRef.current) {
        clearTimeout(slideCloseTimerRef.current);
        slideCloseTimerRef.current = null;
      }
    };
  }, [open, slideFrom]);

  const slideOpen = slideFrom === 'right' ? open || slideMounted : open;
  const scrollLockActive = slideOpen;
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropDismissible = allowDismiss && closeOnBackdropClick;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowDismiss) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, allowDismiss]);

  useEffect(() => {
    if (!scrollLockActive || skipBodyScrollLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [scrollLockActive, skipBodyScrollLock]);

  useEffect(() => {
    if (!slideOpen) return;
    if (slideFrom === 'right' && !slideEntered) return;
    const container = dialogRef.current;
    if (!container) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) =>
          !el.hasAttribute('data-focus-guard') &&
          !el.hasAttribute('data-modal-backdrop') &&
          !el.closest('[aria-hidden="true"]'),
      );

    const focusables = getFocusables();
    const bodyEl = container.querySelector<HTMLElement>('[data-modal-body]');
    const bodyFocusables = bodyEl
      ? Array.from(bodyEl.querySelectorAll<HTMLElement>(focusableSelector)).filter(
          (el) => !el.closest('[aria-hidden="true"]'),
        )
      : [];
    const initialFocus = bodyFocusables[0] ?? focusables[0];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (initialFocus) {
      window.requestAnimationFrame(() => {
        // Avoid stealing focus from a user click/type that happens immediately after open.
        if (!container.contains(document.activeElement)) {
          initialFocus.focus();
        }
      });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [slideOpen, slideFrom, slideEntered]);

  if (!slideOpen) return null;

  const describedBy =
    [description ? descId : null, ariaDescribedBy?.trim() ? ariaDescribedBy.trim() : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const backdropClass = cn(
    'absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[1px]',
    slideFrom === 'right' && 'transition-opacity duration-200 ease-out',
    slideFrom === 'right' && (slideEntered ? 'opacity-100' : 'opacity-0 pointer-events-none'),
  );

  const panel = (
    <div
      className={cn('fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6', overlayClassName)}
      role="presentation"
    >
      {backdropDismissible ? (
        <button
          type="button"
          tabIndex={-1}
          data-modal-backdrop
          className={backdropClass}
          aria-label="Close dialog"
          onClick={onClose}
        />
      ) : (
        <div className={backdropClass} aria-hidden />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : titleId}
        aria-label={hideHeader ? dialogAriaLabel?.trim() || 'Dialog' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'relative z-[1] flex max-h-[min(90vh,40rem)] w-full flex-col overflow-hidden rounded-xl border bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06]',
          slideFrom === 'right' && 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
          slideFrom === 'right' && (slideEntered ? 'translate-x-0' : 'translate-x-full'),
          tone === 'danger' && 'border-[var(--color-danger-border)]',
          tone === 'warning' && 'border-amber-200/90 ring-amber-700/[0.07]',
          tone === 'default' && 'border-slate-200/90',
          size === 'md' && 'max-w-md',
          size === 'lg' && 'max-w-lg',
          className,
        )}
      >
        {hideHeader ? null : (
          <div
            className={cn(
              'flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4',
              tone === 'danger' ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]' : null,
              tone === 'warning' ? 'border-amber-200/75 bg-amber-50/90' : null,
              tone === 'default' ? 'border-slate-100 bg-slate-50/80' : null,
            )}
          >
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className={cn(
                  'm-0 text-base font-semibold tracking-tight',
                  tone === 'danger' ? 'text-[var(--color-danger-text-emphasis)]' : null,
                  tone === 'warning' ? 'text-amber-950' : null,
                  tone === 'default' ? 'text-slate-900' : null,
                  titleClassName,
                )}
              >
                {title}
              </h2>
              {description ? (
                <div
                  id={descId}
                  className={cn(
                    'mt-1 text-sm leading-relaxed',
                    tone === 'danger' ? 'text-[var(--color-danger-text)]' : null,
                    tone === 'warning' ? 'text-amber-900/85' : null,
                    tone === 'default' ? 'text-slate-600' : null,
                  )}
                >
                  {description}
                </div>
              ) : null}
            </div>
            {allowDismiss ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0" aria-hidden />
            )}
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5', bodyClassName)} data-modal-body>
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              'flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 sm:px-5 [&_button]:!h-8 [&_button]:!min-h-8 [&_button]:!px-3 [&_button]:!text-xs [&_button]:!leading-tight',
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
