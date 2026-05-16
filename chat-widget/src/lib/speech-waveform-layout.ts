/**
 * Shared geometry for live (`SpeechLevelWaveform`) and playback strips.
 * Matches `ComposerSpeechCapture` viewBox 0..100 × 0..36 with `h-[36px]`.
 */

export const SPEECH_WAVEFORM_VB_W = 100;
export const SPEECH_WAVEFORM_VB_H = 36;
/** Keep in sync with Tailwind `h-[36px]` on the waveform SVG. */
export const SPEECH_WAVEFORM_PX_H = 36;

export interface SpeechWaveformBarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

function minGapForBarCount(n: number): number {
  if (n > 48) return 0.065;
  if (n > 36) return 0.075;
  if (n > 24) return 0.09;
  return 0.11;
}

/** Map normalized level 0–1 to half-height in viewBox units (same curve as live strip). */
export function speechLevelToHalfHeight(level: number, vbH: number = SPEECH_WAVEFORM_VB_H): number {
  const maxRectPx = 24;
  const minRectPx = 2;
  const padY = 3;
  const maxBarH = vbH - 2 * padY;
  const maxRectHeight = (maxRectPx / SPEECH_WAVEFORM_PX_H) * vbH;
  const barPeakScale = maxRectHeight / maxBarH;
  const v = Math.min(1, Math.max(0, level));
  const quietEnd = 0.16;
  const quietAmp = 0.008;
  const amp =
    v <= quietEnd
      ? (v / quietEnd) * quietAmp
      : quietAmp + Math.pow((v - quietEnd) / (1 - quietEnd), 0.72) * (1 - quietAmp);
  return (amp * maxBarH * barPeakScale) / 2;
}

/**
 * Pill bar layout for `levels.length` bars (same rules as `SpeechLevelWaveform`).
 */
export function computeSpeechWaveformBarRects(levels: number[]): SpeechWaveformBarRect[] {
  const n = levels.length;
  if (n < 1) return [];

  const vbW = SPEECH_WAVEFORM_VB_W;
  const vbH = SPEECH_WAVEFORM_VB_H;
  const maxRectPx = 24;
  const minRectPx = 2;
  const padX = 0.75;
  const padY = 3;
  const innerW = vbW - 2 * padX;
  const gap = n > 1 ? minGapForBarCount(n) : 0;
  const barW = n > 0 ? (innerW - gap * (n - 1)) / n : 0;
  const barRenderW = barW * 0.62;
  const barXInset = (barW - barRenderW) / 2;
  const maxBarH = vbH - 2 * padY;
  const maxRectHeight = (maxRectPx / SPEECH_WAVEFORM_PX_H) * vbH;
  const minRectHeight = (minRectPx / SPEECH_WAVEFORM_PX_H) * vbH;
  const cy = vbH / 2;

  const out: SpeechWaveformBarRect[] = [];
  for (let i = 0; i < n; i++) {
    const level = levels[i] ?? 0;
    const halfH = speechLevelToHalfHeight(level, vbH);
    const h = Math.min(maxRectHeight, Math.max(minRectHeight, halfH * 2));
    const halfClamped = h / 2;
    const x = padX + i * (barW + gap) + barXInset;
    const y = cy - halfClamped;
    const rx =
      barRenderW >= 0.9 ? barRenderW / 2 : Math.max(0.28, barRenderW * 0.48);
    out.push({ x, y, width: barRenderW, height: h, rx });
  }
  return out;
}
