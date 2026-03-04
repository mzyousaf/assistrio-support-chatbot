import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongoose";
import { Bot } from "@/models/Bot";

type PublicBotRow = {
  _id: { toString(): string };
  name: string;
  slug: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  exampleQuestions?: string[];
  createdAt?: Date | string;
};

export async function GET() {
  try {
    await connectToDatabase();

    const botDocuments = await Bot.find({
      type: "showcase",
      isPublic: true,
    })
      .sort({ createdAt: -1 })
      .select(
        "_id name slug shortDescription category avatarEmoji imageUrl exampleQuestions createdAt",
      )
      .lean<PublicBotRow[]>();

    const bots = botDocuments.map((bot) => ({
      id: bot._id.toString(),
      name: bot.name,
      slug: bot.slug,
      shortDescription: bot.shortDescription,
      category: bot.category,
      avatarEmoji: bot.avatarEmoji,
      imageUrl: bot.imageUrl,
      exampleQuestions: Array.isArray(bot.exampleQuestions)
        ? bot.exampleQuestions.map((question) => String(question || "").trim()).filter(Boolean)
        : [],
      createdAt:
        bot.createdAt instanceof Date
          ? bot.createdAt.toISOString()
          : String(bot.createdAt),
    }));

    return NextResponse.json(bots);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch bots" }, { status: 500 });
  }
}
