import type { ProviderPaymentMethodSummary } from './billing-invoice.types';

export function buildPaymentMethodLabel(
  brand?: string | null,
  last4?: string | null,
): string | undefined {
  const b = String(brand ?? '').trim();
  const four = String(last4 ?? '').trim();
  if (!b && !four) return undefined;
  const brandLabel = b
    ? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase()
    : 'Card';
  if (four) return `${brandLabel} ending in ${four}`;
  return brandLabel;
}

export function toProviderPaymentMethodSummary(input: {
  brand?: string | null;
  last4?: string | null;
}): ProviderPaymentMethodSummary | null {
  const brand = String(input.brand ?? '').trim() || undefined;
  const last4 = String(input.last4 ?? '').trim() || undefined;
  const label = buildPaymentMethodLabel(brand, last4);
  if (!brand && !last4 && !label) return null;
  return { brand, last4, label };
}

export function toCustomerSafePaymentMethod(
  method:
    | ProviderPaymentMethodSummary
    | { brand?: string | null; last4?: string | null; label?: string | null }
    | null
    | undefined,
): ProviderPaymentMethodSummary | null {
  if (!method) return null;
  const brand = method.brand?.trim() || undefined;
  const last4 = method.last4?.trim() || undefined;
  if (!brand && !last4) return method.label ? { label: method.label } : null;
  const label = method.label?.trim() || buildPaymentMethodLabel(brand, last4);
  return { brand, last4, label };
}
