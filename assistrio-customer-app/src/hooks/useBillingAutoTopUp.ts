import { useCallback, useState } from 'react';
import {
  createAutoTopUpCheckoutSession,
  disableWorkspaceAutoTopUp,
} from '@/api/customerApi';

export function useBillingAutoTopUp(workspaceId: string | null, onUpdated?: () => void) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startEnableCheckout = useCallback(async () => {
    if (!workspaceId) return false;
    setBusy(true);
    setErrorMessage(null);
    const result = await createAutoTopUpCheckoutSession(workspaceId);
    setBusy(false);
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not start auto top-up checkout.');
      return false;
    }
    window.location.href = result.data.checkoutUrl;
    return true;
  }, [workspaceId]);

  const disableAutoTopUp = useCallback(async () => {
    if (!workspaceId) return false;
    setBusy(true);
    setErrorMessage(null);
    const result = await disableWorkspaceAutoTopUp(workspaceId);
    setBusy(false);
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not disable auto top-up.');
      return false;
    }
    onUpdated?.();
    return true;
  }, [workspaceId, onUpdated]);

  return { busy, errorMessage, startEnableCheckout, disableAutoTopUp };
}
