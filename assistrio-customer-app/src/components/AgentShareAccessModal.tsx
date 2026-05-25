import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BotAccessGrantPatchItem, BotAccessGrantRow, CustomerBotListItem } from '@/api/types';
import { getCustomerBotAccessGrants, patchCustomerBotAccessGrants } from '@/api/customerApi';
import { Modal, Switch, Button } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { workspaceRoleLabel } from '@/lib/workspaceRoles';

type Props = {
  open: boolean;
  bot: CustomerBotListItem | null;
  onClose: () => void;
};

function statusLabel(status: BotAccessGrantRow['status']): string {
  if (status === 'active') return 'Active';
  if (status === 'pending_invite') return 'Pending invite';
  if (status === 'expired') return 'Expired';
  return 'Cancelled';
}

function rowKey(row: BotAccessGrantRow): string {
  return row.subjectType === 'user' ? `user:${row.userId}` : `invite:${row.inviteId}`;
}

export function AgentShareAccessModal({ open, bot, onClose }: Props) {
  const [rows, setRows] = useState<BotAccessGrantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !bot) return;
    let cancelled = false;
    setLoading(true);
    void getCustomerBotAccessGrants(bot._id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        appToast.error(res.error || 'Could not load access settings.');
        return;
      }
      setRows(res.data.grants);
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
    setRows(res.data.grants);
    appToast.success('Agent access updated.');
    onClose();
  }, [bot, onClose, rows]);

  const editableRows = rows.filter((row) => !row.locked);

  return (
    <Modal open={open} onClose={onClose} title="Share agent access" size="lg">
      {bot ? (
        <div className="space-y-4">
          <p className="m-0 text-[0.875rem] text-slate-500">
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
                    <th className="px-3 py-2 font-medium">Name / email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Can view</th>
                    <th className="px-3 py-2 font-medium">Can preview</th>
                  </tr>
                </thead>
                <tbody>
                  {editableRows.map((row) => {
                    const key = rowKey(row);
                    return (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{row.displayName || row.email}</div>
                          {row.displayName && row.email ? (
                            <div className="text-[0.75rem] text-slate-500">{row.email}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 capitalize text-slate-600">{statusLabel(row.status)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{workspaceRoleLabel(row.role)}</td>
                        <td className="px-3 py-2.5">
                          <Switch
                            checked={row.canView}
                            disabled={row.locked}
                            onCheckedChange={(checked) => updateRow(key, { canView: checked, canPreview: checked ? row.canPreview : false })}
                            aria-label={`Can view for ${row.email}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Switch
                            checked={row.canPreview}
                            disabled={row.locked || !row.canView}
                            onCheckedChange={(checked) => updateRow(key, { canPreview: checked, canView: checked ? true : row.canView })}
                            aria-label={`Can preview for ${row.email}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {editableRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
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
