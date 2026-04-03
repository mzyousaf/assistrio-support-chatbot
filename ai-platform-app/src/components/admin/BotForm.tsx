"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { SettingsSideSheet } from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useDebouncedDirtyNotify } from "@/hooks/useDebouncedDirtyNotify";
import { useJsonSnapshot } from "@/hooks/useJsonSnapshot";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/api";
import { normalizeLeadCapture } from "@/lib/leadCapture";
import { normalizeVisitorMultiChatMax } from "@/lib/visitorMultiChatMax";
import { computeLaunchReadiness } from "@/lib/launch-readiness";
import {
  allowedDomainRowFromStored,
  canonicalEmbedOrigin,
  isForbiddenEmbedDomainInput,
  rowIsValidAllowedDomainRow,
  serializeAllowedDomainRowUnion,
  type AllowedDomainRow,
} from "@/lib/embedAllowedDomains";
import { listResolvedHostnamesForDomainGroup, serializeDomainGroup } from "@/lib/embedDomainUi";
import { getBotsBasePath } from "@/components/admin/admin-shell-config";
import { useEmbedPreview } from "@/contexts/EmbedPreviewContext";
import { useLaunchReadinessSidebarState } from "@/contexts/LaunchReadinessSidebarContext";
import { SettingsEmbedPreview } from "@/components/admin/settings/SettingsEmbedPreview";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import {
  editorTabToSlug,
  isEditorTabValue,
  slugToEditorTab,
  type EditorTabValue,
} from "@/lib/agent-slug-to-tab";
import {
  type BotChatUI,
  type BotConfig,
  type BotLeadCaptureV2,
  type BotPersonality,
} from "@/models/Bot";
import type { BotFaq } from "@/components/admin/BotFaqsEditor";
import type { KnowledgePollHealthPayload } from "@/components/admin/BotDocumentsManager";

import type { BotFormSubmitPayload } from "./bot-form-sections/botFormSubmitPayload";
import type { BotFormProps } from "./bot-form-sections/botFormProps";
export type { BotFormSubmitPayload } from "./bot-form-sections/botFormSubmitPayload";
export type { BotFormProps } from "./bot-form-sections/botFormProps";
import { BotFormEditorProvider } from "./bot-form-sections/BotFormEditorContext";
import type { BotFormEditorModel } from "./bot-form-sections/BotFormEditorModel";
import { buildChatUiPayload, DEFAULT_CHAT_UI, presetToPrompt } from "./bot-form-sections/botFormPayloadUtils";
import { EXAMPLE_QUESTIONS_MAX, TAB_IDS } from "./bot-form-sections/botFormUiConstants";
import { DEFAULT_WELCOME_MESSAGE } from "./bot-form-sections/welcomeMessagePreview";
import { isSafeImagePreviewSrc } from "./bot-form-sections/imagePreviewUtils";
import { ProfileSection } from "./bot-form-sections/ProfileSection";
import { BehaviorSection } from "./bot-form-sections/BehaviorSection";
import { KnowledgeSection } from "./bot-form-sections/KnowledgeSection";
import { AiIntegrationsSection } from "./bot-form-sections/AiIntegrationsSection";
import { ChatSection } from "./bot-form-sections/ChatSection";
import { AppearanceSection } from "./bot-form-sections/AppearanceSection";
import { PublishSection } from "./bot-form-sections/PublishSection";

/** Stable fallbacks so `useJsonSnapshot` does not see a new [] / {} every render. */
const EMPTY_JSON_ARRAY: unknown[] = [];
const EMPTY_JSON_OBJECT: Record<string, unknown> = {};

function normalizeDomainsListKey(text: string): string {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join("\n");
}

function allowedDomainsFingerprint(rows: AllowedDomainRow[]): string {
  return normalizeDomainsListKey(
    rows
      .map((r) => serializeAllowedDomainRowUnion(r))
      .filter((x): x is string => x != null)
      .join("\n"),
  );
}

function allowedDomainsFingerprintFromStored(stored: string[] | undefined): string {
  return normalizeDomainsListKey(
    (stored ?? [])
      .map((s) => serializeAllowedDomainRowUnion(allowedDomainRowFromStored(s)))
      .filter((x): x is string => x != null)
      .join("\n"),
  );
}

/** Single interval for Knowledge base tab: document list + health (docs queued/processing/ready, etc.). */
const KNOWLEDGE_BASE_POLL_INTERVAL_MS = 5000;

