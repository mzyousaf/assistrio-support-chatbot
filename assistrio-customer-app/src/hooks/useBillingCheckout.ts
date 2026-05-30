import { useCallback, useState } from 'react';
import {
  createAddonCheckoutSession,
  createPlanCheckoutSession,
  createTopUpCheckoutSession,
} from '@/api/customerApi';
import type { ApiResult, BillingCheckoutSessionResponse } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { isTopUpAddonKey, mapBillingCheckoutError } from '@/lib/billingCheckout';
import type { PaidPlanCheckoutKey } from '@/lib/billingCheckout';

export function useBillingCheckout(workspaceId: string | null) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const redirectToCheckout = useCallback((checkoutUrl: string) => {
    window.location.href = checkoutUrl;
  }, []);

  const runCheckout = useCallback(
    async (
      key: string,
      request: () => Promise<ApiResult<BillingCheckoutSessionResponse>>,
    ) => {
      if (!workspaceId || loadingKey) return false;

      setLoadingKey(key);
      try {
        const result = await request();
        if (!result.ok) {
          appToast.error(mapBillingCheckoutError(result as Extract<ApiResult<BillingCheckoutSessionResponse>, { ok: false }>));
          return false;
        }
        redirectToCheckout(result.data.checkoutUrl);
        return true;
      } finally {
        setLoadingKey(null);
      }
    },
    [workspaceId, loadingKey, redirectToCheckout],
  );

  const startPlanCheckout = useCallback(
    (planKey: PaidPlanCheckoutKey) =>
      runCheckout(`plan:${planKey}`, () =>
        createPlanCheckoutSession(workspaceId!, planKey),
      ),
    [runCheckout, workspaceId],
  );

  const startAddonCheckout = useCallback(
    (addonKey: string, targetBotId?: string) =>
      runCheckout(`addon:${addonKey}:${targetBotId ?? ''}`, () =>
        createAddonCheckoutSession(workspaceId!, addonKey, targetBotId),
      ),
    [runCheckout, workspaceId],
  );

  const startTopUpCheckout = useCallback(
    (topUpKey: 'ai_credits_1000') =>
      runCheckout(`topup:${topUpKey}`, () =>
        createTopUpCheckoutSession(workspaceId!, topUpKey),
      ),
    [runCheckout, workspaceId],
  );

  const isLoading = useCallback((key: string) => loadingKey === key, [loadingKey]);

  const isPlanLoading = useCallback(
    (planKey: string) => loadingKey === `plan:${planKey}`,
    [loadingKey],
  );

  const isAddonLoading = useCallback(
    (addonKey: string) =>
      isTopUpAddonKey(addonKey)
        ? loadingKey === 'topup:ai_credits_1000'
        : Boolean(loadingKey?.startsWith(`addon:${addonKey}`)),
    [loadingKey],
  );

  return {
    loadingKey,
    isLoading,
    isPlanLoading,
    isAddonLoading,
    startPlanCheckout,
    startAddonCheckout,
    startTopUpCheckout,
  };
}
