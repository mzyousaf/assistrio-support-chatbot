"use client";

import { Card } from "@/components/ui/Card";

export function AnalyticsStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="rounded-xl p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">{hint}</p> : null}
    </Card>
  );
}
