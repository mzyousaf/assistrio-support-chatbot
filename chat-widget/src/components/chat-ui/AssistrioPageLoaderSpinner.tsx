import React from "react";

import { cx } from "./utils";

export type AssistrioPageLoaderSpinnerSize = "page" | "inline" | "compact";

const SPINNER_DIM: Record<AssistrioPageLoaderSpinnerSize, number> = {
  page: 40,
  inline: 32,
  compact: 24,
};

const SPINNER_BORDER: Record<AssistrioPageLoaderSpinnerSize, number> = {
  page: 3,
  inline: 2.5,
  compact: 2,
};

export type AssistrioPageLoaderSpinnerProps = {
  size?: AssistrioPageLoaderSpinnerSize;
  /** When set, overrides `size` (exact pixel diameter — e.g. launcher − 8). */
  diameterPx?: number;
  className?: string;
  /** When visible copy already conveys loading, mark the spinner decorative for AT. */
  decorative?: boolean;
};

function borderWidthForDiameterPx(dim: number): number {
  const d = Math.max(16, Math.round(dim));
  if (d >= 40) return 3;
  if (d >= 32) return 2.5;
  if (d >= 24) return 2;
  return 1.75;
}

/**
 * Markup matches customer dashboard `PageLoaderSpinner` (`assistrio-customer-app/src/components/PageLoader.tsx`);
 * CSS: `page-loader-*` in `embed.css` (same rules as `assistrio-customer-app/src/style.css`).
 */
export function AssistrioPageLoaderSpinner({
  size = "inline",
  diameterPx,
  className,
  decorative = false,
}: AssistrioPageLoaderSpinnerProps): React.ReactElement {
  const dim = typeof diameterPx === "number" && Number.isFinite(diameterPx) && diameterPx > 0
    ? Math.round(diameterPx)
    : SPINNER_DIM[size];
  const bw =
    typeof diameterPx === "number" && Number.isFinite(diameterPx) && diameterPx > 0
      ? borderWidthForDiameterPx(dim)
      : SPINNER_BORDER[size];

  return (
    <div
      className={cx("relative flex shrink-0 items-center justify-center", className)}
      style={{ width: dim, height: dim }}
      aria-hidden={decorative ? true : undefined}
    >
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: "0s" }} />
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: "0.55s" }} />
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: "1.1s" }} />
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: "1.65s" }} />

      <span
        className="absolute inset-0 rounded-full border-solid border-teal-100"
        style={{ borderWidth: bw }}
      />
      <span
        className="page-loader-spin absolute inset-0 rounded-full border-solid border-transparent border-t-teal-500 border-r-teal-500"
        style={{ borderWidth: bw }}
      />
    </div>
  );
}

export type AssistrioLoaderCaptionProps = {
  children: React.ReactNode;
  className?: string;
};

/** Same as customer `PageLoader` / `InlineLoader` caption (`page-loader-text`). */
export function AssistrioLoaderCaption({ children, className }: AssistrioLoaderCaptionProps): React.ReactElement {
  return <p className={cx("page-loader-text text-[0.8125rem] font-medium", className)}>{children}</p>;
}
