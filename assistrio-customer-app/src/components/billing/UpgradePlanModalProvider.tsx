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
import { AiCreditsTopUpPromptModal } from '@/components/billing/AiCreditsTopUpPromptModal';
import { BillingDowngradePlanModal } from '@/pages/billing/BillingDowngradePlanModal';
import { BillingUpgradePlanModal } from '@/pages/billing/BillingUpgradePlanModal';
import { PlansModal } from '@/components/billing/PlansModal';
import { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';
import {
  buildWorkspaceBillingSessionKey,
  useWorkspaceBillingSummary,
} from '@/hooks/useWorkspaceBillingSummary';
import {
  AI_CREDITS_TOP_UP_PROMPT_EVENT,
  mapPlanLimitErrorCodeToUpgradeReason,
  PLAN_LIMIT_UPGRADE_EVENT,
  type PlanLimitUpgradeEventDetail,
  type UpgradePlanReason,
} from '@/lib/planLimitError';
import type { PlansModalMode } from '@/lib/planModalDisplay';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '@/lib/workspaceRoles';

export type OpenUpgradeModalInput = {
  reason?: UpgradePlanReason;
  errorCode?: string;
  recommendedPlanKey?: 'starter' | 'pro';
  mode?: PlansModalMode;
};

type UpgradePlanModalContextValue = {
  openUpgradeModal: (input?: OpenUpgradeModalInput) => void;
  closeUpgradeModal: () => void;
  openTopUpPromptModal: () => void;
  closeTopUpPromptModal: () => void;
};

const UpgradePlanModalContext = createContext<UpgradePlanModalContextValue | null>(null);

export function useUpgradePlanModal(): UpgradePlanModalContextValue {
  const ctx = useContext(UpgradePlanModalContext);
  if (!ctx) {
    throw new Error('useUpgradePlanModal must be used within UpgradePlanModalProvider');
  }
  return ctx;
}

type ModalState = {
  open: boolean;
  mode: PlansModalMode;
  reason?: UpgradePlanReason;
};

export function UpgradePlanModalProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const sessionKey = buildWorkspaceBillingSessionKey({
    customerId: customer?.id,
    activeWorkspaceId,
    workspaceIds: customer?.workspaceIds,
  });
  const { summary, reload } = useWorkspaceBillingSummary(activeWorkspaceId, sessionKey);
  const checkout = useBillingCheckout(activeWorkspaceId);
  const subscriptionActions = useBillingSubscriptionActions(activeWorkspaceId, () => {
    void reload();
  });
  const canManageBilling = isWorkspaceManagerRole(role);
  const isOwner = isWorkspaceOwnerRole(role);

  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    mode: 'upgrade',
  });
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [topUpPromptOpen, setTopUpPromptOpen] = useState(false);

  const openUpgradeModal = useCallback(
    (input?: OpenUpgradeModalInput) => {
      if (!canManageBilling) return;
      const reason =
        input?.reason ??
        mapPlanLimitErrorCodeToUpgradeReason(input?.errorCode) ??
        undefined;
      setModalState({
        open: true,
        mode: input?.mode ?? 'upgrade',
        reason,
      });
    },
    [canManageBilling],
  );

  const closeUpgradeModal = useCallback(() => {
    setModalState((current) => ({ ...current, open: false }));
    setDowngradeOpen(false);
    setUpgradeOpen(false);
  }, []);

  const openTopUpPromptModal = useCallback(() => {
    if (!canManageBilling) return;
    setTopUpPromptOpen(true);
  }, [canManageBilling]);

  const closeTopUpPromptModal = useCallback(() => {
    setTopUpPromptOpen(false);
  }, []);

  useEffect(() => {
    if (!canManageBilling) return;
    const onUpgradeEvent = (event: Event) => {
      const detail = (event as CustomEvent<PlanLimitUpgradeEventDetail>).detail;
      if (!detail) return;
      openUpgradeModal({
        reason:
          detail.reason ??
          mapPlanLimitErrorCodeToUpgradeReason(detail.errorCode) ??
          undefined,
        errorCode: detail.errorCode,
        recommendedPlanKey: detail.recommendedPlanKey,
        mode: 'upgrade',
      });
    };
    const onTopUpPromptEvent = () => {
      openTopUpPromptModal();
    };
    window.addEventListener(PLAN_LIMIT_UPGRADE_EVENT, onUpgradeEvent);
    window.addEventListener(AI_CREDITS_TOP_UP_PROMPT_EVENT, onTopUpPromptEvent);
    return () => {
      window.removeEventListener(PLAN_LIMIT_UPGRADE_EVENT, onUpgradeEvent);
      window.removeEventListener(AI_CREDITS_TOP_UP_PROMPT_EVENT, onTopUpPromptEvent);
    };
  }, [canManageBilling, openTopUpPromptModal, openUpgradeModal]);

  const value = useMemo(
    () => ({
      openUpgradeModal,
      closeUpgradeModal,
      openTopUpPromptModal,
      closeTopUpPromptModal,
    }),
    [closeTopUpPromptModal, closeUpgradeModal, openTopUpPromptModal, openUpgradeModal],
  );

  const handleSummaryUpdated = useCallback(() => {
    void reload();
  }, [reload]);

  const topUpCheckoutAvailable =
    summary?.topUpCheckoutAvailable ??
    summary?.addonCatalog?.find((addon) => addon.key === 'ai_credits_1000')?.checkoutAvailable ??
    true;

  return (
    <UpgradePlanModalContext.Provider value={value}>
      {children}
      {summary && activeWorkspaceId ? (
        <>
          <PlansModal
            open={modalState.open}
            onClose={closeUpgradeModal}
            summary={summary}
            workspaceId={activeWorkspaceId}
            role={role ?? undefined}
            isOwner={isOwner}
            checkout={checkout}
            mode={modalState.mode}
            upgradeReason={modalState.reason}
            onSummaryUpdated={handleSummaryUpdated}
            onDowngradeToStarter={() => setDowngradeOpen(true)}
            onUpgradeToPro={() => setUpgradeOpen(true)}
            downgradeLoading={subscriptionActions.busy}
            upgradeLoading={subscriptionActions.busy}
          />
          <BillingUpgradePlanModal
            open={upgradeOpen}
            onClose={() => setUpgradeOpen(false)}
            busy={subscriptionActions.busy}
            onConfirm={async () => {
              const ok = await subscriptionActions.changePlan('pro');
              if (ok) {
                setUpgradeOpen(false);
                closeUpgradeModal();
              }
            }}
          />
          <BillingDowngradePlanModal
            open={downgradeOpen}
            onClose={() => setDowngradeOpen(false)}
            busy={subscriptionActions.busy}
            effectiveDate={summary.subscription.currentPeriodEnd}
            onConfirm={async () => {
              const ok = await subscriptionActions.changePlan('starter');
              if (ok) {
                setDowngradeOpen(false);
                closeUpgradeModal();
              }
            }}
          />
          <AiCreditsTopUpPromptModal
            open={topUpPromptOpen}
            onClose={closeTopUpPromptModal}
            checkoutAvailable={topUpCheckoutAvailable}
            busy={checkout.isAddonLoading('ai_credits_1000')}
            onBuyCredits={async () => {
              const ok = await checkout.startTopUpCheckout('ai_credits_1000');
              if (ok) closeTopUpPromptModal();
            }}
          />
        </>
      ) : null}
    </UpgradePlanModalContext.Provider>
  );
}
