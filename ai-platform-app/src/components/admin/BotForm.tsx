"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ImageOff, MessageCircle, Pencil, RefreshCw } from "lucide-react";

import BotDocumentsManager, {
  type BotDocumentItem,
  type KnowledgePollHealthPayload,
} from "@/components/admin/BotDocumentsManager";
import BotFaqsEditor, { type BotFaq } from "@/components/admin/BotFaqsEditor";
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
  SettingsSideSheet,
} from "@/components/admin/settings";
import LeadCaptureEditor from "@/components/admin/LeadCaptureEditor";
import MenuQuickLinksEditor from "@/components/admin/MenuQuickLinksEditor";
import { QuickLinksMenuIconPicker } from "@/components/admin/QuickLinksMenuIconPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import MultiSelect from "@/components/ui/MultiSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import Tooltip from "@/components/ui/Tooltip";
import { useDebouncedDirtyNotify } from "@/hooks/useDebouncedDirtyNotify";
import { useJsonSnapshot } from "@/hooks/useJsonSnapshot";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/api";
import { normalizeQuickLinkIcon } from "@/lib/quickLinkIconNormalize";
import { normalizeLeadCapture } from "@/lib/leadCapture";
import { normalizeVisitorMultiChatMax } from "@/lib/visitorMultiChatMax";
import {
  allowedDomainRowFromStored,
  canonicalEmbedOrigin,
  isForbiddenEmbedDomainInput,
  rowIsValidAllowedDomainRow,
  serializeAllowedDomainRowUnion,
  type AllowedDomainRow,
  type AllowedDomainRowMode,
} from "@/lib/embedAllowedDomains";
import { listResolvedHostnamesForDomainGroup, serializeDomainGroup } from "@/lib/embedDomainUi";
import { BotEditEmbedPreview } from "@/components/admin/BotEditEmbedPreview";
import { SettingsEmbedPreview } from "@/components/admin/settings/SettingsEmbedPreview";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import {
  BUBBLE_RADIUS_MAX,
  BUBBLE_RADIUS_MIN,
  type BotChatUI,
  type BotConfig,
  type BotLeadCaptureV2,
  type BotPersonality,
  type ChatLauncherIcon,
  type ChatStatusIndicator,
  type ChatTimePosition,
  type LiveIndicatorStyle,
  type ChatShadowIntensity,
} from "@/models/Bot";

/** Default welcome message template when user enables welcome message. Variables: {{Name}}, {{Tagline}}, {{description}} */
export const DEFAULT_WELCOME_MESSAGE =
  "Hi! 👋 I'm {{Name}} — {{Tagline}}. How can I help you today?";

const WELCOME_VARIABLES = [
  { label: "Name", value: "{{Name}}" },
  { label: "Tagline", value: "{{Tagline}}" },
  { label: "Description", value: "{{description}}" },
] as const;

const WELCOME_VAR_REGEX = /\{\{Name\}\}|\{\{Tagline\}\}|\{\{description\}\}/g;

function WelcomeMessagePreview({ text }: { text: string }) {
  const parts = text.split(WELCOME_VAR_REGEX);
  const tokens = text.match(WELCOME_VAR_REGEX) ?? [];
  const labels: Record<string, string> = {
    "{{Name}}": "Name",
    "{{Tagline}}": "Tagline",
    "{{description}}": "Description",
  };
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`p-${i}`}>{part}</span>);
    const token = tokens[i];
    if (token)
      nodes.push(
        <span
          key={`v-${i}`}
          className="inline-flex items-center rounded border border-brand-300 bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-700 dark:border-brand-600 dark:bg-brand-900/50 dark:text-brand-200"
        >
          {labels[token] ?? token}
        </span>
      );
  });
  return <span className="inline">{nodes}</span>;
}

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

function maskRuntimeKey(value: string): string {
  const normalized = String(value ?? "");
  if (!normalized) return "";
  if (normalized.length <= 8) return "********";
  return `${normalized.slice(0, 4)}${"*".repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`;
}

