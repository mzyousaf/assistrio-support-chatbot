import { useCallback, useState } from 'react';
import { fetchWorkspaceBillingHistoryCsv } from '@/api/customerApi';
import { appToast } from '@/lib/app-toast';
import { triggerBlobDownload } from '@/lib/billingInvoicePdfDownload';

export function useBillingHistoryDownload(workspaceId: string) {
  const [busy, setBusy] = useState(false);

  const download = useCallback(async () => {
    if (!workspaceId || busy) return;
    setBusy(true);

    const result = await fetchWorkspaceBillingHistoryCsv(workspaceId);
    setBusy(false);

    if (result.ok) {
      triggerBlobDownload(result.data.blob, result.data.filename);
      return;
    }

    appToast.error(result.error ?? 'Could not download billing history.');
  }, [workspaceId, busy]);

  return { busy, download };
}
