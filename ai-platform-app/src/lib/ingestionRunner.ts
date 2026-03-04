import path from "path";

import { chunkText, embedAndStoreChunks, extractTextFromUpload } from "@/lib/kb";
import { connectToDatabase } from "@/lib/mongoose";
import { Chunk } from "@/models/Chunk";
import { DocumentModel } from "@/models/Document";
import IngestJob from "@/models/IngestJob";

export type IngestionRunResult = {
  ok: true;
  processed: number;
  failed: number;
  results: Array<{ jobId: string; docId: string; status: "done" | "failed"; error?: string }>;
};

export async function runQueuedIngestionJobs(limit = 3): Promise<IngestionRunResult> {
  await connectToDatabase();

  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 3;

  const queuedJobs = await IngestJob.find({ status: "queued" })
    .sort({ createdAt: 1 })
    .limit(normalizedLimit);

  let processed = 0;
  let failed = 0;
  const results: IngestionRunResult["results"] = [];

  for (const queuedJob of queuedJobs) {
    const startedAt = new Date();
    const job = await IngestJob.findOneAndUpdate(
      { _id: queuedJob._id, status: "queued" },
      { $set: { status: "processing", startedAt, error: undefined } },
      { new: true },
    );

    if (!job) {
      continue;
    }

    try {
      const document = await DocumentModel.findOne({ _id: job.docId, botId: job.botId });
      if (!document) {
        throw new Error("document_not_found");
      }

      document.status = "processing";
      document.error = undefined;
      await document.save();

      let textToChunk: string;

      // Manual docs: use stored text as-is; no file read from public path.
      if (document.sourceType === "manual" && document.text?.trim()) {
        textToChunk = document.text.trim();
      } else {
        if (!document.url) {
          throw new Error("file_url_missing");
        }
        const relativePath = String(document.url).replace(/^\/+/, "");
        const filePath = path.join(process.cwd(), "public", relativePath);
        const extractionResult = await extractTextFromUpload({
          filePath,
          fileName: document.fileName || path.basename(relativePath),
          fileType: document.fileType || undefined,
        });

        if (!extractionResult.extracted || !extractionResult.text.trim()) {
          throw new Error(extractionResult.reason || "extraction_failed");
        }

        textToChunk = extractionResult.text;
        document.text = textToChunk;
        await document.save();
      }

      const chunks = chunkText(textToChunk);

      // Explicit cleanup for reprocessing runs.
      await Chunk.deleteMany({ documentId: document._id, botId: document.botId });

      const embeddingResult = await embedAndStoreChunks({
        botId: String(document.botId),
        documentId: String(document._id),
        chunks,
      });

      if (!embeddingResult.embedded || embeddingResult.chunkCount <= 0) {
        throw new Error(embeddingResult.reason || "embedding_failed");
      }

      const finishedAt = new Date();
      document.status = "ready";
      document.ingestedAt = finishedAt;
      document.error = undefined;
      await document.save();

      job.status = "done";
      job.finishedAt = finishedAt;
      job.error = undefined;
      await job.save();

      processed += 1;
      results.push({
        jobId: job._id.toString(),
        docId: document._id.toString(),
        status: "done",
      });
    } catch (jobError) {
      const errorMessage =
        jobError instanceof Error && jobError.message ? jobError.message : "ingestion_failed";

      await DocumentModel.updateOne(
        { _id: job.docId, botId: job.botId },
        { $set: { status: "failed", error: errorMessage } },
      );

      await IngestJob.updateOne(
        { _id: job._id },
        { $set: { status: "failed", error: errorMessage, finishedAt: new Date() } },
      );

      failed += 1;
      results.push({
        jobId: job._id.toString(),
        docId: job.docId.toString(),
        status: "failed",
        error: errorMessage,
      });
    }
  }

  return {
    ok: true,
    processed,
    failed,
    results,
  };
}
