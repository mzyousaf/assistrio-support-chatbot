"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { DocRow, Health } from "@/lib/agent-workspace-initial-bot";

export type AgentWorkspaceLoadState = "loading" | "not-found" | "not-showcase" | "ready";

export type AgentWorkspaceContextValue = {
  botId: string;
  state: AgentWorkspaceLoadState;
  bot: Record<string, unknown> | null;
  health: Health | undefined;
  documents: DocRow[];
  botType: string;
  refetch: () => void;
};

const AgentWorkspaceContext = createContext<AgentWorkspaceContextValue | null>(null);

export function AgentWorkspaceProvider({
  value,
  children,
}: {
  value: AgentWorkspaceContextValue;
  children: ReactNode;
}) {
  return <AgentWorkspaceContext.Provider value={value}>{children}</AgentWorkspaceContext.Provider>;
}

export function useAgentWorkspace(): AgentWorkspaceContextValue {
  const ctx = useContext(AgentWorkspaceContext);
  if (!ctx) {
    throw new Error("useAgentWorkspace must be used within AgentWorkspaceProvider");
  }
  return ctx;
}
