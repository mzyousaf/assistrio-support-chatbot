import type { BotChatUI, ComposerControlStyle, SpeechRecordingWaveStyle } from "../models/botChatUI";

export type { ComposerControlStyle, SpeechRecordingWaveStyle };

/** Legacy `composerControlsUsePrimary: false` → default; otherwise defaultDark (historical widget look). */
export function resolveComposerControlStyle(chatUI: BotChatUI | undefined): ComposerControlStyle {
  const s = chatUI?.composerControlStyle;
  if (s === "brand" || s === "default" || s === "defaultDark") return s;
  return chatUI?.composerControlsUsePrimary === false ? "default" : "defaultDark";
}

export function resolveSpeechRecordingWaveStyle(chatUI: BotChatUI | undefined): SpeechRecordingWaveStyle {
  const s = chatUI?.speechRecordingWaveStyle;
  if (s === "brand" || s === "default" || s === "defaultDark") return s;
  return "default";
}
