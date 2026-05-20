/** Shown before the numeric value in Conversations source UI. */
export const SOURCE_SCORE_VISIBLE_LABEL = 'Confidence Score';

/** Shown when `score` is missing or non-finite (do not invent a number). */
export const SOURCE_SCORE_UNAVAILABLE_LABEL = 'Score not available';

/** For UX thresholds (modal visibility): normalized 0–100 retrieval strength. */
export function retrievalScoreToConfidencePercent(score: number): number {
  if (!Number.isFinite(score)) return NaN;
  const asPct = score <= 1 ? score * 100 : score;
  return Math.round(Math.min(100, Math.max(0, asPct)));
}

/**
 * Weak match band: score &lt; 0.1 on 0–1 scale, or &lt; 10 when stored as percent.
 * UI treats this as behaviour-driven rather than a strong KB citation.
 */
export function isBehaviourAsDataSourceScore(score: number | undefined | null): boolean {
  if (score == null || typeof score !== 'number' || !Number.isFinite(score)) return false;
  if (score <= 1) return score < 0.1;
  return score < 10;
}

/** Pill label only: `"82%"`, plain numeric scale → ×100 when ≤1. */
export function formatConfidencePercentLabel(score: number): string {
  const p = retrievalScoreToConfidencePercent(score);
  return `${p}%`;
}

/** 0–25%: flat pure red (`hsl(0,100%,…)`); 25–100%: interpolate toward green. */
export function confidenceSignalPillStyle(percent: number): { backgroundColor: string; borderColor: string } {
  const p = Math.min(100, Math.max(0, percent));

  const RED_CAP_PCT = 25;
  const redBg = 'hsl(0, 100%, 46%)';
  const redBorder = 'hsl(0, 100%, 36%)';

  if (p <= RED_CAP_PCT) {
    return { backgroundColor: redBg, borderColor: redBorder };
  }

  const t = (p - RED_CAP_PCT) / (100 - RED_CAP_PCT);
  const h = t * 118;
  const s = 100 + t * (58 - 100);
  const l = 46 + t * (37 - 46);
  const borderL = 36 + t * (Math.max(37 - 11, 28) - 36);

  return {
    backgroundColor: `hsl(${h}, ${s}%, ${l}%)`,
    borderColor: `hsl(${h}, ${s}%, ${borderL}%)`,
  };
}

/** Round to 3 decimal places, then trim trailing zeros (preserves exact integers and 0). */
export function formatSourceMatchNumericDisplay(score: number): string {
  const fixed = score.toFixed(3);
  const dot = fixed.indexOf('.');
  if (dot === -1) return fixed;
  const intPart = fixed.slice(0, dot);
  const decPart = fixed.slice(dot + 1).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

export function sourceScoreTooltipWithValue(score: number): string {
  const numeric = formatSourceMatchNumericDisplay(score);
  const pct = retrievalScoreToConfidencePercent(score);
  return `Confidence Score is ${numeric} — about ${pct}% of the cited content.`;
}

/** `title` / `aria` when no score is available. */
export const SOURCE_SCORE_MISSING_TOOLTIP = 'Confidence Score not available.';

export type FormattedSourceConfidenceScore = {
  /** Trimmed numeric display (up to 3 decimal places), e.g. "0.82", "1.235", "0". */
  matchLabel: string;
  /** Tooltip: numeric score plus rounded % of cited-content alignment. */
  confidenceTitle: string;
  rawScore: number;
};

/**
 * Retrieval/source match strength for UI.
 * Pill label uses the raw numeric score; tooltip repeats it with a rounded percent line.
 */
export function formatSourceConfidenceScore(score: number | undefined | null): FormattedSourceConfidenceScore | null {
  if (score == null || typeof score !== 'number' || !Number.isFinite(score)) return null;

  const rawScore = score;
  const matchLabel = formatSourceMatchNumericDisplay(rawScore);
  const confidenceTitle = sourceScoreTooltipWithValue(rawScore);

  return {
    matchLabel,
    confidenceTitle,
    rawScore,
  };
}
