import type { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Dashed “nothing here” / helper surface — gallery empty, optional future uses.
 */
export function EmptyState({ title, children, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[var(--border-strong)] bg-slate-50/80 px-6 py-12 text-center shadow-[var(--shadow-xs)] ${className}`}
    >
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {children ? <div className="mt-2 text-page-meta">{children}</div> : null}
    </div>
  );
}
