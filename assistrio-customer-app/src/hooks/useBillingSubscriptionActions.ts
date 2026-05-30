import { useCallback, useState } from 'react';
import {
  changeWorkspaceSubscriptionPlan,
  restoreWorkspaceSubscription,
} from '@/api/customerApi';
import type { ApiResult, WorkspaceBillingSummary } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { mapBillingSubscriptionActionError } from '@/lib/billingCheckout';

export type BillingSubscriptionActionResult = {
  summary: WorkspaceBillingSummary;
  message: string;
};

export function useBillingSubscriptionActions(
  workspaceId: string | null,
  onSummaryUpdated?: (summary: WorkspaceBillingSummary) => void,
) {
  const [busy, setBusy] = useState(false);

  const handleResult = useCallback(
    (result: ApiResult<BillingSubscriptionActionResult>) => {
      if (!result.ok) {
        appToast.error(mapBillingSubscriptionActionError(result));
        return false;
      }
      onSummaryUpdated?.(result.data.summary);
      if (result.data.message) {
        appToast.success(result.data.message);
      }
      return true;
    },
    [onSummaryUpdated],
  );

  const restoreSubscription = useCallback(async () => {
    if (!workspaceId || busy) return false;
    setBusy(true);
    try {
      const result = await restoreWorkspaceSubscription(workspaceId);
      return handleResult(result);
    } finally {
      setBusy(false);
    }
  }, [workspaceId, busy, handleResult]);

  const changePlan = useCallback(
    async (planKey: 'starter' | 'pro') => {
      if (!workspaceId || busy) return false;
      setBusy(true);
      try {
        const result = await changeWorkspaceSubscriptionPlan(workspaceId, { planKey });
        return handleResult(result);
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, busy, handleResult],
  );

  return {
    busy,
    restoreSubscription,
    changePlan,
  };
}
