import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceSubscription } from '../models/workspace-subscription.schema';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { WorkspaceCreditTopUp } from '../models/workspace-credit-top-up.schema';
import { WorkspaceBillingOrder } from '../models/workspace-billing-order.schema';
import { Workspace } from '../models/workspace.schema';
import { User } from '../models/user.schema';
import { BillingProviderService } from './billing-provider.service';
import { BillingProfileService } from './billing-profile.service';
import type { ProviderInvoiceRow } from './billing-invoice.types';
import type { BillingOrderInvoiceDetails, BillingInvoiceDownloadResult, BillingInvoicePdfRequestContext, BillingInvoicePdfResolveResult } from './billing-invoice-download.types';
import type { WorkspaceBillingProfileInput } from './billing-profile.types';
import type { InvoiceFetchHint } from './billing-invoice-item.util';
import {
  buildSubscriptionInvoiceRowId,
  enrichInvoiceRow,
  attachInvoiceBillingInterval,
  resolveInvoiceItemMatch,
} from './billing-invoice-item.util';
import {
  shouldSkipStoredOrderForSubscriptionInvoice,
  storedBillingOrderToProviderRow,
  type StoredBillingOrderRow,
} from './billing-invoice-order.util';
import { parseOrderInvoiceDetails } from './billing-invoice-download.util';
import {
  buildLocalBillingPdfFilename,
  generateLocalBillingPdf,
  type LocalBillingPdfContext,
} from './billing-local-pdf.util';
import {
  resolveBillingInvoiceDeliveryMode,
  resolveOrderDirectPdfUrl,
  resolveProviderDirectPdfUrl,
  resolveProviderHostedInvoiceUrl,
} from './billing-invoice-provider-url.util';
import {
  buildBillingInvoicePdfFilename,
  fetchRemoteInvoicePdf,
} from './billing-invoice-pdf.util';
import { BillingProviderActionError } from './billing-provider.types';
import {
  BILLING_HISTORY_CSV_FILENAME,
  buildBillingHistoryCsv,
} from './billing-history-csv.util';
import { formatInvoiceAmountFormatted } from './billing-invoice-format.util';
import { resolveLemonSqueezyBillingConfig } from './billing-config.util';
import { configFactory } from '../config/config.factory';
import { WORKSPACE_ADDON_CATALOG, isLegacyKbAddonKey } from '../entitlements/addon-catalog';
import {
  resolveMainPlanProviderSubscriptionId,
  shouldFetchMainPlanInvoices,
  type MainPlanSubscriptionIdSource,
} from './billing-invoice-main-subscription.util';
import type { PlanKey } from '../entitlements/plan-catalog';

export type BillingInvoiceFetchDebug = {
  hasMainSubscription: boolean;
  mainProviderSubscriptionId: string | null;
  mainPlanKey: string | null;
  mainInvoiceFetchCount: number;
  addonSubscriptionCount: number;
  addonInvoiceFetchCount: number;
  mainSubscriptionIdSource: MainPlanSubscriptionIdSource;
  mainFetchSkippedReason?: string;
};

const RECURRING_ADDON_KEYS = new Set(['extra_bot', 'remove_branding']);

const RECURRING_ADDON_INVOICE_STATUSES = new Set(['active', 'cancelled']);

type TaggedProviderInvoiceRow = ProviderInvoiceRow & {
  fetchHint?: InvoiceFetchHint;
};

type WorkspaceBillingContext = {
  workspaceId: string;
  planSubscriptionId: string;
  planKey: PlanKey;
  addonKeyBySubscriptionId: Map<string, string>;
  topUpOrderIds: Set<string>;
  lemonConfig: ReturnType<typeof resolveLemonSqueezyBillingConfig>;
  subscriptionInvoiceRows: TaggedProviderInvoiceRow[];
  invoiceFetchDebug: BillingInvoiceFetchDebug;
};

