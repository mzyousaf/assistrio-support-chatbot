import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlanKey } from '../../entitlements/plan-catalog';
import {
  isBillingAddonCheckoutKey,
  isBillingPlanCheckoutKey,
  isBillingTopUpCheckoutKey,
  type BillingAddonCheckoutKey,
  type BillingProviderAdapter,
  type BillingWebhookAction,
  type BillingWebhookEvent,
  type BillingCustomerPortalResult,
  type BillingWebhookHeaders,
  type CreateAddonCheckoutInput,
  type CreateSubscriptionCheckoutInput,
  type CreateTopUpCheckoutInput,
  type GetCustomerPortalInput,
  type ProviderSubscriptionSnapshot,
  type CancelProviderSubscriptionInput,
  type ChangeProviderSubscriptionPlanInput,
  type RestoreProviderSubscriptionInput,
  BillingProviderActionError,
  type BillingOrderInvoiceDetails,
  type BillingInvoiceDownloadResult,
} from '../billing-provider.types';
import type { ProviderInvoiceRow, ProviderPaymentMethodSummary } from '../billing-invoice.types';
import { toProviderPaymentMethodSummary } from '../billing-payment-method.util';
import { extractLemonInvoiceGenerationErrorFields } from '../billing-invoice-pdf-log.util';
import {
  mapInvoiceBillingReasonDescription,
  normalizeProviderInvoiceRow,
  parseAmountCents,
  resolveLemonInvoiceUrl,
  resolveLemonSubscriptionInvoiceUrl,
  resolveLemonOrderUrls,
} from '../billing-invoice-format.util';
import {
  mapAddonKeyToVariantId,
  mapPlanKeyToVariantId,
  mapTopUpKeyToVariantId,
  resolveLemonSqueezyBillingConfig,
  variantIdToAddonCheckoutKey,
  type LemonSqueezyBillingConfig,
} from '../billing-config.util';
import { configFactory } from '../../config/config.factory';

const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';

type LemonCheckoutApiResponse = {
  data?: {
    attributes?: {
      url?: string;
    };
  };
};

type LemonSubscriptionApiResponse = {
  data?: {
    attributes?: {
      status?: string;
      customer_id?: number | string;
      variant_id?: number | string;
      created_at?: string;
      renews_at?: string;
      ends_at?: string;
      cancelled?: boolean;
      urls?: {
        customer_portal?: string | null;
      };
      first_subscription_item?: { variant_id?: number | string };
    };
  };
};

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
  };
};

function headerValue(headers: BillingWebhookHeaders, name: string): string {
  const raw = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  return String(raw ?? '').trim();
}

function stringifyCustomValue(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function buildCustomData(input: {
  workspaceId: string;
  userId: string;
  checkoutType: 'plan' | 'addon' | 'top_up';
  internalRequestId: string;
  planKey?: string;
  addonKey?: string;
  topUpKey?: string;
  targetBotId?: string;
}): Record<string, string> {
  const custom: Record<string, string> = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    checkoutType: input.checkoutType,
    internalRequestId: input.internalRequestId,
  };
  if (input.planKey) custom.planKey = input.planKey;
  if (input.addonKey) custom.addonKey = input.addonKey;
  if (input.topUpKey) custom.topUpKey = input.topUpKey;
  if (input.targetBotId) custom.targetBotId = input.targetBotId;
  return custom;
}

