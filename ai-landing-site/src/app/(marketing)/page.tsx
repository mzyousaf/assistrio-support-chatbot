import type { Metadata } from "next";
import { HomeCapabilityStrip } from "@/components/sections/home/home-capability-strip";
import { HomeCreateAgentCta } from "@/components/sections/home/home-create-agent-cta";
import { HomeFaq } from "@/components/sections/home/home-faq";
import { HomeFinalCta } from "@/components/sections/home/home-final-cta";
import { HomeHero } from "@/components/sections/home/home-hero";
import { HomeHostedVsCustom } from "@/components/sections/home/home-hosted-vs-custom";
import { HomeHowItWorks } from "@/components/sections/home/home-how-it-works";
import { HomePublicBotsPreview } from "@/components/sections/home/home-public-bots-preview";
import { HomeUseCases } from "@/components/sections/home/home-use-cases";
import { HomeValueProps } from "@/components/sections/home/home-value-props";
import { HomeWhyAssistrio } from "@/components/sections/home/home-why-assistrio";
import { homePageContent } from "@/content/home";
import { siteMeta } from "@/content/site";

export const metadata: Metadata = {
  title: `${siteMeta.name} — ${siteMeta.tagline}`,
  description:
    "Launch a custom AI support agent for your website—trained on your FAQs, docs, and pages. Reduce repetitive questions, handle pre-sales, and capture leads.",
};

export default function HomePage() {
  const c = homePageContent;

  return (
    <>
      <HomeHero content={c.hero} />
      <HomeCapabilityStrip content={c.capabilityStrip} />
      <HomeValueProps content={c.valueProps} />
      <HomeHowItWorks content={c.howItWorks} />
      <HomeUseCases content={c.useCases} />
      <HomePublicBotsPreview content={c.publicBotsPreview} />
      <HomeCreateAgentCta content={c.createAgentCta} />
      <HomeWhyAssistrio content={c.whyAssistrio} />
      <HomeHostedVsCustom content={c.hostedVsCustom} />
      <HomeFaq content={c.faq} />
      <HomeFinalCta content={c.finalCta} />
    </>
  );
}
