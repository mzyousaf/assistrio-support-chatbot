import type { AdminKnowledgeOverviewResponse, AdminWorkspaceDocument } from '../../../api/types';

/** In-memory overview payload per bot — avoids empty-state flicker when revisiting the route. */
export const knowledgeOverviewResponseCache = new Map<string, AdminKnowledgeOverviewResponse>();

export type CachedKnowledgeDocumentsList = {
  rows: AdminWorkspaceDocument[];
  total: number;
};

/** Last successful documents list per bot — updated after GET `/documents` succeeds; not used to paint the table on mount (skeleton until fresh fetch). */
export const knowledgeDocumentsListCache = new Map<string, CachedKnowledgeDocumentsList>();
