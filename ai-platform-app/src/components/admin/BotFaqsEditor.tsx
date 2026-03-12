"use client";

import React, { useState } from "react";

import {
  SettingsActionMenu,
  SettingsCollectionHeader,
  SettingsEmptyCollection,
  SettingsItemCard,
  SettingsItemList,
  SettingsSideSheet,
} from "@/components/admin/settings";
import { EmbeddingStatusBadge } from "@/components/admin/EmbeddingStatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { EmbeddingStatus } from "@/models/Bot";

export interface BotFaq {
  question: string;
  answer: string;
  embeddingStatus?: EmbeddingStatus;
  embeddingUpdatedAt?: string;
  embeddingError?: string | null;
}

interface BotFaqsEditorProps {
  value: BotFaq[];
  onChange: (next: BotFaq[]) => void;
  /** When set, show embedding status and retry for failed items. */
  botId?: string;
  onRetryFaq?: (faqIndex: number) => Promise<void>;
}

function cleanFaqs(raw: BotFaq[]): BotFaq[] {
  return raw
    .map((faq) => ({
      question: faq.question.trim(),
      answer: faq.answer.trim(),
    }))
    .filter((faq) => faq.question && faq.answer);
}

export default function BotFaqsEditor({ value, onChange, botId, onRetryFaq }: BotFaqsEditorProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<BotFaq>({ question: "", answer: "" });

  const faqs = value ?? [];

  const openAdd = () => {
    setDraft({ question: "", answer: "" });
    setEditingIndex(null);
    setSheetOpen(true);
  };

  const openEdit = (index: number) => {
    setDraft({ ...faqs[index] });
    setEditingIndex(index);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingIndex(null);
  };

  const handleSave = () => {
    const question = draft.question.trim();
    const answer = draft.answer.trim();
    if (!question || !answer) return;
    if (editingIndex !== null) {
      const next = faqs.map((faq, i) => (i === editingIndex ? { question, answer } : faq));
      onChange(cleanFaqs(next));
    } else {
      onChange(cleanFaqs([...faqs, { question, answer }]));
    }
    closeSheet();
  };

  const handleDelete = (index: number) => {
    onChange(cleanFaqs(faqs.filter((_, i) => i !== index)));
  };

  const isValid = draft.question.trim().length > 0 && draft.answer.trim().length > 0;

  const answerPreview = (answer: string, maxChars = 100) => {
    const text = answer.replace(/\s+/g, " ").trim();
    return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text || "—";
  };

  return (
    <>
      <SettingsCollectionHeader
        title="FAQs"
        summary={faqs.length === 0 ? null : `${faqs.length} FAQ${faqs.length !== 1 ? "s" : ""}`}
        action={
          <Button type="button" variant="secondary" size="sm" onClick={openAdd}>
            Add FAQ
          </Button>
        }
      />
      {faqs.length === 0 ? (
        <SettingsEmptyCollection
          title="No FAQs yet"
          description="Add questions and answers for the bot to use."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={openAdd}>
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
                <div className="flex items-center gap-2">
                  {botId && onRetryFaq && faq.embeddingStatus === "failed" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => onRetryFaq(index)}
                    >
                      Retry embed
                    </Button>
                  )}
                  <SettingsActionMenu
                    onEdit={() => openEdit(index)}
                    onDelete={() => handleDelete(index)}
                    editLabel="Edit FAQ"
                    deleteLabel="Remove FAQ"
                    showLabels={false}
                  />
                </div>
              }
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 flex-1 min-w-0">
                    {faq.question || "—"}
                  </p>
                  {botId && (
                    <EmbeddingStatusBadge
                      status={faq.embeddingStatus ?? "pending"}
                      updatedAt={faq.embeddingUpdatedAt}
                      error={faq.embeddingError}
                      size="xs"
                    />
                  )}
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
            <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Question</label>
            <Input
              value={draft.question}
              onChange={(e) => setDraft((prev) => ({ ...prev, question: e.target.value }))}
              placeholder="e.g. What services do you offer?"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Answer</label>
            <Textarea
              rows={4}
              value={draft.answer}
              onChange={(e) => setDraft((prev) => ({ ...prev, answer: e.target.value }))}
              placeholder="Short, clear answer for this FAQ."
              className="w-full min-h-[5rem] resize-y"
            />
          </div>
        </div>
      </SettingsSideSheet>
    </>
  );
}
