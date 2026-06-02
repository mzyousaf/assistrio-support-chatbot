/**
 * Customer app only: fork of `chat-widget` `Chat` (supports `onSend` returning `false` to
 * keep the composer on idle prompt). See `AdminLiveChatAdapter` fork in this folder.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { History, X } from "lucide-react";
import { cx } from "@acw/components/chat-ui/utils";
import type {
  ChatShadowIntensity,
  ComposerControlStyle,
  ScrollChromeStyle,
  ScrollToBottomAlign,
  SpeechRecordingWaveStyle,
  UserBubbleStyle,
} from "@acw/models/botChatUI";
import type { ChatSpeechInputMeta, ChatUIMessage, ChatUISource } from "@acw/components/chat-ui/types";
import type { SuggestedQuestionChip } from "@acw/types";
import { useMediaRecorderCapture } from "@acw/lib/useMediaRecorderCapture";
import { MIN_VOICE_RECORDING_UPLOAD_BYTES } from "@acw/lib/transcriptionUploadFile";
import {
  SpeechRecordingEmptyError,
  SpeechRecordingTooShortError,
  stopRecorderAndTranscribe,
} from "@acw/lib/stopRecorderAndTranscribe";
import { chatPanelOutlineStyle } from "@acw/components/chat-ui/chatPanelChrome";
import { chatShadowIntensityClass } from "@acw/components/chat-ui/chatShadowStyles";
import { ChatHeader } from "@acw/components/chat-ui/ChatHeader";
import { ChatMessages } from "@acw/components/chat-ui/ChatMessages";
import { ChatComposer } from "@acw/components/chat-ui/ChatComposer";
import { AssistrioBrandingPaid } from "@acw/components/chat-ui/AssistrioBrandingPaid";
import { WidgetBranding } from "@acw/components/chat-ui/WidgetBranding";
import { ChatAttachmentsScreen } from "@acw/components/chat-ui/ChatAttachmentsScreen";
import { ChatVoiceMessageDetailScreen } from "@acw/components/chat-ui/ChatVoiceMessageDetailScreen";
import {
  pickWidgetChatFiles,
  WIDGET_CHAT_ACCEPT,
  WIDGET_CHAT_ATTACHMENT_MAX_FILES,
} from "@acw/lib/widgetChatAttachments";
import { CHAT_COMPOSER_INPUT_MAX_LENGTH } from "@acw/lib/chatComposerInputLimit";

type WhisperDictationRollup = {
  sessionCount: number;
  totalRecordDurationMs: number;
  totalAudioSizeBytes: number;
  lastAudioMime?: string;
};

function emptyWhisperDictationRollup(): WhisperDictationRollup {
  return { sessionCount: 0, totalRecordDurationMs: 0, totalAudioSizeBytes: 0, lastAudioMime: undefined };
}

function formatRecentWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(0, 16);
  }
}

const HistoryBackIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export interface ChatProps {
  /** Container width (default 400) */
  width?: number | string;
  /** Container height (default 700) */
  height?: number | string;
  /** Dark theme (default true) */
  dark?: boolean;
  /** Accent color for user bubble and send button */
  accentColor?: string;
  /** Message bubble border radius in px (0–32). Affects message bubbles and suggested chips; container uses fixed radius. */
  bubbleBorderRadius?: number;
  /** When true, show a border around the chat panel using accent color (default true). */
  showChatBorder?: boolean;
  /** Neutral vs brand tint for the panel outline (default `primary`). */
  chatPanelBorderColor?: "default" | "primary";
  /** Border width in px when showChatBorder (0–5, default 1). 0 = no border. */
  chatPanelBorderWidth?: number;
  /** Drop shadow for the chat panel (default medium). Use "none" when an outer wrapper supplies shadow. */
  shadowIntensity?: ChatShadowIntensity;

  // Header
  showHeader?: boolean;
  /** Show bot avatar in header (default true) */
  showAvatarInHeader?: boolean;
  onBack?: () => void;
  /** Show back button in header (default false) */
  showBackButton?: boolean;
  avatar?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Status indicator: "live" | "active" | "none". When "none", no indicator is shown. */
  statusIndicator?: "live" | "active" | "none";
  /** Legacy: when statusIndicator is unset, showLive true = "live", false = "none" */
  showLive?: boolean;
  /** "label" = dot + label text next to title; "dot-only" = dot overlapping avatar */
  liveIndicatorStyle?: "label" | "dot-only";
  /** Status dot: "blinking" (animate-pulse) or "static" (default "blinking") */
  statusDotStyle?: "blinking" | "static";
  /** Show scroll-to-bottom button when user scrolls up (default true) */
  showScrollToBottom?: boolean;
  /** Show label beside the arrow on that button (default true) */
  showScrollToBottomLabel?: boolean;
  /** Custom scroll-to-bottom label (defaults via strings / “Scroll to latest”) */
  scrollToBottomLabel?: string;
  /** Show scrollbar in message area (default true). When false, scrollbar is hidden. */
  showScrollbar?: boolean;
  /** Message list scrollbar thumb style (default `default`). */
  scrollChromeStyle?: ScrollChromeStyle;
  /** Floating scroll-to-latest button; when omitted, matches `scrollChromeStyle`. */
  scrollToBottomChromeStyle?: ScrollChromeStyle;
  /** Floating scroll-to-latest button alignment (default `center`). */
  scrollToBottomAlign?: ScrollToBottomAlign;
  /**
   * `"auto"` (default): message list scrolls when content overflows.
   * `"hidden"`: no scroll in the message list (e.g. embed preview; content may be clipped).
   */
  messageListOverflow?: "auto" | "hidden";
  /** When true, message input is a separate box (border-top + bg). When false, no border and no bg (default true). */
  composerAsSeparateBox?: boolean;
  /** Message input border width in px. 0 = default 1px; 0.5–6 = custom. Focus = width × 1.5. Default 1. */
  composerBorderWidth?: number;
  /** When width >= 0.5: "default" = gray, "primary" = brand accent border. Default "primary". */
  composerBorderColor?: "default" | "primary";
  /** Send + voice (waveform) control styling. */
  composerControlStyle?: ComposerControlStyle;
  /** Recording level meter bar colors in the composer. */
  speechRecordingWaveStyle?: SpeechRecordingWaveStyle;
  onMenu?: () => void;
  /** Show "Expand chat" in menu dropdown */
  showMenuExpand?: boolean;
  onMenuExpand?: () => void;
  /** When true, menu shows collapse icon/label for expand option */
  isExpanded?: boolean;
  /** Quick links in menu (max 10): { text, route } */
  menuQuickLinks?: Array<{ text: string; route: string; icon?: string }>;
  /** Header button icon for the quick links dropdown (default link-2). */
  quickLinksMenuIcon?: string;
  /** When false, hide quick links control (default true). */
  showMenuQuickLinks?: boolean;
  /** When true, session menu shows Start new / End / Recent */
  showSessionMenu?: boolean;
  /** Hide individual session actions (defaults true when omitted). */
  showSessionStartNew?: boolean;
  showSessionEndChat?: boolean;
  showSessionRecentChats?: boolean;
  onSessionStartNewChat?: () => void;
  onSessionEndChat?: () => void;
  sessionRecentChats?: Array<{ id: string; preview: string; lastActivityAt: string }>;
  onSessionSelectRecentChat?: (conversationId: string) => void;
  /** Disable Start new chat when at cap */
  sessionStartNewDisabled?: boolean;
  /** When true, user can open the recent-chats panel (may differ from showSessionMenu when only history is available). */
  sessionHistoryEnabled?: boolean;
  /** Block typing (e.g. viewing a past thread in single-thread mode). */
  composerReadOnly?: boolean;
  /** Show skeleton while loading conversation messages from the server. */
  conversationLoading?: boolean;
  /** Shown above the composer when composerReadOnly */
  readOnlyNotice?: string;
  /** Shown when composerReadOnly; e.g. return to latest writable thread */
  onBackToWritableChat?: () => void;
  onClose?: () => void;

  // Messages (controlled)
  messages: ChatUIMessage[];
  isSending?: boolean;
  /** Resend a failed user message (same id / content). */
  onRetryMessage?: (messageId: string) => void;
  showMetadata?: boolean;
  /** Display name for assistant (e.g. "Bot Name - AI") */
  senderName?: string;
  /** Show sender/assistant name above messages (default true) */
  showSenderName?: boolean;
  /** Show message time (default true) */
  showTime?: boolean;
  /** Where to show time: "top" (above) or "bottom" (assistant=right, user=left) */
  timePosition?: "top" | "bottom";
  showCopyButton?: boolean;
  showSources?: boolean;
  /** Render assistant messages with simple markdown (**bold**, `code`) */
  allowMarkdown?: boolean;
  emptyState?: React.ReactNode;
  onSourceClick?: (source: ChatUISource) => void;
  showMessageFeedback?: boolean;
  onMessageFeedback?: (messageId: string, rating: "up" | "down") => void;
  /** Typed user messages only. */
  userTextBubbleStyle?: UserBubbleStyle;
  /** Voice user messages only. */
  userVoiceBubbleStyle?: UserBubbleStyle;

  // Composer
  /** Return `false` to abort send and keep the composer as-is (e.g. idle-session confirm in preview). */
  onSend: (
    message: string,
    speechInput?: ChatSpeechInputMeta,
    files?: File[],
    options?: { suggestionId?: string; dictationSessionCount?: number },
  ) => boolean | void | Promise<boolean | void>;
  /** When set, mic/voice run browser capture and POST audio via this hook (embed). */
  postSpeechAudio?: (args: {
    blob: Blob;
    recorderMimeType?: string;
    mode: "dictate" | "voice";
    durationMs: number;
  }) => Promise<{ transcript: string; audioUrl?: string; mimeType?: string; durationMs?: number }>;
  /** After a successful /speech response (for product analytics). */
  onSpeechAnalytics?: (payload: {
    mode: "dictate" | "voice";
    transcriptLength: number;
    hasAudioUrl: boolean;
  }) => void;
  /** Focus target when the chat panel opens (floating embed). */
  composerTextAreaRef?: RefObject<HTMLTextAreaElement | null>;
  composerPlaceholder?: string;
  /** Max characters for input (optional) */
  inputMaxLength?: number;
  /** Max rows for composer textarea (default 8) */
  maxComposerRows?: number;
  showAttach?: boolean;
  showMic?: boolean;
  /** Voice (waveform) control; when omitted, matches `showMic` for legacy configs. */
  showVoice?: boolean;
  onAttach?: () => void;
  /** Optional legacy hook when `postSpeechAudio` is not used. */
  onMic?: () => void;

  // Optional suggested questions (shown when no messages)
  suggestedQuestions?: string[];
  suggestedQuestionChips?: SuggestedQuestionChip[];
  /** When false, suggested chips are hidden even if suggestedQuestions is set (default true) */
  showSuggestedChips?: boolean;
  /** When true, show chat input together with suggested questions on first message. When false, only quick-question chips until user sends (default false). */
  showComposerWithSuggestedQuestions?: boolean;
  hideSuggestionChipText?: boolean;
  onSuggestedQuestion?: (text: string) => void;

  // Footer
  showFooter?: boolean;
  /** Logo + “Powered by Assistrio” above composer before the first visitor message (default true). */
  showAssistrioBrandingPaid?: boolean;
  /** Footer branding text line (e.g. "Powered by …"). */
  brandingMessage?: string;
  /** Optional second line (e.g. privacy notice). Shown below branding when both are set. */
  privacyText?: string;

  // Layout
  /** Tighter padding (default false) */
  compact?: boolean;

  // Strings
  strings?: Partial<{
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    copy: string;
    copied: string;
    sourcesLabel: string;
    scrollToBottomLabel: string;
    privacyText: string;
    back: string;
    close: string;
    menu: string;
    live: string;
    active: string;
    expandLabel: string;
    startNewChat?: string;
    endChat?: string;
    /** ⋮ menu label and list region label (default “View recent chats”). */
    recentChats?: string;
    quickLinks?: string;
    chatActions?: string;
    /** Title in the header when the recent-chats list is open (default “Recent Chats”). */
    chatHistory?: string;
    /** Empty state when there are no past conversations */
    chatHistoryEmpty?: string;
    backToLatestChat?: string;
    chatDialogLabel?: string;
    messageSendFailed?: string;
    retrySend?: string;
    typingStatusLabel?: string;
    feedbackHelpful?: string;
    feedbackNotHelpful?: string;
    /** Shown in the user bubble when a voice message has no transcript (still sends audio). */
    voiceMessageFallback?: string;
    voiceShowTranscript?: string;
    voiceHideTranscript?: string;
    /** Full-screen title for the voice + transcript view. */
    voiceMessageDetailTitle?: string;
    attachmentsTitle?: string;
    uploadAttachments?: string;
    removeAttachment?: string;
    /** Shown when Upload is disabled at the per-message file cap. */
    attachmentUploadLimitReached?: string;
    /** Shown in blue when dictation hits the 2 min cap (default short “Auto-stopped — …” line). */
    speechDictationMaxNotice?: string;
    /** Shown in blue when a voice message hits the 1 min cap. */
    speechVoiceMaxNotice?: string;
    speechTranscriptionFailedNotice?: string;
    speechRecordingTooShortNotice?: string;
    speechDictationListeningLabel?: string;
    speechRecordingVoiceHint?: string;
    speechRecordingDictationHint?: string;
    speechTranscribingVoiceHint?: string;
    speechTranscribingDictationHint?: string;
  }>;

  className?: string;
  style?: React.CSSProperties;
}

