"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { BotEditorPane } from "@/components/admin/BotEditorPane";
import EditBotFormClient from "@/components/admin/EditBotFormClient";
import type { BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import { EditBotWorkspaceLayout } from "@/components/admin/EditBotWorkspaceLayout";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/hooks/useUser";
import type { BotChatUI, BotLeadCaptureV2 } from "@/models/Bot";

const EDIT_BOT_FORM_ID = "edit-bot-form";

type DocRow = {
  _id: string;
  title?: string;
  sourceType?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  status?: string;
  error?: string;
  ingestedAt?: string;
  hasText?: boolean;
  textLength?: number;
  createdAt?: string;
};

type Health = {
  docsTotal?: number;
  docsQueued?: number;
  docsProcessing?: number;
  docsReady?: number;
  docsFailed?: number;
  lastIngestedAt?: string;
  lastFailedDoc?: { docId?: string; title?: string; error?: string; updatedAt?: string };
};

export default function UserEditBotPage() {
  const params = useParams();
  const botId = typeof params?.id === "string" ? params.id : "";
  const { user, loading: authLoading } = useUser();
  const [state, setState] = useState<"loading" | "not-found" | "not-showcase" | "ready">("loading");
  const [bot, setBot] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Health | undefined>(undefined);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [botType, setBotType] = useState<string>("");
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [livePreview, setLivePreview] = useState<{
    name: string;
    imageUrl?: string;
    chatUI?: BotChatUI;
    tagline?: string;
    description?: string;
    welcomeMessage?: string;
    suggestedQuestions?: string[];
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !botId) return;
    let cancelled = false;
    Promise.all([
      apiFetch(`/api/user/bots/${botId}`),
      apiFetch(`/api/user/bots/${botId}/documents`),
    ])
      .then(async ([botRes, docsRes]) => {
        if (cancelled) return;
        if (!botRes.ok) {
          setState("not-found");
          return;
        }
        const botData = (await botRes.json()) as {
          ok?: boolean;
          bot?: Record<string, unknown> & { slug?: string };
          health?: Health;
        };
        const b = botData?.bot;
        if (!b) {
          setState("not-found");
          return;
        }
        const type = (b.type as string) ?? "";
        if (type !== "showcase") {
          setBotType(type);
          setState("not-showcase");
          return;
        }
        setBot(b);
        setHealth(botData?.health);

        let docs: DocRow[] = [];
        if (docsRes.ok) {
          const docsJson = (await docsRes.json()) as { documents?: DocRow[] };
          docs = docsJson?.documents ?? [];
        }
        setDocuments(docs);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [user, botId]);

  useEffect(() => {
    if (state !== "ready" || !bot) return;
    const name = String(bot.name ?? "Bot");
    const imageUrl = typeof bot.imageUrl === "string" ? bot.imageUrl : undefined;
    const chatUI = (bot.chatUI as BotChatUI | undefined) ?? undefined;
    const tagline = [bot.tagline, bot.shortDescription].find((v) => typeof v === "string" && v.trim()) as
      | string
      | undefined;
    const description = typeof bot.description === "string" ? bot.description : undefined;
    const welcomeMessage =
      typeof bot.welcomeMessage === "string" && bot.welcomeMessage.trim() ? bot.welcomeMessage.trim() : undefined;
    const exampleQuestions = Array.isArray(bot.exampleQuestions)
      ? (bot.exampleQuestions as string[]).map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, 6)
      : [];
    setLivePreview({
      name,
      imageUrl,
      chatUI,
      tagline,
      description,
      welcomeMessage,
      suggestedQuestions: exampleQuestions.length > 0 ? exampleQuestions : undefined,
    });
  }, [state, bot]);

  if (authLoading || !user) {
    return (
      <AdminShell title="Edit Bot">
        <p className="text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  if (state === "not-found") {
    return (
      <AdminShell title="Edit Bot">
        <p className="text-gray-700 dark:text-gray-300">Bot not found.</p>
      </AdminShell>
    );
  }

  if (state === "not-showcase") {
    return (
      <AdminShell title="Edit Bot">
        <Card>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Editing is only available for showcase bots.
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Type: {botType}</p>
          <Link
            className="mt-4 inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-400"
            href="/user/bots"
          >
            Back to bots
          </Link>
        </Card>
      </AdminShell>
    );
  }

  if (state !== "ready" || !bot) {
    return (
      <AdminShell title="Edit Bot">
        <p className="text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  const docsMapped: BotDocumentItem[] = documents.map((doc) => {
    const s = doc.status;
    const status: BotDocumentItem["status"] =
      s === "queued" || s === "processing" || s === "ready" || s === "failed" ? s : undefined;
    return {
      _id: String(doc._id),
      title: String(doc.title ?? ""),
      sourceType: String(doc.sourceType ?? ""),
      fileName: doc.fileName ?? undefined,
      fileType: doc.fileType ?? undefined,
      fileSize: doc.fileSize,
      url: doc.url ?? undefined,
      status,
      error: doc.error ?? undefined,
      ingestedAt: doc.ingestedAt ?? undefined,
      hasText: Boolean(doc.hasText),
      textLength: Number(doc.textLength) || 0,
      createdAt: doc.createdAt ?? undefined,
    };
  });

  const botName = String(bot.name ?? "Bot");
  const botImageUrl = typeof bot.imageUrl === "string" ? bot.imageUrl : undefined;
  const status: "draft" | "published" = (bot.status as string) === "published" ? "published" : "draft";

  const initialBot = {
    id: String(bot.id ?? bot._id),
    name: botName,
    shortDescription: (bot.shortDescription as string) || undefined,
    description: (bot.description as string) || undefined,
    category: (bot.category as string) || undefined,
    categories: (Array.isArray(bot.categories) ? bot.categories : []) as string[],
    imageUrl: botImageUrl,
    openaiApiKeyOverride: (bot.openaiApiKeyOverride as string) || undefined,
    whisperApiKeyOverride: (bot.whisperApiKeyOverride as string) || undefined,
    welcomeMessage: (bot.welcomeMessage as string) || undefined,
    knowledgeDescription: (bot.knowledgeDescription as string) || undefined,
    status,
    faqs: (Array.isArray(bot.faqs)
      ? (bot.faqs as Array<{ question?: unknown; answer?: unknown }>).map((faq) => ({
          question: String(faq?.question ?? ""),
          answer: String(faq?.answer ?? ""),
        }))
      : []) as { question: string; answer: string }[],
    exampleQuestions: Array.isArray(bot.exampleQuestions)
      ? (bot.exampleQuestions as string[]).map((q) => String(q ?? "").trim()).filter(Boolean)
      : [],
    documents: docsMapped,
    health: health
      ? {
          docsTotal: health.docsTotal ?? 0,
          docsQueued: health.docsQueued ?? 0,
          docsProcessing: health.docsProcessing ?? 0,
          docsReady: health.docsReady ?? 0,
          docsFailed: health.docsFailed ?? 0,
          lastIngestedAt: health.lastIngestedAt,
          lastFailedDoc: health.lastFailedDoc
            ? {
                docId: health.lastFailedDoc.docId ?? "",
                title: health.lastFailedDoc.title ?? "",
                error: health.lastFailedDoc.error,
                updatedAt: health.lastFailedDoc.updatedAt,
              }
            : undefined,
        }
      : {
          docsTotal: documents.length,
          docsQueued: 0,
          docsProcessing: 0,
          docsReady: 0,
          docsFailed: 0,
          lastIngestedAt: undefined,
          lastFailedDoc: undefined,
        },
    isPublic: Boolean(bot.isPublic),
    visibility:
      bot.visibility === "private" || bot.visibility === "public"
        ? (bot.visibility as "public" | "private")
        : "public",
    accessKey: typeof bot.accessKey === "string" ? bot.accessKey : "",
    secretKey: typeof bot.secretKey === "string" ? bot.secretKey : "",
    creatorType: (bot.creatorType === "visitor" ? "visitor" : "user") as "user" | "visitor",
    ownerVisitorId: typeof bot.ownerVisitorId === "string" ? bot.ownerVisitorId : undefined,
    messageLimitMode: (bot.messageLimitMode === "fixed_total" ? "fixed_total" : "none") as "none" | "fixed_total",
    messageLimitTotal: typeof bot.messageLimitTotal === "number" ? bot.messageLimitTotal : null,
    messageLimitUpgradeMessage:
      typeof bot.messageLimitUpgradeMessage === "string" ? bot.messageLimitUpgradeMessage : null,
    includeNameInKnowledge: Boolean((bot as { includeNameInKnowledge?: boolean }).includeNameInKnowledge),
    includeTaglineInKnowledge: Boolean((bot as { includeTaglineInKnowledge?: boolean }).includeTaglineInKnowledge),
    leadCapture: (bot.leadCapture as BotLeadCaptureV2 | undefined) ?? undefined,
    chatUI: (bot.chatUI as BotChatUI | undefined) ?? undefined,
    personality: (bot.personality as object) ?? {},
    config: (bot.config as object) ?? {},
  };

  const previewHref: string | undefined = undefined;

  return (
    <AdminShell title="Edit Bot" fullWidth>
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-950">
        <EditBotWorkspaceLayout
          botId={botId}
          botName={botName}
          botAvatarUrl={botImageUrl}
          accessKey={typeof bot.accessKey === "string" ? bot.accessKey : undefined}
          secretKey={typeof bot.secretKey === "string" ? bot.secretKey : undefined}
          ownerVisitorId={typeof bot.ownerVisitorId === "string" ? bot.ownerVisitorId : undefined}
          livePreview={livePreview}
          defaultChatOpen={state === "ready" ? (bot?.chatUI as BotChatUI | undefined)?.openChatOnLoad !== false : true}
          expandHref={previewHref}
        >
          <BotEditorPane
            botName={botName}
            status={status}
            unsaved={unsaved}
            saving={saving}
            formId={EDIT_BOT_FORM_ID}
            previewHref={previewHref}
            saveMessage={saveMessage}
          >
            <EditBotFormClient
              formId={EDIT_BOT_FORM_ID}
              onDirtyChange={setUnsaved}
              onSavingChange={setSaving}
              onSaveSuccess={() => {
                setSaveMessage("Saved.");
                window.setTimeout(() => setSaveMessage(null), 4000);
              }}
              onLivePreviewChange={setLivePreview}
              initialBot={initialBot}
            />
          </BotEditorPane>
        </EditBotWorkspaceLayout>
      </div>
    </AdminShell>
  );
}
