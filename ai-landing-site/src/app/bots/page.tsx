import { PLATFORM_BASE_URL } from "@/lib/config";
import { BotsPageClient } from "./BotsPageClient";

type PublicBot = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  createdAt: string;
};

async function getPublicBots(): Promise<PublicBot[]> {
  try {
    const response = await fetch(`${PLATFORM_BASE_URL}/api/public/bots`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    const rawBots = Array.isArray(payload) ? payload : [];

    const bots: PublicBot[] = rawBots
      .map((bot): PublicBot | null => {
        if (!bot || typeof bot !== "object") return null;

        const typedBot = bot as Record<string, unknown>;
        const id = typeof typedBot.id === "string" ? typedBot.id : "";
        const name = typeof typedBot.name === "string" ? typedBot.name : "";
        const slug = typeof typedBot.slug === "string" ? typedBot.slug : "";
        const createdAt =
          typeof typedBot.createdAt === "string" ? typedBot.createdAt : "";

        if (!id || !name || !slug || !createdAt) return null;

        return {
          id,
          name,
          slug,
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

    return bots;
  } catch {
    return [];
  }
}

export default async function BotsPage() {
  const bots = await getPublicBots();

  return <BotsPageClient bots={bots} />;
}
