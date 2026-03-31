/**
 * Client-side helpers for allowed embed rules (aligned with
 * ai-platform-backend/src/bots/embed-domain.util.ts).
 */

import {
  domainGroupFieldsFromStored,
  serializeDomainGroup,
  type DomainGroupFields,
} from "./embedDomainUi";

export function canonicalEmbedOrigin(input: string): string | null {
  try {
    const raw = input.trim();
    if (!raw) return null;
    const withScheme = /:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export type AllowedDomainRowMode = "domain" | "exact";

export type AllowedDomainRow =
  | { mode: "exact"; value: string }
  | { mode: "domain" } & DomainGroupFields;

function normalizeHostForForbiddenCheck(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  return h;
}

/** Localhost / loopback cannot be saved as embed rules (server allows them at runtime only when configured). */
export function isForbiddenEmbedDomainInput(mode: AllowedDomainRowMode, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (mode === "exact") {
    const co = canonicalEmbedOrigin(v);
    if (!co) return false;
    try {
      return isForbiddenHostName(new URL(co).hostname);
    } catch {
      return false;
    }
  }
  return isForbiddenHostName(v);
}

function isForbiddenHostName(host: string): boolean {
  const h = normalizeHostForForbiddenCheck(host);
  if (h === "localhost") return true;
  if (h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h === "::1") return true;
  return false;
}

export function allowedDomainRowFromStored(stored: string): AllowedDomainRow {
  const t = String(stored).trim();
  if (t.toLowerCase().startsWith("exact:")) {
    return { mode: "exact", value: t.slice(6).trim() };
  }
  const dg = domainGroupFieldsFromStored(t);
  return { mode: "domain", ...dg };
}

/** Serialized value for API (single hostname, `hosts:...`, or `exact:...`). */
export function serializeAllowedDomainRowUnion(row: AllowedDomainRow): string | null {
  if (row.mode === "exact") {
    return serializeAllowedDomainRow("exact", row.value);
  }
  return serializeDomainGroup({
    main: row.main,
    includeApex: row.includeApex,
    subLabels: row.subLabels,
  });
}

/** Returns serialized string for API or null if invalid / empty / forbidden. */
export function serializeAllowedDomainRow(mode: AllowedDomainRowMode, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (isForbiddenEmbedDomainInput(mode, value)) return null;
  if (mode === "exact") {
    const co = canonicalEmbedOrigin(v);
    return co ? `exact:${co}` : null;
  }
  return v;
}

/** True when the row has a non-empty value that is allowed to be saved (not loopback/localhost). */
export function rowIsValidAllowedEmbedDomain(mode: AllowedDomainRowMode, value: string): boolean {
  if (!value.trim()) return false;
  if (isForbiddenEmbedDomainInput(mode, value)) return false;
  if (mode === "exact") return canonicalEmbedOrigin(value) != null;
  return true;
}

export function rowIsValidAllowedDomainRow(row: AllowedDomainRow): boolean {
  if (row.mode === "exact") {
    return rowIsValidAllowedEmbedDomain("exact", row.value);
  }
  if (!row.main.trim()) return false;
  if (isForbiddenEmbedDomainInput("domain", row.main)) return false;
  const ser = serializeDomainGroup({
    main: row.main,
    includeApex: row.includeApex,
    subLabels: row.subLabels,
  });
  if (!ser) return false;
  if (ser.toLowerCase().startsWith("hosts:")) {
    for (const part of ser.slice(6).split(",")) {
      const h = part.trim();
      if (h && isForbiddenEmbedDomainInput("domain", h)) return false;
    }
  } else if (isForbiddenEmbedDomainInput("domain", ser)) return false;
  return true;
}
