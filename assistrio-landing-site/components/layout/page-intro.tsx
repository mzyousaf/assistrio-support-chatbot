import type { ReactNode } from "react";

type Props = {
  title: string;
  eyebrow?: string;
  /** Primary description — uses `.text-page-lead` */
  children?: ReactNode;
  className?: string;
  /** Slightly larger display title for marketing band sections */
  largeTitle?: boolean;
};

/**
 * Shared page header pattern: eyebrow + serif title + lead slot.
 * Keeps hierarchy consistent across trial, gallery, pricing, contact, etc.
 */
export function PageIntro({ title, eyebrow, children, className = "max-w-3xl", largeTitle = false }: Props) {
  return (
    <header className={className}>
      {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
      <h1
        className={`text-page-title text-balance ${largeTitle ? "text-page-title-lg" : ""} ${eyebrow ? "mt-3" : ""}`}
      >
        {title}
      </h1>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </header>
  );
}
