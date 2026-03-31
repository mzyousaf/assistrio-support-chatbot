"use client";

import { useCallback, useState } from "react";

import {
  SettingsActionMenu,
  SettingsCollectionHeader,
  SettingsDependencyAlert,
  SettingsEmptyCollection,
  SettingsModal,
  SettingsSideSheet,
  SettingsToggleRow,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { defaultLeadCaptureBehavior, uniqueLeadFieldKeyFromLabel } from "@/lib/leadCapture";
import type { BotLeadCaptureV2, BotLeadField, LeadAskStrategy, LeadFieldType } from "@/models/Bot";

interface LeadCaptureEditorProps {
  value: BotLeadCaptureV2;
  onChange: (next: BotLeadCaptureV2) => void;
  showFieldsWhenDisabled?: boolean;
}

const FIELD_TYPES: LeadFieldType[] = ["text", "email", "phone", "number", "url"];

const DEFAULT_FIELDS: BotLeadField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "phone", required: true },
];

/** Standard fields that cannot be removed—only turned off (disabled). */
const PRESET_FIELD_KEYS = new Set(["name", "email", "phone"]);

function isPresetField(field: BotLeadField): boolean {
  return PRESET_FIELD_KEYS.has(field.key.trim().toLowerCase());
}

const EMPTY_FIELDS: BotLeadField[] = [];

