import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
};

/** Matches customer SettingsPageHeader / PageIntroStrip layout for Plans. */
export function PlansPageHeader({ title, description, actions, icon }: Props) {
  return (
    <div className="border-b pb-3" style={{ borderColor: "color-mix(in srgb, #e2e8f0 85%, transparent)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
            {icon ? <span className="shrink-0 text-teal-600">{icon}</span> : null}
            <span className="min-w-0">{title}</span>
          </h1>
          {description ? (
            <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 [&_p]:m-0 [&_p+p]:mt-2">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5")}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