export function Chat({
  width = 400,
  height = 700,
  dark = true,
  accentColor = "#6366f1",
  bubbleBorderRadius = 20,
  showChatBorder = true,
  chatPanelBorderColor = "primary",
  chatPanelBorderWidth = 1,
  shadowIntensity = "medium",
  showHeader = true,
  showAvatarInHeader = true,
  onBack,
  showBackButton = false,
  avatar,
  title,
  subtitle,
  statusIndicator,
  showLive = false,
  liveIndicatorStyle,
  statusDotStyle = "blinking",
  showScrollToBottom = true,
  showScrollToBottomLabel = true,
  scrollToBottomLabel,
  showScrollbar = true,
  scrollChromeStyle = "default",
  scrollToBottomChromeStyle,
  scrollToBottomAlign = "center",
  messageListOverflow = "auto",
  composerAsSeparateBox = true,
  composerBorderWidth = 1,
  composerBorderColor = "primary",
  composerControlStyle = "defaultDark",
  speechRecordingWaveStyle = "default",
  onMenu,
  showMenuExpand,
  onMenuExpand,
  isExpanded,
  menuQuickLinks,
  quickLinksMenuIcon,
  showMenuQuickLinks,
  showSessionMenu,
  showSessionStartNew = true,
  showSessionEndChat = true,
  showSessionRecentChats = true,
  onSessionStartNewChat,
  onSessionEndChat,
  sessionRecentChats,
  onSessionSelectRecentChat,
  sessionStartNewDisabled = false,
  sessionHistoryEnabled,
  composerReadOnly = false,
  conversationLoading = false,
  readOnlyNotice,
  onBackToWritableChat,
  onClose,
  messages,
  isSending = false,
  showMetadata = true,
  senderName,
  showSenderName = true,
  showTime = true,
  timePosition = "top",
  showCopyButton = true,
  showSources = true,
  allowMarkdown = false,
  emptyState,
  onSourceClick,
  showMessageFeedback = false,
  onMessageFeedback,
  userTextBubbleStyle = "primary",
  userVoiceBubbleStyle = "primary",
  onSend,
  onRetryMessage,
  composerTextAreaRef,
  composerPlaceholder,
  inputMaxLength,
  maxComposerRows,
  showAttach = true,
  showMic = true,
  showVoice,
  onAttach,
  onMic,
  postSpeechAudio,
  onSpeechAnalytics,
  suggestedQuestions,
  suggestedQuestionChips,
  showSuggestedChips = true,
  showComposerWithSuggestedQuestions = false,
  hideSuggestionChipText = false,
  onSuggestedQuestion,
  showFooter = true,
  showAssistrioBrandingPaid = true,
  brandingMessage,
  privacyText,
  compact = false,
  strings = {},
  className,
  style,
}: ChatProps) {
  const effectiveShowVoice = showVoice ?? showMic;
  const composerInputMaxLength = inputMaxLength ?? CHAT_COMPOSER_INPUT_MAX_LENGTH;
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; file: File }>>([]);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [speechLimitNotice, setSpeechLimitNotice] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [historyViewOpen, setHistoryViewOpen] = useState(false);
  const [attachmentsScreen, setAttachmentsScreen] = useState<
    null | { mode: "composer" } | { mode: "message"; messageId: string } | { mode: "voiceTranscript"; messageId: string }
  >(null);
  const effectiveStatus = statusIndicator ?? (showLive ? "live" : "none");
  const voiceAttachRef = useRef<ChatSpeechInputMeta | null>(null);
  const {
    state: captureState,
    start: startCapture,
    stop: stopCapture,
    cancel: cancelCapture,
    resetStopped: resetCaptureStopped,
    waveformLevels: speechWaveformLevels,
    waveformLive: speechWaveformLive,
  } = useMediaRecorderCapture();
  const [speechMode, setSpeechMode] = useState<null | "dictate" | "voice">(null);
  const [speechBusy, setSpeechBusy] = useState(false);
  /** Prevents a second stop (e.g. max-duration timer + manual stop) from calling `cancelSpeech` when `stop()` returns null. */
  const recordingFlushInFlightRef = useRef(false);
  /** Drives the two-row "voice message preview" UI in the composer (after recording stops, before send). */
  const [pendingVoiceMessagePreview, setPendingVoiceMessagePreview] = useState<ChatSpeechInputMeta | null>(null);
  const voiceMessageBubbleText = strings.voiceMessageFallback?.trim() || "Voice message";
  const noticeDictationMax =
    strings.speechDictationMaxNotice?.trim() ??
    "Auto-stopped — dictation max 2 min.";
  const noticeVoiceMax =
    strings.speechVoiceMaxNotice?.trim() ??
    "Auto-stopped — voice max duration is 1 minute.";
  const voiceRecStartRef = useRef<number | null>(null);
  const [voiceRecTick, setVoiceRecTick] = useState(0);
  /** Set only by max-duration timeout so we can show the blue notice. */
  const autoSpeechLimitRef = useRef<"dictate" | "voice" | null>(null);
  /** Aggregate Whisper dictation sessions for the current draft (reset when composer clears). */
  const whisperDictationRollupRef = useRef<WhisperDictationRollup>(emptyWhisperDictationRollup());

  useEffect(() => {
    if (!input.trim()) whisperDictationRollupRef.current = emptyWhisperDictationRollup();
  }, [input]);

  useEffect(() => {
    if (input.length > composerInputMaxLength) {
      setInput(input.slice(0, composerInputMaxLength));
    }
  }, [input, composerInputMaxLength]);

  const endSpeechUi = useCallback(() => {
    voiceRecStartRef.current = null;
    setSpeechMode(null);
    setSpeechBusy(false);
    resetCaptureStopped();
  }, [resetCaptureStopped]);

  const cancelSpeech = useCallback(() => {
    cancelCapture();
    endSpeechUi();
  }, [cancelCapture, endSpeechUi]);

  const speechCaptureActive =
    Boolean(postSpeechAudio) &&
    !composerReadOnly &&
    speechMode != null &&
    (speechBusy ||
      ((speechMode === "voice" || speechMode === "dictate") && captureState === "recording"));

  const beginSpeech = useCallback(
    async (mode: "dictate" | "voice") => {
      if (!postSpeechAudio || composerReadOnly || conversationLoading || isSending) return;
      voiceAttachRef.current = null;
      setPendingVoiceMessagePreview(null);
      setSpeechLimitNotice(null);
      cancelSpeech();

      const start = await startCapture();
      if (!start.ok) {
        setSpeechMode(null);
        if (start.message) setSpeechLimitNotice(start.message);
        return;
      }
      setSpeechMode(mode);
      voiceRecStartRef.current = Date.now();
      setVoiceRecTick((n) => n + 1);
    },
    [postSpeechAudio, composerReadOnly, conversationLoading, isSending, startCapture, cancelSpeech],
  );

  const flushSpeechRecording = useCallback(async () => {
    if (!postSpeechAudio) return;
    const mode = speechMode;
    if (mode !== "voice" && mode !== "dictate") return;
    if (recordingFlushInFlightRef.current) return;
    recordingFlushInFlightRef.current = true;
    const transcriptionFailed =
      (strings.speechTranscriptionFailedNotice ?? "").trim() ||
      "Could not transcribe this recording. Please try again.";
    const recordingTooShort =
      (strings.speechRecordingTooShortNotice ?? "").trim() || "Recording is too short. Please try again.";
    try {
      const fromAuto = autoSpeechLimitRef.current;
      if (fromAuto) autoSpeechLimitRef.current = null;
      if (fromAuto === "voice") setSpeechLimitNotice(noticeVoiceMax);
      if (fromAuto === "dictate") setSpeechLimitNotice(noticeDictationMax);

      setSpeechBusy(true);
      try {
        const r = await stopRecorderAndTranscribe({
          stopCapture,
          postSpeechAudio,
          mode,
          minBytes: MIN_VOICE_RECORDING_UPLOAD_BYTES,
        });
        onSpeechAnalytics?.({
          mode,
          transcriptLength: r.transcript.length,
          hasAudioUrl: Boolean(r.audioUrl),
        });
        const line = r.transcript.trim();

        if (mode === "dictate") {
          if (!line) {
            setSpeechLimitNotice(transcriptionFailed);
            return;
          }
          const rollup = whisperDictationRollupRef.current;
          rollup.sessionCount += 1;
          rollup.totalRecordDurationMs += r.durationMs;
          rollup.totalAudioSizeBytes += r.audioSizeBytes;
          rollup.lastAudioMime = r.mimeType?.trim() || rollup.lastAudioMime;
          setInput((prev) => {
            const gap = prev && !prev.endsWith(" ") ? " " : "";
            return `${prev}${gap}${line}`;
          });
          const ta = composerTextAreaRef?.current;
          window.requestAnimationFrame(() => ta?.focus());
          return;
        }

        if (line || r.audioUrl) {
          const voiceAttach: ChatSpeechInputMeta = {
            mode: "voice",
            transcript: r.transcript,
            audioUrl: r.audioUrl,
            mimeType: r.mimeType,
            durationMs: r.durationMs,
            ...(typeof r.audioSizeBytes === "number" && Number.isFinite(r.audioSizeBytes) && r.audioSizeBytes > 0
              ? { audioSizeBytes: Math.round(r.audioSizeBytes) }
              : {}),
          };
          voiceAttachRef.current = voiceAttach;
          setPendingVoiceMessagePreview(voiceAttach);
          setInput(line || voiceMessageBubbleText);
        }
      } catch (e) {
        if (e instanceof SpeechRecordingTooShortError) {
          setSpeechLimitNotice(recordingTooShort);
          return;
        }
        if (e instanceof SpeechRecordingEmptyError) {
          return;
        }
        const raw =
          typeof e === "object" &&
          e !== null &&
          "message" in e &&
          typeof (e as { message?: unknown }).message === "string"
            ? String((e as { message: string }).message || "").trim()
            : "";
        const notice = raw && raw !== "Speech request failed" ? raw : transcriptionFailed;
        setSpeechLimitNotice(notice);
      } finally {
        setSpeechBusy(false);
        endSpeechUi();
      }
    } finally {
      recordingFlushInFlightRef.current = false;
    }
  }, [
    postSpeechAudio,
    speechMode,
    stopCapture,
    endSpeechUi,
    onSpeechAnalytics,
    voiceMessageBubbleText,
    noticeVoiceMax,
    noticeDictationMax,
    composerTextAreaRef,
    strings.speechTranscriptionFailedNotice,
    strings.speechRecordingTooShortNotice,
  ]);

  /** Max recording length: dictate 2 min, voice note 1 min (then we stop and run the same path as the Stop control). */
  const SPEECH_MAX_RECORD_MS: Record<"dictate" | "voice", number> = {
    dictate: 2 * 60 * 1_000,
    voice: 60 * 1_000,
  };
  useEffect(() => {
    if (!postSpeechAudio) return;
    if (speechMode !== "dictate" && speechMode !== "voice") return;
    if (captureState !== "recording") return;
    const ms = SPEECH_MAX_RECORD_MS[speechMode];
    const t = window.setTimeout(() => {
      autoSpeechLimitRef.current = speechMode;
      void flushSpeechRecording();
    }, ms);
    return () => window.clearTimeout(t);
  }, [speechMode, captureState, postSpeechAudio, flushSpeechRecording]);

  useEffect(() => {
    if (captureState !== "recording") return;
    if (speechMode !== "voice" && speechMode !== "dictate") return;
    const id = setInterval(() => setVoiceRecTick((x) => x + 1), 500);
    return () => clearInterval(id);
  }, [captureState, speechMode]);

  const speechRecordingElapsedMs = useMemo(() => {
    if (voiceRecStartRef.current == null || captureState !== "recording" || (speechMode !== "voice" && speechMode !== "dictate")) {
      return 0;
    }
    return Date.now() - voiceRecStartRef.current;
  }, [captureState, speechMode, voiceRecTick]);

  const discardVoiceMessagePreview = useCallback(() => {
    voiceAttachRef.current = null;
    setPendingVoiceMessagePreview(null);
    setInput("");
  }, []);

  const handleSend = useCallback(async () => {
    if (composerReadOnly || conversationLoading || isSending) return;
    if (speechCaptureActive) return;
    const text = input.trim();
    const attach = voiceAttachRef.current;
    const files = pendingFiles.map((p) => p.file);
    const hasVoice = attach?.mode === "voice" && Boolean(attach.audioUrl?.trim());
    if (!text && files.length === 0 && !hasVoice) return;
    const displayText = text || (hasVoice ? voiceMessageBubbleText : "");
    const rollupSnapshot = whisperDictationRollupRef.current;
    const hasWhisperDictation = rollupSnapshot.sessionCount > 0;
    const dictateInput: ChatSpeechInputMeta | undefined =
      !hasVoice && hasWhisperDictation && displayText.trim().length > 0
        ? {
            mode: "dictate",
            transcript: displayText.trim(),
            dictationProvider: "whisper",
            dictationDurationMs: rollupSnapshot.totalRecordDurationMs,
            durationMs: rollupSnapshot.totalRecordDurationMs,
            ...(rollupSnapshot.totalAudioSizeBytes > 0
              ? { audioSizeBytes: Math.round(rollupSnapshot.totalAudioSizeBytes) }
              : {}),
            ...(rollupSnapshot.lastAudioMime?.trim() ? { mimeType: rollupSnapshot.lastAudioMime.trim() } : {}),
          }
        : undefined;
    let sendResult: unknown;
    if (attach?.mode === "voice" && hasVoice) {
      sendResult = onSend(displayText, attach, files.length ? files : undefined, undefined);
    } else if (dictateInput) {
      sendResult = onSend(displayText, dictateInput, files.length ? files : undefined, {
        dictationSessionCount: rollupSnapshot.sessionCount,
      });
    } else {
      sendResult = onSend(displayText, undefined, files.length ? files : undefined, undefined);
    }
    if ((await Promise.resolve(sendResult)) === false) {
      return;
    }
    voiceAttachRef.current = null;
    setPendingVoiceMessagePreview(null);
    setPendingFiles([]);
    setAttachNotice(null);
    whisperDictationRollupRef.current = emptyWhisperDictationRollup();
    setInput("");
  }, [
    input,
    pendingFiles,
    onSend,
    composerReadOnly,
    conversationLoading,
    isSending,
    voiceMessageBubbleText,
    speechCaptureActive,
  ]);

  const handleComposerAttach = useCallback(() => {
    onAttach?.();
    setHistoryViewOpen(false);
    if (showAttach) attachInputRef.current?.click();
  }, [onAttach, showAttach]);

  const openComposerAttachmentsScreen = useCallback(() => {
    setHistoryViewOpen(false);
    setAttachmentsScreen({ mode: "composer" });
  }, []);

  const handleSuggested = useCallback(
    async (text: string, meta?: { suggestionId?: string }) => {
      if (composerReadOnly || conversationLoading || isSending) return;
      onSuggestedQuestion?.(text);
      whisperDictationRollupRef.current = emptyWhisperDictationRollup();
      setInput(text);
      const r = await Promise.resolve(
        onSend(
          text,
          undefined,
          undefined,
          meta?.suggestionId ? { suggestionId: meta.suggestionId } : undefined,
        ),
      );
      if (r === false) return;
      setInput("");
    },
    [onSuggestedQuestion, onSend, composerReadOnly, conversationLoading, isSending]
  );

  const s = {
    title: "Chat",
    subtitle: "",
    placeholder: "Type a message…",
    send: "Send",
    copy: "Copy",
    copied: "Copied!",
    sourcesLabel: "Sources",
    scrollToBottomLabel: "Scroll to latest",
    privacyText: "Your conversations are private and secure.",
    back: "Back",
    close: "Close",
    menu: "Menu",
    live: "Live",
    active: "Active",
    expandLabel: "Expand chat",
    startNewChat: "Start a new chat",
    endChat: "End chat",
    recentChats: "View recent chats",
    quickLinks: "Quick links",
    chatActions: "Chat actions",
    chatHistory: "Recent Chats",
    chatHistoryEmpty: "No conversations yet.",
    backToLatestChat: "Back to current chat",
    chatDialogLabel: "Chat",
    messageSendFailed: "Couldn’t send",
    retrySend: "Retry",
    typingStatusLabel: "Assistant is typing",
    feedbackHelpful: "Helpful",
    feedbackNotHelpful: "Not helpful",
    voiceMessageFallback: "Voice message",
    voiceShowTranscript: "Show transcript",
    voiceHideTranscript: "Hide transcript",
    voiceMessageDetailTitle: "Voice message",
    attachmentsTitle: "Attachments",
    uploadAttachments: "Upload",
    removeAttachment: "Remove",
    attachmentUploadLimitReached: `Maximum ${WIDGET_CHAT_ATTACHMENT_MAX_FILES} files per message`,
    speechDictationMaxNotice: "Auto-stopped — dictation max 2 min.",
    speechVoiceMaxNotice: "Auto-stopped — voice max duration is 1 minute.",
    speechTranscriptionFailedNotice: "Could not transcribe this recording. Please try again.",
    speechRecordingTooShortNotice: "Recording is too short. Please try again.",
    speechDictationListeningLabel: "Dictating…",
    speechRecordingVoiceHint: "Recording voice message…",
    speechRecordingDictationHint: "Dictating…",
    speechTranscribingVoiceHint: "Processing...",
    speechTranscribingDictationHint: "Transcribing...",
    ...strings,
  };

  useEffect(() => {
    if (attachmentsScreen?.mode === "composer" && pendingFiles.length === 0) {
      setAttachmentsScreen(null);
    }
  }, [attachmentsScreen?.mode, pendingFiles.length]);

  useEffect(() => {
    if (attachmentsScreen?.mode !== "message") return;
    const m = messages.find((x) => x.id === attachmentsScreen.messageId);
    if (!m?.attachments?.length) setAttachmentsScreen(null);
  }, [attachmentsScreen, messages]);

  useEffect(() => {
    if (attachmentsScreen?.mode !== "voiceTranscript") return;
    const m = messages.find((x) => x.id === attachmentsScreen.messageId);
    if (!m || m.speechInput?.mode !== "voice") setAttachmentsScreen(null);
  }, [attachmentsScreen, messages]);

  const openMessageAttachments = useCallback((messageId: string) => {
    setHistoryViewOpen(false);
    setAttachmentsScreen({ mode: "message", messageId });
  }, []);

  const openVoiceMessageDetail = useCallback((messageId: string) => {
    setHistoryViewOpen(false);
    setAttachmentsScreen({ mode: "voiceTranscript", messageId });
  }, []);

  const historyEnabled = sessionHistoryEnabled ?? showSessionMenu;
  const hasUserMessage = messages.some((m) => m.role === "user");
  const showBrandingLine = showFooter && Boolean((brandingMessage ?? "").trim());
  const showBrandingPaidAboveComposer =
    showAssistrioBrandingPaid !== false && !hasUserMessage;
  const showFooterBrandingText = showBrandingLine;
  const showFooterContent = showFooterBrandingText || Boolean((privacyText ?? "").trim());
  const showAttachmentsChrome = attachmentsScreen != null;
  const hasSuggestionChips =
    (suggestedQuestions && suggestedQuestions.length > 0) ||
    (suggestedQuestionChips && suggestedQuestionChips.length > 0);
  const showOnlyQuickQuestions =
    !conversationLoading &&
    !historyViewOpen &&
    !hasUserMessage &&
    showSuggestedChips &&
    hasSuggestionChips &&
    !showComposerWithSuggestedQuestions;

  const handleSelectHistoryChat = useCallback(
    (id: string) => {
      onSessionSelectRecentChat?.(id);
      setHistoryViewOpen(false);
    },
    [onSessionSelectRecentChat],
  );

  const handleHistoryStartNew = useCallback(() => {
    onSessionStartNewChat?.();
    setHistoryViewOpen(false);
  }, [onSessionStartNewChat]);

  const showHistoryChrome = Boolean(historyEnabled && historyViewOpen);

  const attachmentsPanel =
    attachmentsScreen?.mode === "composer" ? (
      <ChatAttachmentsScreen
        mode="composer"
        dark={dark}
        accentColor={accentColor}
        title={s.attachmentsTitle}
        backLabel={s.back}
        uploadLabel={s.uploadAttachments}
        removeLabel={s.removeAttachment}
        composerItems={pendingFiles}
        onBack={() => setAttachmentsScreen(null)}
        onRemove={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
        onUploadMore={() => {
          if (pendingFiles.length >= WIDGET_CHAT_ATTACHMENT_MAX_FILES) return;
          attachInputRef.current?.click();
        }}
        uploadDisabled={pendingFiles.length >= WIDGET_CHAT_ATTACHMENT_MAX_FILES}
        uploadDisabledTitle={s.attachmentUploadLimitReached}
      />
    ) : attachmentsScreen?.mode === "message" ? (
      (() => {
        const m = messages.find((x) => x.id === attachmentsScreen.messageId);
        if (!m?.attachments?.length) return null;
        return (
          <ChatAttachmentsScreen
            mode="message"
            dark={dark}
            accentColor={accentColor}
            title={s.attachmentsTitle}
            backLabel={s.back}
            messageAttachments={m.attachments}
            onBack={() => setAttachmentsScreen(null)}
          />
        );
      })()
    ) : attachmentsScreen?.mode === "voiceTranscript" ? (
      (() => {
        const m = messages.find((x) => x.id === attachmentsScreen.messageId);
        if (!m?.speechInput || m.speechInput.mode !== "voice") return null;
        return (
          <ChatVoiceMessageDetailScreen
            dark={dark}
            accentColor={accentColor}
            userVoiceBubbleStyle={userVoiceBubbleStyle}
            bubbleBorderRadius={bubbleBorderRadius}
            messageId={m.id}
            title={s.voiceMessageDetailTitle}
            backLabel={s.back}
            speech={m.speechInput}
            onBack={() => setAttachmentsScreen(null)}
          />
        );
      })()
    ) : null;

  return (
    <div
      className={cx(
        "assistrio-chat-widget flex flex-col overflow-hidden rounded-2xl",
        chatShadowIntensityClass(shadowIntensity),
        dark
          ? "dark bg-gray-900 text-gray-200"
          : "bg-white text-gray-800",
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...chatPanelOutlineStyle(showChatBorder, chatPanelBorderWidth, chatPanelBorderColor, accentColor, Boolean(dark)),
        ...style,
      }}
      role="region"
      aria-label={s.chatDialogLabel}
    >
      {showHeader && !showHistoryChrome && !showAttachmentsChrome ? (
        <ChatHeader
          dark={dark}
          showAvatar={showAvatarInHeader}
          onBack={onBack}
          showBackButton={showBackButton}
          avatar={avatar}
          title={title ?? s.title}
          subtitle={subtitle ?? s.subtitle}
          conversationLoading={conversationLoading}
          statusIndicator={effectiveStatus}
          liveIndicatorStyle={liveIndicatorStyle}
          statusDotStyle={statusDotStyle}
          onMenu={onMenu}
          showMenuExpand={showMenuExpand}
          onMenuExpand={onMenuExpand}
          expandLabel={s.expandLabel}
          isExpanded={isExpanded}
          menuQuickLinks={menuQuickLinks}
          quickLinksMenuIcon={quickLinksMenuIcon}
          showMenuQuickLinks={showMenuQuickLinks}
          showSessionMenu={showSessionMenu}
          showSessionStartNew={showSessionStartNew}
          showSessionEndChat={showSessionEndChat}
          showSessionRecentChats={showSessionRecentChats}
          onSessionStartNewChat={onSessionStartNewChat}
          onSessionEndChat={onSessionEndChat}
          sessionEndChatDisabled={!hasUserMessage}
          sessionStartNewDisabled={sessionStartNewDisabled}
          onSessionOpenHistory={() => {
            setAttachmentsScreen(null);
            setHistoryViewOpen(true);
          }}
          onClose={onClose}
          backLabel={s.back}
          closeLabel={s.close}
          menuLabel={s.menu}
          quickLinksMenuLabel={s.quickLinks}
          sessionMenuLabel={s.chatActions}
          startNewChatLabel={s.startNewChat}
          endChatLabel={s.endChat}
          recentChatsLabel={s.recentChats}
          liveLabel={s.live}
          activeLabel={s.active ?? "Active"}
        />
      ) : null}
      {showAttachmentsChrome ? (
        <div className="assistrio-chrome-panel-enter flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {attachmentsPanel}
        </div>
      ) : showHistoryChrome && historyEnabled ? (
        <div className="assistrio-chrome-panel-enter flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showHeader ? (
            <header
              className={cx(
                "relative flex-shrink-0 border-b px-4 py-3",
                dark ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50",
              )}
              aria-label={s.chatHistory}
            >
              <button
                type="button"
                onClick={() => setHistoryViewOpen(false)}
                className={cx(
                  "absolute left-2 top-1/2 z-10 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-lg transition-colors",
                  dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
                )}
                aria-label={s.back}
                title={s.back}
              >
                <HistoryBackIcon />
              </button>
              <div className="mx-auto flex min-w-0 max-w-full flex-col items-center gap-0.5 px-10 text-center">
                <div className="flex min-w-0 max-w-full items-center justify-center gap-2.5">
                  <div
                    className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full shadow-sm"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden
                  >
                    <History className="h-[18px] w-[18px] text-white" strokeWidth={2} />
                  </div>
                  <h2
                    className={cx(
                      "min-w-0 max-w-full truncate text-sm font-medium tracking-tight",
                      dark ? "text-gray-200" : "text-gray-800",
                    )}
                  >
                    {s.chatHistory}
                  </h2>
                </div>
              </div>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={cx(
                    "absolute right-2 top-1/2 z-10 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-lg transition-colors",
                    dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
                  )}
                  aria-label={s.close}
                  title={s.close}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <span className="pointer-events-none absolute right-2 top-1/2 h-[30px] w-[30px] -translate-y-1/2" aria-hidden />
              )}
            </header>
          ) : null}
          <div
            className={cx(
            "flex min-h-0 flex-1 flex-col px-3 py-2",
            messageListOverflow === "hidden" ? "overflow-y-hidden" : "overflow-y-auto",
            dark ? "bg-gray-900" : "bg-white",
            showScrollbar || messageListOverflow === "hidden" ? "" : "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
          role={!sessionRecentChats || sessionRecentChats.length === 0 ? undefined : "list"}
          aria-label={s.recentChats}
        >
          {!sessionRecentChats || sessionRecentChats.length === 0 ? (
            <div
              className={cx(
                "flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center",
              )}
            >
              <p
                className={cx(
                  "max-w-[18rem] text-sm leading-relaxed",
                  dark ? "text-gray-400" : "text-gray-500",
                )}
              >
                {s.chatHistoryEmpty}
              </p>
              <button
                type="button"
                disabled={sessionStartNewDisabled}
                onClick={() => {
                  if (sessionStartNewDisabled) return;
                  handleHistoryStartNew();
                }}
                className={cx(
                  "rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  dark ? "focus-visible:ring-offset-gray-900" : "focus-visible:ring-offset-white",
                  sessionStartNewDisabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:opacity-90",
                )}
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 1px 2px ${accentColor}44`,
                }}
              >
                {s.startNewChat}
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {sessionRecentChats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectHistoryChat(c.id)}
                    className={cx(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      dark
                        ? "border-gray-600/80 bg-gray-800/40 hover:bg-gray-800"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    )}
                  >
                    <span
                      className={cx(
                        "block text-sm font-normal line-clamp-2",
                        dark ? "text-gray-200" : "text-gray-800",
                      )}
                    >
                      {c.preview || "Chat"}
                    </span>
                    <span
                      className={cx(
                        "mt-1 block text-xs",
                        dark ? "text-gray-400" : "text-gray-500",
                      )}
                    >
                      {formatRecentWhen(c.lastActivityAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      ) : (
        <>
          <ChatMessages
            dark={dark}
            messages={messages}
            isSending={isSending}
            conversationLoading={conversationLoading}
            accentColor={accentColor}
            showMetadata={showMetadata}
            senderName={senderName}
            showSenderName={showSenderName}
            showTime={showTime}
            timePosition={timePosition}
            showCopyButton={showCopyButton}
            showSources={showSources}
            bubbleBorderRadius={bubbleBorderRadius}
            allowMarkdown={allowMarkdown}
            copyLabel={s.copy}
            copiedLabel={s.copied}
            sourcesLabel={s.sourcesLabel}
            scrollToBottomLabel={scrollToBottomLabel ?? s.scrollToBottomLabel}
            showScrollToBottomLabel={showScrollToBottomLabel}
            showScrollToBottom={showScrollToBottom}
            showScrollbar={showScrollbar}
            scrollChromeStyle={scrollChromeStyle}
            scrollToBottomChromeStyle={scrollToBottomChromeStyle}
            scrollToBottomAlign={scrollToBottomAlign}
            messageListOverflow={messageListOverflow}
            emptyState={emptyState}
            onSourceClick={onSourceClick}
            suggestedQuestions={
              showSuggestedChips && suggestedQuestions && suggestedQuestions.length > 0 ? suggestedQuestions : undefined
            }
            suggestedQuestionChips={
              showSuggestedChips && suggestedQuestionChips && suggestedQuestionChips.length > 0
                ? suggestedQuestionChips
                : undefined
            }
            onSuggestedQuestionClick={handleSuggested}
            hideSuggestionChipText={hideSuggestionChipText}
            compact={compact}
            typingStatusLabel={s.typingStatusLabel}
            messageSendFailedLabel={s.messageSendFailed}
            retrySendLabel={s.retrySend}
            onRetryMessage={onRetryMessage}
            showMessageFeedback={showMessageFeedback}
            onMessageFeedback={onMessageFeedback}
            userTextBubbleStyle={userTextBubbleStyle}
            userVoiceBubbleStyle={userVoiceBubbleStyle}
            feedbackHelpfulLabel={s.feedbackHelpful}
            feedbackNotHelpfulLabel={s.feedbackNotHelpful}
            voiceShowTranscriptLabel={s.voiceShowTranscript}
            voiceHideTranscriptLabel={s.voiceHideTranscript}
            onOpenVoiceMessageDetail={openVoiceMessageDetail}
            onOpenMessageAttachments={openMessageAttachments}
          />
          {!showOnlyQuickQuestions ? (
            <>
              {composerReadOnly && (readOnlyNotice || onBackToWritableChat) ? (
                <div
                  className={cx(
                    "flex-shrink-0 border-t px-3 py-2 flex flex-col gap-2",
                    dark ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-amber-50/90",
                  )}
                  role="status"
                >
                  {readOnlyNotice ? (
                    <p
                      className={cx(
                        "text-xs leading-snug",
                        dark ? "text-gray-300" : "text-gray-700",
                      )}
                    >
                      {readOnlyNotice}
                    </p>
                  ) : null}
                  {onBackToWritableChat ? (
                    <button
                      type="button"
                      onClick={onBackToWritableChat}
                      className={cx(
                        "self-start rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity",
                        dark ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-white text-gray-800 shadow-sm hover:bg-gray-50 border border-gray-200",
                      )}
                    >
                      {s.backToLatestChat}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {attachNotice && showAttach ? (
                <div
                  role="alert"
                  className={cx(
                    "flex flex-shrink-0 items-center gap-3 border-t px-3 py-2 text-xs leading-snug",
                    dark ? "border-amber-900/40 bg-amber-950/35 text-amber-100/95" : "border-amber-200 bg-amber-50 text-amber-900",
                  )}
                >
                  <span className="min-w-0 flex-1">{attachNotice}</span>
                  <button
                    type="button"
                    onClick={() => setAttachNotice(null)}
                    className={cx(
                      "shrink-0 rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2",
                      dark
                        ? "text-amber-200/90 hover:bg-amber-900/50 focus-visible:ring-amber-500/50"
                        : "text-amber-900/80 hover:bg-amber-200/50 focus-visible:ring-amber-600/50",
                    )}
                    aria-label={s.close}
                    title={s.close}
                  >
                    <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              ) : null}
              <input
                ref={attachInputRef}
                type="file"
                multiple
                className="hidden"
                accept={WIDGET_CHAT_ACCEPT}
                aria-hidden
                onChange={(e) => {
                  const list = e.target.files;
                  if (!list?.length) return;
                  setHistoryViewOpen(false);
                  const genId = () => `pf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                  const { added, errors } = pickWidgetChatFiles(list, pendingFiles.length, genId);
                  if (errors.length) setAttachNotice([...new Set(errors)].join(" "));
                  else setAttachNotice(null);
                  if (added.length) setPendingFiles((prev) => [...prev, ...added]);
                  e.target.value = "";
                }}
              />
              {showBrandingPaidAboveComposer ? (
                <AssistrioBrandingPaid dark={dark} compact={compact} />
              ) : null}
              {postSpeechAudio && speechLimitNotice ? (
                <div
                  role="status"
                  className={cx(
                    "flex flex-shrink-0 items-center gap-3 border-t px-3 py-2 text-xs leading-snug",
                    dark ? "border-blue-900/50 bg-blue-950/40 text-blue-200" : "border-blue-200/90 bg-blue-50 text-blue-800",
                  )}
                >
                  <span className="min-w-0 flex-1">{speechLimitNotice}</span>
                  <button
                    type="button"
                    onClick={() => setSpeechLimitNotice(null)}
                    className={cx(
                      "shrink-0 rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2",
                      dark
                        ? "text-blue-200/90 hover:bg-blue-900/50 focus-visible:ring-blue-500/50"
                        : "text-blue-800/80 hover:bg-blue-200/50 focus-visible:ring-blue-600/50",
                    )}
                    aria-label={s.close}
                    title={s.close}
                  >
                    <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              ) : null}
              <ChatComposer
              dark={dark}
              value={input}
              onChange={setInput}
              onSend={handleSend}
              inputDisabled={composerReadOnly}
              sendDisabled={isSending || composerReadOnly || conversationLoading}
              placeholder={composerPlaceholder ?? s.placeholder}
              sendLabel={s.send}
              accentColor={accentColor}
              inputMaxLength={composerInputMaxLength}
              maxComposerRows={maxComposerRows}
              showAttach={showAttach}
              showMic={showMic}
              showVoice={effectiveShowVoice}
              asSeparateBox={composerAsSeparateBox}
              composerBorderWidth={composerBorderWidth}
              composerBorderColor={composerBorderColor}
              composerControlStyle={composerControlStyle}
              speechRecordingWaveStyle={speechRecordingWaveStyle}
              pendingAttachments={pendingFiles.map(({ id, file }) => ({ id, label: file.name }))}
              onRemovePendingAttachment={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
              showPendingAttachmentChips={false}
              onAttach={handleComposerAttach}
              onOpenPendingAttachments={openComposerAttachmentsScreen}
              onMic={onMic}
              onBeginSpeech={postSpeechAudio ? beginSpeech : undefined}
              speechCaptureActive={speechCaptureActive}
              speechCaptureMode={speechMode}
              speechCaptureProcessing={speechBusy}
              speechWaveformLevels={
                (speechMode === "voice" || speechMode === "dictate") &&
                speechWaveformLive &&
                !speechBusy &&
                captureState === "recording"
                  ? speechWaveformLevels
                  : undefined
              }
              speechDictationListeningLabel={s.speechDictationListeningLabel}
              speechRecordingVoiceLabel={s.speechRecordingVoiceHint}
              speechRecordingDictationLabel={s.speechRecordingDictationHint}
              speechTranscribingVoiceLabel={s.speechTranscribingVoiceHint}
              speechTranscribingDictationLabel={s.speechTranscribingDictationHint}
              onSpeechCaptureCancel={postSpeechAudio ? cancelSpeech : undefined}
              onSpeechCaptureStop={postSpeechAudio ? () => void flushSpeechRecording() : undefined}
              onSpeechCaptureSend={postSpeechAudio ? () => void flushSpeechRecording() : undefined}
              voiceMessagePreview={pendingVoiceMessagePreview}
              onVoiceMessagePreviewDiscard={discardVoiceMessagePreview}
              speechRecordingElapsedMs={speechRecordingElapsedMs}
              textAreaRef={composerTextAreaRef}
              className={compact ? "p-2" : undefined}
            />
            </>
          ) : null}
        </>
      )}
      {showFooter &&
      !showHistoryChrome &&
      !showAttachmentsChrome &&
      showFooterContent ? (
        <footer
          className={cx(
            "flex-shrink-0 text-center border-t",
            dark ? "border-gray-700" : "border-gray-200",
            compact ? "px-2 py-1.5" : "px-3 py-1.5"
          )}
        >
          {showFooterBrandingText ? (
            <WidgetBranding message={brandingMessage ?? ""} dark={dark} />
          ) : null}
          {(privacyText ?? "").trim() ? (
            <p
              className={cx(
                "text-[10px] font-normal leading-snug",
                showFooterBrandingText ? "mt-1" : "",
                dark ? "text-gray-500" : "text-gray-400",
              )}
            >
              {(privacyText ?? "").trim()}
            </p>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
