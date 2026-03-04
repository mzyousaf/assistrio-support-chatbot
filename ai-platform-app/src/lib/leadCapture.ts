import type { BotLeadCaptureLegacy, BotLeadCaptureV2, BotLeadField, LeadFieldType } from "@/models/Bot";

const ALLOWED_TYPES: LeadFieldType[] = ["text", "email", "phone", "number", "url"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugifyKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function ensureUniqueKey(base: string, usedKeys: Set<string>): string {
  const normalizedBase = slugifyKey(base) || "field";
  if (!usedKeys.has(normalizedBase)) {
    usedKeys.add(normalizedBase);
    return normalizedBase;
  }
  let index = 2;
  while (usedKeys.has(`${normalizedBase}_${index}`)) {
    index += 1;
  }
  const next = `${normalizedBase}_${index}`;
  usedKeys.add(next);
  return next;
}

function normalizeFields(input: unknown): BotLeadField[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const usedKeys = new Set<string>();
  const output: BotLeadField[] = [];
  for (const field of input) {
    if (!isObject(field)) {
      continue;
    }
    const labelRaw = typeof field.label === "string" ? field.label.trim() : "";
    const keyRaw = typeof field.key === "string" ? field.key.trim() : "";
    if (!labelRaw && !keyRaw) {
      continue;
    }
    const typeRaw = typeof field.type === "string" ? field.type : "text";
    const type = ALLOWED_TYPES.includes(typeRaw as LeadFieldType) ? (typeRaw as LeadFieldType) : "text";
    const key = ensureUniqueKey(keyRaw || labelRaw, usedKeys);
    output.push({
      key,
      label: labelRaw || key.replace(/_/g, " "),
      type,
      required: field.required !== false,
    });
  }
  return output;
}

function hasLegacyBooleans(input: Record<string, unknown>): boolean {
  return "collectName" in input || "collectEmail" in input || "collectPhone" in input;
}

export function normalizeLeadCapture(input: unknown): BotLeadCaptureV2 {
  if (!isObject(input)) {
    return { enabled: false, fields: [] };
  }

  const fields = normalizeFields(input.fields);
  const enabled = typeof input.enabled === "boolean" ? input.enabled : fields.length > 0;
  if (fields.length > 0) {
    return { enabled, fields };
  }

  if (hasLegacyBooleans(input)) {
    const legacy = input as BotLeadCaptureLegacy & { enabled?: unknown };
    const legacyEnabled = typeof legacy.enabled === "boolean" ? legacy.enabled : false;
    const legacyFields: BotLeadField[] = [];
    if (legacy.collectName !== false) {
      legacyFields.push({ key: "name", label: "Full name", type: "text", required: true });
    }
    if (legacy.collectEmail !== false) {
      legacyFields.push({ key: "email", label: "Email", type: "email", required: true });
    }
    if (legacy.collectPhone) {
      legacyFields.push({ key: "phone", label: "Phone", type: "phone", required: true });
    }
    return { enabled: legacyEnabled, fields: legacyFields };
  }

  return { enabled: false, fields: [] };
}
