export function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Simple inline markdown: **bold**, `code`, newlines */
export function renderSimpleMarkdown(text: string): string {
  if (!text) return "";
  let out = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code class='rounded px-1 py-0.5 bg-gray-600'>$1</code>");
  out = out.replace(/\n/g, "<br />");
  return out;
}
