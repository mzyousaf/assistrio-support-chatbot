import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { Button, FieldRow, Input, Modal, Select, Switch, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  defaultLeadFieldFormModalText,
  defaultLeadFieldFormValues,
  type LeadFieldFormModalText,
  type LeadFieldFormValues,
  type LeadFieldTypeOption,
} from './types';
import { validateLeadFieldForm, type LeadFieldFormErrors } from './validateLeadFieldForm';
import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';
import { uniqueLeadFieldKey } from '@/lib/leadFieldKey';

export type LeadFieldFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Seed when the dialog opens; ignored while closed. */
  initialValues: LeadFieldFormValues;
  /** Current keys for all fields (e.g. `leadFields.map(f => f.key)`). Used to preview and enforce uniqueness. */
  existingFieldKeys: readonly string[];
  /** When editing, the key of the row being edited so it does not count as a duplicate. */
  excludeFieldKey?: string | null;
  /** Allowed field types (order = select order). */
  typeOptions: readonly LeadFieldTypeOption[];
  onSubmit: (values: LeadFieldFormValues) => void | Promise<void>;
  /** Disables actions and shows spinner on primary. */
  submitting?: boolean;
  /** Merged with `defaultLeadFieldFormModalText` for titles, labels, and default error strings. */
  text?: Partial<LeadFieldFormModalText>;
  /** Extra validation; field errors merge with built-in (label / type). */
  validate?: (values: LeadFieldFormValues) => LeadFieldFormErrors | null | void;
  /** Prefix for `id` / `htmlFor` when multiple modals exist. Default `lead-field`. */
  idPrefix?: string;
  /** Built-in fields: label, key preview, and type cannot be changed. */
  labelAndTypeReadOnly?: boolean;
  /** When true, the Required switch is disabled (e.g. Name is always required). */
  requiredReadOnly?: boolean;
  labelMaxLength?: number;
  /** Modal panel width. */
  size?: 'md' | 'lg';
  className?: string;
};

function mergeText(partial?: Partial<LeadFieldFormModalText>): LeadFieldFormModalText {
  return { ...defaultLeadFieldFormModalText, ...partial };
}

/** Info icon; `content` is the former subtitle / helper (shown in the tooltip). */
function FieldLabelInfo({ content, ariaLabel }: { content: ReactNode; ariaLabel: string }) {
  return (
    <Tooltip content={content} className="-ml-0.5 shrink-0">
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        aria-label={ariaLabel}
      >
        <Info size={13} strokeWidth={1.75} aria-hidden />
      </button>
    </Tooltip>
  );
}

