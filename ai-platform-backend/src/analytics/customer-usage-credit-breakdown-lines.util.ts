import {

  CHAT_MESSAGE_CREDIT_BREAKDOWN_LABELS,

  CHAT_MESSAGE_CREDIT_RULES,

  type ChatMessageCreditRuleKey,

} from '../chat/chat-credit-rules.constant';

import { CREDIT_RULE_FINGERPRINT_ORDER } from '../chat/message-credit.util';



/**

 * Billing rows where persisted `creditsUsed` has been observed wrong/out of sync with `count` × `creditsEach`

 * — aggregate using the unit formula whenever `creditsEach` is present.

 */

const CREDIT_LINE_USE_UNIT_FORMULA_KEYS = new Set<string>([

  'text_message',

  'voice_message',

  'dictation_session',

  'suggested_question_message',

]);



/** Mongo expr: breakdown rule key from message `inputType`. */

export function mongoSynthCreditRuleKeyFromInputTypeExpr(inputTypeExpr: unknown): Record<string, unknown> {

  return {

    $switch: {

      branches: [

        { case: { $eq: [inputTypeExpr, 'voice'] }, then: 'voice_message' },

        { case: { $eq: [inputTypeExpr, 'dictation'] }, then: 'dictation_session' },

        { case: { $eq: [inputTypeExpr, 'suggested_question'] }, then: 'suggested_question_message' },

        { case: { $eq: [inputTypeExpr, 'quick_reply'] }, then: 'quick_reply_message' },

      ],

      default: 'text_message',

    },

  };

}



/** Mongo expr: numeric `creditsEach` aligned with {@link MESSAGE_CREDIT_UNIT_CONFIG} (dictation omitted at callsite). */

export function mongoSynthCreditsEachNumericExpr(inputTypeExpr: unknown): Record<string, unknown> {

  return {

    $switch: {

      branches: [

        { case: { $eq: [inputTypeExpr, 'voice'] }, then: 2 },

        { case: { $eq: [inputTypeExpr, 'suggested_question'] }, then: 1 },

        { case: { $eq: [inputTypeExpr, 'quick_reply'] }, then: 1 },

        { case: { $eq: [inputTypeExpr, 'attachment'] }, then: 0 },

        { case: { $eq: [inputTypeExpr, 'unknown'] }, then: 1 },

      ],

      default: 1,

    },

  };

}



/**

 * Single-element breakdown array when message rows lack persisted `creditBreakdown`.

 * Dictation composites omit `creditsEach` so aggregates keep stored `creditCost` until multi-row breakdown exists.

 */

export function mongoSynthCreditBreakdownLinesFromBoundFieldsExpr(

  inputTypeExpr: Record<string, unknown>,

  creditCostExpr: Record<string, unknown>,

): unknown[] {

  return [

    {

      $mergeObjects: [

        {

          key: mongoSynthCreditRuleKeyFromInputTypeExpr(inputTypeExpr),

          count: { $literal: 1 },

          creditsUsed: creditCostExpr,

        },

        {

          $cond: [

            { $eq: [inputTypeExpr, 'dictation'] },

            {},

            { creditsEach: mongoSynthCreditsEachNumericExpr(inputTypeExpr) },

          ],

        },

      ],

    },

  ];

}



/** Mongo expr: synthetic breakdown key when `Message.creditBreakdown` is missing (legacy rows). */

export function mongoSynthCreditRuleKeyFromMessageExpr(): Record<string, unknown> {

  return mongoSynthCreditRuleKeyFromInputTypeExpr('$inputType');

}



/** Prefer persisted breakdown rows; otherwise infer one row from stored creditCost for aggregates only. */

export function mongoEffectiveCreditBreakdownLinesFromMessageExpr(): Record<string, unknown> {

  return {

    $cond: [

      { $gt: [{ $size: { $ifNull: ['$creditBreakdown', []] } }, 0] },

      '$creditBreakdown',

      mongoSynthCreditBreakdownLinesFromBoundFieldsExpr(

        { $ifNull: ['$inputType', 'unknown'] },

        { $toDouble: { $ifNull: ['$creditCost', 0] } },

      ),

    ],

  };

}



/** Empty breakdown array constant for `$switch` defaults / concat tails. */
const LIT_EMPTY_LINES: Record<string, unknown> = { $literal: [] };



/** Ledger row fallback when neither metadata nor linked Message exposes breakdown lines. */

