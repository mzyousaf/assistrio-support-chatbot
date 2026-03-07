"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";

type BotDocumentsSectionProps = {
  botId: string;
  documents: {
    _id: string;
    title: string;
    sourceType: string;
    fileName?: string;
    fileSize?: number;
    createdAt: string;
  }[];
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

export default function BotDocumentsSection({ botId, documents }: BotDocumentsSectionProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || uploading) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      const response = await apiFetch(`/api/super-admin/bots/${botId}/upload-doc`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setError("Failed to upload document.");
        return;
      }

      setFile(null);
      setTitle("");
      router.refresh();
    } catch {
      setError("Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Documents attached to this bot. These will be used for RAG.
      </p>

      {documents.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Source type</th>
                <th className="px-3 py-2 font-medium">File name</th>
                <th className="px-3 py-2 font-medium">File size (KB)</th>
                <th className="px-3 py-2 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {documents.map((doc) => (
                <tr key={doc._id}>
                  <td className="px-3 py-2">{doc.title}</td>
                  <td className="px-3 py-2">{doc.sourceType}</td>
                  <td className="px-3 py-2">{doc.fileName || "-"}</td>
                  <td className="px-3 py-2">
                    {typeof doc.fileSize === "number" ? (doc.fileSize / 1024).toFixed(0) : "-"}
                  </td>
                  <td className="px-3 py-2">{formatDate(doc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No documents attached yet.</p>
      )}

      <form className="space-y-3 rounded-xl border border-slate-800 p-4" onSubmit={handleSubmit}>
        <label className="space-y-1 block">
          <span className="text-sm text-slate-200">Document title (optional)</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fallback is file name"
            type="text"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-sm text-slate-200">Upload file</span>
          <Input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={uploading || !file}>
            {uploading ? "Uploading..." : "Upload document"}
          </Button>
        </div>
      </form>
    </div>
  );
}
