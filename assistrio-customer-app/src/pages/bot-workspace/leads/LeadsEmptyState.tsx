import { Link } from 'react-router-dom';
import { Inbox, SearchX } from 'lucide-react';
import { Button } from '@/components/ui';

type Props = {
  botId: string;
  variant: 'empty' | 'filtered';
  onClearFilters?: () => void;
};

export function LeadsEmptyState({ botId, variant, onClearFilters }: Props) {
  if (variant === 'filtered') {
    return (
      <div
        className="flex flex-col items-center justify-center px-6 py-14 text-center"
        role="status"
      >
        <SearchX className="h-10 w-10 text-[var(--color-teal-700)]" strokeWidth={1.75} aria-hidden />
        <p className="m-0 mt-5 text-base font-semibold text-slate-900">No leads match these filters</p>
        <p className="m-0 mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Try clearing filters or changing your search. The summary cards above reflect totals for your current filters.
        </p>
        {onClearFilters ? (
          <Button type="button" variant="primary" size="md" className="mt-6" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="status">
      <Inbox className="h-10 w-10 text-[var(--color-teal-700)]" strokeWidth={1.75} aria-hidden />
      <p className="m-0 mt-5 text-base font-semibold text-slate-900">No leads captured yet</p>
      <p className="m-0 mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        When visitors share contact details through your assistant, they&apos;ll appear here.
      </p>
      <Link
        to={`/bots/${encodeURIComponent(botId)}/playground/capture-leads`}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-[var(--ui-radius)] border border-[var(--color-teal-600)] bg-white px-4 text-sm font-medium text-[var(--color-teal-700)] shadow-none transition hover:border-[var(--color-teal-700)] hover:bg-[var(--teal-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600/25"
      >
        Configure lead capture
      </Link>
    </div>
  );
}
