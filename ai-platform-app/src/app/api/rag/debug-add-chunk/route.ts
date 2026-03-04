import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectToDatabase } from "@/lib/mongoose";
import { embedText } from "@/lib/rag";
import { Chunk } from "@/models/Chunk";

const debugAddChunkSchema = z.object({
  botId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Invalid botId",
  }),
  documentId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Invalid documentId",
  }),
  text: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = debugAddChunkSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { botId, documentId, text } = parsed.data;

    await connectToDatabase();

    const embedding = await embedText(text);

    const chunk = await Chunk.create({
      botId: new mongoose.Types.ObjectId(botId),
      documentId: new mongoose.Types.ObjectId(documentId),
      text,
      embedding,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      chunkId: chunk._id.toString(),
      embeddingLength: embedding.length,
    });
  } catch (error) {
    console.error("Debug add chunk failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
