/**
 * Prepare chat message body text for display: remove inline citation markers.
 * Sources belong in the Sources used panel only — never inline badges/chips.
 */

/** Bracketed numeric markers: [1], [12] (not reference definitions `[1]: url`) */
const BRACKETED_NUMERIC_CITATION = /\[(\d+)\](?!\s*[\(:])/g;

/** Slash-prefixed markers: /[7] (common in broken LLM citation output) */
const SLASH_BRACKETED_NUMERIC_CITATION = /\/\s*\[(\d+)\]/g;

/** Markdown inline links whose label is only digits: [2](https://...) */
const NUMERIC_MARKDOWN_LINK = /\[(\d+)\]\([^)]*\)/g;

/** GFM footnote references: [^1] */
const GFM_FOOTNOTE_REF = /\[\^\d+\]/g;

/** Reference-style link bodies: [text][1] — remove whole marker, not the label digit */
const REFERENCE_STYLE_BODY = /\[([^\]]+)\]\[(\d+)\]/g;

/** Reference definitions at line start: [1]: https://... */
const REFERENCE_DEFINITION_LINE = /^\[\d+\]:\s*.+$/gm;

/** Evidence block leak from prompts: `[1] sourceType:` lines */
const EVIDENCE_INDEX_LINE = /^\[\d+\]\s*sourceType:\s*.+$/gim;

/** Inline evidence index prefix before field names */
const EVIDENCE_INDEX_PREFIX = /\[\d+\]\s*(?=sourceType:|title:|text:|url:)/gi;

/** Internal strict marker (optional future format) */
const STRICT_SOURCE_MARKER = /\[\[source:\d+\]\]/gi;

/** Strip inline HTML citation tags if ever present in stored content */
const INLINE_CITATION_HTML_TAGS = /<\/?(?:sup|a)\b[^>]*>/gi;

/** Bare https? URLs — linkified for markdown after citation strip */
const BARE_HTTP_URL = /https?:\/\/[^\s<>\])}"']+/g;

/**
 * Strip inline citation markers from message text before rendering.
 * Does not alter plain numbers (5, 24/7, Step 1, Version 2.0).
 */
export function stripInlineCitationMarkers(text: string): string {
  if (!text) return "";
  let out = text;
  out = out.replace(INLINE_CITATION_HTML_TAGS, "");
  out = out.replace(STRICT_SOURCE_MARKER, "");
  out = out.replace(NUMERIC_MARKDOWN_LINK, "");
  out = out.replace(REFERENCE_DEFINITION_LINE, "");
  out = out.replace(EVIDENCE_INDEX_LINE, "");
  out = out.replace(EVIDENCE_INDEX_PREFIX, "");
  out = out.replace(REFERENCE_STYLE_BODY, "");
  out = out.replace(SLASH_BRACKETED_NUMERIC_CITATION, "");
  out = out.replace(BRACKETED_NUMERIC_CITATION, "");
  out = out.replace(GFM_FOOTNOTE_REF, "");
  return collapseDisplayWhitespace(out);
}

function collapseDisplayWhitespace(text: string): string {
  return text
    .replace(/\s+\/\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Wrap bare http(s) URLs so standard markdown renders them as links.
 * Run after {@link stripInlineCitationMarkers}.
 */
export function linkifyBareHttpUrls(text: string): string {
  if (!text) return "";
  return text.replace(BARE_HTTP_URL, (url) => `[${url}](${url})`);
}

/** Plain text safe for user bubbles (no markdown). */
export function prepareChatMessagePlainText(text: string): string {
  return stripInlineCitationMarkers(text);
}

/** Strip citation markers when persisting message text (before streaming / history). */
export function sanitizeChatMessageContent(
  role: "user" | "assistant" | "system",
  content: string,
): string {
  if (!content) return "";
  if (role === "assistant" || role === "system") {
    return stripInlineCitationMarkers(content);
  }
  return prepareChatMessagePlainText(content);
}

/** Text safe for assistant markdown rendering. */
export function prepareChatMessageMarkdown(text: string): string {
  return linkifyBareHttpUrls(stripInlineCitationMarkers(text));
}

/** @deprecated Use {@link prepareChatMessagePlainText} or {@link prepareChatMessageMarkdown}. */
export function prepareChatMessageBodyForDisplay(text: string): string {
  return prepareChatMessagePlainText(text);
}
