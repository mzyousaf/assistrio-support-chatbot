/**
 * UI helpers for allowed embed hostnames (aligned with backend embed-domain.util).
 * Runtime allows only listed full hostnames; use `hosts:a,b,c` for multiple in one slot.
 */

const HOSTS_PREFIX = "hosts:";

/** Infer registrable-style parent host so `www.example.com` + `example.com` share main `example.com`. */
export function inferMainHostnameFromParts(parts: string[]): string {
  const p = parts.map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (p.length === 0) return "";
  for (const candidate of p) {
    if (p.every((other) => other === candidate || other.endsWith("." + candidate))) {
      return candidate;
    }
  }
  const one = p[0];
  const labels = one.split(".");
  if (labels.length >= 2) {
    return labels.slice(-2).join(".");
  }
  return one;
}

/** Left labels under `main` (e.g. `www` for `www.example.com`). */
export function subdomainsLabelsFromParts(parts: string[], main: string): string[] {
  const out: string[] = [];
  for (const full of parts) {
    if (full === main) continue;
    if (!full.endsWith("." + main)) continue;
    const label = full.slice(0, -(main.length + 1));
    if (label) out.push(label);
  }
  return out;
}

export type DomainGroupFields = {
  main: string;
  includeApex: boolean;
  /** One subdomain label per entry (e.g. `www`, `app`); order preserved for UI. */
  subLabels: string[];
};

export function domainGroupFieldsFromStored(stored: string): DomainGroupFields {
  const t = String(stored).trim();
  if (t.toLowerCase().startsWith(HOSTS_PREFIX)) {
    const parts = t
      .slice(HOSTS_PREFIX.length)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const main = inferMainHostnameFromParts(parts);
    const includeApex = parts.includes(main);
    const subLabels = subdomainsLabelsFromParts(parts, main);
    return { main, includeApex, subLabels };
  }
  if (t.toLowerCase().startsWith("exact:")) {
    return { main: "", includeApex: false, subLabels: [] };
  }
  return { main: t.toLowerCase(), includeApex: true, subLabels: [] };
}

/** Build stored string for a domain group (single hostname or `hosts:...`). */
export function serializeDomainGroup(fields: DomainGroupFields): string | null {
  const main = fields.main.trim().toLowerCase();
  if (!main) return null;
  const labels = fields.subLabels
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((label) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label));
  const parts: string[] = [];
  if (fields.includeApex) parts.push(main);
  for (const label of labels) {
    parts.push(`${label}.${main}`);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1 && labels.length === 0) return parts[0];
  const sorted = [...new Set(parts)].sort();
  return `${HOSTS_PREFIX}${sorted.join(",")}`;
}

/**
 * Hostnames that this domain group will allow (same logic as {@link serializeDomainGroup}).
 * Empty if main is missing, or if apex is off and there are no valid subdomain labels.
 */
export function listResolvedHostnamesForDomainGroup(fields: DomainGroupFields): string[] {
  const main = fields.main.trim().toLowerCase();
  if (!main) return [];
  const labels = fields.subLabels
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((label) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label));
  const parts: string[] = [];
  if (fields.includeApex) parts.push(main);
  for (const label of labels) {
    parts.push(`${label}.${main}`);
  }
  if (parts.length === 0) return [];
  return [...new Set(parts)].sort();
}
