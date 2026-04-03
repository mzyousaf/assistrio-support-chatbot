import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { siteMeta, siteRoutes } from "@/content/site";
import type { PublicBotDetail } from "@/types/public-bot";
import { BotDetailPageClient } from "./BotDetailPageClient";

async function fetchBotDetail(slug: string): Promise<PublicBotDetail | null> {
  if (!API_BASE_URL) return null;
  const res = await fetch(`${API_BASE_URL}/api/public/bots/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  const accessKey = typeof o.accessKey === "string" ? o.accessKey : "";
  if (!id || !name || !accessKey) return null;
  return {
    id,
    slug: typeof o.slug === "string" ? o.slug : slug,
    name,
    visibility: "public",
    accessKey,
    shortDescription: typeof o.shortDescription === "string" ? o.shortDescription : "",
    ...(typeof o.description === "string" && o.description.trim()
      ? { description: o.description.trim() }
      : {}),
    ...(typeof o.category === "string" && o.category.trim() ? { category: o.category.trim() } : {}),
    avatarEmoji: typeof o.avatarEmoji === "string" ? o.avatarEmoji : "💬",
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : "",
    ...(typeof o.welcomeMessage === "string" && o.welcomeMessage.trim()
      ? { welcomeMessage: o.welcomeMessage.trim() }
      : {}),
    chatUI: o.chatUI,
    faqs: Array.isArray(o.faqs)
      ? (o.faqs as unknown[])
          .map((f) => {
            if (!f || typeof f !== "object") return null;
            const q = (f as { question?: unknown }).question;
            const a = (f as { answer?: unknown }).answer;
            if (typeof q !== "string" || typeof a !== "string") return null;
            return { question: q.trim(), answer: a.trim() };
          })
          .filter((x): x is { question: string; answer: string } => x !== null)
      : [],
    exampleQuestions: Array.isArray(o.exampleQuestions)
      ? (o.exampleQuestions as unknown[]).map((q) => String(q ?? "").trim()).filter(Boolean)
      : [],
  };
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bot = await fetchBotDetail(slug);
  if (!bot) {
    return { title: `Bot — ${siteMeta.name}` };
  }
  return {
    title: `${bot.name} — Demo bots — ${siteMeta.name}`,
    description: bot.shortDescription || `Try the ${bot.name} demo on Assistrio.`,
  };
}

export default async function BotDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const bot = await fetchBotDetail(slug);
  if (!bot) {
    notFound();
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(20,184,166,0.12),transparent)] px-4 py-12 sm:px-6 lg:px-8">
      {!API_BASE_URL ? (
        <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code> is not set — embed cannot load.
          <Link href={siteRoutes.bots} className="ml-2 font-medium underline">
            Back to demos
          </Link>
        </div>
      ) : null}
      <BotDetailPageClient bot={bot} />
    </main>
  );
}
