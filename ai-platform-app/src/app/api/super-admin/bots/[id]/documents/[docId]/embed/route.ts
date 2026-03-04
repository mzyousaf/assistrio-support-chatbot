import path from "path";

import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { chunkText, embedAndStoreChunks, extractTextFromUpload } from "@/lib/kb";
import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";

type RouteContext = {
  params: Promise<{ id: string; docId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
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

    const document = await DocumentModel.findOne({
      _id: docId,
      botId: bot._id,
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let text = String(document.text || "");
    let extracted = Boolean(text.trim());
    let reason: string | undefined;

    if (!extracted && document.url) {
      const relativePath = String(document.url).replace(/^\/+/, "");
      const filePath = path.join(process.cwd(), "public", relativePath);
      const extractionResult = await extractTextFromUpload({
        filePath,
        fileName: document.fileName || path.basename(relativePath),
        fileType: document.fileType || undefined,
      });
      extracted = extractionResult.extracted;
      reason = extractionResult.reason;
      if (extractionResult.extracted) {
        text = extractionResult.text;
        document.text = extractionResult.text;
        await document.save();
      }
    }

    if (!text.trim()) {
      return NextResponse.json({
        ok: true,
        extracted,
        embedded: false,
        chunkCount: 0,
        reason: reason || "empty",
      });
    }

    const chunks = chunkText(text);
    const embeddingResult = await embedAndStoreChunks({
      botId: String(bot._id),
      documentId: String(document._id),
      chunks,
    });

    return NextResponse.json({
      ok: true,
      extracted,
      embedded: embeddingResult.embedded,
      chunkCount: embeddingResult.chunkCount,
      reason: embeddingResult.reason || reason,
    });
  } catch (error) {
    console.error("Embed document failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
