/**
 * Lead capture config normalization: dynamic fields[], required/optional, ask strategy.
 * Backward-compatible with legacy requiredFields/optionalFields and with BotLeadCaptureV2.
 */

export type AskStrategy = 'soft' | 'balanced' | 'direct';
export type CaptureMode = 'chat' | 'form' | 'hybrid';

export interface NormalizedLeadField {
  key: string;
  label: string;
  required: boolean;
  type?: string;
  placeholder?: string;
  options?: string[];
  /** Normalized aliases for spontaneous extraction (label not used as alias in prompt). */
  aliases?: string[];
  /** When true, excluded from required/optional lists and from active capture. */
  disabled?: boolean;
}

export interface NormalizedLeadCaptureConfig {
  enabled: boolean;
  fields: NormalizedLeadField[];
  requiredFields: string[];
  optionalFields: string[];
  askStrategy: AskStrategy;
  politeMode: boolean;
  captureMode: CaptureMode;
}

const ASK_STRATEGIES: AskStrategy[] = ['soft', 'balanced', 'direct'];
const CAPTURE_MODES: CaptureMode[] = ['chat', 'form', 'hybrid'];

/** Minimal input shape: enabled, fields[] with key/label/required/type/aliases, optional askStrategy, politeMode, captureMode. */
interface LeadCaptureInput {
  enabled?: boolean;
  fields?: Array<{
    key?: string;
    label?: string;
    type?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    options?: string[];
    aliases?: string[];
  }>;
  askStrategy?: string;
  politeMode?: boolean;
  captureMode?: string;
}

/**
 * Normalize bot lead capture config into a single structure.
 * Supports dynamic custom fields; required/optional derived from fields[].required.
 */
export function normalizeLeadCaptureConfig(input: LeadCaptureInput | undefined): NormalizedLeadCaptureConfig {
  const out: NormalizedLeadCaptureConfig = {
    enabled: false,
    fields: [],
    requiredFields: [],
    optionalFields: [],
    askStrategy: 'balanced',
    politeMode: true,
    captureMode: 'chat',
  };

  if (!input || typeof input !== 'object') return out;

  const rawFields = Array.isArray(input.fields) ? input.fields : [];
  const used = new Set<string>();

  for (const f of rawFields) {
    if (!f || typeof f !== 'object') continue;
    const keyRaw =
      (f.key || f.label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-') || 'field';
    const key = ensureUniqueKey(keyRaw, used);
    const label = (f.label || key.replace(/-/g, ' ')).trim();
    const required = f.required !== false;
    const disabled = (f as { disabled?: boolean }).disabled === true;
    const aliases = Array.isArray((f as { aliases?: string[] }).aliases)
      ? (f as { aliases: string[] }).aliases.map((a) => String(a).trim().toLowerCase()).filter((a) => a.length > 0)
      : undefined;
    out.fields.push({
      key,
      label,
      required,
      disabled: disabled || undefined,
      type: typeof f.type === 'string' ? f.type : 'text',
      placeholder: typeof f.placeholder === 'string' ? f.placeholder.trim() : undefined,
      options: Array.isArray(f.options) ? f.options.map((o) => String(o).trim()).filter(Boolean) : undefined,
      aliases: aliases?.length ? aliases : undefined,
    });
    if (!disabled) {
      if (required) out.requiredFields.push(key);
      else out.optionalFields.push(key);
    }
  }

  out.enabled = typeof input.enabled === 'boolean' ? input.enabled : out.fields.length > 0;
  out.askStrategy = ASK_STRATEGIES.includes(input.askStrategy as AskStrategy) ? (input.askStrategy as AskStrategy) : 'balanced';
  out.politeMode = input.politeMode !== false;
  out.captureMode = CAPTURE_MODES.includes(input.captureMode as CaptureMode) ? (input.captureMode as CaptureMode) : 'chat';

  return out;
}

function ensureUniqueKey(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  const k = `${base}-${i}`;
  used.add(k);
  return k;
}
