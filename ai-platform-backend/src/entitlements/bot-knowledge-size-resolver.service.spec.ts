import { Types } from 'mongoose';
import { megabytesToBytes } from './plan-catalog';
import { BotKnowledgeSizeResolverService } from './bot-knowledge-size-resolver.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { botKnowledgeSizeConfigIsMissing } from './bot-knowledge-size-from-entitlements.util';
import { DEFAULT_BOT_KNOWLEDGE_SIZE } from '../knowledge/knowledge-plan-limits';
import {
  resolveBotKnowledgeSizeConfig,
  resolvedBotKnowledgeSizeFromEntitlements,
} from '../knowledge/resolve-bot-knowledge-size.util';

describe('BotKnowledgeSizeResolverService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function buildService(planKbMb: number) {
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        planName: 'Free',
        kbStorageBytesPerBot: megabytesToBytes(planKbMb),
        maxKbStorageBytesPerBot: megabytesToBytes(40),
      }),
    } as unknown as WorkspaceEntitlementsService;
    return {
      svc: new BotKnowledgeSizeResolverService(entitlementsService),
      entitlementsService,
    };
  }

  it('uses persisted botConfig.knowledgeSize when present', async () => {
    const { svc } = buildService(5);
    const maxBytes = 12 * 1024 * 1024;
    const resolved = await svc.resolveForBotLean({
      workspaceId: new Types.ObjectId(workspaceId),
      botConfig: { knowledgeSize: { maxBytes } },
    });
    expect(resolved.maxBytes).toBe(maxBytes);
  });

  it('workspace bot missing knowledgeSize uses workspace plan entitlement bytes', async () => {
    const planBytes = 10 * 1024 * 1024;
    const { svc, entitlementsService } = buildService(10);
    const resolved = await svc.resolveForBotLean({
      workspaceId: new Types.ObjectId(workspaceId),
      botConfig: {},
    });
    expect(entitlementsService.resolveForWorkspace).toHaveBeenCalledWith(workspaceId);
    expect(resolved.maxBytes).toBe(planBytes);
  });

  it('workspace bot with legacy 50 MiB schema default uses workspace plan instead', async () => {
    const planBytes = 10 * 1024 * 1024;
    const { svc, entitlementsService } = buildService(10);
    const resolved = await svc.resolveForBotLean({
      workspaceId: new Types.ObjectId(workspaceId),
      botConfig: { knowledgeSize: { maxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes, note: null } },
    });
    expect(entitlementsService.resolveForWorkspace).toHaveBeenCalledWith(workspaceId);
    expect(resolved.maxBytes).toBe(planBytes);
    expect(resolved.maxBytes).not.toBe(DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes);
  });

  it('bot without workspaceId falls back to legacy 50 MB default', async () => {
    const { svc, entitlementsService } = buildService(5);
    const resolved = await svc.resolveForBotLean({ botConfig: {} });
    expect(entitlementsService.resolveForWorkspace).not.toHaveBeenCalled();
    expect(resolved.maxBytes).toBe(DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes);
  });

  it('resolveFromEntitlements maps Pro plan to 30 MB', () => {
    const { svc } = buildService(30);
    const resolved = svc.resolveFromEntitlements({
      planName: 'Pro',
      kbStorageBytesPerBot: megabytesToBytes(30),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(resolved.maxBytes).toBe(30 * 1024 * 1024);
  });

  it('workspace bot missing knowledgeSize resolves Free catalog quota (5 MB)', async () => {
    const { svc, entitlementsService } = buildService(5);
    const resolved = await svc.resolveForBotLean({
      workspaceId: new Types.ObjectId(workspaceId),
      botConfig: {},
    });
    expect(entitlementsService.resolveForWorkspace).toHaveBeenCalledWith(workspaceId);
    expect(resolved.maxBytes).toBe(megabytesToBytes(5));
  });
});

describe('resolveBotKnowledgeSizeConfig entitlement fallback (sync)', () => {
  it('uses entitlementFallback when knowledgeSize is missing', () => {
    const resolved = resolveBotKnowledgeSizeConfig(
      { botConfig: {} },
      {
        entitlementFallback: {
          planName: 'Starter',
          kbStorageBytesPerBot: megabytesToBytes(15),
          maxKbStorageBytesPerBot: megabytesToBytes(40),
        },
      },
    );
    expect(resolved.maxBytes).toBe(15 * 1024 * 1024);
  });

  it('prefers persisted maxBytes over entitlementFallback', () => {
    const maxBytes = 20 * 1024 * 1024;
    const resolved = resolveBotKnowledgeSizeConfig(
      { botConfig: { knowledgeSize: { maxBytes } } },
      {
        entitlementFallback: {
          planName: 'Free',
          kbStorageBytesPerBot: megabytesToBytes(5),
          maxKbStorageBytesPerBot: megabytesToBytes(40),
        },
      },
    );
    expect(resolved.maxBytes).toBe(maxBytes);
  });
});

describe('resolvedBotKnowledgeSizeFromEntitlements', () => {
  it('Free plan → 5 MB', () => {
    expect(
      resolvedBotKnowledgeSizeFromEntitlements({
        planName: 'Free',
        kbStorageBytesPerBot: megabytesToBytes(5),
        maxKbStorageBytesPerBot: megabytesToBytes(40),
      }).maxBytes,
    ).toBe(5 * 1024 * 1024);
  });
});
