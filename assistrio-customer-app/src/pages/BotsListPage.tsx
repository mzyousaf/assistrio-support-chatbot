import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Plus } from 'lucide-react';
import { getCustomerBots, postCustomerBotDraft, deleteCustomerBot } from '../api/customerApi';
import type { CustomerBotListItem } from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { DataPageLayout } from '../layout/workspace-layout';
import { AgentCard, DeleteAgentDialog } from '../components/AgentCard';

export function BotsListPage() {
  const navigate = useNavigate();
  const { refreshOnboardingHeuristic, needsOnboarding } = useCustomerAuth();
  const [bots, setBots] = useState<CustomerBotListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CustomerBotListItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await getCustomerBots();
    if (res.ok) setBots(res.data);
    else setError(res.error);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createDraft() {
    setCreating(true);
    setError(null);
    const clientDraftId = crypto.randomUUID();
    const res = await postCustomerBotDraft({ clientDraftId });
    setCreating(false);
    if (!res.ok) { setError(res.error); return; }
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
      setError(typeof res.error === 'string' ? res.error : 'Failed to delete agent');
      return;
    }
    setBots((prev) => prev?.filter((b) => b._id !== bot._id) ?? null);
  }

  const count = bots?.length ?? 0;

  return (
    <DataPageLayout
      title="AI Agents"
      description={
        <>
          <p>
            Build, train, and deploy intelligent AI agents that handle customer conversations on your website — 24/7.
          </p>
          {needsOnboarding ? (
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
        </>
      }
      actions={
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-primary px-3.5 py-2 text-[0.8125rem] font-semibold text-white shadow-[var(--shadow-primary-fill)] transition-all duration-150 hover:enabled:bg-[var(--teal-800)] active:enabled:scale-[0.98] active:enabled:bg-[var(--teal-900)] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={creating}
          onClick={() => void createDraft()}
        >
          <Plus size={15} strokeWidth={2.5} />
          {creating ? 'Creating…' : 'New AI Agent'}
        </button>
      }
      containerSize="wide"
    >

      {/* Error banner */}
      {error && (
        <div className="mb-5 rounded-[0.625rem] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-[0.85rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]" role="alert">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && bots && count === 0 && (
        <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]" style={{ border: '1px dashed var(--border-soft)' }}>
          <div className="mb-4 flex justify-center text-slate-300">
            <Bot size={44} strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 mt-0 text-[1.125rem] font-semibold tracking-tight text-slate-900">
            Create your first AI Agent
          </h2>
          <p className="mx-auto mb-6 max-w-[28rem] text-[0.9375rem] leading-[1.55] text-slate-400">
            Train an AI agent with your knowledge base, customize its personality, and embed the chat widget on your website — all in minutes.
          </p>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--teal-200)] bg-[color-mix(in_srgb,var(--teal-600)_8%,transparent)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--teal-800)] shadow-[var(--shadow-xs)] transition-all duration-150 hover:enabled:border-primary hover:enabled:bg-[color-mix(in_srgb,var(--teal-600)_14%,transparent)] hover:enabled:text-[var(--teal-900)] active:enabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={creating}
            onClick={() => void createDraft()}
          >
            <Plus size={15} strokeWidth={2.5} />
            {creating ? 'Creating…' : 'New AI Agent'}
          </button>
        </div>
      )}

      {/* Agent grid */}
      {bots && count > 0 && (
        <section className="mt-1" aria-label="Your agents">
          <div className="mb-5 flex justify-end">
            <span className="text-[0.8125rem] font-semibold tabular-nums text-slate-500">
              {count} {count === 1 ? 'agent' : 'agents'}
            </span>
          </div>

          <ul className="m-0 grid grid-cols-1 gap-5 p-0 list-none md:grid-cols-2 2xl:grid-cols-3">
            {bots.map((bot) => (
              <li key={bot._id}>
                <AgentCard
                  bot={bot}
                  deleting={deletingId === bot._id}
                  onDelete={setConfirmDelete}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <DeleteAgentDialog
          name={confirmDelete.name}
          onConfirm={() => void handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

    </DataPageLayout>
  );
}
