export function maskRuntimeKey(value: string): string {
  const normalized = String(value ?? "");
  if (!normalized) return "";
  if (normalized.length <= 8) return "********";
  return `${normalized.slice(0, 4)}${"*".repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`;
}
