/**
 * User-facing copy for document ingest errors (raw messages may be technical).
 */

export function friendlyKnowledgeDocumentMessage(raw: string | undefined): {
  title: string;
  detail?: string;
} {
  const t = (raw ?? "").trim();
  if (!t) {
    return {
      title: "We couldn’t process this file yet.",
      detail: "Try again in a moment, or use a simpler file (for example a smaller PDF or plain text).",
    };
  }
  const lower = t.toLowerCase();

  if (lower.includes("could not queue")) {
    return {
      title: "We couldn’t start processing for this file.",
      detail: "Try again shortly. If it keeps happening, contact support.",
    };
  }
  if (lower.includes("file_url_missing") || lower.includes("url_fetch_failed")) {
    return {
      title: "We couldn’t download this file.",
      detail: "Try again, or replace the file with a version you can open locally.",
    };
  }
  if (lower.includes("extraction") || lower.includes("extract")) {
    return {
      title: "We couldn’t read the contents of this file.",
      detail: "Try another format (PDF or TXT often work best) or a smaller file.",
    };
  }
  if (lower.includes("extraction_empty_text") || lower.includes("no_chunks")) {
    return {
      title: "This file didn’t contain usable text for search.",
      detail: "Try a text-based PDF, a .txt file, or a document with selectable text.",
    };
  }
  if (lower.includes("too_large")) {
    return {
      title: "This file is too large to index in one pass.",
      detail: "Try a shorter document or split the content into smaller files.",
    };
  }
  if (lower.includes("no_embeddings") || lower.includes("embedding")) {
    return {
      title: "We couldn’t finish indexing this file.",
      detail: "Try again in a minute. If it repeats, try a smaller file.",
    };
  }
  if (lower.includes("document_not_found")) {
    return {
      title: "This file record is no longer available.",
      detail: "Refresh the page. If the problem continues, create a new agent or contact support.",
    };
  }

  return {
    title: "We couldn’t finish preparing this file.",
    detail: "Try again, or upload a simpler version.",
  };
}