function parseDate(value: unknown): Date | undefined {
  const s = String(value ?? '').trim();
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseMoneyAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractLemonInvoiceFields(attrs: Record<string, unknown>): {
  invoiceId: string;
  invoiceUrl: string | null;
  amount: number | null;
  currency: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  paymentMethod: ProviderPaymentMethodSummary | null;
  failedAt: Date;
} {
  const invoiceId = stringifyCustomValue(attrs.id) || '';
  const invoiceUrl = resolveLemonInvoiceUrl(attrs);
  const amount = parseMoneyAmount(attrs.total ?? attrs.subtotal);
  const currency = stringifyCustomValue(attrs.currency) || null;
  const cardBrand = stringifyCustomValue(attrs.card_brand) || null;
  const cardLastFour = stringifyCustomValue(attrs.card_last_four) || null;
  const failedAt = parseDate(attrs.created_at) ?? new Date();

  return {
    invoiceId,
    invoiceUrl,
    amount,
    currency,
    cardBrand,
    cardLastFour,
    paymentMethod: toProviderPaymentMethodSummary({ brand: cardBrand, last4: cardLastFour }),
    failedAt,
  };
}

function mapLemonSubscriptionStatus(raw: unknown): string {
  const status = String(raw ?? '').trim().toLowerCase();
  switch (status) {
    case 'active':
      return 'active';
    case 'on_trial':
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'cancelled':
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'expired':
      return 'canceled';
    case 'paused':
      return 'past_due';
    default:
      return status || 'active';
  }
}

function planKeyFromCustomOrVariant(
  customData: Record<string, string>,
  variantId: string | undefined,
  lemonConfig?: LemonSqueezyBillingConfig,
): PlanKey | undefined {
  const fromCustom = customData.planKey?.trim();
  if (fromCustom === 'starter' || fromCustom === 'pro') return fromCustom;
  if (!variantId || !lemonConfig) return undefined;
  if (variantId === lemonConfig.variantIds.starter) return 'starter';
  if (variantId === lemonConfig.variantIds.pro) return 'pro';
  return undefined;
}

function resolveAddonKeyFromWebhook(
  custom: Record<string, string>,
  variantId: string | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null | undefined,
): BillingAddonCheckoutKey | undefined {
  if (custom.checkoutType === 'addon') {
    const fromCustom = custom.addonKey?.trim();
    if (isBillingAddonCheckoutKey(fromCustom)) return fromCustom;
  }
  return variantIdToAddonCheckoutKey(variantId, lemonConfig ?? null);
}

function buildAddonWebhookAction(input: {
  workspaceId: string;
  subscriptionId: string;
  addonKey: BillingAddonCheckoutKey;
  custom: Record<string, string>;
  attrs: Record<string, unknown>;
  normalizedEvent: string;
}): BillingWebhookAction {
  let addonStatus: 'active' | 'cancelled' | 'expired' = 'active';
  if (input.normalizedEvent === 'subscription_expired') addonStatus = 'expired';
  if (
    input.normalizedEvent === 'subscription_cancelled' ||
    input.normalizedEvent === 'subscription_canceled'
  ) {
    addonStatus = 'active';
  }

  return {
    kind: 'addon_sync',
    workspaceId: input.workspaceId,
    addonKey: input.addonKey,
    targetBotId: input.custom.targetBotId?.trim() || undefined,
    status: addonStatus,
    providerSubscriptionId: input.subscriptionId,
    currentPeriodStart: parseDate(input.attrs.created_at),
    currentPeriodEnd: parseDate(input.attrs.renews_at ?? input.attrs.ends_at),
    cancelAtPeriodEnd:
      input.normalizedEvent === 'subscription_cancelled' ||
      input.normalizedEvent === 'subscription_canceled' ||
      Boolean(input.attrs.cancelled),
  };
}

export function extractLemonInvoiceGenerationErrorReason(responseText: string): string {
  return extractLemonInvoiceGenerationErrorFields(responseText).reason;
}

@Injectable()
export class LemonSqueezyProvider implements BillingProviderAdapter {
  readonly provider = 'lemon_squeezy' as const;
  private readonly logger = new Logger(LemonSqueezyProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private getConfig(): LemonSqueezyBillingConfig {
    const config = configFactory();
    const lemon = resolveLemonSqueezyBillingConfig({
      ...config,
      lemonSqueezyApiKey: this.configService.get<string>('lemonSqueezyApiKey') ?? config.lemonSqueezyApiKey,
      lemonSqueezyStoreId: this.configService.get<string>('lemonSqueezyStoreId') ?? config.lemonSqueezyStoreId,
      lemonSqueezyWebhookSecret:
        this.configService.get<string>('lemonSqueezyWebhookSecret') ?? config.lemonSqueezyWebhookSecret,
      customerAppBaseUrl: this.configService.get<string>('customerAppBaseUrl') ?? config.customerAppBaseUrl,
      lemonSqueezyStarterVariantId:
        this.configService.get<string>('lemonSqueezyStarterVariantId') ?? config.lemonSqueezyStarterVariantId,
      lemonSqueezyProVariantId:
        this.configService.get<string>('lemonSqueezyProVariantId') ?? config.lemonSqueezyProVariantId,
      lemonSqueezyAddonExtraBotVariantId:
        this.configService.get<string>('lemonSqueezyAddonExtraBotVariantId') ??
        config.lemonSqueezyAddonExtraBotVariantId,
      lemonSqueezyAddonRemoveBrandingVariantId:
        this.configService.get<string>('lemonSqueezyAddonRemoveBrandingVariantId') ??
        config.lemonSqueezyAddonRemoveBrandingVariantId,
      lemonSqueezyTopup1000CreditsVariantId:
        this.configService.get<string>('lemonSqueezyTopup1000CreditsVariantId') ??
        config.lemonSqueezyTopup1000CreditsVariantId,
    });
    if (!lemon) {
      throw new Error('lemon_squeezy_not_configured');
    }
    return lemon;
  }

  private lemonAuthHeaders(lemon: LemonSqueezyBillingConfig, withBody = false): Record<string, string> {
    return {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${lemon.apiKey}`,
      ...(withBody ? { 'Content-Type': 'application/vnd.api+json' } : {}),
    };
  }

  private mapSubscriptionSnapshot(
    json: LemonSubscriptionApiResponse,
    lemon: LemonSqueezyBillingConfig,
  ): ProviderSubscriptionSnapshot | null {
    const attrs = json.data?.attributes ?? {};
    const firstItem = attrs.first_subscription_item as { variant_id?: unknown } | undefined;
    const variantId = stringifyCustomValue(attrs.variant_id ?? firstItem?.variant_id);
    const planKey = planKeyFromCustomOrVariant({}, variantId || undefined, lemon);

    return {
      providerCustomerId: stringifyCustomValue(attrs.customer_id) || undefined,
      providerVariantId: variantId || undefined,
      status: mapLemonSubscriptionStatus(attrs.status),
      currentPeriodStart: parseDate(attrs.created_at),
      currentPeriodEnd: parseDate(attrs.renews_at ?? attrs.ends_at),
      cancelAtPeriodEnd: Boolean(attrs.cancelled),
      planKey,
    };
  }

  private async throwProviderActionError(res: Response): Promise<never> {
    await res.text().catch(() => '');
    throw new BillingProviderActionError(
      'The billing provider could not complete this request.',
      'billing_provider_action_failed',
      res.status,
    );
  }

  private checkoutSuccessUrl(lemon: LemonSqueezyBillingConfig): string {
    const base = lemon.customerAppBaseUrl.replace(/\/$/, '');
    return `${base}/settings/billing?checkout=success`;
  }

  private async createCheckout(
    lemon: LemonSqueezyBillingConfig,
    variantId: string,
    custom: Record<string, string>,
  ): Promise<string> {
    const success = this.checkoutSuccessUrl(lemon);
    const body = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_options: {
            embed: false,
          },
          checkout_data: {
            custom,
          },
          product_options: {
            redirect_url: success,
          },
          preview: false,
        },
        relationships: {
          store: { data: { type: 'stores', id: lemon.storeId } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    };

    const res = await fetch(`${LEMON_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${lemon.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`lemon_checkout_failed:${res.status}:${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as LemonCheckoutApiResponse;
    const url = json.data?.attributes?.url?.trim();
    if (!url) {
      throw new Error('lemon_checkout_missing_url');
    }
    return url;
  }

  async createSubscriptionCheckout(input: CreateSubscriptionCheckoutInput) {
    const lemon = this.getConfig();
    const variantId = mapPlanKeyToVariantId(lemon, input.planKey);
    const custom = buildCustomData({
      workspaceId: input.workspaceId,
      userId: input.userId,
      checkoutType: 'plan',
      internalRequestId: input.internalRequestId,
      planKey: input.planKey,
    });
    const checkoutUrl = await this.createCheckout(lemon, variantId, custom);
    return { checkoutUrl, provider: this.provider };
  }

  async createAddonCheckout(input: CreateAddonCheckoutInput) {
    const lemon = this.getConfig();
    const variantId = mapAddonKeyToVariantId(lemon, input.addonKey);
    const custom = buildCustomData({
      workspaceId: input.workspaceId,
      userId: input.userId,
      checkoutType: 'addon',
      internalRequestId: input.internalRequestId,
      addonKey: input.addonKey,
      targetBotId: input.targetBotId,
    });
    const checkoutUrl = await this.createCheckout(lemon, variantId, custom);
    return { checkoutUrl, provider: this.provider };
  }

  async createTopUpCheckout(input: CreateTopUpCheckoutInput) {
    const lemon = this.getConfig();
    const variantId = mapTopUpKeyToVariantId(lemon, input.topUpKey);
    const custom = buildCustomData({
      workspaceId: input.workspaceId,
      userId: input.userId,
      checkoutType: 'top_up',
      internalRequestId: input.internalRequestId,
      topUpKey: input.topUpKey,
    });
    const checkoutUrl = await this.createCheckout(lemon, variantId, custom);
    return { checkoutUrl, provider: this.provider };
  }

  parseWebhook(rawBody: Buffer, headers: BillingWebhookHeaders): BillingWebhookEvent {
    const eventName =
      headerValue(headers, 'x-event-name') ||
      (() => {
        try {
          const parsed = JSON.parse(rawBody.toString('utf8')) as LemonWebhookPayload;
          return String(parsed.meta?.event_name ?? '').trim();
        } catch {
          return '';
        }
      })();

    let payload: LemonWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as LemonWebhookPayload;
    } catch {
      throw new UnauthorizedException({ error: 'Invalid webhook payload.' });
    }

    const dataType = String(payload.data?.type ?? '').trim();
    const dataId = String(payload.data?.id ?? '').trim();
    const providerEventId = `${eventName}:${dataType}:${dataId || 'unknown'}`;

    const customData: Record<string, string> = {};
    const rawCustom = payload.meta?.custom_data ?? {};
    for (const [k, v] of Object.entries(rawCustom)) {
      customData[k] = stringifyCustomValue(v);
    }

    return {
      provider: this.provider,
      providerEventId,
      eventName: eventName || String(payload.meta?.event_name ?? 'unknown'),
      customData,
      payload,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, headers: BillingWebhookHeaders): boolean {
    const secret = this.configService.get<string>('lemonSqueezyWebhookSecret')?.trim() ?? '';
    if (!secret) return false;

    const signature = headerValue(headers, 'x-signature');
    if (!signature) return false;

    const digest = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');
    if (digest.length !== sigBuf.length) return false;
    return timingSafeEqual(digest, sigBuf);
  }

  async mapWebhookEvent(
    event: BillingWebhookEvent,
  ): Promise<BillingWebhookAction | BillingWebhookAction[]> {
    let lemon: LemonSqueezyBillingConfig | null = null;
    try {
      lemon = this.getConfig();
    } catch {
      lemon = null;
    }

    const payload = event.payload as LemonWebhookPayload;
    const attrs = payload.data?.attributes ?? {};
    const dataType = String(payload.data?.type ?? '').trim().toLowerCase();
    const custom = event.customData;
    const workspaceId = custom.workspaceId?.trim();
    if (!workspaceId) {
      return { kind: 'ignored', reason: 'missing_workspace_id' };
    }

    const normalizedEvent = event.eventName.trim().toLowerCase().replace(/-/g, '_');

    if (normalizedEvent === 'order_created') {
      const checkoutType = custom.checkoutType?.trim();
      if (checkoutType !== 'plan' && checkoutType !== 'addon' && checkoutType !== 'top_up') {
        return { kind: 'ignored', reason: 'invalid_checkout_type' };
      }

      const orderId = String(payload.data?.id ?? '').trim();
      if (!orderId) {
        return { kind: 'ignored', reason: 'missing_order_id' };
      }

      const amountCents = parseAmountCents(attrs.total ?? attrs.total_usd ?? attrs.subtotal);
      const currency = stringifyCustomValue(attrs.currency) || 'USD';
      const status = stringifyCustomValue(attrs.status) || 'paid';
      const orderCreatedAt = parseDate(attrs.created_at) ?? new Date();
      const { invoiceUrl, receiptUrl } = resolveLemonOrderUrls(attrs);
      const providerSubscriptionId = stringifyCustomValue(attrs.subscription_id) || undefined;

      const orderRecord: BillingWebhookAction = {
        kind: 'order_record',
        workspaceId,
        providerOrderId: orderId,
        checkoutType,
        providerSubscriptionId,
        amountCents,
        currency,
        status,
        invoiceUrl,
        receiptUrl,
        orderCreatedAt,
      };

      if (checkoutType === 'plan') {
        const planKey = custom.planKey?.trim();
        if (!isBillingPlanCheckoutKey(planKey)) {
          return { kind: 'ignored', reason: 'invalid_plan_key' };
        }
        return { ...orderRecord, planKey };
      }

      if (checkoutType === 'addon') {
        const addonKey = custom.addonKey?.trim();
        if (!isBillingAddonCheckoutKey(addonKey)) {
          return { kind: 'ignored', reason: 'invalid_addon_key' };
        }
        return {
          ...orderRecord,
          addonKey,
          targetBotId: custom.targetBotId?.trim() || undefined,
        };
      }

      const topUpKey = custom.topUpKey?.trim();
      if (!isBillingTopUpCheckoutKey(topUpKey)) {
        return { kind: 'ignored', reason: 'invalid_top_up_key' };
      }

      return [
        { ...orderRecord, topUpKey },
        {
          kind: 'top_up_credit',
          workspaceId,
          topUpKey,
          providerOrderId: orderId,
          creditsPurchased: 1000,
        },
      ];
    }

    const subscriptionEvents = new Set([
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_canceled',
      'subscription_expired',
      'subscription_resumed',
      'subscription_payment_success',
      'subscription_payment_failed',
      'subscription_payment_recovered',
    ]);

    if (subscriptionEvents.has(normalizedEvent)) {
      let subscriptionId = String(payload.data?.id ?? custom.providerSubscriptionId ?? '').trim();
      if (dataType === 'subscription-invoices') {
        subscriptionId = stringifyCustomValue(attrs.subscription_id) || subscriptionId;
      }
      if (!subscriptionId) {
        return { kind: 'ignored', reason: 'missing_subscription_id' };
      }

      if (
        (normalizedEvent === 'subscription_payment_success' ||
          normalizedEvent === 'subscription_payment_recovered') &&
        dataType === 'subscription-invoices'
      ) {
        const snapshot = await this.fetchProviderSubscription(subscriptionId);
        if (!snapshot) {
          return { kind: 'ignored', reason: 'subscription_fetch_failed' };
        }
        const customPlanKey = custom.planKey?.trim() ?? '';
        const planKey =
          planKeyFromCustomOrVariant(custom, snapshot.providerVariantId, lemon ?? undefined) ??
          (isBillingPlanCheckoutKey(customPlanKey) ? customPlanKey : undefined);

        const invoiceFields =
          dataType === 'subscription-invoices' ? extractLemonInvoiceFields(attrs) : null;

        const addonKey = resolveAddonKeyFromWebhook(
          custom,
          snapshot.providerVariantId,
          lemon ?? undefined,
        );
        if (addonKey) {
          return buildAddonWebhookAction({
            workspaceId,
            subscriptionId,
            addonKey,
            custom,
            attrs,
            normalizedEvent,
          });
        }

        return {
          kind: 'subscription_sync',
          workspaceId,
          planKey,
          providerCustomerId: snapshot.providerCustomerId,
          providerSubscriptionId: subscriptionId,
          providerVariantId: snapshot.providerVariantId,
          status: 'active',
          currentPeriodStart: snapshot.currentPeriodStart,
          currentPeriodEnd: snapshot.currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(snapshot.cancelAtPeriodEnd),
          clearPaymentFailure: true,
          paymentMethod: invoiceFields?.paymentMethod ?? undefined,
        };
      }

      const firstItem = attrs.first_subscription_item as { variant_id?: unknown } | undefined;
      const variantId = stringifyCustomValue(attrs.variant_id ?? firstItem?.variant_id);
      const planKey = planKeyFromCustomOrVariant(custom, variantId || undefined, lemon ?? undefined);

      let status = mapLemonSubscriptionStatus(attrs.status);
      if (normalizedEvent === 'subscription_expired' || normalizedEvent === 'subscription_cancelled' || normalizedEvent === 'subscription_canceled') {
        status = 'canceled';
      }
      if (normalizedEvent === 'subscription_payment_failed') {
        status = 'past_due';
      }
      if (
        normalizedEvent === 'subscription_payment_success' ||
        normalizedEvent === 'subscription_payment_recovered' ||
        normalizedEvent === 'subscription_resumed'
      ) {
        status = 'active';
      }

      const cancelAtPeriodEnd =
        Boolean(attrs.cancelled) ||
        Boolean(attrs.cancelled_at) ||
        normalizedEvent === 'subscription_cancelled' ||
        normalizedEvent === 'subscription_canceled';

      const invoiceIdFromPayload = String(payload.data?.id ?? '').trim();
      const invoiceFields =
        dataType === 'subscription-invoices'
          ? extractLemonInvoiceFields({
              ...attrs,
              id: invoiceIdFromPayload || attrs.id,
            })
          : null;

      const subscriptionAction: BillingWebhookAction = {
        kind: 'subscription_sync',
        workspaceId,
        planKey,
        providerCustomerId: stringifyCustomValue(attrs.customer_id) || undefined,
        providerSubscriptionId: subscriptionId,
        providerVariantId: variantId || undefined,
        status,
        currentPeriodStart: parseDate(attrs.created_at ?? attrs.billing_anchor),
        currentPeriodEnd: parseDate(attrs.renews_at ?? attrs.ends_at),
        cancelAtPeriodEnd,
        ...(normalizedEvent === 'subscription_payment_failed'
          ? {
              paymentFailure: {
                failedAt: invoiceFields?.failedAt ?? new Date(),
                invoiceId: invoiceFields?.invoiceId || null,
                invoiceUrl: invoiceFields?.invoiceUrl ?? null,
                amount: invoiceFields?.amount ?? null,
                currency: invoiceFields?.currency ?? null,
                cardBrand: invoiceFields?.cardBrand ?? null,
                cardLastFour: invoiceFields?.cardLastFour ?? null,
              },
              paymentMethod: invoiceFields?.paymentMethod ?? undefined,
            }
          : {}),
        ...(status === 'active' &&
        (normalizedEvent === 'subscription_payment_success' ||
          normalizedEvent === 'subscription_payment_recovered' ||
          normalizedEvent === 'subscription_resumed')
          ? {
              clearPaymentFailure: true,
              paymentMethod: invoiceFields?.paymentMethod ?? undefined,
            }
          : {}),
      };

      const addonKey = resolveAddonKeyFromWebhook(custom, variantId || undefined, lemon ?? undefined);
      if (addonKey) {
        return buildAddonWebhookAction({
          workspaceId,
          subscriptionId,
          addonKey,
          custom,
          attrs,
          normalizedEvent,
        });
      }

      if (custom.checkoutType === 'addon') {
        return { kind: 'ignored', reason: 'invalid_addon_key' };
      }

      return subscriptionAction;
    }

    return { kind: 'ignored', reason: `unhandled_event:${normalizedEvent}` };
  }

  async fetchProviderSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionSnapshot | null> {
    const subscriptionId = String(providerSubscriptionId ?? '').trim();
    if (!subscriptionId) return null;

    let lemon: LemonSqueezyBillingConfig;
    try {
      lemon = this.getConfig();
    } catch {
      return null;
    }

    const res = await fetch(`${LEMON_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'GET',
      headers: this.lemonAuthHeaders(lemon),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as LemonSubscriptionApiResponse;
    return this.mapSubscriptionSnapshot(json, lemon);
  }

  async listCustomerPlanSubscriptions(
    providerCustomerId: string,
  ): Promise<Array<{ providerSubscriptionId: string; planKey?: PlanKey; providerVariantId?: string }>> {
    const customerId = String(providerCustomerId ?? '').trim();
    if (!customerId) return [];

    let lemon: LemonSqueezyBillingConfig;
    try {
      lemon = this.getConfig();
    } catch {
      return [];
    }

    const url = new URL(`${LEMON_API_BASE}/subscriptions`);
    url.searchParams.set('filter[customer_id]', customerId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.lemonAuthHeaders(lemon),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: Array<{ id?: string; attributes?: Record<string, unknown> }>;
    };

    const results: Array<{
      providerSubscriptionId: string;
      planKey?: PlanKey;
      providerVariantId?: string;
    }> = [];

    for (const row of json.data ?? []) {
      const subscriptionId = stringifyCustomValue(row.id);
      if (!subscriptionId) continue;

      const attrs = row.attributes ?? {};
      const firstItem = attrs.first_subscription_item as { variant_id?: unknown } | undefined;
      const variantId = stringifyCustomValue(attrs.variant_id ?? firstItem?.variant_id);
      const planKey = planKeyFromCustomOrVariant({}, variantId || undefined, lemon);
      if (planKey !== 'starter' && planKey !== 'pro') continue;

      results.push({
        providerSubscriptionId: subscriptionId,
        planKey,
        providerVariantId: variantId || undefined,
      });
    }

    return results;
  }

  async cancelSubscription(input: CancelProviderSubscriptionInput): Promise<ProviderSubscriptionSnapshot> {
    const lemon = this.getConfig();
    const subscriptionId = String(input.providerSubscriptionId ?? '').trim();
    if (!subscriptionId) {
      throw new BillingProviderActionError(
        'Provider subscription id is required.',
        'billing_provider_action_failed',
      );
    }

    const res = await fetch(`${LEMON_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      headers: this.lemonAuthHeaders(lemon),
    });

    if (!res.ok) {
      await this.throwProviderActionError(res);
    }

    const json = (await res.json()) as LemonSubscriptionApiResponse;
    const snapshot = this.mapSubscriptionSnapshot(json, lemon);
    if (!snapshot) {
      throw new BillingProviderActionError(
        'Could not read subscription after cancellation.',
        'billing_provider_action_failed',
      );
    }
    return snapshot;
  }

  async restoreSubscription(
    input: RestoreProviderSubscriptionInput,
  ): Promise<ProviderSubscriptionSnapshot> {
    const lemon = this.getConfig();
    const subscriptionId = String(input.providerSubscriptionId ?? '').trim();
    if (!subscriptionId) {
      throw new BillingProviderActionError(
        'Provider subscription id is required.',
        'billing_provider_action_failed',
      );
    }

    const body = {
      data: {
        type: 'subscriptions',
        id: subscriptionId,
        attributes: {
          cancelled: false,
        },
      },
    };

    const res = await fetch(`${LEMON_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'PATCH',
      headers: this.lemonAuthHeaders(lemon, true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.throwProviderActionError(res);
    }

    const json = (await res.json()) as LemonSubscriptionApiResponse;
    const snapshot = this.mapSubscriptionSnapshot(json, lemon);
    if (!snapshot) {
      throw new BillingProviderActionError(
        'Could not read subscription after restore.',
        'billing_provider_action_failed',
      );
    }
    return { ...snapshot, cancelAtPeriodEnd: false };
  }

  async changeSubscriptionPlan(
    input: ChangeProviderSubscriptionPlanInput,
  ): Promise<ProviderSubscriptionSnapshot> {
    const lemon = this.getConfig();
    const subscriptionId = String(input.providerSubscriptionId ?? '').trim();
    if (!subscriptionId) {
      throw new BillingProviderActionError(
        'Provider subscription id is required.',
        'billing_provider_action_failed',
      );
    }

    const variantId = mapPlanKeyToVariantId(lemon, input.planKey);
    const body = {
      data: {
        type: 'subscriptions',
        id: subscriptionId,
        attributes: {
          variant_id: Number(variantId) || variantId,
          disable_prorations: Boolean(input.disableProrations),
        },
      },
    };

    const res = await fetch(`${LEMON_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'PATCH',
      headers: this.lemonAuthHeaders(lemon, true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.throwProviderActionError(res);
    }

    const json = (await res.json()) as LemonSubscriptionApiResponse;
    const snapshot = this.mapSubscriptionSnapshot(json, lemon);
    if (!snapshot) {
      throw new BillingProviderActionError(
        'Could not read subscription after plan change.',
        'billing_provider_action_failed',
      );
    }
    return snapshot;
  }

  async getCustomerPortalUrl(input: GetCustomerPortalInput): Promise<BillingCustomerPortalResult | null> {
    const subscriptionId = String(input.providerSubscriptionId ?? '').trim();
    if (!subscriptionId) return null;

    const lemon = this.getConfig();
    const res = await fetch(`${LEMON_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${lemon.apiKey}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as LemonSubscriptionApiResponse;
    const url = json.data?.attributes?.urls?.customer_portal?.trim();
    if (!url) return null;

    return { url, provider: this.provider };
  }

  async listSubscriptionInvoices(
    providerSubscriptionId: string,
    options?: { planKey?: string },
  ): Promise<ProviderInvoiceRow[]> {
    const subscriptionId = String(providerSubscriptionId ?? '').trim();
    if (!subscriptionId) return [];

    let lemon: LemonSqueezyBillingConfig;
    try {
      lemon = this.getConfig();
    } catch {
      return [];
    }

    const url = new URL(`${LEMON_API_BASE}/subscription-invoices`);
    url.searchParams.set('filter[subscription_id]', subscriptionId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${lemon.apiKey}`,
      },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        attributes?: Record<string, unknown>;
      }>;
    };

    const planKey = options?.planKey ?? null;

    return (json.data ?? []).map((row) => {
      const attrs = row.attributes ?? {};
      const amountCents = parseAmountCents(attrs.total ?? attrs.subtotal);
      const currency = stringifyCustomValue(attrs.currency) || 'USD';
      const createdAt = parseDate(attrs.created_at);
      const billingReason = stringifyCustomValue(attrs.billing_reason);
      const status = stringifyCustomValue(attrs.status) || 'unknown';
      const variantId =
        stringifyCustomValue(attrs.variant_id) ||
        stringifyCustomValue(
          (attrs.first_subscription_item as { variant_id?: unknown } | undefined)?.variant_id,
        );
      const subscriptionId = stringifyCustomValue(attrs.subscription_id);

      const normalized = normalizeProviderInvoiceRow({
        id: stringifyCustomValue(row.id) || stringifyCustomValue(attrs.id),
        provider: this.provider,
        date: (createdAt ?? new Date()).toISOString(),
        amountCents,
        currency,
        status,
        invoiceUrl: resolveLemonSubscriptionInvoiceUrl(attrs),
        receiptUrl: null,
        description: mapInvoiceBillingReasonDescription(billingReason, planKey),
      });

      return {
        ...normalized,
        billingReason: billingReason || undefined,
        providerSubscriptionId: subscriptionId || null,
        providerVariantId: variantId || null,
        providerOrderId: stringifyCustomValue(attrs.order_id) || null,
        source: 'lemon_subscription_invoice',
      };
    });
  }

  async fetchOrderInvoice(providerOrderId: string): Promise<ProviderInvoiceRow | null> {
    const orderId = String(providerOrderId ?? '').trim();
    if (!orderId) return null;

    let lemon: LemonSqueezyBillingConfig;
    try {
      lemon = this.getConfig();
    } catch {
      return null;
    }

    const res = await fetch(`${LEMON_API_BASE}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${lemon.apiKey}`,
      },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: {
        id?: string;
        attributes?: Record<string, unknown>;
      };
    };

    const attrs = json.data?.attributes ?? {};
    const amountCents = parseAmountCents(attrs.total ?? attrs.subtotal);
    const currency = stringifyCustomValue(attrs.currency) || 'USD';
    const createdAt = parseDate(attrs.created_at);
    const status = stringifyCustomValue(attrs.status) || 'paid';
    const variantId = stringifyCustomValue(
      (attrs.first_order_item as { variant_id?: unknown } | undefined)?.variant_id ??
        attrs.variant_id,
    );
    const { invoiceUrl, receiptUrl } = resolveLemonOrderUrls(attrs);

    const normalized = normalizeProviderInvoiceRow({
      id: stringifyCustomValue(json.data?.id) || orderId,
      provider: this.provider,
      date: (createdAt ?? new Date()).toISOString(),
      amountCents,
      currency,
      status,
      invoiceUrl,
      receiptUrl,
      description: '1,000 AI credits top-up',
    });

    return {
      ...normalized,
      providerOrderId: orderId,
      providerVariantId: variantId || null,
      providerSubscriptionId: null,
      source: 'lemon_order',
    };
  }

  async generateOrderInvoice(
    providerOrderId: string,
    details: BillingOrderInvoiceDetails,
    options?: { requestId?: string },
  ): Promise<BillingInvoiceDownloadResult> {
    const orderId = String(providerOrderId ?? '').trim();
    if (!orderId) {
      throw new BillingProviderActionError(
        'Provider order id is required.',
        'billing_provider_action_failed',
      );
    }

    let lemon: LemonSqueezyBillingConfig;
    try {
      lemon = this.getConfig();
    } catch {
      throw new BillingProviderActionError(
        'Billing provider is not configured.',
        'billing_provider_not_configured',
      );
    }

    this.logger.debug(
      JSON.stringify({
        event: 'lemon_generate_order_invoice_request',
        requestId: options?.requestId,
        providerOrderId: orderId,
        country: details.country,
        hasState: Boolean(details.state?.trim()),
        hasZipCode: Boolean(details.zipCode?.trim()),
        hasName: Boolean(details.name?.trim()),
        hasAddress: Boolean(details.address?.trim()),
        hasCity: Boolean(details.city?.trim()),
      }),
    );

    const params = new URLSearchParams({
      name: details.name,
      address: details.address,
      city: details.city,
      zip_code: details.zipCode,
      country: details.country,
    });
    if (details.state?.trim()) params.set('state', details.state.trim());
    if (details.notes?.trim()) params.set('notes', details.notes.trim());
    if (details.locale?.trim()) params.set('locale', details.locale.trim());

    const url = `${LEMON_API_BASE}/orders/${encodeURIComponent(orderId)}/generate-invoice?${params.toString()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${lemon.apiKey}`,
      },
    });

    if (!res.ok) {
      const responseText = await res.text();
      const lemonError = extractLemonInvoiceGenerationErrorFields(responseText);
      this.logger.warn(
        JSON.stringify({
          event: 'lemon_generate_order_invoice_response',
          requestId: options?.requestId,
          providerOrderId: orderId,
          status: res.status,
          hasDownloadInvoiceUrl: false,
          lemonErrorTitle: lemonError.lemonErrorTitle,
          lemonErrorDetail: lemonError.lemonErrorDetail,
        }),
      );
      throw new BillingProviderActionError(
        lemonError.reason,
        'billing_invoice_generation_failed',
        res.status,
      );
    }

    const json = (await res.json()) as {
      meta?: {
        urls?: {
          download_invoice?: string;
        };
      };
    };

    const downloadUrl = stringifyCustomValue(json.meta?.urls?.download_invoice);
    this.logger.debug(
      JSON.stringify({
        event: 'lemon_generate_order_invoice_response',
        requestId: options?.requestId,
        providerOrderId: orderId,
        status: res.status,
        hasDownloadInvoiceUrl: Boolean(downloadUrl),
      }),
    );

    if (!downloadUrl) {
      throw new BillingProviderActionError(
        'Order invoice download URL was not returned.',
        'billing_provider_action_failed',
      );
    }

    return { downloadUrl };
  }
}

/** Exported for unit tests — builds checkout custom payload shape. */
export function buildLemonCheckoutCustomDataForTest(input: Parameters<typeof buildCustomData>[0]) {
  return buildCustomData(input);
}
