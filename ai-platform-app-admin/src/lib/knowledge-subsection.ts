/**
 * URL segments under `playground/knowledge/*` map to one editor tab (`knowledge`)
 * but drive which knowledge UI is shown.
 */
export type KnowledgeSubsection = "notes" | "faqs" | "documents";

export function parseKnowledgeSubsectionFromSlug(slug: string): KnowledgeSubsection {
  const raw = slug.replace(/\/$/, "").trim();
  const s = raw.startsWith("playground/") ? raw.slice("playground/".length) : raw;
  if (!s.startsWith("knowledge")) return "notes";
  if (s === "knowledge/faqs") return "faqs";
  if (s === "knowledge/documents") return "documents";
  return "notes";
}