export function mongoLedgerFallbackLinesFromUsageExpr(): Record<string, unknown> {

  const cu: Record<string, unknown> = { $toDouble: { $ifNull: ['$creditsUsed', 0] } };

  return {

    $switch: {

      branches: [

        {

          case: { $eq: ['$usageType', 'voice_message'] },

          then: [

            {

              key: 'voice_message',

              count: { $literal: 1 },

              creditsEach: { $literal: 2 },

              creditsUsed: cu,

            },

          ],

        },

        {

          case: { $eq: ['$usageType', 'text_message'] },

          then: [

            {

              key: 'text_message',

              count: { $literal: 1 },

              creditsEach: { $literal: 1 },

              creditsUsed: cu,

            },

          ],

        },

        {

          case: { $eq: ['$usageType', 'suggested_question_message'] },

          then: [

            {

              key: 'suggested_question_message',

              count: { $literal: 1 },

              creditsEach: { $literal: 1 },

              creditsUsed: cu,

            },

          ],

        },

        {

          case: { $eq: ['$usageType', 'attachment_message'] },

          then: [

            {

              key: 'attachment_message',

              count: { $literal: 1 },

              creditsEach: { $literal: 0 },

              creditsUsed: cu,

            },

          ],

        },

        {

          case: { $eq: ['$usageType', 'quick_reply_message'] },

          then: [

            {

              key: 'quick_reply_message',

              count: { $literal: 1 },

              creditsUsed: cu,

            },

          ],

        },

        {

          case: { $eq: ['$usageType', 'unknown_message'] },

          then: [

            {

              key: 'unknown_message',

              count: { $literal: 1 },

              creditsUsed: cu,

            },

          ],

        },

        {

          case: { $eq: ['$usageType', 'dictation_message'] },

          then: mongoLedgerDictationCompositeLinesExpr(),

        },

      ],

      default: LIT_EMPTY_LINES,

    },

  };

}



/**

 * Approximate text + dictation_session split from billed credits when only ledger primary modality exists.

 */

export function mongoLedgerDictationCompositeLinesExpr(): Record<string, unknown> {

  const cu: Record<string, unknown> = { $toDouble: { $ifNull: ['$creditsUsed', 0] } };

  const textUsed: Record<string, unknown> = {

    $cond: [{ $gte: [cu, 1] }, 1, 0],

  };

  const remainder: Record<string, unknown> = { $subtract: [cu, textUsed] };

  const sessionCount: Record<string, unknown> = {

    $cond: [

      { $gt: [remainder, 0] },

      { $max: [1, { $round: [{ $divide: [remainder, 0.25] }] }] },

      0,

    ],

  };

  const dictCreditsUsed: Record<string, unknown> = { $multiply: [sessionCount, 0.25] };



  return {

    $concatArrays: [

      {

        $cond: [
          { $gt: [textUsed, 0] },
          [
            {
              key: 'text_message',
              count: { $literal: 1 },
              creditsEach: { $literal: 1 },
              creditsUsed: textUsed,
            },
          ],
          LIT_EMPTY_LINES,
        ],

      },

      {

        $cond: [
          { $gt: [sessionCount, 0] },
          [
            {
              key: 'dictation_session',
              count: sessionCount,
              creditsEach: { $literal: 0.25 },
              creditsUsed: dictCreditsUsed,
            },
          ],
          LIT_EMPTY_LINES,
        ],

      },

    ],

  };

}



/**

 * Resolved persisted breakdown for a UsageLedger row: metadata → Message.breakdown → Message synth → ledger synth.

 */

export function mongoLedgerResolvedCreditBreakdownLinesExpr(): Record<string, unknown> {

  const msg0: Record<string, unknown> = { $arrayElemAt: ['$_msg', 0] };

  const metaBd = '$metadata.creditBreakdown';

  const msgBd: Record<string, unknown> = {

    $ifNull: [{ $getField: { field: 'creditBreakdown', input: msg0 } }, []],

  };

  const msgExists = { $gt: [{ $size: { $ifNull: ['$_msg', []] } }, 0] };



  return {

    $cond: [

      { $gt: [{ $size: { $ifNull: [metaBd, []] } }, 0] },

      metaBd,

      {

        $cond: [

          {

            $and: [msgExists, { $gt: [{ $size: msgBd }, 0] }],

          },

          msgBd,

          {

            $cond: [

              msgExists,

              mongoSynthCreditBreakdownLinesFromBoundFieldsExpr(

                { $ifNull: [{ $getField: { field: 'inputType', input: msg0 } }, 'unknown'] },

                { $toDouble: { $ifNull: [{ $getField: { field: 'creditCost', input: msg0 } }, 0] } },

              ),

              mongoLedgerFallbackLinesFromUsageExpr(),

            ],

          },

        ],

      },

    ],

  };

}



