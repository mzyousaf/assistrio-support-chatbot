import { Users } from 'lucide-react';
import { KnowledgeUsageMeterBar } from '@/components/knowledge/KnowledgeUsageMeterBar';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { SettingsStatCard } from '@/components/settings/SettingsStatCard';

type Props = {
  planName: string;
  seatsUsed: number;
  memberLimit: number | null;
  activeMembers: number;
  pendingInvites: number;
};

export function MembersSeatUsageCard({
  planName,
  seatsUsed,
  memberLimit,
  activeMembers,
  pendingInvites,
}: Props) {
  const hasLimit = memberLimit != null && memberLimit > 0;
  const seatsRemaining = hasLimit ? Math.max(0, memberLimit - seatsUsed) : null;
  const usagePercent = hasLimit ? Math.min(100, Math.round((seatsUsed / memberLimit) * 100)) : 0;

  return (
    <SettingsInfoCard
      id="members-seat-usage"
      icon={Users}
      title="Seat usage"
      description={`You're on the ${planName.trim() || 'current'} plan.`}
    >
      <div className="space-y-4">
        <div>
          <p className="m-0 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
            {hasLimit ? `${seatsUsed} of ${memberLimit} seats used` : `${seatsUsed} seats used`}
          </p>
          <div className="mt-3 space-y-2">
            {hasLimit ? (
              <KnowledgeUsageMeterBar
                percent={usagePercent}
                heightClass="h-2.5"
                fillClassName="bg-teal-600"
                aria-label="Workspace seat usage"
                aria-valuenow={usagePercent}
              />
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {seatsRemaining != null ? (
                <span>
                  <span className="font-medium text-slate-800">{seatsRemaining}</span> seat
                  {seatsRemaining === 1 ? '' : 's'} remaining
                </span>
              ) : null}
              <span>
                <span className="font-medium text-slate-800">{pendingInvites}</span> pending invite
                {pendingInvites === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsStatCard
            label="Total seats"
            value={hasLimit ? String(memberLimit) : '—'}
          />
          <SettingsStatCard label="Active members" value={String(activeMembers)} />
          <SettingsStatCard label="Pending invites" value={String(pendingInvites)} />
        </div>
      </div>
    </SettingsInfoCard>
  );
}
