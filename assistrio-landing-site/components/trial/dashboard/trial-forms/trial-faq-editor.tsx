"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CircleHelp, Info, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrialKnowledgeFaqItem } from "@/lib/trial/trial-knowledge-normalize";
import { newFaqItemId, TRIAL_MAX_FAQ_ANSWER, TRIAL_MAX_FAQ_ITEMS, TRIAL_MAX_FAQ_QUESTION } from "@/lib/trial/trial-knowledge-normalize";
import { TrialTextInput } from "@/components/trial/dashboard/trial-forms/trial-text-input";
import { TrialTextarea } from "@/components/trial/dashboard/trial-forms/trial-textarea";
import {
  landingModalBackdropClass,
  landingModalCloseButtonClass,
  landingModalFooterBarClass,
  landingModalHeaderIconWrapClass,
  landingModalPanelStackClass,
} from "@/lib/landing-modal-styles";

type Props = {
  items: TrialKnowledgeFaqItem[];
  onChange: (next: TrialKnowledgeFaqItem[]) => void;
  /** When set, add/save/remove persist via draft PATCH; failures revert local state. */
  onPersistFaqs?: (faqs: TrialKnowledgeFaqItem[]) => Promise<boolean>;
};

export function TrialFaqEditor({ items, onChange, onPersistFaqs }: Props) {
  const baseId = useId();
  const descId = useId();
  const questionInputRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  /** When set, modal edits this row; when null, modal adds a new row. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQ, setDraftQ] = useState("");
  const [draftA, setDraftA] = useState("");

  useLayoutEffect(() => {
    if (!modalOpen || faqSaving) return;
    const id = requestAnimationFrame(() => questionInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [modalOpen, faqSaving]);

  useEffect(() => {
    if (modalOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || faqSaving) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, faqSaving]);

  function openAdd() {
    if (items.length >= TRIAL_MAX_FAQ_ITEMS) return;
    setEditingId(null);
    setDraftQ("");
    setDraftA("");
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const row = items.find((i) => i.id === id);
    setEditingId(id);
    setDraftQ(row?.question ?? "");
    setDraftA(row?.answer ?? "");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  async function saveModal() {
    if (!editingId && items.length >= TRIAL_MAX_FAQ_ITEMS) return;
    const q = draftQ.slice(0, TRIAL_MAX_FAQ_QUESTION);
    const a = draftA.slice(0, TRIAL_MAX_FAQ_ANSWER);
    const prev = items;
    const next = editingId
      ? items.map((row) => (row.id === editingId ? { ...row, question: q, answer: a } : row))
      : [...items, { id: newFaqItemId(), question: q, answer: a }];
    onChange(next);
    if (onPersistFaqs) {
      setFaqSaving(true);
      try {
        const ok = await onPersistFaqs(next);
        if (!ok) {
          onChange(prev);
          return;
        }
        closeModal();
      } finally {
        setFaqSaving(false);
      }
    } else {
      closeModal();
    }
  }

  async function removeAt(index: number) {
    const prev = items;
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    if (onPersistFaqs) {
      setRemovingIndex(index);
      try {
        const ok = await onPersistFaqs(next);
        if (!ok) onChange(prev);
      } finally {
        setRemovingIndex(null);
      }
    }
  }

  const atPairLimit = items.length >= TRIAL_MAX_FAQ_ITEMS;

  return (
    <div className="space-y-6">
      <div className="flex gap-2.5 rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-white px-3.5 py-3 text-[13px] leading-snug shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-teal)]" strokeWidth={2} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="font-normal leading-relaxed text-slate-600">
            Predefined answers for key topics. Your Agent checks this data first.
          </p>
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="tabular-nums">
              {items.length}/{TRIAL_MAX_FAQ_ITEMS}
            </span>
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-200/95 bg-slate-50/60 px-5 py-10 text-center">
          <p className="text-[15px] font-medium text-slate-800">No Q&amp;A added yet.</p>
          <p className="mt-2 text-[13px] text-slate-600">Add question-and-answer pairs your agent should prioritize.</p>
          <Button type="button" variant="primary" className="mt-6 h-9 rounded-sm px-5 text-[13px] font-semibold" onClick={openAdd}>
            Add Q&amp;A
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {items.map((row, index) => (
              <li
                key={row.id}
                className="flex items-start gap-3 rounded-sm border border-slate-200/90 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800">{row.question.trim() || "—"}</p>
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-slate-600">{row.answer.trim() || "—"}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    className="rounded-sm p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[var(--brand-teal-dark)]"
                    aria-label={`Edit Q&A ${index + 1}`}
                    onClick={() => openEdit(row.id)}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rounded-sm p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                    aria-label={`Remove Q&A ${index + 1}`}
                    disabled={removingIndex !== null}
                    onClick={() => void removeAt(index)}
                  >
                    {removingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!atPairLimit ? (
            <Button type="button" variant="primary" className="h-9 rounded-sm px-5 text-[13px] font-semibold" onClick={openAdd}>
              Add Q&amp;A
            </Button>
          ) : (
            <p className="text-[12px] text-slate-500">Maximum of {TRIAL_MAX_FAQ_ITEMS} pairs reached.</p>
          )}
        </>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Close dialog"
            className={`absolute inset-0 ${landingModalBackdropClass}`}
            tabIndex={-1}
            onClick={() => {
              if (!faqSaving) closeModal();
            }}
          />
          <div
            className={`relative z-[1] max-w-lg min-h-0 ${landingModalPanelStackClass}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-faq-modal-title`}
            aria-describedby={descId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                void saveModal();
              }}
            >
            <div className="relative shrink-0 border-b border-slate-100/90 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
              <button
                type="button"
                onClick={closeModal}
                className={`absolute right-3 top-3 z-[1] sm:right-4 sm:top-4 ${landingModalCloseButtonClass}`}
                aria-label="Close"
                disabled={faqSaving}
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </button>
              <div className="flex items-start gap-3 pr-10 sm:pr-11">
                <div className={landingModalHeaderIconWrapClass}>
                  <CircleHelp className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id={`${baseId}-faq-modal-title`} className="text-[15px] font-semibold tracking-tight text-slate-900">
                    {editingId ? "Edit Q&A" : "Add Q&A"}
                  </h2>
                  <p id={descId} className="mt-1 text-[12px] leading-snug text-slate-500">
                    Pairs your agent can quote with confidence.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-5 py-5 sm:px-6">
              <TrialTextInput
                ref={questionInputRef}
                id={`${baseId}-faq-q`}
                label="Question"
                labelTrailing={
                  <span className="text-[11px] font-medium tabular-nums text-slate-500">
                    {draftQ.length}/{TRIAL_MAX_FAQ_QUESTION}
                  </span>
                }
                value={draftQ}
                maxLength={TRIAL_MAX_FAQ_QUESTION}
                onChange={(e) => setDraftQ(e.target.value.slice(0, TRIAL_MAX_FAQ_QUESTION))}
                placeholder="e.g. How do I reset my password?"
                autoComplete="off"
              />
              <TrialTextarea
                id={`${baseId}-faq-a`}
                label="Answer"
                labelTrailing={
                  <span className="text-[11px] font-medium tabular-nums text-slate-500">
                    {draftA.length}/{TRIAL_MAX_FAQ_ANSWER}
                  </span>
                }
                value={draftA}
                maxLength={TRIAL_MAX_FAQ_ANSWER}
                onChange={(e) => setDraftA(e.target.value.slice(0, TRIAL_MAX_FAQ_ANSWER))}
                placeholder="The answer you want your agent to use."
                className="min-h-[7rem]"
              />
            </div>

            <div className={`${landingModalFooterBarClass} flex flex-wrap justify-end gap-2`}>
              <Button type="button" variant="secondary" className="h-10 min-w-[5.5rem] rounded-[var(--radius-md)] px-4 text-[13px]" disabled={faqSaving} onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="h-10 min-w-[5.5rem] rounded-[var(--radius-md)] px-4 text-[13px] font-semibold" disabled={faqSaving}>
                {faqSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </span>
                ) : editingId ? (
                  "Save"
                ) : (
                  "Add"
                )}
              </Button>
            </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
