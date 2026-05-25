import { Types } from 'mongoose';
import type { WorkspaceBotAccessGrantSubjectType } from '../models/workspace-bot-access-grant.schema';

export const WORKSPACE_BOT_ACCESS_DENIED_MESSAGE =
  "You don't have access to this agent. Ask a workspace owner for access.";
export const WORKSPACE_BOT_ACCESS_DENIED_CODE = 'workspace_bot_access_denied';

export type BotAccessGrantInput = {
  subjectType: WorkspaceBotAccessGrantSubjectType;
  userId?: string;
  inviteId?: string;
  canView?: boolean;
  canPreview?: boolean;
};

export type BotAccessGrantRow = {
  subjectType: WorkspaceBotAccessGrantSubjectType;
  userId?: string;
  inviteId?: string;
  email: string;
  displayName: string;
  status: 'active' | 'pending_invite' | 'expired' | 'cancelled';
  role: 'owner' | 'admin' | 'member';
  canView: boolean;
  canPreview: boolean;
  locked: boolean;
};

export function normalizeGrantFlags(canView?: boolean, canPreview?: boolean): { canView: boolean; canPreview: boolean } {
  const view = canView === true;
  const preview = canPreview === true && view;
  return { canView: view, canPreview: preview };
}

export function oidString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v !== null && 'toString' in v) return String((v as { toString(): string }).toString());
  return String(v);
}

export function isValidObjectIdString(v: unknown): v is string {
  const s = oidString(v);
  return s.length > 0 && Types.ObjectId.isValid(s);
}

export function parseAccessGrantPatch(body: unknown): BotAccessGrantInput[] | null {
  if (!body || typeof body !== 'object') return null;
  const grantsRaw = (body as { grants?: unknown }).grants;
  if (!Array.isArray(grantsRaw)) return null;
  const out: BotAccessGrantInput[] = [];
  for (const row of grantsRaw) {
    if (!row || typeof row !== 'object') return null;
    const o = row as Record<string, unknown>;
    const subjectType = String(o.subjectType ?? '').trim();
    if (subjectType !== 'user' && subjectType !== 'invite') return null;
    const userId = o.userId != null ? oidString(o.userId) : undefined;
    const inviteId = o.inviteId != null ? oidString(o.inviteId) : undefined;
    if (subjectType === 'user' && !isValidObjectIdString(userId)) return null;
    if (subjectType === 'invite' && !isValidObjectIdString(inviteId)) return null;
    out.push({
      subjectType,
      userId,
      inviteId,
      canView: o.canView === true,
      canPreview: o.canPreview === true,
    });
  }
  return out;
}
