/** GET /api/customer/me */
export type WorkspaceOnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'live_pending_install'
  | 'completed';

export type WorkspaceOnboardingStep =
  | 'agent-profile'
  | 'describe-profile'
  | 'knowledge-base'
  | 'go-live'
  | 'you-are-live';

export type CustomerWorkspaceSummary = {
  id: string;
  name: string;
  role?: WorkspaceMemberRole;
  planKey: string;
  planName: string;
  subscriptionStatus: string;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
  isTrialPlan?: boolean;
  trialDays?: number | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  isTrialExpired?: boolean;
  creditsRenewMonthly?: boolean;
  autoTrainAllowed?: boolean;
  addonsAllowed?: boolean;
  memberInvitesAllowed?: boolean;
  sharePreviewAllowed?: boolean;
  onboardingStatus?: WorkspaceOnboardingStatus;
  onboardingCurrentStep?: WorkspaceOnboardingStep;
  onboardingCreatedBotId?: string | null;
};

export type WorkspaceOnboardingDraftProfile = {
  name: string;
  shortDescription: string;
  description: string;
  brandColor: string;
  categories: string[];
  avatarSource: string;
  imageUrl: string;
  avatarEmoji: string;
  avatarStorageKey: string;
};

export type WorkspaceOnboardingDraftInstructions = {
  description: string;
  systemPrompt: string;
  tone: string;
  behaviorPreset: string;
  responseLength: string;
  maxTokens: number;
};

export type WorkspaceOnboardingDraftFaq = {
  question: string;
  answer: string;
};

export type WorkspaceOnboardingDraftKnowledge = {
  snippets: WorkspaceOnboardingDraftSnippet[];
  qas: WorkspaceOnboardingDraftQa[];
  /** Legacy — derived from snippets when present. */
  knowledgeDescription: string;
  /** Legacy — derived from qas. */
  faqs: WorkspaceOnboardingDraftFaq[];
};

export type WorkspaceOnboardingDraftSnippet = {
  id: string;
  title: string;
  description: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sequence?: number;
  updateSequence?: number;
};

export type WorkspaceOnboardingDraftQa = {
  id: string;
  title: string;
  questions: string[];
  answer: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sequence?: number;
  updateSequence?: number;
};

export type WorkspaceOnboardingDraftAllowedOrigin = {
  origin: string;
  label?: string;
  isActive?: boolean;
};

export type WorkspaceOnboardingDraftGoLive = {
  allowedOrigins: WorkspaceOnboardingDraftAllowedOrigin[];
};

