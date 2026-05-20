/**
 * Best-effort clipboard write (secure contexts only).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const t = String(text ?? '');
  if (!t.trim()) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
