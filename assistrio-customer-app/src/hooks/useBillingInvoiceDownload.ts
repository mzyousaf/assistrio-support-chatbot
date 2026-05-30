import { useCallback, useState } from 'react';
import type { BillingInvoiceDownloadDetails, WorkspaceBillingProfile } from '@/api/types';
import { fetchWorkspaceBillingInvoicePdf } from '@/api/customerApi';
import { appToast } from '@/lib/app-toast';
import { billingFormToSavedProfile } from '@/lib/billingProfileFormDefaults';
import { triggerBlobDownload } from '@/lib/billingInvoicePdfDownload';

type Options = {
  applyProfile?: (profile: WorkspaceBillingProfile | null) => void;
  reloadProfile?: () => Promise<void>;
  customerId?: string;
};

export function useBillingInvoiceDownload(workspaceId: string, options?: Options) {
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSavedProfile = useCallback(
    async (details?: BillingInvoiceDownloadDetails) => {
      if (!details?.saveProfile || !workspaceId) return;

      options?.applyProfile?.(
        billingFormToSavedProfile(
          workspaceId,
          {
            name: details.name,
            address: details.address,
            city: details.city,
            state: details.state,
            zipCode: details.zipCode,
            country: details.country,
            email: details.email,
            taxId: details.taxId,
            notes: details.notes,
          },
          options.customerId ?? 'local',
        ),
      );
      await options?.reloadProfile?.();
    },
    [options, workspaceId],
  );

  const download = useCallback(
    async (billingItemId: string, details?: BillingInvoiceDownloadDetails) => {
      if (!workspaceId) return;
      setBusy(true);
      setError(null);

      const result = await fetchWorkspaceBillingInvoicePdf(workspaceId, billingItemId, details);
      setBusy(false);

      if (result.ok) {
        setDetailsModalOpen(false);
        setPendingItemId(null);
        await refreshSavedProfile(details);
        if (result.data.kind === 'provider_url') {
          window.open(result.data.url, '_blank', 'noopener,noreferrer');
          return;
        }
        triggerBlobDownload(result.data.blob, result.data.filename);
        return;
      }

      if (result.errorCode === 'billing_invoice_details_required') {
        setPendingItemId(billingItemId);
        setDetailsModalOpen(true);
        return;
      }

      if (
        result.errorCode === 'billing_invoice_details_invalid' ||
        result.errorCode === 'billing_invoice_generation_failed'
      ) {
        const message = result.error ?? 'Please check your billing details and try again.';
        setError(message);
        appToast.error(message);
        return;
      }

      const message = 'Invoice PDF is not available right now.';
      setError(message);
      appToast.error(message);
    },
    [refreshSavedProfile, workspaceId],
  );

  const submitDetails = useCallback(
    async (details: BillingInvoiceDownloadDetails) => {
      if (!pendingItemId) return;
      await download(pendingItemId, details);
    },
    [download, pendingItemId],
  );

  const closeDetailsModal = useCallback(() => {
    if (busy) return;
    setDetailsModalOpen(false);
    setPendingItemId(null);
  }, [busy]);

  return {
    busy,
    error,
    detailsModalOpen,
    download,
    submitDetails,
    closeDetailsModal,
  };
}
