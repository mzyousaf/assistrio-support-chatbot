"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** DNS label for a single subdomain segment (e.g. `www` → `www.example.com`). */
const EMBED_SUBDOMAIN_LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

export function EmbedSubdomainLabelsList({
  labels,
  onChange,
  idPrefix,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const normalized = draft.trim().toLowerCase();
  const canAdd =
    normalized.length > 0 &&
    EMBED_SUBDOMAIN_LABEL_RE.test(normalized) &&
    !labels.map((x) => x.toLowerCase()).includes(normalized);

  function add() {
    if (!canAdd) return;
    onChange([...labels, normalized]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      {labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
          {labels.map((l) => (
            <li key={l}>
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                {l}
                <button
                  type="button"
                  className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800 dark:hover:text-red-400"
                  aria-label={`Remove ${l}`}
                  onClick={() => onChange(labels.filter((x) => x !== l))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`${idPrefix}-subdraft`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. www"
          className="min-w-[8rem] flex-1 font-mono text-sm"
          autoComplete="off"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add} disabled={!canAdd}>
          Add
        </Button>
      </div>
    </div>
  );
}
