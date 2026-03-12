"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { SettingsSectionCard } from "@/components/admin/settings/SettingsSectionCard";
import { SettingsSideSheet } from "@/components/admin/settings/SettingsSideSheet";
import {
  DocumentsSummaryCards,
  DocumentsToolbar,
  DocumentsTable,
  DocumentsEmptyUploadState,
  DocumentsHeaderActions,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  getExtension,
  formatSize,
} from "@/components/admin/documents";

export interface BotDocumentItem {
  _id: string;
  title: string;
  sourceType: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  status?: "queued" | "processing" | "ready" | "failed";
  error?: string;
  ingestedAt?: string;
  hasText?: boolean;
  textLength?: number;
  createdAt?: string;
  /** When false, document is excluded from knowledge base. Default true. */
  active?: boolean;
}

export type DocumentsManagerHealth = {
  lastIngestedAt?: string;
  lastFailedDoc?: { docId: string; title: string; error?: string; updatedAt?: string };
};

interface BotDocumentsManagerProps {
  botId: string;
  documents: BotDocumentItem[];
  health?: DocumentsManagerHealth;
  /** When provided, called when document upload starts (true) or ends (false). Used to show header "Saving" state. */
  onUploadingChange?: (uploading: boolean) => void;
  /** When true, poll documents list on an interval (e.g. when knowledge base tab is active). */
  pollWhenActive?: boolean;
}

const POLL_INTERVAL_MS = 5000;

