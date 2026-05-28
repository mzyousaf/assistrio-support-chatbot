import { Types } from 'mongoose';
import { BotsService } from './bots.service';

describe('BotsService.updateWorkspaceBot allowed origins auto-draft', () => {
  const id = new Types.ObjectId().toString();

  function makeSvc(existing: Record<string, unknown>) {
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(id),
        status: 'published',
        name: 'Live bot',
        description: 'Ready to help',
        slug: 'live-bot',
        allowedOrigins: [{ origin: 'https://example.com', isActive: true }],
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

  it('moves a live bot to draft when all allowed origins are removed', async () => {
    const { svc, findOneAndUpdate } = makeSvc({});

    const out = await svc.updateWorkspaceBot(id, {
      touched: new Set(['allowedOrigins']),
      allowedOrigins: [],
    });

    expect(out).toEqual({ ok: true, botId: id, status: 'draft' });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        allowedOrigins: [],
        status: 'draft',
      }),
    );
  });

  it('still blocks publishing a draft bot without allowed origins', async () => {
    const { svc } = makeSvc({
      status: 'draft',
      allowedOrigins: [],
    });

    await expect(
      svc.updateWorkspaceBot(id, {
        touched: new Set(['status']),
        status: 'published',
      }),
    ).rejects.toThrow(/allowed embed origin/i);
  });
});
