import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logVisitorEvent } from "@/lib/analytics";
import { connectToDatabase } from "@/lib/mongoose";
import { getOrCreateVisitor, updateVisitorProfile } from "@/lib/visitors";
import { Bot } from "@/models/Bot";

const createTrialBotSchema = z.object({
  botName: z.string().trim().min(1),
  email: z.string().trim().email(),
  description: z.string().trim().optional(),
  visitorId: z.string().trim().min(1),
  faqs: z.string().optional(),
});

function toSlug(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "trial-bot";
}

async function generateUniqueSlug(botName: string): Promise<string> {
  const baseSlug = toSlug(botName);

  let candidate = baseSlug;
  let attempt = 0;

  while (attempt < 5) {
    const existing = await Bot.findOne({ slug: candidate }).select("_id");
    if (!existing) {
      return candidate;
    }

    const suffix = Math.random().toString(36).slice(2, 8);
    candidate = `${baseSlug}-${suffix}`;
    attempt += 1;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = createTrialBotSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { botName, email, description, visitorId, faqs } = parsed.data;

    await connectToDatabase();

    await getOrCreateVisitor(visitorId);
    await updateVisitorProfile(visitorId, { email });

    let parsedFaqs: Array<{ question: string; answer: string }> = [];
    if (typeof faqs === "string" && faqs.trim()) {
      try {
        const arr = JSON.parse(faqs);
        if (Array.isArray(arr)) {
          parsedFaqs = arr
            .filter(
              (it) =>
                it &&
                typeof it === "object" &&
                typeof (it as { question?: unknown }).question === "string" &&
                typeof (it as { answer?: unknown }).answer === "string",
            )
            .map((it) => ({
              question: (it as { question: string }).question.trim(),
              answer: (it as { answer: string }).answer.trim(),
            }))
            .filter((it) => it.question && it.answer);
        }
      } catch (err) {
        console.error("Failed to parse faqs JSON", err);
      }
    }

    const slug = await generateUniqueSlug(botName);
    const now = new Date();

    const bot = await Bot.create({
      name: botName,
      slug,
      type: "visitor-own",
      ownerVisitorId: visitorId,
      isPublic: false,
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : undefined,
      faqs: parsedFaqs,
      createdAt: now,
    });

    await logVisitorEvent({
      visitorId,
      type: "trial_bot_created",
      botSlug: slug,
      botId: bot._id.toString(),
      metadata: {
        email,
        botName,
      },
    });

    return NextResponse.json({ slug: bot.slug });
  } catch (error) {
    console.error("Create trial bot failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
