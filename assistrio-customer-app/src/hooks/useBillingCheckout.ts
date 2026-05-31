import { useCallback, useState } from 'react';
import {
  createAddonCheckoutSession,
  createPlanCheckoutSession,
  createTopUpCheckoutSession,
} from '@/api/customerApi';
import type { ApiResult, BillingCheckoutSessionResponse } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { planBillingPeriodToInterval } from '@/lib/billingInterval.util';
import { isTopUpAddonKey, mapBillingCheckoutError } from '@/lib/billingCheckout';
import type { PaidPlanCheckoutKey } from '@/lib/billingCheckout';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';

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
    (planKey: PaidPlanCheckoutKey, billingPeriod?: PlanBillingPeriod) => {
      const intervalKey = billingPeriod ? planBillingPeriodToInterval(billingPeriod) : 'monthly';
      return runCheckout(`plan:${planKey}:${intervalKey}`, () =>
        createPlanCheckoutSession(
          workspaceId!,
          planKey,
          billingPeriod ? planBillingPeriodToInterval(billingPeriod) : undefined,
        ),
      );
    },
    [runCheckout, workspaceId],
  );

  const startAddonCheckout = useCallback(
    (addonKey: string, targetBotId?: string, billingPeriod?: PlanBillingPeriod) => {
      const intervalKey = billingPeriod ? planBillingPeriodToInterval(billingPeriod) : 'monthly';
      return runCheckout(`addon:${addonKey}:${targetBotId ?? ''}:${intervalKey}`, () =>
        createAddonCheckoutSession(
          workspaceId!,
          addonKey,
          targetBotId,
          billingPeriod ? planBillingPeriodToInterval(billingPeriod) : undefined,
        ),
      );
    },
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
    (planKey: string, billingPeriod?: PlanBillingPeriod) => {
      if (!billingPeriod) {
        return Boolean(loadingKey?.startsWith(`plan:${planKey}:`));
      }
      return loadingKey === `plan:${planKey}:${planBillingPeriodToInterval(billingPeriod)}`;
    },
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
