import type { CustomerTopicsAnalyticsTopicId } from '@/api/types';
import { CUSTOMER_TOPICS_ANALYTICS_MAIN_TOPIC_IDS } from '@/api/types';

/** Stable taxonomy order (matches API / backend `TOPIC_TAXONOMY_IDS`). */
export const TOPIC_TAXONOMY_ORDER: readonly CustomerTopicsAnalyticsTopicId[] =
  CUSTOMER_TOPICS_ANALYTICS_MAIN_TOPIC_IDS;

/** Human-readable labels (mirror backend `TOPIC_LABELS`; used before first API response). */
export const TOPIC_DISPLAY_FALLBACK = {
  pricing: 'Pricing',
  billing: 'Billing',
  subscription: 'Subscription',
  refund: 'Refund',
  product_question: 'Product question',
  technical_support: 'Technical support',
  bug_report: 'Bug report',
  account_access: 'Account access',
  setup_onboarding: 'Setup & onboarding',
  integration: 'Integration',
  api_webhook: 'API & webhooks',
  sales: 'Sales',
  demo_request: 'Demo request',
  human_agent: 'Human agent',
  lead_capture: 'Lead capture',
  order_status: 'Order status',
  shipping_delivery: 'Shipping & delivery',
  returns_exchange: 'Returns & exchange',
  appointment_booking: 'Appointment booking',
  documentation: 'Documentation',
  feature_request: 'Feature request',
  complaint: 'Complaint',
  feedback: 'Feedback',
  security_privacy: 'Security & privacy',
  compliance: 'Compliance',
  cancellation: 'Cancellation',
  trial: 'Trial',
  usage_limits: 'Usage limits',
  general_question: 'General question',
  other: 'Other',
} as const satisfies Record<CustomerTopicsAnalyticsTopicId, string>;

/** Accent colors for topic stacks (teal-first, professional, limited palette). */
export const TOPIC_STACK_COLORS: readonly string[] = [
  '#0d9488',
  '#0f766e',
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  '#0ea5e9',
  '#64748b',
] as const;
