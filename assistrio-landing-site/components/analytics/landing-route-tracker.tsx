"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTrackEvent } from "@/hooks/useTrackEvent";

/**
 * Sends `page_view` via same-origin `POST /api/analytics/track` (server proxies to Nest with `X-API-Key`).
 * Must stay inside {@link PlatformVisitorProvider}.
 */
export function LandingRouteTracker() {
  const pathname = usePathname();
  const { track } = useTrackEvent();

  useEffect(() => {
    track("page_view");
  }, [pathname, track]);

  return null;
}
