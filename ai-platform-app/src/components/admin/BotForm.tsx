"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

import BotDocumentsManager, { type BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import BotFaqsEditor, { type BotFaq } from "@/components/admin/BotFaqsEditor";
import {
  FormField,
  FormFieldDescription,
} from "@/components/admin/form";
import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsGrid,
  SETTINGS_GRID_FULL,
  SettingsFieldRow,
  SettingsToggleRow,
  SettingsEmptyState,
  SettingsInfoTooltip,
  SettingsDependencyAlert,
} from "@/components/admin/settings";
import LeadCaptureEditor from "@/components/admin/LeadCaptureEditor";
import MenuQuickLinksEditor from "@/components/admin/MenuQuickLinksEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import MultiSelect from "@/components/ui/MultiSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import Tooltip from "@/components/ui/Tooltip";
import { apiFetch } from "@/lib/api";
import { normalizeLeadCapture } from "@/lib/leadCapture";
import {
  BUBBLE_RADIUS_MAX,
  BUBBLE_RADIUS_MIN,
  type BotChatUI,
  type BotConfig,
  type BotLeadCaptureV2,
  type BotPersonality,
  type ChatLauncherIcon,
  type ChatMenuQuickLink,
  type ChatOpenAnimation,
  type ChatStatusIndicator,
  type ChatTimePosition,
  type LiveIndicatorStyle,
  type ChatShadowIntensity,
} from "@/models/Bot";

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

const DEFAULT_CHAT_UI: Required<Omit<BotChatUI, "menuQuickLinks" | "launcherAvatarUrl">> & {
  menuQuickLinks: BotChatUI["menuQuickLinks"];
  launcherAvatarUrl?: string;
} = {
  primaryColor: "#14B8A6",
  backgroundStyle: "light",
  bubbleBorderRadius: 20,
  launcherPosition: "bottom-right",
  shadowIntensity: "medium",
  showChatBorder: true,
  launcherIcon: "default",
  launcherAvatarRingWidth: 18,
  launcherSize: 48,
  chatOpenAnimation: "slide-up-fade",
  openChatOnLoad: true,
  showBranding: true,
  liveIndicatorStyle: "label",
  statusIndicator: "none",
  statusDotStyle: "blinking",
  showScrollToBottom: true,
  showScrollbar: true,
  composerAsSeparateBox: true,
  composerBorderWidth: 1,
  composerBorderColor: "primary",
  showMenuExpand: true,
  menuQuickLinks: [],
  showComposerWithSuggestedQuestions: false,
  showAvatarInHeader: true,
  senderName: "",
  showSenderName: true,
  showTime: true,
  timePosition: "top",
  showCopyButton: true,
  showSources: true,
  showEmoji: true,
  allowFileUpload: false,
  showMic: false,
  brandingMessage: "",
};

const EXAMPLE_QUESTIONS_MAX = 5;

export interface BotFormSubmitPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  welcomeMessage?: string;
  knowledgeDescription?: string;
  faqs: BotFaq[];
  exampleQuestions?: string[];
  status?: "draft" | "published";
  isPublic?: boolean;
  leadCapture: BotLeadCaptureV2;
  chatUI: BotChatUI;
  personality: BotPersonality;
  config: BotConfig;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
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
    exampleQuestions?: string[];
    documents?: BotDocumentItem[];
    openaiApiKeyOverride?: string;
    whisperApiKeyOverride?: string;
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
  /** ID for the form element (for external submit button via form="..."). */
  formId?: string;
  /** Called when form dirty state changes (user edited / save completed). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called when name, image, chatUI, tagline, description, or welcomeMessage change (for live chat preview). */
  onLivePreviewChange?: (preview: { name: string; imageUrl?: string; chatUI: BotChatUI; tagline?: string; description?: string; welcomeMessage?: string; suggestedQuestions?: string[] }) => void;
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

const TAB_IDS = [
  { value: "general", label: "General" },
  { value: "behavior", label: "Behavior" },
  { value: "knowledge", label: "Knowledge base" },
  { value: "integrations", label: "Integrations & AI" },
  { value: "chat-experience", label: "Chat Experience" },
  { value: "appearance", label: "Appearance" },
  { value: "publish", label: "Publish" },
] as const;

const TAB_META: Record<(typeof TAB_IDS)[number]["value"], { title: string; description: string }> = {
  general: { title: "General", description: "Basic identity and avatar for your bot." },
  behavior: { title: "Behavior", description: "Classification, personality, first message, and lead capture settings." },
  knowledge: { title: "Knowledge base", description: "FAQs, documents, and ingestion status." },
  integrations: { title: "Integrations & AI", description: "AI provider, voice, and future integrations." },
  "chat-experience": { title: "Chat Experience", description: "Input tools, message features, header, and navigation." },
  appearance: { title: "Appearance", description: "Theme, launcher, animation, composer, and branding." },
  publish: { title: "Publish", description: "Final review, validation, and go-live." },
};

const TAB_CONTENT_CLASS = "mx-auto w-full max-w-5xl space-y-8 pb-2";

