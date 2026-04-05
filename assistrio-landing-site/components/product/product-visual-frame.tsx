import type { ReactNode } from "react";

/** Shared outer shell: border, teal ring, shadow, radius — matches marketing homepage system */
export const productFrameShellClassName =
  "overflow-hidden rounded-[1.35rem] border border-[var(--border-default)] bg-slate-100/80 shadow-[0_20px_50px_-18px_rgba(15,23,42,0.1)] ring-1 ring-[var(--brand-teal)]/12";

export type ProductFrameChrome = "app" | "page" | "none";

type ChromeAppProps = { addressBarLabel: string };

/** Traffic lights + centered address bar (Assistrio app / dashboard) */
export function ProductChromeApp({ addressBarLabel }: ChromeAppProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-default)] bg-white/90 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="flex gap-1.5" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-red-300/90" />
        <span className="h-3 w-3 rounded-full bg-amber-300/90" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
      </div>
      <div className="mx-auto flex h-8 max-w-md flex-1 items-center rounded-lg border border-slate-200/80 bg-slate-50 px-3 text-xs text-slate-500">
        <span className="truncate font-mono text-[0.7rem] sm:text-xs">{addressBarLabel}</span>
      </div>
    </div>
  );
}

/** Minimal page URL bar (customer site + embed context) */
export function ProductChromePage({ addressBarLabel }: ChromeAppProps) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-[var(--border-default)] bg-white/95 px-4 text-xs text-slate-500">
      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[0.65rem] sm:text-xs">{addressBarLabel}</span>
      <span className="hidden text-slate-400 sm:inline">Secure</span>
    </div>
  );
}

type ProductVisualFrameProps = {
  children: ReactNode;
  /** Which chrome row to show above content; `none` for composite screenshots that include their own UI chrome */
  chrome?: ProductFrameChrome;
  /** Shown in the address / URL bar when chrome is app or page */
  addressBarLabel?: string;
  className?: string;
};

const defaultAppLabel = "app.assistrio.com · Acme · Support bot";
const defaultPageLabel = "https://yoursite.com/docs";

/**
 * Premium framed shell for product mocks and screenshots — keeps border, ring, shadow, and responsive chrome consistent.
 */
export function ProductVisualFrame({
  children,
  chrome = "app",
  addressBarLabel,
  className = "",
}: ProductVisualFrameProps) {
  const appLabel = addressBarLabel ?? defaultAppLabel;
  const pageLabel = addressBarLabel ?? defaultPageLabel;

  return (
    <div className={`${productFrameShellClassName} ${className}`.trim()}>
      {chrome === "app" ? <ProductChromeApp addressBarLabel={appLabel} /> : null}
      {chrome === "page" ? <ProductChromePage addressBarLabel={pageLabel} /> : null}
      {children}
    </div>
  );
}
