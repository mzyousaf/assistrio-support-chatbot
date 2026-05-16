"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

type Props = {
  label: string;
  value: string;
};

export function CopyField({ label, value }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-slate-50/90 p-3 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 break-all font-mono text-sm text-slate-900">{value}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--brand-teal-dark)] transition-colors duration-150 hover:border-[var(--border-teal-soft)] hover:bg-[var(--brand-teal-subtle)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]/40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