export function LeadFieldFormModal({
  open,
  onOpenChange,
  mode,
  initialValues,
  existingFieldKeys,
  excludeFieldKey = null,
  typeOptions,
  onSubmit,
  submitting = false,
  text: textPartial,
  validate: validateExtra,
  idPrefix = 'lead-field',
  labelAndTypeReadOnly = false,
  requiredReadOnly = false,
  labelMaxLength = BOT_FIELD_MAX.leadFieldLabel,
  size = 'lg',
  className,
}: LeadFieldFormModalProps) {
  const text = mergeText(textPartial);

  const [values, setValues] = useState<LeadFieldFormValues>(() => initialValues ?? defaultLeadFieldFormValues());
  const [errors, setErrors] = useState<LeadFieldFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? defaultLeadFieldFormValues());
    setErrors({});
  }, [open, initialValues]);

  const resolvedKey = useMemo(
    () => uniqueLeadFieldKey(values.label, existingFieldKeys, excludeFieldKey),
    [values.label, existingFieldKeys, excludeFieldKey],
  );

  const runValidation = useCallback(
    (v: LeadFieldFormValues): LeadFieldFormErrors => {
      const base = validateLeadFieldForm(v, {
        typeOptions,
        labelMaxLength,
        text: {
          labelRequiredError: text.labelRequiredError,
          labelMaxError: text.labelMaxError,
          typeRequiredError: text.typeRequiredError,
        },
      });
      const extra = validateExtra?.(v);
      return { ...base, ...extra };
    },
    [typeOptions, labelMaxLength, text, validateExtra],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const nextErrors = runValidation(values);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
      await onSubmit({
        ...values,
        label: values.label.trim(),
      });
    },
    [onSubmit, runValidation, values],
  );

  const title = mode === 'edit' ? text.titleEdit : text.titleCreate;
  const description = mode === 'edit' ? text.descriptionEdit : text.descriptionCreate;
  const submitLabel = mode === 'edit' ? text.submitEdit : text.submitCreate;

  /** Match `Label` typography (section titles, not uppercase captions). */
  const sectionTitleClass =
    'm-0 text-[0.8125rem] font-medium leading-tight tracking-[-0.01em] text-slate-800';
  /** Title next to switches (matches control label weight; inline with info icon). */
  const ruleRowTitleClass = 'text-sm font-medium leading-tight text-slate-900';

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={description}
      size={size}
      className={className}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {text.cancel}
          </Button>
          <Button
            type="submit"
            form={`${idPrefix}-form`}
            variant="primary"
            size="sm"
            disabled={submitting}
            className="gap-1.5"
            aria-busy={submitting || undefined}
          >
            {submitting ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                {text.submitting}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </>
      }
    >
      <form id={`${idPrefix}-form`} className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-3">
          <FieldRow
            label={text.labelLabel}
            htmlFor={`${idPrefix}-label`}
            required
            className="gap-1.5"
            labelRowClassName="w-full min-w-0 gap-1"
            labelAddon={
              <>
                <FieldLabelInfo content={text.labelHelper} ariaLabel={`About ${text.labelLabel}`} />
                <span
                  className="ml-auto shrink-0 text-xs text-slate-500 tabular-nums"
                  aria-live="polite"
                >{`${values.label.length}/${labelMaxLength}`}</span>
              </>
            }
            error={errors.label}
          >
            <div className="space-y-1.5">
              <Input
                id={`${idPrefix}-label`}
                quiet
                required
                disabled={labelAndTypeReadOnly}
                invalid={Boolean(errors.label)}
                value={values.label}
                maxLength={labelMaxLength}
                onChange={(e) => {
                  const next = e.target.value.slice(0, labelMaxLength);
                  setValues((s) => ({ ...s, label: next }));
                  if (errors.label) setErrors((er) => ({ ...er, label: undefined }));
                }}
                placeholder="e.g. Company name"
                autoComplete="off"
              />
              <code
                className="inline-flex max-w-full truncate rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-[0.6875rem] font-medium leading-tight text-slate-800"
                aria-live="polite"
                aria-label={`${text.keyPreviewLabel}: ${resolvedKey}`}
                title={resolvedKey}
              >
                {resolvedKey}
              </code>
            </div>
          </FieldRow>
          <FieldRow
            label={text.typeLabel}
            htmlFor={`${idPrefix}-type`}
            required
            className="gap-1.5"
            labelRowClassName="gap-1"
            labelAddon={
              <FieldLabelInfo content={text.typeHelper} ariaLabel={`About ${text.typeLabel}`} />
            }
            error={errors.type}
          >
            <Select
              id={`${idPrefix}-type`}
              quiet
              required
              disabled={labelAndTypeReadOnly}
              invalid={Boolean(errors.type)}
              value={values.type}
              onChange={(e) => {
                const v = e.target.value as LeadFieldFormValues['type'];
                setValues((s) => ({ ...s, type: v }));
                if (errors.type) setErrors((er) => ({ ...er, type: undefined }));
              }}
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FieldRow>
          {labelAndTypeReadOnly ? (
            <p className="m-0 text-sm leading-snug text-slate-600">
              This is a built-in field: the label, key, and type are fixed so the assistant can recognize it reliably.
            </p>
          ) : null}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className={cn(sectionTitleClass, 'mb-3')}>{text.rulesSection}</p>
          <div className="rounded-xl border border-slate-200/85 bg-slate-50/40 px-3.5 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span id={`${idPrefix}-required-label`} className={ruleRowTitleClass}>
                  {text.requiredLabel}
                </span>
                <FieldLabelInfo content={text.requiredHelper} ariaLabel={`About ${text.requiredLabel}`} />
              </div>
              <Switch
                id={`${idPrefix}-required`}
                checked={values.required}
                disabled={requiredReadOnly}
                onCheckedChange={(on) => setValues((s) => ({ ...s, required: on }))}
                aria-labelledby={`${idPrefix}-required-label`}
                className="shrink-0"
              />
            </div>
            <div className="border-t border-slate-200/80 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span id={`${idPrefix}-active-label`} className={ruleRowTitleClass}>
                    {text.activeLabel}
                  </span>
                  <FieldLabelInfo content={text.activeHelper} ariaLabel={`About ${text.activeLabel}`} />
                </div>
                <Switch
                  id={`${idPrefix}-active`}
                  checked={values.active}
                  onCheckedChange={(on) => setValues((s) => ({ ...s, active: on }))}
                  aria-labelledby={`${idPrefix}-active-label`}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
