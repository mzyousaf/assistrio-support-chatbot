"use client";

import { useState } from "react";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";
import { TrackedExternalCtaLink } from "@/components/analytics/tracked-external-cta-link";
import { BillingPeriodToggle } from "@/components/plans/BillingPeriodToggle";
import {
  AddonCatalogSection,
  PlanFeatureComparisonSection,
  PlansPricingCardsSection,
} from "@/components/plans/BillingCatalogSections";
import { LANDING_PLANS_BILLING_SUMMARY } from "@/lib/plans/mock-billing-summary";
import { LANDING_PLANS_PAGE } from "@/lib/plans/landing-plans-copy";
import type { PlanBillingPeriod } from "@/lib/plans/planPricingCardDisplay";
import { useLandingCustomerSession } from "@/contexts/landing-customer-session-context";
import {
  CONTINUE_WITH_GOOGLE_CTA_LABEL,
  CONTINUE_WITH_GOOGLE_CTA_LINE,
  CUSTOMER_DASHBOARD_CTA_LABEL,
  CUSTOMER_DASHBOARD_CTA_LINE,
  OPEN_CUSTOMER_APP_CTA_LABEL,
  OPEN_CUSTOMER_APP_CTA_LINE,
} from "@/lib/primary-cta-label";

const PLANS_TITLE_ID = "plans-page-heading";

const footerPrimaryClass =
  "btn-primary-shimmer inline-flex rounded-full px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow-sm)] ring-1 ring-white/15";

export function LandingPlansView() {
  const [billingPeriod, setBillingPeriod] = useState<PlanBillingPeriod>("monthly");
  const { googleAuthStartUrl, customerAppEntryUrl, status } = useLandingCustomerSession();
  const isAuthenticated = status === "authenticated";
  const ctaHref = isAuthenticated && customerAppEntryUrl ? customerAppEntryUrl : googleAuthStartUrl;
  const footerCtaLabel = isAuthenticated
    ? customerAppEntryUrl
      ? OPEN_CUSTOMER_APP_CTA_LABEL
      : CUSTOMER_DASHBOARD_CTA_LABEL
    : CONTINUE_WITH_GOOGLE_CTA_LABEL;
  const footerCtaLine = isAuthenticated
    ? customerAppEntryUrl
      ? OPEN_CUSTOMER_APP_CTA_LINE
      : CUSTOMER_DASHBOARD_CTA_LINE
    : CONTINUE_WITH_GOOGLE_CTA_LINE;

  const handlePlanAction = () => {
    if (ctaHref) window.location.href = ctaHref;
  };

  return (
    <Section
      spacing="snug"
      tone="band"
      className="border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/20 via-white to-[var(--background)]"
    >
      <Container className="max-w-[1200px]">
        <div className="flex flex-col gap-6 border-b border-slate-200/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <PageIntro
            eyebrow={LANDING_PLANS_PAGE.eyebrow}
            title={LANDING_PLANS_PAGE.title}
            titleId={PLANS_TITLE_ID}
            className="max-w-2xl"
          >
            <p className="text-page-lead">{LANDING_PLANS_PAGE.lead}</p>
          </PageIntro>
          <div className="shrink-0 sm:pb-1">
            <BillingPeriodToggle value={billingPeriod} onChange={setBillingPeriod} />
          </div>
        </div>

        <div className="flex flex-col gap-10 pb-12 pt-8">
          <PlansPricingCardsSection
            summary={LANDING_PLANS_BILLING_SUMMARY}
            billingPeriod={billingPeriod}
            marketing
            onPlanAction={ctaHref ? handlePlanAction : undefined}
          />

          <PlanFeatureComparisonSection
            summary={LANDING_PLANS_BILLING_SUMMARY}
            marketing
          />

          <AddonCatalogSection summary={LANDING_PLANS_BILLING_SUMMARY} marketing />
        </div>

        {ctaHref ? (
          <div className="border-t border-slate-200/80 pt-10 text-center">
            <p className="m-0 text-sm text-[var(--foreground-muted)]">
              {isAuthenticated
                ? "Manage plans and billing in the app."
                : "No credit card required to start your free trial."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <TrackedExternalCtaLink
                href={ctaHref}
                location="plans_page_footer"
                label={footerCtaLabel}
                variant="primary"
                className={footerPrimaryClass}
              >
                {footerCtaLine}
              </TrackedExternalCtaLink>
            </div>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
