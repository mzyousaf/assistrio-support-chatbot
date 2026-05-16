/** Shared shape for lead-field create/edit dialogs (Leads Capture, embeds, etc.). */

export type LeadFieldType = 'text' | 'email' | 'phone' | 'number' | 'url';

export type LeadFieldFormValues = {
  label: string;
  type: LeadFieldType;
  required: boolean;
  active: boolean;
};

export type LeadFieldTypeOption = {
  value: LeadFieldType;
  label: string;
};

export function defaultLeadFieldFormValues(): LeadFieldFormValues {
  return {
    label: '',
    type: 'text',
    required: false,
    active: true,
  };
}

/** Copy for `LeadFieldFormModal`; override any key from the parent for i18n or different products. */
export type LeadFieldFormModalText = {
  titleCreate: string;
  titleEdit: string;
  descriptionCreate: string;
  descriptionEdit: string;
  submitCreate: string;
  submitEdit: string;
  /** Shown on the primary button while `submitting` is true. */
  submitting: string;
  cancel: string;
  identitySection: string;
  rulesSection: string;
  labelLabel: string;
  labelHelper: string;
  keyPreviewLabel: string;
  keyPreviewHelper: string;
  typeLabel: string;
  typeHelper: string;
  requiredLabel: string;
  requiredHelper: string;
  activeLabel: string;
  activeHelper: string;
  labelRequiredError: string;
  labelMaxError: string;
  typeRequiredError: string;
};

export const defaultLeadFieldFormModalText: LeadFieldFormModalText = {
  titleCreate: 'Add field',
  titleEdit: 'Edit field',
  descriptionCreate: 'Add a field the assistant can request or match from visitor messages.',
  descriptionEdit: 'Change how this field is stored and whether the bot should ask for it.',
  submitCreate: 'Add field',
  submitEdit: 'Save changes',
  submitting: 'Saving…',
  cancel: 'Cancel',
  identitySection: 'Field identity',
  rulesSection: 'Collection rules',
  labelLabel: 'Label',
  labelHelper: 'Shown to visitors. The internal key below is generated from this label.',
  keyPreviewLabel: 'Internal key',
  keyPreviewHelper:
    'Derived from the label: lowercase, spaces and special characters become hyphens. Must be unique among your fields.',
  typeLabel: 'Type',
  typeHelper: 'Controls validation and input hints in the widget.',
  requiredLabel: 'Required',
  requiredHelper: 'The assistant will try to collect this before considering the lead complete.',
  activeLabel: 'Active',
  activeHelper: 'Turn off to keep the field on file but pause asking for it in chat.',
  labelRequiredError: 'Enter a label.',
  labelMaxError: 'Use at most {max} characters.',
  typeRequiredError: 'Choose a type.',
};
