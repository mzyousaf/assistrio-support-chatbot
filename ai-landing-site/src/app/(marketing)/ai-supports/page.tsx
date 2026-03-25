import type { Metadata } from "next";
import { AiSupportsDualPaths } from "@/components/sections/ai-supports/ai-supports-dual-paths";
import { AiSupportsFaq } from "@/components/sections/ai-supports/ai-supports-faq";
import { AiSupportsFinalCta } from "@/components/sections/ai-supports/ai-supports-final-cta";
import { AiSupportsHero } from "@/components/sections/ai-supports/ai-supports-hero";
import { AiSupportsHostedVsCustom } from "@/components/sections/ai-supports/ai-supports-hosted-vs-custom";
import { AiSupportsTrainOn } from "@/components/sections/ai-supports/ai-supports-train-on";
import { AiSupportsUseCases } from "@/components/sections/ai-supports/ai-supports-use-cases";
import { AiSupportsWhatItDoes } from "@/components/sections/ai-supports/ai-supports-what-it-does";
import { aiSupportsPageContent } from "@/content/ai-supports";
import { siteMeta } from "@/content/site";

export const metadata: Metadata = {
  title: `AI Supports — ${siteMeta.name}`,
  description:
    "Understand Assistrio’s custom AI support agents: what they do, what to train them on, hosted vs custom delivery, and how to create your agent or browse demos.",
};

export default function AiSupportsPage() {
  const c = aiSupportsPageContent;

  return (
    <>
      <AiSupportsHero content={c.hero} />
      <AiSupportsWhatItDoes content={c.whatItDoes} />
      <AiSupportsTrainOn content={c.trainOn} />
      <AiSupportsUseCases content={c.useCases} />
      <AiSupportsDualPaths content={c.dualPaths} />
      <AiSupportsHostedVsCustom content={c.hostedVsCustom} />
      <AiSupportsFaq content={c.faq} />
      <AiSupportsFinalCta content={c.finalCta} />
    </>
  );
}
