"use client";

import { useCallback } from "react";
import { useSiteAnalyticsVisitor } from "@/contexts/platform-visitor-context";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";

/** Mirrors `VisitorEventType` in the API — keep aligned with `track-payload.dto.ts`. */
export type VisitorTrackEventType =
  | "page_view"
  | "cta_clicked"
  | "demo_opened";

type TrackOptions = {
  botId?: string;
  botSlug?: string;
};

export function useTrackEvent() {
  const { visitorId, status } = useSiteAnalyticsVisitor();

  const track = useCallback(
    (
      type: VisitorTrackEventType,
      metadata?: Record<string, unknown>,
      options?: TrackOptions,
    ) => {
      if (status !== "ready" || !visitorId) return;
      const base = tryGetPublicApiBaseUrl();
      if (!base) return;

      const path =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;

      const body: Record<string, unknown> = {
        visitorId,
        type,
        path,
      };
      if (metadata && Object.keys(metadata).length > 0) {
        body.metadata = metadata;
      }
      if (options?.botId) body.botId = options.botId;
      if (options?.botSlug) body.botSlug = options.botSlug;

      void fetch(`${base}/api/analytics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    },
    [visitorId, status],
  );

  return { track };
}