export type WorkspaceOnboardingDraftSnapshot = {
  profile: WorkspaceOnboardingDraftProfile;
  instructions: WorkspaceOnboardingDraftInstructions;
  knowledge: WorkspaceOnboardingDraftKnowledge;
  goLive: WorkspaceOnboardingDraftGoLive;
  stepsCompleted: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkspaceOnboardingStagedKnowledgeItem = {
  id: string;
  sourceType: 'document' | 'datasheet';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage?: string;
  createdAt: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type WorkspaceOnboardingStagedKnowledge = {
  documents: WorkspaceOnboardingStagedKnowledgeItem[];
  datasheets: WorkspaceOnboardingStagedKnowledgeItem[];
};

export type WorkspaceOnboardingResponse = {
  workspaceId: string;
  onboardingStatus: WorkspaceOnboardingStatus;
  onboardingCurrentStep: WorkspaceOnboardingStep;
  onboardingDraftId: string | null;
  onboardingCreatedBotId: string | null;
  onboardingCompletedAt: string | null;
  draft: WorkspaceOnboardingDraftSnapshot;
  stagedKnowledge?: WorkspaceOnboardingStagedKnowledge;
};

export type WorkspaceOnboardingGoLiveBot = {
  id: string;
  name: string;
  slug: string;
  status: 'published';
  accessKey: string;
  secretKey?: string;
  visibility: 'public' | 'private';
  allowedOrigins: WorkspaceOnboardingDraftAllowedOrigin[];
};

export type WorkspaceOnboardingGoLiveResponse = {
  workspaceId: string;
  onboardingStatus: WorkspaceOnboardingStatus;
  onboardingCurrentStep: WorkspaceOnboardingStep;
  bot: WorkspaceOnboardingGoLiveBot;
  knowledgeProcessingPending?: boolean;
  knowledgeProcessingMessage?: string;
};

/** GET /api/customer/workspaces/:workspaceId/usage/ai-credits */
export type CustomerWorkspaceAiCreditsUsage = {
  workspaceId: string;
  billingPeriod: { start: string; end: string };
  planKey: string;
  planName: string;
  monthlyAiCredits: number;
  monthlyCreditsUsed: number;
  monthlyCreditsRemaining: number;
  topUpCreditsRemaining: number;
  totalCreditsAvailable: number;
  isOverLimit: boolean;
  byBot: Array<{ botId: string; creditsUsed: number }>;
};

/** GET /api/customer/workspaces/:workspaceId/usage/analytics */
export type WorkspaceUsageAnalyticsTrendDay = {
  date: string;
  totalCreditsUsed: number;
  monthlyCreditsUsed: number;
  topUpCreditsUsed: number;
};

export type WorkspaceUsageAnalyticsAiCreditsByAgent = {
  botId: string;
  botName: string;
  totalCreditsUsed: number;
  monthlyCreditsUsed: number;
  topUpCreditsUsed: number;
  messageCount: number;
};

export type WorkspaceUsageAnalyticsTrainedKnowledgeByAgent = {
  botId: string;
  botName: string;
  usedMb: number;
  maxMb: number;
  percentUsed: number;
};

export type WorkspaceUsageAnalytics = {
  dateRange: { startDate: string; endDate: string };
  usageTrend: WorkspaceUsageAnalyticsTrendDay[];
  aiCreditsByAgent: WorkspaceUsageAnalyticsAiCreditsByAgent[];
  trainedKnowledgeByAgent: WorkspaceUsageAnalyticsTrainedKnowledgeByAgent[];
};

/** GET /api/customer/workspaces/:workspaceId/billing/summary */
export type WorkspaceBillingPlanSummary = {
  key: string;
  name: string;
  priceMonthly: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

export type WorkspaceBillingEntitlementsSummary = {
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  maxKbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
  isTrialPlan: boolean;
  trialDays: number | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  isTrialExpired: boolean;
  creditsRenewMonthly: boolean;
  autoTrainAllowed: boolean;
  addonsAllowed: boolean;
  memberInvitesAllowed: boolean;
  sharePreviewAllowed: boolean;
  canRemoveBranding: boolean;
  activeAddons: string[];
  topUpCreditsRemaining: number;
};

export type WorkspaceBillingBotUsageSummary = {
  current: number;
  limit: number;
};

export type WorkspaceBillingMemberUsageSummary = {
  current: number;
  pendingInvites: number;
  used: number;
  limit: number;
  isOverMemberLimit?: boolean;
};

export type WorkspaceBillingAiCreditsUsageSummary = {
  periodStart: string;
  periodEnd: string;
  monthlyCredits: number;
  monthlyCreditsUsed: number;
  monthlyCreditsRemaining: number;
  topUpCreditsRemaining: number;
  totalCreditsAvailable: number;
  totalCreditsRemaining: number;
  isOverLimit: boolean;
  byBot: Array<{ botId: string; creditsUsed: number }>;
};

export type WorkspaceBillingTrainedKnowledgeBotUsage = {
  botId: string;
  botName: string;
  usedBytes: number;
  maxBytes: number;
  usedMb: number;
  maxMb: number;
  percentUsed: number;
};

export type WorkspaceBillingTrainedKnowledgeUsageSummary = {
  perBot: WorkspaceBillingTrainedKnowledgeBotUsage[];
  totalUsedBytes: number;
  note: string;
};

export type WorkspaceBillingUsageSummary = {
  bots: WorkspaceBillingBotUsageSummary;
  members: WorkspaceBillingMemberUsageSummary;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary;
  trainedKnowledge: WorkspaceBillingTrainedKnowledgeUsageSummary;
};

/** Paid plan / recurring add-on checkout cadence (API uses `yearly`; UI toggle uses `annual`). */
export type BillingInterval = 'monthly' | 'yearly';

export type WorkspaceBillingScheduledIntervalChange = {
  toInterval: BillingInterval;
  effectiveDate?: string | null;
};

export type WorkspaceBillingPlanCatalogCard = {
  key: string;
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  monthlyEquivalentYearly?: number;
  yearlyDiscountPercent?: number;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  /** True when backend billing provider env is configured (UI may still gate on Step 2). */
  checkoutAvailable: boolean;
  checkoutAvailableMonthly?: boolean;
  checkoutAvailableYearly?: boolean;
};

export type WorkspaceBillingAddonCatalogCard = {
  key: string;
  name: string;
  /** `one_time` for credit packs; `monthly` for recurring subscription add-ons. */
  billingInterval: 'one_time' | 'monthly';
  /** Active subscription cadence when status is active (monthly or yearly). */
  subscriptionBillingInterval?: BillingInterval;
  priceUsd: number;
  priceYearly?: number;
  monthlyEquivalentYearly?: number;
  yearlyDiscountPercent?: number;
  scheduledIntervalChange?: WorkspaceBillingScheduledIntervalChange | null;
  scope: 'workspace' | 'bot';
  checkoutAvailable: boolean;
  checkoutAvailableMonthly?: boolean;
  checkoutAvailableYearly?: boolean;
  description?: string;
  active?: boolean;
  status?: 'active' | 'inactive' | 'cancel_at_period_end' | 'expired' | 'cancelled' | 'past_due' | 'payment_failed';
  targetBotId?: string | null;
  targetBotName?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  effectLabel?: string | null;
  /** ai_credits_1000 only — workspace preference for auto-prompt top-up purchases. */
  autoTopUpPromptEnabled?: boolean;
};

export type WorkspaceBillingTopUpRow = {
  creditsPurchased: number;
  creditsRemaining: number;
  expiresAt: string;
  createdAt: string;
  amountFormatted?: string | null;
  receiptUrl?: string | null;
};

/** POST /api/customer/workspaces/:workspaceId/billing/checkout/* */
export type BillingCheckoutSessionResponse = {
  checkoutUrl: string;
  provider: 'lemon_squeezy' | 'stripe_future';
};

export type WorkspaceBillingPaymentMethodSummary = {
  brand?: string;
  last4?: string;
  label?: string;
};

export type WorkspaceBillingActiveAddonRow = {
  addonKey: string;
  name: string;
  status: string;
  targetBotId: string | null;
  targetBotName: string | null;
  billingInterval?: 'one_time' | 'monthly';
  subscriptionBillingInterval?: BillingInterval;
  priceUsd?: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  effectLabel?: string | null;
};

export type WorkspaceBillingSubscriptionSummary = {
  provider: 'lemon_squeezy' | 'stripe_future' | null;
  subscriptionStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  hasActivePaidSubscription: boolean;
  hasPaymentIssue: boolean;
  paymentMethod: WorkspaceBillingPaymentMethodSummary | null;
  customerPortalAvailable: boolean;
  manageBillingAvailable: boolean;
  scheduledPlanKey?: string;
  scheduledPlanName?: string;
  scheduledPlanEffectiveDate?: string;
  billingInterval?: BillingInterval;
  scheduledBillingInterval?: BillingInterval;
  scheduledBillingIntervalEffectiveDate?: string;
};

export type WorkspaceBillingInvoiceRow = {
  id: string;
  provider: 'lemon_squeezy' | 'stripe_future';
  date: string;
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
  source?: 'lemon_subscription_invoice' | 'lemon_order' | 'local_top_up';
  billingKind?: 'subscription_invoice' | 'order';
  billingInterval?: BillingInterval;
  requiresBillingDetails?: boolean;
  officialInvoiceUrl?: string | null;
  invoiceDeliveryMode?: 'provider_url' | 'direct_pdf' | 'local_pdf';
};

export type BillingInvoiceProviderUrlResponse = {
  mode: 'provider_url';
  url: string;
  source?: string;
};

export type WorkspaceBillingInvoiceDocumentResult =
  | { kind: 'pdf'; blob: Blob; filename: string }
  | { kind: 'provider_url'; url: string; source?: string };

export type BillingInvoiceDownloadDetails = {
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  email?: string;
  taxId?: string;
  notes?: string;
  locale?: string;
  saveProfile?: boolean;
};

export type WorkspaceBillingProfile = {
  workspaceId: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  taxId?: string;
  email?: string;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
};

export type WorkspaceBillingProfileInput = {
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  taxId?: string;
  email?: string;
  notes?: string;
};

export type WorkspaceBillingProfileResponse = {
  profile: WorkspaceBillingProfile | null;
};

export type BillingInvoiceDownloadResponse = {
  downloadUrl: string;
};

/** POST /api/customer/workspaces/:workspaceId/billing/manage */
export type BillingManageSessionResponse = {
  url: string;
  provider: 'lemon_squeezy' | 'stripe_future';
};

/** POST /api/customer/workspaces/:workspaceId/billing/subscription/cancel|change-plan */
export type BillingSubscriptionActionResponse = {
  summary: WorkspaceBillingSummary;
  message: string;
};

export type WorkspaceBillingSummary = {
  workspaceId: string;
  plan: WorkspaceBillingPlanSummary;
  subscription: WorkspaceBillingSubscriptionSummary;
  entitlements: WorkspaceBillingEntitlementsSummary;
  usage: WorkspaceBillingUsageSummary;
  planCatalog: WorkspaceBillingPlanCatalogCard[];
  addonCatalog: WorkspaceBillingAddonCatalogCard[];
  activeAddons: WorkspaceBillingActiveAddonRow[];
  topUps?: WorkspaceBillingTopUpRow[];
  extraBotAddons?: WorkspaceBillingExtraBotAddonInstance[];
  aiCreditsAutoTopUpPromptEnabled?: boolean;
  autoTopUpThresholdCredits?: number;
  topUpCheckoutAvailable?: boolean;
  autoTopUp?: WorkspaceBillingAutoTopUpSummary;
};

export type WorkspaceBillingAutoTopUpSummary = {
  status: 'off' | 'pending' | 'active' | 'payment_issue' | 'scheduled_disable';
  enabled: boolean;
  checkoutAvailable: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  packsThisBillingPeriod: number;
  maxPacksPerBillingPeriod: number;
  packCredits: number;
  packPriceUsd: number;
};

export type WorkspaceBillingExtraBotAddonInstance = {
  id: string;
  addonKey: 'extra_bot';
  name: string;
  status: 'active' | 'cancel_at_period_end' | 'expired' | 'cancelled' | 'past_due' | 'payment_failed';
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  priceUsd: number;
  billingInterval?: BillingInterval;
  scheduledIntervalChange?: WorkspaceBillingScheduledIntervalChange | null;
  effectLabel: '+1 agent';
};

export type CustomerProfileLinks = {
  linkedinUrl: string | null;
  calendlyUrl: string | null;
  websiteUrl: string | null;
  otherUrl: string | null;
};

export type CustomerMe = {
  id: string;
  email: string;
  role: string;
  activeWorkspaceId?: string | null;
  workspaceIds: string[];
  /** Workspace summaries with plan/entitlement fields (same order as `workspaceIds` when present). */
  workspaces?: CustomerWorkspaceSummary[];
  firstName?: string;
  lastName?: string;
  /** Profile image URL (e.g. Google picture). */
  picture?: string;
  profileLinks?: CustomerProfileLinks;
};

export type PatchCustomerMeProfileRequest = {
  name?: string;
  avatarUrl?: string | null;
  profileLinks?: {
    linkedinUrl?: string | null;
    calendlyUrl?: string | null;
    websiteUrl?: string | null;
    otherUrl?: string | null;
  };
};

export type UploadCustomerMeAvatarResponse = {
  customer: CustomerMe;
};

export type PatchCustomerMeProfileResponse = {
  customer: CustomerMe;
};

export type PatchWorkspaceResponse = {
  workspace: { id: string; name: string };
  session: CustomerMe;
};

export type DeleteWorkspaceResponse = {
  success: boolean;
  session: CustomerMe;
};

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

/** Roles assignable via workspace invite (owner is never invitable). */
export type WorkspaceInviteRole = 'admin' | 'member';

export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

/** GET /api/customer/workspaces/:workspaceId/members */
export type WorkspaceBotAccessSummary = {
  viewable: number;
  previewable: number;
};

export type WorkspaceMembershipStatus = 'active' | 'inactive_over_limit';

export type WorkspaceMemberSummary = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  picture: string | null;
  displayName?: string;
  avatarUrl?: string | null;
  role: WorkspaceMemberRole;
  joinedAt: string | null;
  membershipStatus?: WorkspaceMembershipStatus;
  botAccessSummary?: WorkspaceBotAccessSummary;
};

export type SubjectBotGrantItem = {
  botId: string;
  botName: string;
  canView: boolean;
  canPreview: boolean;
};

export type SubjectBotGrantsResponse = {
  grants: SubjectBotGrantItem[];
  botAccessSummary: WorkspaceBotAccessSummary;
};

/** GET /api/customer/workspaces/:workspaceId/invites */
export type WorkspaceInviteSummary = {
  id: string;
  email: string;
  role: WorkspaceInviteRole;
  status: WorkspaceInviteStatus;
  expiresAt: string;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  inviteUrl?: string;
  botAccessSummary?: WorkspaceBotAccessSummary;
};

export type BotAccessGrantSubjectType = 'user' | 'invite';

export type BotAccessGrantRow = {
  subjectType: BotAccessGrantSubjectType;
  userId?: string;
  inviteId?: string;
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
  status: 'active' | 'pending_invite' | 'expired' | 'cancelled';
  role: WorkspaceMemberRole;
  canView: boolean;
  canPreview: boolean;
  locked: boolean;
};

export type BotAccessGrantsResponse = {
  botId: string;
  workspaceId: string;
  grants: BotAccessGrantRow[];
};

export type BotAccessGrantPatchItem = {
  subjectType: BotAccessGrantSubjectType;
  userId?: string;
  inviteId?: string;
  canView: boolean;
  canPreview: boolean;
};

/** POST /api/customer/workspaces/:workspaceId/invites */
export type CreateWorkspaceInviteRequest = {
  email: string;
  role?: WorkspaceInviteRole;
  botGrants?: Array<{ botId: string; canView?: boolean; canPreview?: boolean }>;
};

/** GET /api/customer/invites/:token/preview */
export type CustomerInvitePreview = {
  workspaceName: string;
  invitedEmail: string;
  role: WorkspaceInviteRole | 'owner';
  expiresAt: string;
  inviterEmail: string | null;
  inviterName: string | null;
};

/** GET /api/customer/bots list item */
export type CustomerBotListItem = {
  _id: string;
  name: string;
  agentsPackAgent: boolean;
  category: string;
  categories?: string[];
  status: string;
  isPublic: boolean;
  visibility: string;
  createdAt: string | null;
  slug: string;
  primaryColor: string;
  avatarEmoji?: string;
  imageUrl?: string;
  shortDescription?: string;
  activeOrigins?: string[];
  leadCaptureEnabled?: boolean;
  totalConversations?: number;
  totalMessages?: number;
  knowledgeDocs?: number;
  knowledgeFaqs?: number;
  knowledgeSnippets?: number;
  knowledgeDatasheets?: number;
  lastActivityAt?: string | null;
  lastTrainedAt?: string | null;
  workspaceId: string;
  workspaceName?: string;
  workspaceMemberVisibility?: BotWorkspaceMemberVisibility;
  viewAccessPreview?: BotViewAccessPreviewMember[];
  isOverLimitLocked?: boolean;
  lockedReason?: 'workspace_bot_limit_exceeded';
  lockedMessage?: string;
};

/** Member visibility / preview access for workspace members (defaults: both true). */
export type BotWorkspaceMemberVisibility = {
  visibleToMembers: boolean;
  allowMemberPreview: boolean;
};

export type BotViewAccessPreviewMember = {
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
};

/** GET /api/customer/bots/:botId/conversations — origin subset on each row */
export type CustomerConversationOriginSummary = {
  source?: string;
  mode?: string;
  embedType?: string;
  websiteOrigin?: string;
  pageUrl?: string;
  referrer?: string;
};

export type CustomerConversationLocationSummary = {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
};

export type CustomerConversationDeviceSummary = {
  deviceType?: string;
  browser?: string;
  os?: string;
  language?: string;
};

/** GET /api/customer/bots/:botId/conversations list row */
export type CustomerConversationListItem = {
  id: string;
  conversationId: string;
  /** Masked display — not the raw widget visitor id. */
  chatVisitorId: string;
  sessionId?: string;
  userPreview: string;
  assistantPreview: string;
  startedAt: string | null;
  firstUserMessageAt: string | null;
  lastUserMessageAt: string | null;
  lastAssistantMessageAt: string | null;
  lastMessageAt: string | null;
  lastActivityAt: string;
  createdAt: string | null;
  startedFrom: string | null;
  sessionSource: string | null;
  conversationOrigin: CustomerConversationOriginSummary | null;
  location: CustomerConversationLocationSummary | null;
  deviceInfo: CustomerConversationDeviceSummary | null;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalMessages: number;
  textMessageCount: number;
  voiceMessageCount: number;
  dictationMessageCount: number;
  attachmentMessageCount: number;
  suggestedQuestionMessageCount: number;
  totalCreditsUsed: number;
  sourcesUsedCount: number;
  hasLead: boolean;
  hasVoice: boolean;
  hasDictation: boolean;
  hasAttachment: boolean;
  status: string;
  leadFieldKeys?: string[];
  /** Thread-level analytics (same shape as conversation detail). */
  conversationSentiment?: CustomerConversationSentimentSummary;
  conversationTopics?: CustomerConversationTopicsSummary;
};

export type CustomerBotConversationsListParams = {
  limit?: number;
  before?: string | null;
  dateFrom?: string;
  dateTo?: string;
  startedFrom?: string;
  hasLead?: boolean;
  hasVoice?: boolean;
  hasDictation?: boolean;
  hasAttachment?: boolean;
  /** Inclusive bounds on rolling `totalCreditsUsed` (0 if unset on document). Overrides creditsGtZero/creditsZero. */
  minCredits?: number;
  maxCredits?: number;
  /** Preset: strictly more than zero total credits spent. */
  creditsGtZero?: boolean;
  /** Preset: no credits spent (treat missing as zero). */
  creditsZero?: boolean;
  /** Minimum thread message count (inclusive); unset / omitted = any. */
  minMessages?: number;
  deviceType?: string;
  countryCode?: string;
  /** Comma-separated main topic taxonomy ids (`conversationTopics.primaryTopic`, OR). */
  primaryTopics?: string;
  /** Comma-separated ids matched against `conversationTopics.topicLabels` (OR). */
  secondaryTopics?: string;
  /** Comma-separated `conversationSentiment.label` values (OR). */
  sentiments?: string;
};

export type CustomerBotConversationsListResponse = {
  conversations: CustomerConversationListItem[];
  nextCursor: string | null;
};

/** Lead column definitions from merged bot config + historical `capturedLeadData` keys (GET …/leads, GET …/leads/:id). */
export type CustomerLeadFieldDefinition = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  /** Index in bot config array (stable column order). */
  order: number;
  disabled?: boolean;
  /** Present when the field is no longer active but values exist on historical leads. */
  archived?: boolean;
  /** Derived column lifecycle status from merged definitions API (preferred over archived/source alone). */
  fieldStatus?: 'active' | 'inactive' | 'deleted';
  source?: 'current' | 'captured_data';
  enabled?: boolean;
  placeholder?: string;
  options?: string[];
  aliases?: string[];
};

export type CustomerLeadConversationOrigin = {
  pageUrl?: string;
  websiteOrigin?: string;
  referrer?: string;
};

export type CustomerLeadLocation = {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  /** e.g. ip_lookup, browser_timezone */
  source?: string;
};

export type CustomerLeadDeviceInfo = {
  deviceType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
};

/** GET /api/customer/bots/:botId/leads row */
export type CustomerLeadListItem = {
  conversationId: string;
  botId: string;
  capturedLeadData?: Record<string, string>;
  leadFieldKeys?: string[];
  leadCapturedAt: string | null;
  leadSourceMessageId?: string;
  hasLead: boolean;
  startedFrom: string | null;
  sessionSource: string | null;
  lastActivityAt: string | null;
  startedAt: string | null;
  totalMessages: number;
  totalCreditsUsed: number;
  conversationOrigin: CustomerLeadConversationOrigin | null;
  location: CustomerLeadLocation | null;
  deviceInfo: CustomerLeadDeviceInfo | null;
};

export type CustomerBotLeadsListParams = {
  limit?: number;
  /** 1-based page (server-side offset pagination). */
  page?: number;
  /** @deprecated Prefer `page`. Cursor for legacy infinite scroll when `page` is omitted. */
  before?: string | null;
  dateFrom?: string;
  dateTo?: string;
  startedFrom?: string;
  countryCode?: string;
  /** Non-empty `capturedLeadData[fieldKey]` filter (safe key only). */
  fieldKey?: string;
  /** Case-insensitive substring match on any string value in `capturedLeadData`. */
  search?: string;
  /** Filter by analytics-parity complete vs partial lead quality. */
  leadCompletion?: 'complete' | 'partial';
  /** When false, excludes shared/playground preview channels (matches analytics). Omitted = true. */
  includePreview?: boolean;
};

export type CustomerLeadsListResponse = {
  leadFieldDefinitions: CustomerLeadFieldDefinition[];
  leads: CustomerLeadListItem[];
  /** Last-row cursor when another page exists (legacy). */
  nextCursor: string | null;
  /** Total rows matching current filters (all pages). */
  totalMatching: number;
  /** Echo of the requested 1-based page (legacy cursor mode may report `1`). */
  page: number;
  /** True if at least one more row exists after this page. */
  hasNextPage: boolean;
  /** Filtered-set rollup: conversations qualifying as “complete” (same rules as Leads analytics). */
  matchingCompleteLeadsCount: number;
  /** Filtered-set rollup: leads that are not complete under the same rules. */
  matchingPartialLeadsCount: number;
  /** ISO timestamp: max capture/sort time in the filtered set. */
  latestMatchingCapturedAt: string | null;
};

/** GET /api/customer/bots/:botId/leads/:conversationId */
export type CustomerLeadDetail = {
  conversationId: string;
  botId: string;
  leadFieldDefinitions: CustomerLeadFieldDefinition[];
  capturedLeadData?: Record<string, string>;
  /** Snapshot of labels/types at capture time (new chats only). */
  capturedLeadFieldMeta?: Record<string, { label: string; type: string }>;
  /** Field key → visitor message id that last set that captured value (new chats only). */
  capturedLeadFieldMessageIds?: Record<string, string>;
  leadFieldKeys?: string[];
  leadCapturedAt: string | null;
  leadSourceMessageId?: string;
  /** Truncated user message that triggered lead capture (when resolvable). */
  leadSourceMessagePreview?: string;
  hasLead: boolean;
  startedFrom?: string;
  sessionSource?: string;
  status: string;
  startedAt: string | null;
  lastUserMessageAt: string | null;
  lastAssistantMessageAt: string | null;
  lastMessageAt: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalMessages: number;
  totalCreditsUsed: number;
  sourcesUsedCount: number;
  conversationOrigin: CustomerLeadConversationOrigin | null;
  location: CustomerLeadLocation | null;
  deviceInfo: CustomerLeadDeviceInfo | null;
  hasVoice: boolean;
  hasDictation: boolean;
  hasAttachment: boolean;
};

/** GET /api/customer/bots/:botId/conversations/:conversationId */
export type CustomerConversationOriginDetail = {
  source?: string;
  mode?: string;
  embedType?: string;
  pageUrl?: string;
  referrer?: string;
  websiteOrigin?: string;
  parentOrigin?: string;
  iframeUrl?: string;
  sharedUrl?: string;
  shareSlug?: string;
};

export type CustomerConversationLocationDetail = {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  source?: string;
};

export type CustomerConversationDeviceDetail = {
  deviceType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
};

/** Optional analytics sentiment rollup on a conversation thread. */
export type CustomerConversationSentimentSummary = {
  label?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
  score?: number;
};

/** Optional analytics topic rollup on a conversation thread. */
export type CustomerConversationTopicsSummary = {
  primaryTopic?: string;
  topicLabels?: string[];
  primarySubTopic?: string;
  subTopicLabels?: string[];
};

export type CustomerConversationDetail = {
  id: string;
  conversationId: string;
  botId: string;
  chatVisitorId?: string;
  sessionId?: string;
  legacyVisitorId?: string;
  startedFrom?: string;
  sessionSource?: string;
  status: string;
  startedAt: string | null;
  firstUserMessageAt: string | null;
  lastUserMessageAt: string | null;
  lastAssistantMessageAt: string | null;
  lastMessageAt: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  endedAt: string | null;
  conversationOrigin?: CustomerConversationOriginDetail;
  conversationSentiment?: CustomerConversationSentimentSummary;
  conversationTopics?: CustomerConversationTopicsSummary;
  capturedLeadData?: Record<string, string>;
  location?: CustomerConversationLocationDetail;
  deviceInfo?: CustomerConversationDeviceDetail;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalMessages: number;
  textMessageCount: number;
  voiceMessageCount: number;
  dictationMessageCount: number;
  attachmentMessageCount: number;
  suggestedQuestionMessageCount: number;
  quickReplyMessageCount: number;
  totalCreditsUsed: number;
  sourcesUsedCount: number;
  hasLead: boolean;
  leadCapturedAt: string | null;
  leadFieldKeys?: string[];
  leadSourceMessageId?: string;
  /** Truncated user message that triggered lead capture (when resolvable). */
  leadSourceMessagePreview?: string;
  hasVoice: boolean;
  hasDictation: boolean;
  hasAttachment: boolean;
};

export type CustomerConversationMessageSpeechInput = {
  mode: 'dictate' | 'voice';
  transcript?: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
};

export type CustomerConversationMessageAttachment = {
  id?: string;
  name: string;
  mimeType?: string;
  url?: string;
  size?: number;
  createdAt?: string;
  /** Alternate shapes the client may normalize (not all sent by workspace API). */
  filename?: string;
  fileName?: string;
  originalName?: string;
  contentType?: string;
  type?: string;
  mime?: string;
  bytes?: number;
  sizeBytes?: number;
  downloadUrl?: string;
  publicUrl?: string;
  href?: string;
};

export type CustomerConversationMessageSource = {
  sourceType?: string;
  knowledgeBaseItemId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  chunkId?: string;
  score?: number;
  preview?: string;
  docId?: string;
  docTitle?: string;
  usedAt?: string;
  /** Alternate shapes some APIs normalize into titles (workspace may omit if blank). */
  title?: string;
  name?: string;
};

export type CustomerConversationMessageAiMeta = {
  modelUsed?: string;
  responseTimeMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  ragUsed?: boolean;
  sourcesCount?: number;
  fallbackUsed?: boolean;
  errorCode?: string;
  errorMessage?: string;
};

/** Denormalized visitor thumbs on assistant messages (workspace read API). */
export type CustomerConversationMessageFeedback = {
  rating: 'up' | 'down';
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerConversationVoiceMeta = {
  isVoiceMessage?: boolean;
  isDictationMessage?: boolean;
  speechDurationSeconds?: number;
  speechToTextCharacters?: number;
  speechToTextWords?: number;
  transcriptionProvider?: string;
  transcriptionStatus?: string;
  dictationDurationSeconds?: number;
  audioDurationSeconds?: number;
  audioSizeBytes?: number;
  audioMimeType?: string;
  dictationSessionCount?: number;
};

export type CustomerConversationMessageCreditBreakdownRow = {
  key: string;
  label: string;
  count: number;
  creditsEach: number;
  creditsUsed: number;
  billable: boolean;
};

export type CustomerConversationMessageTopics = {
  primaryTopic?: string;
  topicLabels?: string[];
  topicConfidence?: number;
  primarySubTopic?: string;
  subTopicLabels?: string[];
};

export type CustomerConversationMessageSentiment = {
  label?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
  score?: number;
};

export type CustomerConversationMessage = {
  id: string;
  messageId: string;
  role: string;
  content: string;
  text: string;
  createdAt: string;
  speechInput?: CustomerConversationMessageSpeechInput;
  attachments?: CustomerConversationMessageAttachment[];
  inputType?: string;
  inputMethod?: string;
  voiceMeta?: CustomerConversationVoiceMeta;
  creditCost?: number;
  creditReason?: string;
  billingType?: string;
  quotaPeriod?: string;
  chargedAt?: string;
  creditBreakdown?: CustomerConversationMessageCreditBreakdownRow[];
  topics?: CustomerConversationMessageTopics;
  sentiment?: CustomerConversationMessageSentiment;
  sources?: CustomerConversationMessageSource[];
  aiMeta?: CustomerConversationMessageAiMeta;
  feedback?: CustomerConversationMessageFeedback | null;
  /** Opening assistant line persisted when a conversation is created. */
  isWelcomeMessage?: boolean;
};

/** POST /api/customer/bots/:id/datasheets/preview (multipart `file`) */
export type CustomerDatasheetPreviewResponse = {
  ok: true;
  importSessionId: string;
  fileName: string;
  columns: string[];
  previewRows: string[][];
  fileSizeBytes: number;
  totalDataRows: number;
  estimatedDataRows?: number;
};

/** POST /api/customer/bots/:id/datasheets/import-cancel (JSON body) */
export type CustomerDatasheetImportCancelResponse = {
  ok: true;
  /** Present when cancel was a no-op because the session was already cancelled. */
  alreadyCancelled?: boolean;
};

/** POST /api/customer/bots/:id/datasheets/import-confirm (JSON body) */
export type CustomerDatasheetImportConfirmResponseBase = {
  ok: true;
  botId: string;
  knowledgeBaseItemId: string;
  importJobId: string;
  sheetIndex: number;
  tableImportDisplayState: string;
  idempotent?: boolean;
  httpAccepted?: true;
};

/** @deprecated Use {@link CustomerDatasheetImportConfirmResponseBase} / import-confirm */
export type CustomerDatasheetImportResponse = {
  ok: true;
  botId: string;
  sheetIndex: number;
  sourceFile: { bucket: string; key: string };
};

export type CustomerKnowledgeCsvImportErrorDetail = {
  row: number;
  column: string;
  message: string;
};

export type CustomerKnowledgeCsvImportResponse = {
  ok: true;
  imported: number;
  skippedDueToCapacity?: number;
  fileName: string;
};

export type CustomerKnowledgeCsvSampleResponse = {
  fileName: string;
  content: string;
};

/** Subset of `leadCapture` aligned with backend `BotLeadCaptureV2` / workspace PATCH. */
export type CustomerLeadField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'url';
  required?: boolean;
  disabled?: boolean;
  aliases?: string[];
};

export type CustomerLeadCapture = {
  enabled?: boolean;
  fields?: CustomerLeadField[];
  askStrategy?: 'soft' | 'balanced' | 'direct';
  politeMode?: boolean;
  captureMode?: 'chat' | 'form' | 'hybrid';
};

/** Canonical KB training lifecycle — same for documents (ingest), FAQ, snippets, tables, suggestions, overview. */
export type KnowledgeTrainingStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  /** API/polling only — DB items use `failed` + `trainingError=plan_limit_bot_kb_total`. */
  | 'out_of_storage';

/** @deprecated Use `KnowledgeTrainingStatus` */
export type CustomerKnowledgeItemTrainingStatus = KnowledgeTrainingStatus;

/**
 * Removing KB content from the customer app:
 * - **Documents** — `DELETE …/documents/:id` and `POST …/documents/bulk-delete` (soft-delete server-side; hard purge is internal).
 * - **FAQ, snippets, datasheets rows, suggested chips** — `POST …/knowledge/items/bulk-delete` with `{ itemIds }` (same rules as legacy per-item delete), or section `PATCH/PUT …/knowledge/…` when replacing shortened lists; do not rely on sparse `PATCH …/bots/:id` for KB content.
 */

/** `GET/POST/PATCH` `/api/customer/bots/:id/knowledge/...` overview + training control responses. */
export type CustomerKnowledgeByTypeBlock = {
  items: number;
  characters: number;
  rows?: number;
};

/** Matches backend `KnowledgeUsageApiPayload` — UTF-8 byte totals for trainable KB. */
export type CustomerKnowledgeSectionLimits = {
  faqTotalMaxBytes: number;
  snippetTotalMaxBytes: number;
  suggestionTotalMaxBytes: number;
};

export type CustomerKnowledgeUsage = {
  totalBytes: number;
  /** Bytes eligible to train (excludes `out_of_storage` rows); defaults to `totalBytes` if omitted. */
  trainableBytes?: number;
  maxBytes: number;
  remainingBytes: number;
  percentUsed: number;
  documentBytes: number;
  faqBytes: number;
  noteBytes: number;
  tableBytes: number;
  suggestionBytes: number;
  sectionLimits: CustomerKnowledgeSectionLimits;
};

export type KnowledgeReplyPriorityMode = 'default' | 'priority';
export type KnowledgeReplyPrioritySourceType =
  | 'faq'
  | 'note'
  | 'table'
  | 'document'
  | 'suggestion';
export type KnowledgeReplyPrioritySettings = {
  mode: KnowledgeReplyPriorityMode;
  sourceOrder: KnowledgeReplyPrioritySourceType[];
};

export type CustomerKnowledgeOverviewResponse = {
  botId: string;
  knowledgeTraining: {
    autoTrainEnabled: boolean;
    trainingDelayMinutes: number;
    scheduleMode?: 'smart' | 'fixed';
  };
  knowledgeReplyPriority?: KnowledgeReplyPrioritySettings;
  knowledgeStats: {
    totalCharacters: number;
    totalItems: number;
    readyCharacters: number;
    pendingCharacters: number;
    queuedCharacters: number;
    processingCharacters: number;
    failedCharacters: number;
    uiOnlyCharacters: number;
    readyItems: number;
    pendingItems: number;
    queuedItems: number;
    processingItems: number;
    failedItems: number;
    uiOnlyItems: number;
    byType: {
      snippets: CustomerKnowledgeByTypeBlock;
      qna: CustomerKnowledgeByTypeBlock;
      documents: CustomerKnowledgeByTypeBlock;
      datasheets: CustomerKnowledgeByTypeBlock;
      suggestions: CustomerKnowledgeByTypeBlock;
    };
    lastUpdatedAt?: string;
    lastQueuedAt?: string;
    lastTrainingStartedAt?: string;
    lastTrainedAt?: string;
  };
  queue: {
    queuedItems: number;
    queuedCharacters: number;
    processingItems: number;
    processingCharacters: number;
    nextRunAfter?: string;
    lastQueuedAt?: string;
    estimatedTrainingSeconds: number;
    estimatedLabel: string;
  };
  pending: { items: number; characters: number };
  failed: { items: number; characters: number };
  knowledgeUsage: CustomerKnowledgeUsage;
};

/** GET `/api/customer/bots/:id/knowledge/training/pending-items` */
export type CustomerPendingTrainingSectionType =
  | 'document'
  | 'faq'
  | 'note'
  | 'table'
  | 'suggestion';

/** Matches GET `/knowledge/training/pending-items` row badges */
export type CustomerPendingTrainingItemDisplayStatus =
  | 'needs_training'
  | 'failed'
  | 'scheduled'
  | 'extraction_failed'
  | 'in_training'
  | 'training_queued';

export type CustomerPendingTrainingItemsResponse = {
  total: number;
  sections: Array<{
    type: CustomerPendingTrainingSectionType;
    label: string;
    count: number;
    items: Array<{
      id: string;
      title: string;
      displayStatus: CustomerPendingTrainingItemDisplayStatus;
      /** ISO `runAfter` for `scheduled` (future) or `training_queued` when set (countdown / “Training soon”). */
      nextRunAfter?: string | null;
    }>;
  }>;
};

/** Canonical phase from GET `/knowledge/training/status` (`displayPhase`). */
export type CustomerAgentTrainingDisplayPhase =
  | 'empty'
  | 'ready'
  | 'training_required'
  | 'extracting'
  | 'importing'
  | 'training'
  | 'partially_ready'
  | 'failed';

/** GET `/api/customer/bots/:id/knowledge/training/status` — POST retrain-agent adds optional `affectedTypes`. */
export type CustomerAgentTrainingStatusResponse = {
  status: 'trained' | 'training' | 'needs_training' | 'failed';
  /** Short English headline; aligned with {@link displayPhase}. */
  label: string;
  /** Preferred single field for headline priority + styling. */
  displayPhase?: CustomerAgentTrainingDisplayPhase;
  isTraining: boolean;
  /** True when any `dataSources[].trainingQueued` &gt; 0. */
  training_queued?: boolean;
  /** True while document text extraction is in progress (`extractionStatus` pipeline). */
  isTextExtracting: boolean;
  /** Preferred alias for {@link isTextExtracting}. */
  isExtracting?: boolean;
  /** True while a datasheet/table async import is in progress. */
  isImporting?: boolean;
  isTrained: boolean;
  needsTraining: boolean;
  hasFailed: boolean;
  /** `pending` = action-needed items (pending + failed + future-scheduled queued, etc.). */
  counts: {
    pending: number;
    /** Queued and due now (runAfter missing/null or ≤ now), excluding future-scheduled rows */
    queued: number;
    processing: number;
    ready: number;
    failed: number;
    total: number;
  };
  characters: {
    pending: number;
    queued: number;
    processing: number;
    ready: number;
    failed: number;
    total: number;
  };
  lastQueuedAt?: string | null;
  lastTrainingStartedAt?: string | null;
  lastTrainedAt?: string | null;
  nextRunAfter?: string | null;
  estimatedTrainingSeconds: number;
  estimatedLabel: string;
  lifecycleCounts?: {
    extractingCount: number;
    extractionFailedCount: number;
    datasheetImportPipelineCount?: number;
    trainingQueuedCount: number;
    trainingProcessingCount: number;
    trainingFailedCount: number;
    readyCount: number;
  };
  /** Per data source — same buckets as overview “Data sources”. */
  dataSources: CustomerAgentTrainingDataSourceRow[];
  /** Present on POST `/knowledge/training/retrain-agent` — sections to refetch lightweight status. */
  affectedTypes?: CustomerPendingTrainingSectionType[];
  /** UTF-8 storage usage vs quota (same shape as overview `knowledgeUsage`). */
  knowledgeUsage: CustomerKnowledgeUsage;
};

export type CustomerAgentTrainingDataSourceRow = {
  key: 'documents' | 'qna' | 'snippets' | 'datasheets' | 'suggestions';
  trainingRequired: number;
  /** Lifecycle `queued` count per bucket; omit on older API responses. */
  trainingQueued?: number;
  inTraining: number;
  trained: number;
  failed: number;
  total: number;
};

/** `GET` `/api/customer/bots/:id/knowledge/status?type=...` */
export type CustomerKnowledgeStatusItem = {
  id: string;
  /** When `false`, item is not used in replies (mirrors KB `active`). */
  active?: boolean;
  status: KnowledgeTrainingStatus;
  /** Customer-facing display status (e.g. `out_of_storage`) while `status` stays the DB lifecycle value. */
  trainingStatus?: string;
  lastQueuedAt?: string | null;
  runAfter?: string | null;
  lastTrainingStartedAt?: string | null;
  lastTrainedAt?: string | null;
  /** Mirrors backend `KnowledgeBaseItem.trainingError` (embedding/train phase only). */
  trainingError?: string | null;
  /** Document rows: mirrors `KnowledgeBaseItem.extractionStatus`. */
  extractionStatus?: string;
  extractionError?: string | null;
  /** Backend composite UX key — prefer over inferring from `status`. */
  displayStatus?: string;
  /** Human-readable status line from API bundle; prefer when set. */
  displayLabel?: string;
  displayMessage?: string | null;
  faqIndex?: number;
  snippetIndex?: number;
  tableIndex?: number;
  suggestionIndex?: number;
  /** Mirrors backend `sourceType` on KB rows (e.g. `document`). */
  sourceType?: string;
  /** ISO — manual retry stuck heuristic for table import / row age */
  updatedAt?: string | null;
  /** Legacy alias when route id differed from KB `_id`; prefer `id`. */
  documentId?: string;
  /** Document-linked rows: mirrors latest IngestJob.status for merge + debugging. */
  latestIngestJobStatus?: string | null;
  documentStatus?: KnowledgeTrainingStatus | string;
  knowledgeItemStatus?: KnowledgeTrainingStatus | string;
  extractManualRetrySuggested?: boolean;
  trainingManualRetrySuggested?: boolean;
  /** When training failed after stuck recovery cap; stable if `trainingError` is humanized. */
  trainingFailureCode?: string | null;
  /** When backend `KB_TRAINING_LOGS` / legacy `DEBUG_KB_TRAINING` verbose mode; otherwise omitted. */
  embeddedChunkCount?: number;
  /** Document rows: UTF-8 byte size of stored trainable text (lightweight status poll). */
  storedTextUtf8Bytes?: number;
  /** Parallel to `status` from lightweight status API (import/extract flags). */
  isImporting?: boolean;
  isExtracting?: boolean;
  isTraining?: boolean;
};

export type CustomerKnowledgeStatusResponse = {
  items: CustomerKnowledgeStatusItem[];
};

/** `POST` `/api/customer/bots/:botId/knowledge/items/:itemId/retry` */
export type CustomerKnowledgeItemManualRetryResponse = {
  ok: true;
  action:
    | 'retry_extraction'
    | 'retry_training'
    | 'retry_import'
    | 'reset_stuck_extraction'
    | 'reset_stuck_training'
    | 'reset_stuck_import';
  status: string;
  extractionStatus: string;
  displayStatus: string;
  displayMessage: string;
};

/** Q&A group from KB (`PATCH` `faqs`). Legacy rows may only have `question` + `answer`. */
export type CustomerKnowledgeFaq = {
  /** Group label shown in the library. */
  title?: string;
  /** Phrasing variants for retrieval; first maps to `question` for older clients. */
  questions?: string[];
  question: string;
  answer: string;
  active?: boolean;
  /** Index in persisted `faqs` array — used for KB status polling. */
  faqIndex?: number;
  knowledgeItemId?: string;
  trainingStatus?: CustomerKnowledgeItemTrainingStatus;
  lastTrainedAt?: string | null;
  /** Next scheduled training run (ISO), when queued with a delay. */
  runAfter?: string | null;
};

export type CustomerKnowledgeSnippet = {
  title: string;
  snippet: string;
  active?: boolean;
  snippetIndex?: number;
  knowledgeItemId?: string;
  trainingStatus?: CustomerKnowledgeItemTrainingStatus;
  lastTrainedAt?: string | null;
  runAfter?: string | null;
};

export type CustomerKnowledgeDatasheet = {
  title: string;
  columns: string[];
  rows: string[][];
  active?: boolean;
  tableIndex?: number;
  /** KnowledgeBaseItem `_id` for stable status polling merges after reorder/delete */
  knowledgeItemId?: string;
  /** KB pipeline status for this datasheet (from `GET` bot). */
  trainingStatus?: CustomerKnowledgeItemTrainingStatus;
  lastTrainedAt?: string | null;
  runAfter?: string | null;
  /** Original import file size in bytes, when available. */
  importFileSize?: number | null;
  importFileName?: string | null;
};

/** Document row from GET `/api/customer/bots/:botId/documents` (list). */
export type CustomerWorkspaceDocument = {
  _id?: string | { toString(): string };
  /** KB row id (mirrors `knowledgeItemId` / `_id` as string). */
  id?: string;
  botId?: string | { toString(): string };
  /** Preferred document title/name from enriched list/detail API. */
  displayName?: string;
  title?: string;
  sourceType?: string;
  status?: string;
  /** Server-derived pipeline message — prefer over local heuristics when set. */
  displayMessage?: string | null;
  /** Prefer over reconstructing titles from filenames. */
  displayLabel?: string;
  displayStatus?: string;
  extractionStatus?: string;
  extractionError?: string | null;
  extractManualRetrySuggested?: boolean;
  trainingManualRetrySuggested?: boolean;
  /** Human-readable label for `status` / `documentStatus` after list/detail enrichment (pipeline stage). */
  statusLabel?: string;
  error?: string;
  ingestedAt?: string | Date;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  active?: boolean;
  createdAt?: string | Date;
  /** Populated on GET single-document when ingested. */
  text?: string;
  /** Linked KnowledgeBaseItem id when known (server-enriched). */
  knowledgeItemId?: string;
  /**
   * With server enrichment: **collective pipeline stage** (upload → extract → train), same codes as `status`.
   * Omit on un-enriched rows / legacy responses (then often upload lifecycle only).
   */
  documentStatus?: string;
  knowledgeItemStatus?: string;
  latestIngestJobStatus?: string | null;
  embeddedChunkCount?: number;
  trainingStatus?: KnowledgeTrainingStatus;
  /** True when backend can resolve storage (private S3 or public URL). */
  hasFile?: boolean;
  /** Relative URL path suffix for fetching a signed download URL (list rows). */
  downloadUrlPath?: string;
  /** Present on document detail when `hasFile` — short-lived signed URL or public file URL. */
  downloadUrl?: string;
  /** From extractedKnowledge text after ingestion (not file byte size). */
  characterCount?: number;
  /** Server: true once trainable document text has been persisted (extraction / manual body). */
  isContentExtracted?: boolean;
  /** Same as `content` length when persisted (UTF-16 code units). */
  extractedTextLength?: number;
  /** Merged from KB status poll: UTF-8 size of stored document text while list rows refresh. */
  storedTextUtf8Bytes?: number;
  /** From lightweight KB status poll — parallel to extraction pipeline. */
  isExtracting?: boolean;
  isTraining?: boolean;
  isImporting?: boolean;
  /** Upload lifecycle only (not KB training). */
  uploadStatus?: string;
  originalName?: string;
  /** Original upload filename when API uses this field name (alias of `originalName` / `fileName`). */
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
};

/** Subset of `personality` aligned with backend `BotPersonality` / workspace PATCH. */
export type CustomerBotPersonality = {
  name?: string;
  description?: string;
  systemPrompt?: string;
  behaviorPreset?: string;
  tone?: string;
  language?: string;
  thingsToAvoid?: string;
};

export type CustomerBotTranslationSettings = {
  enabled?: boolean;
  mode?: 'english_only' | 'auto' | 'fixed';
  fixedLanguage?: string;
  transcriptLanguage?: 'english';
};

/** GET /api/customer/bots/:id — `bot` subset used by onboarding and workspace UI. */
export type CustomerBotDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  /** Bot avatar image URL (widget / profile). */
  imageUrl?: string;
  /** Single emoji used when no custom image URL is set. */
  avatarEmoji?: string;
  /** Persisted avatar mode (legacy bots infer from `imageUrl` / `avatarEmoji`). */
  avatarSource?: 'upload' | 'url' | 'emoji' | 'none';
  category?: string;
  categories?: string[];
  knowledgeDescription?: string;
  knowledgeSnippets?: CustomerKnowledgeSnippet[];
  knowledgeDatasheets?: CustomerKnowledgeDatasheet[];
  welcomeMessage?: string;
  /** When false, welcome text is kept but not shown in the widget. */
  welcomeMessageEnabled?: boolean;
  status: string;
  isPublic?: boolean;
  visibility?: string;
  faqs?: CustomerKnowledgeFaq[];
  /**
   * Legacy: `string`. New: `{ label, context?, suggestionIndex?, knowledgeItemId?, trainingStatus? }`.
   * Optional `context` limits the first reply to that text (no full KB).
   */
  exampleQuestions?: Array<
    | string
    | {
        label: string;
        context?: string;
        active?: boolean;
        /** Widget: do not show this suggestion’s chip in chat. */
        hideChipTextInChat?: boolean;
        suggestionIndex?: number;
        knowledgeItemId?: string;
        trainingStatus?: CustomerKnowledgeItemTrainingStatus;
        lastTrainedAt?: string | null;
      }
  >;
  personality?: CustomerBotPersonality;
  translationSettings?: CustomerBotTranslationSettings;
  config?: Record<string, unknown>;
  allowedOrigins?: Array<{ origin: string; label?: string; isActive?: boolean }>;
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  leadCapture?: CustomerLeadCapture;
  chatUI?: unknown;
  clientDraftId?: string;
  accessKey?: string;
  secretKey?: string;
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
  /** Hosted share page (`/share/:slug`) — safe subset; no secrets. */
  shareChat?: {
    enabled?: boolean;
    slug?: string;
    expiresAt?: string | null;
    allowDraft?: boolean;
    /** Always true for new share preview; token + expiry required server-side. */
    requiresPreviewToken?: boolean;
    /** True when token hash + expiry are stored (legacy links may be false). */
    secureSharePreviewConfigured?: boolean;
    /** Present after owner revokes the preview link (safe metadata only). */
    tokenRevokedAt?: string | null;
  };
  knowledgeReplyPriority?: KnowledgeReplyPrioritySettings;
  workspaceMemberVisibility?: BotWorkspaceMemberVisibility;
  /** ISO timestamp: last document ingest used as training signal (see list stats). */
  lastTrainedAt?: string | null;
  /** UTF-8 KB storage usage vs agent quota (GET bot). */
  knowledgeUsage?: CustomerKnowledgeUsage;
};

