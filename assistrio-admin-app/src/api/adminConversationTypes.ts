/** Conversation insights types (same shape as customer workspace API). */

export type AdminConversationOriginSummary = {
  source?: string;
  mode?: string;
  embedType?: string;
  websiteOrigin?: string;
  pageUrl?: string;
  referrer?: string;
};

export type AdminConversationLocationSummary = {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
};

export type AdminConversationDeviceSummary = {
  deviceType?: string;
  browser?: string;
  os?: string;
  language?: string;
};

export type AdminConversationListItem = {
  id: string;
  conversationId: string;
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
  conversationOrigin: AdminConversationOriginSummary | null;
  location: AdminConversationLocationSummary | null;
  deviceInfo: AdminConversationDeviceSummary | null;
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
  conversationSentiment?: AdminConversationSentimentSummary;
  conversationTopics?: AdminConversationTopicsSummary;
};

export type AdminBotConversationsListParams = {
  limit?: number;
  before?: string | null;
  dateFrom?: string;
  dateTo?: string;
  startedFrom?: string;
  hasLead?: boolean;
  hasVoice?: boolean;
  hasDictation?: boolean;
  hasAttachment?: boolean;
  minCredits?: number;
  maxCredits?: number;
  creditsGtZero?: boolean;
  creditsZero?: boolean;
  minMessages?: number;
  deviceType?: string;
  countryCode?: string;
  primaryTopics?: string;
  secondaryTopics?: string;
  sentiments?: string;
};

export type AdminBotConversationsListResponse = {
  conversations: AdminConversationListItem[];
  nextCursor: string | null;
};

export type AdminConversationSentimentSummary = {
  label?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
  score?: number;
};

export type AdminConversationTopicsSummary = {
  primaryTopic?: string;
  topicLabels?: string[];
  primarySubTopic?: string;
  subTopicLabels?: string[];
};

export type AdminConversationOriginDetail = {
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

export type AdminConversationLocationDetail = {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  source?: string;
};

export type AdminConversationDeviceDetail = {
  deviceType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
};

export type AdminConversationDetail = {
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
  endedAt?: string | null;
  conversationOrigin?: AdminConversationOriginDetail;
  conversationSentiment?: AdminConversationSentimentSummary;
  conversationTopics?: AdminConversationTopicsSummary;
  capturedLeadData?: Record<string, string>;
  location?: AdminConversationLocationDetail;
  deviceInfo?: AdminConversationDeviceDetail;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalMessages: number;
  textMessageCount: number;
  voiceMessageCount: number;
  dictationMessageCount: number;
  attachmentMessageCount: number;
  suggestedQuestionMessageCount: number;
  quickReplyMessageCount?: number;
  totalCreditsUsed: number;
  sourcesUsedCount: number;
  hasLead: boolean;
  leadCapturedAt: string | null;
  leadFieldKeys?: string[];
  leadSourceMessageId?: string;
  leadSourceMessagePreview?: string;
  hasVoice: boolean;
  hasDictation: boolean;
  hasAttachment: boolean;
};

export type AdminConversationMessageSpeechInput = {
  mode: 'dictate' | 'voice';
  transcript?: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
};

export type AdminConversationMessageAttachment = {
  id?: string;
  name: string;
  mimeType?: string;
  url?: string;
  size?: number;
  createdAt?: string;
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

export type AdminConversationMessageSource = {
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
  title?: string;
  name?: string;
};

export type AdminConversationMessageAiMeta = {
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

export type AdminConversationMessageFeedback = {
  rating: 'up' | 'down';
  createdAt?: string;
  updatedAt?: string;
};

export type AdminConversationVoiceMeta = {
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

export type AdminConversationMessageCreditBreakdownRow = {
  key: string;
  label: string;
  count: number;
  creditsEach: number;
  creditsUsed: number;
  billable: boolean;
};

export type AdminConversationMessageTopics = {
  primaryTopic?: string;
  topicLabels?: string[];
  topicConfidence?: number;
  primarySubTopic?: string;
  subTopicLabels?: string[];
};

export type AdminConversationMessageSentiment = {
  label?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
  score?: number;
};

export type AdminConversationMessage = {
  id: string;
  messageId: string;
  role: string;
  content: string;
  text: string;
  createdAt: string;
  speechInput?: AdminConversationMessageSpeechInput;
  attachments?: AdminConversationMessageAttachment[];
  inputType?: string;
  inputMethod?: string;
  voiceMeta?: AdminConversationVoiceMeta;
  creditCost?: number;
  creditReason?: string;
  billingType?: string;
  quotaPeriod?: string;
  chargedAt?: string;
  creditBreakdown?: AdminConversationMessageCreditBreakdownRow[];
  topics?: AdminConversationMessageTopics;
  sentiment?: AdminConversationMessageSentiment;
  sources?: AdminConversationMessageSource[];
  aiMeta?: AdminConversationMessageAiMeta;
  feedback?: AdminConversationMessageFeedback | null;
  isWelcomeMessage?: boolean;
};
