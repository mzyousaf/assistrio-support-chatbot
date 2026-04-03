"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentWorkspaceEmbedPreviewHost } from "@/components/admin/agent-workspace/AgentWorkspaceEmbedPreviewHost";
import { EmbedPreviewProvider } from "@/contexts/EmbedPreviewContext";
import { LaunchReadinessSidebarProvider } from "@/contexts/LaunchReadinessSidebarContext";
import { AgentWorkspaceProvider, type AgentWorkspaceLoadState } from "@/contexts/AgentWorkspaceContext";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/api";
import type { DocRow, Health } from "@/lib/agent-workspace-initial-bot";

export function AgentWorkspaceDataLoader({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const botId = typeof params?.id === "string" ? params.id : "";
  const { user, loading: authLoading } = useUser();
  const [state, setState] = useState<AgentWorkspaceLoadState>("loading");
  const [bot, setBot] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Health | undefined>(undefined);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [botType, setBotType] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user || !botId) return;
    let cancelled = false;
    setState("loading");
    Promise.all([apiFetch(`/api/user/bots/${botId}`), apiFetch(`/api/user/bots/${botId}/documents`)])
      .then(async ([botRes, docsRes]) => {
        if (cancelled) return;
        if (!botRes.ok) {
          setState("not-found");
          return;
        }
        const botData = (await botRes.json()) as {
          ok?: boolean;
          bot?: Record<string, unknown> & { slug?: string };
          health?: Health;
        };
        const b = botData?.bot;
        if (!b) {
          setState("not-found");
          return;
        }
        const type = (b.type as string) ?? "";
        if (type !== "showcase") {
          setBotType(type);
          setState("not-showcase");
          return;
        }
        setBot(b);
        setHealth(botData?.health);

        let docs: DocRow[] = [];
        if (docsRes.ok) {
          const docsJson = (await docsRes.json()) as { documents?: DocRow[] };
          docs = docsJson?.documents ?? [];
        }
        setDocuments(docs);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [user, botId, refreshKey]);

  const value = useMemo(
    () => ({
      botId,
      state: authLoading || !user ? ("loading" as const) : state,
      bot,
      health,
      documents,
      botType,
      refetch,
    }),
    [botId, authLoading, user, state, bot, health, documents, botType, refetch],
  );

  return (
    <AgentWorkspaceProvider value={value}>
      <LaunchReadinessSidebarProvider botId={botId}>
        <EmbedPreviewProvider>
          {children}
          <AgentWorkspaceEmbedPreviewHost />
        </EmbedPreviewProvider>
      </LaunchReadinessSidebarProvider>
    </AgentWorkspaceProvider>
  );
}
