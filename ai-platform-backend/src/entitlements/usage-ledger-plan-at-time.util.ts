import { Types } from 'mongoose';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

/**
 * Resolves the plan key to persist on UsageLedger.planAtTime.
 * Falls back to `free` when workspace is missing, invalid, or resolver fails.
 */
export async function resolveUsageLedgerPlanAtTime(
  entitlementsService: WorkspaceEntitlementsService,
  workspaceId: string | null | undefined,
): Promise<string> {
  const id = String(workspaceId ?? '').trim();
  if (!id || !Types.ObjectId.isValid(id)) return 'free';
  try {
    const entitlements = await entitlementsService.resolveForWorkspace(id);
    return entitlements.planKey;
  } catch {
    return 'free';
  }
}
