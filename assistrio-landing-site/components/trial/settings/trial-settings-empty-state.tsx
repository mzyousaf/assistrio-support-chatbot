type Props = {
  title: string;
  description?: string;
  className?: string;
};

export function TrialSettingsEmptyState({ title, description, className = "" }: Props) {
  return (
    <div
      className={`flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center ${className}`.trim()}
    >
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
    </div>
  );
}
