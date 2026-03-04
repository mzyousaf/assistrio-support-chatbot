import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";

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

    const bot = await Bot.findById(id).select("_id").lean();
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const documents = await DocumentModel.find({ botId: bot._id })
      .sort({ createdAt: -1 })
      .select({
        title: 1,
        sourceType: 1,
        fileName: 1,
        fileType: 1,
        fileSize: 1,
        url: 1,
        text: 1,
        createdAt: 1,
      })
      .lean();

    return NextResponse.json({
      ok: true,
      documents: documents.map((doc) => ({
        _id: String(doc._id),
        title: String(doc.title ?? ""),
        sourceType: String(doc.sourceType ?? ""),
        fileName: doc.fileName || undefined,
        fileType: doc.fileType || undefined,
        fileSize: doc.fileSize || undefined,
        url: doc.url || undefined,
        hasText: typeof doc.text === "string" && doc.text.trim().length > 0,
        textLength: typeof doc.text === "string" ? doc.text.length : 0,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      })),
    });
  } catch (error) {
    console.error("List documents failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
