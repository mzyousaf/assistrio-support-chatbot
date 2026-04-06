/**
 * Shapes aligned with `GET /api/public/bots` and `GET /api/public/bots/:slug` (public showcase AI Agents only).
 *
 * `chatUI` and `knowledgeBasePreview` are passed through from the public list API (`shapePublicBotListItem`).
 * Optional fields below are safe to use when present — omitting them does not change the API contract.
 * `knowledgeNotePreview` is a capped excerpt of the active KB note (`GET /api/public/bots`).
 */
export type PublicBotListChatUI = {
  primaryColor?: string;
  backgroundStyle?: string;
  bubbleBorderRadius?: number;
  launcherPosition?: string;
  showBranding?: boolean;
  timePosition?: "top" | "bottom";
  shadowIntensity?: "none" | "low" | "medium" | "high";
  showChatBorder?: boolean;
  showPrivacyText?: boolean;
  showSources?: boolean;
  showCopyButton?: boolean;
  showEmoji?: boolean;
  showMenuQuickLinks?: boolean;
  /** Same image as widget launcher when set — useful as avatar fallback. */
  launcherAvatarUrl?: string;
  /** Header menu destinations (passed through from stored bot; gallery can show labels only). */
  menuQuickLinks?: Array<{ text: string; route: string; icon?: string }>;
};

/** Ready, active knowledge items by type (`GET /api/public/bots`). */
export type PublicKnowledgeBaseCounts = {
  documents: number;
  faqs: number;
  notes: number;
  urls: number;
  html: number;
};

/** Public gallery: KB labels from `GET /api/public/bots`; file download via public redirect when `fileDownloadable`. */
export type PublicKnowledgeBasePreviewItem = {
  title: string;
  sourceType: string;
  fileName?: string;
  fileType?: string;
  /** Set with `fileDownloadable` for `GET /api/public/bots/:slug/documents/:documentId/download`. */
  documentId?: string;
  fileDownloadable?: boolean;
};

export type PublicBotListItem = {
  id: string;
  name: string;
  slug: string;
  visibility: "public";
  accessKey: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  exampleQuestions: string[];
  chatUI?: PublicBotListChatUI;
  createdAt: string;
  /** Ready knowledge items (titles / file names) for gallery cards; may be empty. */
  knowledgeBasePreview?: PublicKnowledgeBasePreviewItem[];
  /** Totals for ready, active knowledge by source type. */
  knowledgeBaseCounts?: PublicKnowledgeBaseCounts;
  /** Active KB note excerpt from `GET /api/public/bots` (capped server-side). */
  knowledgeNotePreview?: string;
  /** Conversation count from `GET /api/public/bots` (0 when none). */
  totalChats?: number;
};

export type PublicBotDetail = {
  id: string;
  slug: string;
  name: string;
  visibility: "public";
  accessKey: string;
  shortDescription: string;
  description?: string;
  category?: string;
  avatarEmoji: string;
  imageUrl: string;
  welcomeMessage?: string;
  chatUI?: unknown;
  faqs: Array<{ question: string; answer: string }>;
  exampleQuestions: string[];
};
