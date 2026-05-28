import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getWorkspaceInviteBotGrants,
  getWorkspaceMemberBotGrants,
  patchWorkspaceInviteBotGrants,
  patchWorkspaceMemberBotGrants,
} from '@/api/customerApi';
import type { SubjectBotGrantItem } from '@/api/types';
import { Button, Checkbox, Modal } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import type { WorkspacePersonRow } from './WorkspacePeopleTable';

type Props = {
  open: boolean;
  workspaceId: string;
  row: WorkspacePersonRow | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const agentTableGridClass = 'grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2';

function updateGrant(
  grants: SubjectBotGrantItem[],
  botId: string,
  patch: Partial<Pick<SubjectBotGrantItem, 'canView' | 'canPreview'>>,
): SubjectBotGrantItem[] {
  return grants.map((grant) => {
    if (grant.botId !== botId) return grant;
    const canView = patch.canView ?? grant.canView;
    const canPreview = patch.canPreview != null ? patch.canPreview && canView : grant.canPreview && canView;
    return { ...grant, canView, canPreview };
  });
}

export function EditMemberBotAccessModal({ open, workspaceId, row, onClose, onSaved }: Props) {
  const [grants, setGrants] = useState<SubjectBotGrantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    let cancelled = false;
    setLoading(true);
    const load =
      row.kind === 'member'
        ? getWorkspaceMemberBotGrants(workspaceId, row.member.userId)
        : getWorkspaceInviteBotGrants(workspaceId, row.invite.id);
    void load.then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        appToast.error(res.error || 'Could not load agent access.');
        return;
      }
      setGrants(res.data.grants);
    });
    return () => {
      cancelled = true;
    };
  }, [open, row, workspaceId]);

  const subjectLabel = row?.name || row?.email || 'member';

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const res =
      row.kind === 'member'
        ? await patchWorkspaceMemberBotGrants(workspaceId, row.member.userId, grants)
        : await patchWorkspaceInviteBotGrants(workspaceId, row.invite.id, grants);
    setSaving(false);
    if (!res.ok) {
      appToast.error(res.error || 'Could not save agent access.');
      return;
    }
    appToast.success('Agent access updated.');
    await onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit agent access" size="lg">
      {row ? (
        <div className="space-y-4">
          <p className="m-0 pb-3 text-[0.875rem] text-slate-500">
            Choose which agents <span className="font-medium text-slate-700">{subjectLabel}</span> can view and
            preview.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400" aria-busy="true">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : grants.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">No agents in this workspace yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/90">
              <div className={`border-b border-slate-100 bg-slate-50 px-3 py-2 text-[0.75rem] font-medium text-slate-500 ${agentTableGridClass}`}>
                <span>Agent</span>
                <span className="text-center">View</span>
                <span className="text-center">Preview</span>
              </div>
              <div className="divide-y divide-slate-100">
                {grants.map((grant) => (
                  <div key={grant.botId} className={`px-3 py-2.5 ${agentTableGridClass}`}>
                    <span className="truncate text-sm font-medium text-slate-800">{grant.botName}</span>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={grant.canView}
                        onChange={(e) =>
                          setGrants((prev) =>
                            updateGrant(prev, grant.botId, {
                              canView: (e.target as HTMLInputElement).checked,
                              canPreview:
                                (e.target as HTMLInputElement).checked ? grant.canPreview : false,
                            }),
                          )
                        }
                        aria-label={`Can view ${grant.botName}`}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={grant.canPreview}
                        disabled={!grant.canView}
                        onChange={(e) =>
                          setGrants((prev) =>
                            updateGrant(prev, grant.botId, {
                              canPreview: (e.target as HTMLInputElement).checked,
                              canView: (e.target as HTMLInputElement).checked ? true : grant.canView,
                            }),
                          )
                        }
                        aria-label={`Can preview ${grant.botName}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || loading || grants.length === 0}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
