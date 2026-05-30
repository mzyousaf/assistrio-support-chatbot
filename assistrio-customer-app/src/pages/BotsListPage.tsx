import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Plus } from 'lucide-react';
import { getCustomerBots, postCustomerBotDraft, deleteCustomerBot } from '../api/customerApi';
import type { CustomerBotListItem } from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { DataPageLayout } from '../layout/workspace-layout';
import { AgentCard, DeleteAgentDialog } from '../components/AgentCard';
import { AgentsPageSkeleton } from '../components/AgentsPageSkeleton';
import { AgentShareAccessModal } from '../components/AgentShareAccessModal';
import { useUpgradePlanModal } from '@/components/billing/UpgradePlanModalProvider';
import { PLAN_LIMIT_WORKSPACE_BOTS_CODE } from '@/lib/planLimitError';
import { resolveActiveCustomerWorkspace } from '../lib/resolveActiveCustomerWorkspace';
import { canManageActiveWorkspace } from '../lib/canManageActiveWorkspace';
import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '../lib/workspaceRoles';
import { buildCustomerBotsListQuery } from '../lib/customerBotsQuery';
import {
  BOTS_LIST_ADMIN_ONLY_CREATE_NOTE,
  BOTS_LIST_ADMIN_ONLY_CREATE_TOAST,
  BOTS_LIST_EMPTY_ADMIN_COPY,
  BOTS_LIST_EMPTY_MEMBER_COPY,
  BOTS_LIST_EMPTY_MEMBER_TITLE,
  BOTS_LIST_EMPTY_TITLE,
  BOTS_LIST_NO_ACTIVE_WORKSPACE,
  isCreateDraftAdminDenied,
} from '../lib/botsListMessages';
import { toastIfWorkspaceAdminRequired } from '../lib/toastIfWorkspaceAdminRequired';
import { appToast } from '../lib/app-toast';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function WorkspaceAgentCountTag(props: { current: number | null; limit: number; loading?: boolean }) {
  const { current, limit, loading = false } = props;

  if (loading) {
    return (
      <span
        className="inline-flex h-[22px] w-11 animate-pulse rounded-full bg-slate-200/80"
        aria-busy="true"
        aria-label="Loading agent count"
      />
    );
  }

  const label = `${current ?? 0}/${limit}`;

  return (
    <span
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-[var(--shadow-xs)]"
      aria-label={`${current ?? 0} of ${limit} agents used`}
    >
      {label}
    </span>
  );
}

