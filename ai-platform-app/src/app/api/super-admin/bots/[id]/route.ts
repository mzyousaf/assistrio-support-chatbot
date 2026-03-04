import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { normalizeBotPayload } from "@/lib/botPayload";
import { connectToDatabase } from "@/lib/mongoose";
import { generateUniqueBotSlug } from "@/lib/slug";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectToDatabase();

    const bot = await Bot.findById(id)
      .select({
        name: 1,
        shortDescription: 1,
        description: 1,
        category: 1,
        categories: 1,
        imageUrl: 1,
        openaiApiKeyOverride: 1,
        welcomeMessage: 1,
        knowledgeDescription: 1,
        status: 1,
        isPublic: 1,
        leadCapture: 1,
        chatUI: 1,
        faqs: 1,
        personality: 1,
        config: 1,
        type: 1,
      })
      .lean();

    if (!bot || bot.type !== "showcase") {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      bot: {
        id: String(bot._id),
        name: bot.name || "",
        shortDescription: bot.shortDescription || "",
        description: bot.description || "",
        category: bot.category || "",
        categories: bot.categories || [],
        imageUrl: bot.imageUrl || "",
        openaiApiKeyOverride: bot.openaiApiKeyOverride || "",
        welcomeMessage: bot.welcomeMessage || "",
        knowledgeDescription: bot.knowledgeDescription || "",
        status: bot.status === "published" ? "published" : "draft",
        isPublic: Boolean(bot.isPublic),
        leadCapture: bot.leadCapture || undefined,
        chatUI: bot.chatUI || undefined,
        faqs:
          Array.isArray(bot.faqs)
            ? bot.faqs.map((faq) => ({
                question: String(faq?.question ?? ""),
                answer: String(faq?.answer ?? ""),
              }))
            : [],
        personality: bot.personality || {},
        config: bot.config || {},
      },
    });
  } catch (error) {
    console.error("Get bot failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      name?: unknown;
      shortDescription?: unknown;
      description?: unknown;
      categories?: unknown;
      imageUrl?: unknown;
      knowledgeDescription?: unknown;
      faqs?: unknown;
      welcomeMessage?: unknown;
      leadCapture?: unknown;
      chatUI?: unknown;
      personality?: unknown;
      config?: unknown;
      openaiApiKeyOverride?: unknown;
      isPublic?: unknown;
      status?: unknown;
    };

    const normalized = normalizeBotPayload(body);
    const status = normalized.status === "published" ? "published" : "draft";

    const name = normalized.name.trim();
    const description = String(normalized.description ?? "").trim();
    if (status === "published") {
      if (!name) {
        return NextResponse.json({ error: "Name is required to publish." }, { status: 400 });
      }
      if (!description) {
        return NextResponse.json({ error: "Description is required to publish." }, { status: 400 });
      }
    }

    await connectToDatabase();

    const existing = await Bot.findById(id).select("_id type name slug").lean();
    if (!existing || existing.type !== "showcase") {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const finalName = name || "New bot";
    const shouldUpdateSlug = finalName !== String(existing.name ?? "");
    let nextSlug = String(existing.slug ?? "");
    if (shouldUpdateSlug) {
      nextSlug = await generateUniqueBotSlug(finalName, { excludeBotId: id });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await Bot.findByIdAndUpdate(id, {
          name: finalName,
          slug: nextSlug,
          shortDescription: normalized.shortDescription || "",
          description,
          categories: normalized.categories,
          category: normalized.categories[0] || undefined,
          imageUrl: normalized.imageUrl || "",
          openaiApiKeyOverride: normalized.openaiApiKeyOverride || undefined,
          welcomeMessage: normalized.welcomeMessage || "",
          knowledgeDescription: normalized.knowledgeDescription || "",
          faqs: normalized.faqs,
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          personality: normalized.personality,
          config: normalized.config,
          isPublic: normalized.isPublic,
          status,
        });
        return NextResponse.json({ ok: true, botId: id, status });
      } catch (error) {
        const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
        if (!(mongoError.code === 11000 && mongoError.keyPattern?.slug)) {
          throw error;
        }
        nextSlug = await generateUniqueBotSlug(finalName, { excludeBotId: id });
      }
    }

    return NextResponse.json({ error: "Failed to allocate unique slug." }, { status: 500 });
  } catch (error) {
    console.error("Update bot failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
