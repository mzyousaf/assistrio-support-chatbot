import type { ReactNode } from "react";

type Props = {
  title: string;
  eyebrow?: string;
  /** Primary description — uses `.text-page-lead` */
  children?: ReactNode;
  className?: string;
  /** Slightly larger display title for marketing band sections */
  largeTitle?: boolean;
  /** For `aria-labelledby` on sibling forms or regions */
  titleId?: string;
};

/**
 * Shared page header pattern: eyebrow + serif title + lead slot.
 * Keeps hierarchy consistent across trial, gallery, pricing, contact, etc.
 */
export function PageIntro({
  title,
  eyebrow,
  children,
  className = "max-w-3xl",
  largeTitle = false,
  titleId,
}: Props) {
  return (
    <header className={`min-w-0 ${className}`}>
      {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
      <h1
        id={titleId}
        className={`text-page-title text-balance ${largeTitle ? "text-page-title-lg" : ""} ${eyebrow ? "mt-3" : ""}`}
      >
        {title}
      </h1>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </header>
  );
}