/** Letters, numbers, spaces only (Unicode letters allowed). */
function sanitizeLabelInput(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s]/gu, "");
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
  const [confirmToggleOffIndex, setConfirmToggleOffIndex] = useState<number | null>(null);
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const setFields = useCallback(
    (next: BotLeadField[]) => {
      onChange({ ...value, enabled, fields: next, captureMode: "chat" });
    },
    [enabled, onChange, value],
  );

  const showFormBuilder = enabled || showFieldsWhenDisabled;
  const formBuilderDisabled = !enabled && showFieldsWhenDisabled;

  const openAdd = () => {
    setDraft({ label: "", key: "", type: "text", required: true, disabled: false });
    setEditingIndex(null);
    setSheetOpen(true);
  };

  const openEdit = (index: number) => {
    const f = fields[index];
    const label = sanitizeLabelInput(f.label).replace(/\s+/g, " ").trim();
    setDraft({
      ...f,
      label,
      key: uniqueLeadFieldKeyFromLabel(label || "Field", fields, index),
      disabled: f.disabled === true,
    });
    setEditingIndex(index);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingIndex(null);
  };

  const handleLabelChange = (raw: string) => {
    const label = sanitizeLabelInput(raw);
    setDraft((prev) => ({
      ...prev,
      label,
      key: uniqueLeadFieldKeyFromLabel(label.trim(), fields, editingIndex ?? undefined),
    }));
  };

  const handleSave = () => {
    const label = draft.label.replace(/\s+/g, " ").trim();
    const key = uniqueLeadFieldKeyFromLabel(label || "Field", fields, editingIndex ?? undefined);
    const nextField: BotLeadField = {
      label: label || "Field",
      key,
      type: draft.type,
      required: draft.required !== false,
      disabled: draft.disabled === true,
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

  const restoreDefaultFields = () => {
    setFields(DEFAULT_FIELDS.map((f) => ({ ...f })));
  };

  const applyToggleOff = (index: number) => {
    setFields(
      fields.map((f, i) => (i === index ? { ...f, disabled: true } : f)),
    );
  };

  const confirmToggleOff = () => {
    if (confirmToggleOffIndex === null) return;
    applyToggleOff(confirmToggleOffIndex);
    setConfirmToggleOffIndex(null);
  };

  const requestRemoveField = (index: number) => {
    const f = fields[index];
    if (isPresetField(f)) return;
    setConfirmRemoveIndex(index);
  };

  const confirmRemoveField = () => {
    if (confirmRemoveIndex === null) return;
    setFields(fields.filter((_, i) => i !== confirmRemoveIndex));
    setConfirmRemoveIndex(null);
  };

  const activeFieldCount = fields.filter((f) => !f.disabled).length;

  const isValid = draft.label.replace(/\s+/g, " ").trim().length > 0;

  const draftKeyPreview = uniqueLeadFieldKeyFromLabel(
    draft.label.replace(/\s+/g, " ").trim() || "Field",
    fields,
    editingIndex ?? undefined,
  );

  return (
    <div className="space-y-5">
      <SettingsToggleRow
        label="Enabled"
        htmlFor="lead-capture-enabled"
        helperText="When on, the bot can pick up details from what people type and may ask nicely for anything that’s still missing."
      >
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            id="lead-capture-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked, fields, captureMode: "chat" })}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable lead capture</span>
        </label>
      </SettingsToggleRow>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <div className="rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-3 dark:border-blue-800/80 dark:bg-blue-950/40">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">Ask strategy</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-blue-950/95 dark:text-blue-100/90">
              This controls how often the bot may <span className="font-medium">ask out loud</span> for details you marked as required and are still missing. If someone types their email or name in a message, that can still be saved—this setting does not turn that off. Sometimes the bot will skip asking on a reply so it does not repeat itself (for example after “no thanks” or when the person sounds upset or in a hurry).
            </p>
            <ul className="mt-3 space-y-2.5 border-t border-blue-200/80 pt-3 text-[11px] leading-relaxed text-blue-950/90 dark:border-blue-800/60 dark:text-blue-100/85">
              <li>
                <span className="font-medium text-blue-950 dark:text-blue-50">Soft</span> — asks least often (about every 4th visitor message once the chat is going).{" "}
                <span className="text-blue-900/85 dark:text-blue-200/90">Good for:</span> sensitive topics, support-heavy sites, nonprofits, or a calmer tone.
              </li>
              <li>
                <span className="font-medium text-blue-950 dark:text-blue-50">Balanced (default)</span> — in the middle (often about every other visitor message after the first couple).{" "}
                <span className="text-blue-900/85 dark:text-blue-200/90">Good for:</span> most businesses if you are not sure what to pick.
              </li>
              <li>
                <span className="font-medium text-blue-950 dark:text-blue-50">Direct</span> — asks most often while required fields are still empty.{" "}
                <span className="text-blue-900/85 dark:text-blue-200/90">Good for:</span> demos, quotes, sales, or when you need contact info quickly. Less ideal if the bot mainly handles troubleshooting.
              </li>
            </ul>
            <label className="sr-only" htmlFor="lead-ask-strategy">
              Ask strategy
            </label>
            <select
              id="lead-ask-strategy"
              value={(value.askStrategy ?? "balanced") as LeadAskStrategy}
              onChange={(e) =>
                onChange({
                  ...value,
                  askStrategy: e.target.value as LeadAskStrategy,
                  captureMode: "chat",
                })
              }
              className="mt-3 w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-blue-950/50 dark:text-gray-100"
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced (default)</option>
              <option value="direct">Direct</option>
            </select>
          </div>
        </div>
      )}

      {showFormBuilder && (
        <div className={formBuilderDisabled ? "pointer-events-none opacity-60" : undefined}>
          <SettingsCollectionHeader
            title="Form fields"
            summary={
              fields.length === 0
                ? null
                : activeFieldCount === fields.length
                  ? `${fields.length} field${fields.length !== 1 ? "s" : ""} collecting`
                  : `${activeFieldCount} collecting · ${fields.length} total`
            }
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {fields.length === 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={formBuilderDisabled}
                    onClick={restoreDefaultFields}
                  >
                    Restore defaults
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={formBuilderDisabled}
                  onClick={openAdd}
                >
                  Add field
                </Button>
              </div>
            }
          />
          {fields.length === 0 ? (
            <SettingsEmptyCollection
              title="No form fields"
              description="Add your own fields or restore the usual name, email, and phone set. Standard fields stay in the list when turned off—they are not deleted."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={formBuilderDisabled}
                    onClick={restoreDefaultFields}
                  >
                    Restore defaults
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={formBuilderDisabled}
                    onClick={openAdd}
                  >
                    Add field
                  </Button>
                </div>
              }
              className="mt-3"
            />
          ) : (
            <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/90 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                    <th className="px-3 py-2.5 font-medium">Field</th>
                    <th className="hidden w-[4.25rem] px-1 py-2.5 text-center font-medium sm:table-cell">On</th>
                    <th className="hidden w-[5.5rem] px-2 py-2.5 font-medium sm:table-cell">Type</th>
                    <th className="hidden w-[5.5rem] px-2 py-2.5 font-medium md:table-cell">Required</th>
                    <th className="w-12 px-2 py-2.5 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
                  {fields.map((field, index) => (
                    <tr
                      key={index}
                      className={`bg-white transition-colors hover:bg-gray-50/80 dark:bg-gray-900/30 dark:hover:bg-gray-800/60 ${
                        field.disabled ? "opacity-[0.72]" : ""
                      }`}
                    >
                      <td className="max-w-[min(100%,20rem)] px-3 py-3 align-middle">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{field.label || "—"}</div>
                            <div className="mt-0.5 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400" title={field.key}>
                              {field.key}
                            </div>
                          </div>
                          {field.disabled ? (
                            <span className="shrink-0 rounded-md bg-gray-200/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Off
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                            <input
                              type="checkbox"
                              checked={field.disabled !== true}
                              disabled={formBuilderDisabled}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFields(
                                    fields.map((f, i) => (i === index ? { ...f, disabled: false } : f)),
                                  );
                                } else {
                                  setConfirmToggleOffIndex(index);
                                }
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            Collect
                          </label>
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
                        </div>
                      </td>
                      <td className="hidden align-middle px-1 py-3 text-center sm:table-cell">
                        <input
                          type="checkbox"
                          checked={field.disabled !== true}
                          disabled={formBuilderDisabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFields(
                                fields.map((f, i) => (i === index ? { ...f, disabled: false } : f)),
                              );
                            } else {
                              setConfirmToggleOffIndex(index);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          title={field.disabled ? "Turn on collection" : "Turn off collection"}
                          aria-label={field.disabled ? `Turn on ${field.label || field.key}` : `Turn off ${field.label || field.key}`}
                        />
                      </td>
                      <td className="hidden align-middle px-2 py-3 sm:table-cell">
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {field.type}
                        </span>
                      </td>
                      <td className="hidden align-middle px-2 py-3 md:table-cell">
                        {field.required !== false ? (
                          <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Optional</span>
                        )}
                      </td>
                      <td className="align-middle px-2 py-3 text-right">
                        <SettingsActionMenu
                          onEdit={() => openEdit(index)}
                          onDelete={() => requestRemoveField(index)}
                          editLabel="Edit field"
                          deleteLabel="Remove field"
                          disabled={formBuilderDisabled}
                          deleteDisabled={isPresetField(field)}
                          showLabels={false}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        description="Set the label and type. The field key is generated from the label automatically."
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
              placeholder="e.g. Name"
              className="w-full"
            />
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              Letters, numbers, and spaces only.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Field key (auto)</p>
            <p className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{draftKeyPreview}</p>
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
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={draft.disabled !== true}
              onChange={(e) => setDraft((prev) => ({ ...prev, disabled: !e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Collect this field</span>
          </label>
        </div>
      </SettingsSideSheet>

      <SettingsModal
        open={confirmToggleOffIndex !== null}
        onClose={() => setConfirmToggleOffIndex(null)}
        title="Turn off collection?"
        description="The bot will not ask for or save this field until you turn it back on. The field stays in your list."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmToggleOffIndex(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={confirmToggleOff}>
              Turn off
            </Button>
          </>
        }
      >
        <p className="sr-only">Confirm turning off field collection.</p>
      </SettingsModal>

      <SettingsModal
        open={confirmRemoveIndex !== null}
        onClose={() => setConfirmRemoveIndex(null)}
        title="Remove field?"
        description="This field will be removed from the list. You can add it again later if you change your mind."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemoveIndex(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={confirmRemoveField}>
              Remove
            </Button>
          </>
        }
      >
        <p className="sr-only">Confirm removing this field.</p>
      </SettingsModal>
    </div>
  );
}
