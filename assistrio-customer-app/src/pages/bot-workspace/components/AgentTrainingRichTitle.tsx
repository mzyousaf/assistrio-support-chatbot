import type { ReactNode } from 'react';

function trainWord(): ReactNode {
  return <span className="text-emerald-700">Train</span>;
}

/**
 * Sidebar / modal headline: **`Train`** in green, **`ing status`**, counts, **`ed`** in primary teal.
 */
export function agentTrainingRichTitle(
  variant: 'analyzing' | 'trained' | 'training_status',
  pendingCount?: number,
): ReactNode {
  if (variant === 'analyzing') {
    return <span className="text-teal-800">Analyzing…</span>;
  }
  if (variant === 'trained') {
    return (
      <>
        {trainWord()}
        <span className="text-teal-900">ed</span>
      </>
    );
  }
  const n = pendingCount ?? 0;
  return (
    <>
      {trainWord()}
      <span className="text-teal-900">
        ing status
        {n > 0 ? (
          <>
            {' ('}
            <span className="tabular-nums">{n}</span>
            {')'}
          </>
        ) : null}
      </span>
    </>
  );
}
