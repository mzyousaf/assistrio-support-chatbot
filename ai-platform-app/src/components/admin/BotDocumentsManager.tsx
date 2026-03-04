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

function formatReason(reason?: string): string {
  if (!reason) return "";
  if (reason === "doc_extract_unavailable") {
    return "This .doc file couldn't be extracted. Please convert it to .docx and upload again.";
  }
  return reason;
}

function isLegacyDocWithoutText(doc: BotDocumentItem): boolean {
  const extension = getExtension(doc.fileName || "");
  return !doc.hasText && (extension === "doc" || doc.fileType === "application/msword");
}

export default function BotDocumentsManager({ botId, documents }: BotDocumentsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BotDocumentItem[]>(documents);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [embeddingId, setEmbeddingId] = useState<string | null>(null);
  const [embedMessages, setEmbedMessages] = useState<Record<string, string>>({});
  const [uploadMessages, setUploadMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const disabled = !botId || isUploading;

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
          extracted?: boolean;
          embedded?: boolean;
          chunkCount?: number;
          reason?: string;
          error?: string;
        };
        if (!response.ok) {
          nextUploadMessages.push(`${file.name}: failed (${data.error || "upload_failed"})`);
          continue;
        }
        const reasonSuffix = data.reason ? `, reason: ${formatReason(data.reason)}` : "";
        nextUploadMessages.push(
          `${file.name}: extracted=${data.extracted ? "yes" : "no"}, embedded=${data.embedded ? "yes" : "no"}, chunks=${data.chunkCount ?? 0}${reasonSuffix}`,
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

  async function handleEmbedNow(docId: string) {
    if (!botId || embeddingId) return;
    setEmbeddingId(docId);
    setError(null);
    try {
      const response = await fetch(`/api/super-admin/bots/${botId}/documents/${docId}/embed`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        extracted?: boolean;
        embedded?: boolean;
        chunkCount?: number;
        reason?: string;
        error?: string;
      };
      if (!response.ok) {
        setEmbedMessages((prev) => ({
          ...prev,
          [docId]: `Embed failed (${data.error || "request_failed"}).`,
        }));
        return;
      }
      const reasonSuffix = data.reason ? `, reason: ${formatReason(data.reason)}` : "";
      setEmbedMessages((prev) => ({
        ...prev,
        [docId]: `extracted=${data.extracted ? "yes" : "no"}, embedded=${data.embedded ? "yes" : "no"}, chunks=${data.chunkCount ?? 0}${reasonSuffix}`,
      }));
      await refreshDocuments();
    } catch {
      setEmbedMessages((prev) => ({ ...prev, [docId]: "Embed failed (network error)." }));
    } finally {
      setEmbeddingId(null);
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

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
        <p className="text-xs text-gray-500">
          Upload PDFs/DOCs/TXTs to build the bot&apos;s knowledge base.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Large files may skip auto-embedding; use Embed now after trimming.
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
        <Button type="button" variant="ghost" disabled={!botId || isLoading} onClick={() => void refreshDocuments()}>
          {isLoading ? "Refreshing..." : "Refresh documents"}
        </Button>
        <Button type="button" disabled={disabled || selectedFiles.length === 0} onClick={handleUpload}>
          {isUploading ? "Uploading..." : "Upload selected files"}
        </Button>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
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
                    {doc.hasText ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Text extracted
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        No text
                      </span>
                    )}
                    <p className="mt-1 text-[11px] text-gray-500">{doc.textLength ?? 0} chars</p>
                    {isLegacyDocWithoutText(doc) ? (
                      <p className="mt-1">
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          DOC needs conversion
                        </span>
                      </p>
                    ) : null}
                    {embedMessages[doc._id] ? (
                      <p className="mt-1 text-[11px] text-gray-500">{embedMessages[doc._id]}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDate(doc.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={embeddingId === doc._id}
                        onClick={() => void handleEmbedNow(doc._id)}
                      >
                        {embeddingId === doc._id ? "Embedding..." : "Embed now"}
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
