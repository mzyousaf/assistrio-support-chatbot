/**
 * Dev checklist: expected data capture for a normal text turn through `ChatEngineService.runChat`.
 * Not executed at runtime — use when validating Prompts 1–7 integration manually or in future E2E tests.
 */
export const CAPTURE_FOUNDATION_AUDIT_CHECKLIST: readonly string[] = [
  'Conversation.startedFrom / conversationOrigin set (Prompt 2)',
  'Conversation.location / deviceInfo when analyticsContext + headers present (Prompt 3)',
  'User Message: inputType, inputMethod, voiceMeta when applicable (Prompt 4)',
  'User Message: creditCost, creditReason, billingType, quotaPeriod, chargedAt (Prompt 5)',
  'UsageLedger row write attempted for user message credits (Prompt 5)',
  'Assistant Message: enriched Message.sources with sourceType, knowledgeBaseItemId, etc. when RAG used (Prompt 6)',
  'Assistant Message: aiMeta (model, timing, tokens if returned, ragUsed, sourcesCount, fallbackUsed) (Prompt 6)',
  'Conversation counters incremented once per completed turn (Prompt 7)',
  'Conversation lead flags when capturedLeadData updates (Prompt 7)',
];
