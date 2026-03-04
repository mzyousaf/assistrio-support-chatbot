import { mkdir, writeFile } from "fs/promises";
import path from "path";

import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { chunkText, embedAndStoreChunks, extractTextFromUpload, getFileExtension } from "@/lib/kb";
import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["txt", "pdf", "docx", "doc"]);
function isMimeAllowedForExtension(extension: string, mimeType: string): boolean {
  const allowedByExtension: Record<string, Set<string>> = {
    txt: new Set(["text/plain"]),
    pdf: new Set(["application/pdf"]),
    doc: new Set(["application/msword"]),
    docx: new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ]),
  };

  if (!mimeType) return false;
  return allowedByExtension[extension]?.has(mimeType) ?? false;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const id = params.id;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectToDatabase();

    const bot = await Bot.findById(id).select("_id").lean();
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const titleFromForm = formData.get("title");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const extension = getFileExtension(file.name);
    const mimeType = file.type;

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    if (!isMimeAllowedForExtension(extension, mimeType)) {
      return NextResponse.json({ error: "Invalid MIME type for file extension" }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File exceeds 15MB limit" }, { status: 400 });
    }

    const title =
      typeof titleFromForm === "string" && titleFromForm.trim().length > 0
        ? titleFromForm.trim()
        : file.name;

    const safeBase = path
      .basename(file.name, path.extname(file.name))
      .toLowerCase()
      .replace(/[^a-z0-9-_.]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
    const randomSuffix = Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, "");
    const storedName = `${Date.now()}-${randomSuffix}-${safeBase || "file"}.${extension}`.replace(
      /[^a-z0-9-_.]/g,
      "-",
    );
    const kbDirectory = path.join(process.cwd(), "public", "kb");
    const filePath = path.join(kbDirectory, storedName);
    const publicUrl = `/kb/${storedName}`;

    await mkdir(kbDirectory, { recursive: true });
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);

    const document = await DocumentModel.create({
      botId: bot._id,
      title,
      sourceType: "upload",
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      url: publicUrl,
      text: "",
    });

    let extracted = false;
    let embedded = false;
    let chunkCount = 0;
    let reason: string | undefined;

    try {
      const extractionResult = await extractTextFromUpload({
        filePath,
        fileName: file.name,
        fileType: file.type,
      });

      extracted = extractionResult.extracted;
      reason = extractionResult.reason;

      if (extractionResult.extracted) {
        await DocumentModel.updateOne(
          { _id: document._id, botId: bot._id },
          { $set: { text: extractionResult.text } },
        );

        const chunks = chunkText(extractionResult.text);
        const embeddingResult = await embedAndStoreChunks({
          botId: String(bot._id),
          documentId: String(document._id),
          chunks,
        });
        embedded = embeddingResult.embedded;
        chunkCount = embeddingResult.chunkCount;
        reason = embeddingResult.reason || reason;
      }
    } catch (ingestError) {
      console.error("Inline document ingestion failed", ingestError);
      if (!reason) reason = "ingestion_failed";
    }

    return NextResponse.json({
      ok: true,
      documentId: document._id.toString(),
      url: publicUrl,
      extracted,
      embedded,
      chunkCount,
      reason,
    });
  } catch (error) {
    console.error("Upload doc failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
