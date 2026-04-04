import { FinalCta } from "@/components/sections/home/final-cta";
import { Hero } from "@/components/sections/home/hero";
import { HomeStickyNav } from "@/components/sections/home/home-sticky-nav";
import { HomeDashboard } from "@/components/sections/home/home-dashboard";
import { HomeIdentityAndUsage } from "@/components/sections/home/home-identity-and-usage";
import { HomeFaq } from "@/components/sections/home/home-faq";
import { HomeFeatures } from "@/components/sections/home/home-features";
import { HomeLiveDemos } from "@/components/sections/home/home-live-demos";
import { HomeTrust } from "@/components/sections/home/home-trust";
import { HomeUseCases } from "@/components/sections/home/home-use-cases";
import { HomeWidgetShowcase } from "@/components/sections/home/home-widget-showcase";
import { HowItWorks } from "@/components/sections/home/how-it-works";
import { PlansOverview } from "@/components/sections/home/plans-overview";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HomeStickyNav />
      <HomeDashboard />
      <HomeWidgetShowcase />
      <HowItWorks />
      <HomeFeatures />
      <HomeUseCases />
      <HomeLiveDemos />
      <HomeIdentityAndUsage />
      <HomeTrust />
      <PlansOverview />
      <HomeFaq />
      <FinalCta />
    </>
  );
}
