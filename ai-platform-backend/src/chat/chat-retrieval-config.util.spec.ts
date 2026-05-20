import {
  buildEvidenceBudgetOptionsFromEnv,
  CHAT_MAX_EVIDENCE_ITEMS_DEFAULT,
  CHAT_MAX_EVIDENCE_TOKENS_DEFAULT,
  CHAT_MAX_ITEMS_TO_SCORE_DEFAULT,
  CHAT_RETRIEVAL_LIMIT_DEFAULT,
  getChatMaxEvidenceItems,
  getChatMaxItemsToScore,
  getChatRetrievalLimit,
} from './chat-retrieval-config.util';

describe('chat-retrieval-config', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses production defaults when env unset', () => {
    delete process.env.CHAT_RETRIEVAL_LIMIT;
    delete process.env.CHAT_MAX_ITEMS_TO_SCORE;
    delete process.env.CHAT_MAX_EVIDENCE_ITEMS;
    delete process.env.CHAT_MAX_EVIDENCE_TOKENS;
    expect(getChatRetrievalLimit()).toBe(CHAT_RETRIEVAL_LIMIT_DEFAULT);
    expect(getChatMaxItemsToScore()).toBe(CHAT_MAX_ITEMS_TO_SCORE_DEFAULT);
    expect(getChatMaxEvidenceItems()).toBe(CHAT_MAX_EVIDENCE_ITEMS_DEFAULT);
    expect(buildEvidenceBudgetOptionsFromEnv().maxEvidenceTokens).toBe(CHAT_MAX_EVIDENCE_TOKENS_DEFAULT);
  });

  it('reads overrides from env', () => {
    process.env.CHAT_RETRIEVAL_LIMIT = '30';
    process.env.CHAT_MAX_ITEMS_TO_SCORE = '400';
    expect(getChatRetrievalLimit()).toBe(30);
    expect(getChatMaxItemsToScore()).toBe(400);
  });
});
