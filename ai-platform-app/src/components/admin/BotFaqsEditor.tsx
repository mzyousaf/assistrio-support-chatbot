"use client";

import React, { useLayoutEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  SettingsActionMenu,
  SettingsCollectionHeader,
  SettingsEmptyCollection,
  SettingsItemCard,
  SettingsItemList,
  SettingsSideSheet,
} from "@/components/admin/settings";
import { SettingsEmbedPreview } from "@/components/admin/settings/SettingsEmbedPreview";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import Tooltip from "@/components/ui/Tooltip";
import type { BotFaq } from "@/models/Bot";

export type { BotFaq };

interface BotFaqsEditorProps {
  value: BotFaq[];
  onChange: (next: BotFaq[]) => void;
  /** When set, show embedding status and retry for failed items. */
  botId?: string;
  onRetryFaq?: (faqIndex: number) => Promise<void>;
  /** When changed, auto-refresh the FAQ knowledge base chunks after a save. */
  autoRefreshFaqsToken?: number;
  /** Latest KB snapshot from the shared knowledge-base poll (FAQ items embedded on server). */
  kbEmbeddingSnapshot?: { faqItemCount: number; noteContentLength: number } | null;
}

function cleanFaqs(raw: BotFaq[]): BotFaq[] {
  return raw
    .map((faq) => ({
      question: faq.question.trim(),
      answer: faq.answer.trim(),
      active: faq.active !== false,
    }))
    .filter((faq) => faq.question && faq.answer);
}

