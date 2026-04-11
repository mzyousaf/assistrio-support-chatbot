"use client";

import { createContext, useContext, type ReactNode } from "react";

export type TrialDashboardSessionSerial = {
  emailNormalized: string;
  platformVisitorId: string;
  sessionExpiresAt: string;
  displayName: string;
  initials: string;
};

const TrialDashboardSessionContext = createContext<TrialDashboardSessionSerial | null>(null);

export function TrialDashboardSessionProvider({
  value,
  children,
}: {
  value: TrialDashboardSessionSerial;
  children: ReactNode;
}) {
  return (
    <TrialDashboardSessionContext.Provider value={value}>{children}</TrialDashboardSessionContext.Provider>
  );
}

export function useTrialDashboardSession(): TrialDashboardSessionSerial {
  const ctx = useContext(TrialDashboardSessionContext);
  if (!ctx) {
    throw new Error("useTrialDashboardSession must be used within TrialDashboardSessionProvider");
  }
  return ctx;
}
