"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  generatePlatformVisitorId,
  isValidPlatformVisitorIdFormat,
  parseValidPlatformVisitorIdFromSearchParams,
  PLATFORM_VISITOR_ID_STORAGE_KEY,
} from "@/lib/identity/platform-visitor";
import type { ReconnectResult, UseSiteAnalyticsVisitorResult } from "@/types/identity";

const SiteAnalyticsVisitorContext = createContext<UseSiteAnalyticsVisitorResult | null>(null);

function useSiteAnalyticsVisitorState(): UseSiteAnalyticsVisitorResult {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [status, setStatus] = useState<UseSiteAnalyticsVisitorResult["status"]>("loading");
  const [queryParamRejected, setQueryParamRejected] = useState(false);

  const reconnectWithVisitorId = useCallback((rawId: string): ReconnectResult => {
    const trimmed = rawId.trim();
    if (!trimmed) {
      return { ok: false, error: "Enter your saved visitor id." };
    }
    if (!isValidPlatformVisitorIdFormat(trimmed)) {
      return {
        ok: false,
        error: "Invalid format. Use 6–120 characters: letters, digits, and . _ : - only.",
      };
    }
    localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, trimmed);
    setVisitorId(trimmed);
    setStatus("ready");
    setQueryParamRejected(false);
    return { ok: true };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const rawQuery = searchParams.get("platformVisitorId")?.trim();
    const fromQuery = parseValidPlatformVisitorIdFromSearchParams(searchParams);

    if (rawQuery && !fromQuery) {
      setQueryParamRejected(true);
    }

    if (fromQuery) {
      localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, fromQuery);
      setVisitorId(fromQuery);
      setStatus("ready");
      return;
    }

    const fromStorage = localStorage.getItem(PLATFORM_VISITOR_ID_STORAGE_KEY);
    if (fromStorage && isValidPlatformVisitorIdFormat(fromStorage)) {
      setVisitorId(fromStorage);
      setStatus("ready");
      return;
    }

    if (fromStorage && !isValidPlatformVisitorIdFormat(fromStorage)) {
      localStorage.removeItem(PLATFORM_VISITOR_ID_STORAGE_KEY);
    }

    const generated = generatePlatformVisitorId();
    localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, generated);
    setVisitorId(generated);
    setStatus("ready");
  }, []);

  return useMemo(
    () => ({
      visitorId,
      status,
      queryParamRejected,
      reconnectWithVisitorId,
    }),
    [visitorId, status, queryParamRejected, reconnectWithVisitorId],
  );
}

/** Wrap the app tree once for anonymous marketing `visitorId` (analytics only). */
export function SiteAnalyticsVisitorProvider({ children }: { children: ReactNode }) {
  const value = useSiteAnalyticsVisitorState();
  return <SiteAnalyticsVisitorContext.Provider value={value}>{children}</SiteAnalyticsVisitorContext.Provider>;
}

export function useSiteAnalyticsVisitor(): UseSiteAnalyticsVisitorResult {
  const ctx = useContext(SiteAnalyticsVisitorContext);
  if (!ctx) {
    throw new Error("useSiteAnalyticsVisitor must be used within SiteAnalyticsVisitorProvider");
  }
  return ctx;
}
