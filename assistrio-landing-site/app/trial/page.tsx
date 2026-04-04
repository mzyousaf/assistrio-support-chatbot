import type { Metadata } from "next";
import { TrialPageClient } from "@/components/sections/trial/trial-page-client";

export const metadata: Metadata = {
  title: "Free trial",
  description:
    "Create a visitor-owned trial bot with your stable platformVisitorId and an allowed domain for runtime embeds.",
};

export default function TrialPage() {
  return <TrialPageClient />;
}
