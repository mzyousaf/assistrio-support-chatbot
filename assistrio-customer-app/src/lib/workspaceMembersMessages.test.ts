import { describe, expect, it } from 'vitest';
import {
  countWorkspaceSeatsUsed,
  enrichBotAccessGrantRowsWithMembers,
  isPendingWorkspaceInvite,
  isValidInviteEmail,
  workspaceMembersErrorMessage,
} from './workspaceMembersMessages';
import type { BotAccessGrantRow } from '@/api/types';

describe('workspaceMembersMessages', () => {
  it('validates invite emails', () => {
    expect(isValidInviteEmail('a@b.co')).toBe(true);
    expect(isValidInviteEmail('not-an-email')).toBe(false);
    expect(isValidInviteEmail('')).toBe(false);
  });

  it('counts pending unexpired invites toward seat usage', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const invites = [
      { status: 'pending', expiresAt: future },
      { status: 'pending', expiresAt: past },
      { status: 'cancelled', expiresAt: future },
    ];
    expect(countWorkspaceSeatsUsed(2, invites)).toBe(3);
    expect(invites.filter(isPendingWorkspaceInvite)).toHaveLength(1);
  });

  it('maps known workspace member error codes', () => {
    expect(
      workspaceMembersErrorMessage(
        { ok: false, status: 409, error: '', errorCode: 'workspace_invite_already_pending', body: {} },
        'fallback',
      ),
    ).toContain('pending invite');
    expect(
      workspaceMembersErrorMessage(
        { ok: false, status: 403, error: '', errorCode: 'plan_limit_workspace_members', body: {} },
        'fallback',
      ),
    ).toContain('member limit');
    expect(
      workspaceMembersErrorMessage(
        { ok: false, status: 502, error: '', errorCode: 'email_delivery_failed', body: {} },
        'fallback',
      ),
    ).toContain('invite email');
    expect(
      workspaceMembersErrorMessage(
        { ok: false, status: 403, error: '', errorCode: 'workspace_owner_protected', body: {} },
        'fallback',
      ),
    ).toContain('owner cannot be removed');
    expect(
      workspaceMembersErrorMessage(
        { ok: false, status: 403, error: '', errorCode: 'workspace_last_manager_required', body: {} },
        'fallback',
      ),
    ).toContain('owner or admin');
  });

  it('enriches grant rows with member avatar and name fields', () => {
    const rows: BotAccessGrantRow[] = [
      {
        subjectType: 'user',
        userId: 'user-2',
        email: 'member@test.com',
        displayName: 'Member User',
        status: 'active',
        role: 'member',
        canView: true,
        canPreview: false,
        locked: false,
      },
    ];
    const enriched = enrichBotAccessGrantRowsWithMembers(rows, [
      {
        userId: 'user-2',
        email: 'member@test.com',
        firstName: 'Member',
        lastName: 'User',
        picture: 'https://lh3.googleusercontent.com/a/google-photo',
        displayName: 'Member User',
        avatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
        role: 'member',
        joinedAt: null,
      },
    ]);
    expect(enriched[0]?.avatarUrl).toContain('google-photo');
    expect(enriched[0]?.firstName).toBe('Member');
  });
});
