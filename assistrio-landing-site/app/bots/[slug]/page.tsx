import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ShowcaseBotDetailClient } from "@/components/bots/showcase-bot-detail-client";
import { fetchPublicBotBySlug } from "@/lib/api/public";
import {
  absoluteOgImageUrl,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_SIZE,
  marketingPageMetadata,
} from "@/lib/site-metadata";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const FALLBACK_BOT_TITLE = "Showcase AI Support Agent";

const botSlugMetadataFallback: Metadata = marketingPageMetadata({
  title: FALLBACK_BOT_TITLE,
  description:
    "Explore live AI Support Agent examples on Assistrio — knowledge-based answers, lead capture, and branding on the production-style runtime.",
});

function buildBotDescription(bot: {
  name: string;
  shortDescription: string;
  description?: string;
  category?: string;
}): string {
  const base =
    "Explore this live AI Support Agent example and see how Assistrio delivers knowledge-based answers, lead capture, and branded chat experiences.";
  const fromApi = (bot.description ?? bot.shortDescription ?? "").trim();
  const category = bot.category?.trim();
  if (fromApi.length > 40) {
    const extra = category ? ` ${category}.` : "";
    const line = `${fromApi}${extra}`.replace(/\s+/g, " ").trim();
    return line.length <= 165 ? line : `${line.slice(0, 162)}…`;
  }
  return base;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const base = tryGetPublicApiBaseUrl();
  if (!base) {
    return botSlugMetadataFallback;
  }
  try {
    const bot = await fetchPublicBotBySlug(slug);
    if (!bot) return botSlugMetadataFallback;

    const titleSegment = `${bot.name} — Live AI Support Agent Example`;
    const description = buildBotDescription(bot);
    const ogImageHref = absoluteOgImageUrl(bot.imageUrl);
    const defaultImages: NonNullable<Metadata["openGraph"]>["images"] = [
      { url: DEFAULT_OG_IMAGE_PATH, ...DEFAULT_OG_IMAGE_SIZE, alt: `${titleSegment} · Assistrio` },
    ];
    const ogImages = ogImageHref
      ? [{ url: ogImageHref, alt: `${bot.name} — Assistrio` }]
      : defaultImages;

    return {
      title: titleSegment,
      description,
      alternates: { canonical: `/bots/${encodeURIComponent(bot.slug)}` },
      openGraph: {
        type: "website",
        siteName: "Assistrio",
        title: `${titleSegment} · Assistrio`,
        description,
        url: `/bots/${encodeURIComponent(bot.slug)}`,
        images: ogImages,
      },
      twitter: {
        card: "summary_large_image",
        title: `${titleSegment} · Assistrio`,
        description,
        images: ogImageHref ? [ogImageHref] : [DEFAULT_OG_IMAGE_PATH],
      },
    };
  } catch {
    return botSlugMetadataFallback;
  }
}

export default async function BotDetailPage({ params }: Props) {
  const { slug } = await params;
  const base = tryGetPublicApiBaseUrl();
  if (!base) {
    return (
      <Section spacing="compact" className="pb-20 pt-10">
        <Container size="narrow">
          <p className="rounded-[var(--radius-xl)] border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
            Configure <code className="rounded bg-white px-1">NEXT_PUBLIC_API_BASE_URL</code> to load showcase
            AI Agent details.
          </p>
        </Container>
      </Section>
    );
  }

  let bot: Awaited<ReturnType<typeof fetchPublicBotBySlug>> = null;
  let loadError: string | null = null;
  try {
    bot = await fetchPublicBotBySlug(slug);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load AI Agent";
  }

  if (loadError) {
    return (
      <Section spacing="compact" className="pb-20 pt-10">
        <Container size="narrow">
          <p
            className="rounded-[var(--radius-xl)] border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-[var(--shadow-xs)]"
            role="alert"
          >
            {loadError}
          </p>
        </Container>
      </Section>
    );
  }

  if (!bot) notFound();

  return (
    <Section spacing="compact" className="pb-20 pt-8 sm:pt-10">
      <Container size="narrow">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-white/90 px-3 py-1.5 text-sm font-medium text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] transition hover:border-[var(--border-teal-soft)] hover:bg-[var(--brand-teal-subtle)]/50"
        >
          ← Showcase demos
        </Link>

        <div className="mt-8 rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-br from-white via-slate-50/40 to-[var(--brand-teal-subtle)]/15 p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <span className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/90 text-[2.75rem] shadow-[var(--shadow-xs)]">
              {bot.avatarEmoji}
            </span>
            <div className="min-w-0 flex-1">
              {bot.category ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">{bot.category}</p>
              ) : null}
              <h1 className={`text-page-title sm:text-4xl ${bot.category ? "mt-1" : ""}`}>{bot.name}</h1>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-page-lead">{bot.shortDescription}</p>
        </div>

        <div className="mt-10">
          <ShowcaseBotDetailClient bot={bot} />
        </div>
      </Container>
    </Section>
  );
}
