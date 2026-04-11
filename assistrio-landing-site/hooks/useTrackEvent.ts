"use client";

import { useCallback } from "react";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";

/** Mirrors `VisitorEventType` in the API — keep aligned with `track-payload.dto.ts`. */
export type VisitorTrackEventType =
  | "page_view"
  | "demo_chat_started"
  | "trial_bot_created"
  | "trial_chat_started"
  | "cta_clicked"
  | "demo_opened"
  | "trial_create_started"
  | "trial_create_succeeded"
  | "trial_lead_step1_submit_started"
  | "trial_lead_step1_submit_succeeded"
  | "trial_lead_step1_submit_failed"
  | "trial_lead_step1_resend_started"
  | "trial_lead_step1_resend_succeeded"
  | "trial_lead_step1_resend_failed"
  | "snippet_copied"
  | "stable_id_copied"
  | "reconnect_submitted"
  | "reconnect_succeeded"
  | "website_register_started"
  | "website_register_succeeded"
  | "widget_runtime_opened"
  | "quota_viewed";

type TrackOptions = {
  botId?: string;
  botSlug?: string;
};

export function useTrackEvent() {
  const { platformVisitorId, status } = usePlatformVisitorId();

  const track = useCallback(
    (
      type: VisitorTrackEventType,
      metadata?: Record<string, unknown>,
      options?: TrackOptions,
    ) => {
      if (status !== "ready" || !platformVisitorId) return;

      const path =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;

      const body: Record<string, unknown> = {
        platformVisitorId,
        type,
        path,
      };
      if (metadata && Object.keys(metadata).length > 0) {
        body.metadata = metadata;
      }
      if (options?.botId) body.botId = options.botId;
      if (options?.botSlug) body.botSlug = options.botSlug;

      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    },
    [platformVisitorId, status],
  );

  return { track };
}
