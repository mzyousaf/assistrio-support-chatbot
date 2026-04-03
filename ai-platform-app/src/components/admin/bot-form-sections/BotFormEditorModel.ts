import type { Dispatch, RefObject, SetStateAction } from "react";

import type { KnowledgePollHealthPayload } from "@/components/admin/BotDocumentsManager";
import type { BotFaq } from "@/components/admin/BotFaqsEditor";
import type { User } from "@/hooks/useUser";
import type { AllowedDomainRow, AllowedDomainRowMode } from "@/lib/embedAllowedDomains";
import type { LaunchReadinessModel } from "@/lib/launch-readiness";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

import type { BotFormProps } from "./botFormProps";
import type { BotFormSubmitPayload } from "./botFormSubmitPayload";

/** Shared router surface used by BotForm (tab → route sync). */
export type BotFormRouter = {
  replace: (href: string) => void;
};

export type BotFormHealthState = NonNullable<BotFormProps["initialBot"]>["health"];

export interface BotFormEditorModel {
  mode: BotFormProps["mode"];
  initialBot: BotFormProps["initialBot"];
  onSubmit: BotFormProps["onSubmit"];
  onCreateAnotherBot: BotFormProps["onCreateAnotherBot"];
  submitting: boolean;
  formId: BotFormProps["formId"];
  onDirtyChange: BotFormProps["onDirtyChange"];
  onSavingChange: BotFormProps["onSavingChange"];
  botId: BotFormProps["botId"];
  onRetryFaq: BotFormProps["onRetryFaq"];
  onRetryNote: BotFormProps["onRetryNote"];
  workspaceSectionSlug: BotFormProps["workspaceSectionSlug"];

  router: BotFormRouter;
  pathname: string;
  user: User | null;
  maxAllowedDomains: number;
  emptyDomainRow: () => AllowedDomainRow;

  allowedDomainRows: AllowedDomainRow[];
  setAllowedDomainRows: Dispatch<SetStateAction<AllowedDomainRow[]>>;

  name: string;
  setName: Dispatch<SetStateAction<string>>;
  shortDescription: string;
  setShortDescription: Dispatch<SetStateAction<string>>;
  includeNameInKnowledge: boolean;
  setIncludeNameInKnowledge: Dispatch<SetStateAction<boolean>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  isPublic: boolean;
  setIsPublic: Dispatch<SetStateAction<boolean>>;
  visibility: "public" | "private";
  setVisibility: Dispatch<SetStateAction<"public" | "private">>;
  accessKey: string;
  setAccessKey: Dispatch<SetStateAction<string>>;
  secretKey: string;
  setSecretKey: Dispatch<SetStateAction<string>>;
  creatorType: "user" | "visitor";
  ownerVisitorId: string | undefined;
  visitorMultiChatEnabled: boolean;
  setVisitorMultiChatEnabled: Dispatch<SetStateAction<boolean>>;
  visitorMultiChatCapUnlimited: boolean;
  setVisitorMultiChatCapUnlimited: Dispatch<SetStateAction<boolean>>;
  visitorMultiChatMax: string;
  setVisitorMultiChatMax: Dispatch<SetStateAction<string>>;
  accessActionLoading: "save" | "rotate-access" | "rotate-secret" | null;
  setAccessActionLoading: Dispatch<SetStateAction<"save" | "rotate-access" | "rotate-secret" | null>>;
  accessActionMessage: string | null;
  setAccessActionMessage: Dispatch<SetStateAction<string | null>>;
  rotateKeyConfirm: "access" | "secret" | null;
  setRotateKeyConfirm: Dispatch<SetStateAction<"access" | "secret" | null>>;
  secretKeyVisible: boolean;
  setSecretKeyVisible: Dispatch<SetStateAction<boolean>>;
  snippetCopyMessage: string | null;
  setSnippetCopyMessage: Dispatch<SetStateAction<string | null>>;
  categories: string[];
  setCategories: Dispatch<SetStateAction<string[]>>;
  customCategory: string;
  setCustomCategory: Dispatch<SetStateAction<string>>;
  behaviorPreset: string;
  setBehaviorPreset: Dispatch<SetStateAction<string>>;
  behaviorText: string;
  setBehaviorText: Dispatch<SetStateAction<string>>;
  thingsToAvoid: string;
  setThingsToAvoid: Dispatch<SetStateAction<string>>;
  welcomeMessageEnabled: boolean;
  setWelcomeMessageEnabled: Dispatch<SetStateAction<boolean>>;
  welcomeMessage: string;
  setWelcomeMessage: Dispatch<SetStateAction<string>>;
  welcomeMessageInputRef: RefObject<HTMLTextAreaElement | null>;
  setWelcomeMessageEnabledWithDefault: (on: boolean) => void;
  insertWelcomeVariable: (variable: string) => void;

