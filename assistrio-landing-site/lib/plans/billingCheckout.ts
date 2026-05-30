export type PaidPlanCheckoutKey = "starter" | "pro";

export function canUpgradeToPlan(currentPlanKey: string, targetPlanKey: string): boolean {
  if (targetPlanKey === "free") return false;
  if (targetPlanKey !== "starter" && targetPlanKey !== "pro") return false;
  if (targetPlanKey === currentPlanKey) return false;
  if (currentPlanKey === "pro" && targetPlanKey === "starter") return false;
  if (currentPlanKey === "starter" && targetPlanKey === "starter") return false;
  if (currentPlanKey === "pro" && targetPlanKey === "pro") return false;
  return true;
}

export function planCheckoutButtonLabel(
  currentPlanKey: string,
  targetPlanKey: PaidPlanCheckoutKey,
  options?: { isTrialPlan?: boolean },
): string {
  if (targetPlanKey === "starter") {
    if (currentPlanKey === "free" || options?.isTrialPlan) return "Upgrade to Starter";
    return "Upgrade to Starter";
  }
  if (targetPlanKey === "pro") {
    if (currentPlanKey === "starter") return "Upgrade to Pro";
    if (currentPlanKey === "free" || options?.isTrialPlan) return "Upgrade to Pro";
    return "Upgrade to Pro";
  }
  return "Upgrade";
}

export function resolvePlanCardCheckoutAction(input: {
  planKey: string;
  currentPlanKey: string;
  isTrialPlan: boolean;
  checkoutAvailable: boolean;
  isOwner: boolean;
}): {
  label: string;
  disabled: boolean;
  canCheckout: boolean;
  canChangePlan: boolean;
} {
  const { planKey, currentPlanKey, isTrialPlan, checkoutAvailable, isOwner } = input;

  if (planKey === "free") {
    const isCurrent = currentPlanKey === "free" || (isTrialPlan && currentPlanKey === "free");
    return {
      label: isCurrent ? "Current plan" : "Coming soon",
      disabled: true,
      canCheckout: false,
      canChangePlan: false,
    };
  }

  const isCurrentPaid = planKey === currentPlanKey && !(isTrialPlan && currentPlanKey === "free");

  if (isCurrentPaid) {
    return { label: "Current plan", disabled: true, canCheckout: false, canChangePlan: false };
  }

  if (currentPlanKey === "pro" && planKey === "starter") {
    const enabled = isOwner && checkoutAvailable;
    return {
      label: "Downgrade to Starter",
      disabled: !enabled,
      canCheckout: false,
      canChangePlan: enabled,
    };
  }

  if (!isOwner || !checkoutAvailable) {
    return { label: "Coming soon", disabled: true, canCheckout: false, canChangePlan: false };
  }

  if (!canUpgradeToPlan(currentPlanKey, planKey)) {
    return { label: "Coming soon", disabled: true, canCheckout: false, canChangePlan: false };
  }

  return {
    label: planCheckoutButtonLabel(currentPlanKey, planKey as PaidPlanCheckoutKey, { isTrialPlan }),
    disabled: false,
    canCheckout: true,
    canChangePlan: false,
  };
}

export function isPerBotKbAddonKey(addonKey: string): boolean {
  return addonKey === "kb_storage_5mb" || addonKey === "kb_storage_10mb";
}

export function isTopUpAddonKey(addonKey: string): boolean {
  return addonKey === "ai_credits_1000";
}
