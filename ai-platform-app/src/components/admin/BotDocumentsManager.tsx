"use client";

import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

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

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);
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
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (status === "ready") {
    return {
      label: "Ready",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  return {
    label: "Queued",
    className: "border-gray-200 bg-gray-100 text-gray-700",
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

  const disabled = !botId || isUploading;
  const failedDocs = items.filter((doc) => doc.status === "failed");

  async function refreshDocuments() {
    if (!botId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/super-admin/bots/${botId}/documents`, {
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
        const response = await fetch(`/api/super-admin/bots/${botId}/upload-doc`, {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => ({}))) as {
          docId?: string;
          jobId?: string;
          status?: string;
          error?: string;
        };
        if (!response.ok) {
          nextUploadMessages.push(`${file.name}: failed (${data.error || "upload_failed"})`);
          continue;
        }
        nextUploadMessages.push(
          `${file.name}: queued (${data.status || "queued"})${data.jobId ? `, job ${data.jobId}` : ""}`,
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
      const response = await fetch("/api/super-admin/jobs/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 3 }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        processed?: number;
        failed?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(`Process pending jobs failed (${data.error || "request_failed"}).`);
        return;
      }
      setJobRunMessage(`processed ${data.processed ?? 0}, failed ${data.failed ?? 0}`);
      await refreshDocuments();
    } catch {
      setError("Process pending jobs failed (network error).");
    } finally {
      setIsRunningJobs(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!botId || deletingId) return;
    setDeletingId(docId);
    setError(null);
    try {
      const response = await fetch(`/api/super-admin/bots/${botId}/documents/${docId}`, {
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
      const response = await fetch(`/api/super-admin/bots/${botId}/documents/${docId}/embed`, {
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
        const response = await fetch(`/api/super-admin/bots/${botId}/documents/${doc._id}/embed`, {
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
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
        <p className="text-xs text-gray-500">
          Upload PDFs/DOCs/TXTs to build the bot&apos;s knowledge base.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Uploads are queued for background ingestion. Use Process pending jobs to run queued work.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(event) => applyFiles(Array.from(event.target.files ?? []))}
      />

      <div
        className={`rounded-xl border border-dashed px-4 py-5 text-center transition ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
            : dragOver
              ? "cursor-pointer border-brand-500 bg-brand-50"
              : "cursor-pointer border-gray-300 bg-white hover:border-brand-400"
        }`}
        onClick={() => {
          if (!disabled) fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
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
        <p className="text-sm text-gray-700">
          Drag &amp; drop files here, or{" "}
          <span className="text-brand-600 underline underline-offset-4">browse</span>.
        </p>
        <p className="mt-1 text-xs text-gray-500">Allowed: PDF, DOC, DOCX, TXT. Max 5 files, 15MB each.</p>
      </div>

      {selectedFiles.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium text-gray-700">Selected files</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {selectedFiles.map((file) => (
              <li
                key={`${file.name}-${file.lastModified}-${file.size}`}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-2 py-1"
              >
                <span className="truncate">{file.name}</span>
                <div className="flex items-center gap-2">
                  <span>{formatSize(file.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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

      <div className="flex justify-end">
        {failedDocs.length >= 2 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={!botId || isRetryingAll || isRunningJobs}
            onClick={() => void handleRetryAllFailed()}
          >
            {isRetryingAll ? "Retrying failed..." : "Retry all failed"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" disabled={!botId || isLoading} onClick={() => void refreshDocuments()}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
        <Button type="button" variant="ghost" disabled={!botId || isRunningJobs} onClick={() => void handleRunJobs()}>
          {isRunningJobs ? "Processing..." : "Process pending jobs"}
        </Button>
        <Button type="button" disabled={disabled || selectedFiles.length === 0} onClick={handleUpload}>
          {isUploading ? "Uploading..." : "Upload selected files"}
        </Button>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      {jobRunMessage ? <p className="text-xs text-emerald-600">{jobRunMessage}</p> : null}
      {uploadMessages.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-700">Recent upload results</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {uploadMessages.map((message, index) => (
              <li key={`${index}-${message}`}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Added</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {items.map((doc) => (
                <tr key={doc._id}>
                  <td className="px-3 py-2">{doc.title}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{doc.fileName || "-"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatSize(doc.fileSize)}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const statusMeta = getStatusMeta(doc.status);
                      return (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      );
                    })()}
                    <p className="mt-1 text-[11px] text-gray-500">{doc.textLength ?? 0} chars</p>
                    {isLegacyDocWithoutText(doc) ? (
                      <p className="mt-1">
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          DOC needs conversion
                        </span>
                      </p>
                    ) : null}
                    {doc.status === "failed" && doc.error ? (
                      <p className="mt-1 text-[11px] text-red-600">{truncateMessage(doc.error)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDate(doc.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={doc.status !== "failed" || retryingId === doc._id || isRetryingAll}
                        onClick={() => void handleRetryDoc(doc._id)}
                      >
                        {retryingId === doc._id ? "Retrying..." : "Retry"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === doc._id}
                        onClick={() => handleDelete(doc._id)}
                      >
                        {deletingId === doc._id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No documents uploaded yet.</p>
      )}
    </section>
  );
}