/** Avoid `<img src>` with partial URLs while typing; allow blob, data:image, and http(s). */
function isSafeImagePreviewSrc(src: string): boolean {
  const t = src.trim();
  if (!t) return false;
  if (t.startsWith("blob:")) return true;
  if (t.startsWith("data:image/")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** URL field: hide data: URLs (from upload) so the user can paste an https URL without fighting the input. */
function launcherCustomUrlInputValue(url: string | undefined): string {
  if (typeof url !== "string") return "";
  if (url.startsWith("data:")) return "";
  return url;
}

function BrokenImagePlaceholder({
  size = "md",
  subtitle,
}: {
  size?: "sm" | "md";
  subtitle?: string;
}) {
  const box = size === "sm" ? "h-16 w-16" : "h-[120px] w-[120px]";
  const icon = size === "sm" ? "h-7 w-7" : "h-11 w-11";
  return (
    <div
      className={`flex ${size === "sm" ? "min-h-0" : "min-h-[120px]"} flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-100/90 p-3 dark:border-gray-600 dark:bg-gray-800/60`}
      role="img"
      aria-label={subtitle ?? "Image unavailable"}
    >
      <div
        className={`flex ${box} flex-col items-center justify-center rounded-lg border border-gray-200/80 bg-white/80 dark:border-gray-600 dark:bg-gray-900/40`}
      >
        <ImageOff className={`${icon} shrink-0 text-amber-500/90 dark:text-amber-400/90`} strokeWidth={1.75} aria-hidden />
      </div>
      {subtitle ? (
        <p className="max-w-[14rem] text-center text-[11px] leading-snug text-gray-500 dark:text-gray-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

const DEFAULT_CHAT_UI: Required<Omit<BotChatUI, "menuQuickLinks" | "launcherAvatarUrl" | "menuQuickLinksMenuIcon">> & {
  menuQuickLinks: BotChatUI["menuQuickLinks"];
  launcherAvatarUrl?: string;
} = {
  primaryColor: "#14B8A6",
  backgroundStyle: "light",
  bubbleBorderRadius: 20,
  launcherPosition: "bottom-right",
  shadowIntensity: "medium",
  showChatBorder: true,
  chatPanelBorderWidth: 1,
  launcherIcon: "default",
  launcherAvatarRingWidth: 18,
  launcherSize: 48,
  launcherWhenOpen: "chevron-down",
  chatOpenAnimation: "slide-up-fade",
  openChatOnLoad: true,
  showBranding: true,
  showPrivacyText: true,
  liveIndicatorStyle: "label",
  statusIndicator: "none",
  statusDotStyle: "blinking",
  showScrollToBottom: true,
  showScrollToBottomLabel: true,
  scrollToBottomLabel: "",
  showScrollbar: true,
  composerAsSeparateBox: true,
  composerBorderWidth: 1,
  composerBorderColor: "primary",
  showMenuExpand: true,
  showMenuQuickLinks: true,
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
  privacyText: "",
};

const EXAMPLE_QUESTIONS_MAX = 5;

/** Stable fallbacks so `useJsonSnapshot` does not see a new [] / {} every render. */
const EMPTY_JSON_ARRAY: unknown[] = [];
const EMPTY_JSON_OBJECT: Record<string, unknown> = {};

export interface BotFormSubmitPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  avatarEmoji?: string;
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
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  visibility?: "public" | "private";
  messageLimitMode?: "none" | "fixed_total";
  messageLimitTotal?: number | null;
  messageLimitUpgradeMessage?: string | null;
  allowedDomains?: string[];
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
}

function normalizeDomainsListKey(text: string): string {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join("\n");
}

/** DNS label for a single subdomain segment (e.g. `www` → `www.example.com`). */
const EMBED_SUBDOMAIN_LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

function EmbedSubdomainLabelsList({
  labels,
  onChange,
  idPrefix,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const normalized = draft.trim().toLowerCase();
  const canAdd =
    normalized.length > 0 &&
    EMBED_SUBDOMAIN_LABEL_RE.test(normalized) &&
    !labels.map((x) => x.toLowerCase()).includes(normalized);

  function add() {
    if (!canAdd) return;
    onChange([...labels, normalized]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      {labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
          {labels.map((l) => (
            <li key={l}>
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                {l}
                <button
                  type="button"
                  className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800 dark:hover:text-red-400"
                  aria-label={`Remove ${l}`}
                  onClick={() => onChange(labels.filter((x) => x !== l))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`${idPrefix}-subdraft`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. www"
          className="min-w-[8rem] flex-1 font-mono text-sm"
          autoComplete="off"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add} disabled={!canAdd}>
          Add
        </Button>
      </div>
    </div>
  );
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
    avatarEmoji?: string;
    welcomeMessage?: string;
    knowledgeDescription?: string;
    status?: "draft" | "published";
    faqs?: BotFaq[];
    exampleQuestions?: string[];
    documents?: BotDocumentItem[];
    openaiApiKeyOverride?: string;
    whisperApiKeyOverride?: string;
    isPublic?: boolean;
    visibility?: "public" | "private";
    accessKey?: string;
    secretKey?: string;
    creatorType?: "user" | "visitor";
    ownerVisitorId?: string;
    messageLimitMode?: "none" | "fixed_total";
    messageLimitTotal?: number | null;
    messageLimitUpgradeMessage?: string | null;
    visitorMultiChatEnabled?: boolean;
    visitorMultiChatMax?: number | null;
    allowedDomains?: string[];
    includeNameInKnowledge?: boolean;
    includeTaglineInKnowledge?: boolean;
    includeNotesInKnowledge?: boolean;
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
  botId?: string;
  onRetryFaq?: (faqIndex: number) => Promise<void>;
  onRetryNote?: () => Promise<void>;
  onCreateAnotherBot?: () => void;
  submitting?: boolean;
  /** ID for the form element (for external submit button via form="..."). */
  formId?: string;
  /** Called when form dirty state changes (user edited / save completed). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called when document upload starts (true) or ends (false). Used to show header "Saving" state. */
  onSavingChange?: (saving: boolean) => void;
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

/** Normalized chat UI for save + embed preview (single source of truth). */
function buildChatUiPayload(chatUI: BotChatUI): BotChatUI {
  const menuQuickLinksMenuIcon = normalizeQuickLinkIcon(chatUI.menuQuickLinksMenuIcon);
  return {
    primaryColor: chatUI.primaryColor || DEFAULT_CHAT_UI.primaryColor,
    backgroundStyle: chatUI.backgroundStyle || DEFAULT_CHAT_UI.backgroundStyle,
    bubbleBorderRadius: chatUI.bubbleBorderRadius ?? DEFAULT_CHAT_UI.bubbleBorderRadius,
    launcherPosition: chatUI.launcherPosition || DEFAULT_CHAT_UI.launcherPosition,
    shadowIntensity: chatUI.shadowIntensity ?? DEFAULT_CHAT_UI.shadowIntensity,
    showChatBorder: chatUI.showChatBorder ?? DEFAULT_CHAT_UI.showChatBorder,
    chatPanelBorderWidth:
      typeof chatUI.chatPanelBorderWidth === "number" &&
        chatUI.chatPanelBorderWidth >= 0 &&
        chatUI.chatPanelBorderWidth <= 5
        ? Math.round(chatUI.chatPanelBorderWidth)
        : DEFAULT_CHAT_UI.chatPanelBorderWidth,
    launcherIcon: chatUI.launcherIcon ?? DEFAULT_CHAT_UI.launcherIcon,
    launcherAvatarUrl: chatUI.launcherAvatarUrl?.trim() || undefined,
    launcherAvatarRingWidth: chatUI.launcherAvatarRingWidth ?? DEFAULT_CHAT_UI.launcherAvatarRingWidth,
    launcherSize: chatUI.launcherSize ?? DEFAULT_CHAT_UI.launcherSize,
    launcherWhenOpen:
      chatUI.launcherWhenOpen === "close" || chatUI.launcherWhenOpen === "same"
        ? chatUI.launcherWhenOpen
        : DEFAULT_CHAT_UI.launcherWhenOpen,
    chatOpenAnimation: chatUI.chatOpenAnimation ?? DEFAULT_CHAT_UI.chatOpenAnimation,
    openChatOnLoad: chatUI.openChatOnLoad ?? DEFAULT_CHAT_UI.openChatOnLoad,
    showBranding: chatUI.showBranding ?? DEFAULT_CHAT_UI.showBranding,
    brandingMessage: chatUI.brandingMessage ?? DEFAULT_CHAT_UI.brandingMessage,
    showPrivacyText: chatUI.showPrivacyText ?? DEFAULT_CHAT_UI.showPrivacyText,
    privacyText: chatUI.privacyText?.trim() || undefined,
    liveIndicatorStyle: chatUI.liveIndicatorStyle ?? DEFAULT_CHAT_UI.liveIndicatorStyle,
    statusIndicator: chatUI.statusIndicator ?? DEFAULT_CHAT_UI.statusIndicator,
    statusDotStyle: chatUI.statusDotStyle ?? DEFAULT_CHAT_UI.statusDotStyle,
    showScrollToBottom: chatUI.showScrollToBottom ?? DEFAULT_CHAT_UI.showScrollToBottom,
    showScrollToBottomLabel: chatUI.showScrollToBottomLabel ?? DEFAULT_CHAT_UI.showScrollToBottomLabel,
    scrollToBottomLabel:
      typeof chatUI.scrollToBottomLabel === "string" ? chatUI.scrollToBottomLabel.trim() : "",
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
    showMenuQuickLinks: chatUI.showMenuQuickLinks ?? DEFAULT_CHAT_UI.showMenuQuickLinks,
    menuQuickLinks: chatUI.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined,
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
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
  };
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
}: BotFormProps) {
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
  const [activeTab, setActiveTab] = useState("general");
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

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

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

        <Tabs defaultValue="general" value={activeTab} onValueChange={handleTabChange} className="space-y-0">
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 overflow-x-auto">
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
          <div className="flex-1 min-w-0 py-5 px-6">
            <TabsContent value="general" className="mt-0">
              {() => (
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
                        <div className="flex flex-col gap-2 w-full">
                          <Input
                            id="bot-name"
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="w-full"
                          />
                          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeNameInKnowledge}
                              onChange={(e) => setIncludeNameInKnowledge(e.target.checked)}
                              className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                            />
                            <span>Include in knowledge base</span>
                            <SettingsInfoTooltip
                              content="When enabled, the bot name above is included in the knowledge base and overrides any other name given to the bot, no matter where it's mentioned in context."
                              className="ml-0.5"
                            />
                          </label>
                        </div>
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
                            isSafeImagePreviewSrc(previewSrc) && !botAvatarPreviewLoadFailed ? (
                              <div className="relative p-4">
                                <img
                                  src={previewSrc}
                                  alt=""
                                  width={120}
                                  height={120}
                                  className="h-[120px] w-[120px] rounded-xl border border-gray-200 object-cover shadow-sm dark:border-gray-600"
                                  onError={() => setBotAvatarPreviewLoadFailed(true)}
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
                              <div className="relative p-4">
                                <BrokenImagePlaceholder
                                  subtitle={
                                    isSafeImagePreviewSrc(previewSrc) && botAvatarPreviewLoadFailed
                                      ? "Couldn’t load this image. Check the URL or try another file."
                                      : "Enter a valid https:// URL or upload a file to preview."
                                  }
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
                            )
                          ) : avatarEmoji.trim() ? (
                            <div className="flex min-h-[160px] flex-col items-center justify-center p-4">
                              <span className="text-7xl leading-none" aria-hidden>
                                {avatarEmoji.trim()}
                              </span>
                              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Emoji avatar (no image)</p>
                            </div>
                          ) : (
                            <SettingsEmptyState
                              title="No image"
                              description="Enter a URL, upload a file, or set an emoji below."
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
                            type="text"
                            inputMode="url"
                            autoComplete="url"
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
                          label="Or emoji avatar"
                          htmlFor="bot-avatar-emoji"
                          helperText="Used when no image is set (e.g. one emoji). Max 12 characters."
                        >
                          <Input
                            id="bot-avatar-emoji"
                            value={avatarEmoji}
                            onChange={(e) => {
                              const v = e.target.value.slice(0, 12);
                              setAvatarEmoji(v);
                              if (!previewSrc && v.trim()) setPreviewVisible(true);
                            }}
                            placeholder="e.g. 🤖"
                            className="w-full max-w-xs"
                            maxLength={12}
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
              )}
            </TabsContent>

            <TabsContent value="behavior">
              {() => (
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
                        label="Tone"
                        htmlFor="behavior-tone"
                        helperText="How the bot sounds in replies—including when it asks for contact details."
                      >
                        <select
                          id="behavior-tone"
                          value={personality.tone ?? "friendly"}
                          onChange={(event) =>
                            setPersonality((prev) => ({
                              ...prev,
                              tone: event.target.value as NonNullable<BotPersonality["tone"]>,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        >
                          <option value="friendly">Friendly</option>
                          <option value="formal">Formal</option>
                          <option value="playful">Playful</option>
                          <option value="technical">Technical</option>
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
                      <SettingsToggleRow
                        label="Welcome message"
                        htmlFor="welcome-message-enabled"
                        helperText="Show a custom message when the user opens the chat."
                      >
                        <input
                          id="welcome-message-enabled"
                          type="checkbox"
                          checked={welcomeMessageEnabled}
                          onChange={(e) => setWelcomeMessageEnabledWithDefault(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                        />
                      </SettingsToggleRow>
                      {welcomeMessageEnabled ? (
                        <SettingsFieldRow
                          label="Message text"
                          htmlFor="welcome-message"
                          helperText="Click a pill to insert that variable. Variables are highlighted in the preview below."
                        >
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex flex-wrap gap-1.5">
                              {WELCOME_VARIABLES.map((v) => (
                                <button
                                  key={v.label}
                                  type="button"
                                  onClick={() => insertWelcomeVariable(v.value)}
                                  className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-sm hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400 dark:hover:bg-gray-600/50"
                                >
                                  {v.label}
                                </button>
                              ))}
                            </div>
                            <Textarea
                              ref={welcomeMessageInputRef}
                              id="welcome-message"
                              rows={3}
                              value={welcomeMessage}
                              onChange={(event) => setWelcomeMessage(event.target.value)}
                              placeholder={DEFAULT_WELCOME_MESSAGE}
                              className="w-full min-h-[5rem] resize-y"
                            />
                            {welcomeMessage.trim() ? (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Preview:{" "}
                                <WelcomeMessagePreview text={welcomeMessage} />
                              </p>
                            ) : null}
                          </div>
                        </SettingsFieldRow>
                      ) : null}
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
              )}
            </TabsContent>

            <TabsContent value="knowledge">
              {() => (
                <div className={TAB_CONTENT_CLASS}>
                  <SettingsPageHeader
                    title={TAB_META.knowledge.title}
                    description={TAB_META.knowledge.description}
                  />
                  <SettingsSectionCard
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Knowledge Notes</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${noteSyncStatus === "processing"
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse"
                            : noteSyncStatus === "failed"
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            }`}
                        >
                          {noteSyncStatus === "processing"
                            ? "Processing"
                            : noteSyncStatus === "failed"
                              ? "Failed"
                              : "Ready"}
                        </span>
                        <Tooltip content={includeNotesInKnowledge ? "These notes are used by the assistant when replying." : "These notes are saved, but the assistant ignores them in replies."}>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${includeNotesInKnowledge
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                          >
                            {includeNotesInKnowledge ? "Included" : "Excluded"}
                          </span>
                        </Tooltip>
                      </div>
                    }
                    description={
                      kbEmbeddingSnapshot != null
                        ? `Internal notes for admins describing the scope of the bot's knowledge. (${kbEmbeddingSnapshot.noteContentLength} chars in KB)`
                        : "Internal notes for admins describing the scope of the bot's knowledge."
                    }
                    headerAction={
                      <div className="flex items-center gap-0">
                        <Tooltip content="Turn this on to let the assistant use these notes when replying. Turn it off to ignore these notes in replies.">
                          <span className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md">
                            <Switch
                              checked={includeNotesInKnowledge}
                              onCheckedChange={(checked) => setIncludeNotesInKnowledge(checked)}
                              aria-label="Include notes in knowledge base"
                              className="scale-90"
                              disabled={noteSyncStatus === "processing" || submitting}
                            />
                          </span>
                        </Tooltip>
                        {botId && onRetryNote ? (
                          <Tooltip content="Refresh these notes so the assistant uses the latest version.">
                            <button
                              type="button"
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent transition outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${noteSyncStatus === "processing"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 cursor-not-allowed animate-pulse"
                                : noteSyncStatus === "failed"
                                  ? "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30"
                                  : noteSyncStatus === "ready"
                                    ? "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                }`}
                              onClick={() => setRefreshNotesConfirmOpen(true)}
                              disabled={noteSyncStatus === "processing"}
                              aria-label="Refresh notes in knowledge base"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${noteSyncStatus === "processing" ? "animate-spin" : ""}`}
                                aria-hidden
                              />
                            </button>
                          </Tooltip>
                        ) : null}
                        <Tooltip content="Edit internal notes">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-transparent text-brand-600 outline-none ring-0 transition hover:bg-brand-100 focus:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-900/25 dark:hover:text-brand-300"
                            onClick={openKnowledgeNotesSheet}
                            aria-label="Edit internal notes"
                            disabled={noteSyncStatus === "processing" || submitting}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </button>
                        </Tooltip>
                      </div>
                    }
                  >
                    <SettingsFieldRow
                      label="Internal notes"
                      htmlFor="knowledge-description-preview"
                      helperText="Not shown to users. Describe what knowledge you've added so other admins can understand scope."
                    >
                      <div className="space-y-2">
                        {noteSyncStatus === "processing" || submitting ? (
                          <div
                            className="min-h-[5rem] w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200"
                            aria-readonly
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {(knowledgeDescription || "").trim() ? knowledgeDescription : "—"}
                            </p>
                          </div>
                        ) : (
                          <div
                            id="knowledge-description-preview"
                            className="min-h-[5rem] max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                          >
                            {(knowledgeDescription || "").trim() ? (
                              <p className="whitespace-pre-wrap break-words">{knowledgeDescription}</p>
                            ) : (
                              <p className="text-gray-400 dark:text-gray-500">No internal notes yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </SettingsFieldRow>
                  </SettingsSectionCard>

                  <SettingsSectionCard
                    title="FAQs"
                    description="Curated questions and answers used by the bot."
                  >
                    <div className="space-y-3">
                      <BotFaqsEditor
                        value={faqs}
                        onChange={setFaqs}
                        botId={botId}
                        onRetryFaq={onRetryFaq}
                        autoRefreshFaqsToken={faqAutoRefreshToken}
                        kbEmbeddingSnapshot={kbEmbeddingSnapshot}
                      />
                    </div>
                  </SettingsSectionCard>

                  {initialBot?.id ? (
                    <BotDocumentsManager
                      botId={initialBot.id}
                      documents={initialBot.documents ?? []}
                      health={
                        health
                          ? {
                            lastIngestedAt: health.lastIngestedAt,
                            lastFailedDoc: health.lastFailedDoc,
                          }
                          : undefined
                      }
                      onUploadingChange={onSavingChange}
                      pollTick={knowledgePollTick}
                      onKnowledgePollResult={handleKnowledgePollResult}
                    />
                  ) : (
                    <SettingsSectionCard
                      title="Documents"
                      description="Upload and manage source documents used by the bot."
                    >
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                        Save the bot first to upload documents.
                      </div>
                    </SettingsSectionCard>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="integrations">
              {() => (
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
                                  const response = await apiFetch("/api/user/openai/test-key", {
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
              )}
            </TabsContent>

            <TabsContent value="chat-experience">
              {() => (
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
                          <div className="contents">
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
                          </div>
                        ) : (
                          <div className="contents">
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
                          </div>
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
                        {chatUI.showScrollToBottom !== false ? (
                          <>
                            <SettingsToggleRow
                              label="Show label next to arrow"
                              htmlFor="scroll-to-bottom-label-show"
                              helperText="Arrow is always shown; turn off to use icon only."
                              control={
                                <input
                                  id="scroll-to-bottom-label-show"
                                  type="checkbox"
                                  checked={chatUI.showScrollToBottomLabel !== false}
                                  onChange={(e) =>
                                    setChatUI((prev) => ({
                                      ...prev,
                                      showScrollToBottomLabel: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                                />
                              }
                            />
                            <SettingsFieldRow
                              label="Scroll button text"
                              htmlFor="scroll-to-bottom-label-text"
                              helperText='Default is “Scroll to latest” when empty.'
                            >
                              <Input
                                id="scroll-to-bottom-label-text"
                                value={chatUI.scrollToBottomLabel ?? ""}
                                onChange={(e) =>
                                  setChatUI((prev) => ({ ...prev, scrollToBottomLabel: e.target.value }))
                                }
                                placeholder="Scroll to latest"
                                className="w-full max-w-md"
                                disabled={chatUI.showScrollToBottomLabel === false}
                              />
                            </SettingsFieldRow>
                          </>
                        ) : null}
                        <SettingsToggleRow
                          label="Message list scrollbar"
                          htmlFor="show-scrollbar"
                          helperText="When on, a slim scrollbar uses your primary color. When off, the bar is hidden (still scrollable)."
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
                      <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                        <SettingsToggleRow
                          label="Show quick links menu"
                          htmlFor="show-menu-quick-links"
                          helperText="When on, a header button opens your configured links. Turn off to hide it entirely."
                          control={
                            <input
                              id="show-menu-quick-links"
                              type="checkbox"
                              checked={chatUI.showMenuQuickLinks !== false}
                              onChange={(e) =>
                                setChatUI((prev) => ({ ...prev, showMenuQuickLinks: e.target.checked }))
                              }
                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                            />
                          }
                        />
                        {chatUI.showMenuQuickLinks !== false ? (
                          <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-600 dark:bg-gray-900/40">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Up to 10 links. Each needs a label and a path or URL. Pick a menu button icon, then add links.
                            </p>
                            <SettingsFieldRow
                              label="Menu button icon"
                              htmlFor="quick-links-menu-icon"
                              helperText="Shown on the header control that opens this list."
                            >
                              <QuickLinksMenuIconPicker
                                value={chatUI.menuQuickLinksMenuIcon}
                                onChange={(next) =>
                                  setChatUI((prev) => ({ ...prev, menuQuickLinksMenuIcon: next }))
                                }
                              />
                            </SettingsFieldRow>
                            <MenuQuickLinksEditor
                              value={chatUI.menuQuickLinks}
                              onChange={(next) =>
                                setChatUI((prev) => ({ ...prev, menuQuickLinks: next }))
                              }
                            />
                          </div>
                        ) : null}
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
              )}
            </TabsContent>

            <TabsContent value="appearance">
              {() => {
                const appearanceLauncherPreviewPx = Math.min(
                  Math.min(96, Math.max(32, chatUI.launcherSize ?? 48)),
                  64,
                );
                const appearanceRingPct = Math.min(30, Math.max(0, chatUI.launcherAvatarRingWidth ?? 18));
                const appearanceLauncherShadow =
                  chatUI.shadowIntensity === "none"
                    ? "shadow-none"
                    : chatUI.shadowIntensity === "low"
                      ? "shadow-sm"
                      : chatUI.shadowIntensity === "high"
                        ? "shadow-lg"
                        : "shadow-md";
                const appearanceEmojiFontPx = Math.min(
                  40,
                  Math.max(14, Math.round(appearanceLauncherPreviewPx * 0.38)),
                );
                return (
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
                            onChange={(e) => {
                              const v = e.target.value as BotChatUI["backgroundStyle"];
                              setChatUI((prev) => ({
                                ...prev,
                                backgroundStyle: v,
                                ...(v === "dark"
                                  ? { composerBorderWidth: 2 }
                                  : v === "light"
                                    ? { composerBorderWidth: 1 }
                                    : {}),
                              }));
                            }}
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
                          <div className="flex flex-col gap-2">
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
                            {chatUI.showChatBorder !== false ? (
                              <div className="flex flex-wrap items-center gap-2 pl-6">
                                <label htmlFor="chat-panel-border-width" className="text-sm text-gray-600 dark:text-gray-400">
                                  Width (px)
                                </label>
                                <Input
                                  id="chat-panel-border-width"
                                  type="number"
                                  min={0}
                                  max={5}
                                  value={chatUI.chatPanelBorderWidth ?? 1}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(n)) {
                                      setChatUI((prev) => ({
                                        ...prev,
                                        chatPanelBorderWidth: Math.max(0, Math.min(5, n)),
                                      }));
                                    }
                                  }}
                                  className="w-20"
                                />
                                <span className="text-xs text-gray-500 dark:text-gray-500">0–5, default 1</span>
                              </div>
                            ) : null}
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
                          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Launcher preview
                          </p>
                          <div
                            className="relative flex min-h-[7.5rem] w-full items-end rounded-lg border border-dashed border-gray-300 bg-gray-100/50 p-3 dark:border-gray-600 dark:bg-gray-900/20"
                            aria-hidden
                          >
                            <div
                              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white ${appearanceLauncherShadow} ${chatUI.launcherPosition === "bottom-left" ? "mr-auto" : "ml-auto"
                                }`}
                              style={{
                                width: appearanceLauncherPreviewPx,
                                height: appearanceLauncherPreviewPx,
                                minWidth: 24,
                                minHeight: 24,
                                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                                  ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                                  : DEFAULT_CHAT_UI.primaryColor,
                              }}
                            >
                              {chatUI.launcherIcon === "bot-avatar" ? (
                                (botImageObjectUrl || botImageUrl) &&
                                  isSafeImagePreviewSrc(String(botImageObjectUrl || botImageUrl || "")) ? (
                                  !launcherThemePreviewFailed ? (
                                    <span
                                      className="flex h-full w-full items-center justify-center"
                                      style={{ padding: `${appearanceRingPct}%` }}
                                    >
                                      <img
                                        src={botImageObjectUrl || botImageUrl || ""}
                                        alt=""
                                        className="h-full w-full rounded-full object-cover"
                                        onError={() => setLauncherThemePreviewFailed(true)}
                                      />
                                    </span>
                                  ) : (
                                    <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200/90 dark:bg-gray-700/90">
                                      <ImageOff className="h-[45%] w-[45%] text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                                    </span>
                                  )
                                ) : avatarEmoji.trim() ? (
                                  <span
                                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
                                    style={{ padding: `${appearanceRingPct}%` }}
                                  >
                                    <span
                                      className="flex max-h-full max-w-full items-center justify-center leading-none"
                                      style={{ fontSize: `${appearanceEmojiFontPx}px` }}
                                    >
                                      {avatarEmoji.trim()}
                                    </span>
                                  </span>
                                ) : (
                                  <span
                                    className="flex h-full w-full items-center justify-center"
                                    style={{ padding: `${appearanceRingPct}%` }}
                                  >
                                    <Bot className="h-[55%] w-[55%] min-h-[14px] min-w-[14px]" strokeWidth={2} aria-hidden />
                                  </span>
                                )
                              ) : chatUI.launcherIcon === "custom" ? (
                                chatUI.launcherAvatarUrl &&
                                  isSafeImagePreviewSrc(String(chatUI.launcherAvatarUrl)) ? (
                                  !launcherThemePreviewFailed ? (
                                    <span
                                      className="flex h-full w-full items-center justify-center"
                                      style={{ padding: `${appearanceRingPct}%` }}
                                    >
                                      <img
                                        src={chatUI.launcherAvatarUrl}
                                        alt=""
                                        className="h-full w-full rounded-full object-cover"
                                        onError={() => setLauncherThemePreviewFailed(true)}
                                      />
                                    </span>
                                  ) : (
                                    <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200/90 dark:bg-gray-700/90">
                                      <ImageOff className="h-[45%] w-[45%] text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                                    </span>
                                  )
                                ) : (
                                  <span
                                    className="flex h-full w-full items-center justify-center"
                                    style={{ padding: `${appearanceRingPct}%` }}
                                  >
                                    <Bot className="h-[55%] w-[55%] min-h-[14px] min-w-[14px]" strokeWidth={2} aria-hidden />
                                  </span>
                                )
                              ) : (
                                <span
                                  className="flex h-full w-full items-center justify-center"
                                  style={{ padding: `${appearanceRingPct}%` }}
                                >
                                  <MessageCircle
                                    className="h-[55%] w-[55%] min-h-[14px] min-w-[14px]"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </span>
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
                            helperText="Chat icon; or your bot image/emoji; or custom image URL (see below)."
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
                            helperText="Accent ring around the launcher (default icon, avatar, or custom), 0–30%. 0 = none."
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
                          <div className={SETTINGS_GRID_FULL}>
                            <SettingsFieldRow
                              label="When chat is open"
                              htmlFor="launcher-when-open"
                              helperText="What the launcher button shows while the chat panel is open."
                            >
                              <select
                                id="launcher-when-open"
                                value={chatUI.launcherWhenOpen ?? "chevron-down"}
                                onChange={(e) =>
                                  setChatUI((prev) => ({
                                    ...prev,
                                    launcherWhenOpen: e.target.value as BotChatUI["launcherWhenOpen"],
                                  }))
                                }
                                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                              >
                                <option value="chevron-down">Down arrow</option>
                                <option value="close">Close (X)</option>
                                <option value="same">Same as when closed (launcher)</option>
                              </select>
                            </SettingsFieldRow>
                          </div>
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
                                  isSafeImagePreviewSrc(String(chatUI.launcherAvatarUrl)) &&
                                    !launcherCustomPreviewLoadFailed ? (
                                    <div className="relative p-4">
                                      <img
                                        src={chatUI.launcherAvatarUrl}
                                        alt=""
                                        className="h-24 w-24 rounded-full border border-gray-200 object-cover shadow-sm dark:border-gray-600"
                                        onError={() => setLauncherCustomPreviewLoadFailed(true)}
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
                                    <div className="relative p-4">
                                      <div className="flex justify-center">
                                        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-dashed border-amber-300/80 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/30">
                                          <ImageOff className="h-10 w-10 text-amber-600/90 dark:text-amber-400/90" strokeWidth={1.75} aria-hidden />
                                        </div>
                                      </div>
                                      <p className="mt-3 max-w-[12rem] text-center text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                        {isSafeImagePreviewSrc(String(chatUI.launcherAvatarUrl)) && launcherCustomPreviewLoadFailed
                                          ? "Couldn’t load this image. Try another URL or upload a file."
                                          : "Paste a valid https://… URL or upload an image."}
                                      </p>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setChatUI((prev) => ({ ...prev, launcherAvatarUrl: undefined }))}
                                        className="mt-3 w-full"
                                      >
                                        Clear
                                      </Button>
                                    </div>
                                  )
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
                                Upload or paste an image URL. Used when Launcher icon is “Custom”. PNG, JPG or WEBP. Max 2MB.
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
                              <SettingsFieldRow
                                label="Image URL"
                                htmlFor="launcher-avatar-url"
                                helperText="HTTPS link to your image. Shown above when valid; invalid URLs show a broken-image hint."
                              >
                                <Input
                                  id="launcher-avatar-url"
                                  type="text"
                                  inputMode="url"
                                  autoComplete="url"
                                  value={launcherCustomUrlInputValue(chatUI.launcherAvatarUrl)}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setChatUI((prev) => ({ ...prev, launcherAvatarUrl: v.trim() || undefined }));
                                  }}
                                  placeholder="https://example.com/launcher.png"
                                  className="w-full"
                                />
                              </SettingsFieldRow>
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
                        {chatUI.showBranding !== false ||
                          (chatUI.showPrivacyText !== false && Boolean(chatUI.privacyText?.trim())) ? (
                          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-800/50">
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Footer preview
                            </p>
                            <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-center dark:border-gray-700 dark:bg-gray-900">
                              {chatUI.showBranding !== false ? (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {chatUI.brandingMessage?.trim() || "Your branding message will appear here."}
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">(Branding line hidden)</p>
                              )}
                              {chatUI.showPrivacyText !== false && chatUI.privacyText?.trim() ? (
                                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                                  {chatUI.privacyText.trim()}
                                </p>
                              ) : chatUI.showPrivacyText !== false ? (
                                <p className="mt-1 text-[10px] text-gray-400/70 dark:text-gray-500/50">
                                  (Privacy line — add text below)
                                </p>
                              ) : (
                                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">(Privacy line hidden)</p>
                              )}
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
                              placeholder="e.g. Powered by Assistrio"
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
                        <SettingsToggleRow
                          label="Show privacy / footer line"
                          htmlFor="show-privacy-text"
                          helperText="Second line for privacy, legal, or notices (below the branding line when both are shown)."
                          control={
                            <input
                              id="show-privacy-text"
                              type="checkbox"
                              checked={chatUI.showPrivacyText !== false}
                              onChange={(e) =>
                                setChatUI((prev) => ({ ...prev, showPrivacyText: e.target.checked }))
                              }
                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                            />
                          }
                        />
                        {chatUI.showPrivacyText !== false ? (
                          <SettingsFieldRow
                            label="Privacy / footer line"
                            htmlFor="privacy-footer-text"
                            helperText="Optional second line (e.g. privacy notice). Shown only when this toggle is on and text is not empty."
                          >
                            <Input
                              id="privacy-footer-text"
                              value={chatUI.privacyText ?? ""}
                              onChange={(e) =>
                                setChatUI((prev) => ({ ...prev, privacyText: e.target.value || undefined }))
                              }
                              placeholder="Your conversations are private and secure."
                            />
                          </SettingsFieldRow>
                        ) : (
                          <SettingsFieldRow
                            label="Privacy / footer line"
                            htmlFor="privacy-footer-text-disabled"
                            disabled
                            dependencyNote="Enable “Show privacy / footer line” to edit this text."
                          >
                            <Input
                              id="privacy-footer-text-disabled"
                              value=""
                              disabled
                              placeholder="Privacy line"
                              className="opacity-60"
                            />
                          </SettingsFieldRow>
                        )}
                      </div>
                    </SettingsSectionCard>
                  </div>
                );
              }}
            </TabsContent>

            <TabsContent value="publish">
              {() => (
                <div className={TAB_CONTENT_CLASS}>
                  <SettingsPageHeader
                    title={TAB_META.publish.title}
                    description={TAB_META.publish.description}
                  />

                  <SettingsSectionCard
                    title="Visibility"
                    description="Choose whether this bot is fully public (listed and embeddable with the access key only) or private."
                  >
                    <SettingsFieldRow
                      label="Public access"
                      htmlFor="bot-visibility-unified"
                      helperText="Public: can be listed or discovered, and the embed snippet needs only the access key. Private: not for public listing; embedding requires the access key and secret key together."
                    >
                      <select
                        id="bot-visibility-unified"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        value={isPublic && visibility === "public" ? "public" : "private"}
                        onChange={(event) => {
                          const fullPublic = event.target.value === "public";
                          setIsPublic(fullPublic);
                          setVisibility(fullPublic ? "public" : "private");
                        }}
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </SettingsFieldRow>
                  </SettingsSectionCard>

                  <SettingsSectionCard
                    title="Allowed embed domains"
                    description={
                      maxAllowedDomains > 1
                        ? "Runtime embeds must match at least one rule below (up to 10). For “Main domain”, enter your registrable host first, then list which subdomains are allowed—only those hostnames work; other subdomains are blocked. Use “Exact origin” for a single scheme + host + port. Required to publish; preview in the editor works without rules."
                        : "Runtime embeds must match your rule below. Enter your main domain, then list allowed subdomain labels; only those hostnames are permitted. “Exact origin” allows only that origin. Required to publish."
                    }
                  >
                    <SettingsFieldRow
                      label="Embed rules"
                      htmlFor="allowed-embed-domain-0"
                      helperText={
                        maxAllowedDomains > 1
                          ? "Main domain: e.g. example.com, then add each subdomain label one at a time (www → www.example.com). Check “Include apex” to allow example.com itself. Exact origin: full URL (e.g. https://example.com:3000). Do not use localhost or loopback; local testing uses server dev mode instead."
                          : "Main domain first, then add subdomain labels one by one. Only listed hostnames match. Exact origin: full URL only. Do not use localhost or loopback here."
                      }
                    >
                      <div className="flex flex-col gap-3">
                        {allowedDomainRows.map((row, index) => (
                          <div
                            key={index}
                            className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                id={index === 0 ? "allowed-embed-mode-0" : `allowed-embed-mode-${index}`}
                                className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                value={row.mode}
                                onChange={(e) => {
                                  const mode = e.target.value as AllowedDomainRowMode;
                                  setAllowedDomainRows((prev) => {
                                    const next = [...prev];
                                    next[index] =
                                      mode === "exact"
                                        ? { mode: "exact", value: "" }
                                        : emptyDomainRow();
                                    return next;
                                  });
                                }}
                                aria-label="Match type"
                              >
                                <option value="domain">Main domain + subdomains</option>
                                <option value="exact">Exact origin</option>
                              </select>
                              {row.mode === "exact" ? (
                                <Input
                                  id={index === 0 ? "allowed-embed-domain-0" : `allowed-embed-domain-${index}`}
                                  type="text"
                                  value={row.value}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setAllowedDomainRows((prev) => {
                                      const next = [...prev];
                                      const cur = next[index];
                                      if (cur?.mode === "exact") next[index] = { mode: "exact", value: v };
                                      return next;
                                    });
                                  }}
                                  placeholder="https://www.example.com:3000"
                                  className="min-w-0 flex-1 font-mono text-sm"
                                  autoComplete="off"
                                />
                              ) : null}
                              {maxAllowedDomains > 1 && allowedDomainRows.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="ml-auto shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                                  onClick={() =>
                                    setAllowedDomainRows((prev) => {
                                      const next = prev.filter((_, i) => i !== index);
                                      return next.length < 1 ? [emptyDomainRow()] : next;
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                            {row.mode === "domain" ? (
                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Main domain
                                  <Input
                                    id={index === 0 ? "allowed-embed-main-0" : `allowed-embed-main-${index}`}
                                    type="text"
                                    value={row.main}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setAllowedDomainRows((prev) => {
                                        const next = [...prev];
                                        const cur = next[index];
                                        if (cur?.mode === "domain")
                                          next[index] = { ...cur, main: v };
                                        return next;
                                      });
                                    }}
                                    placeholder="example.com"
                                    className="mt-1 font-mono text-sm"
                                    autoComplete="off"
                                  />
                                </label>
                                <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 rounded border-gray-300"
                                    checked={row.includeApex}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setAllowedDomainRows((prev) => {
                                        const next = [...prev];
                                        const cur = next[index];
                                        if (cur?.mode === "domain")
                                          next[index] = { ...cur, includeApex: on };
                                        return next;
                                      });
                                    }}
                                  />
                                  <span>
                                    Include apex hostname (
                                    <span className="font-mono text-xs">
                                      {row.main.trim() || "example.com"}
                                    </span>
                                    )
                                  </span>
                                </label>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Subdomain labels
                                  </span>
                                  <EmbedSubdomainLabelsList
                                    idPrefix={index === 0 ? "allowed-embed-0" : `allowed-embed-${index}`}
                                    labels={row.subLabels}
                                    onChange={(next) => {
                                      setAllowedDomainRows((prev) => {
                                        const copy = [...prev];
                                        const cur = copy[index];
                                        if (cur?.mode === "domain")
                                          copy[index] = { ...cur, subLabels: next };
                                        return copy;
                                      });
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Add each label (e.g. <span className="font-mono">www</span>, <span className="font-mono">app</span>) and press{" "}
                                  <span className="font-medium">Add</span> or Enter. Only the apex (if enabled) and{" "}
                                  <span className="font-mono">label.{row.main.trim() || "example.com"}</span> for each
                                  label are allowed. Unlisted subdomains cannot embed the widget.
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {maxAllowedDomains > 1 && allowedDomainRows.length < maxAllowedDomains ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="self-start"
                            onClick={() => setAllowedDomainRows((prev) => [...prev, emptyDomainRow()])}
                          >
                            Add rule
                          </Button>
                        ) : null}
                      </div>
                    </SettingsFieldRow>

                    <div className="mt-6 space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Runtime origin preview
                        </span>
                        <span className="max-w-md text-xs text-gray-500 dark:text-gray-400">
                          After publish, the widget only loads when the page&apos;s origin matches one of these (or the
                          equivalent for main-domain rules — see note below).
                        </span>
                      </div>
                      <SettingsEmbedPreview
                        eyebrow="Allowed page origins"
                        badge={
                          hasAllowedEmbedDomain ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300">
                              Publish-ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                              Incomplete
                            </span>
                          )
                        }
                      >
                        <div className="space-y-4">
                          {allowedEmbedDomainsPreviewBlocks.map((block) => (
                            <div key={block.key} className="space-y-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {block.title}
                              </p>
                              {block.lines.length > 0 ? (
                                <ul className="list-none space-y-1 p-0 m-0">
                                  {block.lines.map((line) => (
                                    <li
                                      key={line}
                                      className="break-all font-mono text-[13px] leading-snug text-gray-800 dark:text-gray-200"
                                    >
                                      {line}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                                  {block.hint}
                                </p>
                              )}
                            </div>
                          ))}
                          <p className="border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Main domain</span> rules match
                            by hostname only —{" "}
                            <span className="font-mono">https://</span>, <span className="font-mono">http://</span>, and
                            any port on that host are allowed (e.g. <span className="font-mono">https://app.example.com:8443</span>
                            ). <span className="font-medium text-gray-700 dark:text-gray-300">Exact origin</span> matches
                            scheme, host, and port exactly.
                          </p>
                        </div>
                      </SettingsEmbedPreview>
                    </div>
                  </SettingsSectionCard>

                  <SettingsSectionCard
                    title="Access & usage policy"
                    description="Runtime keys apply as soon as you rotate them. Use Save below only for visibility and conversation limits in this section (or save the whole bot from the bar above)."
                  >
                    <SettingsFieldRow
                      label="Multiple conversations"
                      htmlFor="visitor-multi-chat-enabled"
                      helperText="Controls how the embed widget handles conversation history for anonymous visitors (runtime embed)."
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          id="visitor-multi-chat-enabled"
                          type="checkbox"
                          className="mt-1 rounded border-gray-300"
                          checked={visitorMultiChatEnabled}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setVisitorMultiChatEnabled(on);
                            if (on) {
                              setVisitorMultiChatCapUnlimited(true);
                            }
                          }}
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-100">
                          Allow multiple saved conversations per visitor
                        </span>
                      </label>
                    </SettingsFieldRow>

                    <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-3 text-xs leading-relaxed text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
                      <p className="font-medium text-sky-900 dark:text-sky-50">How it works in the widget</p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sky-900/90 dark:text-sky-100/95">
                        <li>
                          <span className="font-medium">Off (single active thread):</span> visitors always continue in
                          their <em>latest</em> conversation. Older threads appear under “View recent chats” as{" "}
                          <strong>read-only</strong> (they can open and read past messages but cannot send there).
                        </li>
                        <li>
                          <span className="font-medium">On (multiple saved threads):</span> visitors can open recent
                          threads and <strong>reply</strong> in any of them. “Start a new chat” and “End chat” only
                          appear while they are <strong>under</strong> the saved-conversation limit (unlimited = always
                          available).
                        </li>
                      </ul>
                    </div>

                    {visitorMultiChatEnabled ? (
                      <SettingsFieldRow
                        label="Saved conversations per visitor"
                        htmlFor="visitor-cap-unlimited"
                        helperText="Unlimited lets visitors keep any number of threads. With a limit, they cannot start a new thread once they reach the cap (they can still open existing threads)."
                      >
                        <div className="flex flex-col gap-3">
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              id="visitor-cap-unlimited"
                              type="radio"
                              name="visitor-multi-chat-cap"
                              className="mt-1 border-gray-300"
                              checked={visitorMultiChatCapUnlimited}
                              onChange={() => setVisitorMultiChatCapUnlimited(true)}
                            />
                            <span>
                              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Unlimited
                              </span>
                              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                No maximum number of saved conversation threads per visitor.
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              id="visitor-cap-limited"
                              type="radio"
                              name="visitor-multi-chat-cap"
                              className="mt-1 border-gray-300"
                              checked={!visitorMultiChatCapUnlimited}
                              onChange={() => setVisitorMultiChatCapUnlimited(false)}
                            />
                            <span>
                              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                Set a maximum
                              </span>
                              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                Cap how many concurrent saved threads each visitor may have. Minimum 2—the current chat
                                counts as one.
                              </span>
                            </span>
                          </label>
                          {!visitorMultiChatCapUnlimited ? (
                            <div className="flex flex-wrap items-center gap-2 pl-7">
                              <span className="text-sm text-gray-600 dark:text-gray-300">Up to</span>
                              <Input
                                id="visitor-multi-chat-max"
                                type="number"
                                min={2}
                                step={1}
                                className="w-24"
                                value={visitorMultiChatMax}
                                onChange={(e) => setVisitorMultiChatMax(e.target.value)}
                                aria-label="Maximum saved conversations per visitor"
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                saved conversations
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </SettingsFieldRow>
                    ) : null}

                    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/40">
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Rotating the access or secret key updates the server immediately—you do not need to click save
                        afterward for keys. Use this button only after changing{" "}
                        <span className="font-medium">visibility</span> (above) or{" "}
                        <span className="font-medium">conversation limits</span> here, and you want those
                        persisted without using the main Save changes bar.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void saveAccessSettings()}
                          disabled={!botId || accessActionLoading !== null}
                        >
                          {accessActionLoading === "save" ? "Saving..." : "Save visibility & limits"}
                        </Button>
                        {accessActionMessage ? (
                          <p className="text-xs text-gray-600 dark:text-gray-300">{accessActionMessage}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <SettingsFieldRow
                        label="Access key"
                        htmlFor="access-key-readonly"
                        helperText="Used by public runtime init/chat access checks. Rotate applies immediately—no extra save."
                      >
                        <div className="flex items-center gap-2">
                          <Input id="access-key-readonly" value={accessKey} readOnly />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void copyRuntimeKey("access")}
                            disabled={!accessKey}
                          >
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setRotateKeyConfirm("access")}
                            disabled={!botId || accessActionLoading !== null}
                          >
                            {accessActionLoading === "rotate-access" ? "Rotating..." : "Rotate"}
                          </Button>
                        </div>
                      </SettingsFieldRow>

                      <SettingsFieldRow
                        label="Secret key"
                        htmlFor="secret-key-readonly"
                        helperText="Required only when runtime visibility is private. Rotate applies immediately—no extra save."
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            id="secret-key-readonly"
                            value={secretKeyVisible ? secretKey : maskRuntimeKey(secretKey)}
                            readOnly
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setSecretKeyVisible((v) => !v)}
                            disabled={!secretKey}
                          >
                            {secretKeyVisible ? "Hide" : "Reveal"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void copyRuntimeKey("secret")}
                            disabled={!secretKey}
                          >
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setRotateKeyConfirm("secret")}
                            disabled={!botId || accessActionLoading !== null}
                          >
                            {accessActionLoading === "rotate-secret" ? "Rotating..." : "Rotate"}
                          </Button>
                        </div>
                      </SettingsFieldRow>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Creator type</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {creatorType === "visitor" ? "Visitor" : "User"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Owner visitor ID</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {ownerVisitorId || "—"}
                        </p>
                      </div>
                    </div>
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
                            {visibility === "private" ? "Private" : "Public"}
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
                    title="Embed snippet"
                    description={
                      embedSnippetUnlocked
                        ? "Use this production runtime snippet on your website. It updates automatically when keys or visibility change."
                        : "The production snippet is available after you publish. You can still use the live preview at the bottom of this page while editing."
                    }
                  >
                    <div className="space-y-3">
                      <Textarea
                        readOnly
                        value={
                          embedSnippetUnlocked
                            ? runtimeSnippet
                            : "Publish your bot (with at least one allowed embed domain) to enable the production snippet."
                        }
                        rows={10}
                        disabled={!embedSnippetUnlocked}
                        className={`font-mono text-xs ${!embedSnippetUnlocked ? "opacity-60" : ""}`}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!embedSnippetUnlocked}
                          onClick={async () => {
                            if (!embedSnippetUnlocked) return;
                            try {
                              await navigator.clipboard.writeText(runtimeSnippet);
                              setSnippetCopyMessage("Snippet copied.");
                            } catch {
                              setSnippetCopyMessage("Failed to copy snippet.");
                            }
                          }}
                        >
                          Copy snippet
                        </Button>
                        {snippetCopyMessage ? (
                          <p className="text-xs text-gray-600 dark:text-gray-300">{snippetCopyMessage}</p>
                        ) : null}
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
                      <li>
                        <div
                          className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${hasAllowedEmbedDomain
                            ? "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"
                            : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                            }`}
                        >
                          {hasAllowedEmbedDomain ? (
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
                            <p className={`text-sm font-medium ${hasAllowedEmbedDomain ? "text-gray-900 dark:text-gray-100" : "text-amber-800 dark:text-amber-200"}`}>
                              At least one allowed embed domain
                            </p>
                            {!hasAllowedEmbedDomain ? (
                              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Add at least one embed rule in Allowed embed domains above.</p>
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
              )}
            </TabsContent>
          </div>
        </Tabs>
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
      {mode === "edit" && botId ? (
        <BotEditEmbedPreview botId={botId} previewOverrides={embedPreviewOverrides} />
      ) : null}
    </>
  );
}
