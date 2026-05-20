import { cn } from '@/lib/utils';

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export function ConversationMetricPill({ children, className, title }: Props) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-700',
        className,
      )}
    >
      {children}
    </span>
  );
}
