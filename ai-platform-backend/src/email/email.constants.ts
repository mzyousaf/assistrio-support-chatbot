export const EMAIL_DELIVERY_NOT_CONFIGURED_CODE = 'email_delivery_not_configured' as const;
export const EMAIL_DELIVERY_FAILED_CODE = 'email_delivery_failed' as const;

export const EMAIL_DELIVERY_NOT_CONFIGURED_MESSAGE =
  'Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.';

export const EMAIL_DELIVERY_FAILED_MESSAGE =
  'Could not send the invite email. The invite was saved — try resending from Members settings.';
