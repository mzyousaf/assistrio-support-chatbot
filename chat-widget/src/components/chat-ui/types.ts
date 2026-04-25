/**
 * Chat UI (Intercom Fin–inspired) – shared types.
 */

export interface ChatUISource {
  title: string;
  snippet?: string;
  score?: number;
  documentId?: string;
  chunkId?: string;
}

/** Backend API returns sources as { documentId, chunkId, title, sourceType?, url?, text, score? }. Also accepts aliased keys used by older responses. */
export function mapSources(raw: unknown): ChatUISource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object")
    .map((s, i) => {
      const title =
        typeof s.title === "string" && s.title.trim()
          ? s.title.trim()
          : typeof s.docTitle === "string" && s.docTitle.trim()
            ? s.docTitle.trim()
            : `Source ${i + 1}`;
      const snippet =
        typeof s.snippet === "string"
          ? s.snippet.trim() || undefined
          : typeof s.text === "string"
            ? s.text.trim() || undefined
            : typeof s.preview === "string"
              ? s.preview.trim() || undefined
              : undefined;
      const documentId =
        typeof s.documentId === "string"
          ? s.documentId
          : typeof s.docId === "string"
            ? s.docId
            : undefined;
      const chunkId = typeof s.chunkId === "string" ? s.chunkId : undefined;
      const score =
        typeof s.score === "number" && Number.isFinite(s.score) ? s.score : undefined;
      return { title, snippet, score, documentId, chunkId };
    });
}

export type ChatUIMessageRole = "user" | "assistant" | "system";

export type ChatUIMessageStatus = "sending" | "sent" | "error" | "streaming";

/** Sent with `onSend` when the user submits a voice message (stored on backend Message). */
export type ChatSpeechInputMeta = {
  mode: "dictate" | "voice";
  transcript?: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
};

/** Visitor file sent with a user message (widget upload). */
export type ChatUIMessageAttachment = {
  name: string;
  mimeType: string;
  url: string;
  size?: number;
};

export interface ChatUIMessage {
  id: string;
  role: ChatUIMessageRole;
  content: string;
  createdAt: string;
  sources?: ChatUISource[];
  status?: ChatUIMessageStatus;
  /** Visitor’s thumbs up / down on this assistant reply (widget only). */
  feedbackRating?: "up" | "down";
  /** User voice message metadata (playback + transcript); from API or optimistic send. */
  speechInput?: ChatSpeechInputMeta;
  /** Files attached from the composer (persisted URLs after send). */
  attachments?: ChatUIMessageAttachment[];
}

export interface ChatUITheme {
  /** Accent for user bubble and send button (e.g. #6366f1) */
  accentColor?: string;
  /** Dark theme by default */
  dark?: boolean;
}

export interface ChatUIStrings {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  send?: string;
  copy?: string;
  copied?: string;
  sourcesLabel?: string;
  privacyText?: string;
  back?: string;
  close?: string;
  menu?: string;
  /** User bubble text when voice has no transcript (audio still sent). Default “Voice message”. */
  voiceMessageFallback?: string;
  voiceShowTranscript?: string;
  voiceHideTranscript?: string;
}

