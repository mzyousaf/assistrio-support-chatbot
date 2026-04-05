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
