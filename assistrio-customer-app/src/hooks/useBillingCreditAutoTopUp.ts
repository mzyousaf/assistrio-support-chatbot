import { useCallback, useState } from 'react';
import { patchWorkspaceCreditAutoTopUp } from '@/api/customerApi';

export function useBillingCreditAutoTopUp(workspaceId: string | null, onUpdated?: () => void) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setAutoTopUpEnabled = useCallback(
    async (enabled: boolean) => {
      if (!workspaceId) return false;
      setBusy(true);
      setErrorMessage(null);

      const result = await patchWorkspaceCreditAutoTopUp(workspaceId, enabled);
      setBusy(false);

      if (!result.ok) {
        setErrorMessage(result.error ?? 'Could not update auto top-up.');
        return false;
      }

      onUpdated?.();
      return true;
    },
    [workspaceId, onUpdated],
  );

  return { busy, errorMessage, setAutoTopUpEnabled };
}
