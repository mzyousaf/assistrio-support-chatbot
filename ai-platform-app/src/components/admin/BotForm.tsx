"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

import BotChatUIEditor from "@/components/admin/BotChatUIEditor";
import BotDocumentsManager, { type BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import BotFaqsEditor, { type BotFaq } from "@/components/admin/BotFaqsEditor";
import LeadCaptureEditor from "@/components/admin/LeadCaptureEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import MultiSelect from "@/components/ui/MultiSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { normalizeLeadCapture } from "@/lib/leadCapture";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

const CATEGORY_OPTIONS = [
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "onboarding", label: "Onboarding" },
  { value: "hr", label: "HR" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "operations", label: "Operations" },
  { value: "product", label: "Product" },
  { value: "education", label: "Education" },
  { value: "healthcare", label: "Healthcare" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "compliance", label: "Compliance" },
  { value: "docs", label: "Documentation" },
  { value: "general", label: "General" },
];

const BEHAVIOR_PRESETS = [
  { value: "default", label: "Default helper" },
  { value: "support", label: "Support agent" },
  { value: "sales", label: "Sales assistant" },
  { value: "technical", label: "Technical assistant" },
  { value: "marketing", label: "Marketing assistant" },
  { value: "consultative", label: "Consultative advisor" },
  { value: "teacher", label: "Teacher and explainer" },
  { value: "empathetic", label: "Empathetic listener" },
  { value: "strict", label: "Strict policy-based" },
];

const DEFAULT_CHAT_UI: Required<BotChatUI> = {
  primaryColor: "#14B8A6",
  backgroundStyle: "light",
  bubbleStyle: "rounded",
  avatarStyle: "emoji",
  launcherPosition: "bottom-right",
  font: "inter",
  showBranding: true,
};

export interface BotFormSubmitPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  welcomeMessage?: string;
  knowledgeDescription?: string;
  faqs: BotFaq[];
  status?: "draft" | "published";
  isPublic?: boolean;
  leadCapture: BotLeadCaptureV2;
  chatUI: BotChatUI;
  personality: BotPersonality;
  config: BotConfig;
  openaiApiKeyOverride?: string;
}

interface BotFormProps {
  mode: "create" | "edit";
  initialBot?: {
    id?: string;
    name?: string;
    shortDescription?: string;
    description?: string;
    category?: string;
    categories?: string[];
    imageUrl?: string;
    welcomeMessage?: string;
    knowledgeDescription?: string;
    status?: "draft" | "published";
    faqs?: BotFaq[];
    documents?: BotDocumentItem[];
    openaiApiKeyOverride?: string;
    isPublic?: boolean;
    leadCapture?: BotLeadCaptureV2;
    chatUI?: BotChatUI;
    personality?: BotPersonality;
    config?: BotConfig;
    health?: {
      docsTotal: number;
      docsQueued: number;
      docsProcessing: number;
      docsReady: number;
      docsFailed: number;
      lastIngestedAt?: string;
      lastFailedDoc?: {
        docId: string;
        title: string;
        error?: string;
        updatedAt?: string;
      };
    };
  };
  onSubmit: (payload: BotFormSubmitPayload) => Promise<void> | void;
  onCreateAnotherBot?: () => void;
  submitting?: boolean;
}

function presetToPrompt(preset: string) {
  switch (preset) {
    case "support":
      return "You are a friendly support agent. Be concise and helpful.";
    case "sales":
      return "You are a sales assistant. Clarify needs and propose best options.";
    case "technical":
      return "You are a technical assistant. Be precise and step-by-step.";
    case "marketing":
      return "You are a marketing assistant. Focus on messaging, positioning, and conversion clarity.";
    case "consultative":
      return "You are a consultative advisor. Ask clarifying questions before recommending solutions.";
    case "teacher":
      return "You are a patient teacher. Explain concepts clearly with practical examples.";
    case "empathetic":
      return "You are an empathetic assistant. Acknowledge user concerns and respond supportively.";
    case "strict":
      return "You are a strict assistant. Only answer if the info is clearly provided.";
    default:
      return "You are a helpful assistant.";
  }
}

