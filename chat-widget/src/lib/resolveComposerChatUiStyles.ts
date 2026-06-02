import type { CSSProperties } from "react";

import type {
  BotChatUI,
  ChatHeaderStyle,
  ComposerControlStyle,
  SpeechRecordingWaveStyle,
} from "../models/botChatUI";

export type { ChatHeaderStyle, ComposerControlStyle, SpeechRecordingWaveStyle };

/** Default neutral header; `brand` fills the bar with {@link BotChatUI.primaryColor}. */
export function resolveHeaderStyle(chatUI: BotChatUI | undefined): ChatHeaderStyle {
  return chatUI?.headerStyle === "brand" ? "brand" : "default";
}

/** Live composer meter — “Default” (classic blue lane). */
export const SPEECH_WAVE_DEFAULT_RGB = { light: "#6eb6ea", dark: "#8ec9f8" } as const;

/** Live composer meter — “Default (dark)” / dark chip (near-black on light, light on dark UI). */
export const SPEECH_WAVE_DEFAULT_DARK_RGB = {
  light: "#0f172a",
  dark: "rgba(255, 255, 255, 0.88)",
} as const;

/** Legacy `composerControlsUsePrimary: false` → default; otherwise defaultDark (historical widget look). */
export function resolveComposerControlStyle(chatUI: BotChatUI | undefined): ComposerControlStyle {
  const s = chatUI?.composerControlStyle;
  if (s === "brand" || s === "default" || s === "defaultDark") return s;
  return chatUI?.composerControlsUsePrimary === false ? "default" : "defaultDark";
}

/** When unset, follow send/voice button style so “Default (dark)” applies to the live meter too. */
export function resolveSpeechRecordingWaveStyle(chatUI: BotChatUI | undefined): SpeechRecordingWaveStyle {
  const s = chatUI?.speechRecordingWaveStyle;
  if (s === "brand" || s === "default" || s === "defaultDark") return s;
  return resolveComposerControlStyle(chatUI);
}

/**
 * Meter + playback colors for `defaultDark` use the neutral “default” preset until
 * a dedicated default-dark waveform palette is defined in settings.
 */
export function effectiveSpeechRecordingWaveStyle(
  waveStyle: SpeechRecordingWaveStyle,
): SpeechRecordingWaveStyle {
  return waveStyle === "defaultDark" ? "default" : waveStyle;
}

/** Tailwind `fill-current` tone for {@link SpeechLevelWaveform} in the composer. */
export function speechRecordingWaveSvgClass(
  waveStyle: SpeechRecordingWaveStyle,
  dark: boolean,
): string | undefined {
  const style = effectiveSpeechRecordingWaveStyle(waveStyle);
  if (style === "brand") return undefined;
  if (style === "defaultDark") {
    return dark ? "text-white/90" : "text-slate-900";
  }
  return dark ? "text-[#8ec9f8]" : "text-[#6eb6ea]";
}

export function speechRecordingWaveSvgStyle(
  waveStyle: SpeechRecordingWaveStyle,
  accentColor: string,
): CSSProperties | undefined {
  if (effectiveSpeechRecordingWaveStyle(waveStyle) !== "brand") return undefined;
  const acc = accentColor.trim() || "#6366f1";
  return { color: acc };
}

/** Playback strip colors aligned with the live recording meter. */
export function surferColorsFromSpeechRecordingWaveStyle(
  waveStyle: SpeechRecordingWaveStyle,
  dark: boolean,
  accentColor: string,
): { waveColor: string; progressColor: string } {
  const style = effectiveSpeechRecordingWaveStyle(waveStyle);
  const acc = (accentColor || "#6366f1").trim();
  if (style === "brand") {
    return {
      waveColor: dark ? "rgba(100, 116, 139, 0.5)" : "rgba(148, 163, 184, 0.65)",
      progressColor: acc,
    };
  }
  if (style === "defaultDark") {
    if (dark) {
      return {
        waveColor: "rgb(100, 116, 139)",
        progressColor: SPEECH_WAVE_DEFAULT_DARK_RGB.dark,
      };
    }
    return {
      waveColor: "rgb(203, 213, 225)",
      progressColor: SPEECH_WAVE_DEFAULT_DARK_RGB.light,
    };
  }
  if (dark) {
    return {
      waveColor: "rgba(142, 201, 248, 0.42)",
      progressColor: SPEECH_WAVE_DEFAULT_RGB.dark,
    };
  }
  return {
    waveColor: "rgba(110, 182, 234, 0.5)",
    progressColor: SPEECH_WAVE_DEFAULT_RGB.light,
  };
}