export type CreditBreakdownLineAgg = {

  key: string;

  count: number;

  creditsUsed: number;

};



export type ComponentBreakdownAccumulator = {

  totalCreditsFromLines: number;

  textMessages: number;

  textCredits: number;

  voiceMessages: number;

  voiceCredits: number;

  dictationSessions: number;

  dictationCredits: number;

  attachmentMessages: number;

  attachmentCredits: number;

  suggestedQuestionMessages: number;

  suggestedQuestionCredits: number;

  quickReplyMessages: number;

  quickReplyCredits: number;

  unknownMessages: number;

  unknownCredits: number;

};



export function emptyComponentAccumulator(): ComponentBreakdownAccumulator {

  return {

    totalCreditsFromLines: 0,

    textMessages: 0,

    textCredits: 0,

    voiceMessages: 0,

    voiceCredits: 0,

    dictationSessions: 0,

    dictationCredits: 0,

    attachmentMessages: 0,

    attachmentCredits: 0,

    suggestedQuestionMessages: 0,

    suggestedQuestionCredits: 0,

    quickReplyMessages: 0,

    quickReplyCredits: 0,

    unknownMessages: 0,

    unknownCredits: 0,

  };

}



function toFiniteNumber(v: unknown): number {

  return typeof v === 'number' && Number.isFinite(v) ? v : 0;

}



function toFiniteCount(v: unknown): number {

  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;

  return Math.max(0, v);

}



/** Normalize persisted credit breakdown rows from ledger metadata or Message docs. */

export function normalizeCreditBreakdownLinesFromUnknown(raw: unknown): CreditBreakdownLineAgg[] {

  if (!Array.isArray(raw)) return [];

  const out: CreditBreakdownLineAgg[] = [];

  for (const item of raw) {

    if (!item || typeof item !== 'object') continue;

    const o = item as Record<string, unknown>;

    const key = typeof o.key === 'string' ? o.key.trim() : '';

    if (!key) continue;

    const count = typeof o.count === 'number' && Number.isFinite(o.count) ? Math.max(0, o.count) : 0;

    const creditsUsedStored =

      typeof o.creditsUsed === 'number' && Number.isFinite(o.creditsUsed) ? o.creditsUsed : undefined;

    const creditsEach =

      typeof o.creditsEach === 'number' && Number.isFinite(o.creditsEach) ? o.creditsEach : undefined;



    let creditsUsed: number;

    if (CREDIT_LINE_USE_UNIT_FORMULA_KEYS.has(key) && creditsEach !== undefined) {

      creditsUsed = count * creditsEach;

    } else if (creditsUsedStored !== undefined) {

      creditsUsed = creditsUsedStored;

    } else if (creditsEach !== undefined) {

      creditsUsed = count * creditsEach;

    } else {

      creditsUsed = 0;

    }



    out.push({ key, count, creditsUsed });

  }

  return out;

}



export function accumulateCreditBreakdownLinesInto(

  target: ComponentBreakdownAccumulator,

  lines: readonly CreditBreakdownLineAgg[],

): void {

  for (const row of lines) {

    const key = typeof row.key === 'string' ? row.key.trim() : '';

    const count = toFiniteCount(row.count);

    const creditsUsed = toFiniteNumber(row.creditsUsed);

    target.totalCreditsFromLines += creditsUsed;



    switch (key as ChatMessageCreditRuleKey) {

      case 'text_message':

        target.textMessages += count;

        target.textCredits += creditsUsed;

        break;

      case 'voice_message':

        target.voiceMessages += count;

        target.voiceCredits += creditsUsed;

        break;

      case 'dictation_session':

        target.dictationSessions += count;

        target.dictationCredits += creditsUsed;

        break;

      case 'attachment_message':

        target.attachmentMessages += count;

        target.attachmentCredits += creditsUsed;

        break;

      case 'suggested_question_message':

        target.suggestedQuestionMessages += count;

        target.suggestedQuestionCredits += creditsUsed;

        break;

      case 'quick_reply_message':

        target.quickReplyMessages += count;

        target.quickReplyCredits += creditsUsed;

        break;

      case 'unknown_message':

        target.unknownMessages += count;

        target.unknownCredits += creditsUsed;

        break;

      default:

        break;

    }

  }

}

