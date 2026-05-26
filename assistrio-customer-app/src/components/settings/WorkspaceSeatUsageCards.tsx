import { KnowledgeUsageMeterBar } from '@/components/knowledge/KnowledgeUsageMeterBar';
import { SettingsStatCard } from '@/components/settings/SettingsStatCard';
import { Card, CardBody } from '@/components/ui';

type Props = {
  seatsUsed: number;
  memberLimit: number | null;
  activeMembers: number;
  pendingInvites: number;
};

function SeatsUsedCard(props: {
  seatsUsed: number;
  memberLimit: number | null;
  usagePercent: number;
  hasLimit: boolean;
}) {
  const { seatsUsed, memberLimit, usagePercent, hasLimit } = props;

  return (
    <Card className="h-full border-slate-200/90 shadow-[var(--shadow-card)]">
      <CardBody className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Seats used</p>
          <span className="inline-flex shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
            {hasLimit ? `${seatsUsed}/${memberLimit}` : seatsUsed}
          </span>
        </div>
        {hasLimit ? (
          <KnowledgeUsageMeterBar
            percent={usagePercent}
            heightClass="h-1.5"
            fillClassName="bg-teal-500/75"
            aria-label="Workspace seat usage"
            aria-valuenow={usagePercent}
          />
        ) : (
          <p className="m-0 text-xs text-slate-500">No seat limit on this plan.</p>
        )}
      </CardBody>
    </Card>
  );
}

export function WorkspaceSeatUsageCards({
  seatsUsed,
  memberLimit,
  activeMembers,
  pendingInvites,
}: Props) {
  const hasLimit = memberLimit != null && memberLimit > 0;
  const usagePercent = hasLimit ? Math.min(100, Math.round((seatsUsed / memberLimit) * 100)) : 0;

  return (
    <section id="members-seat-usage" aria-label="Workspace seat usage">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SeatsUsedCard
          seatsUsed={seatsUsed}
          memberLimit={memberLimit}
          usagePercent={usagePercent}
          hasLimit={hasLimit}
        />

        <SettingsStatCard label="Active members" value={String(activeMembers)} />

        <SettingsStatCard label="Pending invites" value={String(pendingInvites)} />
      </div>
    </section>
  );
}
