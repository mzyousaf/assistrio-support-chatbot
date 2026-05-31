export function readAiCreditsAutoTopUpPromptEnabled(subscription: {
  aiCreditsAutoTopUpPromptEnabled?: boolean | null;
  creditAutoTopUpEnabled?: boolean | null;
} | null | undefined): boolean {
  if (!subscription) return false;
  if (typeof subscription.aiCreditsAutoTopUpPromptEnabled === 'boolean') {
    return subscription.aiCreditsAutoTopUpPromptEnabled;
  }
  return Boolean(subscription.creditAutoTopUpEnabled);
}

export function readAutoTopUpThresholdCredits(subscription: {
  autoTopUpThresholdCredits?: number | null;
} | null | undefined): number {
  const value = Number(subscription?.autoTopUpThresholdCredits ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}