export function BotsListPage() {
  const navigate = useNavigate();
  const { customer, refreshOnboardingHeuristic, needsOnboarding } = useCustomerAuth();
  const { activeWorkspaceId, role, workspace } = resolveActiveCustomerWorkspace(customer);
  const isAdmin = canManageActiveWorkspace(customer);
  const isOwner = isWorkspaceOwnerRole(role);
  const canShareAgentAccess = isOwner;
  const showViewAccessPreview = isWorkspaceManagerRole(role);
  const { openUpgradeModal } = useUpgradePlanModal();

  const [bots, setBots] = useState<CustomerBotListItem[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(() => (activeWorkspaceId ? 'loading' : 'idle'));
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CustomerBotListItem | null>(null);
  const [shareBot, setShareBot] = useState<CustomerBotListItem | null>(null);

  const load = useCallback(async (workspaceId: string) => {
    setLoadState('loading');
    setError(null);
    setBots(null);
    const query = buildCustomerBotsListQuery({ activeWorkspaceId: workspaceId });
    const res = await getCustomerBots(query ?? undefined);
    if (res.ok) {
      setBots(res.data);
      setLoadState('ready');
      return;
    }
    setError(res.error);
    setLoadState('error');
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setBots(null);
      setLoadState('idle');
      setError(null);
      return;
    }
    void load(activeWorkspaceId);
  }, [activeWorkspaceId, load]);

  async function createDraft() {
    if (!activeWorkspaceId || !isAdmin) return;
    setCreating(true);
    setError(null);
    const clientDraftId = crypto.randomUUID();
    const res = await postCustomerBotDraft({ clientDraftId, workspaceId: activeWorkspaceId });
    setCreating(false);
    if (!res.ok) {
      if (isCreateDraftAdminDenied(res)) {
        appToast.error(BOTS_LIST_ADMIN_ONLY_CREATE_TOAST);
      } else if (res.errorCode === PLAN_LIMIT_WORKSPACE_BOTS_CODE) {
        setError(res.error);
        openUpgradeModal({ reason: 'bots', recommendedPlanKey: 'pro' });
      } else {
        setError(res.error);
      }
      return;
    }
    await refreshOnboardingHeuristic();
    void navigate(`/bots/${res.data.botId}`);
  }

  async function handleDelete(bot: CustomerBotListItem) {
    setDeletingId(bot._id);
    setError(null);
    const res = await deleteCustomerBot(bot._id);
    setDeletingId(null);
    setConfirmDelete(null);
    if (!res.ok) {
      if (toastIfWorkspaceAdminRequired(res)) return;
      setError(typeof res.error === 'string' ? res.error : 'Failed to delete agent');
      return;
    }
    setBots((prev) => prev?.filter((b) => b._id !== bot._id) ?? null);
  }

  if (!activeWorkspaceId || !workspace) {
    return (
      <DataPageLayout
        title="AI Agents"
        description="Build, train, and deploy intelligent AI agents for your workspace."
        containerSize="editor"
      >
        <div className="rounded-2xl bg-white px-6 py-10 text-center text-[0.9375rem] text-slate-500 shadow-[var(--shadow-card)]">
          {BOTS_LIST_NO_ACTIVE_WORKSPACE}
        </div>
      </DataPageLayout>
    );
  }

  const count = bots?.length ?? 0;
  const showSkeleton = loadState === 'loading';
  const showEmpty = loadState === 'ready' && !error && bots && count === 0;
  const agentCount = loadState === 'ready' ? count : null;
  const agentCountTag = (
    <WorkspaceAgentCountTag
      current={agentCount}
      limit={workspace.botLimit}
      loading={loadState === 'loading'}
    />
  );

  return (
    <DataPageLayout
      title="AI Agents"
      titleAddon={agentCountTag}
      description={
        <>
          <p>
            Build, train, and deploy intelligent AI agents that handle customer conversations on your website — 24/7.
          </p>
          {needsOnboarding && isAdmin ? (
            <p>
              New here?{' '}
              <Link
                to="/onboarding"
                className="font-semibold text-primary no-underline hover:text-[var(--teal-800)] hover:underline"
              >
                Continue guided setup
              </Link>{' '}
              to publish your first agent.
            </p>
          ) : null}
          {role === 'member' ? (
            <p className="text-[0.8125rem] text-slate-500">{BOTS_LIST_ADMIN_ONLY_CREATE_NOTE}</p>
          ) : null}
        </>
      }
      actions={
        isAdmin ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-primary px-3.5 py-2 text-[0.8125rem] font-semibold text-white shadow-[var(--shadow-primary-fill)] transition-all duration-150 hover:enabled:bg-[var(--teal-800)] active:enabled:scale-[0.98] active:enabled:bg-[var(--teal-900)] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={creating}
            onClick={() => void createDraft()}
          >
            <Plus size={15} strokeWidth={2.5} />
            {creating ? 'Creating…' : 'New AI Agent'}
          </button>
        ) : undefined
      }
      containerSize="editor"
    >

      {error && (
        <div className="mb-5 rounded-[0.625rem] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-[0.85rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]" role="alert">
          {error}
        </div>
      )}

      {showEmpty && (
        <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]" style={{ border: '1px dashed var(--border-soft)' }}>
          <div className="mb-4 flex justify-center text-slate-300">
            <Bot size={44} strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 mt-0 text-[1.125rem] font-semibold tracking-tight text-slate-900">
            {isAdmin ? BOTS_LIST_EMPTY_TITLE : BOTS_LIST_EMPTY_MEMBER_TITLE}
          </h2>
          <p className="mx-auto mb-6 max-w-[28rem] text-[0.9375rem] leading-[1.55] text-slate-400">
            {isAdmin ? BOTS_LIST_EMPTY_ADMIN_COPY : BOTS_LIST_EMPTY_MEMBER_COPY}
          </p>
          {isAdmin ? (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--teal-200)] bg-[color-mix(in_srgb,var(--teal-600)_8%,transparent)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--teal-800)] shadow-[var(--shadow-xs)] transition-all duration-150 hover:enabled:border-primary hover:enabled:bg-[color-mix(in_srgb,var(--teal-600)_14%,transparent)] hover:enabled:text-[var(--teal-900)] active:enabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={creating}
              onClick={() => void createDraft()}
            >
              <Plus size={15} strokeWidth={2.5} />
              {creating ? 'Creating…' : 'New AI Agent'}
            </button>
          ) : null}
        </div>
      )}

      {showSkeleton ? <AgentsPageSkeleton /> : null}

      {loadState === 'ready' && bots && count > 0 && (
        <section className="mt-1" aria-label="Your agents">
          <ul className="m-0 grid grid-cols-1 gap-5 p-0 list-none md:grid-cols-2 2xl:grid-cols-3">
            {bots.map((bot) => (
              <li key={bot._id}>
                <AgentCard
                  bot={bot}
                  deleting={deletingId === bot._id}
                  onDelete={setConfirmDelete}
                  canDelete={isAdmin}
                  onShare={canShareAgentAccess ? setShareBot : undefined}
                  onReactivate={() => openUpgradeModal({ reason: 'bots', recommendedPlanKey: 'pro' })}
                  showViewAccessPreview={showViewAccessPreview}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirmDelete && (
        <DeleteAgentDialog
          name={confirmDelete.name}
          onConfirm={() => void handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <AgentShareAccessModal
        open={Boolean(shareBot)}
        bot={shareBot}
        onClose={() => setShareBot(null)}
        onAccessUpdated={(botId, preview) => {
          setBots((prev) =>
            prev?.map((bot) => (bot._id === botId ? { ...bot, viewAccessPreview: preview } : bot)) ?? null,
          );
        }}
      />

    </DataPageLayout>
  );
}
