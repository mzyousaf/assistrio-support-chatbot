import type { PublicBot } from "@/types/landing-bots";

/** Normalize backend public bot list JSON (landing or `/api/public/bots`). */
export function normalizePublicBotsPayload(payload: unknown): PublicBot[] {
  const rawBots = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { bots?: unknown }).bots)
      ? ((payload as { bots: unknown[] }).bots)
      : [];

  return rawBots
    .map((bot): PublicBot | null => {
      if (!bot || typeof bot !== "object") return null;

      const typedBot = bot as Record<string, unknown>;
      const id = typeof typedBot.id === "string" ? typedBot.id : "";
      const name = typeof typedBot.name === "string" ? typedBot.name : "";
      const slug = typeof typedBot.slug === "string" ? typedBot.slug : "";
      const accessKey = typeof typedBot.accessKey === "string" ? typedBot.accessKey : "";
      const visibility = typedBot.visibility === "public" ? "public" : "";
      const createdAt = typeof typedBot.createdAt === "string" ? typedBot.createdAt : "";

      if (!id || !name || !slug || !createdAt || !accessKey || !visibility) return null;

      return {
        id,
        name,
        slug,
        accessKey,
        visibility: "public",
        createdAt,
        shortDescription:
          typeof typedBot.shortDescription === "string" ? typedBot.shortDescription : undefined,
        category: typeof typedBot.category === "string" ? typedBot.category : undefined,
        avatarEmoji: typeof typedBot.avatarEmoji === "string" ? typedBot.avatarEmoji : undefined,
        imageUrl: typeof typedBot.imageUrl === "string" ? typedBot.imageUrl : undefined,
      };
    })
    .filter((b): b is PublicBot => b !== null);
}
