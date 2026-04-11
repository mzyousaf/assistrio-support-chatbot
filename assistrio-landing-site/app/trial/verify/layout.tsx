import type { ReactNode } from "react";

/**
 * Fills space between header/footer and vertically centers the verify card / loading state.
 * Relies on {@link RootMarketingChrome} marketing `<main>` being `flex flex-col flex-1`.
 */
export default function TrialVerifyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-1 flex-col justify-center bg-[var(--surface-muted)] px-4 py-6 sm:py-8">
      <div className="w-full shrink-0">{children}</div>
    </div>
  );
}
