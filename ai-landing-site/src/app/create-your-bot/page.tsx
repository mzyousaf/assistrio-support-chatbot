import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/shared/button-link";
import { siteCtaLabels, siteMeta, siteRoutes } from "@/content/site";

export const metadata: Metadata = {
  title: `Create your agent — ${siteMeta.name}`,
  description:
    "Start building a custom AI support agent trained on your website, FAQs, and documents.",
};

export default function CreateYourBotPage() {
  return (
    <main className="py-16 md:py-24">
      <Container className="max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          Create your agent
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          This flow is coming soon. In the meantime, browse public demos or reach out
          to discuss a hosted or custom setup for your site.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink
            href={siteRoutes.bots}
            label={siteCtaLabels.browseDemos}
            variant="primary"
          />
          <ButtonLink
            href={siteRoutes.contact}
            label={siteCtaLabels.talkToUs}
            variant="secondary"
          />
        </div>
        <p className="mt-10 text-sm text-neutral-500">
          <Link href={siteRoutes.home} className="font-medium text-brand hover:underline">
            Back to home
          </Link>
        </p>
      </Container>
    </main>
  );
}
