import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type Props = {
  onRetry: () => void;
  detail?: string;
  title?: string;
  description?: string;
};

export function AnalyticsErrorState({ onRetry, detail, title, description }: Props) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center rounded-[0.625rem] border border-red-100 bg-red-50/40 px-6 py-10 text-center',
      )}
    >
      <p className="m-0 text-sm font-medium text-slate-800">
        {title?.trim() ? title : "We couldn't load analytics"}
      </p>
      <p className="mt-2 mb-0 max-w-sm text-xs leading-relaxed text-slate-600">
        {description?.trim()
          ? description
          : 'Check your connection and try again. If the problem continues, try a shorter date range.'}
      </p>
      {detail?.trim() ? (
        <p className="mt-2 mb-0 max-w-md text-[11px] leading-relaxed text-slate-500">{detail.trim()}</p>
      ) : null}
      <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
        <RefreshCw className="size-4" />
        Retry
      </Button>
    </div>
  );
}
