"use client";

import type { EmbeddingStatus } from "@/models/Bot";
import Tooltip from "@/components/ui/Tooltip";

const STATUS_LABELS: Record<EmbeddingStatus, string> = {
  ready: "Ready",
  pending: "Pending",
  failed: "Failed",
};

const STATUS_CLASSES: Record<EmbeddingStatus, string> = {
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = Date.now();
    const sec = Math.floor((now - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

interface EmbeddingStatusBadgeProps {
  status?: EmbeddingStatus | null;
  updatedAt?: string | null;
  error?: string | null;
  label?: string;
  size?: "sm" | "xs";
}

export function EmbeddingStatusBadge({
  status,
  updatedAt,
  error,
  label,
  size = "sm",
}: EmbeddingStatusBadgeProps) {
  const s = status ?? "pending";
  const text = label ?? STATUS_LABELS[s];
  const sizeClass = size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5";

  let tooltip: string;
  if (s === "ready") {
    tooltip = "Embedding is up to date and will be used for better semantic retrieval.";
    if (updatedAt) tooltip += ` Last updated: ${formatRelativeTime(updatedAt)}.`;
  } else if (s === "pending") {
    tooltip =
      "Content changed and embedding is being updated in the background. The chatbot can still use lexical matching until embedding is ready.";
  } else {
    tooltip = "Embedding update failed.";
    if (error) tooltip += ` ${error}`;
    tooltip += " Use Retry embed to try again.";
  }

  const badge = (
    <span
      className={`inline-flex items-center rounded font-medium ${STATUS_CLASSES[s]} ${sizeClass}`}
    >
      {text}
    </span>
  );

  return <Tooltip content={tooltip}>{badge}</Tooltip>;
}
