import type { ReactNode } from "react";

/** Add this class to a direct child to span full width (2 columns on desktop). */
export const TRIAL_SETTINGS_GRID_FULL = "md:col-span-2";

type Props = {
  children: ReactNode;
  className?: string;
};

export function TrialSettingsGrid({ children, className = "" }: Props) {
  return (
    <div
      className={`grid grid-cols-1 items-start gap-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
