"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { HealthClient } from "./HealthClient";

type HealthStatus = {
  ok: boolean;
  backend: boolean;
  error: string | null;
} | null;

export default function HealthPage() {
  const [status, setStatus] = useState<HealthStatus>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/health")
      .then(async (res) => {
        if (cancelled) return;
        try {
          const data = (await res.json()) as { status?: string };
          setStatus({
            ok: data?.status === "ok",
            backend: true,
            error: null,
          });
        } catch {
          setStatus({ ok: false, backend: false, error: `Backend returned ${res.status}` });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus({
            ok: false,
            backend: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
      <div className="w-full rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-4 text-2xl font-semibold">Health Check</h1>

        <div className="space-y-2 text-sm">
          {status === null ? (
            <p className="text-slate-400">Loading…</p>
          ) : (
            <>
              <p>
                Status:{" "}
                <span className={status.ok ? "text-emerald-400" : "text-red-400"}>
                  {status.ok ? "OK" : "FAILED"}
                </span>
              </p>
              <p>Backend: {status.backend ? "Reachable" : "Unreachable"}</p>
              {status.error ? <p className="text-red-400">Error: {status.error}</p> : null}
            </>
          )}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <HealthClient />
          </div>
        </div>
      </div>
    </main>
  );
}
