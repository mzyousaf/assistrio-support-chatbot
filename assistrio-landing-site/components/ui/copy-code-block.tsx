"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

type Props = {
  label: string;
  code: string;
  className?: string;
};

export function CopyCodeBlock({ label, code, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-xl)] border border-slate-700/90 bg-slate-950 shadow-[var(--shadow-md)] ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-teal-950/50 bg-slate-900/95 px-3 py-2.5">
        <span className="text-xs font-medium tracking-tight text-slate-400">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-[var(--radius-sm)] bg-teal-900/80 px-2.5 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400/50"
        >
          {copied ? "Copied" : "Copy all"}
        </button>
      </div>
      <pre className="max-h-[min(420px,50vh)] overflow-auto p-4 text-left text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
