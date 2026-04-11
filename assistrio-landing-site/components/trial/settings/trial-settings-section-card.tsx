import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Mirrors `SettingsSectionCard` from the authenticated admin UI. */
export function TrialSettingsSectionCard({ title, description, headerAction, children, className = "" }: Props) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {title || description || headerAction ? (
        <div className="flex flex-col gap-1.5 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {title ? <h3 className="text-base font-semibold text-slate-900">{title}</h3> : null}
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0 pt-1 sm:pt-0">{headerAction}</div> : null}
        </div>
      ) : null}
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}
