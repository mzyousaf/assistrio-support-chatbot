"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTrackEvent } from "@/hooks/useTrackEvent";

/**
 * Sends `page_view` to ingestion (`POST /api/analytics/track`) on client navigations.
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
