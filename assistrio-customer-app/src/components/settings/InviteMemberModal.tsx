import { useEffect, useId, useState } from 'react';
import { Copy, Loader2, Mail, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCustomerBots, postWorkspaceInvite } from '@/api/customerApi';
import type { CustomerBotListItem, WorkspaceInviteRole } from '@/api/types';
import { Button, Input, Label, Modal, Select, Switch } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import {
  copyTextToClipboard,
  isValidInviteEmail,
  workspaceMembersErrorMessage,
} from '@/lib/workspaceMembersMessages';
import { cn } from '@/lib/utils';
import {
  buildInviteBotGrants,
  clearInviteBotAccess,
  emptyInviteBotAccessState,
  grantInvitePreviewAll,
  grantInviteViewAll,
  updateInviteBotAccess,
  type InviteBotAccessState,
} from './inviteMemberBotAccess.util';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  canAssignBotAccess?: boolean;
  onInvited: () => void | Promise<void>;
};

type Phase = 'form' | 'success';

function botStatusLabel(status: string): string {
  const v = (status || '').toLowerCase();
  if (v === 'published') return 'Live';
  if (v === 'draft') return 'Draft';
  return status || '—';
}

function BotAccessAvatar({ bot }: { bot: CustomerBotListItem }) {
  const accent = bot.primaryColor && /^#[0-9a-f]{6}$/i.test(bot.primaryColor) ? bot.primaryColor : '#0d9488';
  if (bot.imageUrl) {
    return <img src={bot.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />;
  }
  if (bot.avatarEmoji?.trim()) {
    return (
      <div
        className="assistrio-emoji-presentation flex h-9 w-9 items-center justify-center rounded-lg text-lg leading-none"
        style={{ backgroundColor: accent + '18' }}
      >
        {bot.avatarEmoji.trim()}
      </div>
    );
  }
  return <div className="h-9 w-9 rounded-lg" style={{ backgroundColor: accent }} />;
}

export function InviteMemberModal({ open, onClose, workspaceId, canAssignBotAccess = false, onInvited }: Props) {
  const emailId = useId();
  const roleId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceInviteRole>('member');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [bots, setBots] = useState<CustomerBotListItem[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botAccess, setBotAccess] = useState<InviteBotAccessState>({});

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('member');
    setEmailError(null);
    setSubmitting(false);
    setPhase('form');
    setInviteUrl(null);
    setBots([]);
    setBotAccess({});
    if (!canAssignBotAccess) {
      setBotsLoading(false);
      return;
    }
    setBotsLoading(true);
    let cancelled = false;
    void getCustomerBots({ workspaceId, status: 'all' }).then((res) => {
      if (cancelled) return;
      setBotsLoading(false);
      if (!res.ok) {
        appToast.error(res.error || 'Could not load agents.');
        return;
      }
      setBots(res.data);
      setBotAccess(emptyInviteBotAccessState(res.data));
    });
    return () => {
      cancelled = true;
    };
  }, [canAssignBotAccess, open, workspaceId]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return;
    }
    if (!isValidInviteEmail(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    const botGrants = canAssignBotAccess ? buildInviteBotGrants(botAccess) : [];
    const result = await postWorkspaceInvite(workspaceId, { email: trimmed, role, botGrants });
    setSubmitting(false);
    if (!result.ok) {
      const message = workspaceMembersErrorMessage(result, 'Could not send invite.');
      if (result.errorCode === 'plan_limit_workspace_members') {
        appToast.error(message, {
          primary: {
            label: 'View plans',
            onClick: () => {
              window.location.assign('/settings/plans');
            },
          },
        });
      } else {
        appToast.error(message);
      }
      return;
    }
    await onInvited();
    appToast.success('Invite sent.');
    if (result.data.inviteUrl?.trim()) {
      setInviteUrl(result.data.inviteUrl.trim());
      setPhase('success');
      return;
    }
    onClose();
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    const copied = await copyTextToClipboard(inviteUrl);
    if (copied) {
      appToast.success('Invite link copied.');
    } else {
      appToast.error('Could not copy invite link.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      allowDismiss={!submitting}
      size="md"
      title={
        phase === 'success' ? (
          <span className="inline-flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-teal-600 shadow-sm"
              aria-hidden
            >
              <UserPlus className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Invite created
          </span>
        ) : (
          <span className="inline-flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/95 bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04]"
              aria-hidden
            >
              <UserPlus className="h-5 w-5" strokeWidth={2} />
            </span>
            Invite member
          </span>
        )
      }
      description={
        phase === 'success'
          ? 'Share this invite link for testing. In production, the invitee will receive an email.'
          : 'Send an invite to join this workspace.'
      }
      footer={
        phase === 'success' ? (
          <Button type="button" variant="primary" size="sm" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={submitting}
              aria-busy={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                'Send invite'
              )}
            </Button>
          </>
        )
      }
    >
      {phase === 'success' && inviteUrl ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 p-3">
            <code className="min-w-0 flex-1 break-all text-[0.8125rem] leading-relaxed text-slate-700">
              {inviteUrl}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => void handleCopyInviteUrl()}
              aria-label="Copy invite link"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </Button>
          </div>
          <p className="m-0 text-sm text-slate-500">
            Need more seats later?{' '}
            <Link to="/settings/plans" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              View plans
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <Label htmlFor={emailId}>Email</Label>
            <Input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              invalid={!!emailError}
              leadingIcon={<Mail className="h-4 w-4" aria-hidden />}
              disabled={submitting}
            />
            {emailError ? (
              <p className="mt-1.5 text-sm text-red-600" role="alert">
                {emailError}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor={roleId}>Role</Label>
            <Select
              id={roleId}
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceInviteRole)}
              disabled={submitting}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
            <p className="mt-1.5 text-sm text-slate-500">
              Admins can invite members and manage workspace settings.
              {canAssignBotAccess
                ? ' Agent access below controls which agents they can see and preview.'
                : ' A workspace owner can grant agent access after the invite is sent.'}
            </p>
          </div>

          {canAssignBotAccess ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="mb-0">Agent access</Label>
              {bots.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={submitting || botsLoading}
                    onClick={() => setBotAccess(grantInviteViewAll(bots))}
                  >
                    Grant view to all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={submitting || botsLoading}
                    onClick={() => setBotAccess(grantInvitePreviewAll(bots))}
                  >
                    Grant preview to all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={submitting || botsLoading}
                    onClick={() => setBotAccess(clearInviteBotAccess(bots))}
                  >
                    Clear all
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="mb-3 text-sm text-slate-500">
              View lets this person see the agent. Preview lets them open and test it.
            </p>

            {botsLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-slate-200/90 py-8 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              </div>
            ) : bots.length === 0 ? (
              <p className="m-0 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500">
                No agents in this workspace yet. You can invite now and share agents later.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200/90">
                <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                  {bots.map((bot) => {
                    const access = botAccess[bot._id] ?? { canView: false, canPreview: false };
                    return (
                      <li key={bot._id} className="flex items-center gap-3 px-3 py-2.5">
                        <BotAccessAvatar bot={bot} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {bot.name?.trim() || 'Untitled agent'}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {bot.shortDescription?.trim() || 'No tagline'}
                            <span className="text-slate-300"> · </span>
                            {botStatusLabel(bot.status)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <span>View</span>
                            <Switch
                              checked={access.canView}
                              disabled={submitting}
                              aria-label={`View access for ${bot.name}`}
                              onCheckedChange={(checked) =>
                                setBotAccess((prev) => updateInviteBotAccess(prev, bot._id, { canView: checked }))
                              }
                            />
                          </label>
                          <label
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs',
                              access.canView ? 'text-slate-600' : 'text-slate-400',
                            )}
                          >
                            <span>Preview</span>
                            <Switch
                              checked={access.canPreview}
                              disabled={submitting}
                              aria-label={`Preview access for ${bot.name}`}
                              onCheckedChange={(checked) =>
                                setBotAccess((prev) => updateInviteBotAccess(prev, bot._id, { canPreview: checked }))
                              }
                            />
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
