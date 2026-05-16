import {
  KNOWLEDGE_TRAINING_SCOPES,
  type KnowledgeTrainingScope,
} from '../models/train-job.schema';

function isValidScope(s: string): s is KnowledgeTrainingScope {
  return (KNOWLEDGE_TRAINING_SCOPES as readonly string[]).includes(s);
}

/** Stable order: faq → note → table → suggestion. Deduplicated. */
export function mergeTrainingScopes(scopes: KnowledgeTrainingScope[]): KnowledgeTrainingScope[] {
  const seen = new Set<KnowledgeTrainingScope>();
  for (const s of scopes) {
    if (isValidScope(s)) seen.add(s);
  }
  return (KNOWLEDGE_TRAINING_SCOPES as readonly KnowledgeTrainingScope[]).filter((s) => seen.has(s));
}

/** Aligns with Mongo `claim` filter: missing or null `runAfter` is treated as due. */
export function isScheduledRunDue(runAfter: Date | null | undefined, now: Date): boolean {
  if (runAfter == null) return true;
  return runAfter.getTime() <= now.getTime();
}
