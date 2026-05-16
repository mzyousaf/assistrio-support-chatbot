import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  id?: string;
};

/**
 * Primary content surface — white card, soft border, calm shadow.
 */
export function Card({ children, className = "", id }: Props) {
  return (
    <div
      id={id}
      className={`rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </div>
  );
}
