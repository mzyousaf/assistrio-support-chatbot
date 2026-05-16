import { botKnowledgeBootstrapDefaults } from './default-bot-knowledge-bootstrap.util';

describe('botKnowledgeBootstrapDefaults', () => {
  it('provides Smart schedule, auto-train defaults, and empty knowledgeStats', () => {
    const d = botKnowledgeBootstrapDefaults();
    expect(d.knowledgeTraining).toMatchObject({
      autoTrainEnabled: false,
      trainingDelayMinutes: 5,
      scheduleMode: 'smart',
    });
    expect(d.knowledgeStats.totalItems).toBe(0);
    expect(d.knowledgeStats.totalCharacters).toBe(0);
    expect(d.knowledgeStats.byType.documents.items).toBe(0);
    expect(d.knowledgeStats.byType.suggestions.items).toBe(0);
  });
});
