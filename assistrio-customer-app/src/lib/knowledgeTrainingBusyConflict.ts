export const KNOWLEDGE_TRAINING_BUSY_ERROR_CODE = 'knowledge_training_busy' as const;

export function isKnowledgeTrainingBusyError(res: { ok: false; errorCode?: string }): boolean {
  return res.errorCode === KNOWLEDGE_TRAINING_BUSY_ERROR_CODE;
}

export function knowledgeTrainingBusyConflictMessage(res: { error?: string }): string {
  const m = typeof res.error === 'string' ? res.error.trim() : '';
  return (
    m ||
    'Training is in progress or about to start. Please wait a moment and try again.'
  );
}