/** POST /api/customer/bots/:id/lifecycle-action — success JSON body */
export type CustomerBotLifecycleResponse =
  | {
      ok: true;
      action: 'publish';
      status: 'published';
      embedSnippet: string;
      accessKey: string;
      allowedOrigins: string[];
    }
  | { ok: true; action: 'draft'; status: 'draft' };

/** GET /api/customer/bots/:id */
export type CustomerBotDetailResponse = {
  ok: true;
  bot: CustomerBotDetail & Record<string, unknown>;
  health: Record<string, unknown>;
};

/** GET /api/customer/bots/:id/insights */
export type CustomerBotInsightsResponse = {
  schemaVersion: 1;
  bot: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  metrics: {
    totalConversations: number;
    totalMessages: number;
    conversationsWithCapturedLeads: number;
    knowledgeDocuments: number;
  };
  activity: {
    lastActivityAt: string | null;
  };
};

export type CustomerChatsAnalyticsGranularity = 'hour' | 'day' | 'week' | 'month';

export type CustomerChatsAnalyticsRange = {
  from: string;
  to: string;
  granularity: CustomerChatsAnalyticsGranularity;
};

export type CustomerChatsAnalyticsSummary = {
  totalConversations: number;
  totalMessages: number;
  /** User-role message count in range (newer API). */
  totalUserMessages?: number;
  /** User messages with text-like input (present on newer API builds). */
  userTextMessages?: number;
  /** User messages with voice or dictation input. */
  userVoiceMessages?: number;
  totalThumbsUp: number;
  totalThumbsDown: number;
  averageMessagesPerConversation: number;
};

