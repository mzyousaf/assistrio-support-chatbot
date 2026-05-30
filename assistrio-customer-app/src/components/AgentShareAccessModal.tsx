import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BotAccessGrantPatchItem, BotAccessGrantRow, BotViewAccessPreviewMember, CustomerBotListItem } from '@/api/types';
import { getCustomerBotAccessGrants, getWorkspaceMembers, patchCustomerBotAccessGrants } from '@/api/customerApi';
import { WorkspacePersonIdentity, botAccessGrantRowToProfile } from '@/components/settings/WorkspacePersonIdentity';
import { Modal, Checkbox, Button } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { enrichBotAccessGrantRowsWithMembers } from '@/lib/workspaceMembersMessages';
import { normalizeWorkspacePersonEmail } from '@/lib/workspacePeopleRows.util';
import { WorkspaceRolePill } from '@/components/settings/WorkspaceRolePill';

type Props = {
  open: boolean;
  bot: CustomerBotListItem | null;
  onClose: () => void;
  onAccessUpdated?: (botId: string, preview: BotViewAccessPreviewMember[]) => void;
};

function filterCustomerVisibleGrantRows(rows: BotAccessGrantRow[]): BotAccessGrantRow[] {
  const activeMemberEmails = new Set(
    rows
      .filter((row) => row.subjectType === 'user' && row.status === 'active')
      .map((row) => normalizeWorkspacePersonEmail(row.email)),
  );
  const seenInviteEmails = new Set<string>();

  return rows.filter((row) => {
    if (row.status === 'cancelled') return false;
    if (row.subjectType === 'invite') {
      const email = normalizeWorkspacePersonEmail(row.email);
      if (!email || activeMemberEmails.has(email) || seenInviteEmails.has(email)) return false;
      seenInviteEmails.add(email);
    }
    return true;
  });
}

function buildViewAccessPreview(rows: BotAccessGrantRow[]): BotViewAccessPreviewMember[] {
  return rows
    .filter((row) => !row.locked && row.canView)
    .map((row) => ({
      email: row.email,
      displayName: row.displayName || row.email,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      avatarUrl: row.avatarUrl ?? null,
      picture: row.picture ?? null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

function rowKey(row: BotAccessGrantRow): string {
  return row.subjectType === 'user' ? `user:${row.userId}` : `invite:${row.inviteId}`;
}

export function AgentShareAccessModal({ open, bot, onClose, onAccessUpdated }: Props) {
  const [rows, setRows] = useState<BotAccessGrantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !bot) return;
    let cancelled = false;
    setLoading(true);
    setRows([]);

    const workspaceId = bot.workspaceId?.trim();
    void Promise.all([
      getCustomerBotAccessGrants(bot._id),
      workspaceId ? getWorkspaceMembers(workspaceId) : Promise.resolve(null),
    ]).then(([grantsRes, membersRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!grantsRes.ok) {
        appToast.error(grantsRes.error || 'Could not load access settings.');
        return;
      }
      const members = membersRes?.ok ? membersRes.data : [];
      setRows(
        enrichBotAccessGrantRowsWithMembers(
          filterCustomerVisibleGrantRows(grantsRes.data.grants),
          members,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [bot, open]);

  const updateRow = useCallback((key: string, patch: Partial<Pick<BotAccessGrantRow, 'canView' | 'canPreview'>>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (rowKey(row) !== key || row.locked) return row;
        const canView = patch.canView ?? row.canView;
        const canPreview = patch.canPreview != null ? patch.canPreview && canView : row.canPreview && canView;
        return { ...row, canView, canPreview };
      }),
    );
  }, []);

  const save = useCallback(async () => {
    if (!bot) return;
    setSaving(true);
    const grants: BotAccessGrantPatchItem[] = rows
      .filter((row) => !row.locked)
      .map((row) => ({
        subjectType: row.subjectType,
        userId: row.userId,
        inviteId: row.inviteId,
        canView: row.canView,
        canPreview: row.canPreview,
      }));
    const res = await patchCustomerBotAccessGrants(bot._id, grants);
    setSaving(false);
    if (!res.ok) {
      appToast.error(res.error || 'Could not save access settings.');
      return;
    }
    const savedRows = filterCustomerVisibleGrantRows(res.data.grants);
    setRows(savedRows);
    onAccessUpdated?.(bot._id, buildViewAccessPreview(savedRows));
    appToast.success('Agent access updated.');
    onClose();
  }, [bot, onAccessUpdated, onClose, rows]);

  const editableRows = rows.filter((row) => !row.locked && row.status !== 'cancelled');

  return (
    <Modal open={open} onClose={onClose} title="Share agent access" size="xl">
      {bot ? (
        <div className="space-y-4">
          <p className="m-0 pb-3 text-[0.875rem] text-slate-500">
            Choose who can view and preview <span className="font-medium text-slate-700">{bot.name}</span>.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400" aria-busy="true">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/90">
              <table className="min-w-full border-collapse text-left text-[0.8125rem]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 text-center font-medium">Can view</th>
                    <th className="px-3 py-2 text-center font-medium">Can preview</th>
                  </tr>
                </thead>
                <tbody>
                  {editableRows.map((row) => {
                    const key = rowKey(row);
                    return (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <WorkspacePersonIdentity profile={botAccessGrantRowToProfile(row)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <WorkspaceRolePill role={row.role} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={row.canView}
                              disabled={row.locked}
                              onChange={(e) =>
                                updateRow(key, {
                                  canView: e.target.checked,
                                  canPreview: e.target.checked ? row.canPreview : false,
                                })
                              }
                              aria-label={`Can view for ${row.email}`}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={row.canPreview}
                              disabled={row.locked || !row.canView}
                              onChange={(e) =>
                                updateRow(key, {
                                  canPreview: e.target.checked,
                                  canView: e.target.checked ? true : row.canView,
                                })
                              }
                              aria-label={`Can preview for ${row.email}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {editableRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                        No workspace members to configure yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
