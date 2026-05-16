import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  hint: string;
  Icon: LucideIcon;
};

export function AnalyticsPageEmptyState({ title, hint, Icon }: Props) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[0.625rem] border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <Icon className="mb-2 size-9 text-slate-300" strokeWidth={1.5} aria-hidden />
      <p className="m-0 text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-2 mb-0 max-w-md text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}
