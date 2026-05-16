import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Hash,
  Info,
  Link,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  Trash2,
  Type,
} from 'lucide-react';
import { ASK_STRATEGY_OPTIONS, LEAD_FIELD_TYPES, LEAD_FIELDS_MAX } from './behaviorConstants';
import {
  BUILTIN_LEAD_FIELD_KEYS,
  useCaptureLeadsWorkspace,
  type LeadFieldDraft,
} from './CaptureLeadsWorkspaceContext';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';
import {
  LeadFieldFormModal,
  defaultLeadFieldFormValues,
  type LeadFieldFormValues,
} from '@/components/lead-field';
import { Button, Card, CardBody, Checkbox, FieldRow, Modal, Select, Switch, Tooltip } from '@/components/ui';
import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';
import { cn } from '@/lib/utils';

const PAGE_TITLE = 'Leads Capture';

/** Matches `AgentWorkspaceSidebar` Playground label (`playground/capture-leads`). */
const LEADS_CAPTURE_SECTION_NAV_LABEL = PAGE_TITLE;

const ASK_STRATEGY_INFO = (
  <div className="space-y-3 text-sm leading-relaxed text-sky-950/95">
    <p className="m-0">
      This controls how often the bot may ask out loud for details you marked as required and are still missing. If
      someone types their email or name in a message, that can still be saved—this setting does not turn that off.
      Sometimes the bot will skip asking on a reply so it does not repeat itself (for example after &ldquo;no
      thanks&rdquo; or when the person sounds upset or in a hurry).
    </p>
    <ul className="m-0 list-none space-y-2 p-0">
      <li>
        <span className="font-semibold text-sky-950">Soft</span> — asks least often (about every 4th visitor message
        once the chat is going). Good for: sensitive topics, support-heavy sites, nonprofits, or a calmer tone.
      </li>
      <li>
        <span className="font-semibold text-sky-950">Balanced (default)</span> — in the middle (often about every other
        visitor message after the first couple). Good for: most businesses if you are not sure what to pick.
      </li>
      <li>
        <span className="font-semibold text-sky-950">Direct</span> — asks most often while required fields are still
        empty. Good for: demos, quotes, sales, or when you need contact info quickly. Less ideal if the bot mainly
        handles troubleshooting.
      </li>
    </ul>
  </div>
);

function LeadCaptureLockedOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[1] min-h-[10rem] p-4 sm:p-5">
      <div
        className="absolute inset-0 bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full min-h-0 flex-col">
        {/* Start card ~25% down the overlay so it stays top-oriented without hugging the edge */}
        <div className="h-[25%] min-h-10 shrink-0" aria-hidden />
        <div className="flex w-full shrink-0 justify-center">
          <div
            className="max-w-[18rem] rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05]"
            role="status"
          >
            <div
              className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              aria-hidden
            >
              <Lock className="h-4 w-4" strokeWidth={2} />
            </div>
            <p className="m-0 text-sm font-semibold leading-snug text-slate-900">Lead capture is off</p>
            <div className={cn(ws.workspaceEditorControlHint, 'mt-1.5 text-pretty')}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

type FieldModal =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; index: number }
  | { kind: 'delete'; index: number };

