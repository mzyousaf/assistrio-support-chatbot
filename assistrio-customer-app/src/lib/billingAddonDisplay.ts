import type { WorkspaceBillingSummary } from '@/api/types';

const ADDON_CHIP_LABELS: Record<string, string> = {
  extra_bot: 'Extra bot',
  remove_branding: 'Remove branding',
  ai_credits_1000: 'AI top-up',
};

export function formatActiveAddonChipLabel(addonKey: string, name: string): string {
  return ADDON_CHIP_LABELS[addonKey] ?? name;
}

export type BillingAddonChip = {
  key: string;
  label: string;
};

export function buildBillingAddonChips(summary: WorkspaceBillingSummary): BillingAddonChip[] {
  const chips: BillingAddonChip[] = (summary.activeAddons ?? []).map((addon) => ({
    key: `${addon.addonKey}-${addon.targetBotId ?? 'workspace'}`,
    label: formatActiveAddonChipLabel(addon.addonKey, addon.name),
  }));

  const topUpRemaining = summary.usage.aiCredits.topUpCreditsRemaining ?? 0;
  if (topUpRemaining > 0 && !chips.some((c) => c.label === 'AI top-up')) {
    chips.push({
      key: 'top-up-credits-remaining',
      label: `AI top-up · ${topUpRemaining.toLocaleString()} remaining`,
    });
  }

  return chips;
}
