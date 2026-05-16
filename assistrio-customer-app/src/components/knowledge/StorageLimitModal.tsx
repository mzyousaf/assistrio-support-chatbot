import { useNavigate } from 'react-router-dom';
import { AlertTriangle, HardDrive } from 'lucide-react';
import type { CustomerKnowledgeUsage } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { clampKnowledgeUsagePercent, KnowledgeUsageMeterBar } from '@/components/knowledge/KnowledgeUsageMeterBar';

const PLANS_PATH = '/settings/plans';

export function StorageLimitModal(props: {
  open: boolean;
  onClose: () => void;
  botId: string;
  knowledgeUsage?: CustomerKnowledgeUsage | null;
  /** Extra detail from API (e.g. usage line from error body). */
  backendMessage?: string | null;
}) {
  const navigate = useNavigate();
  const overviewPath = `/bots/${props.botId}/playground/knowledgebase/overview`;
  const usage = props.knowledgeUsage;

  function goOverview() {
    props.onClose();
    void navigate(overviewPath);
  }

  function goPlans() {
    props.onClose();
    void navigate(PLANS_PATH);
  }

  const pctRaw = usage ? clampKnowledgeUsagePercent(usage) : 100;
  const barPctRounded = Math.round(pctRaw);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      tone="danger"
      title={
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600/15 ring-1 ring-red-700/25"
            aria-hidden
          >
            <HardDrive className="h-[1.125rem] w-[1.125rem] text-red-900" strokeWidth={2} />
          </span>
          <span className="leading-snug">Storage limit reached</span>
        </span>
      }
      description="This assistant can't accept more knowledge until you remove content or increase your storage allowance."
      className="max-w-[26rem]"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={props.onClose}>
            Close
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={goPlans}>
            Upgrade storage
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={goOverview} className="bg-teal-600 hover:bg-teal-700">
            Manage knowledge
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <ul className="m-0 list-disc space-y-1.5 pl-5 leading-relaxed text-slate-600">
          <li>Open the knowledge overview to delete documents, Q&amp;A, snippets, or other sources you no longer need.</li>
          <li>Upgrade your plan if this assistant should keep more content online.</li>
        </ul>
        {props.backendMessage ? (
          <div className="rounded-xl border border-red-200/90 bg-red-50/70 px-3.5 py-3 text-red-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <p className="m-0 flex gap-2 text-sm font-medium leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" strokeWidth={2} aria-hidden />
              <span>{props.backendMessage}</span>
            </p>
          </div>
        ) : null}
        {usage ? (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-medium text-slate-600">
              <span>Storage usage</span>
              <span className="tabular-nums text-slate-900">
                {formatKnowledgeBytes(usage.totalBytes)}
                <span className="font-normal text-slate-400"> / </span>
                {formatKnowledgeBytes(usage.maxBytes)}
              </span>
            </div>
            <KnowledgeUsageMeterBar
              className="mt-2.5"
              percent={pctRaw}
              heightClass="h-2"
              aria-valuenow={barPctRounded}
              aria-label="Knowledge storage usage"
            />
          </div>
        ) : (
          <p className="m-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            Detailed usage will appear here once loading completes.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function StorageLowWarningModal(props: {
  open: boolean;
  message: string;
  onContinue: () => void;
  onCancel: () => void;
  /** When set, shows a shortcut to the KB overview (usage + limits). */
  botId?: string;
}) {
  const navigate = useNavigate();
  const overviewPath = props.botId ? `/bots/${props.botId}/playground/knowledgebase/overview` : null;

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      tone="warning"
      title={
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.18] ring-1 ring-amber-700/20"
            aria-hidden
          >
            <AlertTriangle className="h-[1.125rem] w-[1.125rem] text-amber-900" strokeWidth={2} />
          </span>
          <span className="leading-snug">Low storage</span>
        </span>
      }
      description="You're close to your limit — continuing may fail if the content doesn't fit in what's left."
      className="max-w-[26rem]"
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={props.onContinue}
          >
            Continue anyway
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
          <li>Free up items from Knowledge → Overview, or upgrade your plan for more capacity.</li>
          <li>Cancel now if you prefer to make room before uploading or importing.</li>
        </ul>
        {overviewPath ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-auto min-h-0 px-2 py-1 text-sm font-semibold text-teal-700 hover:bg-teal-50 hover:text-teal-800"
            onClick={() => {
              props.onCancel();
              void navigate(overviewPath);
            }}
          >
            Open storage overview
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

export function KnowledgePlanLimitDetailActions({
  botId,
  className,
}: {
  botId: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const overviewPath = `/bots/${botId}/playground/knowledgebase/overview`;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="bg-teal-600 hover:bg-teal-700"
        onClick={() => void navigate(overviewPath)}
      >
        View storage
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => void navigate(PLANS_PATH)}>
        Upgrade storage
      </Button>
    </div>
  );
}
