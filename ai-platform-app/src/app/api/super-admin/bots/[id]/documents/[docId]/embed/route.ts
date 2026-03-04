import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";
import IngestJob from "@/models/IngestJob";

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

    document.status = "queued";
    document.error = undefined;
    await document.save();

    const job = await IngestJob.create({
      botId: bot._id,
      docId: document._id,
      status: "queued",
    });

    return NextResponse.json({
      ok: true,
      docId: document._id.toString(),
      jobId: job._id.toString(),
      status: "queued",
    });
  } catch (error) {
    console.error("Embed document failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