function fieldTypeLabel(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function builtinLeadKey(field: LeadFieldDraft) {
  return field.key.trim().toLowerCase();
}

function isBuiltinLeadField(field: LeadFieldDraft) {
  return BUILTIN_LEAD_FIELD_KEYS.has(builtinLeadKey(field));
}

/** Name and email are fixed widget fields (label + type not customizable). */
function isFixedIdentityBuiltinField(field: LeadFieldDraft) {
  const k = builtinLeadKey(field);
  return k === 'name' || k === 'email';
}

const fieldTypeIconClass = 'h-3 w-3 shrink-0 opacity-90';

function FieldTypeIcon({ type }: { type: LeadFieldDraft['type'] }) {
  switch (type) {
    case 'email':
      return <Mail className={fieldTypeIconClass} strokeWidth={2} aria-hidden />;
    case 'phone':
      return <Phone className={fieldTypeIconClass} strokeWidth={2} aria-hidden />;
    case 'number':
      return <Hash className={fieldTypeIconClass} strokeWidth={2} aria-hidden />;
    case 'url':
      return <Link className={fieldTypeIconClass} strokeWidth={2} aria-hidden />;
    default:
      return <Type className={fieldTypeIconClass} strokeWidth={2} aria-hidden />;
  }
}

/** Compact table pills: required = warm orange; optional = cool slate-blue. */
const requiredPillRequired =
  'inline-flex items-center rounded-full bg-orange-50 px-1.5 py-px text-[0.625rem] font-medium leading-tight text-orange-900 ring-1 ring-orange-200/95';
const requiredPillOptional =
  'inline-flex items-center rounded-full bg-sky-50 px-1.5 py-px text-[0.625rem] font-medium leading-tight text-sky-900 ring-1 ring-sky-200/90';

const typePillClass =
  'inline-flex max-w-full items-center justify-center gap-1 rounded-full bg-white px-1.5 py-px text-[0.625rem] font-medium leading-tight text-slate-600 ring-1 ring-slate-200/90';

export function CaptureLeadsSection() {
  const {
    leadEnabled,
    setLeadEnabled,
    leadFields,
    leadAskStrategy,
    setLeadAskStrategy,
    leadPoliteMode,
    setLeadPoliteMode,
    appendLeadField,
    updateLeadField,
    removeLeadField,
    dirty,
    saving,
    saveError,
    save,
  } = useCaptureLeadsWorkspace();

  const [fieldModal, setFieldModal] = useState<FieldModal>({ kind: 'idle' });

  const leadFieldTypeOptions = useMemo(
    () => LEAD_FIELD_TYPES.map((t) => ({ value: t, label: fieldTypeLabel(t) })),
    [],
  );

  const leadFieldModalInitial: LeadFieldFormValues = useMemo(() => {
    if (fieldModal.kind === 'edit') {
      const f = leadFields[fieldModal.index];
      if (!f) return defaultLeadFieldFormValues();
      return {
        label: f.label,
        type: f.type,
        required: f.required,
        active: !f.disabled,
      };
    }
    return defaultLeadFieldFormValues();
  }, [fieldModal, leadFields]);

  const leadFieldModalLocks = useMemo(() => {
    if (fieldModal.kind !== 'edit') {
      return { labelAndTypeReadOnly: false, requiredReadOnly: false };
    }
    const f = leadFields[fieldModal.index];
    if (!f || !isBuiltinLeadField(f)) {
      return { labelAndTypeReadOnly: false, requiredReadOnly: false };
    }
    const k = builtinLeadKey(f);
    if (k === 'name' || k === 'email') return { labelAndTypeReadOnly: true, requiredReadOnly: true };
    return { labelAndTypeReadOnly: true, requiredReadOnly: false };
  }, [fieldModal, leadFields]);

  function openCreate() {
    setFieldModal({ kind: 'create' });
  }

  function openEdit(index: number) {
    const f = leadFields[index];
    if (f && isFixedIdentityBuiltinField(f)) return;
    setFieldModal({ kind: 'edit', index });
  }

  function openDelete(index: number) {
    const f = leadFields[index];
    if (f && isBuiltinLeadField(f)) return;
    setFieldModal({ kind: 'delete', index });
  }

  function closeModal() {
    setFieldModal({ kind: 'idle' });
  }

  const handleLeadFieldSubmit = useCallback(
    (values: LeadFieldFormValues) => {
      const disabled = !values.active;
      if (fieldModal.kind === 'create') {
        appendLeadField({
          label: values.label,
          type: values.type,
          required: values.required,
          ...(disabled ? { disabled: true } : {}),
        });
        setFieldModal({ kind: 'idle' });
        return;
      }
      if (fieldModal.kind === 'edit') {
        const cur = leadFields[fieldModal.index];
        const bk = cur ? builtinLeadKey(cur) : '';
        if (bk === 'name' || bk === 'email') {
          setFieldModal({ kind: 'idle' });
          return;
        }
        if (cur && isBuiltinLeadField(cur)) {
          updateLeadField(fieldModal.index, {
            required: values.required,
            ...(disabled ? { disabled: true } : { disabled: false }),
          });
        } else {
          updateLeadField(fieldModal.index, {
            label: values.label,
            type: values.type,
            required: values.required,
            ...(disabled ? { disabled: true } : { disabled: false }),
          });
        }
        setFieldModal({ kind: 'idle' });
      }
    },
    [appendLeadField, fieldModal, leadFields, updateLeadField],
  );

  function confirmDelete() {
    if (fieldModal.kind === 'delete') {
      removeLeadField(fieldModal.index);
      closeModal();
    }
  }

  const atFieldLimit = leadFields.length >= LEAD_FIELDS_MAX;
  const deleteTarget = fieldModal.kind === 'delete' ? leadFields[fieldModal.index] : null;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-capture-leads-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        aria-label="Lead capture settings"
      >
        <div className={cn('w-full min-w-0 flex-1', ws.workspaceEditorCardGap)}>
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>
                  Choose when and how the widget collects visitor details during conversations.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col sm:pt-0">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!dirty || saving}
                className={cn(
                  ws.workspaceEditorButtonLabel,
                  'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                )}
                aria-busy={saving || undefined}
                aria-label={
                  saving ? `Saving ${LEADS_CAPTURE_SECTION_NAV_LABEL}` : `Save ${LEADS_CAPTURE_SECTION_NAV_LABEL}`
                }
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save {LEADS_CAPTURE_SECTION_NAV_LABEL}
                  </>
                )}
              </Button>
            </div>
          </header>

          {saveError ? (
            <div
              className={cn(
                ws.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
            >
              {saveError}
            </div>
          ) : null}

          <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
            <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
              <section className={ws.workspaceEditorCardSection} aria-labelledby="capture-lead-section-h">
                <h2 id="capture-lead-section-h" className="sr-only">
                  Lead capture settings
                </h2>

                <div
                  className="rounded-lg border border-slate-200/80 bg-slate-50/40 px-3.5 py-2.5"
                  role="group"
                  aria-labelledby="capture-lead-enabled-label"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <span id="capture-lead-enabled-label" className={ws.workspaceEditorControlLabel}>
                        Enable lead capture
                      </span>
                      <Tooltip content="When on, the assistant can ask visitors for the details you configure in the fields below. Turn off to pause collection in the widget.">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-white/80 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                          aria-label="About enable lead capture"
                        >
                          <Info size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </Tooltip>
                    </div>
                    <Switch
                      id="capture-lead-enabled"
                      checked={leadEnabled}
                      onCheckedChange={setLeadEnabled}
                      aria-labelledby="capture-lead-enabled-label"
                      className="shrink-0"
                    />
                  </div>
                  <p className={cn(ws.workspaceEditorControlHint, 'mt-1.5 mb-0')}>
                    The assistant can ask for missing details according to your fields.
                  </p>
                </div>
              </section>
            </CardBody>
          </Card>

          <div className="relative w-full min-w-0">
            <div
              className={cn(ws.workspaceEditorCardGap, !leadEnabled && 'pointer-events-none')}
              aria-disabled={!leadEnabled || undefined}
            >
              <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                  <section className={ws.workspaceEditorCardSection} aria-labelledby="capture-strategy-section-h">
                    <h2 id="capture-strategy-section-h" className="sr-only">
                      Ask strategy and polite prompts
                    </h2>
                    <div
                      className={cn(
                        ws.workspaceEditorFieldStack,
                        'rounded-xl border border-slate-200/70 bg-slate-50/30 p-4',
                      )}
                    >
                      <div
                        className="rounded-lg border border-sky-200/90 bg-sky-50/95 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                        role="region"
                        aria-label="Ask strategy"
                      >
                        <FieldRow label="Ask strategy" htmlFor="capture-ask" className="min-w-0 gap-1.5 pb-3">
                          <Select
                            id="capture-ask"
                            quiet
                            value={leadAskStrategy}
                            disabled={!leadEnabled}
                            onChange={(e) =>
                              setLeadAskStrategy(e.target.value as 'soft' | 'balanced' | 'direct')
                            }
                          >
                            {ASK_STRATEGY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </FieldRow>
                        <div className="border-t border-sky-200/80 pt-3">{ASK_STRATEGY_INFO}</div>
                      </div>

                      <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5">
                        <div className="flex min-h-[2.75rem] items-start gap-3">
                          <Checkbox
                            id="capture-polite"
                            className="mt-0.5 shrink-0"
                            checked={leadPoliteMode}
                            disabled={!leadEnabled}
                            onChange={(e) => setLeadPoliteMode(e.currentTarget.checked)}
                          />
                          <div className="min-w-0 flex-1">
                            <label htmlFor="capture-polite" className={ws.workspaceEditorControlLabel}>
                              Polite prompts
                            </label>
                            <p className={cn(ws.workspaceEditorControlHint, 'mt-0.5')}>
                              Softer wording when the assistant asks for contact details—less pushy, better for
                              sensitive or support-heavy conversations.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </CardBody>
              </Card>

              <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                  <section className={ws.workspaceEditorCardSection} aria-labelledby="capture-fields-heading">
                    <WorkspaceSectionHeader
                      id="capture-fields-heading"
                      title="Fields"
                      titleAddon={
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
                          {leadFields.length}/{LEAD_FIELDS_MAX}
                        </span>
                      }
                      inlineEnd={
                        <Button
                          type="button"
                          variant="outlinePrimary"
                          size="sm"
                          className="shrink-0 cursor-pointer"
                          disabled={!leadEnabled || atFieldLimit}
                          onClick={openCreate}
                        >
                          <Plus size={14} strokeWidth={2} aria-hidden />
                          Add field
                        </Button>
                      }
                      description="View fields here. Add, edit, or remove fields using the dialogs—up to five fields."
                    />

                    {leadFields.length === 0 ? (
                      <p
                        className={cn(
                          ws.workspaceEditorHelperText,
                          'rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center',
                        )}
                      >
                        No fields yet. Click <span className="font-medium text-slate-600">Add field</span> to create one.
                      </p>
                    ) : (
                      <div className={cn(ws.tableWrap, 'overflow-x-auto')}>
                        <table className={ws.table}>
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/95">
                              <th className="min-w-[10rem] px-3 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                                Field
                              </th>
                              <th className="w-[6.25rem] px-2 py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                                Type
                              </th>
                              <th className="w-[6.75rem] px-2 py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                                Required
                              </th>
                              <th className="w-[5.5rem] px-2 py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                                Active
                              </th>
                              <th className="w-24 px-3 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {leadFields.map((field, index) => (
                              <tr key={index} className={cn(field.disabled && 'bg-slate-50/60')}>
                                <td className="px-3 py-3 align-top">
                                  <div className="min-w-0 max-w-[18rem]">
                                    <p className="m-0 text-sm font-medium leading-snug text-slate-900">{field.label}</p>
                                    <code
                                      className={cn(
                                        ws.mono,
                                        'mt-0.5 block truncate text-[0.75rem] text-slate-500',
                                      )}
                                    >
                                      {field.key}
                                    </code>
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-center align-middle">
                                  <span className={typePillClass}>
                                    <FieldTypeIcon type={field.type} />
                                    <span className="truncate">{fieldTypeLabel(field.type)}</span>
                                  </span>
                                </td>
                                <td className="px-2 py-3 text-center align-middle">
                                  <span
                                    className={field.required ? requiredPillRequired : requiredPillOptional}
                                  >
                                    {field.required ? 'Required' : 'Optional'}
                                  </span>
                                </td>
                                <td className="px-2 py-3 align-middle">
                                  <div className="flex justify-center">
                                    <Switch
                                      id={`capture-field-active-${index}`}
                                      checked={!field.disabled}
                                      disabled={!leadEnabled}
                                      onCheckedChange={(on) => updateLeadField(index, { disabled: !on })}
                                      aria-label={`Collect ${field.label} in chat`}
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-3 align-middle">
                                  <div className="flex justify-end gap-1">
                                    {isFixedIdentityBuiltinField(field) ? (
                                      <Tooltip content="Name and email are built-in fields. Their label and type are fixed; use Active to include or pause them in the widget.">
                                        <span className="inline-flex">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="cursor-not-allowed text-slate-400"
                                            disabled
                                            aria-label={`Edit ${field.label} (fixed field)`}
                                          >
                                            <Pencil size={15} strokeWidth={2} aria-hidden />
                                          </Button>
                                        </span>
                                      </Tooltip>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="cursor-pointer text-slate-600 hover:text-[var(--color-teal-700)]"
                                        disabled={!leadEnabled}
                                        onClick={() => openEdit(index)}
                                        aria-label={`Edit ${field.label}`}
                                      >
                                        <Pencil size={15} strokeWidth={2} aria-hidden />
                                      </Button>
                                    )}
                                    {isBuiltinLeadField(field) ? (
                                      <Tooltip content="Standard fields (name, email, company, phone) cannot be removed. Turn Active off to stop collecting them, or edit Required / Active where allowed.">
                                        <span className="inline-flex">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="cursor-not-allowed text-slate-400 [&_svg]:text-slate-400"
                                            disabled
                                            aria-label={`Cannot remove ${field.label}`}
                                          >
                                            <Trash2 size={15} strokeWidth={2} aria-hidden />
                                          </Button>
                                        </span>
                                      </Tooltip>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          'cursor-pointer text-slate-500',
                                          '[&_svg]:transition-colors',
                                          'hover:enabled:bg-red-50 hover:enabled:text-[var(--color-danger-text-emphasis)]',
                                          'hover:enabled:[&_svg]:text-[var(--color-danger-text-emphasis)]',
                                        )}
                                        disabled={!leadEnabled || field.disabled}
                                        onClick={() => openDelete(index)}
                                        aria-label={`Remove ${field.label}`}
                                      >
                                        <Trash2 size={15} strokeWidth={2} aria-hidden />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </CardBody>
              </Card>
            </div>

            {!leadEnabled ? (
              <LeadCaptureLockedOverlay>
                <>
                  Turn on <span className="font-medium text-slate-700">Enable lead capture</span> above to adjust
                  strategy, polite prompts, and fields.
                </>
              </LeadCaptureLockedOverlay>
            ) : null}
          </div>
        </div>
      </form>

      <LeadFieldFormModal
        open={fieldModal.kind === 'create' || fieldModal.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) closeModal();
        }}
        mode={fieldModal.kind === 'edit' ? 'edit' : 'create'}
        initialValues={leadFieldModalInitial}
        existingFieldKeys={leadFields.map((f) => f.key)}
        excludeFieldKey={fieldModal.kind === 'edit' ? leadFields[fieldModal.index]?.key : null}
        typeOptions={leadFieldTypeOptions}
        onSubmit={handleLeadFieldSubmit}
        idPrefix="capture-lead-field"
        labelAndTypeReadOnly={leadFieldModalLocks.labelAndTypeReadOnly}
        requiredReadOnly={leadFieldModalLocks.requiredReadOnly}
        labelMaxLength={BOT_FIELD_MAX.leadFieldLabel}
      />

      <Modal
        open={fieldModal.kind === 'delete'}
        onClose={closeModal}
        title="Remove field?"
        tone="danger"
        description={
          deleteTarget ? (
            <>
              This removes <span className="font-semibold">{deleteTarget.label}</span> (
              <code className="text-xs">{deleteTarget.key}</code>) from lead capture.
            </>
          ) : null
        }
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={confirmDelete}>
              Remove field
            </Button>
          </>
        }
      >
        <p className={cn(ws.workspaceEditorHelperText, 'm-0')}>
          You can add the field again later if you change your mind.
        </p>
      </Modal>
    </div>
  );
}
