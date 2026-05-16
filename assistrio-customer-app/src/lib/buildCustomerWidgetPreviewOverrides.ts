import type { CustomerBotDetail } from '@/api/types';
import type { SuggestedQuestionChip, WidgetPreviewOverrides } from '@assistrio/chat-widget';

const EXAMPLE_CAP = 6;

function parsePreviewSuggestionChip(q: unknown): SuggestedQuestionChip | null {
  if (typeof q === 'string') {
    const label = q.trim();
    return label ? { label } : null;
  }
  if (q && typeof q === 'object') {
    const o = q as Record<string, unknown>;
    const labelRaw = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
    const label = String(labelRaw).trim();
    if (!label) return null;
    const hideLegacy = o.hideSuggestionChipText === true;
    if (o.hideChipTextInChat === true || hideLegacy) {
      return { label, hideChipTextInChat: true };
    }
    return { label };
  }
  return null;
}

/** Extended shape accepted by `/api/widget/preview/*` merge (see backend `parsePreviewOverrides`). */
export type CustomerPreviewOverrides = WidgetPreviewOverrides & {
  personality?: Record<string, unknown>;
  config?: Record<string, unknown>;
  leadCapture?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Phase-2 baseline: saved bot only. Expand with draft slices from workspace contexts.
 */
export function buildCustomerWidgetPreviewOverridesFromBot(bot: CustomerBotDetail): CustomerPreviewOverrides {
  const chipRows: SuggestedQuestionChip[] = [];
  if (Array.isArray(bot.exampleQuestions)) {
    for (const q of bot.exampleQuestions) {
      if (chipRows.length >= EXAMPLE_CAP) break;
      const chip = parsePreviewSuggestionChip(q);
      if (chip) chipRows.push(chip);
    }
  }
  const suggestedQuestions = chipRows.length > 0 ? chipRows.map((c) => c.label) : undefined;
  const suggestedQuestionChips = chipRows.length > 0 ? chipRows : undefined;

  const wm = typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage.trim() : '';
  const welcomeOn = bot.welcomeMessageEnabled !== false && Boolean(wm);
  const personality = isRecord(bot.personality) ? { ...bot.personality } : undefined;
  const config = isRecord(bot.config) ? { ...bot.config } : undefined;

  return {
    botName: typeof bot.name === 'string' && bot.name.trim() ? bot.name.trim() : undefined,
    avatarUrl: typeof bot.imageUrl === 'string' && bot.imageUrl.trim() ? bot.imageUrl.trim() : undefined,
    avatarEmoji: typeof bot.avatarEmoji === 'string' && bot.avatarEmoji.trim() ? bot.avatarEmoji.trim() : undefined,
    tagline:
      typeof bot.shortDescription === 'string' && bot.shortDescription.trim()
        ? bot.shortDescription.trim()
        : undefined,
    description: typeof bot.description === 'string' && bot.description.trim() ? bot.description.trim() : undefined,
    welcomeMessage: welcomeOn ? wm || undefined : undefined,
    welcomeMessageEnabled: bot.welcomeMessageEnabled !== false,
    suggestedQuestions,
    suggestedQuestionChips,
    chatUI: isRecord(bot.chatUI) ? (bot.chatUI as CustomerPreviewOverrides['chatUI']) : undefined,
    leadCapture: bot.leadCapture,
    personality,
    config,
    ...(typeof bot.visitorMultiChatEnabled === 'boolean'
      ? { visitorMultiChatEnabled: bot.visitorMultiChatEnabled }
      : {}),
    ...(bot.visitorMultiChatMax !== undefined
      ? { visitorMultiChatMax: bot.visitorMultiChatMax as number | null }
      : {}),
  };
}

function shallowMergePersonality(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base && !patch) return undefined;
  return { ...(base ?? {}), ...(patch ?? {}) };
}

/** Merge behavior-tab draft onto baseline (highest-value live fields). */
/** Live behavior-tab fields merged onto `buildCustomerWidgetPreviewOverridesFromBot`. */
export type BehaviorPreviewDraftSlice = {
  welcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
  suggestedQuestions: string[];
  personalityPatch: Record<string, unknown>;
};

/**
 * Shallow-merge local Widget Appearance `chatUi` editor state over baseline preview `chatUI`
 * so the embed sees live appearance edits without save/re-init.
 */
/** Same deep plain-object merge as `mergePreviewInitResponse` uses for `chatUI` (nested keys). */
function mergePlainRecordsLocal(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    const prev = out[key];
    if (isRecord(prev) && isRecord(val)) {
      out[key] = mergePlainRecordsLocal(prev, val);
      continue;
    }
    out[key] = val;
  }
  return out;
}

export function mergeAppearanceChatUiIntoPreviewOverrides(
  baseline: CustomerPreviewOverrides,
  chatUiDraft: Record<string, unknown> | null,
): CustomerPreviewOverrides {
  if (!chatUiDraft || Object.keys(chatUiDraft).length === 0) return baseline;
  const prev = isRecord(baseline.chatUI) ? baseline.chatUI : {};
  return {
    ...baseline,
    chatUI: mergePlainRecordsLocal(prev, chatUiDraft) as CustomerPreviewOverrides['chatUI'],
  };
}

