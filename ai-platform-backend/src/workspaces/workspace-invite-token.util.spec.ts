import {
  createWorkspaceInviteToken,
  hashWorkspaceInviteToken,
  verifyWorkspaceInviteToken,
} from './workspace-invite-token.util';
import { normalizeInviteEmail } from './workspace-invite.service';

describe('workspace-invite-token.util', () => {
  it('createWorkspaceInviteToken generates URL-safe tokens', () => {
    const token = createWorkspaceInviteToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashWorkspaceInviteToken produces 64-char hex', () => {
    const token = createWorkspaceInviteToken();
    const hash = hashWorkspaceInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyWorkspaceInviteToken accepts valid token/hash pair', () => {
    const token = createWorkspaceInviteToken();
    const hash = hashWorkspaceInviteToken(token);
    expect(verifyWorkspaceInviteToken(hash, token)).toBe(true);
  });

  it('verifyWorkspaceInviteToken rejects invalid token', () => {
    const token = createWorkspaceInviteToken();
    const hash = hashWorkspaceInviteToken(token);
    expect(verifyWorkspaceInviteToken(hash, `${token}x`)).toBe(false);
    expect(verifyWorkspaceInviteToken(hash, '')).toBe(false);
    expect(verifyWorkspaceInviteToken('', token)).toBe(false);
  });
});

describe('normalizeInviteEmail', () => {
  it('lowercases and trims email', () => {
    expect(normalizeInviteEmail('  User@Example.COM  ')).toBe('user@example.com');
  });
});
