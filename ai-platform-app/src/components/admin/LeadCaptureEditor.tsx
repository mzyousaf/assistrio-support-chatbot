"use client";

import React from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { BotLeadCaptureV2, BotLeadField, LeadFieldType } from "@/models/Bot";

interface LeadCaptureEditorProps {
  value: BotLeadCaptureV2;
  onChange: (next: BotLeadCaptureV2) => void;
}

const FIELD_TYPES: LeadFieldType[] = ["text", "email", "phone", "number", "url"];

const DEFAULT_FIELDS: BotLeadField[] = [
  { key: "name", label: "Full name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "phone", required: true },
];
const EMPTY_FIELDS: BotLeadField[] = [];

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueKey(baseInput: string, fields: BotLeadField[], indexToSkip?: number): string {
  const base = slugify(baseInput) || "field";
  const used = new Set(
    fields
      .filter((_, index) => index !== indexToSkip)
      .map((field) => field.key.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

function looksAutoKey(currentKey: string, previousLabel: string): boolean {
  const normalizedKey = currentKey.trim().toLowerCase();
  const base = slugify(previousLabel);
  if (!normalizedKey) {
    return true;
  }
  if (!base) {
    return false;
  }
  return normalizedKey === base || normalizedKey.startsWith(`${base}_`);
}

export default function LeadCaptureEditor({ value, onChange }: LeadCaptureEditorProps) {
  const enabled = Boolean(value.enabled);
  const fields = value.fields ?? EMPTY_FIELDS;

  React.useEffect(() => {
    if (!enabled || fields.length > 0) {
      return;
    }
    onChange({ enabled: true, fields: DEFAULT_FIELDS });
  }, [enabled, fields, onChange]);

  const setFields = React.useCallback(
    (nextFields: BotLeadField[]) => {
      onChange({ enabled, fields: nextFields });
    },
    [enabled, onChange],
  );

  return (
    <div className="space-y-2 border-t border-gray-200 pt-3">
      <h3 className="text-sm font-semibold text-gray-900">Lead capture</h3>
      <p className="text-xs text-gray-500">Collect contact details before sharing full answers.</p>
      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange({ enabled: event.target.checked, fields })}
        />
        Enabled
      </label>

      {enabled ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="rounded-md border border-gray-200 bg-white p-3">
              <div className="grid gap-3 md:grid-cols-12">
                <label className="md:col-span-4">
                  <span className="mb-1 block text-xs text-gray-600">Label</span>
                  <Input
                    value={field.label}
                    onChange={(event) => {
                      const nextLabel = event.target.value;
                      const next = [...fields];
                      const shouldAutofill = looksAutoKey(next[index].key, next[index].label);
                      next[index] = { ...next[index], label: nextLabel };
                      if (shouldAutofill) {
                        next[index].key = uniqueKey(nextLabel, next, index);
                      }
                      setFields(next);
                    }}
                    placeholder="Full name"
                  />
                </label>

                <label className="md:col-span-3">
                  <span className="mb-1 block text-xs text-gray-600">Key</span>
                  <Input
                    value={field.key}
                    onChange={(event) => {
                      const next = [...fields];
                      next[index] = { ...next[index], key: uniqueKey(event.target.value, next, index) };
                      setFields(next);
                    }}
                    placeholder="full_name"
                  />
                </label>

                <label className="md:col-span-3">
                  <span className="mb-1 block text-xs text-gray-600">Type</span>
                  <select
                    value={field.type}
                    onChange={(event) => {
                      const next = [...fields];
                      next[index] = { ...next[index], type: event.target.value as LeadFieldType };
                      setFields(next);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="md:col-span-2 flex items-end justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={field.required !== false}
                      onChange={(event) => {
                        const next = [...fields];
                        next[index] = { ...next[index], required: event.target.checked };
                        setFields(next);
                      }}
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFields(fields.filter((_, fieldIndex) => fieldIndex !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setFields([
                ...fields,
                {
                  label: "",
                  key: "",
                  type: "text",
                  required: true,
                },
              ])
            }
          >
            Add field
          </Button>
        </div>
      ) : null}
    </div>
  );
}
