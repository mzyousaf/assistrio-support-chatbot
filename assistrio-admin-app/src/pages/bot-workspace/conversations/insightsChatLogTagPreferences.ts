/**
 * Per-bot local preferences for which chips appear on Insights → Chat logs rows.
 * Stored in {@link localStorage} (browser only).
 */

export type ChatLogTagPreferenceKey =
  | 'lead'
  | 'primaryTopic'
  | 'allTopics'
  | 'sentiment'
  | 'totalUsage'
  | 'messagesCount'
  | 'attachments'
  | 'widgetChannel'
  | 'locationCountry'
  | 'deviceType';

export type ChatLogTagPreferences = Record<ChatLogTagPreferenceKey, boolean>;

export const DEFAULT_CHAT_LOG_TAG_PREFERENCES: ChatLogTagPreferences = {
  lead: true,
  primaryTopic: true,
  allTopics: false,
  sentiment: true,
  totalUsage: false,
  messagesCount: false,
  attachments: false,
  widgetChannel: false,
  locationCountry: false,
  deviceType: false,
};

const STORAGE_PREFIX = 'assistrio.customer.insights.chatLogTags.';

export function chatLogTagPreferencesStorageKey(botId: string): string {
  return `${STORAGE_PREFIX}${botId.trim()}`;
}

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

/** Merge stored partial JSON with defaults; ignore unknown keys. */
export function normalizeChatLogTagPreferences(raw: unknown): ChatLogTagPreferences {
  const base = { ...DEFAULT_CHAT_LOG_TAG_PREFERENCES };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_CHAT_LOG_TAG_PREFERENCES) as ChatLogTagPreferenceKey[]) {
    if (isBool(o[k])) base[k] = o[k];
  }
  return base;
}

export function readChatLogTagPreferences(botId: string): ChatLogTagPreferences {
  if (!botId.trim() || typeof window === 'undefined') return { ...DEFAULT_CHAT_LOG_TAG_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(chatLogTagPreferencesStorageKey(botId));
    if (!raw?.trim()) return { ...DEFAULT_CHAT_LOG_TAG_PREFERENCES };
    return normalizeChatLogTagPreferences(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_CHAT_LOG_TAG_PREFERENCES };
  }
}

export function writeChatLogTagPreferences(botId: string, prefs: ChatLogTagPreferences): void {
  if (!botId.trim() || typeof window === 'undefined') return;
  try {
    const normalized = normalizeChatLogTagPreferences(prefs);
    window.localStorage.setItem(chatLogTagPreferencesStorageKey(botId), JSON.stringify(normalized));
  } catch {
    /* quota / privacy mode */
  }
}
