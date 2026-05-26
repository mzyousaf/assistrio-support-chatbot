import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  botKnowledgeSizeConfigIsMissing,
  buildBotKnowledgeSizeFromEntitlements,
  shouldResolveKnowledgeSizeFromWorkspaceEntitlements,
  type EntitlementsKbSizeInput,
} from './bot-knowledge-size-from-entitlements.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import {
  resolveBotKnowledgeSizeConfig,
  resolvedBotKnowledgeSizeFromEntitlements,
  type ResolvedBotKnowledgeSize,
} from '../knowledge/resolve-bot-knowledge-size.util';

export type BotLeanForKnowledgeSizeResolve = {
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

  resolveFromEntitlements(entitlements: EntitlementsKbSizeInput): ResolvedBotKnowledgeSize {
    return resolvedBotKnowledgeSizeFromEntitlements(entitlements);
  }

  async resolveForBotLean(bot: BotLeanForKnowledgeSizeResolve): Promise<ResolvedBotKnowledgeSize> {
    const wsId = String(bot?.workspaceId ?? '').trim();
    const hasWorkspace = wsId.length > 0 && Types.ObjectId.isValid(wsId);

    if (hasWorkspace && shouldResolveKnowledgeSizeFromWorkspaceEntitlements(bot)) {
      const entitlements = await this.entitlementsService.resolveForWorkspace(wsId);
      return resolvedBotKnowledgeSizeFromEntitlements(entitlements);
    }

    if (!botKnowledgeSizeConfigIsMissing(bot)) {
      return resolveBotKnowledgeSizeConfig(bot);
    }

    return resolveBotKnowledgeSizeConfig(null);
  }
}
