"use client";

import { useEffect } from "react";
import { useVisitorId } from "@/hooks/useVisitorId";
import { API_BASE_URL } from "@/lib/config";

export function usePageView(path: string) {
  const { platformVisitorId, loading } = useVisitorId();

  useEffect(() => {
    if (loading) return;
    if (!platformVisitorId) return;
    if (!API_BASE_URL) return;

    const controller = new AbortController();

    fetch(`${API_BASE_URL}/api/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformVisitorId,
        type: "page_view",
        path,
      }),
      signal: controller.signal,
    }).catch((err) => {
      console.error("Failed to track page_view", err);
    });

    return () => controller.abort();
  }, [platformVisitorId, loading, path]);
}
