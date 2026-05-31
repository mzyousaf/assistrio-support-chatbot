export function isBillingAddonAdded(input: {
  addonKey: string;
  status?: string;
  extraBotInstanceCount?: number;
  hasTopUpBalance?: boolean;
}): boolean {
  if (input.addonKey === 'extra_bot') {
    return (input.extraBotInstanceCount ?? 0) > 0;
  }
  if (input.addonKey === 'ai_credits_1000') {
    return Boolean(input.hasTopUpBalance);
  }

  const status = input.status ?? 'inactive';
  return status === 'active' || status === 'cancel_at_period_end';
}