export default function BotForm({
  mode,
  initialBot,
  onSubmit,
  onCreateAnotherBot,
  submitting = false,
  formId,
  onDirtyChange,
  onSavingChange,
  botId,
  onRetryFaq,
  onRetryNote,
  workspaceSectionSlug,
}: BotFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const maxAllowedDomains = user?.role === "superadmin" ? 10 : 1;
  const emptyDomainRow = (): AllowedDomainRow => ({
    mode: "domain",
    main: "",
    includeApex: true,
    subLabels: [],
  });

  const [allowedDomainRows, setAllowedDomainRows] = useState<AllowedDomainRow[]>(() => {
    const raw = initialBot?.allowedDomains ?? [];
    const parsed = raw
      .map((d) => allowedDomainRowFromStored(String(d)))
      .filter((r) => (r.mode === "exact" ? r.value.trim() : r.main.trim()));
    return parsed.length > 0 ? parsed : [emptyDomainRow()];
  });

  useEffect(() => {
    if (maxAllowedDomains !== 1) return;
    setAllowedDomainRows((rows) => {
      if (rows.length <= 1) return rows.length === 0 ? [emptyDomainRow()] : rows;
      const first = rows.find((r) => rowIsValidAllowedDomainRow(r)) ?? rows[0];
      return first ? [first] : [emptyDomainRow()];
    });
  }, [maxAllowedDomains]);

  const [name, setName] = useState(initialBot?.name ?? "");
  const [shortDescription, setShortDescription] = useState(initialBot?.shortDescription ?? "");
  const [includeNameInKnowledge, setIncludeNameInKnowledge] = useState(initialBot?.includeNameInKnowledge ?? false);
  const [description, setDescription] = useState(initialBot?.description ?? "");
  const [isPublic, setIsPublic] = useState(initialBot?.isPublic ?? true);
  const [visibility, setVisibility] = useState<"public" | "private">(
    initialBot?.visibility === "private" ? "private" : "public",
  );
  const [accessKey, setAccessKey] = useState(initialBot?.accessKey ?? "");
  const [secretKey, setSecretKey] = useState(initialBot?.secretKey ?? "");
  const [creatorType] = useState<"user" | "visitor">(
    initialBot?.creatorType === "visitor" ? "visitor" : "user",
  );
  const [ownerVisitorId] = useState<string | undefined>(initialBot?.ownerVisitorId);
  const [visitorMultiChatEnabled, setVisitorMultiChatEnabled] = useState(
    () => initialBot?.visitorMultiChatEnabled === true,
  );
  const [visitorMultiChatCapUnlimited, setVisitorMultiChatCapUnlimited] = useState(() => {
    if (initialBot?.visitorMultiChatEnabled !== true) return true;
    const m = initialBot?.visitorMultiChatMax;
    return m === null || m === undefined;
  });
  const [visitorMultiChatMax, setVisitorMultiChatMax] = useState(() => {
    if (initialBot?.visitorMultiChatEnabled !== true) return "5";
    const n = normalizeVisitorMultiChatMax(initialBot?.visitorMultiChatMax);
    return n !== null ? String(n) : "5";
  });
  const [accessActionLoading, setAccessActionLoading] = useState<
    "save" | "rotate-access" | "rotate-secret" | null
  >(null);
  const [accessActionMessage, setAccessActionMessage] = useState<string | null>(null);
  const [rotateKeyConfirm, setRotateKeyConfirm] = useState<"access" | "secret" | null>(null);
  const [secretKeyVisible, setSecretKeyVisible] = useState(false);
  const [snippetCopyMessage, setSnippetCopyMessage] = useState<string | null>(null);
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
  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(
    Boolean((initialBot?.welcomeMessage ?? "").trim()),
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    (initialBot?.welcomeMessage ?? "").trim() || "",
  );
  const welcomeMessageInputRef = useRef<HTMLTextAreaElement | null>(null);

  function setWelcomeMessageEnabledWithDefault(on: boolean) {
    setWelcomeMessageEnabled(on);
    if (on && !welcomeMessage.trim()) {
      setWelcomeMessage(DEFAULT_WELCOME_MESSAGE);
    }
    // When turning off, keep the message text in state so turning on again restores it
  }

  function insertWelcomeVariable(variable: string) {
    const el = welcomeMessageInputRef.current;
    if (!el) {
      setWelcomeMessage((prev) => prev + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = welcomeMessage.slice(0, start);
    const after = welcomeMessage.slice(end);
    setWelcomeMessage(before + variable + after);
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + variable.length;
      el.setSelectionRange(newPos, newPos);
    });
  }
  const [knowledgeDescription, setKnowledgeDescription] = useState(initialBot?.knowledgeDescription ?? "");
  const [includeNotesInKnowledge, setIncludeNotesInKnowledge] = useState(initialBot?.includeNotesInKnowledge ?? true);
  const [faqs, setFaqs] = useState<BotFaq[]>(initialBot?.faqs ?? []);
  const [faqAutoRefreshToken, setFaqAutoRefreshToken] = useState<number>(0);
  const [refreshNotesConfirmOpen, setRefreshNotesConfirmOpen] = useState(false);
  const [knowledgeNotesSheetOpen, setKnowledgeNotesSheetOpen] = useState(false);
  const [knowledgeNotesDraft, setKnowledgeNotesDraft] = useState("");
  const [exampleQuestions, setExampleQuestions] = useState<string[]>(
    initialBot?.exampleQuestions?.length ? initialBot.exampleQuestions.slice(0, EXAMPLE_QUESTIONS_MAX) : [],
  );
  const [status, setStatus] = useState<"draft" | "published">(initialBot?.status ?? "draft");
  /** True only after a successful save that persisted `published` — not merely the local status toggle. */
  const [embedSnippetUnlocked, setEmbedSnippetUnlocked] = useState(
    () => initialBot?.status === "published",
  );
  const [noteSyncStatus, setNoteSyncStatus] = useState<"processing" | "failed" | "ready">("ready");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTabValue>(() =>
    mode === "edit" && workspaceSectionSlug
      ? slugToEditorTab(workspaceSectionSlug)
      : "general",
  );

  useEffect(() => {
    if (mode !== "edit" || workspaceSectionSlug === undefined) return;
    setActiveTab(slugToEditorTab(workspaceSectionSlug));
  }, [mode, workspaceSectionSlug]);
  /** Bumped by the knowledge-base poll so documents + server health stay fresh while the tab is open. */
  const [knowledgePollTick, setKnowledgePollTick] = useState(0);
  const [health, setHealth] = useState(initialBot?.health);
  const [kbEmbeddingSnapshot, setKbEmbeddingSnapshot] = useState<{
    faqItemCount: number;
    noteContentLength: number;
  } | null>(null);
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

  const serverHealthKey = useJsonSnapshot(initialBot?.health ?? null);
  useEffect(() => {
    setHealth(initialBot?.health);
  }, [initialBot?.id, serverHealthKey]); // eslint-disable-line react-hooks/exhaustive-deps -- serverHealthKey serializes health

  useEffect(() => {
    setKbEmbeddingSnapshot(null);
  }, [initialBot?.id]);

  useEffect(() => {
    setEmbedSnippetUnlocked(initialBot?.status === "published");
  }, [initialBot?.id, initialBot?.status]);

  function handleKnowledgePollResult(payload: {
    health: KnowledgePollHealthPayload;
    embedding: { faqItemCount: number; noteContentLength: number };
  }) {
    setHealth(payload.health);
    setKbEmbeddingSnapshot(payload.embedding);
  }

  /** While Knowledge base is open: interval-only ticks (no immediate bump — avoids duplicate refresh with mount). Reset when leaving tab so remount doesn't double-fire with stale tick. */
  useEffect(() => {
    if (!botId) return;
    if (activeTab !== "knowledge") {
      setKnowledgePollTick(0);
      return;
    }
    const id = window.setInterval(() => setKnowledgePollTick((t) => t + 1), KNOWLEDGE_BASE_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [botId, activeTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botImageFile, setBotImageFile] = useState<File | null>(null);
  const [botImageUrl, setBotImageUrl] = useState(initialBot?.imageUrl ?? "");
  const [avatarEmoji, setAvatarEmoji] = useState(initialBot?.avatarEmoji ?? "");
  const [botImageObjectUrl, setBotImageObjectUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(Boolean(initialBot?.imageUrl || initialBot?.avatarEmoji));
  const [dragOver, setDragOver] = useState(false);
  const [, setIsUploadingImage] = useState(false);
  const [isRemovingImage, setIsRemovingImage] = useState(false);
  const [botAvatarPreviewLoadFailed, setBotAvatarPreviewLoadFailed] = useState(false);
  const [launcherCustomPreviewLoadFailed, setLauncherCustomPreviewLoadFailed] = useState(false);
  const [launcherThemePreviewFailed, setLauncherThemePreviewFailed] = useState(false);

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
          const uploadResponse = await apiFetch("/api/user/upload", {
            method: "POST",
            body: formData,
          });
          const uploadJson = (await uploadResponse.json().catch(() => ({}))) as {
            url?: string;
            results?: Array<{ type: string; url?: string }>;
            error?: string;
            message?: string;
          };
          if (!uploadResponse.ok) {
            const msg =
              uploadJson.message ??
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
          const url =
            uploadJson.url ??
            (Array.isArray(uploadJson.results) && uploadJson.results[0]?.url
              ? uploadJson.results[0].url
              : undefined);
          if (!url) {
            setSubmitError("Image upload did not return a URL.");
            setIsUploadingImage(false);
            return null;
          }
          finalImageUrl = url;
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

    const parsedVisitorCap = (() => {
      if (!visitorMultiChatEnabled || visitorMultiChatCapUnlimited) return null;
      return normalizeVisitorMultiChatMax(visitorMultiChatMax);
    })();
    if (visitorMultiChatEnabled && !visitorMultiChatCapUnlimited && parsedVisitorCap === null) {
      setSubmitError("Enter at least 2 saved conversations (one is the current chat), or choose unlimited.");
      return null;
    }

    for (const row of allowedDomainRows) {
      if (row.mode === "exact") {
        if (row.value.trim() && isForbiddenEmbedDomainInput("exact", row.value)) {
          setSubmitError("Localhost and loopback addresses cannot be used as allowed embed domains.");
          return null;
        }
        continue;
      }
      if (!row.main.trim()) continue;
      if (isForbiddenEmbedDomainInput("domain", row.main)) {
        setSubmitError("Localhost and loopback addresses cannot be used as allowed embed domains.");
        return null;
      }
      const ser = serializeDomainGroup({
        main: row.main,
        includeApex: row.includeApex,
        subLabels: row.subLabels,
      });
      if (ser?.toLowerCase().startsWith("hosts:")) {
        for (const part of ser.slice(6).split(",")) {
          const h = part.trim();
          if (h && isForbiddenEmbedDomainInput("domain", h)) {
            setSubmitError("Localhost and loopback addresses cannot be used as allowed embed domains.");
            return null;
          }
        }
      } else if (ser && isForbiddenEmbedDomainInput("domain", ser)) {
        setSubmitError("Localhost and loopback addresses cannot be used as allowed embed domains.");
        return null;
      }
    }

    const normalizedAllowedDomains = allowedDomainRows
      .map((row) => serializeAllowedDomainRowUnion(row))
      .filter((x): x is string => x != null)
      .slice(0, maxAllowedDomains);
    const nextStatus = desiredStatus ?? status;
    if (nextStatus === "published" && normalizedAllowedDomains.length === 0) {
      setSubmitError("Add at least one allowed embed domain before publishing.");
      return null;
    }

    return {
      name: name.trim(),
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim() || undefined,
      categories: customCategory.trim().length > 0 ? [customCategory.trim().toLowerCase()] : categories,
      imageUrl: finalImageUrl,
      avatarEmoji: avatarEmoji.trim() || undefined,
      welcomeMessage: welcomeMessageEnabled ? (welcomeMessage.trim() || undefined) : undefined,
      knowledgeDescription: knowledgeDescription.trim() || undefined,
      faqs,
      exampleQuestions: exampleQuestions.map((q) => q.trim()).filter(Boolean).slice(0, EXAMPLE_QUESTIONS_MAX),
      status: desiredStatus ?? status,
      isPublic,
      leadCapture,
      chatUI: buildChatUiPayload(chatUI),
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
      includeNameInKnowledge,
      includeTaglineInKnowledge: false,
      includeNotesInKnowledge,
      visibility,
      messageLimitMode: "none",
      messageLimitTotal: null,
      messageLimitUpgradeMessage: null,
      allowedDomains: normalizedAllowedDomains,
      visitorMultiChatEnabled,
      visitorMultiChatMax: visitorMultiChatEnabled ? parsedVisitorCap : null,
    } satisfies BotFormSubmitPayload;
  }

  async function submitWithStatus(desiredStatus?: "draft" | "published") {
    onSavingChange?.(true);
    let payload: BotFormSubmitPayload | null = null;
    let notesChanged = false;
    try {
      payload = await buildSubmitPayload(desiredStatus);
      if (!payload) return;

      notesChanged =
        (knowledgeDescription || "") !== (initialBot?.knowledgeDescription || "") ||
        includeNotesInKnowledge !== (initialBot?.includeNotesInKnowledge ?? true);
      const faqsChanged = JSON.stringify(faqs) !== JSON.stringify(initialBot?.faqs ?? []);

      if (notesChanged && botId && onRetryNote) setNoteSyncStatus("processing");

      await onSubmit(payload);
      onDirtyChange?.(false);
      if (payload.status) {
        setStatus(payload.status);
        setEmbedSnippetUnlocked(payload.status === "published");
      }

      // Auto-refresh embeddings so KB is always in sync after saving.
      if (botId && onRetryNote && notesChanged) void handleRefreshNoteStatus();
      if (botId && onRetryFaq && faqsChanged) setFaqAutoRefreshToken((t) => t + 1);

      // Clear pending file and sync URL so next Save doesn't re-upload the same image
      setBotImageFile(null);
      setBotImageUrl(payload.imageUrl ?? "");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (notesChanged && botId && onRetryNote) setNoteSyncStatus("ready");
      setSubmitError(error instanceof Error ? error.message : "Failed to save bot. Please try again.");
    } finally {
      onSavingChange?.(false);
    }
  }

  async function saveAccessSettings() {
    if (!botId) return;
    setAccessActionLoading("save");
    setAccessActionMessage(null);
    try {
      const parsedVisitorCap = (() => {
        if (!visitorMultiChatEnabled || visitorMultiChatCapUnlimited) return null;
        return normalizeVisitorMultiChatMax(visitorMultiChatMax);
      })();
      if (visitorMultiChatEnabled && !visitorMultiChatCapUnlimited && parsedVisitorCap === null) {
        setAccessActionMessage("Enter at least 2 saved conversations, or turn off the limit.");
        setAccessActionLoading(null);
        return;
      }
      const res = await apiFetch(`/api/user/bots/${botId}/access-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          messageLimitMode: "none",
          messageLimitTotal: null,
          messageLimitUpgradeMessage: null,
          visitorMultiChatEnabled,
          visitorMultiChatMax: visitorMultiChatEnabled ? parsedVisitorCap : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        accessKey?: string;
        secretKey?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Failed to save access settings.");
      }
      if (typeof json.accessKey === "string") setAccessKey(json.accessKey);
      if (typeof json.secretKey === "string") setSecretKey(json.secretKey);
      setAccessActionMessage("Visibility and conversation limits saved.");
    } catch (error) {
      setAccessActionMessage(error instanceof Error ? error.message : "Failed to save access settings.");
    } finally {
      setAccessActionLoading(null);
    }
  }

  async function rotateAccessKey() {
    if (!botId) return;
    setAccessActionLoading("rotate-access");
    setAccessActionMessage(null);
    try {
      const res = await apiFetch(`/api/user/bots/${botId}/rotate-access-key`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; accessKey?: string };
      if (!res.ok || typeof json.accessKey !== "string") {
        throw new Error(json.error || "Failed to rotate access key.");
      }
      setAccessKey(json.accessKey);
      setAccessActionMessage("Access key rotated — already saved on the server.");
    } catch (error) {
      setAccessActionMessage(error instanceof Error ? error.message : "Failed to rotate access key.");
    } finally {
      setAccessActionLoading(null);
    }
  }

  async function rotateSecretKey() {
    if (!botId) return;
    setAccessActionLoading("rotate-secret");
    setAccessActionMessage(null);
    try {
      const res = await apiFetch(`/api/user/bots/${botId}/rotate-secret-key`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; secretKey?: string };
      if (!res.ok || typeof json.secretKey !== "string") {
        throw new Error(json.error || "Failed to rotate secret key.");
      }
      setSecretKey(json.secretKey);
      setAccessActionMessage("Secret key rotated — already saved on the server.");
    } catch (error) {
      setAccessActionMessage(error instanceof Error ? error.message : "Failed to rotate secret key.");
    } finally {
      setAccessActionLoading(null);
    }
  }

  async function copyRuntimeKey(kind: "access" | "secret") {
    const value = kind === "access" ? accessKey : secretKey;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setAccessActionMessage(kind === "access" ? "Access key copied." : "Secret key copied.");
    } catch {
      setAccessActionMessage(
        kind === "access" ? "Failed to copy access key." : "Failed to copy secret key.",
      );
    }
  }

  async function handleRefreshNoteStatus() {
    if (!onRetryNote) return;
    setNoteSyncStatus("processing");
    try {
      await onRetryNote();
      setNoteSyncStatus("ready");
    } catch {
      setNoteSyncStatus("failed");
    }
  }

  function truncateForPreview(text?: string, maxChars = 420) {
    if (!text) return "—";
    const trimmed = String(text).trim();
    if (!trimmed) return "—";
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars)}…`;
  }

  function openKnowledgeNotesSheet() {
    setKnowledgeNotesDraft(knowledgeDescription);
    setKnowledgeNotesSheetOpen(true);
  }

  function closeKnowledgeNotesSheet() {
    setKnowledgeNotesSheetOpen(false);
  }

  function saveKnowledgeNotesFromSheet() {
    setKnowledgeDescription(knowledgeNotesDraft);
    setKnowledgeNotesSheetOpen(false);
  }

  const knowledgeNotesDraftDirty = knowledgeNotesDraft !== knowledgeDescription;

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
  useEffect(() => {
    setBotAvatarPreviewLoadFailed(false);
  }, [previewSrc]);
  useEffect(() => {
    setLauncherCustomPreviewLoadFailed(false);
  }, [chatUI.launcherAvatarUrl]);
  useEffect(() => {
    setLauncherThemePreviewFailed(false);
  }, [chatUI.launcherIcon, botImageUrl, botImageObjectUrl, chatUI.launcherAvatarUrl, avatarEmoji]);
  const hasAllowedEmbedDomain = allowedDomainRows.some((r) => rowIsValidAllowedDomainRow(r));
  const allowedEmbedDomainsPreviewBlocks = useMemo(() => {
    return allowedDomainRows.map((row, i) => {
      const n = i + 1;
      const multi = maxAllowedDomains > 1;
      if (row.mode === "exact") {
        const o = canonicalEmbedOrigin(row.value);
        return {
          key: `e-${i}`,
          title: multi ? `Rule ${n} · Exact origin` : "Exact origin",
          lines: o ? [o] : [],
          hint:
            row.value.trim().length === 0
              ? "Enter a full URL or origin (e.g. https://app.example.com:3000)."
              : o
                ? ""
                : "This URL could not be parsed. Include https:// and a valid host.",
        };
      }
      const hosts = listResolvedHostnamesForDomainGroup(row);
      const lines = hosts.map((h) => `https://${h}`);
      let hint = "";
      if (!row.main.trim()) {
        hint = "Enter your main domain to see allowed origins.";
      } else if (hosts.length === 0) {
        hint = "Turn on “Include apex” or add at least one subdomain label.";
      }
      return {
        key: `d-${i}`,
        title: multi ? `Rule ${n} · Main domain` : "Main domain",
        lines,
        hint,
      };
    });
  }, [allowedDomainRows, maxAllowedDomains]);
  const isPublishBlocked = !name.trim() || !description.trim() || !hasAllowedEmbedDomain;

  const launchReadinessModel = useMemo(
    () =>
      computeLaunchReadiness({
        name,
        description,
        hasAllowedEmbedDomain,
        hasWelcomeConfigured: welcomeMessageEnabled && Boolean(welcomeMessage.trim()),
        hasKnowledgeSources:
          (initialBot?.documents?.length ?? 0) > 0 ||
          (typeof health?.docsReady === "number" && health.docsReady > 0),
        hasExampleQuestions: exampleQuestions.length >= 1,
        hasFaqs: faqs.length >= 1,
      }),
    [
      name,
      description,
      hasAllowedEmbedDomain,
      welcomeMessageEnabled,
      welcomeMessage,
      initialBot?.documents,
      health?.docsReady,
      exampleQuestions,
      faqs,
    ],
  );

  const launchReadinessSidebar = useLaunchReadinessSidebarState();
  const setLaunchReadinessSnapshot = launchReadinessSidebar?.setSnapshot;
  useEffect(() => {
    if (!setLaunchReadinessSnapshot) return;
    if (mode !== "edit" || !workspaceSectionSlug || !botId) {
      setLaunchReadinessSnapshot(null);
      return;
    }
    setLaunchReadinessSnapshot({
      status,
      model: launchReadinessModel,
      botBasePath: getBotsBasePath(pathname),
      botId,
    });
  }, [
    setLaunchReadinessSnapshot,
    mode,
    workspaceSectionSlug,
    botId,
    status,
    launchReadinessModel,
    pathname,
  ]);

  const runtimeApiBaseUrl =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL
      ? process.env.NEXT_PUBLIC_API_BASE_URL.trim()
      : "") || "";
  const runtimeSnippet = useMemo(() => {
    const configLines = [
      `botId: "${botId ?? ""}"`,
      `apiBaseUrl: "${runtimeApiBaseUrl}"`,
      ...(accessKey ? [`accessKey: "${accessKey}"`] : []),
      ...(visibility === "private" && secretKey ? [`secretKey: "${secretKey}"`] : []),
      ...(creatorType === "visitor" && ownerVisitorId
        ? [`platformVisitorId: "${ownerVisitorId}"`]
        : []),
      `position: "right"`,
    ];
    return [
      `<link rel="stylesheet" href="https://widget.assistrio.com/assistrio-chat.css" />`,
      `<script>`,
      `  window.AssistrioChatConfig = {`,
      `    ${configLines.join(",\n    ")}`,
      `  };`,
      `</script>`,
      `<script src="https://widget.assistrio.com/assistrio-chat.js" async></script>`,
    ].join("\n");
  }, [botId, runtimeApiBaseUrl, accessKey, visibility, secretKey, creatorType, ownerVisitorId]);

  const initialCategoriesStr = useJsonSnapshot(initialBot?.categories ?? EMPTY_JSON_ARRAY);
  const categoriesStr = useJsonSnapshot(categories);

  const initialFaqsStr = useJsonSnapshot(initialBot?.faqs ?? EMPTY_JSON_ARRAY);
  const faqsStr = useJsonSnapshot(faqs);

  const initialExampleQuestionsStr = useJsonSnapshot(initialBot?.exampleQuestions ?? EMPTY_JSON_ARRAY);
  const exampleQuestionsStr = useJsonSnapshot(exampleQuestions);

  const initialChatUIStr = useJsonSnapshot(initialBot?.chatUI ?? EMPTY_JSON_OBJECT);
  const chatUIStr = useJsonSnapshot(chatUI);

  const initialLeadCaptureStr = useJsonSnapshot(initialBot?.leadCapture ?? EMPTY_JSON_OBJECT);
  const leadCaptureStr = useJsonSnapshot(leadCapture);

  const dirty = useMemo(() => {
    if (!initialBot) return false;
    const initial = initialBot;
    return (
      (name || "") !== (initial.name || "") ||
      (shortDescription || "") !== (initial.shortDescription || "") ||
      includeNameInKnowledge !== (initial.includeNameInKnowledge ?? false) ||
      (description || "") !== (initial.description || "") ||
      includeNotesInKnowledge !== (initial.includeNotesInKnowledge ?? true) ||
      welcomeMessageEnabled !== Boolean((initial.welcomeMessage ?? "").trim()) ||
      (welcomeMessageEnabled && (welcomeMessage || "") !== (initial.welcomeMessage || "")) ||
      (knowledgeDescription || "") !== (initial.knowledgeDescription || "") ||
      (behaviorText || "") !== ((initial.personality?.description ?? initial.personality?.systemPrompt) || "") ||
      (behaviorPreset || "default") !== (initial.personality?.behaviorPreset ?? "default") ||
      (personality.tone ?? "friendly") !== (initial.personality?.tone ?? "friendly") ||
      (openaiApiKeyOverride || "") !== (initial.openaiApiKeyOverride || "") ||
      (whisperApiKeyOverride || "") !== (initial.whisperApiKeyOverride || "") ||
      (botImageUrl || "") !== (initial.imageUrl || "") ||
      (avatarEmoji || "") !== (initial.avatarEmoji || "") ||
      botImageFile !== null ||
      status !== (initial.status ?? "draft") ||
      isPublic !== (initial.isPublic ?? true) ||
      visibility !== (initial.visibility === "private" ? "private" : "public") ||
      (() => {
        const iEn = initial.visitorMultiChatEnabled === true;
        const ivMax = iEn ? normalizeVisitorMultiChatMax(initial.visitorMultiChatMax) : null;
        const cvMax =
          visitorMultiChatEnabled
            ? visitorMultiChatCapUnlimited
              ? null
              : normalizeVisitorMultiChatMax(visitorMultiChatMax)
            : null;
        return (
          visitorMultiChatEnabled !== iEn ||
          (visitorMultiChatEnabled && iEn && cvMax !== ivMax)
        );
      })() ||
      allowedDomainsFingerprint(allowedDomainRows) !== allowedDomainsFingerprintFromStored(initial.allowedDomains) ||
      categoriesStr !== initialCategoriesStr ||
      faqsStr !== initialFaqsStr ||
      exampleQuestionsStr !== initialExampleQuestionsStr ||
      chatUIStr !== initialChatUIStr ||
      leadCaptureStr !== initialLeadCaptureStr
    );
  }, [
    initialBot,
    name,
    shortDescription,
    includeNameInKnowledge,
    includeNotesInKnowledge,
    description,
    welcomeMessageEnabled,
    welcomeMessage,
    knowledgeDescription,
    behaviorText,
    behaviorPreset,
    personality,
    openaiApiKeyOverride,
    whisperApiKeyOverride,
    botImageUrl,
    avatarEmoji,
    botImageFile,
    status,
    isPublic,
    visibility,
    visitorMultiChatEnabled,
    visitorMultiChatCapUnlimited,
    visitorMultiChatMax,
    allowedDomainRows,
    categoriesStr,
    initialCategoriesStr,
    faqsStr,
    initialFaqsStr,
    exampleQuestionsStr,
    initialExampleQuestionsStr,
    chatUIStr,
    initialChatUIStr,
    leadCaptureStr,
    initialLeadCaptureStr,
  ]);

  useDebouncedDirtyNotify(dirty, onDirtyChange);

  const embedPreviewOverrides = useMemo(() => {
    const behaviorDescription = behaviorText.trim();
    const combinedSystemPrompt =
      `${presetToPrompt(behaviorPreset)}\n\n` +
      (behaviorDescription ? `Additional behavior:\n${behaviorDescription}` : "");
    const avatarForEmbed =
      previewSrc && isSafeImagePreviewSrc(previewSrc) ? previewSrc : undefined;
    const embedVisitorCap = (() => {
      if (!visitorMultiChatEnabled || visitorMultiChatCapUnlimited) return null;
      return normalizeVisitorMultiChatMax(visitorMultiChatMax);
    })();
    return {
      botName: name.trim() || undefined,
      avatarUrl: avatarForEmbed,
      avatarEmoji: avatarEmoji.trim() || undefined,
      tagline: shortDescription.trim() || undefined,
      description: description.trim() || undefined,
      welcomeMessage: welcomeMessageEnabled ? welcomeMessage.trim() || undefined : undefined,
      suggestedQuestions: exampleQuestions.map((q) => q.trim()).filter(Boolean).slice(0, EXAMPLE_QUESTIONS_MAX),
      brandingMessage: chatUI.brandingMessage ?? DEFAULT_CHAT_UI.brandingMessage,
      privacyText:
        chatUI.showPrivacyText !== false && chatUI.privacyText?.trim()
          ? chatUI.privacyText.trim()
          : undefined,
      launcherPosition:
        chatUI.launcherPosition === "bottom-left" ? ("bottom-left" as const) : ("bottom-right" as const),
      chatUI: buildChatUiPayload(chatUI),
      leadCapture,
      personality: {
        ...personality,
        behaviorPreset,
        description: behaviorDescription || undefined,
        systemPrompt: combinedSystemPrompt.trim() || undefined,
        thingsToAvoid: thingsToAvoid.trim() || undefined,
      },
      config,
      visitorMultiChatEnabled,
      visitorMultiChatMax: visitorMultiChatEnabled ? embedVisitorCap : null,
    };
  }, [
    name,
    shortDescription,
    previewSrc,
    avatarEmoji,
    description,
    welcomeMessageEnabled,
    welcomeMessage,
    exampleQuestions,
    chatUI,
    leadCapture,
    personality,
    behaviorText,
    behaviorPreset,
    thingsToAvoid,
    config,
    visitorMultiChatEnabled,
    visitorMultiChatCapUnlimited,
    visitorMultiChatMax,
  ]);

  const { setPreviewOverrides } = useEmbedPreview();
  useEffect(() => {
    if (mode !== "edit" || !botId) {
      setPreviewOverrides(null);
      return;
    }
    setPreviewOverrides(embedPreviewOverrides);
    return () => setPreviewOverrides(null);
  }, [mode, botId, embedPreviewOverrides, setPreviewOverrides]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isEditorTabValue(value)) return;
      setActiveTab(value);
      if (mode !== "edit" || !botId) return;
      const base = getBotsBasePath(pathname);
      const nextSlug = editorTabToSlug(value);
      router.replace(`${base}/${botId}/${nextSlug}`);
    },
    [mode, botId, pathname, router],
  );

  const editorModel: BotFormEditorModel = {
    mode,
    initialBot,
    onSubmit,
    onCreateAnotherBot,
    submitting,
    formId,
    onDirtyChange,
    onSavingChange,
    botId,
    onRetryFaq,
    onRetryNote,
    workspaceSectionSlug,
    router: { replace: (href: string) => router.replace(href) },
    pathname,
    user,
    maxAllowedDomains,
    emptyDomainRow,
    allowedDomainRows,
    setAllowedDomainRows,
    name,
    setName,
    shortDescription,
    setShortDescription,
    includeNameInKnowledge,
    setIncludeNameInKnowledge,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    visibility,
    setVisibility,
    accessKey,
    setAccessKey,
    secretKey,
    setSecretKey,
    creatorType,
    ownerVisitorId,
    visitorMultiChatEnabled,
    setVisitorMultiChatEnabled,
    visitorMultiChatCapUnlimited,
    setVisitorMultiChatCapUnlimited,
    visitorMultiChatMax,
    setVisitorMultiChatMax,
    accessActionLoading,
    setAccessActionLoading,
    accessActionMessage,
    setAccessActionMessage,
    rotateKeyConfirm,
    setRotateKeyConfirm,
    secretKeyVisible,
    setSecretKeyVisible,
    snippetCopyMessage,
    setSnippetCopyMessage,
    categories,
    setCategories,
    customCategory,
    setCustomCategory,
    behaviorPreset,
    setBehaviorPreset,
    behaviorText,
    setBehaviorText,
    thingsToAvoid,
    setThingsToAvoid,
    welcomeMessageEnabled,
    setWelcomeMessageEnabled,
    welcomeMessage,
    setWelcomeMessage,
    welcomeMessageInputRef,
    setWelcomeMessageEnabledWithDefault,
    insertWelcomeVariable,
    knowledgeDescription,
    setKnowledgeDescription,
    includeNotesInKnowledge,
    setIncludeNotesInKnowledge,
    faqs,
    setFaqs,
    faqAutoRefreshToken,
    setFaqAutoRefreshToken,
    refreshNotesConfirmOpen,
    setRefreshNotesConfirmOpen,
    knowledgeNotesSheetOpen,
    setKnowledgeNotesSheetOpen,
    knowledgeNotesDraft,
    setKnowledgeNotesDraft,
    exampleQuestions,
    setExampleQuestions,
    status,
    setStatus,
    embedSnippetUnlocked,
    setEmbedSnippetUnlocked,
    noteSyncStatus,
    setNoteSyncStatus,
    submitError,
    setSubmitError,
    activeTab,
    setActiveTab,
    knowledgePollTick,
    setKnowledgePollTick,
    health,
    setHealth,
    kbEmbeddingSnapshot,
    setKbEmbeddingSnapshot,
    testingKey,
    setTestingKey,
    testResult,
    setTestResult,
    personality,
    setPersonality,
    config,
    setConfig,
    openaiApiKeyOverride,
    setOpenaiApiKeyOverride,
    whisperApiKeyOverride,
    setWhisperApiKeyOverride,
    leadCapture,
    setLeadCapture,
    chatUI,
    setChatUI,
    fileInputRef,
    botImageFile,
    setBotImageFile,
    botImageUrl,
    setBotImageUrl,
    avatarEmoji,
    setAvatarEmoji,
    botImageObjectUrl,
    setBotImageObjectUrl,
    previewVisible,
    setPreviewVisible,
    dragOver,
    setDragOver,
    setIsUploadingImage,
    isRemovingImage,
    setIsRemovingImage,
    botAvatarPreviewLoadFailed,
    setBotAvatarPreviewLoadFailed,
    launcherCustomPreviewLoadFailed,
    setLauncherCustomPreviewLoadFailed,
    launcherThemePreviewFailed,
    setLauncherThemePreviewFailed,
    handleFilePick,
    buildSubmitPayload,
    submitWithStatus,
    saveAccessSettings,
    rotateAccessKey,
    rotateSecretKey,
    copyRuntimeKey,
    handleRefreshNoteStatus,
    truncateForPreview,
    openKnowledgeNotesSheet,
    closeKnowledgeNotesSheet,
    saveKnowledgeNotesFromSheet,
    knowledgeNotesDraftDirty,
    handleRemoveAvatar,
    handleKnowledgePollResult,
    handleTabChange,
    hasImageUrl,
    hasImageFile,
    hasImage,
    previewSrc,
    hasAllowedEmbedDomain,
    allowedEmbedDomainsPreviewBlocks,
    isPublishBlocked,
    launchReadinessModel,
    runtimeSnippet,
  };

  return (
    <>
      <form
        id={formId}
        onSubmit={async (event) => {
          event.preventDefault();
          await submitWithStatus(status);
        }}
        className="space-y-6"
      >
        {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}

        <BotFormEditorProvider value={editorModel}>
        <Tabs defaultValue="general" value={activeTab} onValueChange={handleTabChange} className="space-y-0">
          {mode === "edit" && workspaceSectionSlug ? null : (
          <div className="border-b border-gray-200/90 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 overflow-x-auto">
            <TabsList className="w-full min-w-0 flex flex-wrap justify-start rounded-none border-0 bg-transparent p-0 gap-x-0 gap-y-1 min-h-0">
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
          )}
          <div className="flex-1 min-w-0 py-6">
            <TabsContent value="general" className="mt-0">{() => <ProfileSection />}</TabsContent>
            <TabsContent value="behavior" className="mt-0">{() => <BehaviorSection />}</TabsContent>
            <TabsContent value="knowledge" className="mt-0">{() => <KnowledgeSection />}</TabsContent>
            <TabsContent value="integrations" className="mt-0">{() => <AiIntegrationsSection />}</TabsContent>
            <TabsContent value="chat-experience" className="mt-0">{() => <ChatSection />}</TabsContent>
            <TabsContent value="appearance" className="mt-0">{() => <AppearanceSection />}</TabsContent>
            <TabsContent value="publish" className="mt-0">{() => <PublishSection />}</TabsContent>
          </div>
        </Tabs>
        </BotFormEditorProvider>

        <SettingsModal
          open={refreshNotesConfirmOpen}
          onClose={() => setRefreshNotesConfirmOpen(false)}
          icon={<RefreshCw className="h-5 w-5" strokeWidth={2} aria-hidden />}
          maxWidthClass="max-w-md"
          title="Refresh knowledge notes"
          description="Re-builds embeddings for the internal notes below so the assistant uses the latest text."
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNotesConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={noteSyncStatus === "processing"}
                onClick={async () => {
                  setRefreshNotesConfirmOpen(false);
                  await handleRefreshNoteStatus();
                }}
              >
                Refresh embeddings
              </Button>
            </>
          }
        >
          <SettingsEmbedPreview
            eyebrow="Knowledge notes"
            badge={
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${includeNotesInKnowledge
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300"
                  : "border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
              >
                {includeNotesInKnowledge ? "Included in KB" : "Excluded from KB"}
              </span>
            }
          >
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {truncateForPreview(knowledgeDescription)}
            </pre>
          </SettingsEmbedPreview>
        </SettingsModal>

        <SettingsModal
          open={rotateKeyConfirm !== null}
          onClose={() => setRotateKeyConfirm(null)}
          title={rotateKeyConfirm === "secret" ? "Rotate secret key?" : "Rotate access key?"}
          description={
            rotateKeyConfirm === "secret"
              ? "The current secret will stop working immediately. Update any embeds or server code that use it."
              : "The current access key will stop working immediately. Update any embeds or integrations that use it."
          }
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRotateKeyConfirm(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={rotateKeyConfirm === "secret" ? "destructive" : "primary"}
                size="sm"
                disabled={accessActionLoading !== null}
                onClick={() => {
                  const kind = rotateKeyConfirm;
                  setRotateKeyConfirm(null);
                  if (kind === "access") void rotateAccessKey();
                  else if (kind === "secret") void rotateSecretKey();
                }}
              >
                {rotateKeyConfirm === "secret" ? "Rotate secret key" : "Rotate access key"}
              </Button>
            </>
          }
        >
          <p className="sr-only">Confirm key rotation.</p>
        </SettingsModal>

        <SettingsSideSheet
          open={knowledgeNotesSheetOpen}
          onClose={closeKnowledgeNotesSheet}
          title="Edit knowledge notes"
          description="Not shown to users. Describe what knowledge you've added so other admins can understand scope."
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={closeKnowledgeNotesSheet}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={saveKnowledgeNotesFromSheet}
                disabled={!knowledgeNotesDraftDirty}
              >
                Save
              </Button>
            </>
          }
        >
          <Textarea
            id="knowledge-description"
            rows={12}
            value={knowledgeNotesDraft}
            onChange={(e) => setKnowledgeNotesDraft(e.target.value)}
            className="w-full min-h-[14rem] resize-y"
            placeholder="Describe the scope of this bot's knowledge for other admins…"
          />
        </SettingsSideSheet>
      </form>
    </>
  );
}
