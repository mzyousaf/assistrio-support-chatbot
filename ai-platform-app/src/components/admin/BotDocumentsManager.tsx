"use client";

import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

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
}

interface BotDocumentsManagerProps {
  botId: string;
  documents: BotDocumentItem[];
}

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md", "markdown"]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_BATCH_FILES = 5;

function formatSize(bytes?: number): string {
  if (typeof bytes !== "number") return "-";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts[parts.length - 1] || "").toLowerCase() : "";
}

function isLegacyDocWithoutText(doc: BotDocumentItem): boolean {
  const extension = getExtension(doc.fileName || "");
  return !doc.hasText && (extension === "doc" || doc.fileType === "application/msword");
}

function getStatusMeta(status?: BotDocumentItem["status"]): {
  label: string;
  className: string;
} {
  if (status === "processing") {
    return {
      label: "Processing",
      className: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    };
  }
  if (status === "ready") {
    return {
      label: "Ready",
      className: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      className: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    };
  }
  return {
    label: "Queued",
    className: "border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300",
  };
}

function truncateMessage(input?: string, max = 120): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export default function BotDocumentsManager({ botId, documents }: BotDocumentsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BotDocumentItem[]>(documents);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningJobs, setIsRunningJobs] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadMessages, setUploadMessages] = useState<string[]>([]);
  const [jobRunMessage, setJobRunMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chunkCounts, setChunkCounts] = useState<Record<string, number | "loading">>({});

  const disabled = !botId || isUploading;
  const failedDocs = items.filter((doc) => doc.status === "failed");

  async function refreshDocuments() {
    if (!botId) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = (await response.json()) as { documents?: BotDocumentItem[] };
      setItems(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      setError("Failed to load documents.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setItems(documents);
  }, [documents]);

  useEffect(() => {
    if (!botId) return;
    void refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  function applyFiles(candidateFiles: File[]) {
    setError(null);
    if (!botId) {
      setError("Create the bot first. After saving, you can upload documents here.");
      return;
    }
    if (candidateFiles.length > MAX_BATCH_FILES) {
      setError("You can upload up to 5 files at a time.");
      return;
    }
    const invalidType = candidateFiles.find((file) => !ALLOWED_EXTENSIONS.has(getExtension(file.name)));
    if (invalidType) {
      setError("Only PDF, DOC, DOCX, and TXT files are allowed.");
      return;
    }
    const invalidSize = candidateFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (invalidSize) {
      setError(`Each file must be 15MB or less. "${invalidSize.name}" is too large.`);
      return;
    }
    setSelectedFiles(candidateFiles);
  }

  async function handleUpload() {
    if (!botId || selectedFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    setError(null);
    setJobRunMessage(null);
    setUploadMessages([]);
    try {
      const nextUploadMessages: string[] = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);
        // Single doc upload endpoint: creates Document (queued) + IngestJob. apiFetch sends credentials.
        const response = await apiFetch(`/api/super-admin/bots/${botId}/upload-doc`, {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          documentId?: string;
          documentStatus?: "queued" | "processing" | "ready" | "failed";
          ingestJobId?: string;
          ingestJobStatus?: "queued" | "processing" | "done" | "failed";
          s3Key?: string;
          originalName?: string;
          error?: string;
        };
        if (!response.ok) {
          nextUploadMessages.push(`${file.name}: failed (${data.error || "upload_failed"})`);
          continue;
        }
        const docStatus = data.documentStatus ?? "queued";
        const jobStatus = data.ingestJobStatus ?? "queued";
        nextUploadMessages.push(
          `${file.name}: doc ${docStatus}, job ${jobStatus}${data.ingestJobId ? ` (job ${data.ingestJobId})` : ""}`,
        );
      }
      setUploadMessages(nextUploadMessages);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refreshDocuments();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
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
        headers: {
          "Content-Type": "application/json",
        },
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
      const msg = `processed ${processed}, failed ${data.failed ?? 0}${data.claimedJobId ? ` (job ${data.claimedJobId})` : ""}${data.finalDocStatus ? `, doc ${data.finalDocStatus}` : ""}`;
      setJobRunMessage(msg);
      await refreshDocuments();
    } catch {
      setError("Process pending jobs failed (network error).");
    } finally {
      setIsRunningJobs(false);
    }
  }

  async function fetchChunksCount(docId: string) {
    setChunkCounts((prev) => ({ ...prev, [docId]: "loading" as const }));
    try {
      const res = await apiFetch(`/api/super-admin/documents/${docId}/chunks-count`);
      const data = (await res.json().catch(() => ({}))) as { count?: number };
      const count = res.ok && typeof data.count === "number" ? data.count : 0;
      setChunkCounts((prev) => ({ ...prev, [docId]: count }));
    } catch {
      setChunkCounts((prev) => ({ ...prev, [docId]: 0 }));
    }
  }

  async function handleDelete(docId: string) {
    if (!botId || deletingId) return;
    setDeletingId(docId);
    setError(null);
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      await refreshDocuments();
    } catch {
      setError("Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRetryDoc(docId: string) {
    if (!botId || retryingId || isRetryingAll) return;
    setRetryingId(docId);
    setError(null);
    setJobRunMessage(null);
    try {
      const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}/embed`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
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

  async function handleRetryAllFailed() {
    if (!botId || isRetryingAll || failedDocs.length < 2) return;
    setIsRetryingAll(true);
    setError(null);
    setJobRunMessage(null);
    let retried = 0;
    try {
      for (const doc of failedDocs) {
        const response = await apiFetch(`/api/super-admin/bots/${botId}/documents/${doc._id}/embed`, {
          method: "POST",
        });
        if (response.ok) {
          retried += 1;
        }
      }
      setJobRunMessage(`retried ${retried} docs`);
      await refreshDocuments();
    } catch {
      setError("Retry all failed docs encountered a network error.");
      await refreshDocuments();
    } finally {
      setIsRetryingAll(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Documents</h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Upload PDF, DOC, DOCX, or TXT to build the bot&apos;s knowledge base. Uploads are queued for ingestion.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.markdown"
        className="hidden"
        onChange={(event) => applyFiles(Array.from(event.target.files ?? []))}
      />

      <div
        className={`relative rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
          disabled
            ? "cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500"
            : dragOver
              ? "cursor-pointer border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/20 scale-[1.01]"
              : "cursor-pointer border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50/50 dark:hover:bg-brand-900/10"
        }`}
        onClick={() => {
          if (!disabled) fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragOver(false);
          applyFiles(Array.from(event.dataTransfer.files ?? []));
        }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Drag &amp; drop files here, or <span className="text-brand-600 dark:text-brand-400 underline underline-offset-2">browse</span>
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          PDF, DOC, DOCX, TXT · Max 5 files, 15MB each
        </p>
      </div>

      {selectedFiles.length > 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Selected for upload</p>
          <ul className="space-y-2">
            {selectedFiles.map((file, fileIndex) => (
              <li
                key={fileIndex}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">{file.name}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    onClick={() =>
                      setSelectedFiles((prev) =>
                        prev.filter((item) => item !== file),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={disabled || selectedFiles.length === 0}
          onClick={handleUpload}
        >
          {isUploading ? "Uploading…" : "Upload selected files"}
        </Button>
        <Button type="button" variant="secondary" disabled={!botId || isLoading} onClick={() => void refreshDocuments()}>
          {isLoading ? "Refreshing…" : "Refresh"}
        </Button>
        <Button type="button" variant="secondary" disabled={!botId || isRunningJobs} onClick={() => void handleRunJobs()}>
          {isRunningJobs ? "Processing…" : "Process pending jobs"}
        </Button>
        {failedDocs.length >= 2 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={!botId || isRetryingAll || isRunningJobs}
            onClick={() => void handleRetryAllFailed()}
          >
            {isRetryingAll ? "Retrying…" : "Retry all failed"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {jobRunMessage ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{jobRunMessage}</p> : null}
      {uploadMessages.length > 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Recent uploads</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {uploadMessages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Title</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">File</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Size</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Chunks</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Added</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
              {items.map((doc) => (
                <tr key={doc._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{doc.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{doc.fileName || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatSize(doc.fileSize)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {(() => {
                        const statusMeta = getStatusMeta(doc.status);
                        return (
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        );
                      })()}
                      <p className="text-xs text-gray-500 dark:text-gray-400">{doc.textLength ?? 0} chars</p>
                      {isLegacyDocWithoutText(doc) ? (
                        <span className="inline-flex rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          DOC needs conversion
                        </span>
                      ) : null}
                      {doc.status === "failed" && doc.error ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{truncateMessage(doc.error)}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {chunkCounts[doc._id] === "loading" ? (
                      <span className="text-xs text-gray-400">…</span>
                    ) : typeof chunkCounts[doc._id] === "number" ? (
                      <span className="text-xs text-gray-600 dark:text-gray-400">{chunkCounts[doc._id]} chunks</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void fetchChunksCount(doc._id)}
                      >
                        <span className="text-xs">Count</span>
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(doc.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={doc.status !== "failed" || retryingId === doc._id || isRetryingAll}
                        onClick={() => void handleRetryDoc(doc._id)}
                      >
                        {retryingId === doc._id ? "Retrying…" : "Retry"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === doc._id}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        onClick={() => handleDelete(doc._id)}
                      >
                        {deletingId === doc._id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No documents yet</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Upload files above to get started.</p>
        </div>
      )}
    </section>
  );
}
