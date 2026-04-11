"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrialQuickLinkModal } from "@/components/trial/dashboard/trial-forms/trial-quick-link-modal";
import type { TrialProfileQuickLink } from "@/lib/trial/trial-workspace-draft";

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 007.07.07l1.71-1.71a5 5 0 00-7.07-7.07L9.88 6.12M14 11a5 5 0 00-7.07-.07l-1.71 1.71a5 5 0 007.07 7.07l1.71-1.71"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

const addButtonClass = "h-9 shrink-0 rounded-sm px-3.5 text-[13px]";

export type TrialQuickLinksEditorHandle = {
  openAdd: () => void;
};

type Props = {
  links: TrialProfileQuickLink[];
  onCreate: (label: string, url: string) => void;
  onUpdate: (id: string, label: string, url: string) => void;
  onRemove: (id: string) => void;
  maxLinks: number;
  embedded?: boolean;
  showAddButton?: boolean;
  hideEmptyState?: boolean;
};

export const TrialQuickLinksEditor = forwardRef<TrialQuickLinksEditorHandle, Props>(function TrialQuickLinksEditor(
  { links, onCreate, onUpdate, onRemove, maxLinks, embedded = false, showAddButton = true, hideEmptyState = false },
  ref,
) {
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; id: string }>(null);

  const openAdd = useCallback(() => {
    if (links.length >= maxLinks) return;
    setModal({ mode: "add" });
  }, [links.length, maxLinks]);

  useImperativeHandle(ref, () => ({ openAdd }), [openAdd]);

  const editing = modal?.mode === "edit" ? links.find((q) => q.id === modal.id) : undefined;
  const modalOpen = modal !== null;
  const initialLabel = modal?.mode === "edit" && editing ? editing.label : "";
  const initialUrl = modal?.mode === "edit" && editing ? editing.url : "";

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-[1rem] font-medium tracking-tight text-slate-800">Quick Links</h3>
            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-slate-500/70">
              Quick Links your AI Agent can suggest — pricing, docs, booking, and more.
            </p>
          </div>
          {showAddButton ? (
            <Button type="button" variant="secondary" className={addButtonClass} disabled={links.length >= maxLinks} onClick={openAdd}>
              Add Quick Link
            </Button>
          ) : null}
        </div>
      ) : showAddButton ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="secondary" className={addButtonClass} disabled={links.length >= maxLinks} onClick={openAdd}>
            Add Quick Link
          </Button>
        </div>
      ) : null}

      <TrialQuickLinkModal
        open={modalOpen}
        variant={modal?.mode === "edit" ? "edit" : "add"}
        initialLabel={initialLabel}
        initialUrl={initialUrl}
        onClose={() => setModal(null)}
        onSave={(label, url) => {
          if (modal?.mode === "add") onCreate(label, url);
          else if (modal?.mode === "edit") onUpdate(modal.id, label, url);
        }}
      />

      {links.length === 0 ? (
        hideEmptyState ? null : (
          <div className="rounded-sm border border-dashed border-slate-300/75 bg-slate-50/50 px-4 py-5 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-sm bg-white/90 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
              <IconLink className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-[0.875rem] font-medium text-slate-800">No Quick Links yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-slate-500/70">
              Use <span className="font-medium text-slate-600">Add Quick Link</span> above to add pages visitors can open from chat.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-slate-500/60">
              Each row needs a short label and a full URL (https).
            </p>
          </div>
        )
      ) : (
        <ul className="m-0 list-none divide-y divide-slate-100/95 p-0">
          {links.map((q, rowIdx) => (
            <li key={q.id}>
              <div className="flex items-start gap-3 py-4 sm:items-center sm:gap-4">
                <span className="flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-sm bg-slate-100/90 text-[11px] font-semibold tabular-nums text-slate-700 sm:pt-0">
                  {rowIdx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium text-slate-900">{q.label.trim() || "Untitled"}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500/90">{q.url.trim() || "—"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="rounded-sm p-2 text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/25"
                    aria-label={`Edit Quick Link ${rowIdx + 1}`}
                    onClick={() => setModal({ mode: "edit", id: q.id })}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rounded-sm p-2 text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/25"
                    aria-label={`Remove Quick Link ${rowIdx + 1}`}
                    onClick={() => onRemove(q.id)}
                  >
                    <IconTrash className="h-4 w-4 opacity-80" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
