/** Options for bot-scoped KB upserts (snippets, Q&A, tables). */
export type KnowledgeBotUpsertOptions = {
  skipKbTotalLimitAssert?: boolean;
  /**
   * Onboarding go-live one-shot: queue first training immediately with `runAfter = now`,
   * regardless of `knowledgeTraining.autoTrainEnabled`. Does not change the bot default.
   *
   * **Production usage:** only via {@link ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS} in
   * `workspace-onboarding-go-live.service.ts` and `workspace-onboarding-knowledge-transfer.service.ts`.
   * Normal customer/admin KB APIs must not pass this flag.
   */
  forceInitialTraining?: boolean;
};

/**
 * Onboarding go-live KB transfer only. Do not import from customer knowledge controllers,
 * document upload handlers, datasheet import, or admin APIs.
 */
export const ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS: KnowledgeBotUpsertOptions = {
  forceInitialTraining: true,
};
