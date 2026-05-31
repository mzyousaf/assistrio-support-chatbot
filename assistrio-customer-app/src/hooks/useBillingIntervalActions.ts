import { useCallback, useState } from 'react';
import {
  cancelScheduledAddonBillingChange,
  cancelScheduledSubscriptionBillingChange,
  scheduleAddonBillingInterval,
  scheduleSubscriptionBillingInterval,
} from '@/api/customerApi';
import type { ApiResult, BillingInterval, WorkspaceBillingSummary } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { mapBillingSubscriptionActionError } from '@/lib/billingCheckout';

function mapIntervalActionError(
  result: Extract<ApiResult<{ summary: WorkspaceBillingSummary; message: string }>, { ok: false }>,
): string {
  return mapBillingSubscriptionActionError(result);
}

export function useBillingIntervalActions(
  workspaceId: string | null,
  onSummaryUpdated?: (summary: WorkspaceBillingSummary) => void,
) {
  const [busy, setBusy] = useState(false);

  const handleSummaryResult = useCallback(
    (result: ApiResult<{ summary: WorkspaceBillingSummary; message: string }>) => {
      if (!result.ok) {
        appToast.error(mapIntervalActionError(result));
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

  const scheduleSubscriptionInterval = useCallback(
    async (billingInterval: BillingInterval) => {
      if (!workspaceId || busy) return false;
      setBusy(true);
      try {
        const result = await scheduleSubscriptionBillingInterval(workspaceId, { billingInterval });
        return handleSummaryResult(result);
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, busy, handleSummaryResult],
  );

  const cancelScheduledSubscriptionInterval = useCallback(async () => {
    if (!workspaceId || busy) return false;
    setBusy(true);
    try {
      const result = await cancelScheduledSubscriptionBillingChange(workspaceId);
      return handleSummaryResult(result);
    } finally {
      setBusy(false);
    }
  }, [workspaceId, busy, handleSummaryResult]);

  const scheduleAddonInterval = useCallback(
    async (input: {
      addonKey: string;
      billingInterval: BillingInterval;
      targetBotId?: string;
      addonInstanceId: string;
    }) => {
      if (!workspaceId || busy) return false;
      setBusy(true);
      try {
        const result = await scheduleAddonBillingInterval(workspaceId, input);
        return handleSummaryResult(result);
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, busy, handleSummaryResult],
  );

  const cancelScheduledAddonInterval = useCallback(
    async (input: { addonKey: string; addonInstanceId: string; targetBotId?: string }) => {
      if (!workspaceId || busy) return false;
      setBusy(true);
      try {
        const result = await cancelScheduledAddonBillingChange(workspaceId, input);
        return handleSummaryResult(result);
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, busy, handleSummaryResult],
  );

  return {
    busy,
    scheduleSubscriptionInterval,
    cancelScheduledSubscriptionInterval,
    scheduleAddonInterval,
    cancelScheduledAddonInterval,
  };
}
