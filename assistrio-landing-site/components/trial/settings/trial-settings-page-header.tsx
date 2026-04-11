import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/** Mirrors `ai-platform-app` SettingsPageHeader — section intro under the editor pane title. */
export function TrialSettingsPageHeader({ title, description, actions, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