export type CustomerChatsAnalyticsTimeSeriesPoint = {
  date: string;
  conversations: number;
  messages: number;
  /** Per-bucket user messages (role=user). */
  userMessages?: number;
  /** User text-like messages in this bucket. */
  textMessages?: number;
  /** User voice/dictation messages in this bucket. */
  voiceMessages?: number;
  thumbsUp: number;
  thumbsDown: number;
};

export type CustomerChatsAnalyticsStartedFromKey =
  | 'playground_preview'
  | 'shared_preview'
  | 'runtime_widget'
  | 'runtime_iframe'
  | 'unknown';

export type CustomerChatsAnalyticsCountryRow = {
  country: string | null;
  countryCode: string | null;
  conversations: number;
  messages: number;
};

export type CustomerChatsAnalyticsCityRow = {
  city: string | null;
  countryCode: string | null;
  conversations: number;
  messages: number;
};

export type CustomerChatsAnalyticsTopPageRow = {
  page: string;
  pageLabel: string;
  websiteOrigin: string | null;
  conversations: number;
  messages: number;
};

export type CustomerChatsAnalyticsStartedFromBreakdownItem = {
  key: CustomerChatsAnalyticsStartedFromKey;
  label: string;
  conversations: number;
  messages: number;
};

export type AnalyticsHistoryWindowMetadata = {
  analyticsWindowApplied: boolean;
  analyticsHistoryDays: number;
  effectiveFrom: string;
  requestedFrom?: string;
};

