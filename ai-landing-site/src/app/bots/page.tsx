import type { Metadata } from "next";
import { API_BASE_URL, LANDING_SITE_BOTS_API_KEY } from "@/lib/config";
import { BotsPageClient, type PublicBot } from "./BotsPageClient";

export const metadata: Metadata = {
  title: "AI Support Bots — Assistrio",
  description:
    "Browse public Assistrio bots or create your own. Open the embed widget from any card.",
};

async function getPublicBots(): Promise<PublicBot[]> {
  if (!API_BASE_URL || !LANDING_SITE_BOTS_API_KEY) return [];
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/landing/bots`, {
      cache: "no-store",
      headers: { "X-API-Key": LANDING_SITE_BOTS_API_KEY },
    });

    if (!response.ok) return [];

    const payload: unknown = await response.json();
    const rawBots = Array.isArray(payload) ? payload : [];

    return rawBots
      .map((bot): PublicBot | null => {
        if (!bot || typeof bot !== "object") return null;

        const typedBot = bot as Record<string, unknown>;
        const id = typeof typedBot.id === "string" ? typedBot.id : "";
        const name = typeof typedBot.name === "string" ? typedBot.name : "";
        const slug = typeof typedBot.slug === "string" ? typedBot.slug : "";
        const accessKey =
          typeof typedBot.accessKey === "string" ? typedBot.accessKey : "";
        const visibility =
          typedBot.visibility === "public" ? "public" : "";
        const createdAt =
          typeof typedBot.createdAt === "string" ? typedBot.createdAt : "";

        if (!id || !name || !slug || !createdAt || !accessKey || !visibility) return null;

        return {
          id,
          name,
          slug,
          accessKey,
          visibility: "public",
          createdAt,
          shortDescription:
            typeof typedBot.shortDescription === "string"
              ? typedBot.shortDescription
              : undefined,
          category:
            typeof typedBot.category === "string"
              ? typedBot.category
              : undefined,
          avatarEmoji:
            typeof typedBot.avatarEmoji === "string"
              ? typedBot.avatarEmoji
              : undefined,
          imageUrl:
            typeof typedBot.imageUrl === "string" ? typedBot.imageUrl : undefined,
        };
      })
      .filter((b): b is PublicBot => b !== null);
  } catch {
    return [];
  }
}

export default async function BotsPage() {
  const bots = await getPublicBots();

  return <BotsPageClient bots={bots} />;
}
