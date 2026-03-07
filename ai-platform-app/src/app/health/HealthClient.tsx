"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type ClientHealth = { status: "ok"; timestamp: string } | { error: string } | null;

export function HealthClient() {
  const [result, setResult] = useState<ClientHealth>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/health")
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json();
        if (res.ok) setResult(data as { status: "ok"; timestamp: string });
        else setResult({ error: `HTTP ${res.status}` });
      })
      .catch((e) => {
        if (!cancelled) setResult({ error: e instanceof Error ? e.message : "Request failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (result === null) return <p className="text-slate-400">Checking from browser…</p>;
  if ("error" in result) return <p className="text-red-400">Browser check: {result.error}</p>;
  return (
    <p className="text-emerald-400">
      Browser check: OK (backend hit from client — see Network tab)
    </p>
  );
}