/** GET /api/customer/bots/:id/analytics/chats */
export type CustomerChatsAnalyticsResponse = {
  range: CustomerChatsAnalyticsRange;
  summary: CustomerChatsAnalyticsSummary;
  timeSeries: CustomerChatsAnalyticsTimeSeriesPoint[];
  locationBreakdown: {
    countries: CustomerChatsAnalyticsCountryRow[];
    cities: CustomerChatsAnalyticsCityRow[];
  };
  topPagesBreakdown: CustomerChatsAnalyticsTopPageRow[];
  startedFromBreakdown: CustomerChatsAnalyticsStartedFromBreakdownItem[];
  analyticsWindow?: AnalyticsHistoryWindowMetadata;
};

export type CustomerBotChatsAnalyticsParams = {
  from?: string;
  to?: string;
  granularity?: CustomerChatsAnalyticsGranularity;
  includePreview?: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
  countryCode?: string;
  deviceType?: string;
};

/** Main topic ids for GET …/analytics/topics (matches backend `TOPIC_TAXONOMY_IDS`). */
export const CUSTOMER_TOPICS_ANALYTICS_MAIN_TOPIC_IDS = [
  'pricing',
  'billing',
  'subscription',
  'refund',
  'product_question',
  'technical_support',
  'bug_report',
  'account_access',
  'setup_onboarding',
  'integration',
  'api_webhook',
  'sales',
  'demo_request',
  'human_agent',
  'lead_capture',
  'order_status',
  'shipping_delivery',
  'returns_exchange',
  'appointment_booking',
  'documentation',
  'feature_request',
  'complaint',
  'feedback',
  'security_privacy',
  'compliance',
  'cancellation',
  'trial',
  'usage_limits',
  'general_question',
  'other',
] as const;

