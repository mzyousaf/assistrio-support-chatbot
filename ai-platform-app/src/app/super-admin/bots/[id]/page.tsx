import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import CreateNewBotButton from "@/components/admin/CreateNewBotButton";
import EditBotFormClient from "@/components/admin/EditBotFormClient";
import { Card } from "@/components/ui/Card";
import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";

type EditBotPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SuperAdminEditBotPage({ params }: EditBotPageProps) {
  const { id: botId } = await params;

  const admin = await getAuthenticatedSuperAdmin();
  if (!admin) {
    redirect("/super-admin/login");
  }

  await connectToDatabase();

  const bot = await Bot.findById(botId)
    .select({
      name: 1,
      shortDescription: 1,
      description: 1,
      category: 1,
      categories: 1,
      imageUrl: 1,
      openaiApiKeyOverride: 1,
      welcomeMessage: 1,
      knowledgeDescription: 1,
      status: 1,
      isPublic: 1,
      leadCapture: 1,
      chatUI: 1,
      faqs: 1,
      personality: 1,
      config: 1,
      type: 1,
    })
    .lean();

  const documents = await DocumentModel.find({ botId })
    .sort({ createdAt: -1 })
    .select({
      title: 1,
      sourceType: 1,
      fileName: 1,
      fileType: 1,
      fileSize: 1,
      url: 1,
      text: 1,
      status: 1,
      error: 1,
      ingestedAt: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean();

  const docsQueued = documents.filter((doc) => doc.status === "queued").length;
  const docsProcessing = documents.filter((doc) => doc.status === "processing").length;
  const docsReady = documents.filter((doc) => doc.status === "ready").length;
  const docsFailed = documents.filter((doc) => doc.status === "failed").length;
  const lastReadyDoc = documents.find((doc) => doc.status === "ready");
  const lastFailedDoc = documents.find((doc) => doc.status === "failed");
  const lastFailedUpdatedAt = lastFailedDoc?.updatedAt || lastFailedDoc?.createdAt;

  if (!bot) {
    return (
      <AdminShell title="Edit Bot">
        <p className="text-gray-700 dark:text-gray-300">Bot not found.</p>
      </AdminShell>
    );
  }

  if (bot.type !== "showcase") {
    return (
      <AdminShell title="Edit Bot">
        <Card>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Editing is only available for showcase bots.
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Type: {bot.type}</p>
          <Link
            className="mt-4 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium bg-brand-500 hover:bg-brand-400 text-white transition-colors"
            href="/super-admin/bots"
          >
            Back to bots
          </Link>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Edit Bot">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Showcase Bot</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Update bot details, behavior, and visibility settings.
          </p>
        </div>
        <CreateNewBotButton
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          label="Create new bot"
        />
      </section>

      <Card title="Bot basics + FAQ">
        <EditBotFormClient
          initialBot={{
            id: String(bot._id),
            name: bot.name,
            shortDescription: bot.shortDescription || undefined,
            description: bot.description || undefined,
            category: bot.category || undefined,
            categories: bot.categories || [],
            imageUrl: bot.imageUrl || undefined,
            openaiApiKeyOverride: bot.openaiApiKeyOverride || undefined,
            welcomeMessage: bot.welcomeMessage || undefined,
            knowledgeDescription: bot.knowledgeDescription || undefined,
            status: bot.status === "published" ? "published" : "draft",
            faqs:
              Array.isArray(bot.faqs)
                ? bot.faqs.map((faq) => ({
                    question: String(faq?.question ?? ""),
                    answer: String(faq?.answer ?? ""),
                  }))
                : [],
            documents: documents.map((doc) => ({
              _id: String(doc._id),
              title: String(doc.title ?? ""),
              sourceType: String(doc.sourceType ?? ""),
              fileName: doc.fileName || undefined,
              fileType: doc.fileType || undefined,
              fileSize: doc.fileSize || undefined,
              url: doc.url || undefined,
              status: doc.status || undefined,
              error: doc.error || undefined,
              ingestedAt: doc.ingestedAt ? new Date(doc.ingestedAt).toISOString() : undefined,
              hasText: typeof doc.text === "string" && doc.text.trim().length > 0,
              textLength: typeof doc.text === "string" ? doc.text.length : 0,
              createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
            })),
            health: {
              docsTotal: documents.length,
              docsQueued,
              docsProcessing,
              docsReady,
              docsFailed,
              lastIngestedAt:
                lastReadyDoc?.ingestedAt || lastReadyDoc?.createdAt
                  ? new Date(lastReadyDoc?.ingestedAt || lastReadyDoc?.createdAt || Date.now()).toISOString()
                  : undefined,
              lastFailedDoc: lastFailedDoc
                ? {
                    docId: String(lastFailedDoc._id),
                    title: String(lastFailedDoc.title ?? ""),
                    error: lastFailedDoc.error || undefined,
                    updatedAt: lastFailedUpdatedAt ? new Date(lastFailedUpdatedAt).toISOString() : undefined,
                  }
                : undefined,
            },
            isPublic: Boolean(bot.isPublic),
            leadCapture: bot.leadCapture || undefined,
            chatUI: bot.chatUI || undefined,
            personality: bot.personality || {},
            config: bot.config || {},
          }}
        />
      </Card>
    </AdminShell>
  );
}
