"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";
import { TrialFlowStep } from "@/components/sections/trial/trial-flow-step";
import { TrialForm } from "@/components/sections/trial/trial-form";
import { ReconnectSavedId } from "@/components/visitor/reconnect-saved-id";
import { StableIdentityPanel } from "@/components/visitor/stable-identity-panel";
import { QuotaSummaryCard } from "@/components/visitor/quota-summary-card";
import { PvTrialResumeSection } from "@/components/visitor/pv-trial-resume-section";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import {
  clearPvLastTrialBotRef,
  readPvLastTrialBotRefForActivePlatformVisitor,
  type PvLastTrialBotRef,
} from "@/lib/identity/pv-last-trial-bot";

export function TrialPageClient() {
  const [trialCreated, setTrialCreated] = useState(false);
  const [resumeRefreshTick, setResumeRefreshTick] = useState(0);
  const [resumeRef, setResumeRef] = useState<PvLastTrialBotRef | null>(null);
  const { platformVisitorId, status } = usePlatformVisitorId();

  useEffect(() => {
    if (status !== "ready" || !platformVisitorId) {
      setResumeRef(null);
      return;
    }
    setResumeRef(readPvLastTrialBotRefForActivePlatformVisitor(platformVisitorId));
  }, [platformVisitorId, status, resumeRefreshTick]);

  function handleForgetResume() {
    clearPvLastTrialBotRef();
    setResumeRef(null);
  }

  return (
    <>
      <Section
        spacing="compact"
        className="border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/30 to-transparent pb-10 pt-10 sm:pb-12 sm:pt-12"
      >
        <Container size="narrow">
          <PageIntro eyebrow="Trial" title="Start your free trial" className="max-w-2xl">
            <p className="text-page-lead">
              Create a <strong className="font-medium text-slate-800">visitor-owned trial bot</strong> using your
              current <strong className="font-medium text-slate-800">stable id</strong> and the hostname where runtime
              will run. The server checks both. Owner preview lives in Assistrio product UIs; customer-facing chat is{" "}
              <strong className="font-medium text-slate-800">runtime</strong> on your allowlisted domain only — not
              preview on this site.
            </p>
          </PageIntro>
        </Container>
      </Section>

      <Section spacing="compact" className="pb-20 pt-12 sm:pt-14">
        <Container size="narrow" className={trialCreated ? "" : "space-y-12 sm:space-y-14"}>
          {!trialCreated ? (
            <>
              {resumeRef ? (
                <>
                  <PvTrialResumeSection refData={resumeRef} onForget={handleForgetResume} />
                  <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-[var(--border-default)]" />
                    <span className="shrink-0 text-center text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                      New trial or different id
                    </span>
                    <div className="h-px flex-1 bg-[var(--border-default)]" />
                  </div>
                </>
              ) : null}

              <TrialFlowStep
                step="1"
                title="Identity & reconnect"
                description="Same anonymous id model as the public API — save it or paste a saved id to continue on this browser."
                id="reconnect"
              >
                <div className="space-y-4">
                  <ReconnectSavedId id="reconnect-form" />
                  <StableIdentityPanel variant="compact" />
                </div>
              </TrialFlowStep>

              <TrialFlowStep
                step="2"
                title="Usage for this id"
                description="Preview, trial runtime, and showcase demos use separate quota buckets; all keyed to the id above."
              >
                <QuotaSummaryCard />
              </TrialFlowStep>

              <TrialFlowStep
                step="3"
                title="Create your trial bot"
                description="Declare where runtime may run. After creation you’ll get credentials and an embed snippet — treat them as private access material."
                id="create"
              >
                <TrialForm
                  onTrialCreated={() => {
                    setTrialCreated(true);
                    setResumeRefreshTick((n) => n + 1);
                  }}
                  onTrialHandoffLost={() => setTrialCreated(false)}
                />
              </TrialFlowStep>
            </>
          ) : (
            <TrialForm
              onTrialCreated={() => {
                setTrialCreated(true);
                setResumeRefreshTick((n) => n + 1);
              }}
              onTrialHandoffLost={() => setTrialCreated(false)}
            />
          )}
        </Container>
      </Section>
    </>
  );
}
