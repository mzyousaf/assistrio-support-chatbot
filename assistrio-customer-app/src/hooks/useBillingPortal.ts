import { useCallback, useState } from 'react';
import { createBillingManageSession } from '@/api/customerApi';
import { appToast } from '@/lib/app-toast';
import { mapBillingPortalError } from '@/lib/billingCheckout';

const PORTAL_UNAVAILABLE_MESSAGE = 'Billing portal is not available right now.';

export function useBillingPortal(workspaceId: string | null) {
  const [loading, setLoading] = useState(false);

  const openPortal = useCallback(async () => {
    if (!workspaceId || loading) return false;
    setLoading(true);
    try {
      const result = await createBillingManageSession(workspaceId);
      if (!result.ok) {
        appToast.error(mapBillingPortalError(result) || PORTAL_UNAVAILABLE_MESSAGE);
        return false;
      }
      const url = result.data.url?.trim();
      if (!url) {
        appToast.error(PORTAL_UNAVAILABLE_MESSAGE);
        return false;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, loading]);

  return { openPortal, loading };
}
