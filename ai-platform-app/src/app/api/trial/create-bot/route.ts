import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logVisitorEvent } from "@/lib/analytics";
import { getFileExtension } from "@/lib/kb";
import { connectToDatabase } from "@/lib/mongoose";
import { getOrCreateVisitor, updateVisitorProfile } from "@/lib/visitors";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";
import IngestJob from "@/models/IngestJob";

const createTrialBotSchema = z.object({
  botName: z.string().trim().min(1),
  email: z.string().trim().email(),
  description: z.string().trim().optional(),
  visitorId: z.string().trim().min(1),
  faqs: z.string().optional(),
});

function toSlug(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "trial-bot";
}

async function generateUniqueSlug(botName: string): Promise<string> {
  const baseSlug = toSlug(botName);

  let candidate = baseSlug;
  let attempt = 0;

  while (attempt < 5) {
    const existing = await Bot.findOne({ slug: candidate }).select("_id");
    if (!existing) {
      return candidate;
    }

    const suffix = Math.random().toString(36).slice(2, 8);
    candidate = `${baseSlug}-${suffix}`;
    attempt += 1;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let parsed = createTrialBotSchema.safeParse({});
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      parsed = createTrialBotSchema.safeParse({
        botName: formData.get("botName"),
        email: formData.get("email"),
        description: formData.get("description"),
        visitorId: formData.get("visitorId"),
        faqs: formData.get("faqs"),
      });
      files = formData
        .getAll("files")
        .filter((file): file is File => file instanceof File && file.size > 0);
    } else {
      const json = (await request.json()) as unknown;
      parsed = createTrialBotSchema.safeParse(json);
    }

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { botName, email, description, visitorId, faqs } = parsed.data;

    await connectToDatabase();

    await getOrCreateVisitor(visitorId);
    await updateVisitorProfile(visitorId, { email });

    let parsedFaqs: Array<{ question: string; answer: string }> = [];
    if (typeof faqs === "string" && faqs.trim()) {
      try {
        const arr = JSON.parse(faqs);
        if (Array.isArray(arr)) {
          parsedFaqs = arr
            .filter(
              (it) =>
                it &&
                typeof it === "object" &&
                typeof (it as { question?: unknown }).question === "string" &&
                typeof (it as { answer?: unknown }).answer === "string",
            )
            .map((it) => ({
              question: (it as { question: string }).question.trim(),
              answer: (it as { answer: string }).answer.trim(),
            }))
            .filter((it) => it.question && it.answer);
        }
      } catch (err) {
        console.error("Failed to parse faqs JSON", err);
      }
    }

    const slug = await generateUniqueSlug(botName);
    const now = new Date();

    const bot = await Bot.create({
      name: botName,
      slug,
      type: "visitor-own",
      ownerVisitorId: visitorId,
      isPublic: false,
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : undefined,
      faqs: parsedFaqs,
      createdAt: now,
    });

    await logVisitorEvent({
      visitorId,
      type: "trial_bot_created",
      botSlug: slug,
      botId: bot._id.toString(),
      metadata: {
        email,
        botName,
      },
    });

    const docs: Array<{ docId: string; fileName: string; status: "queued" }> = [];
    const kbDirectory = path.join(process.cwd(), "public", "kb");

    for (const file of files) {
      const extension = getFileExtension(file.name);
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
      const filePath = path.join(kbDirectory, storedName);
      const publicUrl = `/kb/${storedName}`;

      await mkdir(kbDirectory, { recursive: true });
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, fileBuffer);

      const document = await DocumentModel.create({
        botId: bot._id,
        title: file.name,
        sourceType: "upload",
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        status: "queued",
        url: publicUrl,
      });

      await IngestJob.create({
        botId: bot._id,
        docId: document._id,
        status: "queued",
      });

      docs.push({
        docId: document._id.toString(),
        fileName: file.name,
        status: "queued",
      });
    }

    return NextResponse.json({
      ok: true,
      botId: bot._id.toString(),
      docs,
      slug: bot.slug,
    });
  } catch (error) {
    console.error("Create trial bot failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
