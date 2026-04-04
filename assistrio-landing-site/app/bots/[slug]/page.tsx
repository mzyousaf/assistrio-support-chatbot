import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ShowcaseBotDetailClient } from "@/components/bots/showcase-bot-detail-client";
import { fetchPublicBotBySlug } from "@/lib/api/public";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const base = tryGetPublicApiBaseUrl();
  if (!base) return { title: "Showcase bot" };
  try {
    const bot = await fetchPublicBotBySlug(slug);
    if (!bot) return { title: "Showcase bot" };
    return {
      title: bot.name,
      description: bot.shortDescription,
    };
  } catch {
    return { title: "Showcase bot" };
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
            Configure <code className="rounded bg-white px-1">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> to load showcase
            bot details.
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
    loadError = e instanceof Error ? e.message : "Failed to load bot";
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
