import { Package } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

type Props = {
  summary: WorkspaceBillingSummary;
};

function formatAddonPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    return `${formatUsagePeriodDate(start)} – ${formatUsagePeriodDate(end)}`;
  }
  if (end) return `Renews ${formatUsagePeriodDate(end)}`;
  return null;
}

export function BillingActiveAddonsSection({ summary }: Props) {
  const addons = summary.activeAddons ?? [];
  if (addons.length === 0) return null;

  return (
    <section aria-labelledby="billing-active-addons-heading" className="space-y-3">
      <div>
        <h2 id="billing-active-addons-heading" className="m-0 text-base font-semibold text-slate-900">
          Active add-ons
        </h2>
        <p className="m-0 mt-1 text-sm text-slate-500">
          Workspace add-ons billed through your subscription.
        </p>
      </div>

      <div className="grid gap-3">
        {addons.map((addon) => {
          const period = formatAddonPeriod(addon.currentPeriodStart, addon.currentPeriodEnd);
          const target =
            addon.targetBotName != null
              ? ` · ${addon.targetBotName}`
              : addon.targetBotId
                ? ` · Bot ${addon.targetBotId}`
                : '';

          return (
            <SettingsInfoCard
              key={`${addon.addonKey}-${addon.targetBotId ?? 'workspace'}`}
              icon={Package}
              title={addon.name}
              description={`${addon.status}${target}${period ? ` · ${period}` : ''}`}
              variant="muted"
            />
          );
        })}
      </div>
    </section>
  );
}
