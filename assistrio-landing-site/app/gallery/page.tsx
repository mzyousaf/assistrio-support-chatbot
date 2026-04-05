import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";
import { GalleryGrid } from "@/components/sections/gallery/gallery-grid";
import { fetchPublicShowcaseBots } from "@/lib/api/public";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live examples",
  description:
    "Browse gallery runtime demos of published showcase bots. Showcase quota is separate from Explore runtime on your own bot; owner preview stays in Assistrio.",
};

export default async function GalleryPage() {
  const base = tryGetPublicApiBaseUrl();
  if (!base) {
    return (
      <Section spacing="compact" className="pb-20 pt-10">
        <Container>
          <PageIntro eyebrow="Gallery" title="Live examples" />
          <p className="mt-6 rounded-[var(--radius-xl)] border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
            Set <code className="rounded bg-white px-1">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> in{" "}
            <code className="rounded bg-white px-1">.env.local</code> to load bots from the Assistrio API.
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
      <Section
        spacing="compact"
        className="relative overflow-hidden border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/35 to-transparent pb-10 pt-10 sm:pb-12 sm:pt-14"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(13,148,136,0.09),transparent_70%)]"
          aria-hidden
        />
        <Container className="relative">
          <PageIntro eyebrow="Gallery" title="See live examples" largeTitle className="max-w-3xl">
            <p className="text-page-lead">
              A browsable library of <strong className="font-medium text-slate-800">published showcase</strong> bots from{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">GET /api/public/bots</code>. Each card opens a detail page
              with a real <strong className="font-medium text-slate-800">runtime</strong> embed — not owner preview, and not
              a substitute for <strong className="font-medium text-slate-800">Try it free</strong> with your own
              evaluation bot.
            </p>
            <p className="text-page-meta">
              Gallery traffic draws from the <strong className="font-medium text-slate-700">showcase runtime</strong> slice
              of your saved <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code> quota (see
              Identity &amp; usage on the homepage). Owner preview stays in Assistrio app UIs.{" "}
              <Link href="/trial" className="link-inline">
                Try it free
              </Link>{" "}
              when you want your own bot and your own allowed websites — separate from browsing examples here.
            </p>
          </PageIntro>
        </Container>
      </Section>

      <Section spacing="compact" className="pb-20 pt-8 sm:pt-10">
        <Container>
          {fetchError ? (
            <div
              className="rounded-[var(--radius-xl)] border border-red-200/90 bg-red-50/90 px-4 py-4 text-sm text-red-900 shadow-[var(--shadow-xs)]"
              role="alert"
            >
              <p className="font-medium">Could not load demos</p>
              <p className="mt-1 text-red-800/95">{fetchError}</p>
            </div>
          ) : (
            <GalleryGrid bots={bots} />
          )}
        </Container>
      </Section>
    </>
  );
}
