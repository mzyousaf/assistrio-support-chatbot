import { Types } from 'mongoose';
import { BotsService } from './bots.service';

describe('BotsService.updateWorkspaceBot config/personality merge', () => {
  const id = new Types.ObjectId().toString();

  function makeSvc(existing: Record<string, unknown>) {
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(id),
        status: 'draft',
        name: 'Bot',
        slug: 'bot',
        ...existing,
      }),
    });
    const findOneAndUpdate = jest.fn().mockResolvedValue({});
    const svc = Object.create(BotsService.prototype) as {
      updateWorkspaceBot: BotsService['updateWorkspaceBot'];
      botModel: { findOne: typeof findOne; findOneAndUpdate: typeof findOneAndUpdate };
      assertDocumentsExtractedBeforePublish: jest.Mock;
    };
    svc.botModel = { findOne, findOneAndUpdate };
    svc.assertDocumentsExtractedBeforePublish = jest.fn().mockResolvedValue(undefined);
    return { svc, findOneAndUpdate };
  }

  it('merges config so partial PATCH keeps temperature and maxTokens', async () => {
    const { svc, findOneAndUpdate } = makeSvc({
      config: { temperature: 0.3, maxTokens: 256, responseLength: 'medium' },
    });

    await svc.updateWorkspaceBot(id, {
      touched: new Set(['config']),
      config: { responseLength: 'short' },
    });

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate.mock.calls[0]?.[1]).toMatchObject({
      config: {
        temperature: 0.3,
        maxTokens: 256,
        responseLength: 'short',
      },
    });
  });

  it('merges config and clears responseStyleInstructions when unset key is set', async () => {
    const { svc, findOneAndUpdate } = makeSvc({
      config: {
        temperature: 0.3,
        maxTokens: 160,
        responseLength: 'medium',
        responseStyleInstructions: 'Old bullets',
      },
    });

    await svc.updateWorkspaceBot(id, {
      touched: new Set(['config']),
      config: { temperature: 0.3, maxTokens: 160, responseLength: 'medium' },
      unsetConfigKeys: ['responseStyleInstructions'],
    });

    const saved = findOneAndUpdate.mock.calls[0]?.[1] as { config: Record<string, unknown> };
    expect(saved.config.responseStyleInstructions).toBeUndefined();
  });

  it('merges personality so partial PATCH keeps description and systemPrompt', async () => {
    const { svc, findOneAndUpdate } = makeSvc({
      personality: {
        description: 'Be helpful',
        systemPrompt: 'Be helpful',
        tone: 'friendly',
      },
    });

    await svc.updateWorkspaceBot(id, {
      touched: new Set(['personality']),
      personality: { tone: 'professional', behaviorPreset: 'support' },
    });

    expect(findOneAndUpdate.mock.calls[0]?.[1]).toMatchObject({
      personality: {
        description: 'Be helpful',
        systemPrompt: 'Be helpful',
        tone: 'professional',
        behaviorPreset: 'support',
      },
    });
  });
});
