/** Duplicated from chat-widget admin/widget bubble styling (narrow subset). */
export type ConversationMessageUserBubbleStyle = 'primary' | 'default' | 'defaultDark';

export type ConversationMessageSpeechRecordingWaveStyle = 'brand' | 'default' | 'defaultDark';

/** Voice/dictate payload shown in conversation detail (matches persisted `speechInput`). */
export type ConversationMessageVoiceSpeechMeta = {
  mode: 'dictate' | 'voice';
  transcript?: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
};
