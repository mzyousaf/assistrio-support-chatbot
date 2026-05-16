/** Max width for the editor column when inline preview is visible (and default centered editor when no preview) */
export const WIDGET_PREVIEW_EDITOR_MAX_PX = 1198;

/**
 * Inline grid: `minmax(0, EDITOR_MAX) minmax(PREVIEW_MIN, 1fr)` — editor caps at 1198px, preview fills
 * the rest with a 415px minimum track width.
 */
export const WIDGET_PREVIEW_PREVIEW_MIN_PX = 415;
