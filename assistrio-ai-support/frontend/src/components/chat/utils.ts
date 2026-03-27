/**
 * Simple inline "markdown" for assistant messages: escape HTML, then support **bold**, `code`, and newlines.
 * For full Markdown use a library and pass useMarkdown via config.
 */
export function renderSimpleMarkdown(text: string): string {
  if (!text) return "";
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code class='chat-inline-code'>$1</code>");
  out = out.replace(/\n/g, "<br />");
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
