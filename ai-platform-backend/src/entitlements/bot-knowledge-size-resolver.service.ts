import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  botKnowledgeSizeConfigIsMissing,
  shouldResolveKnowledgeSizeFromWorkspaceEntitlements,
} from './bot-knowledge-size-from-entitlements.util';
import { resolveKbEntitlementsForBot } from './workspace-addon-entitlements.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import {
  resolveBotKnowledgeSizeConfig,
  resolvedBotKnowledgeSizeFromEntitlements,
  type ResolvedBotKnowledgeSize,
} from '../knowledge/resolve-bot-knowledge-size.util';

export type BotLeanForKnowledgeSizeResolve = {
  _id?: Types.ObjectId | string | null;
  workspaceId?: Types.ObjectId | string | null;
  botConfig?: { knowledgeSize?: { maxBytes?: number; note?: string | null } | null } | null;
} | null;

/**
 * Resolves effective trained-KB quota for enforcement and usage APIs.
 * Workspace bots without persisted `botConfig.knowledgeSize` use workspace plan entitlements (not 50 MiB legacy default).
 */
@Injectable()
export class BotKnowledgeSizeResolverService {
  constructor(private readonly entitlementsService: WorkspaceEntitlementsService) {}

  resolveFromEntitlements(
    entitlements: Parameters<typeof resolveKbEntitlementsForBot>[0],
    botId?: string,
  ): ResolvedBotKnowledgeSize {
    const kbInput = botId?.trim()
      ? resolveKbEntitlementsForBot(entitlements, botId.trim())
      : resolveKbEntitlementsForBot(entitlements, '');
    return resolvedBotKnowledgeSizeFromEntitlements(kbInput);
  }

  async resolveForBotLean(bot: BotLeanForKnowledgeSizeResolve): Promise<ResolvedBotKnowledgeSize> {
    const wsId = String(bot?.workspaceId ?? '').trim();
    const botId = String(bot?._id ?? '').trim();
    const hasWorkspace = wsId.length > 0 && Types.ObjectId.isValid(wsId);

    if (hasWorkspace && shouldResolveKnowledgeSizeFromWorkspaceEntitlements(bot)) {
      const entitlements = await this.entitlementsService.resolveForWorkspace(wsId);
      return resolvedBotKnowledgeSizeFromEntitlements(
        resolveKbEntitlementsForBot(entitlements, botId),
      );
    }

    if (!botKnowledgeSizeConfigIsMissing(bot)) {
      return resolveBotKnowledgeSizeConfig(bot);
    }

    return resolveBotKnowledgeSizeConfig(null);
  }
}
