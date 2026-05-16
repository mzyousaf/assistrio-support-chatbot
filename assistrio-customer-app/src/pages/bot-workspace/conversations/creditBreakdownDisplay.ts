import type { CustomerConversationMessageCreditBreakdownRow } from '@/api/types';

type BreakdownLabelRow = Pick<CustomerConversationMessageCreditBreakdownRow, 'key' | 'label'>;

/** Visitor-safe labels aligned with billing rules (does not imply attachment/quick/unknown are paid). */
export function breakdownRowVisitorLabel(row: BreakdownLabelRow): string {
  switch (row.key) {
    case 'attachment_message':
      return 'Attachment — not billable';
    case 'quick_reply_message':
      return 'Quick reply — not billable';
    case 'unknown_message':
      return 'Unknown — not billable';
    case 'dictation_session':
      return 'Dictation sessions';
    case 'suggested_question_message':
      return 'Text message';
    default:
      return row.label;
  }
}