export type CustomerUsageCreditRuleDto = {

  key: string;

  label: string;

  credits: number;

  enabled: boolean;

  includeInTotalCredits: boolean;

  billable: boolean;

};

const ANALYTICS_RULE_LABEL_OVERRIDES: Partial<Record<ChatMessageCreditRuleKey, string>> = {

  /** Analytics merges suggested_question_message into text_message; label used for that combined row. */
  text_message: 'Text messages',

  attachment_message: 'Attachment — not billable',

  quick_reply_message: 'Quick reply — not billable',

  unknown_message: 'Unknown — not billable',

};

/** Stable ordering + customer-facing labels for usage APIs (does not alter persisted billing strings). */

export function buildCustomerUsageCreditRulesPayload(): CustomerUsageCreditRuleDto[] {

  return CREDIT_RULE_FINGERPRINT_ORDER.map((key) => {

    const rule = CHAT_MESSAGE_CREDIT_RULES[key];

    return {

      key,

      label: ANALYTICS_RULE_LABEL_OVERRIDES[key] ?? CHAT_MESSAGE_CREDIT_BREAKDOWN_LABELS[key],

      credits: rule.credits,

      enabled: rule.enabled,

      includeInTotalCredits: rule.includeInTotalCredits,

      billable: rule.enabled === true && (rule.includeInTotalCredits ?? true) === true,

    };

  });

}

export type UsageComponentDisplayRowDto = {
  key: ChatMessageCreditRuleKey;
  label: string;
  count: number;
  creditsEach: number;
  creditsUsed: number;
  billable: boolean;
};

export function roundUsageCreditsDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6;
}

/**
 * One coherent UI row per breakdown component: creditsUsed = count × creditsEach (billing rule).
 * Counts come strictly from persisted breakdown aggregates (`ComponentBreakdownAccumulator`).
 */
export function buildUsageComponentDisplayRowsFromAccumulator(
  acc: ComponentBreakdownAccumulator,
): UsageComponentDisplayRowDto[] {
  const merged = emptyComponentAccumulator();
  Object.assign(merged, acc);
  merged.textMessages += merged.suggestedQuestionMessages;
  merged.textCredits += merged.suggestedQuestionCredits;
  merged.suggestedQuestionMessages = 0;
  merged.suggestedQuestionCredits = 0;

  const rows: UsageComponentDisplayRowDto[] = [];

  const pushKey = (key: ChatMessageCreditRuleKey, countRaw: number): void => {
    const count = typeof countRaw === 'number' && Number.isFinite(countRaw) ? Math.max(0, countRaw) : 0;
    if (count <= 0) return;
    const rule = CHAT_MESSAGE_CREDIT_RULES[key];
    const creditsEach = rule.credits;
    const billable = rule.enabled === true && (rule.includeInTotalCredits ?? true) === true;
    const creditsUsed = billable ? roundUsageCreditsDisplay(count * creditsEach) : 0;
    rows.push({
      key,
      label: ANALYTICS_RULE_LABEL_OVERRIDES[key] ?? CHAT_MESSAGE_CREDIT_BREAKDOWN_LABELS[key],
      count,
      creditsEach,
      creditsUsed,
      billable,
    });
  };

  for (const key of CREDIT_RULE_FINGERPRINT_ORDER) {
    switch (key) {
      case 'text_message':
        pushKey(key, merged.textMessages);
        break;
      case 'suggested_question_message':
        break;
      case 'quick_reply_message':
        pushKey(key, merged.quickReplyMessages);
        break;
      case 'voice_message':
        pushKey(key, merged.voiceMessages);
        break;
      case 'dictation_session':
        pushKey(key, merged.dictationSessions);
        break;
      case 'attachment_message':
        pushKey(key, merged.attachmentMessages);
        break;
      case 'unknown_message':
        pushKey(key, merged.unknownMessages);
        break;
      default:
        break;
    }
  }

  return rows;
}

export function sumBillableUsageComponentCredits(rows: readonly UsageComponentDisplayRowDto[]): number {
  let s = 0;
  for (const r of rows) {
    if (r.billable) s += r.creditsUsed;
  }
  return roundUsageCreditsDisplay(s);
}

