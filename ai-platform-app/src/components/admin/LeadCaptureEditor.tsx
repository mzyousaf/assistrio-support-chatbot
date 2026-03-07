"use client";

import React, { useCallback, useState } from "react";

import {
  SettingsActionMenu,
  SettingsCollectionHeader,
  SettingsDependencyAlert,
  SettingsEmptyCollection,
  SettingsSideSheet,
  SettingsToggleRow,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { BotLeadCaptureV2, BotLeadField, LeadFieldType } from "@/models/Bot";

interface LeadCaptureEditorProps {
  value: BotLeadCaptureV2;
  onChange: (next: BotLeadCaptureV2) => void;
  showFieldsWhenDisabled?: boolean;
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
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export default function LeadCaptureEditor({
  value,
  onChange,
  showFieldsWhenDisabled = false,
}: LeadCaptureEditorProps) {
  const enabled = Boolean(value.enabled);
  const fields = value.fields ?? EMPTY_FIELDS;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<BotLeadField>({ label: "", key: "", type: "text", required: true });

  React.useEffect(() => {
    if (!enabled || fields.length > 0) return;
    onChange({ enabled: true, fields: DEFAULT_FIELDS });
  }, [enabled, fields.length, onChange]);

  const setFields = useCallback(
    (next: BotLeadField[]) => {
      onChange({ enabled, fields: next });
    },
    [enabled, onChange],
  );

  const showFormBuilder = enabled || showFieldsWhenDisabled;
  const formBuilderDisabled = !enabled && showFieldsWhenDisabled;

  const openAdd = () => {
    setDraft({ label: "", key: "", type: "text", required: true });
    setEditingIndex(null);
    setSheetOpen(true);
  };

  const openEdit = (index: number) => {
    setDraft({ ...fields[index] });
    setEditingIndex(index);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingIndex(null);
  };

  const handleLabelChange = (label: string) => {
    setDraft((prev) => ({
      ...prev,
      label,
      key: prev.key ? prev.key : uniqueKey(label, fields, editingIndex ?? undefined),
    }));
  };

  const handleSave = () => {
    const label = draft.label.trim();
    const key = uniqueKey(draft.key || slugify(label) || "field", fields, editingIndex ?? undefined);
    const nextField: BotLeadField = {
      label: label || "Field",
      key: key || "field",
      type: draft.type,
      required: draft.required !== false,
    };
    if (editingIndex !== null) {
      const next = [...fields];
      next[editingIndex] = nextField;
      setFields(next);
    } else {
      setFields([...fields, nextField]);
    }
    closeSheet();
  };

  const handleDelete = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const isValid = draft.label.trim().length > 0;

  return (
    <div className="space-y-5">
      <SettingsToggleRow
        label="Enabled"
        htmlFor="lead-capture-enabled"
        helperText="When on, users are asked for contact details before full answers."
      >
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            id="lead-capture-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange({ enabled: e.target.checked, fields })}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable lead capture</span>
        </label>
      </SettingsToggleRow>

      {showFormBuilder && (
        <div className={formBuilderDisabled ? "pointer-events-none opacity-60" : undefined}>
          <SettingsCollectionHeader
            title="Form fields"
            summary={fields.length === 0 ? null : `${fields.length} field${fields.length !== 1 ? "s" : ""}`}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={formBuilderDisabled}
                onClick={openAdd}
              >
                Add field
              </Button>
            }
          />
          {fields.length === 0 ? (
            <SettingsEmptyCollection
              title="No form fields"
              description="Add fields to collect from users."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={formBuilderDisabled}
                  onClick={openAdd}
                >
                  Add field
                </Button>
              }
              className="mt-3"
            />
          ) : (
            <div className="mt-3 overflow-x-auto overflow-y-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="min-w-[32rem] grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_minmax(4.5rem,auto)] gap-3 border-b border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                <span>Label</span>
                <span className="font-mono">Key</span>
                <span>Type</span>
                <span>Required</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="min-w-[32rem] divide-y divide-gray-100 dark:divide-gray-700/80">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_minmax(4.5rem,auto)] gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-gray-50/80 dark:bg-gray-900/30 dark:hover:bg-gray-800/60"
                  >
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {field.label || "—"}
                    </span>
                    <span className="truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={field.key || undefined}>
                      {field.key || "—"}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {field.type}
                    </span>
                    {field.required !== false ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        Required
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Optional</span>
                    )}
                    <div className="flex justify-end gap-1">
                      <SettingsActionMenu
                        onEdit={() => openEdit(index)}
                        onDelete={() => handleDelete(index)}
                        editLabel="Edit field"
                        deleteLabel="Remove field"
                        disabled={formBuilderDisabled}
                        showLabels={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {formBuilderDisabled && (
            <SettingsDependencyAlert className="mt-3">
              Enable lead capture to configure form fields.
            </SettingsDependencyAlert>
          )}
        </div>
      )}

      <SettingsSideSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingIndex !== null ? "Edit field" : "Add field"}
        description="Configure label, key, type, and whether the field is required."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeSheet}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Label</label>
            <Input
              value={draft.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g. Full name"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Key</label>
            <Input
              value={draft.key}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, key: uniqueKey(e.target.value, fields, editingIndex ?? undefined) }))
              }
              placeholder="e.g. full_name"
              className="w-full font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value as LeadFieldType }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={draft.required !== false}
              onChange={(e) => setDraft((prev) => ({ ...prev, required: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
          </label>
        </div>
      </SettingsSideSheet>
    </div>
  );
}