@Injectable()
export class BillingInvoicesService {
  private readonly logger = new Logger(BillingInvoicesService.name);

  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    @InjectModel(WorkspaceCreditTopUp.name)
    private readonly topUpModel: Model<WorkspaceCreditTopUp>,
    @InjectModel(WorkspaceBillingOrder.name)
    private readonly billingOrderModel: Model<WorkspaceBillingOrder>,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<Workspace>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly billingProviderService: BillingProviderService,
    private readonly billingProfileService: BillingProfileService,
  ) {}

  async listWorkspaceInvoices(workspaceId: string): Promise<ProviderInvoiceRow[]> {
    const ctx = await this.loadWorkspaceBillingContext(workspaceId);
    if (!ctx) return [];

    const rows = await this.buildInvoiceRows(ctx);
    const hasCompleteProfile = await this.billingProfileService.hasCompleteProfile(workspaceId);

    this.logger.debug(
      JSON.stringify({
        event: 'billing_invoices_built',
        workspaceId,
        hasMainSubscription: ctx.invoiceFetchDebug.hasMainSubscription,
        mainProviderSubscriptionId: ctx.invoiceFetchDebug.mainProviderSubscriptionId,
        mainPlanKey: ctx.invoiceFetchDebug.mainPlanKey,
        mainInvoiceFetchCount: ctx.invoiceFetchDebug.mainInvoiceFetchCount,
        addonSubscriptionCount: ctx.invoiceFetchDebug.addonSubscriptionCount,
        addonInvoiceFetchCount: ctx.invoiceFetchDebug.addonInvoiceFetchCount,
        mainSubscriptionIdSource: ctx.invoiceFetchDebug.mainSubscriptionIdSource,
        mainFetchSkippedReason: ctx.invoiceFetchDebug.mainFetchSkippedReason ?? null,
        subscriptionInvoiceCount: ctx.subscriptionInvoiceRows.length,
        finalRowCount: rows.length,
        hasCompleteBillingProfile: hasCompleteProfile,
      }),
    );

    return rows.map((row) => this.toPublicInvoiceRow(row, hasCompleteProfile));
  }

  private toPublicInvoiceRow(
    row: ProviderInvoiceRow,
    hasCompleteProfile: boolean,
  ): ProviderInvoiceRow {
    const officialInvoiceUrl = row.invoiceUrl?.trim() || row.receiptUrl?.trim() || null;
    const invoiceDeliveryMode = resolveBillingInvoiceDeliveryMode(row);
    const requiresBillingDetails =
      row.billingKind === 'order' &&
      invoiceDeliveryMode === 'local_pdf' &&
      !hasCompleteProfile;

    return {
      ...row,
      officialInvoiceUrl,
      requiresBillingDetails,
      invoiceDeliveryMode,
    };
  }

  async exportBillingHistoryCsv(workspaceId: string): Promise<string> {
    const rows = await this.listWorkspaceInvoices(workspaceId);
    return buildBillingHistoryCsv(rows);
  }

  getBillingHistoryCsvFilename(): string {
    return BILLING_HISTORY_CSV_FILENAME;
  }

  async downloadBillingItemPdf(
    workspaceId: string,
    billingItemId: string,
    detailsInput?: Partial<BillingOrderInvoiceDetails> | null,
    requestContext?: BillingInvoicePdfRequestContext,
  ): Promise<BillingInvoiceDownloadResult> {
    const row = await this.resolveBillingItemRow(workspaceId, billingItemId);
    const officialInvoiceUrl = row.invoiceUrl?.trim() || row.receiptUrl?.trim() || '';
    this.logger.debug(
      JSON.stringify({
        event: 'billing_invoice_official_url_returned',
        requestId: requestContext?.requestId,
        billingItemId: row.id,
        hasOfficialInvoiceUrl: Boolean(officialInvoiceUrl),
      }),
    );
    return { downloadUrl: officialInvoiceUrl };
  }

  async streamBillingItemPdf(
    workspaceId: string,
    billingItemId: string,
    detailsInput?: Partial<BillingOrderInvoiceDetails> | null,
    requestContext?: BillingInvoicePdfRequestContext,
  ): Promise<BillingInvoicePdfResolveResult> {
    return this.resolveBillingItemPdf(workspaceId, billingItemId, detailsInput, requestContext);
  }

  async resolveBillingItemPdf(
    workspaceId: string,
    billingItemId: string,
    detailsInput?: Partial<BillingOrderInvoiceDetails> | null,
    requestContext?: BillingInvoicePdfRequestContext,
  ): Promise<BillingInvoicePdfResolveResult> {
    const row = await this.resolveBillingItemRow(workspaceId, billingItemId);
    const billingKind = row.billingKind ?? 'subscription_invoice';
    const isOrder = billingKind === 'order';
    const hostedProviderUrl = isOrder ? null : resolveProviderHostedInvoiceUrl(row);
    const directPdfUrl = isOrder ? resolveOrderDirectPdfUrl(row) : resolveProviderDirectPdfUrl(row);
    const hasCompleteProfile = await this.billingProfileService.hasCompleteProfile(workspaceId);
    const requiresBillingDetails =
      billingKind === 'order' && !hostedProviderUrl && !directPdfUrl && !hasCompleteProfile;

    this.logger.debug(
      JSON.stringify({
        event: 'billing_invoice_pdf_resolve',
        requestId: requestContext?.requestId,
        billingItemId: row.id,
        billingKind,
        itemType: row.itemType,
        itemKey: row.itemKey,
        providerInvoiceId: billingKind === 'order' ? null : row.id,
        providerOrderId: row.providerOrderId ?? (billingKind === 'order' ? row.id : null),
        source: row.source,
        requiresBillingDetails,
        hasCompleteBillingProfile: hasCompleteProfile,
        hasInvoiceUrl: Boolean(row.invoiceUrl?.trim()),
        hasDownloadUrl: Boolean(directPdfUrl),
        hasReceiptUrl: Boolean(row.receiptUrl?.trim()),
        pdfSource: hostedProviderUrl
          ? 'provider_url'
          : directPdfUrl
            ? 'provider_pdf'
            : isOrder
              ? 'lemon_generate_invoice'
              : 'local',
      }),
    );

    if (hostedProviderUrl) {
      this.logger.debug(
        JSON.stringify({
          event: 'billing_invoice_provider_url_returned',
          requestId: requestContext?.requestId,
          billingItemId: row.id,
          source: hostedProviderUrl.source,
        }),
      );
      return {
        mode: 'provider_url',
        url: hostedProviderUrl.url,
        source: hostedProviderUrl.source,
      };
    }

    if (directPdfUrl) {
      const buffer = await fetchRemoteInvoicePdf(directPdfUrl, {
        context: {
          requestId: requestContext?.requestId,
          billingItemId: row.id,
          billingKind,
          providerOrderId: row.providerOrderId,
          providerInvoiceId: billingKind === 'order' ? null : row.id,
        },
        log: (payload) => this.logger.debug(JSON.stringify(payload)),
      });

      return {
        mode: 'pdf',
        buffer,
        filename: isOrder
          ? buildBillingInvoicePdfFilename({ billingItemId: row.id, date: row.date })
          : buildLocalBillingPdfFilename(row.id),
      };
    }

    if (isOrder) {
      return this.streamGeneratedOrderInvoicePdf(
        workspaceId,
        row,
        detailsInput,
        requestContext,
      );
    }

    const pdfContext = await this.loadLocalPdfContext(workspaceId, requestContext?.userId);
    const billingDetails = await this.resolveLocalPdfBillingDetails({
      workspaceId,
      billingKind,
      detailsInput,
      profileExtras: detailsInput as WorkspaceBillingProfileInput | null | undefined,
      requestContext,
      billingItemId: row.id,
    });

    const buffer = generateLocalBillingPdf({
      row,
      context: {
        ...pdfContext,
        billingDetails,
      },
    });

    this.logger.debug(
      JSON.stringify({
        event: 'billing_local_pdf_generated',
        requestId: requestContext?.requestId,
        billingItemId: row.id,
        billingKind,
        amountFormatted: row.amountFormatted,
        hasBillingDetails: Boolean(billingDetails),
      }),
    );

    return {
      mode: 'pdf',
      buffer,
      filename: buildLocalBillingPdfFilename(row.id),
    };
  }

  private logBillingInvoicePdfError(
    requestContext: BillingInvoicePdfRequestContext | undefined,
    payload: {
      errorCode: string;
      billingItemId?: string;
      billingKind?: string;
      providerOrderId?: string | null;
      providerInvoiceId?: string | null;
      reason?: string;
    },
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'billing_invoice_pdf_error',
        requestId: requestContext?.requestId,
        ...payload,
      }),
    );
  }

  private async streamGeneratedOrderInvoicePdf(
    workspaceId: string,
    row: ProviderInvoiceRow,
    detailsInput?: Partial<BillingOrderInvoiceDetails> | null,
    requestContext?: BillingInvoicePdfRequestContext,
  ): Promise<BillingInvoicePdfResolveResult> {
    const billingDetails = await this.resolveLocalPdfBillingDetails({
      workspaceId,
      billingKind: 'order',
      detailsInput,
      profileExtras: detailsInput as WorkspaceBillingProfileInput | null | undefined,
      requestContext,
      billingItemId: row.id,
    });

    const providerOrderId = String(row.providerOrderId ?? row.id).trim();
    if (!billingDetails) {
      throw new BadRequestException({
        message: 'Billing details are required to generate this invoice.',
        errorCode: 'billing_invoice_details_required',
        profile: (await this.billingProfileService.getProfile(workspaceId)) ?? null,
      });
    }

    try {
      const generated = await this.billingProviderService.generateOrderInvoice(
        providerOrderId,
        billingDetails,
        { requestId: requestContext?.requestId },
      );

      await this.persistGeneratedOrderInvoiceUrl(workspaceId, providerOrderId, generated.downloadUrl);

      const buffer = await fetchRemoteInvoicePdf(generated.downloadUrl, {
        context: {
          requestId: requestContext?.requestId,
          billingItemId: row.id,
          billingKind: 'order',
          providerOrderId,
          providerInvoiceId: null,
        },
        log: (payload) => this.logger.debug(JSON.stringify(payload)),
      });

      this.logger.debug(
        JSON.stringify({
          event: 'billing_order_invoice_pdf_generated',
          requestId: requestContext?.requestId,
          billingItemId: row.id,
          providerOrderId,
          hasDownloadUrl: Boolean(generated.downloadUrl),
        }),
      );

      return {
        mode: 'pdf',
        buffer,
        filename: buildBillingInvoicePdfFilename({ billingItemId: row.id, date: row.date }),
      };
    } catch (err) {
      if (err instanceof BillingProviderActionError) {
        this.logBillingInvoicePdfError(requestContext, {
          errorCode: err.errorCode,
          billingItemId: row.id,
          billingKind: 'order',
          providerOrderId,
          reason: err.message,
        });
        throw new BadRequestException({
          message:
            err.errorCode === 'billing_invoice_generation_failed'
              ? err.message
              : 'Please check your billing details.',
          errorCode:
            err.errorCode === 'billing_invoice_generation_failed'
              ? 'billing_invoice_generation_failed'
              : 'billing_invoice_details_invalid',
        });
      }
      throw err;
    }
  }

  private async persistGeneratedOrderInvoiceUrl(
    workspaceId: string,
    providerOrderId: string,
    invoiceUrl: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;
    const url = String(invoiceUrl ?? '').trim();
    const orderId = String(providerOrderId ?? '').trim();
    if (!url || !orderId) return;

    await this.billingOrderModel
      .updateOne(
        { workspaceId: new Types.ObjectId(workspaceId), providerOrderId: orderId },
        { $set: { invoiceUrl: url } },
      )
      .exec();
  }

  private async resolveBillingItemRow(
    workspaceId: string,
    billingItemId: string,
  ): Promise<ProviderInvoiceRow> {
    const ctx = await this.loadWorkspaceBillingContext(workspaceId);
    if (!ctx) {
      throw new NotFoundException({
        error: 'Billing item not found.',
        errorCode: 'billing_item_not_found',
      });
    }

    const itemId = String(billingItemId ?? '').trim();
    if (!itemId) {
      throw new NotFoundException({
        error: 'Billing item not found.',
        errorCode: 'billing_item_not_found',
      });
    }

    const rows = await this.buildInvoiceRows(ctx);
    const row = rows.find((entry) => entry.id === itemId);
    if (!row) {
      throw new NotFoundException({
        error: 'Billing item not found.',
        errorCode: 'billing_item_not_found',
      });
    }

    return row;
  }

  private async loadLocalPdfContext(
    workspaceId: string,
    userId?: string,
  ): Promise<Omit<LocalBillingPdfContext, 'billingDetails'>> {
    const workspaceObjectId = Types.ObjectId.isValid(workspaceId)
      ? new Types.ObjectId(workspaceId)
      : null;
    const workspace = workspaceObjectId
      ? await this.workspaceModel.findById(workspaceObjectId).select('name').lean().exec()
      : null;

    let customerName: string | undefined;
    let customerEmail: string | undefined;
    if (userId && Types.ObjectId.isValid(userId)) {
      const user = await this.userModel
        .findById(new Types.ObjectId(userId))
        .select('email firstName lastName displayNameOverride')
        .lean()
        .exec();
      if (user) {
        customerEmail = String(user.email ?? '').trim() || undefined;
        customerName =
          String(user.displayNameOverride ?? '').trim() ||
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          customerEmail;
      }
    }

    return {
      workspaceName: String(workspace?.name ?? 'Workspace').trim() || 'Workspace',
      workspaceId,
      customerName,
      customerEmail,
    };
  }

  private async resolveLocalPdfBillingDetails(input: {
    workspaceId: string;
    billingKind: string;
    detailsInput?: Partial<BillingOrderInvoiceDetails> | null;
    profileExtras?: WorkspaceBillingProfileInput | null;
    requestContext?: BillingInvoicePdfRequestContext;
    billingItemId: string;
  }): Promise<BillingOrderInvoiceDetails | undefined> {
    const { workspaceId, billingKind, detailsInput, profileExtras, requestContext, billingItemId } =
      input;

    const hasAnyDetail = Boolean(
      detailsInput?.name?.trim() ||
        detailsInput?.address?.trim() ||
        detailsInput?.city?.trim() ||
        detailsInput?.state?.trim() ||
        detailsInput?.zipCode?.trim() ||
        detailsInput?.country?.trim(),
    );

    let resolved: BillingOrderInvoiceDetails | undefined;

    if (hasAnyDetail) {
      resolved = this.parseProvidedBillingDetails(detailsInput, requestContext, billingItemId);
    } else if (billingKind === 'order') {
      resolved =
        (await this.billingProfileService.getInvoiceDetailsForOrder(workspaceId)) ?? undefined;
    } else {
      resolved = this.resolveOptionalBillingDetails(detailsInput, requestContext, billingItemId);
    }

    if (billingKind === 'order' && !resolved) {
      const profile = await this.billingProfileService.getProfile(workspaceId);
      this.logBillingInvoicePdfError(requestContext, {
        errorCode: 'billing_invoice_details_required',
        billingItemId,
        billingKind: 'order',
        reason: 'Billing details are required to generate this invoice.',
      });
      throw new BadRequestException({
        message: 'Billing details are required to generate this invoice.',
        errorCode: 'billing_invoice_details_required',
        profile: profile ?? null,
      });
    }

    if (requestContext?.saveProfile && requestContext.userId && resolved) {
      await this.billingProfileService.upsertProfile(workspaceId, requestContext.userId, {
        ...resolved,
        email: profileExtras?.email,
        taxId: profileExtras?.taxId,
        notes: resolved.notes ?? profileExtras?.notes,
      });
    }

    return resolved;
  }

  private parseProvidedBillingDetails(
    detailsInput: Partial<BillingOrderInvoiceDetails> | null | undefined,
    requestContext: BillingInvoicePdfRequestContext | undefined,
    billingItemId: string,
  ): BillingOrderInvoiceDetails | undefined {
    const parsed = parseOrderInvoiceDetails(detailsInput ?? undefined, {
      requestId: requestContext?.requestId,
      billingItemId,
      log: (payload) => this.logger.debug(JSON.stringify(payload)),
    });
    if (!parsed.ok) {
      this.logBillingInvoicePdfError(requestContext, {
        errorCode: parsed.errorCode,
        billingItemId,
        billingKind: 'order',
        reason: parsed.message,
      });
      throw new BadRequestException({
        message:
          parsed.errorCode === 'billing_invoice_details_invalid'
            ? 'Please check your billing details.'
            : parsed.message,
        errorCode: parsed.errorCode,
      });
    }

    return parsed.details;
  }

  private resolveOptionalBillingDetails(
    detailsInput: Partial<BillingOrderInvoiceDetails> | null | undefined,
    requestContext: BillingInvoicePdfRequestContext | undefined,
    billingItemId: string,
  ): BillingOrderInvoiceDetails | undefined {
    const hasAnyDetail = Boolean(
      detailsInput?.name?.trim() ||
        detailsInput?.address?.trim() ||
        detailsInput?.city?.trim() ||
        detailsInput?.state?.trim() ||
        detailsInput?.zipCode?.trim() ||
        detailsInput?.country?.trim(),
    );
    if (!hasAnyDetail) return undefined;

    const parsed = parseOrderInvoiceDetails(detailsInput ?? undefined, {
      requestId: requestContext?.requestId,
      billingItemId,
      log: (payload) => this.logger.debug(JSON.stringify(payload)),
    });
    if (!parsed.ok) {
      this.logBillingInvoicePdfError(requestContext, {
        errorCode: parsed.errorCode,
        billingItemId,
        billingKind: 'order',
        reason: parsed.message,
      });
      throw new BadRequestException({
        message:
          parsed.errorCode === 'billing_invoice_details_invalid'
            ? 'Please check your billing details.'
            : parsed.message,
        errorCode: parsed.errorCode,
      });
    }

    return parsed.details;
  }

  private async loadWorkspaceBillingContext(
    workspaceId: string,
  ): Promise<WorkspaceBillingContext | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    if (!this.billingProviderService.isCheckoutConfigured()) return null;

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const [subscription, addons, topUps, storedOrderExists, planOrders] = await Promise.all([
      this.subscriptionModel
        .findOne({ workspaceId: workspaceObjectId })
        .select(
          'provider providerSubscriptionId planKey status cancelAtPeriodEnd currentPeriodStart currentPeriodEnd providerCustomerId providerVariantId',
        )
        .lean()
        .exec(),
      this.addonModel
        .find({ workspaceId: workspaceObjectId })
        .select('addonKey status providerSubscriptionId')
        .lean()
        .exec(),
      this.topUpModel
        .find({ workspaceId: workspaceObjectId })
        .select('providerOrderId')
        .lean()
        .exec(),
      this.billingOrderModel
        .exists({ workspaceId: workspaceObjectId })
        .exec(),
      this.billingOrderModel
        .find({ workspaceId: workspaceObjectId, checkoutType: 'plan' })
        .sort({ orderCreatedAt: -1 })
        .select('providerSubscriptionId')
        .lean()
        .exec(),
    ]);

    const hasLemonSubscription = subscription?.provider === 'lemon_squeezy';
    const hasTopUps = topUps.length > 0;
    const hasStoredOrders = Boolean(storedOrderExists);
    if (!hasLemonSubscription && !hasTopUps && !hasStoredOrders) {
      return null;
    }

    const lemonConfig = resolveLemonSqueezyBillingConfig(configFactory());
    const planKey = (subscription?.planKey ?? 'free') as PlanKey;
    const effectivePlanKey = planKey === 'starter' || planKey === 'pro' ? planKey : undefined;

    const addonKeyBySubscriptionId = new Map<string, string>();
    for (const addon of addons as Array<{
      addonKey: string;
      status: string;
      providerSubscriptionId?: string | null;
    }>) {
      if (!RECURRING_ADDON_KEYS.has(String(addon.addonKey))) continue;
      if (isLegacyKbAddonKey(String(addon.addonKey))) continue;
      if (!RECURRING_ADDON_INVOICE_STATUSES.has(String(addon.status))) continue;
      const subId = addon.providerSubscriptionId?.trim();
      if (subId) addonKeyBySubscriptionId.set(subId, String(addon.addonKey));
    }

    const resolvedMainSubscription = resolveMainPlanProviderSubscriptionId({
      subscriptionProviderSubscriptionId: subscription?.providerSubscriptionId,
      addonSubscriptionIds: new Set(addonKeyBySubscriptionId.keys()),
      planOrderProviderSubscriptionIds: (planOrders as Array<{ providerSubscriptionId?: string | null }>).map(
        (row) => String(row.providerSubscriptionId ?? ''),
      ),
    });

    let planSubscriptionId = resolvedMainSubscription.id;
    if (
      !planSubscriptionId &&
      resolvedMainSubscription.skippedReason === 'missing_provider_subscription_id' &&
      subscription?.providerCustomerId?.trim()
    ) {
      const remotePlans = await this.billingProviderService.listCustomerPlanSubscriptions(
        subscription.providerCustomerId.trim(),
      );
      planSubscriptionId = remotePlans[0]?.providerSubscriptionId?.trim() ?? '';
    }

    const mainFetchEligibility = shouldFetchMainPlanInvoices({
      provider: subscription?.provider,
      planKey: effectivePlanKey,
      status: subscription?.status,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null,
      planSubscriptionId,
    });

    const topUpOrderIds = new Set<string>(
      (topUps as Array<{ providerOrderId: string }>).map((row) => String(row.providerOrderId)),
    );

    const rowsById = new Map<string, TaggedProviderInvoiceRow>();
    let mainInvoiceFetchCount = 0;
    let addonInvoiceFetchCount = 0;

    const collectSubscriptionRows = (
      rows: ProviderInvoiceRow[],
      fetchHint?: InvoiceFetchHint,
      contextSubscriptionId?: string,
    ): number => {
      let collected = 0;
      for (const row of rows) {
        if ((row.source ?? 'lemon_subscription_invoice') !== 'lemon_subscription_invoice') continue;

        const providerSubscriptionId =
          String(row.providerSubscriptionId ?? '').trim() || contextSubscriptionId || null;
        const tagged: TaggedProviderInvoiceRow = {
          ...row,
          providerSubscriptionId,
          fetchHint,
        };
        const rowKey = buildSubscriptionInvoiceRowId(tagged);
        if (!rowKey || rowsById.has(rowKey)) continue;
        rowsById.set(rowKey, tagged);
        collected += 1;
      }
      return collected;
    };

    let mainFetchSkippedReason =
      resolvedMainSubscription.skippedReason ?? mainFetchEligibility.skippedReason;

    if (hasLemonSubscription && mainFetchEligibility.eligible && planSubscriptionId && effectivePlanKey) {
      const planRows = await this.billingProviderService.listSubscriptionInvoices(planSubscriptionId, {
        planKey: effectivePlanKey,
      });
      mainInvoiceFetchCount = collectSubscriptionRows(
        planRows,
        { kind: 'plan', planKey: effectivePlanKey, providerSubscriptionId: planSubscriptionId },
        planSubscriptionId,
      );
      mainFetchSkippedReason = undefined;
    } else if (hasLemonSubscription && planSubscriptionId && !effectivePlanKey) {
      mainFetchSkippedReason = 'plan_key_not_billable';
    } else if (hasLemonSubscription && !mainFetchEligibility.eligible) {
      mainFetchSkippedReason = mainFetchEligibility.skippedReason;
    } else if (hasLemonSubscription && !planSubscriptionId) {
      mainFetchSkippedReason =
        resolvedMainSubscription.skippedReason ?? 'missing_provider_subscription_id';
    }

    if (hasLemonSubscription) {
      for (const [addonSubId, addonKey] of addonKeyBySubscriptionId.entries()) {
        if (addonSubId === planSubscriptionId) continue;
        const addonRows = await this.billingProviderService.listSubscriptionInvoices(addonSubId);
        addonInvoiceFetchCount += collectSubscriptionRows(
          addonRows,
          { kind: 'addon', addonKey, providerSubscriptionId: addonSubId },
          addonSubId,
        );
      }
    }

    let mainSubscriptionIdSource = resolvedMainSubscription.source;
    if (!resolvedMainSubscription.id && planSubscriptionId) {
      mainSubscriptionIdSource = 'customer_lookup';
    }

    const invoiceFetchDebug: BillingInvoiceFetchDebug = {
      hasMainSubscription: hasLemonSubscription,
      mainProviderSubscriptionId: planSubscriptionId || null,
      mainPlanKey: effectivePlanKey ?? null,
      mainInvoiceFetchCount,
      addonSubscriptionCount: addonKeyBySubscriptionId.size,
      addonInvoiceFetchCount,
      mainSubscriptionIdSource,
      mainFetchSkippedReason,
    };

    return {
      workspaceId,
      planSubscriptionId,
      planKey,
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
      subscriptionInvoiceRows: [...rowsById.values()],
      invoiceFetchDebug,
    };
  }

  private async buildInvoiceRows(ctx: WorkspaceBillingContext): Promise<ProviderInvoiceRow[]> {
    const workspaceObjectId = new Types.ObjectId(ctx.workspaceId);
    const [storedOrders, topUps] = await Promise.all([
      this.billingOrderModel
        .find({ workspaceId: workspaceObjectId })
        .sort({ orderCreatedAt: -1 })
        .lean()
        .exec(),
      this.topUpModel
        .find({ workspaceId: workspaceObjectId })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);

    const rowsById = new Map<string, ProviderInvoiceRow>();
    const seenOrderIds = new Set<string>();

    for (const row of ctx.subscriptionInvoiceRows) {
      const match = resolveInvoiceItemMatch({
        row,
        planSubscriptionId: ctx.planSubscriptionId,
        planKey: ctx.planKey,
        addonKeyBySubscriptionId: ctx.addonKeyBySubscriptionId,
        topUpOrderIds: ctx.topUpOrderIds,
        lemonConfig: ctx.lemonConfig,
        fetchHint: row.fetchHint,
      });
      const enriched = enrichInvoiceRow(row, match, {
        source: 'lemon_subscription_invoice',
      });
      const publicId = buildSubscriptionInvoiceRowId({
        ...enriched,
        source: 'lemon_subscription_invoice',
      });
      rowsById.set(publicId, attachInvoiceBillingInterval({
        ...enriched,
        id: publicId,
        billingKind: 'subscription_invoice',
        requiresBillingDetails: false,
      }, ctx.lemonConfig));
      const orderId = String(enriched.providerOrderId ?? '').trim();
      if (orderId) seenOrderIds.add(orderId);
    }

    for (const stored of storedOrders as Array<{
      providerOrderId: string;
      checkoutType: StoredBillingOrderRow['checkoutType'];
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
    }>) {
      const orderRow: StoredBillingOrderRow = {
        providerOrderId: String(stored.providerOrderId),
        checkoutType: stored.checkoutType,
        planKey: stored.planKey,
        addonKey: stored.addonKey,
        topUpKey: stored.topUpKey,
        providerSubscriptionId: stored.providerSubscriptionId,
        amountCents: stored.amountCents,
        currency: stored.currency,
        status: stored.status,
        invoiceUrl: stored.invoiceUrl,
        receiptUrl: stored.receiptUrl,
        orderCreatedAt: stored.orderCreatedAt,
      };

      const orderId = orderRow.providerOrderId.trim();
      if (!orderId || seenOrderIds.has(orderId) || rowsById.has(orderId)) continue;

      if (
        shouldSkipStoredOrderForSubscriptionInvoice({
          order: orderRow,
          subscriptionInvoices: ctx.subscriptionInvoiceRows,
          planSubscriptionId: ctx.planSubscriptionId,
          addonKeyBySubscriptionId: ctx.addonKeyBySubscriptionId,
        })
      ) {
        continue;
      }

      seenOrderIds.add(orderId);
      rowsById.set(orderId, attachInvoiceBillingInterval({
        ...storedBillingOrderToProviderRow(orderRow),
        billingKind: 'order',
        requiresBillingDetails: false,
      }, ctx.lemonConfig));
    }

    const topUpPriceUsd =
      WORKSPACE_ADDON_CATALOG.find((item) => item.key === 'ai_credits_1000')?.priceUsd ?? 30;
    const topUpAmountCents = topUpPriceUsd * 100;

    for (const topUp of topUps as Array<{
      providerOrderId: string;
      createdAt?: Date;
      creditsPurchased: number;
    }>) {
      const orderId = String(topUp.providerOrderId ?? '').trim();
      if (!orderId || seenOrderIds.has(orderId) || rowsById.has(orderId)) continue;

      let orderRow = await this.billingProviderService.fetchOrderInvoice(orderId);
      if (!orderRow) {
        orderRow = {
          id: orderId,
          provider: 'lemon_squeezy',
          date: (topUp.createdAt ?? new Date()).toISOString(),
          amount: topUpAmountCents / 100,
          amountCents: topUpAmountCents,
          amountFormatted: formatInvoiceAmountFormatted(topUpAmountCents, 'USD'),
          currency: 'USD',
          status: 'paid',
          invoiceUrl: null,
          receiptUrl: null,
          description: '1,000 AI credits top-up',
          providerOrderId: orderId,
          source: 'local_top_up',
        };
      }

      const match = resolveInvoiceItemMatch({
        row: orderRow,
        planSubscriptionId: ctx.planSubscriptionId,
        planKey: ctx.planKey,
        addonKeyBySubscriptionId: ctx.addonKeyBySubscriptionId,
        topUpOrderIds: ctx.topUpOrderIds,
        lemonConfig: ctx.lemonConfig,
      });

      seenOrderIds.add(orderId);
      rowsById.set(orderId, attachInvoiceBillingInterval({
        ...enrichInvoiceRow(orderRow, match, {
          source: orderRow.source ?? 'lemon_order',
        }),
        id: orderId,
        billingKind: 'order',
        requiresBillingDetails: false,
      }, ctx.lemonConfig));
    }

    const rows = [...rowsById.values()];
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }
}
