/**
 * Allowed runtime origins (exact `https://host[:port]` strings) for the admin UI.
 * Aligns with ai-platform-backend `AllowedOrigin` / `normalizeUserAllowedOriginInput`.
 */

export type AllowedOriginFormRow = {
  id: string;
  origin: string;
  label: string;
  isActive: boolean;
};

function newRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ao_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyAllowedOriginRow(): AllowedOriginFormRow {
  return { id: newRowId(), origin: "", label: "", isActive: true };
}

function normalizeHostForLoopbackCheck(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  return h;
}

function isLoopbackHost(host: string): boolean {
  const h = normalizeHostForLoopbackCheck(host);
  if (h === "localhost") return true;
  if (h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") return true;
  return false;
}

/** Parse user input to stored origin; rejects loopback (runtime dev bypass is server-side only). */
export function parseOriginForSave(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (isLoopbackHost(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function dedupeByOrigin(rows: AllowedOriginFormRow[]): AllowedOriginFormRow[] {
  const seen = new Set<string>();
  const out: AllowedOriginFormRow[] = [];
  for (const r of rows) {
    const k = r.origin.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Hydrate form rows from API `allowedOrigins`. */
export function initialAllowedOriginRowsFromBot(bot: { allowedOrigins?: unknown }): AllowedOriginFormRow[] {
  const fromApi = bot.allowedOrigins;
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    const rows = fromApi
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const o = raw as Record<string, unknown>;
        const origin = typeof o.origin === "string" ? o.origin.trim() : "";
        if (!origin) return null;
        const label = typeof o.label === "string" ? o.label.trim() : "";
        const isActive = o.isActive !== false;
        return { id: newRowId(), origin, label, isActive } satisfies AllowedOriginFormRow;
      })
      .filter((x): x is AllowedOriginFormRow => x != null);
    const deduped = dedupeByOrigin(rows);
    if (deduped.length) return deduped;
  }

  return [emptyAllowedOriginRow()];
}

export function rowHasValidOrigin(row: AllowedOriginFormRow): boolean {
  return parseOriginForSave(row.origin) != null;
}

/** At least one active row with a valid non-loopback origin. */
export function hasActiveRuntimeOrigin(rows: AllowedOriginFormRow[]): boolean {
  return rows.some((r) => r.isActive && rowHasValidOrigin(r));
}

export function allowedOriginsFingerprint(rows: AllowedOriginFormRow[]): string {
  const normalized = rows
    .map((r) => ({
      o: parseOriginForSave(r.origin) ?? "",
      l: r.label.trim(),
      a: r.isActive,
    }))
    .filter((x) => x.o)
    .sort((a, b) => (a.o + a.l + a.a).localeCompare(b.o + b.l + b.a));
  return JSON.stringify(normalized);
}

export type AllowedOriginPayload = { origin: string; label?: string; isActive: boolean };

export function toAllowedOriginsPayload(
  rows: AllowedOriginFormRow[],
  maxRows: number,
): AllowedOriginPayload[] {
  const out: AllowedOriginPayload[] = [];
  for (const row of rows) {
    const origin = parseOriginForSave(row.origin);
    if (!origin) continue;
    const label = row.label.trim();
    out.push({
      origin,
      ...(label ? { label } : {}),
      isActive: row.isActive,
    });
    if (out.length >= maxRows) break;
  }
  return out;
}