  knowledgeDescription: string;
  setKnowledgeDescription: Dispatch<SetStateAction<string>>;
  includeNotesInKnowledge: boolean;
  setIncludeNotesInKnowledge: Dispatch<SetStateAction<boolean>>;
  faqs: BotFaq[];
  setFaqs: Dispatch<SetStateAction<BotFaq[]>>;
  faqAutoRefreshToken: number;
  setFaqAutoRefreshToken: Dispatch<SetStateAction<number>>;
  refreshNotesConfirmOpen: boolean;
  setRefreshNotesConfirmOpen: Dispatch<SetStateAction<boolean>>;
  knowledgeNotesSheetOpen: boolean;
  setKnowledgeNotesSheetOpen: Dispatch<SetStateAction<boolean>>;
  knowledgeNotesDraft: string;
  setKnowledgeNotesDraft: Dispatch<SetStateAction<string>>;
  exampleQuestions: string[];
  setExampleQuestions: Dispatch<SetStateAction<string[]>>;
  status: "draft" | "published";
  setStatus: Dispatch<SetStateAction<"draft" | "published">>;
  embedSnippetUnlocked: boolean;
  setEmbedSnippetUnlocked: Dispatch<SetStateAction<boolean>>;
  noteSyncStatus: "processing" | "failed" | "ready";
  setNoteSyncStatus: Dispatch<SetStateAction<"processing" | "failed" | "ready">>;
  submitError: string | null;
  setSubmitError: Dispatch<SetStateAction<string | null>>;
  activeTab: import("@/lib/agent-slug-to-tab").EditorTabValue;
  setActiveTab: Dispatch<SetStateAction<import("@/lib/agent-slug-to-tab").EditorTabValue>>;
  knowledgePollTick: number;
  setKnowledgePollTick: Dispatch<SetStateAction<number>>;
  health: BotFormHealthState | undefined;
  setHealth: Dispatch<SetStateAction<BotFormHealthState | undefined>>;
  kbEmbeddingSnapshot: { faqItemCount: number; noteContentLength: number } | null;
  setKbEmbeddingSnapshot: Dispatch<
    SetStateAction<{ faqItemCount: number; noteContentLength: number } | null>
  >;
  testingKey: boolean;
  setTestingKey: Dispatch<SetStateAction<boolean>>;
  testResult: { ok: boolean; message: string } | null;
  setTestResult: Dispatch<SetStateAction<{ ok: boolean; message: string } | null>>;

  personality: BotPersonality;
  setPersonality: Dispatch<SetStateAction<BotPersonality>>;
  config: BotConfig;
  setConfig: Dispatch<SetStateAction<BotConfig>>;
  openaiApiKeyOverride: string;
  setOpenaiApiKeyOverride: Dispatch<SetStateAction<string>>;
  whisperApiKeyOverride: string;
  setWhisperApiKeyOverride: Dispatch<SetStateAction<string>>;
  leadCapture: BotLeadCaptureV2;
  setLeadCapture: Dispatch<SetStateAction<BotLeadCaptureV2>>;
  chatUI: BotChatUI;
  setChatUI: Dispatch<SetStateAction<BotChatUI>>;

  fileInputRef: RefObject<HTMLInputElement | null>;
  botImageFile: File | null;
  setBotImageFile: Dispatch<SetStateAction<File | null>>;
  botImageUrl: string;
  setBotImageUrl: Dispatch<SetStateAction<string>>;
  avatarEmoji: string;
  setAvatarEmoji: Dispatch<SetStateAction<string>>;
  botImageObjectUrl: string | null;
  setBotImageObjectUrl: Dispatch<SetStateAction<string | null>>;
  previewVisible: boolean;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  dragOver: boolean;
  setDragOver: Dispatch<SetStateAction<boolean>>;
  setIsUploadingImage: Dispatch<SetStateAction<boolean>>;
  isRemovingImage: boolean;
  setIsRemovingImage: Dispatch<SetStateAction<boolean>>;
  botAvatarPreviewLoadFailed: boolean;
  setBotAvatarPreviewLoadFailed: Dispatch<SetStateAction<boolean>>;
  launcherCustomPreviewLoadFailed: boolean;
  setLauncherCustomPreviewLoadFailed: Dispatch<SetStateAction<boolean>>;
  launcherThemePreviewFailed: boolean;
  setLauncherThemePreviewFailed: Dispatch<SetStateAction<boolean>>;

  handleFilePick: (nextFile: File | null) => void;
  buildSubmitPayload: (
    desiredStatus?: "draft" | "published",
    imageUrlOverride?: string,
  ) => Promise<BotFormSubmitPayload | null>;
  submitWithStatus: (desiredStatus?: "draft" | "published") => Promise<void>;
  saveAccessSettings: () => Promise<void>;
  rotateAccessKey: () => Promise<void>;
  rotateSecretKey: () => Promise<void>;
  copyRuntimeKey: (kind: "access" | "secret") => Promise<void>;
  handleRefreshNoteStatus: () => Promise<void>;
  truncateForPreview: (text?: string, maxChars?: number) => string;
  openKnowledgeNotesSheet: () => void;
  closeKnowledgeNotesSheet: () => void;
  saveKnowledgeNotesFromSheet: () => void;
  knowledgeNotesDraftDirty: boolean;
  handleRemoveAvatar: () => Promise<void>;
  handleKnowledgePollResult: (payload: {
    health: KnowledgePollHealthPayload;
    embedding: { faqItemCount: number; noteContentLength: number };
  }) => void;
  handleTabChange: (value: string) => void;

  hasImageUrl: boolean;
  hasImageFile: boolean;
  hasImage: boolean;
  previewSrc: string;
  hasAllowedEmbedDomain: boolean;
  allowedEmbedDomainsPreviewBlocks: Array<{
    key: string;
    title: string;
    lines: string[];
    hint: string;
  }>;
  isPublishBlocked: boolean;
  launchReadinessModel: LaunchReadinessModel;
  runtimeSnippet: string;
}
