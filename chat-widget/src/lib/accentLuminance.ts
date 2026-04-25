/** WCAG relative luminance (sRGB), inputs 0–255. */
export function relativeLuminance255(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function parseCssRgbTriplet(input: string): [number, number, number] | null {
  const s = input.trim();
  if (s.startsWith("#")) {
    const n = s.slice(1);
    if (n.length === 3) {
      return [parseInt(n[0] + n[0], 16), parseInt(n[1] + n[1], 16), parseInt(n[2] + n[2], 16)];
    }
    if (n.length === 6) {
      return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
    }
    return null;
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True when a CSS color reads as “light” — use dark foreground. */
export function isLightAccentColor(css: string, threshold = 0.55): boolean {
  const rgb = parseCssRgbTriplet(css);
  if (!rgb) return false;
  return relativeLuminance255(rgb[0], rgb[1], rgb[2]) > threshold;
}