export default function BotForm({
  mode,
  initialBot,
  onSubmit,
  onCreateAnotherBot,
  submitting = false,
  formId,
  onDirtyChange,
  onLivePreviewChange,
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
  const [behaviorPreset, setBehaviorPreset] = useState<string>(
    initialBot?.personality?.behaviorPreset ?? "default",
  );
  const [behaviorText, setBehaviorText] = useState(
    initialBot?.personality?.description ?? initialBot?.personality?.systemPrompt ?? "",
  );
  const [thingsToAvoid, setThingsToAvoid] = useState(initialBot?.personality?.thingsToAvoid ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(initialBot?.welcomeMessage ?? "");
  const [knowledgeDescription, setKnowledgeDescription] = useState(initialBot?.knowledgeDescription ?? "");
  const [faqs, setFaqs] = useState<BotFaq[]>(initialBot?.faqs ?? []);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>(
    initialBot?.exampleQuestions?.length ? initialBot.exampleQuestions.slice(0, EXAMPLE_QUESTIONS_MAX) : [],
  );
  const [status, setStatus] = useState<"draft" | "published">(initialBot?.status ?? "draft");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [personality, setPersonality] = useState<BotPersonality>(initialBot?.personality ?? {});
  const [config, setConfig] = useState<BotConfig>(
    initialBot?.config ?? { temperature: 0.3, responseLength: "medium", maxTokens: 512 },
  );
  const [openaiApiKeyOverride, setOpenaiApiKeyOverride] = useState(initialBot?.openaiApiKeyOverride ?? "");
  const [whisperApiKeyOverride, setWhisperApiKeyOverride] = useState(initialBot?.whisperApiKeyOverride ?? "");

  const [leadCapture, setLeadCapture] = useState<BotLeadCaptureV2>(() =>
    normalizeLeadCapture(initialBot?.leadCapture),
  );
  const [chatUI, setChatUI] = useState<BotChatUI>(
    initialBot?.chatUI ?? {
      primaryColor: "#14B8A6",
      backgroundStyle: "light",
      bubbleBorderRadius: 20,
      launcherPosition: "bottom-right",
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

  useEffect(() => {
    const preset = initialBot?.personality?.behaviorPreset;
    if (typeof preset === "string" && preset.trim()) {
      setBehaviorPreset(preset.trim());
    }
  }, [initialBot?.personality?.behaviorPreset]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botImageFile, setBotImageFile] = useState<File | null>(null);
  const [botImageUrl, setBotImageUrl] = useState(initialBot?.imageUrl ?? "");
  const [botImageObjectUrl, setBotImageObjectUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(Boolean(initialBot?.imageUrl));
  const [dragOver, setDragOver] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isRemovingImage, setIsRemovingImage] = useState(false);

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

  useEffect(() => {
    const suggestedQuestionsPreview = exampleQuestions
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, EXAMPLE_QUESTIONS_MAX);
    onLivePreviewChange?.({
      name,
      imageUrl: botImageObjectUrl ?? (botImageUrl || undefined),
      chatUI,
      tagline: shortDescription.trim() || undefined,
      description: description.trim() || undefined,
      welcomeMessage: welcomeMessage.trim() || undefined,
      suggestedQuestions: suggestedQuestionsPreview.length > 0 ? suggestedQuestionsPreview : undefined,
    });
  }, [name, botImageUrl, botImageObjectUrl, chatUI, shortDescription, description, welcomeMessage, exampleQuestions, onLivePreviewChange]);

  function handleFilePick(nextFile: File | null) {
    if (!nextFile) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(nextFile.type)) {
      setSubmitError("Only PNG, JPG, JPEG, and WEBP files are supported.");
      return;
    }
    setSubmitError(null);
    setBotImageFile(nextFile);
  }

  async function buildSubmitPayload(
    desiredStatus?: "draft" | "published",
    imageUrlOverride?: string,
  ) {
    setSubmitError(null);
    let finalImageUrl: string | undefined;
    if (imageUrlOverride !== undefined) {
      finalImageUrl = imageUrlOverride.trim() || undefined;
    } else {
      finalImageUrl = botImageUrl.trim() || undefined;
      if (botImageFile) {
        setIsUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append("file", botImageFile);
          const uploadResponse = await apiFetch("/api/super-admin/uploads/image", {
            method: "POST",
            body: formData,
          });
          const uploadJson = (await uploadResponse.json().catch(() => ({}))) as {
            url?: string;
            error?: string;
          };
          if (!uploadResponse.ok) {
            const msg =
              (uploadJson as { message?: string }).message ??
              (uploadJson.error === "invalid_type"
                ? "Invalid image type. Use PNG, JPG, or WEBP."
                : uploadJson.error === "file_too_large"
                  ? "Image must be under 2MB."
                  : uploadJson.error === "missing_file"
                    ? "No file was sent."
                    : uploadJson.error === "invalid_file"
                      ? "Invalid image (type or size). Use PNG, JPG, or WEBP under 2MB."
                      : "Image upload failed. Please try again.");
            setSubmitError(msg);
            setIsUploadingImage(false);
            return null;
          }
          if (!uploadJson.url) {
            setSubmitError("Image upload did not return a URL.");
            setIsUploadingImage(false);
            return null;
          }
          finalImageUrl = uploadJson.url;
        } catch {
          setSubmitError("Failed to upload bot image. Please try again.");
          setIsUploadingImage(false);
          return null;
        }
        setIsUploadingImage(false);
      }
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
      exampleQuestions: exampleQuestions.map((q) => q.trim()).filter(Boolean).slice(0, EXAMPLE_QUESTIONS_MAX),
      status: desiredStatus ?? status,
      isPublic,
      leadCapture,
      chatUI: {
        primaryColor: chatUI.primaryColor || DEFAULT_CHAT_UI.primaryColor,
        backgroundStyle: chatUI.backgroundStyle || DEFAULT_CHAT_UI.backgroundStyle,
        bubbleBorderRadius: chatUI.bubbleBorderRadius ?? DEFAULT_CHAT_UI.bubbleBorderRadius,
        launcherPosition: chatUI.launcherPosition || DEFAULT_CHAT_UI.launcherPosition,
        shadowIntensity: chatUI.shadowIntensity ?? DEFAULT_CHAT_UI.shadowIntensity,
        showChatBorder: chatUI.showChatBorder ?? DEFAULT_CHAT_UI.showChatBorder,
        launcherIcon: chatUI.launcherIcon ?? DEFAULT_CHAT_UI.launcherIcon,
        launcherAvatarUrl: chatUI.launcherAvatarUrl?.trim() || undefined,
        launcherAvatarRingWidth: chatUI.launcherAvatarRingWidth ?? DEFAULT_CHAT_UI.launcherAvatarRingWidth,
        launcherSize: chatUI.launcherSize ?? DEFAULT_CHAT_UI.launcherSize,
        chatOpenAnimation: chatUI.chatOpenAnimation ?? DEFAULT_CHAT_UI.chatOpenAnimation,
        openChatOnLoad: chatUI.openChatOnLoad ?? DEFAULT_CHAT_UI.openChatOnLoad,
        showBranding: chatUI.showBranding ?? DEFAULT_CHAT_UI.showBranding,
        brandingMessage: chatUI.brandingMessage ?? DEFAULT_CHAT_UI.brandingMessage,
        liveIndicatorStyle: chatUI.liveIndicatorStyle ?? DEFAULT_CHAT_UI.liveIndicatorStyle,
        statusIndicator: chatUI.statusIndicator ?? DEFAULT_CHAT_UI.statusIndicator,
        statusDotStyle: chatUI.statusDotStyle ?? DEFAULT_CHAT_UI.statusDotStyle,
        showScrollToBottom: chatUI.showScrollToBottom ?? DEFAULT_CHAT_UI.showScrollToBottom,
        showScrollbar: chatUI.showScrollbar ?? DEFAULT_CHAT_UI.showScrollbar,
        composerAsSeparateBox: chatUI.composerAsSeparateBox ?? DEFAULT_CHAT_UI.composerAsSeparateBox,
        composerBorderWidth:
          typeof chatUI.composerBorderWidth === "number" && chatUI.composerBorderWidth >= 0 && chatUI.composerBorderWidth <= 6
            ? (() => {
              const w = chatUI.composerBorderWidth!;
              return w > 0 && w < 0.5 ? 0.5 : w;
            })()
            : (chatUI as { showComposerBorder?: boolean }).showComposerBorder === false
              ? 0
              : DEFAULT_CHAT_UI.composerBorderWidth,
        composerBorderColor: chatUI.composerBorderColor ?? DEFAULT_CHAT_UI.composerBorderColor,
        showMenuExpand: chatUI.showMenuExpand ?? DEFAULT_CHAT_UI.showMenuExpand,
        menuQuickLinks: chatUI.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined,
        showComposerWithSuggestedQuestions: chatUI.showComposerWithSuggestedQuestions ?? false,
        showAvatarInHeader: chatUI.showAvatarInHeader ?? DEFAULT_CHAT_UI.showAvatarInHeader,
        senderName: chatUI.senderName ?? DEFAULT_CHAT_UI.senderName,
        showSenderName: chatUI.showSenderName ?? DEFAULT_CHAT_UI.showSenderName,
        showTime: chatUI.showTime ?? DEFAULT_CHAT_UI.showTime,
        timePosition: chatUI.timePosition ?? DEFAULT_CHAT_UI.timePosition,
        showCopyButton: chatUI.showCopyButton ?? DEFAULT_CHAT_UI.showCopyButton,
        showSources: chatUI.showSources ?? DEFAULT_CHAT_UI.showSources,
        showEmoji: chatUI.showEmoji ?? DEFAULT_CHAT_UI.showEmoji,
        allowFileUpload: chatUI.allowFileUpload ?? DEFAULT_CHAT_UI.allowFileUpload,
        showMic: chatUI.showMic ?? DEFAULT_CHAT_UI.showMic,
      },
      personality: {
        ...personality,
        behaviorPreset,
        description: behaviorDescription || undefined,
        systemPrompt: combinedSystemPrompt.trim() || undefined,
        thingsToAvoid: thingsToAvoid.trim() || undefined,
      },
      config,
      openaiApiKeyOverride: openaiApiKeyOverride.trim() || undefined,
      whisperApiKeyOverride: whisperApiKeyOverride.trim() || undefined,
    } satisfies BotFormSubmitPayload;
  }

  async function submitWithStatus(desiredStatus?: "draft" | "published") {
    const payload = await buildSubmitPayload(desiredStatus);
    if (!payload) return;
    try {
      await onSubmit(payload);
      onDirtyChange?.(false);
      if (payload.status) {
        setStatus(payload.status);
      }
      // Clear pending file and sync URL so next Save doesn't re-upload the same image
      setBotImageFile(null);
      setBotImageUrl(payload.imageUrl ?? "");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save bot. Please try again.");
    }
  }

  const hasImageUrl = botImageUrl.trim().length > 0;
  const hasImageFile = Boolean(botImageFile);
  const hasImage = hasImageUrl || hasImageFile;

  async function handleRemoveAvatar() {
    if (!hasImage) return;
    setSubmitError(null);
    setIsRemovingImage(true);
    try {
      const payload = await buildSubmitPayload(undefined, "");
      if (!payload) {
        setIsRemovingImage(false);
        return;
      }
      payload.imageUrl = "";
      await onSubmit(payload);
      setBotImageUrl("");
      setBotImageFile(null);
      setPreviewVisible(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to remove image.");
    } finally {
      setIsRemovingImage(false);
    }
  }

  const previewSrc =
    botImageObjectUrl ||
    (botImageUrl.trim().length > 0 && previewVisible ? botImageUrl.trim() : "");
  const isPublishBlocked = !name.trim() || !description.trim();
  const health = initialBot?.health;

  // Dirty state: compare current form state to initial
  React.useEffect(() => {
    if (!onDirtyChange || !initialBot) return;
    const initial = initialBot;
    const dirty =
      (name || "") !== (initial.name || "") ||
      (shortDescription || "") !== (initial.shortDescription || "") ||
      (description || "") !== (initial.description || "") ||
      (welcomeMessage || "") !== (initial.welcomeMessage || "") ||
      (knowledgeDescription || "") !== (initial.knowledgeDescription || "") ||
      (behaviorText || "") !== ((initial.personality?.description ?? initial.personality?.systemPrompt) || "") ||
      (behaviorPreset || "default") !== (initial.personality?.behaviorPreset ?? "default") ||
      (openaiApiKeyOverride || "") !== (initial.openaiApiKeyOverride || "") ||
      (whisperApiKeyOverride || "") !== (initial.whisperApiKeyOverride || "") ||
      (botImageUrl || "") !== (initial.imageUrl || "") ||
      botImageFile !== null ||
      status !== (initial.status ?? "draft") ||
      isPublic !== (initial.isPublic ?? true) ||
      JSON.stringify(categories) !== JSON.stringify(initial.categories ?? []) ||
      JSON.stringify(faqs) !== JSON.stringify(initial.faqs ?? []) ||
      JSON.stringify(exampleQuestions) !== JSON.stringify(initial.exampleQuestions ?? []) ||
      JSON.stringify(chatUI) !== JSON.stringify(initial.chatUI ?? {}) ||
      JSON.stringify(leadCapture) !== JSON.stringify(initial.leadCapture ?? {});
    onDirtyChange(dirty);
  }, [
    name,
    shortDescription,
    description,
    welcomeMessage,
    knowledgeDescription,
    behaviorText,
    behaviorPreset,
    openaiApiKeyOverride,
    whisperApiKeyOverride,
    botImageUrl,
    botImageFile,
    status,
    isPublic,
    categories,
    faqs,
    exampleQuestions,
    chatUI,
    leadCapture,
    initialBot,
    onDirtyChange,
  ]);

  return (
    <form
      id={formId}
      onSubmit={async (event) => {
        event.preventDefault();
        await submitWithStatus(status);
      }}
      className="space-y-6"
    >
      {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}

      <Tabs defaultValue="general" className="space-y-0">
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
          <TabsList className="w-full justify-start rounded-none border-0 bg-transparent p-0 gap-0 min-h-0">
            {TAB_IDS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 data-[state=active]:text-brand-700 dark:data-[state=active]:text-brand-300 data-[state=active]:font-semibold hover:text-gray-900 dark:hover:text-gray-200"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex-1 min-w-0 py-5 px-6">
          <TabsContent value="general" className="mt-0">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META.general.title}
                description={TAB_META.general.description}
              />
              <SettingsSectionCard
                title="Identity"
                description="Define the bot's basic identity used across the platform."
              >
                <SettingsGrid>
                  <SettingsFieldRow
                    label="Bot name"
                    htmlFor="bot-name"
                    required
                    helperText="Display name used in listings, chat header, and across the platform."
                  >
                    <Input
                      id="bot-name"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full"
                    />
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Tagline"
                    htmlFor="bot-tagline"
                    helperText="Short headline shown in listings and chat header."
                  >
                    <Input
                      id="bot-tagline"
                      type="text"
                      value={shortDescription}
                      onChange={(event) => setShortDescription(event.target.value)}
                      placeholder="e.g. Your 24/7 support assistant"
                      className="w-full"
                    />
                  </SettingsFieldRow>
                  <div className={SETTINGS_GRID_FULL}>
                    <SettingsFieldRow
                      label="Description"
                      htmlFor="bot-description"
                      required
                      helperText="Main public description shown to users."
                    >
                      <Textarea
                        id="bot-description"
                        rows={4}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="w-full min-h-[6rem] resize-y"
                      />
                    </SettingsFieldRow>
                  </div>
                </SettingsGrid>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Avatar"
                description="Upload or provide a visual avatar for the bot."
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                  <div className="flex flex-col">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Bot avatar preview
                    </p>
                    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
                      {previewSrc ? (
                        <div className="relative p-4">
                          <Image
                            src={previewSrc}
                            alt="Bot avatar preview"
                            width={120}
                            height={120}
                            className="rounded-xl border border-gray-200 object-cover shadow-sm dark:border-gray-600"
                            unoptimized={previewSrc.startsWith("http") || previewSrc.startsWith("blob:")}
                            onError={() => setPreviewVisible(false)}
                          />
                          {hasImage ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={isRemovingImage}
                              onClick={() => void handleRemoveAvatar()}
                              className="mt-3 w-full"
                            >
                              {isRemovingImage ? "Removing…" : "Remove avatar"}
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <SettingsEmptyState
                          title="No image"
                          description="Enter a URL or upload a file to set an avatar."
                          className="min-h-[180px] border-0 bg-transparent py-8"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <SettingsFieldRow
                      label="Image URL"
                      htmlFor="bot-image-url"
                      disabled={hasImageFile}
                      dependencyNote={hasImageFile ? "Remove the uploaded file to configure this setting." : undefined}
                    >
                      <Input
                        id="bot-image-url"
                        type="url"
                        value={botImageUrl}
                        disabled={hasImageFile}
                        onChange={(event) => {
                          setBotImageUrl(event.target.value);
                          setPreviewVisible(Boolean(event.target.value.trim()));
                        }}
                        placeholder="https://..."
                        className="w-full"
                      />
                    </SettingsFieldRow>
                    <SettingsFieldRow
                      label="Or upload file"
                      htmlFor="bot-image-upload"
                      helperText="PNG, JPG, or WEBP. Max 2MB."
                      disabled={hasImageUrl}
                      dependencyNote={hasImageUrl ? "Clear the image URL above to configure this setting." : undefined}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={hasImageUrl}
                        onChange={(event) => handleFilePick(event.target.files?.[0] ?? null)}
                      />
                      <div
                        className={`rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${hasImageUrl
                            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800"
                            : dragOver
                              ? "cursor-pointer border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                              : "cursor-pointer border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-gray-500"
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
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Drag &amp; drop here or click to browse
                        </span>
                      </div>
                    </SettingsFieldRow>
                  </div>
                </div>
              </SettingsSectionCard>
            </div>
          </TabsContent>

          <TabsContent value="behavior">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META.behavior.title}
                description={TAB_META.behavior.description}
              />
              <SettingsSectionCard
                title="Category"
                description="For organisation and behaviour context (e.g. support, sales). Not used as knowledge base content."
              >
                <div className="space-y-5">
                  <SettingsFieldRow
                    label="Presets"
                    helperText="Pick one or more. Shown as tags when selected."
                  >
                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
                      <MultiSelect
                        label="Options"
                        subtitle="Click to toggle. Selected items appear as chips below."
                        options={CATEGORY_OPTIONS}
                        value={categories}
                        onChange={(next) => {
                          if (!customCategory.trim()) setCategories(next);
                        }}
                      />
                      {categories.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {categories.map((v, i) => {
                            const opt = CATEGORY_OPTIONS.find((o) => o.value === v);
                            return (
                              <span
                                key={`category-${i}-${v}`}
                                className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-200/30 dark:text-brand-200"
                              >
                                {opt?.label ?? v}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Custom / other"
                    htmlFor="bot-custom-category"
                    helperText="Use when no preset matches."
                    disabled={categories.length > 0}
                    dependencyNote="Clear selected presets above to configure."
                  >
                    <Input
                      id="bot-custom-category"
                      value={customCategory}
                      disabled={categories.length > 0}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCustomCategory(next);
                        if (next.trim()) setCategories([]);
                      }}
                      placeholder="e.g. real-estate"
                      className="w-full"
                    />
                  </SettingsFieldRow>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Personality"
                description="Define how the bot behaves and responds during conversations."
              >
                <div className="space-y-5">
                  <SettingsFieldRow
                    label="Preset"
                    htmlFor="behavior-preset"
                    helperText="Base template; customize further with the description below."
                  >
                    <select
                      id="behavior-preset"
                      value={behaviorPreset}
                      onChange={(event) => setBehaviorPreset(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      {BEHAVIOR_PRESETS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Description"
                    htmlFor="behavior-description"
                    helperText="Additional system instructions that override or extend the preset."
                    tooltip="Shown to the model as part of the system prompt."
                  >
                    <Textarea
                      id="behavior-description"
                      rows={4}
                      value={behaviorText}
                      onChange={(event) => setBehaviorText(event.target.value)}
                      className="w-full min-h-[6rem] resize-y"
                    />
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Things to avoid"
                    htmlFor="things-to-avoid"
                    helperText="Topics or behaviours the bot should not engage with. Shown to the model as behaviour context."
                  >
                    <Textarea
                      id="things-to-avoid"
                      rows={3}
                      value={thingsToAvoid}
                      onChange={(event) => setThingsToAvoid(event.target.value)}
                      placeholder="e.g. medical advice, legal opinions, off-topic chat"
                      className="w-full min-h-[4rem] resize-y"
                    />
                  </SettingsFieldRow>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="First Message Experience"
                description="Configure what users see when they first open the chat."
              >
                <div className="space-y-5">
                  <SettingsFieldRow
                    label="Welcome message"
                    htmlFor="welcome-message"
                    helperText="Shown when the user opens the chat."
                  >
                    <Textarea
                      id="welcome-message"
                      rows={3}
                      value={welcomeMessage}
                      onChange={(event) => setWelcomeMessage(event.target.value)}
                      className="w-full min-h-[5rem] resize-y"
                    />
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Suggested questions"
                    helperText={`Quick conversation starters. ${exampleQuestions.length} of ${EXAMPLE_QUESTIONS_MAX}.`}
                  >
                    <div className="space-y-2">
                      {exampleQuestions.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 py-4 text-center text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
                          No suggested questions. Add one below.
                        </p>
                      ) : null}
                      {exampleQuestions.map((q, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2"
                        >
                          <Input
                            value={q}
                            onChange={(e) => {
                              const next = [...exampleQuestions];
                              next[index] = e.target.value;
                              setExampleQuestions(next);
                            }}
                            placeholder="e.g. What are your opening hours?"
                            className="min-w-0 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                            onClick={() =>
                              setExampleQuestions(exampleQuestions.filter((_, i) => i !== index))
                            }
                            aria-label="Remove question"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      {exampleQuestions.length < EXAMPLE_QUESTIONS_MAX ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setExampleQuestions([...exampleQuestions, ""])}
                        >
                          Add question
                        </Button>
                      ) : null}
                    </div>
                  </SettingsFieldRow>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Lead Capture"
                description="Collect contact details before sharing full answers. Enable below and add form fields."
              >
                <div className="space-y-4">
                  <LeadCaptureEditor
                    value={leadCapture}
                    onChange={setLeadCapture}
                    showFieldsWhenDisabled
                  />
                </div>
              </SettingsSectionCard>
            </div>
          </TabsContent>

          <TabsContent value="knowledge">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META.knowledge.title}
                description={TAB_META.knowledge.description}
              />
              <SettingsSectionCard
                title="Knowledge Notes"
                description="Internal notes for admins describing the scope of the bot's knowledge."
              >
                <SettingsFieldRow
                  label="Internal notes"
                  htmlFor="knowledge-description"
                  helperText="Not shown to users. Describe what knowledge you've added so other admins can understand scope."
                >
                  <Textarea
                    id="knowledge-description"
                    rows={3}
                    value={knowledgeDescription}
                    onChange={(event) => setKnowledgeDescription(event.target.value)}
                    className="w-full min-h-[5rem] resize-y"
                  />
                </SettingsFieldRow>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="FAQs"
                description="Curated questions and answers used by the bot."
              >
                <BotFaqsEditor value={faqs} onChange={setFaqs} />
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Documents"
                description="Upload and manage source documents used by the bot."
              >
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Upload files that the bot can use to answer questions.
                  </p>
                  {initialBot?.id ? (
                    <>
                      {(initialBot.documents ?? []).length === 0 ? (
                        <SettingsEmptyState
                          title="No files yet"
                          description="Upload PDF, DOC, DOCX, or TXT files below. The bot will use their content to answer questions."
                          className="py-8"
                        />
                      ) : null}
                      <BotDocumentsManager botId={initialBot.id} documents={initialBot.documents ?? []} />
                    </>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                      Save the bot first to upload documents.
                    </div>
                  )}
                </div>
              </SettingsSectionCard>

              {health ? (
                <SettingsSectionCard
                  title="Knowledge Health"
                  description="Monitor ingestion and document processing status."
                >
                  <div className="space-y-5 select-none cursor-default" aria-readonly>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</p>
                        <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{health.docsTotal}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Queued</p>
                        <p className="mt-1 text-2xl font-semibold text-gray-700 dark:text-gray-300">{health.docsQueued}</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-4 text-center shadow-sm dark:border-blue-700 dark:bg-blue-900/30">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">Processing</p>
                        <p className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-300">{health.docsProcessing}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-center shadow-sm dark:border-emerald-700 dark:bg-emerald-900/30">
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ready</p>
                        <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{health.docsReady}</p>
                      </div>
                      <div
                        className={`rounded-xl border px-4 py-4 text-center shadow-sm ${health.docsFailed > 0
                            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30"
                            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                          }`}
                      >
                        <p className={`text-xs font-medium uppercase tracking-wide ${health.docsFailed > 0 ? "text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400"}`}>
                          Failed
                        </p>
                        <p className={`mt-1 text-2xl font-semibold ${health.docsFailed > 0 ? "text-amber-800 dark:text-amber-200" : "text-gray-700 dark:text-gray-300"}`}>
                          {health.docsFailed}
                        </p>
                      </div>
                    </div>
                    {health.lastIngestedAt ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Last ingested</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {new Date(health.lastIngestedAt).toLocaleString()}
                        </p>
                      </div>
                    ) : null}
                    {health.docsFailed > 0 && health.lastFailedDoc ? (
                      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                          Latest failed document
                        </p>
                        <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
                          {health.lastFailedDoc.title || health.lastFailedDoc.docId}
                        </p>
                        {health.lastFailedDoc.error ? (
                          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                            {health.lastFailedDoc.error.length > 200
                              ? `${health.lastFailedDoc.error.slice(0, 199)}…`
                              : health.lastFailedDoc.error}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No failed documents</p>
                      </div>
                    )}
                  </div>
                </SettingsSectionCard>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="integrations">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META.integrations.title}
                description={TAB_META.integrations.description}
              />
              <SettingsSectionCard
                title="AI Provider"
                description="OpenAI API key and model parameters for this bot."
              >
                <div className="space-y-4">
                  <SettingsFieldRow
                    label="OpenAI API key override"
                    htmlFor="openai-api-key"
                    helperText="Leave blank to use the account default. Stored securely."
                  >
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          id="openai-api-key"
                          type="password"
                          value={openaiApiKeyOverride}
                          onChange={(event) => setOpenaiApiKeyOverride(event.target.value)}
                          placeholder="sk-..."
                          className="min-w-0 flex-1"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="shrink-0 sm:self-stretch"
                          disabled={testingKey || !openaiApiKeyOverride?.trim()}
                          onClick={async () => {
                            setTestingKey(true);
                            setTestResult(null);
                            try {
                              const response = await apiFetch("/api/super-admin/openai/test-key", {
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
                          {testingKey ? "Testing…" : "Test key"}
                        </Button>
                      </div>
                      {testResult ? (
                        <p
                          className={`text-xs ${testResult.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
                        >
                          {testResult.message}
                        </p>
                      ) : !openaiApiKeyOverride?.trim() ? (
                        <SettingsDependencyAlert>Enter a key above to test.</SettingsDependencyAlert>
                      ) : null}
                    </div>
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Language"
                    htmlFor="ai-language"
                    helperText="e.g. en-US. Affects model instructions when set."
                  >
                    <Input
                      id="ai-language"
                      value={personality.language ?? ""}
                      onChange={(event) =>
                        setPersonality((prev) => ({ ...prev, language: event.target.value || undefined }))
                      }
                      placeholder="en-US"
                      className="max-w-xs"
                    />
                  </SettingsFieldRow>
                  <SettingsGrid>
                    <SettingsFieldRow
                      label="Temperature"
                      htmlFor="ai-temperature"
                      tooltip="Lower values produce more predictable responses; higher values more varied."
                    >
                      <Input
                        id="ai-temperature"
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.temperature ?? 0.3}
                        onChange={(event) =>
                          setConfig((prev) => ({ ...prev, temperature: Number(event.target.value) }))
                        }
                        className="w-24"
                      />
                    </SettingsFieldRow>
                    <SettingsFieldRow
                      label="Max tokens"
                      htmlFor="ai-max-tokens"
                      tooltip="Maximum length of each model response in tokens."
                    >
                      <Input
                        id="ai-max-tokens"
                        type="number"
                        min={1}
                        value={config.maxTokens ?? 512}
                        onChange={(event) =>
                          setConfig((prev) => ({ ...prev, maxTokens: Math.max(1, Number(event.target.value)) }))
                        }
                        className="w-24"
                      />
                    </SettingsFieldRow>
                  </SettingsGrid>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Voice Configuration"
                description="Whisper API key for voice-to-text when the mic is enabled in Chat Experience."
              >
                <div className="space-y-4">
                  <SettingsFieldRow
                    label="Whisper API key"
                    htmlFor="whisper-api-key"
                    helperText="Use your OpenAI API key or an endpoint-specific key. Leave blank to use the main OpenAI key."
                    disabled={chatUI.showMic !== true}
                    dependencyNote={chatUI.showMic !== true ? "Enable the microphone in Chat Experience to configure this setting." : undefined}
                  >
                    <Input
                      id="whisper-api-key"
                      type="password"
                      value={whisperApiKeyOverride}
                      disabled={chatUI.showMic !== true}
                      onChange={(e) => setWhisperApiKeyOverride(e.target.value)}
                      placeholder="sk-... or leave blank to use main OpenAI key"
                      autoComplete="off"
                    />
                  </SettingsFieldRow>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Future Integrations"
                description="Webhooks, CRM, and channels will be configurable here when available."
              >
                <SettingsEmptyState
                  title="Coming soon"
                  description="External integrations such as webhooks, CRM connections, and channels can be added here later."
                />
              </SettingsSectionCard>
            </div>
          </TabsContent>

          <TabsContent value="chat-experience">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META["chat-experience"].title}
                description={TAB_META["chat-experience"].description}
              />
              <SettingsSectionCard
                title="Input Tools"
                description="Configure the input methods available in the chat composer."
              >
                <div className="space-y-3">
                  <SettingsToggleRow
                    label="Allow file uploads in chat"
                    htmlFor="allow-file-upload"
                    helperText="Let users attach files in the composer."
                    control={
                      <input
                        id="allow-file-upload"
                        type="checkbox"
                        checked={chatUI.allowFileUpload === true}
                        onChange={(e) => setChatUI((prev) => ({ ...prev, allowFileUpload: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    }
                  />
                  <SettingsToggleRow
                    label="Show mic button"
                    htmlFor="show-mic"
                    helperText="Voice input also requires Whisper configuration in Integrations & AI."
                    control={
                      <input
                        id="show-mic"
                        type="checkbox"
                        checked={chatUI.showMic === true}
                        onChange={(e) => setChatUI((prev) => ({ ...prev, showMic: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    }
                  />
                  <SettingsToggleRow
                    label="Show emoji picker in composer"
                    htmlFor="show-emoji"
                    control={
                      <input
                        id="show-emoji"
                        type="checkbox"
                        checked={chatUI.showEmoji !== false}
                        onChange={(e) => setChatUI((prev) => ({ ...prev, showEmoji: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    }
                  />
                  <SettingsToggleRow
                    label="Show chat input with suggested questions"
                    htmlFor="show-composer-suggested"
                    control={
                      <input
                        id="show-composer-suggested"
                        type="checkbox"
                        checked={chatUI.showComposerWithSuggestedQuestions === true}
                        onChange={(e) =>
                          setChatUI((prev) => ({ ...prev, showComposerWithSuggestedQuestions: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    }
                  />
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Message Features"
                description="Control actions and metadata on chat messages."
              >
                <div className="space-y-4">
                  <div className="space-y-3">
                    <SettingsToggleRow
                      label="Show copy button"
                      htmlFor="show-copy"
                      control={
                        <input
                          id="show-copy"
                          type="checkbox"
                          checked={chatUI.showCopyButton !== false}
                          onChange={(e) => setChatUI((prev) => ({ ...prev, showCopyButton: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsToggleRow
                      label="Show sources"
                      htmlFor="show-sources"
                      control={
                        <input
                          id="show-sources"
                          type="checkbox"
                          checked={chatUI.showSources !== false}
                          onChange={(e) => setChatUI((prev) => ({ ...prev, showSources: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsToggleRow
                      label="Show sender/assistant name"
                      htmlFor="show-sender-name"
                      control={
                        <input
                          id="show-sender-name"
                          type="checkbox"
                          checked={chatUI.showSenderName !== false}
                          onChange={(e) => setChatUI((prev) => ({ ...prev, showSenderName: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsToggleRow
                      label="Show message time"
                      htmlFor="show-time"
                      control={
                        <input
                          id="show-time"
                          type="checkbox"
                          checked={chatUI.showTime !== false}
                          onChange={(e) => setChatUI((prev) => ({ ...prev, showTime: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                  </div>
                  {chatUI.showTime !== false ? (
                    <SettingsFieldRow label="Time position" htmlFor="time-position">
                      <select
                        id="time-position"
                        value={chatUI.timePosition ?? "top"}
                        onChange={(e) =>
                          setChatUI((prev) => ({ ...prev, timePosition: e.target.value as ChatTimePosition }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="top">Top (above message)</option>
                        <option value="bottom">Bottom (assistant right, user left)</option>
                      </select>
                    </SettingsFieldRow>
                  ) : (
                    <SettingsFieldRow
                      label="Time position"
                      htmlFor="time-position-disabled"
                      disabled
                      dependencyNote="Enable message time above to configure."
                    >
                      <select
                        id="time-position-disabled"
                        disabled
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500"
                      >
                        <option>—</option>
                      </select>
                    </SettingsFieldRow>
                  )}
                  {chatUI.showSenderName !== false ? (
                    <SettingsFieldRow
                      label="Sender / assistant custom name"
                      htmlFor="sender-name"
                      helperText="Displayed above assistant messages when names are shown."
                    >
                      <Input
                        id="sender-name"
                        value={chatUI.senderName ?? ""}
                        onChange={(e) => setChatUI((prev) => ({ ...prev, senderName: e.target.value || undefined }))}
                        placeholder={name ? `${name} - AI` : "Bot Name - AI"}
                      />
                    </SettingsFieldRow>
                  ) : (
                    <SettingsFieldRow
                      label="Sender / assistant custom name"
                      htmlFor="sender-name-disabled"
                      disabled
                      dependencyNote="Enable showing sender/assistant name to configure this setting."
                    >
                      <Input id="sender-name-disabled" value="" disabled placeholder="Custom name" className="opacity-60" />
                    </SettingsFieldRow>
                  )}
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Header & Presence"
                description="Control identity and status information displayed in the chat header."
              >
                <div className="space-y-4">
                  <SettingsGrid>
                    <SettingsToggleRow
                      label="Show bot avatar in header"
                      htmlFor="show-avatar-header"
                      control={
                        <input
                          id="show-avatar-header"
                          type="checkbox"
                          checked={chatUI.showAvatarInHeader !== false}
                          onChange={(e) =>
                            setChatUI((prev) => ({ ...prev, showAvatarInHeader: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsFieldRow label="Indicator" htmlFor="status-indicator">
                      <select
                        id="status-indicator"
                        value={chatUI.statusIndicator ?? "none"}
                        onChange={(e) =>
                          setChatUI((prev) => ({
                            ...prev,
                            statusIndicator: e.target.value as ChatStatusIndicator,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="none">None</option>
                        <option value="live">Live</option>
                        <option value="active">Active</option>
                      </select>
                    </SettingsFieldRow>
                    {(chatUI.statusIndicator === "live" || chatUI.statusIndicator === "active") ? (
                      <>
                        <SettingsFieldRow label="Style" htmlFor="live-indicator-style">
                          <select
                            id="live-indicator-style"
                            value={chatUI.liveIndicatorStyle ?? "label"}
                            onChange={(e) =>
                              setChatUI((prev) => ({
                                ...prev,
                                liveIndicatorStyle: e.target.value as LiveIndicatorStyle,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                          >
                            <option value="label">Label + dot (next to bot name)</option>
                            <option value="dot-only">Dot only (on avatar)</option>
                          </select>
                        </SettingsFieldRow>
                        <SettingsFieldRow label="Dot style" htmlFor="status-dot-style">
                          <select
                            id="status-dot-style"
                            value={chatUI.statusDotStyle ?? "blinking"}
                            onChange={(e) =>
                              setChatUI((prev) => ({
                                ...prev,
                                statusDotStyle: e.target.value as "blinking" | "static",
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                          >
                            <option value="blinking">Blinking</option>
                            <option value="static">Static</option>
                          </select>
                        </SettingsFieldRow>
                      </>
                    ) : (
                      <>
                        <SettingsFieldRow
                          label="Style"
                          htmlFor="live-indicator-style-disabled"
                          disabled
                          dependencyNote="Select an indicator above to customize."
                        >
                          <select id="live-indicator-style-disabled" disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500">
                            <option>—</option>
                          </select>
                        </SettingsFieldRow>
                        <SettingsFieldRow
                          label="Dot style"
                          htmlFor="status-dot-style-disabled"
                          disabled
                          dependencyNote="Select an indicator above to customize."
                        >
                          <select id="status-dot-style-disabled" disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500">
                            <option>—</option>
                          </select>
                        </SettingsFieldRow>
                      </>
                    )}
                  </SettingsGrid>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Navigation & Utility"
                description="Extra features that improve chat usability."
              >
                <div className="space-y-4">
                  <div className="space-y-3">
                    <SettingsToggleRow
                      label="Scroll-to-bottom button"
                      htmlFor="scroll-to-bottom"
                      control={
                        <input
                          id="scroll-to-bottom"
                          type="checkbox"
                          checked={chatUI.showScrollToBottom !== false}
                          onChange={(e) =>
                            setChatUI((prev) => ({ ...prev, showScrollToBottom: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsToggleRow
                      label="Message list scrollbar"
                      htmlFor="show-scrollbar"
                      control={
                        <input
                          id="show-scrollbar"
                          type="checkbox"
                          checked={chatUI.showScrollbar !== false}
                          onChange={(e) => setChatUI((prev) => ({ ...prev, showScrollbar: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsToggleRow
                      label="Expand chat in menu"
                      htmlFor="show-menu-expand"
                      control={
                        <input
                          id="show-menu-expand"
                          type="checkbox"
                          checked={chatUI.showMenuExpand !== false}
                          onChange={(e) =>
                            setChatUI((prev) => ({ ...prev, showMenuExpand: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsToggleRow
                      label="Open chat on page load"
                      htmlFor="open-chat-on-load"
                      control={
                        <input
                          id="open-chat-on-load"
                          type="checkbox"
                          checked={chatUI.openChatOnLoad !== false}
                          onChange={(e) =>
                            setChatUI((prev) => ({ ...prev, openChatOnLoad: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                      Max 3 links. Each item: text label and route (path or URL).
                    </p>
                    <MenuQuickLinksEditor
                      value={chatUI.menuQuickLinks}
                      onChange={(next) =>
                        setChatUI((prev) => ({ ...prev, menuQuickLinks: next }))
                      }
                    />
                  </div>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Composer Layout"
                description="Control how the message input area is displayed."
              >
                <SettingsToggleRow
                  label="Separate message input box"
                  htmlFor="composer-separate"
                  helperText="When enabled, the input is shown in a distinct box below the messages instead of inline. Gives a clearer separation between conversation and composer."
                  control={
                    <input
                      id="composer-separate"
                      type="checkbox"
                      checked={chatUI.composerAsSeparateBox === true}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, composerAsSeparateBox: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
              </SettingsSectionCard>
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META.appearance.title}
                description={TAB_META.appearance.description}
              />
              <SettingsSectionCard
                title="Theme"
                description="Colors, background, and panel styling for the chat widget."
              >
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Theme preview
                  </p>
                  <div
                    className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${chatUI.backgroundStyle === "dark"
                        ? "border-gray-600 bg-gray-800"
                        : chatUI.backgroundStyle === "auto"
                          ? "border-gray-300 bg-gradient-to-r from-gray-100 to-gray-800 dark:border-gray-600"
                          : "border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
                      }`}
                    aria-hidden
                  >
                    <div
                      className="h-6 w-6 shrink-0 rounded-md border border-white/20 shadow-sm"
                      style={{
                        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                          ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                          : DEFAULT_CHAT_UI.primaryColor,
                      }}
                    />
                    <div
                      className="max-w-[120px] px-2.5 py-1.5 text-xs text-white shadow-sm"
                      style={{
                        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                          ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                          : DEFAULT_CHAT_UI.primaryColor,
                        borderRadius: `${Math.min(BUBBLE_RADIUS_MAX, Math.max(BUBBLE_RADIUS_MIN, chatUI.bubbleBorderRadius ?? 20))}px`,
                      }}
                    >
                      Sample bubble
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {chatUI.backgroundStyle === "dark" ? "Dark" : chatUI.backgroundStyle === "light" ? "Light" : "Auto"}
                    </span>
                  </div>
                </div>
                <SettingsGrid>
                  <SettingsFieldRow
                    label="Primary color"
                    htmlFor="primary-color"
                    helperText="Brand accent for assistant bubbles and highlights."
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-300 shadow-inner dark:border-gray-600"
                        style={{
                          backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                            ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                            : DEFAULT_CHAT_UI.primaryColor,
                        }}
                        aria-hidden
                      />
                      <input
                        id="primary-color"
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                          ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                          : DEFAULT_CHAT_UI.primaryColor}
                        onChange={(e) => setChatUI((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="h-10 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-600"
                        aria-label="Primary color picker"
                      />
                      <Input
                        value={chatUI.primaryColor ?? ""}
                        onChange={(e) => setChatUI((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#14B8A6"
                        className="min-w-0 flex-1 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() =>
                          setChatUI((prev) => ({ ...prev, primaryColor: DEFAULT_CHAT_UI.primaryColor }))
                        }
                      >
                        Reset
                      </Button>
                    </div>
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Background style"
                    htmlFor="background-style"
                    helperText="Light, dark, or match system (auto)."
                  >
                    <select
                      id="background-style"
                      value={chatUI.backgroundStyle ?? "light"}
                      onChange={(e) =>
                        setChatUI((prev) => ({
                          ...prev,
                          backgroundStyle: e.target.value as BotChatUI["backgroundStyle"],
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="auto">Auto</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </SettingsFieldRow>
                  <SettingsFieldRow label="Shadow intensity" htmlFor="shadow-intensity">
                    <select
                      id="shadow-intensity"
                      value={chatUI.shadowIntensity ?? "medium"}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, shadowIntensity: e.target.value as ChatShadowIntensity }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="none">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </SettingsFieldRow>
                  <SettingsFieldRow label="Chat panel border" htmlFor="chat-panel-border">
                    <div className="flex items-center gap-2">
                      <input
                        id="chat-panel-border"
                        type="checkbox"
                        checked={chatUI.showChatBorder !== false}
                        onChange={(e) =>
                          setChatUI((prev) => ({ ...prev, showChatBorder: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Show border around chat panel</span>
                    </div>
                  </SettingsFieldRow>
                  <SettingsFieldRow
                    label="Message bubble radius"
                    htmlFor="bubble-radius"
                    helperText={`Corner radius in px (${BUBBLE_RADIUS_MIN}–${BUBBLE_RADIUS_MAX}). Affects message bubbles and suggested chips.`}
                  >
                    <Input
                      id="bubble-radius"
                      type="number"
                      min={BUBBLE_RADIUS_MIN}
                      max={BUBBLE_RADIUS_MAX}
                      value={chatUI.bubbleBorderRadius ?? 20}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n))
                          setChatUI((prev) => ({
                            ...prev,
                            bubbleBorderRadius: Math.max(BUBBLE_RADIUS_MIN, Math.min(BUBBLE_RADIUS_MAX, n)),
                          }));
                      }}
                      className="w-24"
                    />
                  </SettingsFieldRow>
                </SettingsGrid>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Launcher"
                description="Position, icon, and size of the chat launcher button."
              >
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Launcher preview
                    </p>
                    <div
                      className="relative h-20 w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-600"
                      aria-hidden
                    >
                      <div
                        className={`absolute flex items-center justify-center rounded-full border-2 border-white shadow-md ${chatUI.launcherPosition === "bottom-left" ? "left-3 bottom-3" : "right-3 bottom-3"
                          }`}
                        style={{
                          width: (() => {
                            const px = Math.min(96, Math.max(32, chatUI.launcherSize ?? 48));
                            return Math.round((px * 56) / 96);
                          })(),
                          height: (() => {
                            const px = Math.min(96, Math.max(32, chatUI.launcherSize ?? 48));
                            return Math.round((px * 56) / 96);
                          })(),
                          minWidth: 20,
                          minHeight: 20,
                          backgroundColor:
                            /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                              ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                              : DEFAULT_CHAT_UI.primaryColor,
                        }}
                      >
                        {chatUI.launcherIcon === "bot-avatar" && (botImageObjectUrl || botImageUrl) ? (
                          <img
                            src={botImageObjectUrl || botImageUrl || ""}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : chatUI.launcherIcon === "custom" && chatUI.launcherAvatarUrl ? (
                          <img
                            src={chatUI.launcherAvatarUrl}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <svg
                            className="h-1/2 w-1/2 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                  <SettingsGrid>
                    <SettingsFieldRow
                      label="Launcher position"
                      htmlFor="launcher-position"
                      helperText="Where the launcher button appears on screen."
                    >
                      <select
                        id="launcher-position"
                        value={chatUI.launcherPosition ?? "bottom-right"}
                        onChange={(e) =>
                          setChatUI((prev) => ({
                            ...prev,
                            launcherPosition: e.target.value as BotChatUI["launcherPosition"],
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="bottom-right">Bottom right</option>
                        <option value="bottom-left">Bottom left</option>
                      </select>
                    </SettingsFieldRow>
                    <SettingsFieldRow
                      label="Launcher icon"
                      htmlFor="launcher-icon"
                      helperText="Default icon, bot avatar, or custom image."
                    >
                      <select
                        id="launcher-icon"
                        value={chatUI.launcherIcon ?? "default"}
                        onChange={(e) =>
                          setChatUI((prev) => ({ ...prev, launcherIcon: e.target.value as ChatLauncherIcon }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="default">Default</option>
                        <option value="bot-avatar">Bot Avatar</option>
                        <option value="custom">Custom</option>
                      </select>
                    </SettingsFieldRow>
                    <SettingsFieldRow
                      label="Launcher size"
                      htmlFor="launcher-size"
                      helperText="Button size in pixels (32–96)."
                    >
                      <Input
                        id="launcher-size"
                        type="number"
                        min={32}
                        max={96}
                        value={chatUI.launcherSize ?? 48}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n))
                            setChatUI((prev) => ({
                              ...prev,
                              launcherSize: Math.max(32, Math.min(96, n)),
                            }));
                        }}
                        className="w-24"
                      />
                    </SettingsFieldRow>
                    <SettingsFieldRow
                      label="Ring width"
                      htmlFor="launcher-ring-width"
                      helperText="Ring around avatar, 0–30%. 0 = none."
                    >
                      <Input
                        id="launcher-ring-width"
                        type="number"
                        min={0}
                        max={30}
                        value={chatUI.launcherAvatarRingWidth ?? 18}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n))
                            setChatUI((prev) => ({
                              ...prev,
                              launcherAvatarRingWidth: Math.max(0, Math.min(30, n)),
                            }));
                        }}
                        className="w-24"
                      />
                    </SettingsFieldRow>
                  </SettingsGrid>
                  <div className="space-y-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Custom launcher avatar
                    </p>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                      <div className="flex flex-col">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Preview
                        </p>
                        <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
                          {chatUI.launcherAvatarUrl ? (
                            <div className="relative p-4">
                              <img
                                src={chatUI.launcherAvatarUrl}
                                alt="Custom launcher avatar preview"
                                className="h-24 w-24 rounded-full border border-gray-200 object-cover shadow-sm dark:border-gray-600"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setChatUI((prev) => ({ ...prev, launcherAvatarUrl: undefined }))}
                                className="mt-3 w-full"
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <SettingsEmptyState
                              title="No image"
                              description="Upload or paste image URL below."
                              className="min-h-[140px] border-0 bg-transparent py-6"
                            />
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Upload or paste image URL. Used when Launcher icon is “Custom”. PNG, JPG or WEBP. Max 2MB.
                        </p>
                        <input
                          id="launcher-custom"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200 dark:text-gray-400"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || file.size > 2 * 1024 * 1024) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const dataUrl = reader.result;
                              if (typeof dataUrl === "string")
                                setChatUI((prev) => ({ ...prev, launcherAvatarUrl: dataUrl }));
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                        <Input
                          value={typeof chatUI.launcherAvatarUrl === "string" && chatUI.launcherAvatarUrl.startsWith("http") ? chatUI.launcherAvatarUrl : ""}
                          onChange={(e) =>
                            setChatUI((prev) => ({ ...prev, launcherAvatarUrl: e.target.value || undefined }))
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Open Animation"
                description="How the chat panel appears when opened."
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400" id="open-animation-label">
                    Chat open animation
                  </p>
                  <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                    role="radiogroup"
                    aria-labelledby="open-animation-label"
                  >
                    {(
                      [
                        { value: "slide-up-fade" as const, label: "Slide up + fade" },
                        { value: "fade" as const, label: "Fade" },
                        { value: "expand" as const, label: "Expand" },
                      ] as const
                    ).map(({ value, label }) => {
                      const selected = (chatUI.chatOpenAnimation ?? "slide-up-fade") === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            setChatUI((prev) => ({ ...prev, chatOpenAnimation: value }))
                          }
                          className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${selected
                              ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-200"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Composer Styling"
                description="Border width and color for the message input box. Only applies when the input is shown as a separate box (Chat Experience → Composer Layout)."
              >
                <div className="space-y-4">
                  {chatUI.composerAsSeparateBox !== false ? (
                    <SettingsGrid>
                      <SettingsFieldRow
                        label="Border width"
                        htmlFor="composer-border-width"
                        helperText="0 = 1px default; 0.5–6 = custom. Focus state uses 50% thicker border."
                      >
                        <Input
                          id="composer-border-width"
                          type="number"
                          min={0}
                          max={6}
                          step={0.5}
                          value={chatUI.composerBorderWidth ?? 1}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            if (!Number.isNaN(n)) {
                              const clamped =
                                n > 0 && n < 0.5 ? 0.5 : Math.max(0, Math.min(6, n));
                              setChatUI((prev) => ({ ...prev, composerBorderWidth: clamped }));
                            }
                          }}
                          className="w-24"
                        />
                      </SettingsFieldRow>
                      <SettingsFieldRow
                        label="Border color"
                        htmlFor="composer-border-color"
                        helperText="Color of the message input box border."
                      >
                        <select
                          id="composer-border-color"
                          value={chatUI.composerBorderColor ?? "primary"}
                          onChange={(e) =>
                            setChatUI((prev) => ({
                              ...prev,
                              composerBorderColor: e.target.value as "default" | "primary",
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        >
                          <option value="default">Default (gray)</option>
                          <option value="primary">Primary color</option>
                        </select>
                      </SettingsFieldRow>
                    </SettingsGrid>
                  ) : (
                    <>
                      <SettingsDependencyAlert>
                        Enable “Separate message input box” in Chat Experience to configure this setting.
                      </SettingsDependencyAlert>
                      <div className="flex flex-wrap gap-4 opacity-60">
                        <SettingsFieldRow label="Border width" htmlFor="composer-border-width-disabled">
                          <Input id="composer-border-width-disabled" type="number" value={0} disabled className="w-24" />
                        </SettingsFieldRow>
                        <SettingsFieldRow label="Border color" htmlFor="composer-border-color-disabled">
                          <select
                            id="composer-border-color-disabled"
                            disabled
                            className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                          >
                            <option>—</option>
                          </select>
                        </SettingsFieldRow>
                      </div>
                    </>
                  )}
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Branding"
                description="Footer text and attribution shown in the chat widget."
              >
                <div className="space-y-4">
                  {chatUI.showBranding !== false ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-800/50">
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Footer preview
                      </p>
                      <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-center dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {chatUI.brandingMessage?.trim() || "Your branding message will appear here."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <SettingsToggleRow
                    label="Show branding"
                    htmlFor="show-branding"
                    control={
                      <input
                        id="show-branding"
                        type="checkbox"
                        checked={chatUI.showBranding !== false}
                        onChange={(e) =>
                          setChatUI((prev) => ({ ...prev, showBranding: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    }
                  />
                  {chatUI.showBranding !== false ? (
                    <SettingsFieldRow
                      label="Branding message"
                      htmlFor="branding-message"
                      helperText="Editable text shown in chat footer (e.g. “Powered by …”)."
                    >
                      <Input
                        id="branding-message"
                        value={chatUI.brandingMessage ?? ""}
                        onChange={(e) =>
                          setChatUI((prev) => ({ ...prev, brandingMessage: e.target.value || undefined }))
                        }
                        placeholder="Your conversations are private and secure."
                      />
                    </SettingsFieldRow>
                  ) : (
                    <SettingsFieldRow
                      label="Branding message"
                      htmlFor="branding-message-disabled"
                      disabled
                      dependencyNote="Enable Show branding to configure this setting."
                    >
                      <Input id="branding-message-disabled" value="" disabled placeholder="Branding message" className="opacity-60" />
                    </SettingsFieldRow>
                  )}
                </div>
              </SettingsSectionCard>
            </div>
          </TabsContent>

          <TabsContent value="publish">
            <div className={TAB_CONTENT_CLASS}>
              <SettingsPageHeader
                title={TAB_META.publish.title}
                description={TAB_META.publish.description}
              />

              <SettingsSectionCard
                title="Visibility"
                description="Control whether the bot is private or publicly available."
              >
                <SettingsToggleRow
                  label="Public bot"
                  htmlFor="bot-public"
                  helperText="When enabled, this bot can be listed or accessed publicly."
                >
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      id="bot-public"
                      type="checkbox"
                      checked={isPublic}
                      onChange={(event) => setIsPublic(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
                  </label>
                </SettingsToggleRow>
              </SettingsSectionCard>

              {mode === "edit" && (
                <SettingsSectionCard
                  title="Summary"
                  description="Quick view of key settings before publishing."
                >
                  <div className="grid grid-cols-1 gap-3 select-none sm:grid-cols-3" aria-readonly>
                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Visibility
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {isPublic ? "Public" : "Private"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Docs ready
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {typeof health?.docsReady === "number" ? health.docsReady : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Current status
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {status === "draft" ? "Draft" : "Published"}
                      </p>
                    </div>
                  </div>
                </SettingsSectionCard>
              )}

              <SettingsSectionCard
                title="Status"
                description="Draft: bot is saved but not listed or discoverable. Published: bot is live and available according to visibility settings."
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400" id="publish-status-label">
                    Bot status
                  </p>
                  <div
                    className="inline-flex rounded-xl border-2 border-gray-200 bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800/50"
                    role="radiogroup"
                    aria-labelledby="publish-status-label"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={status === "draft"}
                      className={`min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${status === "draft"
                          ? "border border-gray-300 bg-white text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      onClick={() => setStatus("draft")}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={status === "published"}
                      className={`min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${status === "published"
                          ? "border-2 border-brand-500 bg-brand-600 text-white shadow-sm dark:border-brand-400 dark:bg-brand-500"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      onClick={() => setStatus("published")}
                    >
                      Published
                    </button>
                  </div>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Validation"
                description="Complete these before publishing so the bot is ready to use."
              >
                <ul className="space-y-2" role="list" aria-label="Publish readiness checklist">
                  <li>
                    <div
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${name.trim()
                          ? "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"
                          : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                        }`}
                    >
                      {name.trim() ? (
                        <span className="mt-0.5 text-green-600 dark:text-green-400" aria-hidden>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${name.trim() ? "text-gray-900 dark:text-gray-100" : "text-amber-800 dark:text-amber-200"}`}>
                          Bot name present
                        </p>
                        {!name.trim() ? (
                          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Add a name in General.</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                  <li>
                    <div
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${description.trim()
                          ? "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"
                          : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                        }`}
                    >
                      {description.trim() ? (
                        <span className="mt-0.5 text-green-600 dark:text-green-400" aria-hidden>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${description.trim() ? "text-gray-900 dark:text-gray-100" : "text-amber-800 dark:text-amber-200"}`}>
                          Description present
                        </p>
                        {!description.trim() ? (
                          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Add a description in General.</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                </ul>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Actions"
                description="Save as draft anytime. Publish when the checklist above is complete."
              >
                <div className="space-y-4">
                  {isPublishBlocked ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      Resolve validation issues before publishing.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={isPublishBlocked}
                      onClick={() => void submitWithStatus("published")}
                    >
                      Publish bot
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void submitWithStatus("draft")}>
                      Save draft
                    </Button>
                    {mode === "edit" && onCreateAnotherBot ? (
                      <Button type="button" variant="ghost" onClick={onCreateAnotherBot} className="text-gray-600 dark:text-gray-400">
                        Create new bot
                      </Button>
                    ) : null}
                  </div>
                </div>
              </SettingsSectionCard>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </form>
  );
}
