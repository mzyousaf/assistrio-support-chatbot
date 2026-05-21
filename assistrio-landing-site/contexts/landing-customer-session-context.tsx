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
  buildCustomerAppEntryUrl,
  buildCustomerGoogleAuthStartUrl,
  fetchLandingCustomerMe,
  type LandingCustomerMe,
  type LandingCustomerSessionStatus,
  tryGetCustomerApiOriginForBrowser,
  tryGetCustomerAppOrigin,
} from "@/lib/customer/landing-customer-auth";

export type LandingCustomerSessionValue = {
  status: LandingCustomerSessionStatus;
  me: LandingCustomerMe | null;
  /** Nest API origin when configured (browser env). */
  apiBaseUrl: string | null;
  /** Customer Vite app origin when configured. */
  customerAppBaseUrl: string | null;
  /** Full URL to start Google OAuth (GET, navigates to Google). */
  googleAuthStartUrl: string | null;
  /** Customer app entry (`/`); PostLoginRedirect handles onboarding vs dashboard. */
  customerAppEntryUrl: string | null;
  /** Non-fatal: e.g. session probe returned 5xx; CTAs still work for anonymous. */
  sessionProbeError: string | null;
  refresh: () => Promise<void>;
};

const LandingCustomerSessionContext = createContext<LandingCustomerSessionValue | null>(null);

export function LandingCustomerSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LandingCustomerSessionStatus>("loading");
  const [me, setMe] = useState<LandingCustomerMe | null>(null);
  const [sessionProbeError, setSessionProbeError] = useState<string | null>(null);

  const apiBaseUrl = tryGetCustomerApiOriginForBrowser() ?? null;
  const customerAppBaseUrl = tryGetCustomerAppOrigin() ?? null;

  const googleAuthStartUrl = apiBaseUrl ? buildCustomerGoogleAuthStartUrl(apiBaseUrl) : null;
  const customerAppEntryUrl = customerAppBaseUrl ? buildCustomerAppEntryUrl(customerAppBaseUrl) : null;

  const refresh = useCallback(async () => {
    setSessionProbeError(null);
    if (!apiBaseUrl) {
      setMe(null);
      setStatus("anonymous");
      return;
    }
    setStatus("loading");
    const result = await fetchLandingCustomerMe(apiBaseUrl);
    if (result.ok) {
      setMe(result.me);
      setStatus("authenticated");
      return;
    }
    if ("anonymous" in result && result.anonymous) {
      setMe(null);
      setStatus("anonymous");
      return;
    }
    setMe(null);
    setStatus("anonymous");
    setSessionProbeError("error" in result ? result.error : "Unknown error");
  }, [apiBaseUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      status,
      me,
      apiBaseUrl,
      customerAppBaseUrl,
      googleAuthStartUrl,
      customerAppEntryUrl,
      sessionProbeError,
      refresh,
    }),
    [
      status,
      me,
      apiBaseUrl,
      customerAppBaseUrl,
      googleAuthStartUrl,
      customerAppEntryUrl,
      sessionProbeError,
      refresh,
    ],
  );

  return (
    <LandingCustomerSessionContext.Provider value={value}>{children}</LandingCustomerSessionContext.Provider>
  );
}

export function useLandingCustomerSession(): LandingCustomerSessionValue {
  const ctx = useContext(LandingCustomerSessionContext);
  if (!ctx) {
    throw new Error("useLandingCustomerSession must be used within LandingCustomerSessionProvider");
  }
  return ctx;
}
