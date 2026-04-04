"use client";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeIdentityTrialCta } from "@/components/sections/home/home-identity-trial-cta";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { ReconnectSavedId } from "@/components/visitor/reconnect-saved-id";
import { StableIdentityPanel } from "@/components/visitor/stable-identity-panel";
import { QuotaSummaryCard } from "@/components/visitor/quota-summary-card";

/** Client boundary: identity hook + quota fetch for the marketing homepage. */
export function HomeIdentityAndUsage() {
  return (
    <Section id="trial" tone="muted" className="border-t border-[var(--border-default)]">
      <Container>
        <HomeSectionHeader id="trial-heading" eyebrow="Trial" title="Set up your bot, then embed">
          <p className="max-w-2xl text-base leading-relaxed">
            Your browser holds a stable <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code> — the
            same anonymous identity model as our public APIs. Save it, reconnect on other devices, and create a trial bot
            tied to your allowlisted hostname. You’ll get a runtime snippet to paste on your site.
          </p>
        </HomeSectionHeader>
        <div className="mt-8 flex flex-wrap gap-3">
          <HomeIdentityTrialCta />
        </div>
        <div className="mt-10 space-y-8 rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[var(--shadow-sm)] sm:p-7">
          <ReconnectSavedId variant="compact" />
          <div className="grid gap-8 border-t border-[var(--border-default)] pt-8 lg:grid-cols-2 lg:items-start">
            <StableIdentityPanel />
            <QuotaSummaryCard />
          </div>
        </div>
      </Container>
    </Section>
  );
}