export default function BotDocumentsManager({ botId, documents, health, onUploadingChange, pollWhenActive }: BotDocumentsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BotDocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [counts, setCounts] = useState({ total: 0, queued: 0, processing: 0, ready: 0, failed: 0 });
  const [lastIngestedAt, setLastIngestedAt] = useState<string | undefined>(health?.lastIngestedAt);
  const [latestFailed, setLatestFailed] = useState<DocumentsManagerHealth["lastFailedDoc"]>(health?.lastFailedDoc);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningJobs, setIsRunningJobs] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [forceProcessingId, setForceProcessingId] = useState<string | null>(null);
  const [jobRunMessage, setJobRunMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<"all" | "queued" | "processing" | "ready" | "failed">("all");
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploadBackgroundAlert, setUploadBackgroundAlert] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  const disabled = !botId || isUploading;
  const failedDocs = items.filter((doc) => doc.status === "failed");
  const isEmpty = total === 0;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const filteredTableItems =
    tableFilter === "all" ? items : items.filter((doc) => (doc.status ?? "queued") === tableFilter);

  async function refreshDocuments() {
    if (!botId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await apiFetch(
        `/api/super-admin/bots/${botId}/documents?${params.toString()}`,
        { method: "GET" },
      );
      if (!response.ok) throw new Error("Failed to fetch documents");
      const data = (await response.json()) as {
        documents?: BotDocumentItem[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        counts?: { total: number; queued: number; processing: number; ready: number; failed: number };
        lastIngestedAt?: string;
        lastFailedDoc?: DocumentsManagerHealth["lastFailedDoc"];
      };
      setItems(Array.isArray(data.documents) ? data.documents : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      if (data.counts) {
        setCounts({
          total: data.counts.total ?? 0,
          queued: data.counts.queued ?? 0,
          processing: data.counts.processing ?? 0,
          ready: data.counts.ready ?? 0,
          failed: data.counts.failed ?? 0,
        });
      }
      if (data.lastIngestedAt !== undefined) setLastIngestedAt(data.lastIngestedAt);
      if (data.lastFailedDoc !== undefined) setLatestFailed(data.lastFailedDoc);
    } catch {
      // Silent retry: do not show error; polling or next refetch will retry
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!botId) return;
    void refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, page, limit]);

  useEffect(() => {
    if (!botId || !pollWhenActive) return;
    const id = setInterval(() => void refreshDocuments(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, pollWhenActive, page, limit]);

  useEffect(() => {
    if (!uploadBackgroundAlert) return;
    const t = setTimeout(() => setUploadBackgroundAlert(null), 5000);
    return () => clearTimeout(t);
  }, [uploadBackgroundAlert]);

  function applyFiles(candidateFiles: File[]) {
    setError(null);
    if (!botId) {
      setError("Create the bot first. After saving, you can upload documents here.");
      return;
    }
    const invalidType = candidateFiles.find((file) => !ALLOWED_EXTENSIONS.has(getExtension(file.name)));
    if (invalidType) {
      setError("Only .md, .txt, .pdf, .docx, and .doc files are allowed.");
      return;
    }
    const invalidSize = candidateFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (invalidSize) {
      setError(`Each file must be 5MB or less. "${invalidSize.name}" is too large.`);
      return;
    }
    setSelectedFiles(candidateFiles);
    setUploadPanelOpen(true);
  }

  async function handleUpload() {
    if (!botId || selectedFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    onUploadingChange?.(true);
    setError(null);
    setJobRunMessage(null);
    try {
      const formData = new FormData();
      formData.append("botId", botId);
      for (const file of selectedFiles) {
        formData.append("file", file);
      }
      const response = await apiFetch("/api/super-admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        results?: Array<{
          type: string;
          originalName?: string;
          documentStatus?: string;
          ingestJobStatus?: string;
          ingestJobId?: string;
        }>;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      setSelectedFiles([]);
      setUploadPanelOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshDocuments();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
    }
  }

  function closeUploadPanel() {
    if (isUploading) {
      setUploadPanelOpen(false);
      setUploadBackgroundAlert("Files are uploading in the background.");
    } else {
      setUploadPanelOpen(false);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRunJobs() {
    if (!botId || isRunningJobs) return;
    setIsRunningJobs(true);
    setError(null);
    setJobRunMessage(null);
    try {
      const response = await apiFetch("/api/super-admin/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        processed?: number;
        processedCount?: number;
        failed?: number;
        claimedJobId?: string;
        finalDocStatus?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(`Process pending jobs failed (${data.error || "request_failed"}).`);
        return;
      }
      const processed = data.processedCount ?? data.processed ?? 0;
      setJobRunMessage(
        `Processed ${processed}, failed ${data.failed ?? 0}${data.claimedJobId ? ` (job ${data.claimedJobId})` : ""}${data.finalDocStatus ? `, doc ${data.finalDocStatus}` : ""}`,
      );
      await refreshDocuments();
    } catch {
      setError("Process pending jobs failed (network error).");
    } finally {
      setIsRunningJobs(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!botId) return;
    setDeletingIds((prev) => new Set(prev).add(docId));
    setError(null);
    const wasOnlyItemOnPage = items.length === 1 && page > 1;
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      if (wasOnlyItemOnPage) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await refreshDocuments();
      }
    } catch {
      setError("Delete failed. Please try again.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  async function handleBulkDelete(docIds: string[]) {
    if (!botId || docIds.length === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docIds }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; deleted?: number; error?: string };
      if (!response.ok) {
        setError(data.error || "Bulk delete failed.");
        return;
      }
      setSelectedDocIds([]);
      const wasOnLastPage = items.length === docIds.length && page > 1;
      if (wasOnLastPage) setPage((p) => Math.max(1, p - 1));
      await refreshDocuments();
    } catch {
      setError("Bulk delete failed. Please try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleSetActive(docId: string, active: boolean) {
    if (!botId || togglingActiveId) return;
    setTogglingActiveId(docId);
    setError(null);
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Update failed.");
        return;
      }
      await refreshDocuments();
    } catch {
      setError("Update failed. Please try again.");
    } finally {
      setTogglingActiveId(null);
    }
  }

  async function handleRetryDoc(docId: string) {
    if (!botId || retryingId || isRetryingAll) return;
    setRetryingId(docId);
    setError(null);
    setJobRunMessage(null);
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}/embed`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(`Retry failed (${data.error || "request_failed"}).`);
        return;
      }
      setJobRunMessage("Retry queued for document.");
      await refreshDocuments();
    } catch {
      setError("Retry failed (network error).");
    } finally {
      setRetryingId(null);
    }
  }

  async function handleForceProcess(docId: string) {
    if (!botId || forceProcessingId) return;
    setForceProcessingId(docId);
    setError(null);
    setJobRunMessage(null);
    try {
      const embedRes = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}/embed`, { method: "POST" });
      const embedData = (await embedRes.json().catch(() => ({}))) as { error?: string };
      if (!embedRes.ok) {
        setError(`Force process failed (${embedData.error || "request_failed"}).`);
        return;
      }
      const runRes = await apiFetch("/api/super-admin/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      });
      if (!runRes.ok) {
        const runData = (await runRes.json().catch(() => ({}))) as { error?: string };
        setError(`Process job failed (${runData.error || "request_failed"}).`);
      }
      await refreshDocuments();
    } catch {
      setError("Force process failed (network error).");
    } finally {
      setForceProcessingId(null);
    }
  }

  async function handleRetryAllFailed() {
    if (!botId || isRetryingAll || failedDocs.length < 1) return;
    setIsRetryingAll(true);
    setError(null);
    setJobRunMessage(null);
    let retried = 0;
    try {
      for (const doc of failedDocs) {
        const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${doc._id}/embed`, {
          method: "POST",
        });
        if (response.ok) retried += 1;
      }
      setJobRunMessage(`Retried ${retried} docs`);
      await refreshDocuments();
    } catch {
      setError("Retry all failed docs encountered a network error.");
      await refreshDocuments();
    } finally {
      setIsRetryingAll(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) applyFiles(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".docx,.pdf,.doc,.md,.txt"
        className="hidden"
        onChange={(e) => applyFiles(Array.from(e.target.files ?? []))}
      />

      <SettingsSectionCard
        title="Documents"
        description="Upload files and monitor their processing status for this bot's knowledge base."
        headerAction={
          <DocumentsHeaderActions
            disabled={disabled}
            isRetryingAll={isRetryingAll}
            failedCount={counts.failed}
            onAddFilesClick={openFilePicker}
            onRetryAllFailed={handleRetryAllFailed}
          />
        }
      >
        <div className="flex flex-col gap-8">
          <section aria-label="Document processing summary">
            <DocumentsSummaryCards counts={counts} />
          </section>

          <DocumentsEmptyUploadState
            disabled={disabled}
            dragOver={dragOver}
            selectedFiles={selectedFiles}
            isUploading={isUploading}
            onZoneClick={openFilePicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onUpload={handleUpload}
            onRemoveFile={(file) => setSelectedFiles((prev) => prev.filter((f) => f !== file))}
            error={error}
            showSelectedInline={false}
          />

          <DocumentsToolbar
            disabled={disabled}
            selectedFiles={selectedFiles}
            isUploading={isUploading}
            isRetryingAll={isRetryingAll}
            failedCount={counts.failed}
            dragOver={dragOver}
            onAddFilesClick={openFilePicker}
            onUpload={handleUpload}
            onRemoveFile={(file) => setSelectedFiles((prev) => prev.filter((f) => f !== file))}
            onRetryAllFailed={handleRetryAllFailed}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            buttonsInHeader
          />

          {!isEmpty ? (
            <>

              {(error || jobRunMessage) ? (
                <div className="flex flex-col gap-3">
                  {error ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {error}
                    </p>
                  ) : null}
                  {jobRunMessage ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                      {jobRunMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <section aria-label="Document list" className="pt-1">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Filter:</span>
                    {(["all", "queued", "processing", "ready", "failed"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setTableFilter(status)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${tableFilter === status
                            ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                      >
                        {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>Per page</span>
                      <select
                        value={limit}
                        onChange={(e) => {
                          setLimit(Number(e.target.value));
                          setPage(1);
                        }}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {[10, 25, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {start}–{end} of {total}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={page <= 1 || isLoading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-8 w-8 p-0"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[4rem] text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={page >= totalPages || isLoading}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 w-8 p-0"
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DocumentsTable
                  botId={botId}
                  items={filteredTableItems}
                  selectedDocIds={selectedDocIds}
                  onSelectionChange={setSelectedDocIds}
                  deletingIds={deletingIds}
                  retryingId={retryingId}
                  forceProcessingId={forceProcessingId}
                  isRetryingAll={isRetryingAll}
                  bulkDeleting={bulkDeleting}
                  togglingActiveId={togglingActiveId}
                  onRetry={handleRetryDoc}
                  onDelete={handleDelete}
                  onForceProcess={handleForceProcess}
                  onBulkDelete={handleBulkDelete}
                  onSetActive={handleSetActive}
                />
              </section>
            </>
          ) : null}
        </div>
      </SettingsSectionCard>

      {uploadBackgroundAlert ? (
        <div
          role="alert"
          className="fixed top-4 right-4 z-[100] max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
        >
          {uploadBackgroundAlert}
        </div>
      ) : null}

      <SettingsSideSheet
        open={uploadPanelOpen}
        onClose={closeUploadPanel}
        title="Review uploads"
        description="Upload these files or cancel to clear the selection."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeUploadPanel}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || selectedFiles.length === 0 || isUploading}
              onClick={() => void handleUpload()}
            >
              {isUploading ? "Uploading…" : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {selectedFiles.map((file, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                {file.name}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  onClick={() => {
                    setSelectedFiles((prev) => prev.filter((f) => f !== file));
                    if (selectedFiles.length <= 1) setUploadPanelOpen(false);
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SettingsSideSheet>
    </>
  );
}
