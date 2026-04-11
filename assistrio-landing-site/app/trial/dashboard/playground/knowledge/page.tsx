"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrialEditorPane } from "@/components/trial/dashboard/trial-editor-pane";
import { TrialWorkspaceLoadingCenter } from "@/components/trial/dashboard/trial-workspace-loading-center";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";
import { TrialFaqEditor } from "@/components/trial/dashboard/trial-forms/trial-faq-editor";
import { trialFieldHintClass, trialFieldLabelClass, trialFieldTextareaClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";
import {
  fetchTrialWorkspaceAgent,
  patchTrialWorkspaceKnowledge,
} from "@/lib/trial/trial-agent-workspace-api";
import {
  fetchTrialBotKnowledgeSummary,
  retryTrialBotFailedDocument,
  type TrialBotKnowledgeSummary,
} from "@/lib/trial/trial-bot-knowledge-api";
import { friendlyKnowledgeDocumentMessage } from "@/lib/trial/trial-knowledge-doc-friendly";
import type { TrialKnowledgeFaqItem } from "@/lib/trial/trial-knowledge-normalize";
import { newFaqItemId } from "@/lib/trial/trial-knowledge-normalize";
import { TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS } from "@/lib/trial/trial-knowledge-limits";

function docStatusLabel(status: string | undefined): { label: string; className: string } {
  const s = (status ?? "").toLowerCase();
  if (s === "ready") return { label: "Ready", className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80" };
  if (s === "failed") return { label: "Needs attention", className: "bg-red-50 text-red-800 ring-red-200/80" };
  if (s === "processing") return { label: "Processing", className: "bg-amber-50 text-amber-900 ring-amber-200/80" };
  if (s === "queued") return { label: "Queued", className: "bg-sky-50 text-sky-900 ring-sky-200/80" };
  return { label: status || "Unknown", className: "bg-slate-50 text-slate-700 ring-slate-200/80" };
}

function faqsToEditorItems(faqs: Array<{ question: string; answer: string }>): TrialKnowledgeFaqItem[] {
  return faqs.map((f) => ({ id: newFaqItemId(), question: f.question, answer: f.answer }));
}

export default function TrialPlaygroundKnowledgePage() {
  const router = useRouter();
  const { draft, hydrated } = useTrialWorkspaceDraft();
  const agent = draft.trialAgent;
  const { showToast } = useTrialDashboardToast();

  const [data, setData] = useState<TrialBotKnowledgeSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [silentRefresh, setSilentRefresh] = useState(false);
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const [botId, setBotId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [faqItems, setFaqItems] = useState<TrialKnowledgeFaqItem[]>([]);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const loadDocs = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) setSilentRefresh(true);
    else setLoadError(null);
    try {
      const res = await fetchTrialBotKnowledgeSummary();
      if (!res.ok) {
        if (!silent) setLoadError(res.errorMessage);
        return;
      }
      setData(res);
      hasLoadedOnce.current = true;
    } finally {
      setSilentRefresh(false);
    }
  }, []);

  const loadWorkspaceKnowledge = useCallback(async () => {
    const res = await fetchTrialWorkspaceAgent();
    if (!res.ok) {
      showToast({ message: res.errorMessage, variant: "error" });
      return false;
    }
    setBotId(res.botId);
    setNotes(res.knowledge.notes);
    setFaqItems(
      res.knowledge.faqs.length ? faqsToEditorItems(res.knowledge.faqs) : [],
    );
    return true;
  }, [showToast]);

  const initialLoad = useCallback(async () => {
    setPageLoading(true);
    await Promise.all([loadDocs(), loadWorkspaceKnowledge()]);
    setPageLoading(false);
  }, [loadDocs, loadWorkspaceKnowledge]);

  const hasFileStatus = data != null;
  const hasWorkspaceKnowledge = Boolean(botId);

  useEffect(() => {
    if (!hydrated) return;
    if (!agent?.botId) {
      router.replace("/trial/dashboard/setup/go-live");
      return;
    }
    void initialLoad();
  }, [agent?.botId, hydrated, initialLoad, router]);

  const busyDocs = data ? data.documentCounts.docsQueued + data.documentCounts.docsProcessing > 0 : false;

  useEffect(() => {
    if (!busyDocs || !hasLoadedOnce.current) return;
    const t = window.setInterval(() => {
      void loadDocs({ silent: true });
    }, 5000);
    return () => window.clearInterval(t);
  }, [busyDocs, loadDocs]);

  const progress = useMemo(() => {
    if (!data) return null;
    const total = data.documentCounts.docsTotal;
    const ready = data.documentCounts.docsReady;
    const processing = data.documentCounts.docsQueued + data.documentCounts.docsProcessing;
    const failed = data.documentCounts.docsFailed;
    if (total <= 0) return { total, ready, processing, failed, pct: 0 };
    const pct = Math.min(100, Math.round((ready / total) * 100));
    return { total, ready, processing, failed, pct };
  }, [data]);

  const processingBanner = useMemo(() => {
    if (!data) return null;
    const { docsQueued, docsProcessing } = data.documentCounts;
    if (docsQueued + docsProcessing <= 0) return null;
    return {
      title: "Your files are being prepared for answers.",
      lines: [
        "This can take a minute depending on file size.",
        "You can keep exploring while your AI gets ready—try chat anytime; answers usually improve as files finish.",
      ],
    };
  }, [data]);

  const failedBanner = useMemo(() => {
    if (!data || data.documentCounts.docsFailed <= 0) return null;
    return {
      title: "Some files need another try.",
      body: "Your agent still works with notes, Q&A, and any files that are ready. Use Retry on a file below, or try a simpler document.",
    };
  }, [data]);

  async function onRetryDocument(documentId: string) {
    setRetryMessage(null);
    setRetryingDocId(documentId);
    const res = await retryTrialBotFailedDocument(documentId);
    setRetryingDocId(null);
    if (!res.ok) {
      setRetryMessage(res.errorMessage);
      return;
    }
    await loadDocs({ silent: true });
  }

  async function onSaveKnowledge() {
    setSaveMessage(null);
    setKnowledgeSaving(true);
    const res = await patchTrialWorkspaceKnowledge({
      notes: notes.slice(0, TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS),
      faqs: faqItems.map(({ question, answer }) => ({ question, answer })),
    });
    setKnowledgeSaving(false);
    if (!res.ok) {
      showToast({ message: res.errorMessage, variant: "error" });
      return;
    }
    setNotes(res.knowledge.notes);
    setFaqItems(
      res.knowledge.faqs.length ? faqsToEditorItems(res.knowledge.faqs) : [],
    );
    setSaveMessage("Saved.");
    showToast({ message: "Notes and Q&A saved to your agent.", variant: "success" });
    void loadDocs({ silent: true });
    window.setTimeout(() => setSaveMessage(null), 4000);
  }

  if (!hydrated) return null;
  if (!agent?.botId) {
    return <TrialWorkspaceLoadingCenter variant="inline" message="Opening knowledge…" />;
  }

  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-[min(100%,48rem)] py-4">
        <TrialWorkspaceLoadingCenter variant="inline" message="Loading knowledge…" />
      </div>
    );
  }

  return (
    <TrialEditorPane
      sectionTitle="Knowledge"
      status="draft"
      saving={knowledgeSaving}
      formId="trial-knowledge-form"
      saveMessage={saveMessage}
    >
      <form
        id="trial-knowledge-form"
        className="mx-auto max-w-[min(100%,48rem)] space-y-6 p-4 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          void onSaveKnowledge();
        }}
      >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Playground</p>
          <span id="knowledge-top" className="sr-only">
            Knowledge
          </span>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
            <strong className="font-semibold text-slate-800">Live agent knowledge</strong> — uploaded files are indexed for search; notes and
            Q&amp;A are stored on your agent and used in chat right away.
          </p>
          {botId ? <p className="mt-1 font-mono text-[11px] text-slate-500">Agent ID · {botId}</p> : null}
          <p className={`${trialFieldHintClass} mt-2 max-w-prose`}>
            Onboarding-only uploads stay in setup; everything here is tied to the <strong className="font-medium text-slate-700">created agent</strong>{" "}
            you are editing now.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {silentRefresh ? (
            <span className="text-[12px] text-slate-500 tabular-nums" aria-live="polite">
              Updating…
            </span>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => void initialLoad()}
          >
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
          {loadError}
          <button
            type="button"
            className="ml-2 font-semibold underline-offset-2 hover:underline"
            onClick={() => void loadDocs()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {retryMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          {retryMessage}
        </div>
      ) : null}

      {progress && progress.total > 0 ? (
        <section className="rounded-2xl border border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[var(--shadow-sm)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-slate-900">Uploaded files overview</h2>
            <p className="text-[12px] tabular-nums text-[var(--foreground-muted)]">
              {progress.total} file{progress.total === 1 ? "" : "s"} total
            </p>
          </div>
          <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Ready</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-950">{progress.ready}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">In progress</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-950">{progress.processing}</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50/40 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-900">Failed</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-red-950">{progress.failed}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>Indexed for answers</span>
              <span className="tabular-nums">
                {progress.ready}/{progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-[var(--brand-teal)] transition-[width] duration-500 ease-out"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {processingBanner ? (
        <div className="rounded-xl border border-sky-200/90 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 shadow-[var(--shadow-sm)]">
          <p className="font-semibold text-sky-950">{processingBanner.title}</p>
          <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed text-sky-900/90">
            {processingBanner.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {failedBanner ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-[var(--shadow-sm)]">
          <p className="font-semibold">{failedBanner.title}</p>
          <p className="mt-1 leading-relaxed text-amber-900/90">{failedBanner.body}</p>
        </div>
      ) : null}

      {!hasFileStatus && !loadError ? (
        <p className="text-[13px] text-[var(--foreground-muted)]">Loading file status…</p>
      ) : null}

      {hasFileStatus && data ? (
        <>
          <section
            id="files"
            className="scroll-mt-24 rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6"
          >
            <h2 className="text-[15px] font-semibold text-slate-900">Uploaded files (indexed)</h2>
            <p className={`${trialFieldHintClass} mt-1`}>From when you created this agent. New uploads from setup do not apply here until we add full document management.</p>
            {data.documents.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--foreground-muted)]">No documents were attached at agent creation.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {data.documents.map((d) => {
                  const st = docStatusLabel(d.status);
                  const failed = (d.status ?? "").toLowerCase() === "failed";
                  const friendly = failed ? friendlyKnowledgeDocumentMessage(d.error) : null;
                  return (
                    <li
                      key={d.id}
                      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{d.title || d.fileName || "Document"}</p>
                        {failed && friendly ? (
                          <div className="mt-2 text-[13px] leading-relaxed text-slate-700">
                            <p className="font-medium text-slate-900">{friendly.title}</p>
                            {friendly.detail ? <p className="mt-1 text-slate-600">{friendly.detail}</p> : null}
                          </div>
                        ) : null}
                        {!failed && d.error ? (
                          <p className="mt-1 text-[12px] text-amber-800">{d.error}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <span
                          className={`inline-flex w-fit self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset sm:self-end ${st.className}`}
                        >
                          {st.label}
                        </span>
                        {failed ? (
                          <button
                            type="button"
                            disabled={retryingDocId === d.id}
                            className="rounded-lg bg-[var(--brand-teal)] px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void onRetryDocument(d.id)}
                          >
                            {retryingDocId === d.id ? "Retrying…" : "Retry"}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {hasWorkspaceKnowledge ? (
        <>
          <section
            id="notes"
            className="scroll-mt-24 rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6"
          >
            <h2 className="text-[15px] font-semibold text-slate-900">Notes (agent knowledge)</h2>
            <p className={`${trialFieldHintClass} mt-1`}>
              Plain text your agent can retrieve. Max {TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS.toLocaleString()} characters.
            </p>
            <label className={`${trialFieldLabelClass} mt-3 sr-only`} htmlFor="tw-k-notes">
              Notes
            </label>
            <textarea
              id="tw-k-notes"
              className={trialFieldTextareaClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS))}
              rows={10}
              maxLength={TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS}
            />
            <p className="mt-1 text-[11px] tabular-nums text-slate-500">
              {notes.length.toLocaleString()} / {TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS.toLocaleString()}
            </p>
          </section>

          <section
            id="faqs"
            className="scroll-mt-24 rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6"
          >
            <h2 className="text-[15px] font-semibold text-slate-900">Q&amp;A (agent knowledge)</h2>
            <p className={`${trialFieldHintClass} mt-1`}>Each pair is embedded for retrieval. Use Save below to persist.</p>
            <div className="mt-4">
              <TrialFaqEditor items={faqItems} onChange={setFaqItems} />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={knowledgeSaving}
              className="rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {knowledgeSaving ? "Saving…" : "Save notes & Q&A"}
            </button>
            <Link
              href="/trial/dashboard/playground/behavior"
              className="text-[13px] font-semibold text-[var(--brand-teal-dark)] underline-offset-2 hover:underline"
            >
              ← Behavior
            </Link>
            <Link
              href="/trial/dashboard/playground/profile"
              className="text-[13px] font-semibold text-[var(--brand-teal-dark)] underline-offset-2 hover:underline"
            >
              Profile
            </Link>
          </div>
        </>
      ) : null}
      </form>
    </TrialEditorPane>
  );
}
