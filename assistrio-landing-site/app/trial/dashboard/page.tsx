"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";

/**
 * Magic-link and in-app navigation land here first: shell shows loading until draft hydrates, then we continue to setup.
 */
export default function TrialDashboardRootPage() {
  const router = useRouter();
  const { hydrated } = useTrialWorkspaceDraft();

  useEffect(() => {
    if (!hydrated) return;
    router.replace("/trial/dashboard/setup/profile");
  }, [hydrated, router]);

  return null;
}