export type CustomerTopicsAnalyticsTopicId = (typeof CUSTOMER_TOPICS_ANALYTICS_MAIN_TOPIC_IDS)[number];

export type CustomerTopicsAnalyticsSummary = {
  totalUserMessages: number;
  classifiedMessages: number;
  unclassifiedMessages: number;
  conversationsWithTopics: number;
  topTopic: CustomerTopicsAnalyticsTopicId | null;
  topicCoverageRate: number;
};

export type CustomerTopicsAnalyticsTimeSeriesPoint = {
  date: string;
  classifiedMessages: number;
  unclassifiedMessages: number;
} & Record<CustomerTopicsAnalyticsTopicId, number>;

/** Unique conversations per topic per bucket (not message counts). */
export type CustomerTopicsAnalyticsConversationTopicSeriesPoint = {
  date: string;
} & Record<CustomerTopicsAnalyticsTopicId, number>;

export type CustomerTopicBreakdownByMessagesItem = {
  topic: CustomerTopicsAnalyticsTopicId;
  label: string;
  messages: number;
  conversations: number;
  percentage: number;
};

export type CustomerTopicBreakdownByConversationItem = {
  topic: CustomerTopicsAnalyticsTopicId;
  label: string;
  conversations: number;
  percentage: number;
};

/** @deprecated Use CustomerTopicBreakdownByMessagesItem */
export type CustomerTopicBreakdownItem = CustomerTopicBreakdownByMessagesItem;

