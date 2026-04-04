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
import type { ReconnectResult, UsePlatformVisitorIdResult } from "@/types/identity";

const PlatformVisitorContext = createContext<UsePlatformVisitorIdResult | null>(null);

function usePlatformVisitorIdState(): UsePlatformVisitorIdResult {
  const [platformVisitorId, setPlatformVisitorId] = useState<string | null>(null);
  const [status, setStatus] = useState<UsePlatformVisitorIdResult["status"]>("loading");
  const [queryParamRejected, setQueryParamRejected] = useState(false);

  const reconnectWithPlatformVisitorId = useCallback((rawId: string): ReconnectResult => {
    const trimmed = rawId.trim();
    if (!trimmed) {
      return { ok: false, error: "Enter your saved platform visitor id." };
    }
    if (!isValidPlatformVisitorIdFormat(trimmed)) {
      return {
        ok: false,
        error:
          "Invalid format. Use 6–120 characters: letters, digits, and . _ : - only.",
      };
    }
    localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, trimmed);
    setPlatformVisitorId(trimmed);
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
      setPlatformVisitorId(fromQuery);
      setStatus("ready");
      return;
    }

    const fromStorage = localStorage.getItem(PLATFORM_VISITOR_ID_STORAGE_KEY);
    if (fromStorage && isValidPlatformVisitorIdFormat(fromStorage)) {
      setPlatformVisitorId(fromStorage);
      setStatus("ready");
      return;
    }

    if (fromStorage && !isValidPlatformVisitorIdFormat(fromStorage)) {
      localStorage.removeItem(PLATFORM_VISITOR_ID_STORAGE_KEY);
    }

    const generated = generatePlatformVisitorId();
    localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, generated);
    setPlatformVisitorId(generated);
    setStatus("ready");
  }, []);

  return useMemo(
    () => ({
      platformVisitorId,
      status,
      queryParamRejected,
      reconnectWithPlatformVisitorId,
    }),
    [platformVisitorId, status, queryParamRejected, reconnectWithPlatformVisitorId],
  );
}

/**
 * Single source of truth for anonymous `platformVisitorId` across the landing app (quota, trial, showcase runtime).
 * Wrap the tree once — do not call {@link usePlatformVisitorIdState} directly outside this provider.
 *
 * Product rules: `docs/PRODUCT_MODEL.md`.
 */
export function PlatformVisitorProvider({ children }: { children: ReactNode }) {
  const value = usePlatformVisitorIdState();
  return <PlatformVisitorContext.Provider value={value}>{children}</PlatformVisitorContext.Provider>;
}

/**
 * Stable **platform** visitor id for anonymous landing flows: same bucket as backend `platformVisitorId`.
 * Chat/session ids are owned by the widget, not this hook.
 */
export function usePlatformVisitorId(): UsePlatformVisitorIdResult {
  const ctx = useContext(PlatformVisitorContext);
  if (!ctx) {
    throw new Error("usePlatformVisitorId must be used within PlatformVisitorProvider");
  }
  return ctx;
}
