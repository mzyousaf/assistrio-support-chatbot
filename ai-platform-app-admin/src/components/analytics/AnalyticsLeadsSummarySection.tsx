"use client";

/**
 * Internal lead aggregates from GET /api/user/analytics/leads/summary — counts only, no raw PII.
 */

import { Card } from "@/components/ui/Card";
import { AnalyticsStatCard } from "@/components/analytics/AnalyticsStatCard";
import type { InternalLeadsSummaryResponse } from "@/types/internal-analytics";

export function AnalyticsLeadsSummarySection({ data }: { data: InternalLeadsSummaryResponse }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnalyticsStatCard
          label="Conversations with captured leads"
          value={data.totals.conversationsWithCapturedLeads}
          hint="Same “touched in range” rule as overview."
        />
        <AnalyticsStatCard
          label="Non-empty lead field values captured"
          value={data.totals.totalLeadFieldsCaptured}
          hint="Sum of filled fields across qualifying conversations (not unique visitors)."
        />
      </div>

      {data.byBot.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 dark:border-gray-800 dark:text-gray-400">
            By bot (top buckets)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium uppercase tracking-wide text-xs">Bot</th>
                  <th className="px-4 py-2 text-right font-medium uppercase tracking-wide text-xs">Conv. w/ leads</th>
                  <th className="px-4 py-2 text-right font-medium uppercase tracking-wide text-xs">Fields captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {data.byBot.map((r) => (
                  <tr key={r.botId} className="text-gray-800 dark:text-gray-200">
                    <td className="px-4 py-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{r.slug}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.conversationsWithCapturedLeads}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.leadFieldsCaptured}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
