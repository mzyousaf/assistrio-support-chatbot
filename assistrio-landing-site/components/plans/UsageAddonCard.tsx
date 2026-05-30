import { Package, Sparkles } from "lucide-react";
import type { WorkspaceBillingAddonCatalogCard } from "@/types/billing";
import { Button } from "@/components/ui/button";
import { PAID_PLAN_ADDON_COPY } from "@/lib/plans/planEntitlements";
import { LANDING_PLANS_PAGE } from "@/lib/plans/landing-plans-copy";
import { isTopUpAddonKey } from "@/lib/plans/billingCheckout";
import {
  formatAddonCardPriceLine,
  formatAddonDescription,
  formatAddonDisplayName,
} from "@/lib/plans/billingSummaryDisplay";

type Props = {
  addon: WorkspaceBillingAddonCatalogCard;
  variant?: "usage" | "plans" | "marketing";
  currentPlanKey?: string | null;
  isOwner?: boolean;
  addonsAllowed?: boolean;
  checkoutLoading?: boolean;
  onPurchase?: () => void;
};

function addonIntervalBadge(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.billingInterval === "one_time") return "One-time";
  return addon.scope === "bot" ? "Per bot / month" : "Monthly";
}

function MarketingAddonCard({ addon }: { addon: WorkspaceBillingAddonCatalogCard }) {
  const title = formatAddonDisplayName(addon);
  const priceLine = formatAddonCardPriceLine(addon);
  const description = formatAddonDescription(addon);
  const intervalLabel = addonIntervalBadge(addon);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/90 p-5 shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.03] transition-[box-shadow,border-color] duration-200 hover:border-[var(--border-teal-soft)] hover:shadow-[var(--shadow-md)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--brand-teal-faint)] opacity-80" aria-hidden />

      <div className="relative flex items-start gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100/80 text-teal-700 ring-1 ring-teal-200/60"
          aria-hidden
        >
          <Package size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-base font-semibold leading-snug text-slate-900">{title}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {intervalLabel}
            </span>
          </div>
          <p className="m-0 mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-100">
            <Sparkles size={12} strokeWidth={2} className="shrink-0 text-teal-600" aria-hidden />
            {LANDING_PLANS_PAGE.addonAvailabilityNote}
          </p>
        </div>
      </div>

      <p className="relative m-0 mt-4 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {priceLine}
      </p>
      <p className="relative m-0 mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
    </article>
  );
}

/** Copied from customer Plans add-on cards; marketing variant uses landing layout. */
export function UsageAddonCard({
  addon,
  variant = "usage",
  currentPlanKey,
  isOwner = false,
  addonsAllowed = false,
  checkoutLoading = false,
  onPurchase,
}: Props) {
  if (variant === "marketing") {
    return <MarketingAddonCard addon={addon} />;
  }

  const title = formatAddonDisplayName(addon);
  const priceLine = formatAddonCardPriceLine(addon);
  const description = formatAddonDescription(addon);
  const isPlansPage = variant === "plans";
  const onFreePlan = currentPlanKey === "free" || !currentPlanKey;
  const canPurchase =
    isPlansPage && isOwner && addonsAllowed && addon.checkoutAvailable && Boolean(onPurchase);
  const addonStatusCopy = onFreePlan ? PAID_PLAN_ADDON_COPY : "Coming soon";
  const purchaseLabel =
    addon.billingInterval === "one_time" || isTopUpAddonKey(addon.key) ? "Buy add-on" : "Add";

  return (
    <article className="w-full rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100"
          aria-hidden
        >
          <Package size={17} strokeWidth={1.75} />
        </div>
        <h3 className="m-0 min-w-0 pt-1 text-base font-semibold text-slate-900">{title}</h3>
      </div>

      {isPlansPage ? (
        onFreePlan || !addonsAllowed ? (
          <p className="m-0 mt-4 text-sm text-slate-500">{addonStatusCopy}</p>
        ) : !isOwner ? (
          <p className="m-0 mt-4 text-sm text-slate-500">Only the workspace owner can manage billing.</p>
        ) : !addon.checkoutAvailable ? (
          <p className="m-0 mt-4 text-sm text-slate-500">Coming soon</p>
        ) : null
      ) : null}

      <p className="m-0 mt-3 text-sm font-semibold tabular-nums text-slate-900">{priceLine}</p>
      <p className="m-0 mt-2 text-sm leading-relaxed text-slate-600">{description}</p>

      {isPlansPage && canPurchase ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 w-full sm:w-auto"
          disabled={checkoutLoading}
          onClick={onPurchase}
        >
          {checkoutLoading ? "Starting checkout…" : purchaseLabel}
        </Button>
      ) : null}
    </article>
  );
}
