import type { InputProps } from './Input';

/** Compact modal forms: 32px inputs/selects, muted labels (invite + account settings modals). */
export const modalFormFieldLabelClass = 'mb-1.5 block text-xs font-medium text-slate-600';

export const modalFormInputSize: NonNullable<InputProps['inputSize']> = 'md';

export const modalFormSelectSize = 'md' as const;
