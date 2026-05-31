import type { WorkspaceBillingSummary } from '@/api/types';
import {
  CUSTOMER_EXTRA_AI_AGENT,
  formatCustomerFacingAgentText,
} from '@/lib/customerAgentTerminology';

const ADDON_CHIP_LABELS: Record<string, string> = {
  extra_bot: CUSTOMER_EXTRA_AI_AGENT,
  remove_branding: 'Remove branding',
  ai_credits_1000: 'AI top-up',
};

export function formatActiveAddonChipLabel(addonKey: string, name: string): string {
  return ADDON_CHIP_LABELS[addonKey] ?? formatCustomerFacingAgentText(name);
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
