"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { LaunchReadinessModel } from "@/lib/launch-readiness";

export type LaunchReadinessSidebarSnapshot = {
  status: "draft" | "published";
  model: LaunchReadinessModel;
  botBasePath: string;
  botId: string;
};

type LaunchReadinessSidebarContextValue = {
  snapshot: LaunchReadinessSidebarSnapshot | null;
  setSnapshot: (next: LaunchReadinessSidebarSnapshot | null) => void;
};

const LaunchReadinessSidebarContext = createContext<LaunchReadinessSidebarContextValue | null>(null);

export function LaunchReadinessSidebarProvider({
  botId,
  children,
}: {
  /** Clears readiness when switching agents (avoids showing another bot’s snapshot). */
  botId: string;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<LaunchReadinessSidebarSnapshot | null>(null);
  useEffect(() => {
    setSnapshot(null);
  }, [botId]);
  const value = useMemo(() => ({ snapshot, setSnapshot }), [snapshot, setSnapshot]);
  return (
    <LaunchReadinessSidebarContext.Provider value={value}>{children}</LaunchReadinessSidebarContext.Provider>
  );
}

/** Returns null when used outside `LaunchReadinessSidebarProvider` (e.g. non–agent-workspace pages). */
export function useLaunchReadinessSidebarState(): LaunchReadinessSidebarContextValue | null {
  return useContext(LaunchReadinessSidebarContext);
}
