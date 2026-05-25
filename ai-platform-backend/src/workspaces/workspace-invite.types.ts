import type { WorkspaceInvite } from '../models/workspace-invite.schema';
import type { WorkspaceInviteRole, WorkspaceInviteStatus } from '../models/workspace-invite.constants';

export type WorkspaceInviteListItem = {
  id: string;
  email: string;
  role: WorkspaceInviteRole;
  status: WorkspaceInviteStatus;
  expiresAt: Date;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type InviteDoc = WorkspaceInvite & {
  _id: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

export function serializeWorkspaceInvite(doc: InviteDoc): WorkspaceInviteListItem {
  return {
    id: String(doc._id),
    email: doc.email,
    role: doc.role,
    status: doc.status,
    expiresAt: doc.expiresAt,
    invitedByUserId: String(doc.invitedByUserId),
    acceptedByUserId: doc.acceptedByUserId != null ? String(doc.acceptedByUserId) : null,
    acceptedAt: doc.acceptedAt ?? null,
    cancelledAt: doc.cancelledAt ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export type WorkspaceInvitePreview = {
  workspaceName: string;
  invitedEmail: string;
  role: WorkspaceInviteRole;
  expiresAt: Date;
  inviterEmail: string | null;
  inviterName: string | null;
};

export type CreateWorkspaceInviteResponse = WorkspaceInviteListItem & {
  inviteUrl?: string;
};
