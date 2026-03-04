import { NextRequest, NextResponse } from "next/server";

import { normalizeBotPayload } from "@/lib/botPayload";
import { connectToDatabase } from "@/lib/mongoose";
import { generateUniqueBotSlug } from "@/lib/slug";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      clientDraftId?: string;
      payload?: {
        name?: unknown;
        shortDescription?: unknown;
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
      };
    };

    const clientDraftId = String(body.clientDraftId ?? "").trim();
    if (!clientDraftId) {
      return NextResponse.json({ error: "clientDraftId is required" }, { status: 400 });
    }

    const normalized = normalizeBotPayload(body.payload ?? {});
    const finalName = normalized.name || "Draft bot";
    const finalDescription = normalized.description || "";

    await connectToDatabase();

    const existing = await Bot.findOne({ clientDraftId }).select("_id slug name createdAt").lean();
    if (existing) {
      let finalSlug = existing.slug;
      const shouldUpdateSlug = finalName !== String(existing.name ?? "");
      if (!finalSlug || shouldUpdateSlug) {
        finalSlug = await generateUniqueBotSlug(finalName || "draft-bot", {
          excludeBotId: String(existing._id),
        });
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await Bot.updateOne(
            { _id: existing._id },
            {
              name: finalName,
              slug: finalSlug,
              shortDescription: normalized.shortDescription,
              description: finalDescription,
              categories: normalized.categories,
              category: normalized.categories[0] || undefined,
              imageUrl: normalized.imageUrl,
              openaiApiKeyOverride: normalized.openaiApiKeyOverride,
              welcomeMessage: normalized.welcomeMessage,
              knowledgeDescription: normalized.knowledgeDescription,
              leadCapture: normalized.leadCapture,
              chatUI: normalized.chatUI,
              faqs: normalized.faqs,
              personality: normalized.personality,
              config: normalized.config,
              type: "showcase",
              status: "published",
              clientDraftId: undefined,
              isPublic: normalized.isPublic,
            },
          );
          return NextResponse.json({ ok: true, botId: String(existing._id), slug: finalSlug });
        } catch (error) {
          const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
          if (!(mongoError.code === 11000 && mongoError.keyPattern?.slug)) {
            throw error;
          }
          finalSlug = await generateUniqueBotSlug(finalName || "draft-bot", {
            excludeBotId: String(existing._id),
          });
        }
      }
      return NextResponse.json({ error: "Failed to allocate unique slug." }, { status: 500 });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = await generateUniqueBotSlug(finalName || "draft-bot");
      try {
        const created = await Bot.create({
          name: finalName,
          slug,
          shortDescription: normalized.shortDescription,
          description: finalDescription,
          categories: normalized.categories,
          category: normalized.categories[0] || undefined,
          imageUrl: normalized.imageUrl,
          openaiApiKeyOverride: normalized.openaiApiKeyOverride,
          welcomeMessage: normalized.welcomeMessage,
          knowledgeDescription: normalized.knowledgeDescription,
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          faqs: normalized.faqs,
          personality: normalized.personality,
          config: normalized.config,
          type: "showcase",
          status: "published",
          isPublic: normalized.isPublic,
          createdAt: new Date(),
        });
        return NextResponse.json({ ok: true, botId: String(created._id), slug: created.slug });
      } catch (error) {
        const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
        if (!(mongoError.code === 11000 && mongoError.keyPattern?.slug)) {
          throw error;
        }
      }
    }
    return NextResponse.json({ error: "Failed to allocate unique slug." }, { status: 500 });
  } catch (error) {
    console.error("Finalize draft bot failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