/** Live “Chats” tab (visitor multi-conversation) while Chat Experience is mounted. */
export type ChatsPreviewDraftSlice = {
  visitorMultiChatEnabled: boolean;
  visitorMultiChatMax: number | null;
};

export function mergeChatsDraftIntoPreviewOverrides(
  baseline: CustomerPreviewOverrides,
  draft: ChatsPreviewDraftSlice | null,
): CustomerPreviewOverrides {
  if (!draft) return baseline;
  return {
    ...baseline,
    visitorMultiChatEnabled: draft.visitorMultiChatEnabled,
    visitorMultiChatMax: draft.visitorMultiChatEnabled ? draft.visitorMultiChatMax : null,
  };
}

/** Live Profile editor fields (debounced into preview; cleared on section unmount). */
export type ProfilePreviewDraftSlice = {
  botName: string;
  tagline: string;
  description: string;
  avatarUrl: string;
  avatarEmoji: string;
};

export function mergeProfileDraftIntoPreviewOverrides(
  baseline: CustomerPreviewOverrides,
  draft: ProfilePreviewDraftSlice | null,
): CustomerPreviewOverrides {
  if (!draft) return baseline;
  return {
    ...baseline,
    botName: draft.botName,
    tagline: draft.tagline,
    description: draft.description,
    avatarUrl: draft.avatarUrl,
    avatarEmoji: draft.avatarEmoji,
  };
}

export function mergeBehaviorDraftIntoPreviewOverrides(
  baseline: CustomerPreviewOverrides,
  draft: BehaviorPreviewDraftSlice | null,
): CustomerPreviewOverrides {
  if (!draft) return baseline;
  const sq = draft.suggestedQuestions
    .map((q) => String(q).trim())
    .filter(Boolean)
    .slice(0, EXAMPLE_CAP);
  const baseChips = baseline.suggestedQuestionChips ?? [];
  const nextChips: SuggestedQuestionChip[] = sq.map((label) => {
    const bc = baseChips.find((c) => c.label.trim() === label.trim());
    return bc?.hideChipTextInChat === true ? { label, hideChipTextInChat: true } : { label };
  });
  const out: CustomerPreviewOverrides = {
    ...baseline,
    welcomeMessage: draft.welcomeMessage?.trim() ? draft.welcomeMessage.trim() : undefined,
    suggestedQuestions: sq.length ? sq : undefined,
    suggestedQuestionChips: sq.length ? nextChips : undefined,
    personality: shallowMergePersonality(baseline.personality, draft.personalityPatch),
  };
  if (typeof draft.welcomeMessageEnabled === 'boolean') {
    out.welcomeMessageEnabled = draft.welcomeMessageEnabled;
  }
  return out;
}

/** Live lead-capture form state while Capture Leads is mounted (see preview chat payload merge on backend). */
export type LeadCapturePreviewDraft = {
  enabled: boolean;
  fields: { key: string; label: string; type: string; required: boolean; disabled?: boolean; aliases?: string[] }[];
  askStrategy: 'soft' | 'balanced' | 'direct';
  captureMode: 'chat' | 'form' | 'hybrid';
  politeMode: boolean;
};

export function mergeLeadCaptureDraftIntoPreviewOverrides(
  baseline: CustomerPreviewOverrides,
  draft: LeadCapturePreviewDraft | null,
): CustomerPreviewOverrides {
  if (draft == null) return baseline;
  return { ...baseline, leadCapture: draft };
}

/** Matches unsaved `personality` + `config` + optional composer toggles from the AI & Advanced section. */
export type AiIntegrationsPreviewDraftSlice = {
  personality: Record<string, unknown>;
  config: Record<string, unknown>;
  /** Live composer toggles from AI & Advanced while that section is mounted. */
  chatUiAdvanced?: { allowFileUpload: boolean; showMic: boolean; showVoice: boolean };
};

export function mergeAiIntegrationsDraftIntoPreviewOverrides(
  baseline: CustomerPreviewOverrides,
  draft: AiIntegrationsPreviewDraftSlice | null,
): CustomerPreviewOverrides {
  if (!draft) return baseline;
  const out: CustomerPreviewOverrides = {
    ...baseline,
    personality: mergePlainRecordsLocal(
      isRecord(baseline.personality) ? baseline.personality : {},
      draft.personality,
    ),
    config: mergePlainRecordsLocal(
      isRecord(baseline.config) ? baseline.config : {},
      draft.config,
    ),
  };
  if (draft.chatUiAdvanced) {
    const prev = isRecord(baseline.chatUI) ? baseline.chatUI : {};
    out.chatUI = mergePlainRecordsLocal(prev, draft.chatUiAdvanced as Record<string, unknown>) as CustomerPreviewOverrides['chatUI'];
  }
  return out;
}
