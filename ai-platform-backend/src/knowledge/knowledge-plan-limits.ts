export type BotKnowledgeSizeType = 'default' | 'paid_addon' | 'custom';

/** Values persisted on the bot document under `botConfig.knowledgeSize`. */
export type BotKnowledgeSizeStored = {
  type: BotKnowledgeSizeType;
  baseMaxBytes: number;
  extraMaxBytes: number;
  maxBytes: number;
  lastPaidAt?: Date | null;
  expiresAt?: Date | null;
  updatedAt?: Date | null;
  updatedBy?: string | null;
  note?: string | null;
};

export const DEFAULT_BOT_KNOWLEDGE_SIZE: BotKnowledgeSizeStored = {
  type: 'default',
  baseMaxBytes: 50 * 1024 * 1024,
  extraMaxBytes: 0,
  maxBytes: 50 * 1024 * 1024,
  lastPaidAt: null,
  expiresAt: null,
  updatedAt: null,
  updatedBy: null,
  note: null,
};

export type KbFieldLimits = {
  documentMaxUploadBytes: number;
  datasheetMaxUploadBytes: number;
  faqTotalMaxBytes: number;
  faqTitleMaxBytes: number;
  /** Combined UTF-8 budget for all question strings on one Q&A row (shared across variants). */
  faqQuestionMaxBytes: number;
  faqAnswerMaxBytes: number;
  snippetTotalMaxBytes: number;
  snippetTitleMaxBytes: number;
  snippetDescriptionMaxBytes: number;
  suggestionTotalMaxBytes: number;
  suggestionTextMaxBytes: number;
  suggestionDescriptionMaxBytes: number;
  tableGridMaxBytes: number;
  tablePersistMaxBytes: number;
};

export const DEFAULT_KB_FIELD_LIMITS: KbFieldLimits = {
  documentMaxUploadBytes: 20 * 1024 * 1024,
  datasheetMaxUploadBytes: 20 * 1024 * 1024,
  faqTotalMaxBytes: 1 * 1024 * 1024,
  faqTitleMaxBytes: 200,
  faqQuestionMaxBytes: 1000,
  faqAnswerMaxBytes: 1 * 1024 * 1024,
  snippetTotalMaxBytes: 1 * 1024 * 1024,
  snippetTitleMaxBytes: 200,
  snippetDescriptionMaxBytes: 1 * 1024 * 1024,
  suggestionTotalMaxBytes: 1 * 1024 * 1024,
  suggestionTextMaxBytes: 500,
  suggestionDescriptionMaxBytes: 1 * 1024 * 1024,
  tableGridMaxBytes: 6 * 1024 * 1024,
  tablePersistMaxBytes: 14 * 1024 * 1024,
};
