import type { BillingOrderInvoiceDetails } from './billing-invoice-download.types';

export type ParseOrderInvoiceDetailsLogContext = {
  requestId?: string;
  billingItemId?: string;
  log?: (payload: Record<string, unknown>) => void;
};

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC',
]);

const US_STATE_NAMES = new Map<string, string>([
  ['ALABAMA', 'AL'],
  ['ALASKA', 'AK'],
  ['ARIZONA', 'AZ'],
  ['ARKANSAS', 'AR'],
  ['CALIFORNIA', 'CA'],
  ['COLORADO', 'CO'],
  ['CONNECTICUT', 'CT'],
  ['DELAWARE', 'DE'],
  ['FLORIDA', 'FL'],
  ['GEORGIA', 'GA'],
  ['HAWAII', 'HI'],
  ['IDAHO', 'ID'],
  ['ILLINOIS', 'IL'],
  ['INDIANA', 'IN'],
  ['IOWA', 'IA'],
  ['KANSAS', 'KS'],
  ['KENTUCKY', 'KY'],
  ['LOUISIANA', 'LA'],
  ['MAINE', 'ME'],
  ['MARYLAND', 'MD'],
  ['MASSACHUSETTS', 'MA'],
  ['MICHIGAN', 'MI'],
  ['MINNESOTA', 'MN'],
  ['MISSISSIPPI', 'MS'],
  ['MISSOURI', 'MO'],
  ['MONTANA', 'MT'],
  ['NEBRASKA', 'NE'],
  ['NEVADA', 'NV'],
  ['NEW HAMPSHIRE', 'NH'],
  ['NEW JERSEY', 'NJ'],
  ['NEW MEXICO', 'NM'],
  ['NEW YORK', 'NY'],
  ['NORTH CAROLINA', 'NC'],
  ['NORTH DAKOTA', 'ND'],
  ['OHIO', 'OH'],
  ['OKLAHOMA', 'OK'],
  ['OREGON', 'OR'],
  ['PENNSYLVANIA', 'PA'],
  ['RHODE ISLAND', 'RI'],
  ['SOUTH CAROLINA', 'SC'],
  ['SOUTH DAKOTA', 'SD'],
  ['TENNESSEE', 'TN'],
  ['TEXAS', 'TX'],
  ['UTAH', 'UT'],
  ['VERMONT', 'VT'],
  ['VIRGINIA', 'VA'],
  ['WASHINGTON', 'WA'],
  ['WEST VIRGINIA', 'WV'],
  ['WISCONSIN', 'WI'],
  ['WYOMING', 'WY'],
  ['DISTRICT OF COLUMBIA', 'DC'],
]);

const CA_PROVINCE_CODES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

export function normalizeUsStateCode(state: string): string | null {
  const trimmed = String(state ?? '').trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (US_STATE_CODES.has(upper)) return upper;
  return US_STATE_NAMES.get(upper) ?? null;
}

export function isCompleteOrderInvoiceDetails(
  details: Partial<BillingOrderInvoiceDetails> | null | undefined,
): details is BillingOrderInvoiceDetails {
  const name = String(details?.name ?? '').trim();
  const address = String(details?.address ?? '').trim();
  const city = String(details?.city ?? '').trim();
  const zipCode = String(details?.zipCode ?? '').trim();
  const country = String(details?.country ?? '').trim().toUpperCase();

  if (!name || !address || !city || !zipCode || !country) {
    return false;
  }

  if ((country === 'US' || country === 'CA') && !String(details?.state ?? '').trim()) {
    return false;
  }

  return true;
}

export function validateOrderInvoiceAddressRules(details: BillingOrderInvoiceDetails): string | null {
  if (details.country === 'US') {
    const stateCode = normalizeUsStateCode(details.state ?? '');
    if (!stateCode) {
      return 'For United States addresses, use a valid US state code (e.g. CA, NY).';
    }
  }

  if (details.country === 'CA') {
    const province = String(details.state ?? '').trim().toUpperCase();
    if (!CA_PROVINCE_CODES.has(province)) {
      return 'For Canada addresses, use a valid province or territory code (e.g. ON, BC).';
    }
  }

  return null;
}

export function normalizeOrderInvoiceDetails(
  input: Partial<BillingOrderInvoiceDetails> | null | undefined,
): BillingOrderInvoiceDetails | null {
  if (!isCompleteOrderInvoiceDetails(input)) return null;

  const country = input.country.trim().toUpperCase();
  let state = input.state?.trim() || undefined;
  if (country === 'US' && state) {
    state = normalizeUsStateCode(state) ?? state.toUpperCase();
  } else if (country === 'CA' && state) {
    state = state.toUpperCase();
  }

  return {
    name: input.name.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state,
    zipCode: input.zipCode.trim(),
    country,
    notes: input.notes?.trim() || undefined,
    locale: input.locale?.trim() || undefined,
  };
}

export type ParsedOrderInvoiceDetails =
  | { ok: true; details: BillingOrderInvoiceDetails }
  | {
      ok: false;
      errorCode: 'billing_invoice_details_required' | 'billing_invoice_details_invalid';
      message: string;
    };

export function parseOrderInvoiceDetails(
  input: Partial<BillingOrderInvoiceDetails> | null | undefined,
  logContext?: ParseOrderInvoiceDetailsLogContext,
): ParsedOrderInvoiceDetails {
  const countryRaw = String(input?.country ?? '').trim().toUpperCase();
  const stateRequired = countryRaw === 'US' || countryRaw === 'CA';

  let parsed: ParsedOrderInvoiceDetails;

  if (!isCompleteOrderInvoiceDetails(input)) {
    parsed = {
      ok: false,
      errorCode: 'billing_invoice_details_required',
      message: 'Billing details are required to generate this invoice.',
    };
  } else {
    const details = normalizeOrderInvoiceDetails(input);
    if (!details) {
      parsed = {
        ok: false,
        errorCode: 'billing_invoice_details_required',
        message: 'Billing details are required to generate this invoice.',
      };
    } else {
      const addressError = validateOrderInvoiceAddressRules(details);
      if (addressError) {
        parsed = {
          ok: false,
          errorCode: 'billing_invoice_details_invalid',
          message: addressError,
        };
      } else {
        parsed = { ok: true, details };
      }
    }
  }

  logContext?.log?.({
    event: 'billing_invoice_details_parsed',
    requestId: logContext.requestId,
    billingItemId: logContext.billingItemId,
    country: countryRaw || undefined,
    stateProvided: Boolean(input?.state?.trim()),
    zipCodePresent: Boolean(input?.zipCode?.trim()),
    stateRequired,
    valid: parsed.ok,
    validationErrorCode: parsed.ok ? undefined : parsed.errorCode,
  });

  return parsed;
}
