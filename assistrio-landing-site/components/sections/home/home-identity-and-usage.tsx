"use client";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
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
        <ScrollReveal y={20}>
          <HomeSectionHeader id="trial-heading" eyebrow="Trial" title="Put the bot on your allowed website">
            <p className="max-w-2xl text-base leading-relaxed">
              Configure your trial workspace, set the allowed websites you trust, and paste the runtime snippet where your
              customers already are. When you need to move devices or inspect quota, your session tools are here — without
              leading the story with implementation identifiers.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>
        <div className="mt-8 flex flex-wrap gap-3">
          <HomeIdentityTrialCta />
        </div>
        <ScrollReveal y={18} delay={0.06}>
          <div className="mt-10 space-y-8 rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/85 p-5 shadow-[var(--shadow-md)] ring-1 ring-[var(--brand-teal)]/8 sm:p-7">
            <ReconnectSavedId variant="compact" />
            <div className="grid gap-8 border-t border-[var(--border-default)] pt-8 lg:grid-cols-2 lg:items-start">
              <StableIdentityPanel />
              <QuotaSummaryCard />
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
