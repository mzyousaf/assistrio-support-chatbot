"use client";

import type { ReactNode } from "react";
import { useCallback, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Loader2, Trash2, Upload } from "lucide-react";
import { TrialSetupSectionHeader } from "@/components/trial/dashboard/trial-setup-section-header";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { mergeKnowledgeDocumentAssetsServerResponseIntoDraft } from "@/lib/trial/trial-asset-draft-merge";
import { apiDraftJsonToTrialWorkspaceDraftV3 } from "@/lib/trial/trial-draft-sync";
import { patchTrialWorkspaceDraft } from "@/lib/trial/trial-draft-api";
import { uploadTrialOnboardingAsset } from "@/lib/trial/trial-onboarding-upload";
import {
  getTrialSetupStepConfig,
  type TrialWorkspaceKnowledgePlaceholder,
} from "@/lib/trial/trial-workspace-draft";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";
import { TrialFaqEditor } from "@/components/trial/dashboard/trial-forms/trial-faq-editor";
import {
  TRIAL_MAX_KNOWLEDGE_DOCUMENTS,
  TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES,
  TRIAL_MAX_KNOWLEDGE_FILE_BYTES,
} from "@/lib/trial/trial-knowledge-limits";
import {
  TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS,
  truncateNotesToMaxChars,
} from "@/lib/trial/trial-utf8-bytes";
import { TrialTextarea } from "@/components/trial/dashboard/trial-forms/trial-textarea";
import { TrialKnowledgeFileIcon } from "@/components/trial/dashboard/trial-knowledge-file-icon";

const tabs = [
  { id: "documents" as const, label: "Files" },
  { id: "notes" as const, label: "Text snippet" },
  { id: "faq" as const, label: "Q&A" },
];

function KnowledgeInfoBox({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-slate-100/90 bg-gradient-to-br from-slate-50/95 to-white px-3.5 py-3 text-[13px] leading-snug shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-teal)]" strokeWidth={2} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 font-normal leading-relaxed text-slate-600">{children}</div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

/** Matches “Your files 3/3” — uppercase label + current/max. */
function KnowledgeQuotaLine({ label, current, max }: { label: string; current: number; max: number }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {label}{" "}
      <span className="tabular-nums">
        {current.toLocaleString()}/{max.toLocaleString()}
      </span>
    </p>
  );
}

export function TrialKnowledgeBaseStepBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") ?? "documents";
  const active = tabs.some((t) => t.id === raw) ? raw : "documents";
  const { draft, setKnowledge, replaceDraft } = useTrialWorkspaceDraft();
  const { showToast } = useTrialDashboardToast();
  const section = getTrialSetupStepConfig("knowledge-base");

  const flushKnowledgeSnapshotToServer = useCallback(
    async (k: TrialWorkspaceKnowledgePlaceholder): Promise<boolean> => {
      const res = await patchTrialWorkspaceDraft({
        knowledge: {
          notes: k.notes,
          faqs: k.faqs,
          documents: k.documents,
        },
      });
      if (!res.ok) {
        showToast({ message: res.errorMessage, variant: "error" });
        return false;
      }
      replaceDraft(apiDraftJsonToTrialWorkspaceDraftV3(res.draft));
      return true;
    },
    [replaceDraft, showToast],
  );

  const persistKnowledgeToServer = useCallback(
    async (knowledgeOverride?: Partial<TrialWorkspaceKnowledgePlaceholder>): Promise<boolean> => {
      const k = { ...draft.knowledge, ...knowledgeOverride };
      return flushKnowledgeSnapshotToServer(k);
    },
    [draft.knowledge, flushKnowledgeSnapshotToServer],
  );

  function selectKnowledgeTab(tabId: (typeof tabs)[number]["id"]) {
    if (tabId === active) return;
    const snapshot = draft.knowledge;
    router.replace(`/trial/dashboard/setup/knowledge-base?tab=${tabId}`, { scroll: false });
    void flushKnowledgeSnapshotToServer(snapshot);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-2">
      <TrialSetupSectionHeader compactBottom title={section.editorTitle} description={section.editorDescription} />

      <div className="space-y-6">
        <div className="flex flex-wrap gap-1 border-b border-[var(--border-default)] pb-px">
          {tabs.map((t) => {
            const isOn = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectKnowledgeTab(t.id)}
                className={`rounded-t-lg px-4 py-2.5 text-sm transition ${
                  isOn
                    ? "bg-white font-semibold text-[var(--brand-teal-dark)] ring-1 ring-[var(--border-default)] ring-b-0"
                    : "font-normal text-[var(--foreground-muted)] hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-sm)] sm:p-8">
          {active === "notes" ? (
            <NotesPanel notes={draft.knowledge.notes} setNotes={(v) => setKnowledge({ notes: v })} />
          ) : active === "faq" ? (
            <TrialFaqEditor
              items={draft.knowledge.faqs}
              onChange={(faqs) => setKnowledge({ faqs })}
              onPersistFaqs={(faqs) => persistKnowledgeToServer({ faqs })}
            />
          ) : (
            <DocumentsPanel />
          )}
        </div>
      </div>
    </div>
  );
}

function NotesPanel({ notes, setNotes }: { notes: string; setNotes: (v: string) => void }) {
  const len = notes.length;
  const snippetFieldId = useId();
  const clamp = (next: string) => truncateNotesToMaxChars(next, TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS);
  return (
    <div className="space-y-4">
      <KnowledgeInfoBox
        trailing={
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="tabular-nums">
              {len.toLocaleString()}/{TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS.toLocaleString()}
            </span>
          </p>
        }
      >
        <p>Add text snippet to your knowledge base that the agent gets trained on.</p>
      </KnowledgeInfoBox>
      <TrialTextarea
        id={`${snippetFieldId}-notes`}
        label="Text snippet"
        labelSrOnly
        value={notes}
        maxLength={TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS}
        onChange={(e) => setNotes(clamp(e.target.value))}
        placeholder="Policies, product facts, tone, and instructions your agent should treat as ground truth."
        spellCheck
        className="min-h-[12rem]"
      />
    </div>
  );
}

type DocAsset = {
  assetKey: string;
  uploadedAt: string;
  originalFilename: string;
  mimeType?: string;
  sizeBytes: number;
};

function formatKind(mime: string | undefined, name: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "PDF";
  if (m.includes("word") || m.includes("officedocument")) return "Word";
  if (m.includes("csv")) return "CSV";
  if (m.includes("html")) return "HTML";
  if (m.includes("markdown") || name.toLowerCase().endsWith(".md")) return "Markdown";
  if (m.startsWith("text/")) return "Text";
  if (m) return m.split("/").pop() || "File";
  const ext = name.split(".").pop();
  return ext ? ext.toUpperCase() : "File";
}

function DocumentsPanel() {
  const { draft, replaceDraft } = useTrialWorkspaceDraft();
  const { showToast } = useTrialDashboardToast();
  const docs = useMemo(
    () => (draft.uploadedAssets ?? []).filter((a) => a.kind === "knowledge_document") as DocAsset[],
    [draft.uploadedAssets],
  );
  const totalDocBytes = useMemo(() => docs.reduce((s, d) => s + (d.sizeBytes ?? 0), 0), [docs]);
  const atDocCountLimit = docs.length >= TRIAL_MAX_KNOWLEDGE_DOCUMENTS;
  const [busy, setBusy] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  async function removeDocument(assetKey: string) {
    const prevAssets = draft.uploadedAssets ?? [];
    const nextAssets = prevAssets.filter((a) => !(a.kind === "knowledge_document" && a.assetKey === assetKey));
    replaceDraft((d) => ({ ...d, uploadedAssets: nextAssets }));
    setRemovingKey(assetKey);
    try {
      const res = await patchTrialWorkspaceDraft({ uploadedAssets: nextAssets });
      if (!res.ok) {
        replaceDraft((d) => ({ ...d, uploadedAssets: prevAssets }));
        showToast({ message: res.errorMessage, variant: "error" });
        return;
      }
      replaceDraft((prev) => mergeKnowledgeDocumentAssetsServerResponseIntoDraft(prev, res.draft));
      showToast({ message: "Removed from your list.", variant: "success" });
    } catch {
      replaceDraft((d) => ({ ...d, uploadedAssets: prevAssets }));
      showToast({ message: "Couldn’t remove that file. Try again.", variant: "error" });
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <KnowledgeInfoBox>
        <p>Upload documents to train your AI. Extract text from PDFs, DOCX, and TXT files.</p>
      </KnowledgeInfoBox>

      <label
        className={`group flex min-h-[11rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/95 bg-gradient-to-b from-slate-50/90 to-white px-6 py-10 transition hover:border-[var(--brand-teal)]/45 hover:from-[var(--brand-teal-faint)]/40 hover:to-white ${
          atDocCountLimit || busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.txt,.md,.doc,.docx,.html,.csv,application/pdf,text/plain,text/markdown,text/html,text/csv"
          disabled={busy || atDocCountLimit}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (docs.length >= TRIAL_MAX_KNOWLEDGE_DOCUMENTS) {
              showToast({
                message: `You can upload at most ${TRIAL_MAX_KNOWLEDGE_DOCUMENTS} knowledge files.`,
                variant: "error",
              });
              return;
            }
            if (f.size > TRIAL_MAX_KNOWLEDGE_FILE_BYTES) {
              showToast({ message: "That file is too large (max 5 MB per file).", variant: "error" });
              return;
            }
            if (totalDocBytes + f.size > TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES) {
              showToast({
                message: `Total size of knowledge files can’t exceed ${TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES / (1024 * 1024)} MB.`,
                variant: "error",
              });
              return;
            }
            void (async () => {
              setBusy(true);
              try {
                const { draft: raw } = await uploadTrialOnboardingAsset("knowledge_document", f);
                replaceDraft((prev) => mergeKnowledgeDocumentAssetsServerResponseIntoDraft(prev, raw));
                showToast({ message: "File added.", variant: "success" });
              } catch (err) {
                const raw = err instanceof Error ? err.message : "Upload failed.";
                const friendly =
                  raw.includes("Unsupported document") || raw.includes("INVALID_FILE_TYPE")
                    ? "That file type isn’t supported. Try PDF, Word, plain text, Markdown, HTML, or CSV (max 5MB)."
                    : raw.includes("too large") || raw.includes("FILE_TOO_LARGE")
                      ? "That file is too large (max 5MB)."
                      : raw.includes("KNOWLEDGE_DOCUMENT_LIMIT")
                        ? `You can upload at most ${TRIAL_MAX_KNOWLEDGE_DOCUMENTS} knowledge files.`
                        : raw.includes("KNOWLEDGE_DOCUMENTS_TOTAL_TOO_LARGE")
                          ? `Total size of knowledge files can’t exceed ${TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES / (1024 * 1024)} MB.`
                          : raw;
                showToast({ message: friendly, variant: "error" });
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
        {busy ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Uploading…
          </span>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-teal-faint)] text-[var(--brand-teal-dark)] ring-1 ring-[var(--brand-teal)]/15 transition group-hover:ring-[var(--brand-teal)]/25">
              <Upload className="h-6 w-6" strokeWidth={2} aria-hidden />
            </div>
            <span className="mt-4 text-center text-[15px] font-semibold text-slate-900">Drag files here or click to upload</span>
            <span className="mt-1.5 max-w-sm text-center text-[13px] font-medium text-slate-600">
              5 MB each file
            </span>
            <span className="mt-1 max-w-sm text-center text-[12px] text-slate-500">
              PDF, Word (DOC/DOCX), TXT, Markdown, HTML, CSV
            </span>
          </>
        )}
      </label>

      <KnowledgeQuotaLine label="Your files" current={docs.length} max={TRIAL_MAX_KNOWLEDGE_DOCUMENTS} />

      {docs.length > 0 ? (
        <div>
          <ul className="space-y-2.5">
            {docs.map((d) => {
              const kb = d.sizeBytes / 1024;
              const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
              return (
                <li
                  key={`${d.assetKey}-${d.uploadedAt}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-3 shadow-[var(--shadow-xs)] transition hover:border-slate-300/90"
                >
                  <TrialKnowledgeFileIcon filename={d.originalFilename} mimeType={d.mimeType} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{d.originalFilename}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {sizeLabel} · {formatKind(d.mimeType, d.originalFilename)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    aria-label={`Remove ${d.originalFilename}`}
                    disabled={removingKey === d.assetKey}
                    onClick={() => void removeDocument(d.assetKey)}
                  >
                    {removingKey === d.assetKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-6 text-center text-[13px] text-slate-500">
          No files yet. Add a PDF, guide, or policy so your AI has more to draw on for visitors.
        </p>
      )}
    </div>
  );
}