export type CustomerTopicsFastestGrowingItem = {
  topic: CustomerTopicsAnalyticsTopicId;
  label: string;
  currentCount: number;
  previousCount: number;
  change: number;
  changePercent: number | null;
  growthLabel: 'New' | null;
  messages: number;
  conversations: number;
};

/** Per-topic sentiment counts on user messages (multi-tag messages count toward each topic). */
export type CustomerTopicSentimentBreakdownItem = {
  topic: CustomerTopicsAnalyticsTopicId;
  label: string;
  totalMessages: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  unknown: number;
};

/** GET /api/customer/bots/:id/analytics/topics */
export type CustomerTopicsAnalyticsResponse = {
  range: CustomerChatsAnalyticsRange;
  summary: CustomerTopicsAnalyticsSummary;
  /** @deprecated Use topicMessageTimeSeries */
  timeSeries: CustomerTopicsAnalyticsTimeSeriesPoint[];
  /** @deprecated Use topicConversationTimeSeries */
  conversationTopicSeries?: CustomerTopicsAnalyticsConversationTopicSeriesPoint[];
  /** @deprecated Use topicBreakdownByMessages */
  topicBreakdown: CustomerTopicBreakdownByMessagesItem[];
  /** @deprecated Use fastestGrowingByMessages */
  fastestGrowingTopics?: CustomerTopicsFastestGrowingItem[];

  topicBreakdownByMessages: CustomerTopicBreakdownByMessagesItem[];
  topicBreakdownByConversations: CustomerTopicBreakdownByConversationItem[];
  topicMessageTimeSeries: CustomerTopicsAnalyticsTimeSeriesPoint[];
  topicConversationTimeSeries: CustomerTopicsAnalyticsConversationTopicSeriesPoint[];
  fastestGrowingByMessages: CustomerTopicsFastestGrowingItem[];
  fastestGrowingByConversations: CustomerTopicsFastestGrowingItem[];
  topicSentimentBreakdown: CustomerTopicSentimentBreakdownItem[];
};

export type CustomerTopicAnalyticsParams = {
  from?: string;
  to?: string;
  granularity?: CustomerChatsAnalyticsGranularity;
  includePreview?: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
  topic?: CustomerTopicsAnalyticsTopicId;
  /** Message charts: `primary` = only `topics.primaryTopic`; `all` = labels when present else primary (default). */
  messageTopicScope?: 'all' | 'primary';
};

/** GET /api/customer/bots/:id/analytics/sentiment */
export type CustomerSentimentLabelId =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'mixed'
  | 'unknown';

export type CustomerSentimentAnalyticsSummary = {
  totalUserMessages: number;
  classifiedMessages: number;
  unclassifiedMessages: number;
  sentimentCoverageRate: number;
  averageSentimentScore: number | null;
  dominantSentiment: CustomerSentimentLabelId | null;
  negativeMessages: number;
  mixedMessages: number;
  /** Distinct conversations with at least one user message in range (after filters). */
  totalConversations: number;
  /** Distinct conversations with at least one classified user message in range. */
  classifiedConversations: number;
  /** Distinct conversations with no classified user message in range. */
  unclassifiedConversations: number;
  /** Distinct conversations with at least one negative user message in range. */
  negativeConversations: number;
  /** Distinct conversations with at least one mixed user message in range. */
  mixedConversations: number;
};

export type CustomerSentimentAnalyticsTimeSeriesPoint = {
  date: string;
  classifiedMessages: number;
  unclassifiedMessages: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  unknown: number;
  averageSentimentScore: number | null;
};

/** Per bucket: distinct chats that started in the bucket, one thread-level sentiment label each. */
export type CustomerSentimentAnalyticsConversationTimeSeriesPoint = {
  date: string;
  classifiedConversations: number;
  unclassifiedConversations: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  unknown: number;
  averageSentimentScore: number | null;
};

export type CustomerSentimentBreakdownItem = {
  sentiment: CustomerSentimentLabelId;
  label: string;
  messages: number;
  conversations: number;
  percentage: number;
  averageScore: number | null;
};

export type CustomerSentimentAnalyticsStartedFromBreakdownItem = {
  startedFrom: CustomerChatsAnalyticsStartedFromKey;
  label: string;
  messages: number;
  conversations: number;
  averageScore: number | null;
};

export type CustomerSentimentAnalyticsResponse = {
  range: CustomerChatsAnalyticsRange;
  summary: CustomerSentimentAnalyticsSummary;
  timeSeries: CustomerSentimentAnalyticsTimeSeriesPoint[];
  conversationTimeSeries: CustomerSentimentAnalyticsConversationTimeSeriesPoint[];
  sentimentBreakdown: CustomerSentimentBreakdownItem[];
  startedFromBreakdown: CustomerSentimentAnalyticsStartedFromBreakdownItem[];
};

export type CustomerSentimentAnalyticsParams = {
  from?: string;
  to?: string;
  granularity?: CustomerChatsAnalyticsGranularity;
  includePreview?: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
  sentiment?: CustomerSentimentLabelId;
};

/** Primary source / KB citation enums (agent-resources analytics, persisted `KnowledgeMessage.sources`). */
export type CustomerKnowledgeSourcesAnalyticsSourceType =
  | 'document'
  | 'faq'
  | 'note'
  | 'datasheet'
  | 'suggestion'
  | 'website'
  | 'manual_text'
  | 'unknown';

export type CustomerKnowledgeSourcesAnalyticsRange = {
  from: string;
  to: string;
  granularity: CustomerChatsAnalyticsGranularity;
};

/** GET /api/customer/bots/:id/analytics/agent-resources */
export type CustomerAgentResourcesAnalyticsRange = {
  from: string;
  to: string;
  granularity: CustomerChatsAnalyticsGranularity;
  includePreview: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
};

export type CustomerAgentResourcesUsageCreditRule = {
  usageType: string;
  label: string;
  credits: number;
  enabled: boolean;
  billable: boolean;
  /**
   * When false, billed UI splits do not multiply counts by `credits` for this modality (rollup matches server totals).
   * When absent, behave as true.
   */
  includeInTotalCredits?: boolean;
};

/** Coherent Usage-in-range row from credit breakdown (`count × creditsEach = creditsUsed`). */
export type CustomerAgentResourcesUsageComponentRow = {
  key: string;
  label: string;
  count: number;
  creditsEach: number;
  creditsUsed: number;
  billable: boolean;
};

export type CustomerAgentResourcesUsageSummary = {
  totalCreditsUsed: number;
  /** Ledger rollup when it differs from coherent breakdown-derived `totalCreditsUsed`. */
  ledgerCreditsTotal?: number;
  /** Present on current API — drives Usage-in-range formulas without mixing aggregates. */
  componentRows?: CustomerAgentResourcesUsageComponentRow[];
  textMessages: number;
  voiceMessages: number;
  voiceDictationSessions: number;
  /** Deprecated for display: merged into `textMessages` / text credits in analytics APIs. Always `0` when present. */
  suggestedQuestionMessages: number;
  averageCreditsPerMessage: number | null;
  /**
   * Credits attributed to each modality bucket from persisted message breakdowns,
   * scaled per period so stacks match `totalCreditsUsed`. Omitted on older API responses.
   */
  textCreditsAttributed?: number;
  voiceCreditsAttributed?: number;
  dictationCreditsAttributed?: number;
  /** Deprecated for display: merged into `textCreditsAttributed`. */
  suggestedQuestionCreditsAttributed?: number;
};

