/** Filter taxonomy types shared by conversation insights filters (mirrors customer analytics). */

export type AdminChatsAnalyticsStartedFromKey =
  | 'playground_preview'
  | 'shared_preview'
  | 'runtime_widget'
  | 'runtime_iframe'
  | 'unknown';

export const ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS = [
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

export type AdminTopicsAnalyticsTopicId = (typeof ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS)[number];

export type AdminSentimentLabelId = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
