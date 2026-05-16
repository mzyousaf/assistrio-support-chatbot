/** ISO 3166-1 alpha-2 codes used when `Intl.supportedValuesOf` is unavailable (e.g. some test envs). */
const FALLBACK_ALPHA2_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
] as const;

function normalizeCountryCode(raw: string | undefined | null): string | null {
  const u = raw?.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return u && u.length === 2 ? u : null;
}

let cachedBase: { code: string; name: string }[] | null = null;

function listAlpha2Codes(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === 'function') {
      const codes = fn.call(Intl, 'region');
      const alpha2 = codes.filter((c) => /^[A-Z]{2}$/.test(c));
      if (alpha2.length > 50) return alpha2;
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_ALPHA2_CODES];
}

function buildBaseCountryOptions(): { code: string; name: string }[] {
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const codes = listAlpha2Codes();
  const out: { code: string; name: string }[] = [];
  for (const code of codes) {
    try {
      const name = dn.of(code);
      if (name && name !== code) out.push({ code, name });
      else out.push({ code, name: code });
    } catch {
      out.push({ code, name: code });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return out;
}

function getBaseCountryOptions(): { code: string; name: string }[] {
  if (!cachedBase) cachedBase = buildBaseCountryOptions();
  return cachedBase;
}

function labelForExtraCode(dn: Intl.DisplayNames, code: string): string {
  try {
    const n = dn.of(code);
    if (n && n !== code) return `${n} (${code})`;
  } catch {
    /* ignore */
  }
  return `Country code ${code}`;
}

/** Display like `United States (US)` for chips, capsule value, and location fallback. */
export function formatCountryCodeWithNameLabel(raw: string | undefined | null): string {
  const c = normalizeCountryCode(raw);
  if (!c) return '';
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  return labelForExtraCode(dn, c);
}

/** Sorted `{ code, name }[]` for filter UI: all ISO alpha-2 regions we can resolve, plus any extra 2-letter codes (e.g. from loaded leads). */
export function getLeadsFilterCountryOptions(extraCodes?: Iterable<string>): { code: string; name: string }[] {
  const base = getBaseCountryOptions();
  const map = new Map(base.map((o) => [o.code, o.name]));
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });

  for (const raw of extraCodes ?? []) {
    const c = normalizeCountryCode(raw);
    if (!c || map.has(c)) continue;
    map.set(c, labelForExtraCode(dn, c));
  }

  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
