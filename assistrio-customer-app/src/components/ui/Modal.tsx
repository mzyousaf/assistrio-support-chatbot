import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalTone = 'default' | 'danger';

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
  /** When true, does not set `document.body.style.overflow` (use for nested modals). */
  skipBodyScrollLock?: boolean;
  /** When false, hides the header close control and blocks backdrop dismiss (Escape still fires `onClose` unless you handle it in parent). */
  allowDismiss?: boolean;
};

/**
 * Focused overlay dialog. Use `tone="danger"` for destructive confirmations.
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
  skipBodyScrollLock = false,
  allowDismiss = true,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowDismiss) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, allowDismiss]);

  useEffect(() => {
    if (!open || skipBodyScrollLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, skipBodyScrollLock]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  if (!open) return null;

  const panel = (
    <div
      className={cn('fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6', overlayClassName)}
      role="presentation"
    >
      <button
        type="button"
        tabIndex={-1}
        data-modal-backdrop
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
        aria-label="Close dialog"
        onClick={allowDismiss ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative z-[1] flex max-h-[min(90vh,40rem)] w-full flex-col overflow-hidden rounded-xl border bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06]',
          tone === 'danger' && 'border-[var(--color-danger-border)]',
          tone === 'default' && 'border-slate-200/90',
          size === 'md' && 'max-w-md',
          size === 'lg' && 'max-w-lg',
          className,
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4',
            tone === 'danger' ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]' : 'border-slate-100 bg-slate-50/80',
          )}
        >
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className={cn(
                'm-0 text-base font-semibold tracking-tight',
                tone === 'danger' ? 'text-[var(--color-danger-text-emphasis)]' : 'text-slate-900',
              )}
            >
              {title}
            </h2>
            {description ? (
              <div id={descId} className={cn('mt-1 text-sm leading-relaxed', tone === 'danger' ? 'text-[var(--color-danger-text)]' : 'text-slate-600')}>
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
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" data-modal-body>
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 sm:px-5 [&_button]:!h-8 [&_button]:!min-h-8 [&_button]:!px-3 [&_button]:!text-xs [&_button]:!leading-tight">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
