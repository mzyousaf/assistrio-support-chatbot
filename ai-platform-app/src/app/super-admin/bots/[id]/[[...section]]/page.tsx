"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { getBotsBasePath } from "@/components/admin/admin-shell-config";

/**
 * Legacy flat URLs (`/bots/[id]/profile`, etc.) redirect to route-based workspace paths.
 */
const LEGACY_TO_CANONICAL: Record<string, string> = {
  "": "playground/profile",
  profile: "playground/profile",
  behavior: "playground/behavior",
  knowledge: "playground/knowledge/notes",
  integrations: "playground/ai",
  chat: "playground/chat",
  appearance: "playground/appearance",
  publish: "playground/publish",
  "insights/conversations": "insights/conversations",
  "activity/leads": "insights/leads",
  "analytics/chats": "insights/analytics/chats",
  "analytics/topics": "insights/analytics/topics",
  "analytics/sentiment": "insights/analytics/sentiment",
  "sources/files": "playground/knowledge/documents",
  deploy: "playground/publish",
  "settings/general": "playground/profile",
  "settings/ai": "playground/ai",
  "settings/chat-interface": "playground/chat",
};

export default function LegacyAgentWorkspaceRedirect() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const botId = typeof params?.id === "string" ? params.id : "";
  const section = params?.section as string[] | undefined;
  const key = section?.join("/") ?? "";

  useEffect(() => {
    if (!botId) return;
    const base = getBotsBasePath(pathname);
    const canonical = LEGACY_TO_CANONICAL[key];
    if (canonical !== undefined) {
      router.replace(`${base}/${botId}/${canonical}`);
      return;
    }
    router.replace(`${base}/${botId}/playground/profile`);
  }, [botId, key, pathname, router]);

  return <p className="text-sm text-gray-500">Redirecting…</p>;
}
