import { Bot } from "@/models/Bot";

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "bot";
}

export async function generateUniqueBotSlug(
  base: string,
  options?: { excludeBotId?: string },
): Promise<string> {
  const normalizedBase = slugify(base);
  const excludeBotId = options?.excludeBotId;
  const buildQuery = (candidate: string) =>
    excludeBotId
      ? { slug: candidate, _id: { $ne: excludeBotId } }
      : { slug: candidate };

  const existing = await Bot.findOne(buildQuery(normalizedBase)).select("_id").lean();
  if (!existing) {
    return normalizedBase;
  }

  for (let attempt = 2; attempt <= 50; attempt += 1) {
    const candidate = `${normalizedBase}-${attempt}`;
    const collides = await Bot.findOne(buildQuery(candidate)).select("_id").lean();
    if (!collides) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique slug. Please try a different bot name.");
}
