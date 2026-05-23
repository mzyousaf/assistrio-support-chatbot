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

function hexChannel(hex: string, start: number): number {
  return parseInt(hex.slice(start, start + 2), 16);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Foreground hex for readable text on a solid primary/brand background. */
export function readableTextOnPrimaryColor(raw: unknown): '#0F172A' | '#FFFFFF' {
  const hex = normalizePrimaryColor(raw);
  const r = hexChannel(hex, 1);
  const g = hexChannel(hex, 3);
  const b = hexChannel(hex, 5);
  return relativeLuminance(r, g, b) > 0.55 ? '#0F172A' : '#FFFFFF';
}
