"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import {
  isTrialOnboardingComplete,
  maxUnlockedSetupStepIndex,
  setupStepIdFromPathname,
  TRIAL_SETUP_STEPS,
} from "@/lib/trial/trial-workspace-draft";

export function TrialSetupNavigationGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { draft, hydrated } = useTrialWorkspaceDraft();

  useEffect(() => {
    if (!hydrated) return;

    if (pathname.includes("/setup/creating")) {
      if (!isTrialOnboardingComplete(draft)) {
        const allowed = maxUnlockedSetupStepIndex(draft);
        router.replace(TRIAL_SETUP_STEPS[allowed].path);
      }
      return;
    }

    const stepId = setupStepIdFromPathname(pathname);
    if (!stepId) return;
    const idx = TRIAL_SETUP_STEPS.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const allowed = maxUnlockedSetupStepIndex(draft);
    if (idx > allowed) {
      router.replace(TRIAL_SETUP_STEPS[allowed].path);
    }
  }, [draft, hydrated, pathname, router]);

  return <>{children}</>;
}
