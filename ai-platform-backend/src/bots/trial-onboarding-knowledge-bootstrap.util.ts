/**
 * Maps trial onboarding draft knowledge into platform KnowledgeBase / Document rows.
 */

const TRIAL_UPLOAD_SESSION_ID = 'trial-onboarding';

export type TrialKnowledgeDocAsset = {
  assetKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
};

export function listKnowledgeDocumentAssetsFromDraft(uploadedAssets: unknown): TrialKnowledgeDocAsset[] {
  if (!Array.isArray(uploadedAssets)) return [];
  const out: TrialKnowledgeDocAsset[] = [];
  for (const raw of uploadedAssets) {
    if (raw == null || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (o.kind !== 'knowledge_document') continue;
    const assetKey = typeof o.assetKey === 'string' ? o.assetKey.trim() : '';
    const originalFilename = typeof o.originalFilename === 'string' ? o.originalFilename.trim() : '';
    const mimeType = typeof o.mimeType === 'string' ? o.mimeType.trim() : '';
    const sizeRaw = o.sizeBytes;
    const sizeBytes =
      typeof sizeRaw === 'number' && Number.isFinite(sizeRaw) && sizeRaw >= 0 ? Math.floor(sizeRaw) : 0;
    if (!assetKey || !originalFilename) continue;
    const url = typeof o.url === 'string' && o.url.trim() ? o.url.trim().slice(0, 4000) : undefined;
    out.push({ assetKey, originalFilename, mimeType, sizeBytes, ...(url ? { url } : {}) });
  }
  return out;
}

/** FAQs with both Q and A — required for useful retrieval embeddings. */
export function parseTrialOnboardingFaqsForKnowledgeBase(
  raw: unknown,
): Array<{ question: string; answer: string; active?: boolean }> {
  if (raw == null || !Array.isArray(raw)) return [];
  const out: Array<{ question: string; answer: string; active?: boolean }> = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const question = typeof o.question === 'string' ? o.question.trim() : '';
    const answer = typeof o.answer === 'string' ? o.answer.trim() : '';
    if (!question || !answer) continue;
    out.push({ question, answer, active: true });
    if (out.length >= 50) break;
  }
  return out;
}

export function getTrialOnboardingUploadSessionId(): string {
  return TRIAL_UPLOAD_SESSION_ID;
}
