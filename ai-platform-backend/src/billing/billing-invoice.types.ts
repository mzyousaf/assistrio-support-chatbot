export type ProviderPaymentMethodSummary = {
  brand?: string;
  last4?: string;
  label?: string;
};

export type ProviderInvoiceRow = {
  id: string;
  provider: 'lemon_squeezy' | 'stripe_future';
  date: string;
  /** Dollar amount for legacy consumers (amountCents / 100). */
  amount: number;
  amountCents: number;
  amountFormatted: string;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  description: string;
  itemType?: 'plan' | 'addon' | 'top_up' | 'unknown';
  itemKey?: string;
  itemName?: string;
  billingReason?: string;
  providerSubscriptionId?: string | null;
  providerVariantId?: string | null;
  providerOrderId?: string | null;
  source?: 'lemon_subscription_invoice' | 'lemon_order' | 'local_top_up';
  billingKind?: 'subscription_invoice' | 'order';
  requiresBillingDetails?: boolean;
  /** Lemon-hosted invoice/receipt page when available; not used for app PDF download. */
  officialInvoiceUrl?: string | null;
  /** How the invoice action should behave in the customer app. */
  invoiceDeliveryMode?: 'provider_url' | 'direct_pdf' | 'local_pdf';
};

export type SubscriptionPaymentFailureMetadata = {
  failedAt: Date;
  invoiceId?: string | null;
  invoiceUrl?: string | null;
  amount?: number | null;
  currency?: string | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  notifiedWebhookEventId?: string | null;
};
