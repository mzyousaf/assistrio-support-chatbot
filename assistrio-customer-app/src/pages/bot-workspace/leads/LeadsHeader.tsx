import { Download, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { EXPORT_REPORTS_LOCKED_HELPER } from '@/lib/analyticsEntitlementCopy';

type Props = {
  exportDisabled: boolean;
  exportLocked?: boolean;
  onExport: () => void;
  refreshDisabled: boolean;
  refreshLoading: boolean;
  onRefresh: () => void;
};

export function LeadsHeader({
  exportDisabled,
  exportLocked = false,
  onExport,
  refreshDisabled,
  refreshLoading,
  onRefresh,
}: Props) {
  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">Leads</h1>
          <p className="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Review people and opportunities captured by your assistant.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              className="!h-9 min-w-[7.5rem] gap-1.5 !px-3"
              disabled={exportLocked || exportDisabled}
              onClick={onExport}
              title={
                exportLocked
                  ? EXPORT_REPORTS_LOCKED_HELPER
                  : 'Exports currently loaded leads (visible pages only)'
              }
            >
              <Download size={15} strokeWidth={2} aria-hidden />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="!h-9 min-w-[7.5rem] gap-1.5 !px-3 text-slate-700"
              disabled={refreshDisabled}
              onClick={() => void onRefresh()}
              title="Refresh list"
            >
              {refreshLoading ? (
                <Loader2 size={15} className="animate-spin text-teal-600" strokeWidth={2} aria-hidden />
              ) : (
                <RefreshCw size={15} className="text-slate-600" strokeWidth={2} aria-hidden />
              )}
              Refresh
            </Button>
          </div>
          {exportLocked ? (
            <p className="m-0 max-w-md text-right text-xs leading-relaxed text-slate-500">
              {EXPORT_REPORTS_LOCKED_HELPER}{' '}
              <Link to="/settings/plans" className="font-medium text-teal-700 underline">
                View plans
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
