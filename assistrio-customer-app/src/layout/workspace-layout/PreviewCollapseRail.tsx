'use client';

import { Eye, PanelRightClose } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PreviewCollapseHeaderButtonProps = {
  onCollapse: () => void;
  className?: string;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:ring-offset-0';

const focusRingExpand =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0';

/** Large breakpoint: lives in `PreviewPane` header trailing — hides inline preview. */
export function PreviewCollapseHeaderButton({ onCollapse, className }: PreviewCollapseHeaderButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'group flex h-full min-h-[2.75rem] w-9 shrink-0 cursor-pointer items-center justify-center bg-transparent text-slate-600',
        'transition-[transform,background-color,color] duration-200 ease-out',
        'hover:bg-slate-100/90 hover:text-slate-900',
        'active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100',
        focusRing,
        className,
      )}
      aria-label="Hide preview"
      title="Hide preview"
      onClick={onCollapse}
    >
      <PanelRightClose
        className="size-[18px] shrink-0 transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100"
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}

export type PreviewExpandEyeButtonProps = {
  onExpand: () => void;
  className?: string;
};

const primarySurface = 'border-0 bg-[var(--color-primary)] text-white';

/** Large breakpoint, preview collapsed: docked on editor’s right edge — restores inline preview. */
export function PreviewExpandEyeButton({ onExpand, className }: PreviewExpandEyeButtonProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Agent Preview"
      title="Agent Preview"
      className={cn(
        'group pointer-events-auto absolute right-0 top-1/2 z-[60] flex -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 rounded-l-lg rounded-r-none px-2 py-3',
        primarySurface,
        'shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[transform,filter,box-shadow] duration-200 ease-out',
        'hover:-translate-x-0.5 hover:brightness-[1.06] hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.18)]',
        'active:translate-x-0 active:brightness-[0.98] active:shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)]',
        'motion-reduce:transition-none motion-reduce:hover:-translate-x-0 motion-reduce:hover:brightness-100',
        focusRingExpand,
        className,
      )}
    >
      <Eye
        className="pointer-events-none size-[18px] shrink-0 rotate-90 transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100"
        strokeWidth={2.25}
        aria-hidden
      />
      <span
        className="select-none text-center text-[11px] font-semibold leading-tight tracking-[0.02em] transition-[letter-spacing] duration-200 ease-out group-hover:tracking-[0.04em] motion-reduce:group-hover:tracking-[0.02em]"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        Agent Preview
      </span>
    </button>
  );
}
