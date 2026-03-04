import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongoose";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const visitorId = request.nextUrl.searchParams.get("visitorId");

    if (!mongoose.isValidObjectId(id) || !visitorId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await connectToDatabase();

    const bot = await Bot.findById(id).select("_id ownerVisitorId type").lean();
    if (!bot || bot.type !== "visitor-own") {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (String(bot.ownerVisitorId || "") !== visitorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await DocumentModel.find({ botId: bot._id })
      .sort({ createdAt: -1 })
      .select({
        fileName: 1,
        status: 1,
        error: 1,
        ingestedAt: 1,
      })
      .lean();

    return NextResponse.json({
      ok: true,
      documents: documents.map((doc) => ({
        docId: String(doc._id),
        fileName: doc.fileName || undefined,
        status: doc.status || "queued",
        error: doc.error || undefined,
        ingestedAt: doc.ingestedAt ? new Date(doc.ingestedAt).toISOString() : undefined,
      })),
    });
  } catch (error) {
    console.error("Trial list documents failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
