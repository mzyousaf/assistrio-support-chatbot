export const AUTO_TOPUP_PACK_CREDITS = 1000;
export const AUTO_TOPUP_PACK_PRICE_USD = 30;
export const DEFAULT_MAX_AUTO_TOPUPS_PER_BILLING_PERIOD = 5;
export const AUTO_TOPUP_CREDIT_SOURCE = 'auto_topup' as const;
export const AUTO_TOPUP_CHECKOUT_KEY = 'ai_credits_auto_topup' as const;

export const AUTO_TOPUP_LIMIT_REACHED_CODE = 'auto_topup_limit_reached' as const;
export const AUTO_TOPUP_PAYMENT_ISSUE_CODE = 'auto_topup_payment_issue' as const;

export const AUTO_TOPUP_LIMIT_REACHED_MESSAGE =
  'Your workspace has reached the maximum number of automatic top-ups for this billing period.';

export const AUTO_TOPUP_PAYMENT_ISSUE_MESSAGE =
  'Automatic top-up is paused because of a payment issue. Update billing in Lemon Squeezy to resume.';
