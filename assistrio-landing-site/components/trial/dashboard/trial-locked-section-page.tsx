"use client";

import Link from "next/link";
import { TrialEditorPane } from "@/components/trial/dashboard/trial-editor-pane";
import { TrialAgentSectionPlaceholder } from "@/components/trial/dashboard/trial-agent-section-placeholder";
import { TrialWorkspaceLoadingCenter } from "@/components/trial/dashboard/trial-workspace-loading-center";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { getAgentSectionTitle } from "@/lib/trial/trial-agent-section-titles";

type Props = {
  /** Full segment after `/trial/dashboard/` (e.g. `playground/ai`, `insights/conversations`). */
  routeSlug: string;
};

/**
 * Placeholder content for trial-locked sections. Keeps real routes and nav parity with the main product
 * without authenticated preview, insights APIs, or app session.
 */
export function TrialLockedSectionPage({ routeSlug }: Props) {
  const { draft, hydrated } = useTrialWorkspaceDraft();
  const hasAgent = Boolean(draft.trialAgent?.botId);
  const title = getAgentSectionTitle(routeSlug);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-[min(100%,48rem)] px-4 py-8 sm:px-6">
        <TrialWorkspaceLoadingCenter variant="inline" message="Loading…" />
      </div>
    );
  }

  if (!hasAgent) {
    return (
      <div className="mx-auto flex w-full max-w-[min(1800px,100%)] min-h-0 flex-1 flex-col px-4 py-5 sm:px-5 lg:px-7">
        <TrialEditorPane sectionTitle={title} status="draft">
          <div className="p-4 sm:p-7">
            <TrialAgentSectionPlaceholder
              title="Create your agent first"
              description="Finish setup and create your evaluation agent to unlock this section in the workspace. Your progress is saved as you go."
              ctaHref="/trial/dashboard/setup/go-live"
              ctaLabel="Continue setup"
            />
          </div>
        </TrialEditorPane>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[min(1800px,100%)] min-h-0 flex-1 flex-col px-4 py-5 sm:px-5 lg:px-7">
      <TrialEditorPane sectionTitle={title} status="draft">
        <div className="space-y-6 p-4 sm:p-7">
          <TrialAgentSectionPlaceholder
            title="Not available in this trial workspace"
            description="This area matches the full Assistrio agent workspace, but it is not wired for public trial accounts yet. Profile, Behavior, and Knowledge are available now; the rest arrives when you move to a full workspace."
            ctaHref="/contact"
            ctaLabel="Contact sales"
          />
          <p className="text-center text-sm text-slate-500">
            <Link href="/trial/dashboard/playground/profile" className="font-semibold text-[var(--brand-teal-dark)] hover:underline">
              ← Back to Profile
            </Link>
          </p>
        </div>
      </TrialEditorPane>
    </div>
  );
}
