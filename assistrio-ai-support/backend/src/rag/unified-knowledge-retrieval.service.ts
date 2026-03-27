/**
 * Unified knowledge retrieval: load and rank knowledge from KnowledgeBaseChunk + KnowledgeBaseItem.
 * Single read path; no legacy storage branching.
 */

import { Injectable } from '@nestjs/common';
import { KnowledgeBaseRetrievalService } from '../knowledge/knowledge-base-retrieval.service';
import type { UnifiedRetrievalResult, UnifiedRetrievalOptions } from './unified-retrieval.types';

@Injectable()
export class UnifiedKnowledgeRetrievalService {
  constructor(
    private readonly knowledgeBaseRetrievalService: KnowledgeBaseRetrievalService,
  ) {}

  /**
   * Load all eligible knowledge for the bot from the knowledge base, score with query embedding + lexical,
   * and return one ranked list.
   */
  async getRelevantKnowledgeItemsForBot(
    botId: string,
    query: string,
    options: UnifiedRetrievalOptions = {},
  ): Promise<UnifiedRetrievalResult> {
    return this.knowledgeBaseRetrievalService.getRelevantKnowledgeItemsFromKnowledgeBase(
      botId,
      query,
      options,
    );
  }
}