export default function BotForm({
  mode,
  initialBot,
  onSubmit,
  onCreateAnotherBot,
  submitting = false,
}: BotFormProps) {
  const [name, setName] = useState(initialBot?.name ?? "");
  const [shortDescription, setShortDescription] = useState(initialBot?.shortDescription ?? "");
  const [description, setDescription] = useState(initialBot?.description ?? "");
  const [isPublic, setIsPublic] = useState(initialBot?.isPublic ?? true);
  const [categories, setCategories] = useState<string[]>(
    initialBot?.categories?.length ? initialBot.categories : initialBot?.category ? [initialBot.category] : [],
  );
  const [customCategory, setCustomCategory] = useState(
    initialBot?.categories?.length ? "" : initialBot?.category ?? "",
  );
  const [behaviorPreset, setBehaviorPreset] = useState<string>("default");
  const [behaviorText, setBehaviorText] = useState(
    initialBot?.personality?.description ?? initialBot?.personality?.systemPrompt ?? "",
  );
  const [welcomeMessage, setWelcomeMessage] = useState(initialBot?.welcomeMessage ?? "");
  const [knowledgeDescription, setKnowledgeDescription] = useState(initialBot?.knowledgeDescription ?? "");
  const [faqs, setFaqs] = useState<BotFaq[]>(initialBot?.faqs ?? []);
  const [status, setStatus] = useState<"draft" | "published">(initialBot?.status ?? "draft");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [personality, setPersonality] = useState<BotPersonality>(initialBot?.personality ?? {});
  const [config, setConfig] = useState<BotConfig>(
    initialBot?.config ?? { temperature: 0.3, responseLength: "medium", maxTokens: 512 },
  );
  const [openaiApiKeyOverride, setOpenaiApiKeyOverride] = useState(initialBot?.openaiApiKeyOverride ?? "");

  const [leadCapture, setLeadCapture] = useState<BotLeadCaptureV2>(() =>
    normalizeLeadCapture(initialBot?.leadCapture),
  );
  const [chatUI, setChatUI] = useState<BotChatUI>(
    initialBot?.chatUI ?? {
      primaryColor: "#14B8A6",
      backgroundStyle: "light",
      bubbleStyle: "rounded",
      avatarStyle: "emoji",
      launcherPosition: "bottom-right",
      font: "inter",
      showBranding: true,
    },
  );

  useEffect(() => {
    const source = initialBot?.leadCapture as Record<string, unknown> | undefined;
    if (!source || Array.isArray(source.fields)) {
      return;
    }
    if ("collectName" in source || "collectEmail" in source || "collectPhone" in source) {
      setLeadCapture(normalizeLeadCapture(source));
    }
  }, [initialBot?.leadCapture]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botImageFile, setBotImageFile] = useState<File | null>(null);
  const [botImageUrl, setBotImageUrl] = useState(initialBot?.imageUrl ?? "");
  const [botImageObjectUrl, setBotImageObjectUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(Boolean(initialBot?.imageUrl));
  const [dragOver, setDragOver] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (!botImageFile) {
      setBotImageObjectUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(botImageFile);
    setBotImageObjectUrl(objectUrl);
    setPreviewVisible(true);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [botImageFile]);

  function handleFilePick(nextFile: File | null) {
    if (!nextFile) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(nextFile.type)) {
      setSubmitError("Only PNG, JPG, JPEG, and WEBP files are supported.");
      return;
    }
    setSubmitError(null);
    setBotImageFile(nextFile);
  }

  async function buildSubmitPayload(desiredStatus?: "draft" | "published") {
    setSubmitError(null);
    let finalImageUrl = botImageUrl.trim() || undefined;
    if (botImageFile) {
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", botImageFile);
        const uploadResponse = await fetch("/api/super-admin/uploads/image", {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error("Image upload failed.");
        }
        const uploadResult = (await uploadResponse.json()) as { url?: string };
        if (!uploadResult.url) {
          throw new Error("Image upload did not return a URL.");
        }
        finalImageUrl = uploadResult.url;
      } catch {
        setSubmitError("Failed to upload bot image. Please try again.");
        setIsUploadingImage(false);
        return null;
      }
      setIsUploadingImage(false);
    }

    const behaviorDescription = behaviorText.trim();
    const combinedSystemPrompt =
      `${presetToPrompt(behaviorPreset)}\n\n` +
      (behaviorDescription ? `Additional behavior:\n${behaviorDescription}` : "");

    return {
      name: name.trim(),
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim() || undefined,
      categories: customCategory.trim().length > 0 ? [customCategory.trim().toLowerCase()] : categories,
      imageUrl: finalImageUrl,
      welcomeMessage: welcomeMessage.trim() || undefined,
      knowledgeDescription: knowledgeDescription.trim() || undefined,
      faqs,
      status: desiredStatus ?? status,
      isPublic,
      leadCapture,
      chatUI: {
        primaryColor: chatUI.primaryColor || DEFAULT_CHAT_UI.primaryColor,
        backgroundStyle: chatUI.backgroundStyle || DEFAULT_CHAT_UI.backgroundStyle,
        bubbleStyle: chatUI.bubbleStyle || DEFAULT_CHAT_UI.bubbleStyle,
        avatarStyle: chatUI.avatarStyle || DEFAULT_CHAT_UI.avatarStyle,
        launcherPosition: chatUI.launcherPosition || DEFAULT_CHAT_UI.launcherPosition,
        font: chatUI.font || DEFAULT_CHAT_UI.font,
        showBranding: chatUI.showBranding ?? DEFAULT_CHAT_UI.showBranding,
      },
      personality: {
        ...personality,
        description: behaviorDescription || undefined,
        systemPrompt: combinedSystemPrompt.trim() || undefined,
      },
      config,
      openaiApiKeyOverride: openaiApiKeyOverride.trim() || undefined,
    } satisfies BotFormSubmitPayload;
  }

  async function submitWithStatus(desiredStatus?: "draft" | "published") {
    const payload = await buildSubmitPayload(desiredStatus);
    if (!payload) return;
    try {
      await onSubmit(payload);
      if (payload.status) {
        setStatus(payload.status);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save bot. Please try again.");
    }
  }

  const hasImageUrl = botImageUrl.trim().length > 0;
  const hasImageFile = Boolean(botImageFile);
  const previewSrc =
    botImageObjectUrl ||
    (botImageUrl.trim().length > 0 && previewVisible ? botImageUrl.trim() : "");
  const isPublishBlocked = !name.trim() || !description.trim();
  const health = initialBot?.health;

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await submitWithStatus(status);
      }}
      className="space-y-6"
    >
      {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge base</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="chat-ui">Chat UI</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
          </TabsList>
          <Button type="submit" variant="primary" disabled={submitting || isUploadingImage}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>

        <TabsContent value="overview">
          <Card title="Overview">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Bot name <span className="text-red-500">*</span>
                </label>
                <Input required value={name} onChange={(event) => setName(event.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Tagline</label>
                <Textarea rows={2} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Description <span className="text-red-500">*</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">Main public description shown to users.</p>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Categories</label>
                <MultiSelect
                  label="Category options"
                  subtitle="Pick one or more from presets."
                  options={CATEGORY_OPTIONS}
                  value={categories}
                  onChange={(next) => {
                    if (!customCategory.trim()) setCategories(next);
                  }}
                />
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-900">Custom category</label>
                  <Input
                    value={customCategory}
                    disabled={categories.length > 0}
                    onChange={(event) => {
                      const next = event.target.value;
                      setCustomCategory(next);
                      if (next.trim()) setCategories([]);
                    }}
                    placeholder="e.g. real-estate"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-200 pt-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                  />
                  Public bot
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-900">Bot image</label>
                  <Input
                    type="url"
                    value={botImageUrl}
                    disabled={hasImageFile}
                    onChange={(event) => {
                      setBotImageUrl(event.target.value);
                      setPreviewVisible(Boolean(event.target.value.trim()));
                    }}
                    placeholder="https://..."
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={hasImageUrl}
                    onChange={(event) => handleFilePick(event.target.files?.[0] ?? null)}
                  />
                  <div
                    className={`mt-2 rounded-2xl border border-dashed px-4 py-5 text-center transition ${
                      hasImageUrl
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                        : dragOver
                          ? "cursor-pointer border-brand-500 bg-brand-50"
                          : "cursor-pointer border-gray-300 bg-gray-50 hover:border-brand-400"
                    }`}
                    onClick={() => {
                      if (!hasImageUrl) fileInputRef.current?.click();
                    }}
                    onDragOver={(event) => {
                      if (hasImageUrl) return;
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(event) => {
                      if (hasImageUrl) return;
                      event.preventDefault();
                      setDragOver(false);
                      handleFilePick(event.dataTransfer.files?.[0] ?? null);
                    }}
                  >
                    Drag &amp; drop an image here, or browse.
                  </div>
                  {previewSrc ? (
                    <Image
                      src={previewSrc}
                      alt="Bot preview"
                      width={64}
                      height={64}
                      className="mt-2 rounded-xl border border-gray-200 object-cover"
                      unoptimized={previewSrc.startsWith("http") || previewSrc.startsWith("blob:")}
                      onError={() => setPreviewVisible(false)}
                    />
                  ) : null}
                  {!hasImageUrl && !hasImageFile ? (
                    <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-xs text-gray-500">
                      No image
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="behavior">
          <Card title="Behavior">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">Behavior preset</label>
                <select
                  value={behaviorPreset}
                  onChange={(event) => setBehaviorPreset(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                >
                  {BEHAVIOR_PRESETS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Behavior description</label>
                <Textarea rows={4} value={behaviorText} onChange={(event) => setBehaviorText(event.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Welcome message</label>
                <Textarea rows={3} value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} />
              </div>

              <LeadCaptureEditor value={leadCapture} onChange={setLeadCapture} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card title="Knowledge base">
            <div className="space-y-6">
              <section>
                <label className="block text-sm font-medium text-gray-900">Knowledge description</label>
                <p className="mt-1 text-xs text-gray-500">
                  Briefly describe what knowledge you&apos;ve added (for admins).
                </p>
                <Textarea
                  rows={3}
                  value={knowledgeDescription}
                  onChange={(event) => setKnowledgeDescription(event.target.value)}
                  className="mt-2"
                />
              </section>

              <BotFaqsEditor value={faqs} onChange={setFaqs} />

              {health ? (
                <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">Bot Health</h3>
                    {health.lastIngestedAt ? (
                      <p className="text-[11px] text-gray-500">
                        Last ingested: {new Date(health.lastIngestedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border border-gray-200 bg-white p-2 text-center">
                      <p className="text-[11px] text-gray-500">Total</p>
                      <p className="text-sm font-semibold text-gray-900">{health.docsTotal}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2 text-center">
                      <p className="text-[11px] text-gray-500">Queued</p>
                      <p className="text-sm font-semibold text-gray-700">{health.docsQueued}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
                      <p className="text-[11px] text-blue-700">Processing</p>
                      <p className="text-sm font-semibold text-blue-700">{health.docsProcessing}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                      <p className="text-[11px] text-emerald-700">Ready</p>
                      <p className="text-sm font-semibold text-emerald-700">{health.docsReady}</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
                      <p className="text-[11px] text-red-700">Failed</p>
                      <p className="text-sm font-semibold text-red-700">{health.docsFailed}</p>
                    </div>
                  </div>
                  {health.docsFailed > 0 && health.lastFailedDoc ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-medium text-amber-800">
                        Latest failed document: {health.lastFailedDoc.title || health.lastFailedDoc.docId}
                      </p>
                      {health.lastFailedDoc.error ? (
                        <p className="mt-1 text-xs text-amber-800">
                          {health.lastFailedDoc.error.length > 180
                            ? `${health.lastFailedDoc.error.slice(0, 179)}...`
                            : health.lastFailedDoc.error}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {initialBot?.id ? (
                <BotDocumentsManager botId={initialBot.id} documents={initialBot.documents ?? []} />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  Draft bot is still initializing.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card title="Integrations">
            <div className="space-y-4">
              <section className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">OpenAI API key override</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="password"
                    value={openaiApiKeyOverride}
                    onChange={(event) => setOpenaiApiKeyOverride(event.target.value)}
                    placeholder="sk-..."
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={testingKey}
                    onClick={async () => {
                      setTestingKey(true);
                      setTestResult(null);
                      try {
                        const response = await fetch("/api/super-admin/openai/test-key", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ apiKey: openaiApiKeyOverride || "" }),
                        });
                        const data = (await response.json()) as { ok?: boolean; error?: string };
                        if (!response.ok || !data.ok) {
                          setTestResult({ ok: false, message: data.error || "Invalid API key." });
                        } else {
                          setTestResult({ ok: true, message: "API key is valid." });
                        }
                      } catch {
                        setTestResult({ ok: false, message: "Failed to test API key." });
                      } finally {
                        setTestingKey(false);
                      }
                    }}
                  >
                    {testingKey ? "Testing..." : "Test key"}
                  </Button>
                </div>
                {testResult ? (
                  <p className={`text-xs ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
                    {testResult.message}
                  </p>
                ) : null}
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 block">
                  <span className="text-sm text-gray-800">Language</span>
                  <Input
                    value={personality.language ?? ""}
                    onChange={(event) =>
                      setPersonality((prev) => ({ ...prev, language: event.target.value || undefined }))
                    }
                    placeholder="en-US"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-sm text-gray-800">Temperature</span>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={config.temperature ?? 0.3}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, temperature: Number(event.target.value) }))
                    }
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-sm text-gray-800">Max tokens</span>
                  <Input
                    type="number"
                    min={1}
                    value={config.maxTokens ?? 512}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, maxTokens: Math.max(1, Number(event.target.value)) }))
                    }
                  />
                </label>
              </section>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chat-ui">
          <Card title="Chat UI">
            <BotChatUIEditor botName={name || "Bot"} value={chatUI} onChange={setChatUI} />
          </Card>
        </TabsContent>

        <TabsContent value="publish">
          <Card title="Publish">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">Status</label>
                <div className="mt-2 inline-flex rounded-lg border border-gray-300 p-1">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1 text-sm ${
                      status === "draft" ? "bg-gray-900 text-white" : "text-gray-700"
                    }`}
                    onClick={() => setStatus("draft")}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1 text-sm ${
                      status === "published" ? "bg-brand-600 text-white" : "text-gray-700"
                    }`}
                    onClick={() => setStatus("published")}
                  >
                    Published
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-medium">Publish checklist</p>
                <p className={name.trim() ? "text-green-600" : "text-red-500"}>Name is required</p>
                <p className={description.trim() ? "text-green-600" : "text-red-500"}>
                  Description is required
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void submitWithStatus("draft")}>
                  Save draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isPublishBlocked}
                  onClick={() => void submitWithStatus("published")}
                >
                  Publish bot
                </Button>
                {mode === "edit" && onCreateAnotherBot ? (
                  <Button type="button" variant="ghost" onClick={onCreateAnotherBot}>
                    Create new bot
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
}
