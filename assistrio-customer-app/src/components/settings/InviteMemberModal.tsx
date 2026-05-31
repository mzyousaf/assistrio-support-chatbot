import { useEffect, useId, useState } from 'react';
import { Copy, Loader2, Mail, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCustomerBots, postWorkspaceInvite } from '@/api/customerApi';
import type { CustomerBotListItem, WorkspaceInviteRole } from '@/api/types';
import { Button, Checkbox, Input, Label, Modal, Select } from '@/components/ui';
import {
  modalFormFieldLabelClass,
  modalFormInputSize,
  modalFormSelectSize,
} from '@/components/ui/modalFormFieldStyles';
import { appToast } from '@/lib/app-toast';
import { useUpgradePlanModal } from '@/components/billing/UpgradePlanModalProvider';
import { PLAN_LIMIT_WORKSPACE_MEMBERS_CODE } from '@/lib/planLimitError';
import {
  copyTextToClipboard,
  isValidInviteEmail,
  workspaceMembersErrorMessage,
} from '@/lib/workspaceMembersMessages';
import { cn } from '@/lib/utils';
import {
  buildInviteBotGrants,
  emptyInviteBotAccessState,
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

const agentTableGridClass = 'grid grid-cols-[minmax(0,1fr)_72px_72px] items-center';

function BotAccessAvatar({ bot }: { bot: CustomerBotListItem }) {
  const accent = bot.primaryColor && /^#[0-9a-f]{6}$/i.test(bot.primaryColor) ? bot.primaryColor : '#0d9488';
  if (bot.imageUrl) {
    return (
      <img
        src={bot.imageUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-lg object-cover"
      />
    );
  }
  if (bot.avatarEmoji?.trim()) {
    return (
      <div
        className="assistrio-emoji-presentation flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm leading-none"
        style={{ backgroundColor: accent + '18' }}
      >
        {bot.avatarEmoji.trim()}
      </div>
    );
  }
  return (
    <div
      className="h-8 w-8 shrink-0 rounded-lg"
      style={{ backgroundColor: accent }}
    />
  );
}

function ModalHeaderIcon(props: { tone?: 'default' | 'success' }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        props.tone === 'success'
          ? 'border-teal-100 text-teal-600'
          : 'border-slate-200/70 text-slate-600',
      )}
      aria-hidden
    >
      <UserPlus className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

export function InviteMemberModal({ open, onClose, workspaceId, canAssignBotAccess = false, onInvited }: Props) {
  const emailId = useId();
  const roleId = useId();
  const { openUpgradeModal } = useUpgradePlanModal();
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
      if (result.errorCode === PLAN_LIMIT_WORKSPACE_MEMBERS_CODE) {
        appToast.error(message);
        openUpgradeModal({ reason: 'members' });
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

  const modalTitle =
    phase === 'success' ? (
      <span className="flex items-center gap-3">
        <ModalHeaderIcon tone="success" />
        <span className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">Invite created</span>
      </span>
    ) : (
      <span className="flex items-center gap-3">
        <ModalHeaderIcon />
        <span className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">Invite member</span>
      </span>
    );

  const modalDescription =
    phase === 'success'
      ? 'Your invite is ready. Copy the link below to share with your teammate, or they can join from the invitation email.'
      : 'Send an invitation to join this workspace.';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      allowDismiss={!submitting}
      className="w-[calc(100vw-24px)] max-w-[520px] sm:w-full"
      headerClassName="!border-slate-200/70 !bg-white px-5 py-4"
      bodyClassName="px-5 py-4"
      footerClassName="!border-slate-200/70 !bg-white px-5 py-3 gap-2"
      title={modalTitle}
      description={<p className="m-0 mt-0.5 text-xs leading-snug text-slate-500">{modalDescription}</p>}
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
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
          <div className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5">
            <code className="min-w-0 flex-1 break-all text-[11px] leading-relaxed text-slate-700">{inviteUrl}</code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => void handleCopyInviteUrl()}
              aria-label="Copy invite link"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy
            </Button>
          </div>
          <p className="m-0 text-[11px] text-slate-500">
            Need more seats?{' '}
            <Link to="/settings/billing" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              View plans
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor={emailId} className={modalFormFieldLabelClass}>
              Email
            </Label>
            <Input
              id={emailId}
              type="email"
              inputMode="email"
              inputSize={modalFormInputSize}
              quiet
              autoComplete="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              invalid={!!emailError}
              leadingIcon={<Mail className="h-3.5 w-3.5" aria-hidden />}
              disabled={submitting}
            />
            {emailError ? (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {emailError}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor={roleId} className={modalFormFieldLabelClass}>
              Role
            </Label>
            <Select
              id={roleId}
              className="w-full"
              selectSize={modalFormSelectSize}
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceInviteRole)}
              disabled={submitting}
              aria-label="Role"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
            <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Admins can manage workspace settings and invite teammates.
            </p>
            {!canAssignBotAccess ? (
              <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-500">
                A workspace owner can grant agent access after the invite is sent.
              </p>
            ) : null}
          </div>

          {canAssignBotAccess ? (
            <div className="pt-0.5">
              <Label className="mb-1.5 block text-xs font-medium text-slate-800">Agent access</Label>
              <p className="m-0 mb-2.5 text-[11px] leading-relaxed text-slate-500">
                Choose which agents this member can access.
              </p>

              <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                {botsLoading ? (
                  <div className="flex items-center justify-center bg-slate-50/60 py-8 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  </div>
                ) : bots.length === 0 ? (
                  <p className="m-0 bg-slate-50/60 px-3 py-4 text-center text-[11px] leading-relaxed text-slate-500">
                    No agents in this workspace yet. You can invite now and share agents later.
                  </p>
                ) : (
                  <>
                    <div
                      className={cn(
                        agentTableGridClass,
                        'border-b border-slate-200/60 bg-slate-50/70 px-3 py-2 text-[11px] font-medium text-slate-500',
                      )}
                    >
                      <span>Agent</span>
                      <span className="text-center">View</span>
                      <span className="text-center">Preview</span>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto">
                      <ul className="m-0 list-none p-0">
                        {bots.map((bot) => {
                          const access = botAccess[bot._id] ?? { canView: false, canPreview: false };
                          const botName = bot.name?.trim() || 'Untitled agent';
                          return (
                            <li
                              key={bot._id}
                              className={cn(
                                agentTableGridClass,
                                'min-h-[2.75rem] border-b border-slate-100/90 bg-white px-3 py-1.5 transition-colors last:border-b-0 hover:bg-slate-50/80',
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <BotAccessAvatar bot={bot} />
                                <div className="min-w-0 truncate text-sm font-medium leading-tight text-slate-900">
                                  {botName}
                                </div>
                              </div>
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={access.canView}
                                  disabled={submitting}
                                  aria-label={`View access for ${botName}`}
                                  onChange={(e) =>
                                    setBotAccess((prev) =>
                                      updateInviteBotAccess(prev, bot._id, {
                                        canView: (e.target as HTMLInputElement).checked,
                                      }),
                                    )
                                  }
                                />
                              </div>
                              <div className={cn('flex justify-center', !access.canView && 'opacity-50')}>
                                <Checkbox
                                  checked={access.canPreview}
                                  disabled={submitting}
                                  aria-label={`Preview access for ${botName}`}
                                  onChange={(e) =>
                                    setBotAccess((prev) =>
                                      updateInviteBotAccess(prev, bot._id, {
                                        canPreview: (e.target as HTMLInputElement).checked,
                                      }),
                                    )
                                  }
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