export type CustomerAgentResourcesUsageTimePoint = {
  date: string;
  totalCreditsUsed: number;
  textMessages: number;
  voiceMessages: number;
  voiceDictationSessions: number;
  /** Deprecated for display: merged into text counts/credits client- and server-side. */
  suggestedQuestionMessages: number;
  textCreditsAttributed?: number;
  voiceCreditsAttributed?: number;
  dictationCreditsAttributed?: number;
  /** Deprecated for display: merged into `textCreditsAttributed`. */
  suggestedQuestionCreditsAttributed?: number;
};

export type CustomerAgentResourcesKbSummary = {
  messagesWithSources: number;
  messagesWithoutSources: number;
  primarySourceUses: number;
  uniquePrimarySources: number;
  topPrimarySource: {
    knowledgeBaseItemId: string | null;
    sourceTitle: string | null;
    sourceType: CustomerKnowledgeSourcesAnalyticsSourceType;
    primarySourceUses: number;
  } | null;
  averagePrimarySourceScore: number | null;
};

export type CustomerAgentResourcesKbTimePoint = Record<string, string | number> & {
  date: string;
  messagesWithSources: number;
};

export type CustomerAgentResourcesKbPrimaryTypeBreakdownItem = {
  sourceType: CustomerKnowledgeSourcesAnalyticsSourceType;
  label: string;
  primarySourceUses: number;
  averageScore: number | null;
};

export type CustomerAgentResourcesTopPrimarySourceItem = {
  knowledgeBaseItemId: string | null;
  sourceTitle: string | null;
  sourceType: CustomerKnowledgeSourcesAnalyticsSourceType;
  sourceUrl: string | null;
  primarySourceUses: number;
  assistantMessages: number;
  averageScore: number | null;
  lastUsedAt: string | null;
};

export type CustomerAgentResourcesAnalyticsResponse = {
  range: CustomerAgentResourcesAnalyticsRange;
  usage: {
    summary: CustomerAgentResourcesUsageSummary;
    creditRules: CustomerAgentResourcesUsageCreditRule[];
    timeSeries: CustomerAgentResourcesUsageTimePoint[];
  };
  knowledgeBase: {
    summary: CustomerAgentResourcesKbSummary;
    timeSeries: CustomerAgentResourcesKbTimePoint[];
    sourceTypeBreakdown: CustomerAgentResourcesKbPrimaryTypeBreakdownItem[];
    topPrimarySources: CustomerAgentResourcesTopPrimarySourceItem[];
  };
};

export type CustomerBotAgentResourcesAnalyticsParams = {
  from?: string;
  to?: string;
  granularity?: CustomerChatsAnalyticsGranularity;
  includePreview?: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
};

/** GET /api/customer/bots/:botId/knowledge/items/:itemId/primary-source-analytics */
export type CustomerKnowledgeItemPrimarySourceAnalyticsParams = {
  from?: string;
  to?: string;
  granularity?: CustomerChatsAnalyticsGranularity;
  includePreview?: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsSource = {
  knowledgeBaseItemId: string;
  sourceTitle: string | null;
  sourceType: CustomerKnowledgeSourcesAnalyticsSourceType;
  safeUrl: string | null;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsSummary = {
  primarySourceUses: number;
  conversations: number;
  averagePrimarySourceScore: number | null;
  lastUsedAt: string | null;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsTimeSeriesPoint = {
  date: string;
  primarySourceUses: number;
  conversations: number;
  averageScore: number | null;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsResponse = {
  source: CustomerKnowledgeItemPrimarySourceAnalyticsSource;
  summary: CustomerKnowledgeItemPrimarySourceAnalyticsSummary;
  timeSeries: CustomerKnowledgeItemPrimarySourceAnalyticsTimeSeriesPoint[];
};

/** GET /api/customer/bots/:id/analytics/leads */
export type CustomerLeadsAnalyticsSummary = {
  totalConversations: number;
  totalLeads: number;
  completeLeads: number;
  partialLeads: number;
  leadCompletionRate: number | null;
  conversionRate: number | null;
  totalCapturedFields: number;
  averageFieldsPerLead: number | null;
};

export type CustomerLeadsTimeSeriesPoint = {
  date: string;
  conversations: number;
  leads: number;
  completeLeads: number;
  partialLeads: number;
  conversionRate: number | null;
  leadCompletionRate: number | null;
};

export type CustomerLeadsStartedFromBreakdownItem = {
  key: CustomerChatsAnalyticsStartedFromKey;
  label: string;
  conversations: number;
  leads: number;
  conversionRate: number | null;
};

export type CustomerLeadsCountryRow = {
  country: string | null;
  countryCode: string | null;
  leads: number;
  conversations: number;
};

export type CustomerLeadsCityRow = {
  city: string | null;
  countryCode: string | null;
  leads: number;
  conversations: number;
};

export type CustomerLeadsFieldCaptureItem = {
  fieldKey: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'url' | 'unknown';
  capturedCount: number;
  fieldStatus?: 'active' | 'inactive' | 'deleted';
  /** @deprecated Prefer fieldStatus; omitted when undefined on legacy payloads. */
  archived?: boolean;
};

export type CustomerLeadsAnalyticsResponse = {
  range: CustomerKnowledgeSourcesAnalyticsRange;
  summary: CustomerLeadsAnalyticsSummary;
  timeSeries: CustomerLeadsTimeSeriesPoint[];
  startedFromBreakdown: CustomerLeadsStartedFromBreakdownItem[];
  locationBreakdown: {
    countries: CustomerLeadsCountryRow[];
    cities: CustomerLeadsCityRow[];
  };
  fieldCaptureBreakdown: CustomerLeadsFieldCaptureItem[];
};

export type CustomerBotLeadsAnalyticsParams = {
  from?: string;
  to?: string;
  granularity?: CustomerChatsAnalyticsGranularity;
  includePreview?: boolean;
  /** Comma-separated channel keys (OR filter). */
  startedFrom?: string;
  countryCode?: string;
};

export type CreateDraftResponse = {
  botId: string;
  slug: string;
};

export type CustomerDocumentsResponse = {
  documents: CustomerWorkspaceDocument[];
  total: number;
  counts: {
    total?: number;
    pending?: number;
    queued?: number;
    processing?: number;
    ready?: number;
    failed?: number;
  };
  lastIngestedAt?: string | null;
  lastFailedDoc?: unknown;
};

/** GET /api/customer/bots/:botId/documents/:id/download-url */
export type CustomerDocumentDownloadUrlResponse = {
  url: string;
};

/** One row returned from POST /api/customer/bots/:botId/documents (multipart; max files per request is capped, typically 5). */
export type CustomerDocumentUploadRow = {
  _id: string;
  botId: string;
  title: string;
  sourceType: string;
  /** Upload lifecycle (`uploading` \| `uploaded` \| `upload_failed`) — not KB training status */
  status: string;
  documentStatus: string;
  trainingStatus: KnowledgeTrainingStatus;
  fileName: string;
  fileType: string;
  fileSize: number;
  active: boolean;
  createdAt: string;
};

/** POST /api/customer/bots/:botId/documents (multipart: repeat field `file`; max files per request typically 5 — not a cap on total documents). */
export type CustomerDocumentUploadResponse = {
  ok: true;
  documents: CustomerDocumentUploadRow[];
  ingestions?: Array<{ jobStatus: 'queued' }>;
};

export type ChatResponse = {
  ok: true;
  conversationId: string;
  assistantMessage: string;
  sources?: unknown;
};

export type ApiErrorBody = {
  error?: string;
  message?: string;
  errorCode?: string;
  invitedEmail?: string;
  currentEmail?: string;
};

/** GET/POST/PATCH/DELETE `/api/customer/bots/:id/share-link` */
export type CustomerShareLinkStatus =
  | 'not_created'
  | 'active'
  | 'disabled'
  | 'expired'
  | 'revoked'
  | 'missing';

export type CustomerShareLinkResponse = {
  enabled: boolean;
  slug: string;
  /** Absolute share path on Assistrio (no secrets). */
  shareUrl?: string;
  expiresAt?: string | null;
  tokenRevokedAt?: string | null;
  allowDraft?: boolean;
  requiresPreviewToken?: boolean;
  /** Hours chosen for this link (response only; echoed from request when applicable). */
  expiresInHours?: number;
  /**
   * Plain token for building the full URL. Owner APIs only; null when revoked or unavailable.
   * Omitted on some legacy responses; prefer GET share-link after open.
   */
  previewToken?: string | null;
  /** Client-only: after a successful create/regenerate, treat as configured. */
  secureSharePreviewConfigured?: boolean;
  /** Server-computed modal status (GET share-link and post-mutation responses). */
  status?: CustomerShareLinkStatus;
};

/** GET `/api/shared/bots/:slug/init` */
export type SharedBotInitPayload = {
  status: 'ok';
  shareSlug: string;
  bot: {
    id: string;
    name: string;
    imageUrl?: string;
    avatarEmoji?: string;
    tagline?: string;
    description?: string;
    welcomeMessage?: string;
    welcomeMessageEnabled?: boolean;
    suggestedQuestions?: string[];
    exampleQuestions?: string[];
    suggestedQuestionChips?: Array<{ label: string; suggestionId?: string; hideChipTextInChat?: boolean }>;
  };
  settings: {
    chatUI?: unknown;
    brandingMessage?: string;
    privacyText?: string;
    visitorMultiChatEnabled?: boolean;
    visitorMultiChatMax?: number | null;
  };
  chatVisitorId: string;
};

/** POST `/api/widget/iframe/init` */
export type WidgetIframeInitPayload = {
  status: 'ok';
  bot: SharedBotInitPayload['bot'];
  settings: SharedBotInitPayload['settings'];
  chatVisitorId: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false;
      status: number;
      error: string;
      errorCode?: string;
      body: unknown;
    };
