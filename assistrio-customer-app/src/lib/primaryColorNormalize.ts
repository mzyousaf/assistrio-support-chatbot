/** Default widget primary (teal) — aligned with `DEFAULT_CHAT_UI.primaryColor`. */
export const DEFAULT_PRIMARY_HEX = '#14B8A6';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const HEX3 = /^#[0-9A-Fa-f]{3}$/;

/**
 * While typing: keep only `#` and hex digits, single leading `#`, max `#` + 6 digits.
 */
export function sanitizePrimaryColorInput(raw: string): string {
  let s = raw.replace(/[^#0-9A-Fa-f]/g, '');
  if (!s.startsWith('#')) {
    s = '#' + s.replace(/#/g, '');
  } else {
    s = '#' + s.slice(1).replace(/#/g, '');
  }
  return s.slice(0, 7);
}

/**
 * Normalize stored/API value to `#RRGGBB`, or default. Supports shorthand `#RGB`.
 */
export function normalizePrimaryColor(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_PRIMARY_HEX;
  const t = raw.trim();
  if (HEX6.test(t)) return t.toUpperCase();
  if (HEX3.test(t)) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_PRIMARY_HEX;
}
