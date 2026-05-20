import { useCallback, useEffect, useState } from 'react';
import type { ChatLogTagPreferences } from './insightsChatLogTagPreferences';
import { readChatLogTagPreferences, writeChatLogTagPreferences } from './insightsChatLogTagPreferences';

/** Load / save chat log chip visibility for the active bot ({@link localStorage}). */
export function useInsightsChatLogTagPreferences(botId: string | null | undefined) {
  const [preferences, setPreferences] = useState<ChatLogTagPreferences>(() =>
    readChatLogTagPreferences(botId ?? ''),
  );

  useEffect(() => {
    setPreferences(readChatLogTagPreferences(botId ?? ''));
  }, [botId]);

  const savePreferences = useCallback((next: ChatLogTagPreferences) => {
    if (!botId?.trim()) return;
    writeChatLogTagPreferences(botId, next);
    setPreferences(readChatLogTagPreferences(botId));
  }, [botId]);

  return { preferences, savePreferences };
}
