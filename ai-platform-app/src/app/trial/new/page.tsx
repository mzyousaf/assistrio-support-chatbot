"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useVisitorId } from "@/hooks/useVisitorId";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorId || submitting) return;
    if (!botName || !email) return;

    setSubmitting(true);
    setError(null);

    try {
      const filteredFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
      const faqsJson = JSON.stringify(filteredFaqs);

      const res = await fetch("/api/trial/create-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botName: botName.trim(),
          email: email.trim(),
          description: description.trim(),
          visitorId,
          faqs: faqsJson,
        }),
      });

      if (!res.ok) {
        setError("Failed to create trial bot. Please try again.");
        return;
      }

      const data = (await res.json()) as { slug?: string };
      const slug = data.slug;
      if (slug) {
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

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" disabled={submitting}>
            {submitting ? "Creating..." : "Create trial bot"}
          </Button>
        </div>
      </form>
    </div>
  );
}
