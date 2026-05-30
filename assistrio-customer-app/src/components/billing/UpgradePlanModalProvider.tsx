import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { UpgradePlanModal } from '@/components/billing/UpgradePlanModal';
import { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { useWorkspaceBillingSummary } from '@/hooks/useWorkspaceBillingSummary';
import { buildWorkspaceBillingSessionKey } from '@/hooks/useWorkspaceBillingSummary';
import {
  defaultRecommendedPlanKeyForReason,
  mapPlanLimitErrorCodeToUpgradeReason,
  PLAN_LIMIT_UPGRADE_EVENT,
  type PlanLimitUpgradeEventDetail,
  type UpgradePlanReason,
} from '@/lib/planLimitError';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '@/lib/workspaceRoles';

export type OpenUpgradeModalInput = {
  reason?: UpgradePlanReason;
  errorCode?: string;
  recommendedPlanKey?: 'starter' | 'pro';
};

type UpgradePlanModalContextValue = {
  openUpgradeModal: (input: OpenUpgradeModalInput) => void;
  closeUpgradeModal: () => void;
};

const UpgradePlanModalContext = createContext<UpgradePlanModalContextValue | null>(null);

type ModalState = {
  open: boolean;
  reason: UpgradePlanReason;
  recommendedPlanKey?: 'starter' | 'pro';
};

const DEFAULT_REASON: UpgradePlanReason = 'credits';

export function useUpgradePlanModal(): UpgradePlanModalContextValue {
  const ctx = useContext(UpgradePlanModalContext);
  if (!ctx) {
    throw new Error('useUpgradePlanModal must be used within UpgradePlanModalProvider');
  }
  return ctx;
}

export function UpgradePlanModalProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomerAuth();
  const { workspace, activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const sessionKey = buildWorkspaceBillingSessionKey({
    customerId: customer?.id,
    activeWorkspaceId,
    workspaceIds: customer?.workspaceIds,
  });
  const { summary } = useWorkspaceBillingSummary(activeWorkspaceId, sessionKey);
  const checkout = useBillingCheckout(activeWorkspaceId);
  const canManageBilling = isWorkspaceManagerRole(role);
  const canUpgrade = isWorkspaceOwnerRole(role);

  const [state, setState] = useState<ModalState>({
    open: false,
    reason: DEFAULT_REASON,
  });

  const openUpgradeModal = useCallback(
    (input: OpenUpgradeModalInput) => {
      if (!canManageBilling) return;
      const mappedReason =
        input.reason ??
        (input.errorCode ? mapPlanLimitErrorCodeToUpgradeReason(input.errorCode) : null);
      if (!mappedReason) return;
      setState({
        open: true,
        reason: mappedReason,
        recommendedPlanKey:
          input.recommendedPlanKey ?? defaultRecommendedPlanKeyForReason(mappedReason),
      });
    },
    [canManageBilling],
  );

  const closeUpgradeModal = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    if (!canManageBilling) return;
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<PlanLimitUpgradeEventDetail>).detail;
      if (!detail) return;
      openUpgradeModal({
        reason: detail.reason,
        errorCode: detail.errorCode,
        recommendedPlanKey: detail.recommendedPlanKey,
      });
    };
    window.addEventListener(PLAN_LIMIT_UPGRADE_EVENT, onEvent);
    return () => window.removeEventListener(PLAN_LIMIT_UPGRADE_EVENT, onEvent);
  }, [canManageBilling, openUpgradeModal]);

  const value = useMemo(
    () => ({ openUpgradeModal, closeUpgradeModal }),
    [closeUpgradeModal, openUpgradeModal],
  );

  const currentPlanKey = summary?.plan.key ?? workspace?.planKey ?? 'free';

  return (
    <UpgradePlanModalContext.Provider value={value}>
      {children}
      <UpgradePlanModal
        open={state.open}
        onClose={closeUpgradeModal}
        reason={state.reason}
        currentPlanKey={currentPlanKey}
        planCatalog={summary?.planCatalog}
        recommendedPlanKey={state.recommendedPlanKey}
        canUpgrade={canUpgrade}
        isTrialPlan={summary?.entitlements.isTrialPlan ?? currentPlanKey === 'free'}
        onPlanCheckout={(planKey) => void checkout.startPlanCheckout(planKey)}
        isPlanCheckoutLoading={checkout.isPlanLoading}
      />
    </UpgradePlanModalContext.Provider>
  );
}
