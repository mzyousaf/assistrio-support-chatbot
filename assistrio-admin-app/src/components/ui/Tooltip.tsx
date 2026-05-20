import { createPortal } from 'react-dom';
import {
  useId,
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

type Props = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra classes for the floating panel (e.g. wider `max-w-*` for longer copy). */
  panelClassName?: string;
  /** Preferred side; flips when there isn’t enough viewport space. */
  side?: 'top' | 'bottom';
  /**
   * When true, trigger uses full available width so children can `truncate` / ellipsis.
   * Default `inline-flex` shrink-wraps and breaks single-line ellipsis.
   */
  fullWidth?: boolean;
};

/**
 * Tooltip rendered in a portal with `position: fixed` so parent `overflow` never clips it.
 * Chooses top vs bottom from `side` and available space above/below the trigger.
 */
export function Tooltip({
  content,
  children,
  className,
  panelClassName,
  side: preferredSide = 'top',
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    let attempts = 0;
    const measure = () => {
      const trigger = triggerRef.current;
      const tip = tooltipRef.current;
      if (!trigger || !tip) {
        if (attempts++ < 12) requestAnimationFrame(measure);
        return;
      }

      const tr = trigger.getBoundingClientRect();
      const margin = 8;
      const pad = 8;
      const th = tip.offsetHeight;
      const tw = tip.offsetWidth;

      const spaceAbove = tr.top - pad;
      const spaceBelow = window.innerHeight - tr.bottom - pad;

      let placeTop = preferredSide === 'top';
      if (placeTop && spaceAbove < th && spaceBelow > spaceAbove) placeTop = false;
      if (!placeTop && spaceBelow < th && spaceAbove > spaceBelow) placeTop = true;

      let top = placeTop ? tr.top - th - margin : tr.bottom + margin;
      let left = tr.left + tr.width / 2 - tw / 2;

      left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad));
      top = Math.max(pad, Math.min(top, window.innerHeight - th - pad));

      setPos({ top, left });
      setVisible(true);
    };

    measure();
  }, [open, preferredSide, content]);

  const tooltipNode =
    open && typeof document !== 'undefined' ? (
      <div
        ref={tooltipRef}
        role="tooltip"
        id={id}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          pointerEvents: 'none',
        }}
        className={cn(
          'w-max max-w-[min(16rem,calc(100vw-16px))]',
          'rounded-[var(--ui-radius)] border border-white/10 bg-slate-900 px-2 py-1.5',
          'text-left text-[0.6875rem] font-medium leading-snug tracking-[-0.01em] text-slate-50',
          'shadow-[0_4px_20px_rgba(15,23,42,0.2)]',
          'transition-opacity duration-150',
          panelClassName,
        )}
      >
        {content}
      </div>
    ) : null;

  return (
    <span
      ref={triggerRef}
      className={cn(
        'relative',
        fullWidth ? 'flex min-w-0 w-full max-w-full' : 'inline-flex',
        className,
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        aria-describedby={open ? id : undefined}
        className={cn(fullWidth ? 'block min-w-0 w-full max-w-full' : 'inline-flex')}
      >
        {children}
      </span>
      {tooltipNode && createPortal(tooltipNode, document.body)}
    </span>
  );
}
