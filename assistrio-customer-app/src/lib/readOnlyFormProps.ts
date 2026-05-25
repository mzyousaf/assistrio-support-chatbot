/** Shared disabled/readOnly props for bot settings when the user cannot manage the agent. */
export function readOnlyFormProps(canManage: boolean): { disabled: boolean; readOnly?: boolean } {
  return canManage ? { disabled: false } : { disabled: true, readOnly: true };
}

export function readOnlySwitchProps(canManage: boolean): { disabled: boolean } {
  return { disabled: !canManage };
}
