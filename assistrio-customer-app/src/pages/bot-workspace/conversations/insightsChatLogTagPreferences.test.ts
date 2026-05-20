import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAT_LOG_TAG_PREFERENCES,
  chatLogTagPreferencesStorageKey,
  normalizeChatLogTagPreferences,
} from './insightsChatLogTagPreferences';

describe('insightsChatLogTagPreferences', () => {
  it('normalize merges partial JSON with defaults', () => {
    expect(normalizeChatLogTagPreferences(null)).toEqual(DEFAULT_CHAT_LOG_TAG_PREFERENCES);
    expect(normalizeChatLogTagPreferences({ lead: false })).toEqual({
      ...DEFAULT_CHAT_LOG_TAG_PREFERENCES,
      lead: false,
    });
    expect(normalizeChatLogTagPreferences({ sentiment: false, totalUsage: true })).toEqual({
      ...DEFAULT_CHAT_LOG_TAG_PREFERENCES,
      sentiment: false,
      totalUsage: true,
    });
  });

  it('normalize ignores non-boolean keys', () => {
    expect(
      normalizeChatLogTagPreferences({
        lead: 'yes',
        primaryTopic: true,
      } as Record<string, unknown>),
    ).toEqual({
      ...DEFAULT_CHAT_LOG_TAG_PREFERENCES,
      primaryTopic: true,
    });
  });

  it('storage key includes bot id', () => {
    expect(chatLogTagPreferencesStorageKey('abc')).toContain('abc');
  });

  it('fills new keys into previously stored payloads', () => {
    const legacyUnknown = normalizeChatLogTagPreferences({ lead: true, primaryTopic: true } as unknown);
    expect(legacyUnknown.messagesCount).toBe(DEFAULT_CHAT_LOG_TAG_PREFERENCES.messagesCount);
    expect(legacyUnknown.widgetChannel).toBe(DEFAULT_CHAT_LOG_TAG_PREFERENCES.widgetChannel);
    expect(legacyUnknown.allTopics).toBe(DEFAULT_CHAT_LOG_TAG_PREFERENCES.allTopics);
  });
});
