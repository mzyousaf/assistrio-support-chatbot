import type {
  BotLeadCaptureLegacy,
  BotLeadCaptureV2,
  BotLeadField,
  LeadAskStrategy,
  LeadFieldType,
} from "@/models/Bot";

const DEFAULT_ASK_STRATEGY: LeadAskStrategy = "balanced";
/** UI no longer exposes capture mode; API always persists chat scheduling. */
const SAVED_CAPTURE_MODE = "chat" as const;

function parseAskStrategy(raw: unknown): LeadAskStrategy | undefined {
  return raw === "soft" || raw === "balanced" || raw === "direct" ? raw : undefined;
}

export function defaultLeadCaptureBehavior(): Pick<BotLeadCaptureV2, "askStrategy" | "captureMode"> {
  return {
    askStrategy: DEFAULT_ASK_STRATEGY,
    captureMode: SAVED_CAPTURE_MODE,
  };
}

const ALLOWED_TYPES: LeadFieldType[] = ["text", "email", "phone", "number", "url"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Lowercase kebab-case key from arbitrary input (letters/digits; runs of other chars become hyphens). */
export function slugifyLeadFieldKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function ensureUniqueKey(base: string, usedKeys: Set<string>): string {
  const normalizedBase = slugifyLeadFieldKey(base) || "field";
  if (!usedKeys.has(normalizedBase)) {
    usedKeys.add(normalizedBase);
    return normalizedBase;
  }
  let index = 2;
  while (usedKeys.has(`${normalizedBase}-${index}`)) {
    index += 1;
  }
  const next = `${normalizedBase}-${index}`;
  usedKeys.add(next);
  return next;
}

/** Unique key among existing fields (optional row skipped when editing). */
export function uniqueLeadFieldKeyFromLabel(
  label: string,
  fields: BotLeadField[],
  skipIndex?: number,
): string {
  const base = slugifyLeadFieldKey(label) || "field";
  const used = new Set(
    fields
      .filter((_, index) => index !== skipIndex)
      .map((field) => field.key.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
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
      label: labelRaw || key.replace(/-/g, " "),
      type,
      required: field.required !== false,
      ...(field.disabled === true ? { disabled: true } : {}),
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

  const raw = input as Record<string, unknown>;
  const fields = normalizeFields(raw.fields);
  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : fields.length > 0;
  const askStrategy = parseAskStrategy(raw.askStrategy) ?? DEFAULT_ASK_STRATEGY;
  const behavior = { askStrategy, captureMode: SAVED_CAPTURE_MODE };

  if (fields.length > 0) {
    return { enabled, fields, ...behavior };
  }

  if (hasLegacyBooleans(input)) {
    const legacy = input as BotLeadCaptureLegacy & { enabled?: unknown };
    const legacyEnabled = typeof legacy.enabled === "boolean" ? legacy.enabled : false;
    const legacyFields: BotLeadField[] = [];
    if (legacy.collectName !== false) {
      legacyFields.push({ key: "name", label: "Name", type: "text", required: true });
    }
    if (legacy.collectEmail !== false) {
      legacyFields.push({ key: "email", label: "Email", type: "email", required: true });
    }
    if (legacy.collectPhone) {
      legacyFields.push({ key: "phone", label: "Phone", type: "phone", required: true });
    }
    return { enabled: legacyEnabled, fields: legacyFields, ...behavior };
  }

  return { enabled: false, fields: [] };
}
