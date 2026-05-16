import type { CustomerKnowledgeOverviewResponse, CustomerWorkspaceDocument } from '../../../api/types';

/** In-memory overview payload per bot — avoids empty-state flicker when revisiting the route. */
export const knowledgeOverviewResponseCache = new Map<string, CustomerKnowledgeOverviewResponse>();

export type CachedKnowledgeDocumentsList = {
  rows: CustomerWorkspaceDocument[];
  total: number;
};

/** Last successful documents list per bot — updated after GET `/documents` succeeds; not used to paint the table on mount (skeleton until fresh fetch). */
export const knowledgeDocumentsListCache = new Map<string, CachedKnowledgeDocumentsList>();
