import type { ProviderInvoiceRow } from './billing-invoice.types';
import { formatInvoiceAmountFormatted } from './billing-invoice-format.util';
import {
  mapInvoiceItemDescription,
  resolveInvoiceItemName,
  resolveInvoiceItemType,
  type InvoiceItemMatch,
} from './billing-invoice-item.util';

export type StoredBillingOrderRow = {
  providerOrderId: string;
  checkoutType: 'plan' | 'addon' | 'top_up';
  planKey?: string | null;
  addonKey?: string | null;
  topUpKey?: string | null;
  providerSubscriptionId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
  orderCreatedAt: Date;
};

export function resolveStoredOrderItemMatch(order: StoredBillingOrderRow): InvoiceItemMatch {
  let itemKey: string | undefined;

  if (order.checkoutType === 'top_up') {
    itemKey = order.topUpKey?.trim() || 'ai_credits_1000';
  } else if (order.checkoutType === 'plan') {
    itemKey = order.planKey?.trim() || undefined;
  } else if (order.checkoutType === 'addon') {
    itemKey = order.addonKey?.trim() || undefined;
  }

  return {
    itemType: resolveInvoiceItemType(itemKey),
    itemKey,
    itemName: resolveInvoiceItemName(itemKey),
    description: mapInvoiceItemDescription({
      itemKey,
      billingReason: order.checkoutType === 'plan' ? 'initial' : null,
    }),
  };
}

export function storedBillingOrderToProviderRow(order: StoredBillingOrderRow): ProviderInvoiceRow {
  const match = resolveStoredOrderItemMatch(order);
  const hasUrl = Boolean(order.invoiceUrl?.trim() || order.receiptUrl?.trim());

  return {
    id: order.providerOrderId,
    provider: 'lemon_squeezy',
    date: order.orderCreatedAt.toISOString(),
    amountCents: order.amountCents,
    amount: order.amountCents / 100,
    amountFormatted: formatInvoiceAmountFormatted(order.amountCents, order.currency),
    currency: order.currency,
    status: order.status,
    invoiceUrl: order.invoiceUrl?.trim() || null,
    receiptUrl: order.receiptUrl?.trim() || null,
    description: match.description,
    itemType: match.itemType,
    itemKey: match.itemKey,
    itemName: match.itemName,
    providerOrderId: order.providerOrderId,
    providerSubscriptionId: order.providerSubscriptionId?.trim() || null,
    source: hasUrl ? 'lemon_order' : order.checkoutType === 'top_up' ? 'local_top_up' : 'lemon_order',
  };
}

export function shouldSkipStoredOrderForSubscriptionInvoice(input: {
  order: StoredBillingOrderRow;
  subscriptionInvoices: ProviderInvoiceRow[];
  planSubscriptionId: string;
  addonKeyBySubscriptionId: Map<string, string>;
}): boolean {
  const orderId = String(input.order.providerOrderId ?? '').trim();
  if (!orderId) return true;

  if (input.subscriptionInvoices.some((row) => String(row.providerOrderId ?? '').trim() === orderId)) {
    return true;
  }

  if (input.order.checkoutType === 'top_up') {
    return false;
  }

  if (input.order.checkoutType === 'plan') {
    const planSubId = String(input.planSubscriptionId ?? '').trim();
    if (!planSubId) return false;

    const planInvoices = input.subscriptionInvoices.filter(
      (row) => String(row.providerSubscriptionId ?? '').trim() === planSubId,
    );
    if (planInvoices.length === 0) return false;

    if (planInvoices.some((row) => String(row.providerOrderId ?? '').trim() === orderId)) {
      return true;
    }

    return planInvoices.some(
      (row) => String(row.billingReason ?? '').trim().toLowerCase() === 'initial',
    );
  }

  if (input.order.checkoutType === 'addon') {
    const orderSubId = String(input.order.providerSubscriptionId ?? '').trim();
    const addonKey = String(input.order.addonKey ?? '').trim();
    const matchingSubIds = new Set<string>();

    if (orderSubId) matchingSubIds.add(orderSubId);
    if (addonKey) {
      for (const [subId, key] of input.addonKeyBySubscriptionId.entries()) {
        if (key === addonKey) matchingSubIds.add(subId);
      }
    }

    const addonInvoices = input.subscriptionInvoices.filter((row) =>
      matchingSubIds.has(String(row.providerSubscriptionId ?? '').trim()),
    );
    if (addonInvoices.length === 0) return false;

    if (addonInvoices.some((row) => String(row.providerOrderId ?? '').trim() === orderId)) {
      return true;
    }

    return addonInvoices.some(
      (row) => String(row.billingReason ?? '').trim().toLowerCase() === 'initial',
    );
  }

  return false;
}
