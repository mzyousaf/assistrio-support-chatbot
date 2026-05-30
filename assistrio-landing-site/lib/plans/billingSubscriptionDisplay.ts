export function shouldShowPlanPricingCard(input: {
  planKey: string;
  currentPlanKey: string;
  isTrialPlan: boolean;
}): boolean {
  if (input.planKey !== "free") return true;
  if (input.currentPlanKey === "starter" || input.currentPlanKey === "pro") return false;
  return true;
}
