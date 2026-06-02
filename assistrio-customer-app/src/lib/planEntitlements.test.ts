import { describe, expect, it } from 'vitest';
import {
  formatAiCreditsHelperText,
  formatCreditsIncludedLabel,
  mockTrialBillingEntitlements,
  mockTrialWorkspaceSummary,
  workspaceMemberInvitesAllowed,
  workspaceSharePreviewAllowed,
} from './planEntitlements';
import type { WorkspaceBillingSummary } from '@/api/types';

describe('planEntitlements', () => {
  it('blocks member invites on free trial workspace', () => {
    expect(workspaceMemberInvitesAllowed(mockTrialWorkspaceSummary())).toBe(false);
    expect(workspaceMemberInvitesAllowed(mockTrialWorkspaceSummary({ memberInvitesAllowed: true }))).toBe(true);
  });

  it('blocks share preview on free trial workspace', () => {
    expect(workspaceSharePreviewAllowed(mockTrialWorkspaceSummary())).toBe(false);
    expect(
      workspaceSharePreviewAllowed(
        mockTrialBillingEntitlements({ sharePreviewAllowed: false, isTrialPlan: true }),
      ),
    ).toBe(false);
  });

  it('allows share preview on paid workspace entitlements', () => {
    expect(
      workspaceSharePreviewAllowed(
        mockTrialBillingEntitlements({ sharePreviewAllowed: true, isTrialPlan: false }),
      ),
    ).toBe(true);
  });

  it('formats trial billing copy', () => {
    const summary = {
      plan: { currentPeriodEnd: '2026-06-08T00:00:00.000Z' },
      entitlements: mockTrialBillingEntitlements(),
    } as WorkspaceBillingSummary;

    expect(formatCreditsIncludedLabel(summary)).toBe('50 trial AI credits');
    expect(formatAiCreditsHelperText(summary)).toContain('Trial credits do not renew');
  });
});
