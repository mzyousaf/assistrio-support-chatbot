/** Safe browser hints for `analyticsContext` on chat POST bodies (no IP, no raw UA, no GPS). */
export type ClientAnalyticsContextPayload = {
  location?: {
    timezone?: string;
    source?: string;
  };
  deviceInfo?: {
    screenWidth?: number;
    screenHeight?: number;
    language?: string;
  };
};

export function buildClientAnalyticsContext(): ClientAnalyticsContextPayload | undefined {
  if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;
  try {
    const timezone =
      typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined;
    const screenWidth = typeof window.screen?.width === "number" ? window.screen.width : undefined;
    const screenHeight = typeof window.screen?.height === "number" ? window.screen.height : undefined;
    const language = typeof navigator.language === "string" ? navigator.language : undefined;
    if (!timezone && screenWidth == null && screenHeight == null && !language) return undefined;
    return {
      ...(timezone
        ? {
            location: {
              timezone,
              source: "browser_timezone",
            },
          }
        : {}),
      ...(screenWidth != null || screenHeight != null || language
        ? {
            deviceInfo: {
              ...(screenWidth != null ? { screenWidth } : {}),
              ...(screenHeight != null ? { screenHeight } : {}),
              ...(language ? { language } : {}),
            },
          }
        : {}),
    };
  } catch {
    return undefined;
  }
}
