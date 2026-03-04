"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useVisitorId } from "@/hooks/useVisitorId";

type TrialCreateQueuedDoc = {
  docId: string;
  fileName?: string;
  status?: "queued" | "processing" | "ready" | "failed";
};

type TrialCreateBotResponse = {
  ok?: boolean;
  slug?: string;
  botId?: string;
  docs?: TrialCreateQueuedDoc[];
};

type TrialDocumentStatus = {
  docId: string;
  fileName?: string;
  status?: "queued" | "processing" | "ready" | "failed";
  error?: string;
  ingestedAt?: string;
};

function getStatusClass(status?: TrialDocumentStatus["status"]): string {
  if (status === "processing") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (status === "ready") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

function truncateError(input?: string, max = 120): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}...`;
}

export default function NewTrialBotPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [botName, setBotName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBot, setCreatedBot] = useState<{ botId: string; slug: string } | null>(null);
  const [processingDocs, setProcessingDocs] = useState<TrialDocumentStatus[]>([]);
  const [isPollingDocs, setIsPollingDocs] = useState(false);
  const [processingDone, setProcessingDone] = useState(false);
  const { visitorId, loading: visitorLoading } = useVisitorId();

  useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [botName, email, description, faqs, selectedFiles, error]);

  function handleFiles(files: File[]) {
    const allowedExtensions = [".pdf", ".doc", ".docx", ".txt"];
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    const filteredFiles = files.filter((file) => {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      return allowedExtensions.includes(extension) || allowedMimeTypes.includes(file.type);
    });

    setSelectedFiles((prev) => {
      const merged = [...prev];

      for (const file of filteredFiles) {
        const exists = merged.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        );

        if (!exists) {
          merged.push(file);
        }
      }

      return merged.slice(0, 3);
    });
  }

  function updateFaq(index: number, nextFaq: { question: string; answer: string }) {
    setFaqs((prev) => prev.map((faq, i) => (i === index ? nextFaq : faq)));
  }

  function removeFaq(index: number) {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  }

  async function fetchTrialDocStatuses(botId: string): Promise<TrialDocumentStatus[]> {
    const response = await fetch(
      `/api/trial/bots/${botId}/documents?visitorId=${encodeURIComponent(visitorId || "")}`,
      {
        method: "GET",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch trial document statuses");
    }
    const data = (await response.json()) as { documents?: TrialDocumentStatus[] };
    return Array.isArray(data.documents) ? data.documents : [];
  }

  useEffect(() => {
    if (!isPollingDocs || !createdBot) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const docs = await fetchTrialDocStatuses(createdBot.botId);
        if (cancelled) return;
        setProcessingDocs(docs);
        const allDone =
          docs.length > 0 &&
          docs.every((doc) => doc.status === "ready" || doc.status === "failed");
        if (allDone) {
          setIsPollingDocs(false);
          setProcessingDone(true);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to refresh document processing status.");
        }
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPollingDocs, createdBot, visitorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorId || submitting) return;
    if (!botName || !email) return;

    setSubmitting(true);
    setError(null);

    try {
      const filteredFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
      const faqsJson = JSON.stringify(filteredFaqs);
      const formData = new FormData();
      formData.append("botName", botName.trim());
      formData.append("email", email.trim());
      formData.append("description", description.trim());
      formData.append("visitorId", visitorId);
      formData.append("faqs", faqsJson);
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/trial/create-bot", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("Failed to create trial bot. Please try again.");
        return;
      }

      const data = (await res.json()) as TrialCreateBotResponse;
      const slug = data.slug;
      const botId = data.botId;
      const docs = Array.isArray(data.docs) ? data.docs : [];
      if (!slug || !botId) {
        setError("Trial bot was created, but the response was incomplete.");
        return;
      }

      if (docs.length > 0) {
        setCreatedBot({ botId, slug });
        setProcessingDocs(
          docs.map((doc) => ({
            docId: doc.docId,
            fileName: doc.fileName,
            status: doc.status || "queued",
          })),
        );
        setProcessingDone(false);
        setIsPollingDocs(true);
      } else {
        router.push(`/trial/${slug}?visitorId=${visitorId}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (visitorLoading || !visitorId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        Initializing your trial session...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">Create your trial bot</h1>
        <p className="text-slate-400 text-sm">
          Spin up a temporary bot and test it with your own data before committing to a full setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Bot basics">
          <div className="space-y-4">
            <label className="space-y-1 block">
              <span className="text-sm text-slate-200">Bot name</span>
              <Input
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="My Support Bot"
                required
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-sm text-slate-200">Email</span>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                required
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-sm text-slate-200">Description</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this trial bot should help users with."
                rows={4}
              />
            </label>
          </div>
        </Card>

        <Card title="Knowledge base (optional)">
          <p className="text-sm text-slate-400">
            Attach documents and FAQs this bot should know about. We&apos;ll use them for smarter
            answers.
          </p>

          <div
            className={`mt-3 border border-dashed rounded-2xl bg-slate-950/60 px-4 py-6 text-center cursor-pointer transition ${
              isDragOver
                ? "border-emerald-500/60"
                : "border-slate-700 hover:border-emerald-500/60"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const files = Array.from(e.dataTransfer.files);
              handleFiles(files);
            }}
          >
            <p className="text-sm text-slate-300">
              Drag &amp; drop PDF, DOC, or TXT files here, or{" "}
              <span className="text-emerald-400 underline underline-offset-4">browse</span>.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Max 3 files for trial, up to e.g. 5MB each (we&apos;ll enforce later).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => {
                handleFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-300 text-left">
              {selectedFiles.map((file) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between"
                >
                  <span className="truncate max-w-[220px]">{file.name}</span>
                  <span className="text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-200">FAQs</h3>
            <p className="text-xs text-slate-400 mt-1">
              Preload common questions and answers your bot should know.
            </p>

            {faqs.map((faq, index) => (
              <div key={index} className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <span className="text-xs text-slate-400">Question</span>
                  <Input
                    value={faq.question}
                    onChange={(e) => updateFaq(index, { ...faq, question: e.target.value })}
                    placeholder="e.g. What services do you offer?"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Answer</span>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(index, { ...faq, answer: e.target.value })}
                    rows={2}
                    placeholder="Short, clear answer."
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="text-xs text-slate-400 hover:text-red-400"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
            >
              + Add FAQ
            </Button>
          </div>
        </Card>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {createdBot ? (
          <Card title={isPollingDocs ? "Processing documents..." : "Document processing finished"}>
            <p className="text-sm text-slate-400">
              {isPollingDocs
                ? "We are indexing your uploaded files. This may take a short while."
                : "Document ingestion is complete. You can continue to your trial bot."}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {processingDocs.map((doc) => (
                <li
                  key={doc.docId}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-slate-200">{doc.fileName || "Document"}</span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClass(doc.status)}`}
                    >
                      {doc.status || "queued"}
                    </span>
                  </div>
                  {doc.status === "failed" && doc.error ? (
                    <p className="mt-1 text-xs text-red-300">{truncateError(doc.error)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {processingDone ? (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => router.push(`/trial/${createdBot.slug}?visitorId=${visitorId}`)}
                >
                  Continue to bot
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" disabled={submitting || isPollingDocs}>
            {submitting ? "Creating..." : isPollingDocs ? "Processing documents..." : "Create trial bot"}
          </Button>
        </div>
      </form>
    </div>
  );
}
