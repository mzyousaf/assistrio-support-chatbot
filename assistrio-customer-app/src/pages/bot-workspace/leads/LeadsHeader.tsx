import { Download, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

type Props = {
  exportDisabled: boolean;
  onExport: () => void;
  refreshDisabled: boolean;
  refreshLoading: boolean;
  onRefresh: () => void;
};

export function LeadsHeader({ exportDisabled, onExport, refreshDisabled, refreshLoading, onRefresh }: Props) {
  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">Leads</h1>
          <p className="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Review people and opportunities captured by your assistant.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outlinePrimary"
            size="sm"
            className="!h-9 min-w-[7.5rem] gap-1.5 !px-3"
            disabled={exportDisabled}
            onClick={onExport}
            title="Exports currently loaded leads (visible pages only)"
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
      </div>
    </header>
  );
}
