type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function SettingsStatCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[var(--shadow-xs)]">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="m-0 mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}
