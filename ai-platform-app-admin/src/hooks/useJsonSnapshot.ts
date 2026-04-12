import { useMemo } from "react";

/** Stable `JSON.stringify` for dirty checks — recomputes when `value` identity changes. */
export function useJsonSnapshot(value: unknown): string {
  return useMemo(() => JSON.stringify(value), [value]);
}
