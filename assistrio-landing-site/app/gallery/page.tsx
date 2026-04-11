import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";
import { GalleryGrid } from "@/components/sections/gallery/gallery-grid";
import { ButtonLink } from "@/components/ui/button";
import { fetchPublicShowcaseBots } from "@/lib/api/public";
import { TRIAL_NO_CREDIT_CARD_NOTE, TRIAL_PRIMARY_CTA_LABEL } from "@/lib/trial-primary-cta-label";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";

function GalleryIntro() {
  return (
    <PageIntro eyebrow="Gallery" title="Live AI Agents by Assistrio" largeTitle className="max-w-3xl">
      <p className="text-page-lead">
        <strong>These AI agents are here for you to try</strong> — chat with them live on the same runtime as
        production, so you can see how they answer visitors. <strong>Disclosure:</strong> These are Assistrio showcase
        agents for
        demonstration and evaluation, not a private deployment on your site until you create your own. When you are ready
        for your own on your website, you can create one free.
      </p>
      <div className="pt-2">
        <div className="flex w-fit max-w-full flex-col items-end gap-1.5">
          <ButtonLink
            href="/trial"
            variant="primary"
            className="justify-center px-6 py-3 text-center text-[0.9375rem] leading-snug sm:text-base"
          >
            {TRIAL_PRIMARY_CTA_LABEL}
          </ButtonLink>
          <p className="text-emphasis-primary text-right text-sm leading-snug">{TRIAL_NO_CREDIT_CARD_NOTE}</p>
        </div>
      </div>
    </PageIntro>
  );
}

const galleryHeroSectionClassName =
  "relative overflow-hidden border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/35 to-transparent pb-10 pt-10 sm:pb-12 sm:pt-14";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingPageMetadata({
  title: "Live AI Support Agent examples",
  description:
    "Browse live AI Support Agent examples on the production-style runtime — knowledge-based answers, lead capture, and branding. Try free, then launch your own hosted AI Support Agent on websites you allow.",
  path: "/gallery",
});

export default async function GalleryPage() {
  const base = tryGetPublicApiBaseUrl();
  if (!base) {
    return (
      <Section spacing="compact" className="pb-20 pt-10">
        <Container>
          <PageIntro eyebrow="Gallery" title="Live AI Agents by Assistrio" />
          <p className="mt-6 rounded-[var(--radius-xl)] border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
            Set <code className="rounded bg-white px-1">NEXT_PUBLIC_API_BASE_URL</code> in{" "}
            <code className="rounded bg-white px-1">.env.local</code> to load showcase AI Agents from the Assistrio API.
          </p>
        </Container>
      </Section>
    );
  }

  let bots: Awaited<ReturnType<typeof fetchPublicShowcaseBots>> = [];
  let fetchError: string | null = null;
  try {
    bots = await fetchPublicShowcaseBots();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to load gallery";
  }

  return (
    <>
      {fetchError ? (
        <>
          <Section spacing="compact" className={galleryHeroSectionClassName}>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(13,148,136,0.09),transparent_70%)]"
              aria-hidden
            />
            <Container className="relative">
              <GalleryIntro />
            </Container>
          </Section>
          <Section spacing="compact" className="pb-24 pt-10 sm:pb-28 sm:pt-12">
            <Container>
              <div
                className="rounded-[var(--radius-xl)] border border-red-200/90 bg-red-50/90 px-4 py-4 text-sm text-red-900 shadow-[var(--shadow-xs)]"
                role="alert"
              >
                <p className="font-medium">Could not load AI Support Agents</p>
                <p className="mt-1 text-red-800/95">{fetchError}</p>
              </div>
            </Container>
          </Section>
        </>
      ) : bots.length === 0 ? (
        <>
          <Section spacing="compact" className={galleryHeroSectionClassName}>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(13,148,136,0.09),transparent_70%)]"
              aria-hidden
            />
            <Container className="relative">
              <GalleryIntro />
            </Container>
          </Section>
          <Section spacing="compact" className="pb-24 pt-10 sm:pb-28 sm:pt-12">
            <Container>
              <GalleryGrid bots={bots} />
            </Container>
          </Section>
        </>
      ) : (
        <GalleryGrid bots={bots}>
          <GalleryIntro />
        </GalleryGrid>
      )}
    </>
  );
}
