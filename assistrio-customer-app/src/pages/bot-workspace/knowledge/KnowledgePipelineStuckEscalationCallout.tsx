import { readKbPipelineStuckMinutes } from '@/lib/knowledgePipelineStuckEscalation';

function stuckMinutesLabel(): string {
  return String(readKbPipelineStuckMinutes());
}

export function KnowledgePipelineStuckEscalationCallout(props: {
  eligible: boolean;
  displayStatus?: string | null;
}) {
  if (!props.eligible) return null;
  const ds = String(props.displayStatus ?? '').trim().toLowerCase();
  const failedLike =
    ds === 'failed' || ds === 'extraction_failed' || ds === 'import_failed' || ds === 'training_failed';
  const mins = stuckMinutesLabel();
  return (
    <div
      className="w-full rounded-lg border border-amber-200/95 bg-amber-50/95 px-3 py-2.5 text-sm text-amber-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      role="status"
    >
      <p className="m-0 font-semibold leading-snug">Taking longer than expected</p>
      <p className="m-0 mt-1.5 leading-snug text-amber-950/90">
        {failedLike ? (
          <>
            This item has stayed in an error state for over {mins} minutes. Use Retry when shown below, or remove the item
            and add it again.
          </>
        ) : (
          <>
            This step has been in progress for over {mins} minutes. Use Retry or Reset when shown below, or remove this item
            and start over.
          </>
        )}
      </p>
    </div>
  );
}
