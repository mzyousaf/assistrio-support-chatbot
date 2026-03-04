import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { Chunk } from "@/models/Chunk";
import { DocumentModel } from "@/models/Document";

type RouteContext = {
  params: Promise<{ id: string; docId: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await context.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(docId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const bot = await Bot.findById(id).select("_id").lean();
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const existing = await DocumentModel.findOne({
      _id: docId,
      botId: bot._id,
    })
      .select("_id")
      .lean();

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await DocumentModel.deleteOne({ _id: docId, botId: bot._id });
    await Chunk.deleteMany({ documentId: docId, botId: bot._id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete document failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
