"use client";

import { LaunchReadinessSidebarCard } from "@/components/admin/LaunchReadinessSidebarCard";
import { useLaunchReadinessSidebarState } from "@/contexts/LaunchReadinessSidebarContext";

type Props = {
  theme: "light" | "dark";
  /** Current agent id — snapshot from another bot is ignored. */
  botId: string;
};

export function WorkspaceAssistantBlock({ theme, botId }: Props) {
  const ctx = useLaunchReadinessSidebarState();
  const data =
    ctx?.snapshot && ctx.snapshot.botId === botId ? ctx.snapshot : null;
  if (!data) return null;

  return (
    <>
      <p className="mb-2.5 w-full text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
        Workspace assistant
      </p>
      <div className="w-full min-w-0">
        <LaunchReadinessSidebarCard data={data} theme={theme} />
      </div>
    </>
  );
}