export default function BotFaqsEditor({
  value,
  onChange,
  botId,
  onRetryFaq,
  autoRefreshFaqsToken,
  kbEmbeddingSnapshot,
}: BotFaqsEditorProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<BotFaq>({ question: "", answer: "" });
  const [faqSyncState, setFaqSyncState] = useState<Record<number, "processing" | "failed" | "ready">>({});
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshConfirmIndex, setRefreshConfirmIndex] = useState<number | null>(null);

  const faqs = value ?? [];

  const isAnyFaqProcessing = Object.values(faqSyncState).some((s) => s === "processing");

  useLayoutEffect(() => {
    if (!autoRefreshFaqsToken || autoRefreshFaqsToken === 0) return;
    if (!botId || !onRetryFaq) return;
    if (faqs.length === 0) return;

    // Backend refresh endpoint refreshes all FAQ chunks; we update per-item UI state.
    const indices = faqs.map((_, idx) => idx);
    setFaqSyncState((prev) => {
      const next = { ...prev };
      for (const idx of indices) next[idx] = "processing";
      return next;
    });

    void onRetryFaq(0)
      .then(() => {
        setFaqSyncState((prev) => {
          const next = { ...prev };
          for (const idx of indices) next[idx] = "ready";
          return next;
        });
      })
      .catch(() => {
        setFaqSyncState((prev) => {
          const next = { ...prev };
          for (const idx of indices) next[idx] = "failed";
          return next;
        });
      });
    // Only depend on token; we want latest-save semantics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshFaqsToken]);

  const openAdd = () => {
    if (isAnyFaqProcessing) return;
    setDraft({ question: "", answer: "", active: true });
    setEditingIndex(null);
    setSheetOpen(true);
  };

  const openEdit = (index: number) => {
    if ((faqSyncState[index] ?? "ready") === "processing") return;
    setDraft({ ...faqs[index] });
    setEditingIndex(index);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingIndex(null);
  };

  const handleSave = async () => {
    if (isAnyFaqProcessing) return;
    const question = draft.question.trim();
    const answer = draft.answer.trim();
    if (!question || !answer) return;

    if (editingIndex !== null) {
      const orig = faqs[editingIndex];
      if (orig && question === orig.question.trim() && answer === orig.answer.trim()) {
        closeSheet();
        return;
      }
    }

    let savedIndex: number;
    if (editingIndex !== null) {
      const next = faqs.map((faq, i) => (i === editingIndex ? { question, answer, active: draft.active !== false } : faq));
      onChange(cleanFaqs(next));
      savedIndex = editingIndex;
    } else {
      const newFaqs = cleanFaqs([...faqs, { question, answer, active: draft.active !== false }]);
      onChange(newFaqs);
      // New FAQ is at the end of the cleaned array
      savedIndex = newFaqs.length - 1;
    }
    
    closeSheet();
    
    // Auto-refresh KB embeddings for the saved FAQ if botId and onRetryFaq are available
    if (botId && onRetryFaq && savedIndex >= 0) {
      setFaqSyncState((prev) => ({ ...prev, [savedIndex]: "processing" }));
      try {
        await onRetryFaq(savedIndex);
        setFaqSyncState((prev) => ({ ...prev, [savedIndex]: "ready" }));
      } catch {
        setFaqSyncState((prev) => ({ ...prev, [savedIndex]: "failed" }));
      }
    }
  };

  const handleDelete = (index: number) => {
    if ((faqSyncState[index] ?? "ready") === "processing") return;
    onChange(cleanFaqs(faqs.filter((_, i) => i !== index)));
  };

  const handleToggleActive = (index: number, active: boolean) => {
    if ((faqSyncState[index] ?? "ready") === "processing") return;
    const next = faqs.map((faq, i) => (i === index ? { ...faq, active } : faq));
    onChange(cleanFaqs(next));
  };

  const handleRefreshFaq = async (index: number) => {
    if (!onRetryFaq) return;
    setFaqSyncState((prev) => ({ ...prev, [index]: "processing" }));
    try {
      await onRetryFaq(index);
      setFaqSyncState((prev) => ({ ...prev, [index]: "ready" }));
    } catch {
      setFaqSyncState((prev) => ({ ...prev, [index]: "failed" }));
    }
  };

  function openRefreshConfirm(index: number) {
    setRefreshConfirmIndex(index);
    setRefreshConfirmOpen(true);
  }

  function closeRefreshConfirm() {
    setRefreshConfirmOpen(false);
    setRefreshConfirmIndex(null);
  }

  function truncateForPreview(text?: string, maxChars = 220) {
    if (!text) return "—";
    const trimmed = String(text).trim();
    if (!trimmed) return "—";
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars)}…`;
  }

  const isValid = draft.question.trim().length > 0 && draft.answer.trim().length > 0;

  /** When editing, true only if question or answer differs (include/excluded is edited on the card). */
  const faqDraftIsDirty =
    editingIndex === null
      ? true
      : (() => {
          const orig = faqs[editingIndex];
          if (!orig) return true;
          const q = draft.question.trim();
          const a = draft.answer.trim();
          return q !== orig.question.trim() || a !== orig.answer.trim();
        })();

  const answerPreview = (answer: string, maxChars = 100) => {
    const text = answer.replace(/\s+/g, " ").trim();
    return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text || "—";
  };

  return (
    <>
      <SettingsCollectionHeader
        title="FAQs"
        summary={
          faqs.length === 0
            ? null
            : kbEmbeddingSnapshot != null
              ? `${faqs.length} FAQ${faqs.length !== 1 ? "s" : ""} · ${kbEmbeddingSnapshot.faqItemCount} in KB`
              : `${faqs.length} FAQ${faqs.length !== 1 ? "s" : ""}`
        }
        action={
          <Button type="button" variant="primary" size="sm" onClick={openAdd} disabled={isAnyFaqProcessing}>
            Add FAQ
          </Button>
        }
      />
      {faqs.length === 0 ? (
        <SettingsEmptyCollection
          title="No FAQs yet"
          description="Add questions and answers for the bot to use."
          action={
            <Button type="button" variant="primary" size="sm" onClick={openAdd} disabled={isAnyFaqProcessing}>
              Add FAQ
            </Button>
          }
          className="mt-3"
        />
      ) : (
        <SettingsItemList className="mt-3">
          {faqs.map((faq, index) => (
            <SettingsItemCard
              key={index}
              actions={
                <div className="flex items-center gap-0">
                  <Tooltip content="Turn this on to let the assistant use this FAQ when replying. Turn it off to ignore this FAQ in replies.">
                    <span className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md">
                      <Switch
                        checked={faq.active !== false}
                        onCheckedChange={(checked) => handleToggleActive(index, checked)}
                        aria-label={faq.active !== false ? "Exclude FAQ from KB" : "Include FAQ in KB"}
                        className="scale-90"
                        disabled={(faqSyncState[index] ?? "ready") === "processing"}
                      />
                    </span>
                  </Tooltip>
                  {botId && onRetryFaq && (
                    <Tooltip content="Refresh this FAQ so the assistant uses the latest version.">
                      <button
                        type="button"
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent transition outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                          (faqSyncState[index] ?? "ready") === "processing"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse cursor-not-allowed"
                            : (faqSyncState[index] ?? "ready") === "failed"
                              ? "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30"
                              : (faqSyncState[index] ?? "ready") === "ready"
                                ? "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        }`}
                        onClick={() => openRefreshConfirm(index)}
                        disabled={(faqSyncState[index] ?? "ready") === "processing"}
                        aria-label="Refresh FAQ in knowledge base"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${(faqSyncState[index] ?? "ready") === "processing" ? "animate-spin" : ""}`}
                          aria-hidden
                        />
                      </button>
                    </Tooltip>
                  )}
                  <SettingsActionMenu
                    onEdit={() => openEdit(index)}
                    onDelete={() => handleDelete(index)}
                    editLabel="Edit FAQ"
                    deleteLabel="Remove FAQ"
                    showLabels={false}
                    editDisabled={(faqSyncState[index] ?? "ready") === "processing"}
                    deleteDisabled={(faqSyncState[index] ?? "ready") === "processing"}
                  />
                </div>
              }
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${(faqSyncState[index] ?? "ready") === "processing"
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : (faqSyncState[index] ?? "ready") === "failed"
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        }`}
                    >
                      {(faqSyncState[index] ?? "ready") === "processing"
                        ? "Processing"
                        : (faqSyncState[index] ?? "ready") === "failed"
                          ? "Failed"
                          : "Ready"}
                    </span>
                    <Tooltip content={faq.active !== false ? "This FAQ is used by the assistant when replying." : "This FAQ is saved, but the assistant ignores it in replies."}>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${faq.active !== false
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                      >
                        {faq.active !== false ? "Included" : "Excluded"}
                      </span>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 flex-1 min-w-0">
                    {faq.question || "—"}
                  </p>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400" title={faq.answer || undefined}>
                  {answerPreview(faq.answer)}
                </p>
              </div>
            </SettingsItemCard>
          ))}
        </SettingsItemList>
      )}

      <SettingsSideSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingIndex !== null ? "Edit FAQ" : "Add FAQ"}
        description="Question and answer shown to users."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeSheet}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!isValid || isAnyFaqProcessing || !faqDraftIsDirty}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Question</label>
            {isAnyFaqProcessing ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100">
                {draft.question.trim() ? draft.question : "—"}
              </div>
            ) : (
              <Input
                value={draft.question}
                onChange={(e) => setDraft((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="e.g. What services do you offer?"
                className="w-full"
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Answer</label>
            {isAnyFaqProcessing ? (
              <div className="min-h-[5rem] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
                <p className="whitespace-pre-wrap break-words">{draft.answer.trim() ? draft.answer : "—"}</p>
              </div>
            ) : (
              <Textarea
                rows={4}
                value={draft.answer}
                onChange={(e) => setDraft((prev) => ({ ...prev, answer: e.target.value }))}
                placeholder="Short, clear answer for this FAQ."
                className="w-full min-h-[5rem] resize-y"
              />
            )}
          </div>
          {editingIndex === null ? (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Include this FAQ in knowledge base</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Disabled FAQs are saved, but the assistant will not use them in replies.</p>
              </div>
              <Tooltip content="Turn this on to let the assistant use this FAQ when replying. Turn it off to ignore this FAQ in replies.">
                <span className="inline-flex">
                  <Switch
                    checked={draft.active !== false}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, active: checked }))}
                    aria-label="Include FAQ in knowledge base"
                    className="scale-90"
                    disabled={isAnyFaqProcessing}
                  />
                </span>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </SettingsSideSheet>

      <SettingsModal
        open={refreshConfirmOpen}
        onClose={closeRefreshConfirm}
        icon={<RefreshCw className="h-5 w-5" strokeWidth={2} aria-hidden />}
        maxWidthClass="max-w-md"
        title="Refresh this FAQ"
        description="Re-builds embeddings for this question and answer only, so the assistant picks up your latest edits."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeRefreshConfirm}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={
                refreshConfirmIndex === null || (faqSyncState[refreshConfirmIndex] ?? "ready") === "processing"
              }
              onClick={async () => {
                const idx = refreshConfirmIndex;
                if (idx === null) return;
                closeRefreshConfirm();
                await handleRefreshFaq(idx);
              }}
            >
              Refresh embeddings
            </Button>
          </>
        }
      >
        {refreshConfirmIndex === null ? null : (
          <SettingsEmbedPreview
            eyebrow="FAQ"
            badge={
              faqs[refreshConfirmIndex] ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                    faqs[refreshConfirmIndex].active !== false
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300"
                      : "border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {faqs[refreshConfirmIndex].active !== false ? "Included in KB" : "Excluded from KB"}
                </span>
              ) : null
            }
          >
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Question</p>
                <p className="mt-1 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-50">
                  {faqs[refreshConfirmIndex]?.question || "—"}
                </p>
              </div>
              <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Answer</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {truncateForPreview(faqs[refreshConfirmIndex]?.answer, 420)}
                </p>
              </div>
            </div>
          </SettingsEmbedPreview>
        )}
      </SettingsModal>
    </>
  );
}
