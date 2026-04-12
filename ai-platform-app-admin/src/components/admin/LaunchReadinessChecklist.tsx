"use client";

import type { ReadinessRow } from "@/lib/launch-readiness";

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="mt-0.5 text-green-600 dark:text-green-400" aria-hidden>
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  ) : (
    <span className="mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden>
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function Row({ row, titleClass }: { row: ReadinessRow; titleClass: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
        row.ok
          ? "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
      }`}
    >
      <CheckIcon ok={row.ok} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${titleClass}`}>{row.label}</p>
        {!row.ok && row.hint ? <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{row.hint}</p> : null}
      </div>
    </div>
  );
}

type LaunchReadinessChecklistProps = {
  required: ReadinessRow[];
  recommended: ReadinessRow[];
};

export function LaunchReadinessChecklist({ required, recommended }: LaunchReadinessChecklistProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Required</p>
        <ul className="space-y-2" role="list" aria-label="Required before publish">
          {required.map((row) => (
            <li key={row.id}>
              <Row
                row={row}
                titleClass={row.ok ? "text-gray-900 dark:text-gray-100" : "text-amber-800 dark:text-amber-200"}
              />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Recommended
        </p>
        <ul className="space-y-2" role="list" aria-label="Recommended setup">
          {recommended.map((row) => (
            <li key={row.id}>
              <Row
                row={row}
                titleClass={row.ok ? "text-gray-900 dark:text-gray-100" : "text-slate-600 dark:text-slate-400"}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
