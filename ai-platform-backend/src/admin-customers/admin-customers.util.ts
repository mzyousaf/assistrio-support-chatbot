import { Types } from 'mongoose';

export type PaginationParams = { page: number; limit: number; skip: number };

export function parsePaginationQuery(
  pageRaw?: string,
  limitRaw?: string,
  defaultLimit = 20,
  maxLimit = 100,
): PaginationParams {
  const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(limitRaw ?? String(defaultLimit)), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function customerDisplayName(doc: {
  email?: string;
  firstName?: string;
  lastName?: string;
}): string {
  const n = `${String(doc.firstName ?? '').trim()} ${String(doc.lastName ?? '').trim()}`.trim();
  if (n) return n;
  const email = String(doc.email ?? '').trim();
  if (!email) return 'Customer';
  const local = email.split('@')[0]?.trim();
  return local || email;
}

export function isoOrNull(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** Bots visible to a customer (matches {@link WorkspacesService.canUserAccessWorkspaceBot} for role customer). */
export function accessibleBotsMatchForCustomer(
  userId: Types.ObjectId,
  workspaceIds: Types.ObjectId[],
): Record<string, unknown> {
  const orClause: Record<string, unknown>[] = [];
  if (workspaceIds.length > 0) {
    orClause.push({ workspaceId: { $in: workspaceIds } });
  }
  orClause.push({
    $and: [
      { $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }] },
      { $or: [{ ownerId: userId }, { createdByUserId: userId }] },
    ],
  });
  return { $or: orClause };
}
