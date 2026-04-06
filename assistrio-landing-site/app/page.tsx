import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { FinalCta } from "@/components/sections/home/final-cta";
import { Hero } from "@/components/sections/home/hero";
import { HomeEvaluationToProduction } from "@/components/sections/home/home-evaluation-to-production";
import { HomeCapabilityCarousel } from "@/components/sections/home/home-capability-carousel";
import { HomeCoreValue } from "@/components/sections/home/home-core-value";
import { HomeIndustryCarousel } from "@/components/sections/home/home-industry-carousel";
import { HomePrimarySectionsTabs } from "@/components/sections/home/home-primary-sections-tabs";
import { HomeProductExperience } from "@/components/sections/home/home-product-experience";
import { PlansOverview } from "@/components/sections/home/plans-overview";

const PRIMARY_SECTION_LABELS = ["How teams go live", "Customize it", "The complete picture"] as const;

const HOME_TITLE = "AI Support Agents for your website";

export const metadata: Metadata = {
  ...marketingPageMetadata({
    title: HOME_TITLE,
    description:
      "Your AI Support Agent is always on — so customers get answers when you are away. Your brand, your control on the websites you allow. Fully customizable AI Support with knowledge base, lead capture, branding, and analytics in one product.",
    path: "/",
  }),
  /** Root `page` title must be explicit — `title.template` from layout does not apply the ` · Assistrio` suffix here. */
  title: { absolute: `${HOME_TITLE} · Assistrio` },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <HomePrimarySectionsTabs tabLabels={PRIMARY_SECTION_LABELS}>
        <HomeEvaluationToProduction embeddedInCarousel />
        <HomeProductExperience embeddedInCarousel />
        <HomeCoreValue embeddedInCarousel />
      </HomePrimarySectionsTabs>
      <HomeCapabilityCarousel />
      <PlansOverview />
      <HomeIndustryCarousel />
      <FinalCta />
    </>
  );
}
