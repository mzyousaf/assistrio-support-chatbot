"use client";

/**
 * Internal dashboard table — data from GET /api/user/analytics/bots/summary (authenticated).
 * Not for PV-safe or public embed clients.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { resolveUserHref } from "@/components/admin/admin-shell-config";
import { Card } from "@/components/ui/Card";
import type { InternalBotsSummaryResponse } from "@/types/internal-analytics";

type BotRow = InternalBotsSummaryResponse["bots"][number];

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

export function AnalyticsBotsTable({
  bots,
  truncated,
}: {
  bots: BotRow[];
  truncated: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-2">
      {truncated ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Bot list was truncated server-side for payload size; sorting is by messages then conversations.
        </p>
      ) : null}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Bot</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Type</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Status</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-xs">Conv.</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-xs">Msgs</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-xs">Showcase</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-xs">Trial</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-xs">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800 dark:divide-gray-800 dark:text-gray-200">
              {bots.map((row) => {
                const href = resolveUserHref(pathname, `/user/bots/${row.botId}/insights/conversations`);
                return (
                  <tr key={row.botId} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <Link
                        href={href}
                        className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                      >
                        {row.name}
                      </Link>
                      <div className="text-xs text-gray-500 dark:text-gray-500">{row.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                          row.type === "showcase"
                            ? "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
                        )}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{row.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.conversationCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.messageCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.showcaseRuntimeUserMessages}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.trialRuntimeUserMessages}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.conversationsWithCapturedLeads}</td>
                  </tr>
                );
              })}
              {bots.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={8}>
                    No bots found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
