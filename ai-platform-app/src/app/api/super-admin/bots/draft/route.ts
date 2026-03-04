import { NextRequest, NextResponse } from "next/server";

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
    };

    const clientDraftId = String(body.clientDraftId ?? "").trim();
    if (!clientDraftId) {
      return NextResponse.json({ error: "clientDraftId is required" }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await Bot.findOne({
      clientDraftId,
      status: "draft",
      type: "showcase",
    })
      .select("_id slug")
      .lean();
    if (existing) {
      return NextResponse.json({ ok: true, botId: String(existing._id), slug: existing.slug });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = await generateUniqueBotSlug("new-bot");
      try {
        const created = await Bot.create({
          name: "New bot",
          slug,
          shortDescription: "",
          description: "",
          categories: [],
          category: undefined,
          imageUrl: "",
          openaiApiKeyOverride: undefined,
          welcomeMessage: "",
          knowledgeDescription: "",
          leadCapture: {
            enabled: false,
            fields: [
              { key: "name", label: "Full name", type: "text", required: true },
              { key: "email", label: "Email", type: "email", required: true },
              { key: "phone", label: "Phone", type: "phone", required: true },
            ],
          },
          chatUI: {
            primaryColor: "#14B8A6",
            backgroundStyle: "light",
            bubbleStyle: "rounded",
            avatarStyle: "emoji",
            launcherPosition: "bottom-right",
            font: "inter",
            showBranding: true,
          },
          faqs: [],
          personality: {
            language: "en-US",
          },
          config: {
            temperature: 0.3,
            responseLength: "medium",
            maxTokens: 512,
          },
          type: "showcase",
          status: "draft",
          clientDraftId,
          isPublic: true,
          createdAt: new Date(),
        });

        return NextResponse.json({ ok: true, botId: String(created._id), slug: created.slug });
      } catch (error) {
        const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
        if (mongoError.code === 11000 && mongoError.keyPattern?.clientDraftId) {
          const duplicateDraft = await Bot.findOne({
            clientDraftId,
            status: "draft",
            type: "showcase",
          })
            .select("_id slug")
            .lean();
          if (duplicateDraft) {
            return NextResponse.json({
              ok: true,
              botId: String(duplicateDraft._id),
              slug: duplicateDraft.slug,
            });
          }
        }
        if (!(mongoError.code === 11000 && mongoError.keyPattern?.slug)) {
          throw error;
        }
      }
    }
    return NextResponse.json({ error: "Failed to allocate unique slug." }, { status: 500 });
  } catch (error) {
    console.error("Create draft bot failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
