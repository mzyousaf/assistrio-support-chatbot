import { describe, expect, it } from 'vitest';
import { hydrateExampleQuestionsFromBot, mergeExampleQuestionsWithKbStatusPoll } from '../exampleQuestionHelpers';
import { datasheetsFromBot, faqsFromBot, mergeQaRowsWithKbStatusPoll, mergeSnippetRowsWithKbStatusPoll, snippetsFromBot } from './knowledgeViewTypes';

describe('knowledge hydration keeps inactive rows visible', () => {
  it('FAQ/snippet/datasheet rows with active:false are kept and marked inactive', () => {
    const bot = {
      faqs: [{ title: 'T', questions: ['Q'], answer: 'A', active: false }],
      knowledgeSnippets: [{ title: 'S', snippet: 'Body', active: false }],
      knowledgeDatasheets: [{ title: 'D', columns: ['c1'], rows: [['v1']], active: false }],
    };

    const faqs = faqsFromBot(bot as never);
    const snippets = snippetsFromBot(bot as never);
    const tables = datasheetsFromBot(bot as never);

    expect(faqs).toHaveLength(1);
    expect(snippets).toHaveLength(1);
    expect(tables).toHaveLength(1);
    expect(faqs[0]?.active).toBe(false);
    expect(snippets[0]?.active).toBe(false);
    expect(tables[0]?.active).toBe(false);
  });

  it('suggestions preserve active:false from hydrated bot payload', () => {
    const bot = {
      exampleQuestions: [{ label: 'Ask pricing', context: 'Scoped data', active: false }],
    };

    const suggestions = hydrateExampleQuestionsFromBot(bot as never);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.active).toBe(false);
  });

  it('FAQ/snippet/suggestion poll merge keeps inactive rows when poll misses the row', () => {
    const faqMerged = mergeQaRowsWithKbStatusPoll(
      [{ title: 'T', questions: ['Q'], answer: 'A', active: false }],
      [],
    );
    const snippetMerged = mergeSnippetRowsWithKbStatusPoll(
      [{ title: 'S', snippet: 'Body', active: false }],
      [],
    );
    const suggestionMerged = mergeExampleQuestionsWithKbStatusPoll(
      [{ label: 'Ask pricing', context: 'Scoped data', active: false, suggestionIndex: 0 }],
      [],
    );

    expect(faqMerged).toHaveLength(1);
    expect(snippetMerged).toHaveLength(1);
    expect(suggestionMerged).toHaveLength(1);
    expect(faqMerged[0]?.active).toBe(false);
    expect(snippetMerged[0]?.active).toBe(false);
    expect(suggestionMerged[0]?.active).toBe(false);
  });
});
