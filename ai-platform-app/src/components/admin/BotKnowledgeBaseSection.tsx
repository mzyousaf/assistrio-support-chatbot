"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";

interface BotDocumentItem {
  _id: string;
  title: string;
  sourceType: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt?: string;
}

interface BotKnowledgeBaseSectionProps {
  botId: string;
  documents: BotDocumentItem[];
}

export default function BotKnowledgeBaseSection({
  botId,
  documents,
}: BotKnowledgeBaseSectionProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload() {
    if (!selectedFiles.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);

        const res = await apiFetch(`/api/super-admin/bots/${botId}/upload-doc`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Upload failed");
        }
      }
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    setError(null);
    try {
      const res = await apiFetch(`/api/super-admin/bots/${botId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      router.refresh();
    } catch {
      setError("Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card title="Knowledge base">
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          Upload documents for this bot. These will be used as retrievable knowledge for RAG.
        </p>

        <input
          type="file"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
        />

        <div
          className={`border border-dashed rounded-2xl px-4 py-6 text-center cursor-pointer transition ${
            dragOver
              ? "border-emerald-500/70 bg-slate-900/60"
              : "border-slate-700 bg-slate-950/60 hover:border-emerald-500/60"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            setSelectedFiles(Array.from(e.dataTransfer.files ?? []));
          }}
        >
          <p className="text-sm text-slate-300">
            Drag &amp; drop files here, or{" "}
            <span className="text-emerald-400 underline underline-offset-4">browse</span>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            PDFs, DOCs, and TXTs are recommended for now.
          </p>
        </div>

        {selectedFiles.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Selected files</p>
            <ul className="space-y-1 text-xs text-slate-300">
              {selectedFiles.map((file, fileIndex) => (
                <li
                  key={fileIndex}
                  className="flex items-center justify-between"
                >
                  <span className="truncate max-w-[240px]">{file.name}</span>
                  <span className="text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? "Uploading..." : "Upload selected files"}
          </Button>
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        {documents.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="text-left py-2 pr-2">Title</th>
                  <th className="text-left py-2 pr-2">File</th>
                  <th className="text-left py-2 pr-2">Size</th>
                  <th className="text-left py-2 pr-2">Added</th>
                  <th className="text-left py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc._id} className="border-b border-slate-900/60">
                    <td className="py-2 pr-2">{doc.title}</td>
                    <td className="py-2 pr-2 text-slate-400 text-[11px]">{doc.fileName ?? "—"}</td>
                    <td className="py-2 pr-2 text-[11px] text-slate-400">
                      {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : "—"}
                    </td>
                    <td className="py-2 pr-2 text-[11px] text-slate-400">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === doc._id}
                        onClick={() => handleDelete(doc._id)}
                      >
                        {deletingId === doc._id ? "Removing..." : "Remove"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            No documents attached yet. Upload PDFs, DOCs, or TXTs to use them as knowledge.
          </p>
        )}
      </div>
    </Card>
  );
}
