"use client";

import BotDocumentsManager from "@/components/admin/BotDocumentsManager";
import BotFaqsEditor from "@/components/admin/BotFaqsEditor";
import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsFieldRow,
} from "@/components/admin/settings";
import { Switch } from "@/components/ui/Switch";
import Tooltip from "@/components/ui/Tooltip";
import { Pencil, RefreshCw } from "lucide-react";

import { parseKnowledgeSubsectionFromSlug } from "@/lib/knowledge-subsection";

import { useBotFormEditor } from "./BotFormEditorContext";
import { KNOWLEDGE_SUBSECTION_META, TAB_CONTENT_CLASS } from "./botFormUiConstants";

export function KnowledgeSection() {
  const {
    noteSyncStatus,
    includeNotesInKnowledge,
    setIncludeNotesInKnowledge,
    kbEmbeddingSnapshot,
    botId,
    onRetryNote,
    setRefreshNotesConfirmOpen,
    openKnowledgeNotesSheet,
    knowledgeDescription,
    submitting,
    faqs,
    setFaqs,
    faqAutoRefreshToken,
    initialBot,
    health,
    onSavingChange,
    knowledgePollTick,
    handleKnowledgePollResult,
    onRetryFaq,
    workspaceSectionSlug,
  } = useBotFormEditor();

  const subsection = parseKnowledgeSubsectionFromSlug(workspaceSectionSlug ?? "");
  const meta = KNOWLEDGE_SUBSECTION_META[subsection];

  return (
    <div className={TAB_CONTENT_CLASS}>
      <SettingsPageHeader title={meta.title} description={meta.description} />

      {subsection === "notes" ? (
        <SettingsSectionCard
          title={
            <div className="flex flex-wrap items-center gap-2">
              <span>Knowledge notes</span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  noteSyncStatus === "processing"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse"
                    : noteSyncStatus === "failed"
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                }`}
              >
                {noteSyncStatus === "processing"
                  ? "Processing"
                  : noteSyncStatus === "failed"
                    ? "Failed"
                    : "Ready"}
              </span>
              <Tooltip
                content={
                  includeNotesInKnowledge
                    ? "These notes are used by the assistant when replying."
                    : "These notes are saved, but the assistant ignores them in replies."
                }
              >
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    includeNotesInKnowledge
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {includeNotesInKnowledge ? "Included" : "Excluded"}
                </span>
              </Tooltip>
            </div>
          }
          description={
            kbEmbeddingSnapshot != null
              ? `Internal notes for admins describing the scope of the bot's knowledge. (${kbEmbeddingSnapshot.noteContentLength} chars in KB)`
              : "Internal notes for admins describing the scope of the bot's knowledge."
          }
          headerAction={
            <div className="flex items-center gap-0">
              <Tooltip content="Turn this on to let the assistant use these notes when replying. Turn it off to ignore these notes in replies.">
                <span className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md">
                  <Switch
                    checked={includeNotesInKnowledge}
                    onCheckedChange={(checked) => setIncludeNotesInKnowledge(checked)}
                    aria-label="Include notes in knowledge base"
                    className="scale-90"
                    disabled={noteSyncStatus === "processing" || submitting}
                  />
                </span>
              </Tooltip>
              {botId && onRetryNote ? (
                <Tooltip content="Refresh these notes so the assistant uses the latest version.">
                  <button
                    type="button"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent transition outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                      noteSyncStatus === "processing"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 cursor-not-allowed animate-pulse"
                        : noteSyncStatus === "failed"
                          ? "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30"
                          : noteSyncStatus === "ready"
                            ? "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    }`}
                    onClick={() => setRefreshNotesConfirmOpen(true)}
                    disabled={noteSyncStatus === "processing"}
                    aria-label="Refresh notes in knowledge base"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${noteSyncStatus === "processing" ? "animate-spin" : ""}`}
                      aria-hidden
                    />
                  </button>
                </Tooltip>
              ) : null}
              <Tooltip content="Edit internal notes">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-transparent text-brand-600 outline-none ring-0 transition hover:bg-brand-100 focus:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-900/25 dark:hover:text-brand-300"
                  onClick={openKnowledgeNotesSheet}
                  aria-label="Edit internal notes"
                  disabled={noteSyncStatus === "processing" || submitting}
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
            </div>
          }
        >
          <SettingsFieldRow
            label="Internal notes"
            htmlFor="knowledge-description-preview"
            helperText="Not shown to users. Describe what knowledge you've added so other admins can understand scope."
          >
            <div className="space-y-2">
              {noteSyncStatus === "processing" || submitting ? (
                <div
                  className="min-h-[5rem] w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200"
                  aria-readonly
                >
                  <p className="whitespace-pre-wrap break-words">
                    {(knowledgeDescription || "").trim() ? knowledgeDescription : "—"}
                  </p>
                </div>
              ) : (
                <div
                  id="knowledge-description-preview"
                  className="min-h-[5rem] max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                >
                  {(knowledgeDescription || "").trim() ? (
                    <p className="whitespace-pre-wrap break-words">{knowledgeDescription}</p>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500">No internal notes yet.</p>
                  )}
                </div>
              )}
            </div>
          </SettingsFieldRow>
        </SettingsSectionCard>
      ) : null}

      {subsection === "faqs" ? (
        <SettingsSectionCard title="FAQ entries" description="Curated questions and answers used by the bot.">
          <div className="space-y-3">
            <BotFaqsEditor
              value={faqs}
              onChange={setFaqs}
              botId={botId}
              onRetryFaq={onRetryFaq}
              autoRefreshFaqsToken={faqAutoRefreshToken}
              kbEmbeddingSnapshot={kbEmbeddingSnapshot}
            />
          </div>
        </SettingsSectionCard>
      ) : null}

      {subsection === "documents" ? (
        <>
          {initialBot?.id ? (
            <BotDocumentsManager
              botId={initialBot.id}
              documents={initialBot.documents ?? []}
              health={
                health
                  ? {
                      lastIngestedAt: health.lastIngestedAt,
                      lastFailedDoc: health.lastFailedDoc,
                    }
                  : undefined
              }
              onUploadingChange={onSavingChange}
              pollTick={knowledgePollTick}
              onKnowledgePollResult={handleKnowledgePollResult}
            />
          ) : (
            <SettingsSectionCard title="Documents" description="Upload and manage source documents used by the bot.">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                Save the bot first to upload documents.
              </div>
            </SettingsSectionCard>
          )}
        </>
      ) : null}
    </div>
  );
}
