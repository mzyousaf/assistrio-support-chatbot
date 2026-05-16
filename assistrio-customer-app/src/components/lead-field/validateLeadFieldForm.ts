import type { LeadFieldFormModalText, LeadFieldFormValues, LeadFieldTypeOption } from './types';

export type LeadFieldFormErrors = Partial<Record<'label' | 'type', string>>;

export function validateLeadFieldForm(
  values: LeadFieldFormValues,
  options: {
    typeOptions: readonly LeadFieldTypeOption[];
    labelMaxLength: number;
    text: Pick<LeadFieldFormModalText, 'labelRequiredError' | 'labelMaxError' | 'typeRequiredError'>;
  },
): LeadFieldFormErrors {
  const errors: LeadFieldFormErrors = {};
  const trimmed = values.label.trim();
  if (!trimmed) {
    errors.label = options.text.labelRequiredError;
  } else if (trimmed.length > options.labelMaxLength) {
    errors.label = options.text.labelMaxError.replace('{max}', String(options.labelMaxLength));
  }
  const allowed = new Set(options.typeOptions.map((o) => o.value));
  if (!allowed.has(values.type)) {
    errors.type = options.text.typeRequiredError;
  }
  return errors;
}
