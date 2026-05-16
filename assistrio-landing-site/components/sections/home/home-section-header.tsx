import type { ReactNode } from "react";

const leadClass =
  "max-w-2xl text-pretty text-[1.0625rem] font-semibold leading-snug tracking-tight text-slate-800 sm:text-lg sm:leading-snug lg:text-[1.125rem]";

type Props = {
  eyebrow?: string;
  title: string;
  /** One premium supporting line directly under the H2 */
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Optional anchor id for in-page navigation */
  id?: string;
  /** Wider title measure for editorial sections */
  titleWide?: boolean;
  /** Wider max-width on the H2 line only (same type scale as default) */
  titleSize?: "default" | "large";
  /** Title + intro side-by-side on large screens */
  align?: "default" | "split";
  /** Full-width editorial intro under title (single column, roomier measure) */
  layout?: "default" | "editorial";
  /** Stronger display scale for H2 (carousels, hero-adjacent majors) */
  titleVariant?: "default" | "premium";
};

const bodyProseClass =
  "max-w-2xl [&_p]:text-pretty [&_p]:text-[1.0625rem] [&_p]:leading-[1.72] [&_p]:text-[var(--foreground-muted)] [&_p+p]:mt-4 [&_strong]:font-semibold [&_strong]:text-[var(--brand-teal-dark)]";

/** Shared section title block — homepage H2 uses `.text-home-h2` (single scale below hero H1). */
export function HomeSectionHeader({
  eyebrow,
  title,
  lead,
  children,
  className = "",
  id,
  titleWide = false,
  titleSize = "default",
  align = "default",
  layout = "default",
  titleVariant = "default",
}: Props) {
  /** Avoid `ch`-based clamps — they force awkward breaks with display serif */
  const titleClamp =
    titleSize === "large"
      ? "max-w-[min(48rem,100%)]"
      : titleWide
        ? "max-w-[min(40rem,100%)]"
        : "max-w-[min(30rem,100%)] sm:max-w-[min(36rem,100%)]";

  const h2Tone = titleVariant === "premium" ? "text-home-h2 text-home-h2-premium" : "text-home-h2";

  const head = (
    <>
      {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
      <h2 className={`${h2Tone} text-balance ${titleClamp} ${eyebrow ? "mt-6" : ""}`}>{title}</h2>
    </>
  );

  const leadBlock = lead ? <p className={`${leadClass} mt-5`}>{lead}</p> : null;
  const bodyGap = lead ? "mt-5 sm:mt-6" : "mt-8";

  if (layout === "editorial") {
    return (
      <div id={id} className={`max-w-3xl scroll-mt-32 ${className}`}>
        {head}
        {leadBlock}
        {children ? <div className={`${bodyGap} ${bodyProseClass} max-w-2xl`}>{children}</div> : null}
      </div>
    );
  }

  if (align === "split") {
    return (
      <div
        id={id}
        className={`scroll-mt-32 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start lg:gap-x-14 xl:gap-x-20 ${className}`}
      >
        <div className="max-w-xl lg:max-w-none">
          {head}
          {leadBlock}
        </div>
        {children ? (
          <div className={`mt-8 lg:mt-10 lg:max-w-none ${bodyProseClass}`}>{children}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div id={id} className={`max-w-2xl scroll-mt-32 ${className}`}>
      {head}
      {leadBlock}
      {children ? <div className={`${bodyGap} ${bodyProseClass}`}>{children}</div> : null}
    </div>
  );
}
