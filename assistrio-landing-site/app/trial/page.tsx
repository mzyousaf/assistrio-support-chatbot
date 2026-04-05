import type { Metadata } from "next";
import { TrialPageClient } from "@/components/sections/trial/trial-page-client";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Try it free: create your evaluation bot with a stable workspace key and an allowed website for runtime embeds — no card required.",
};

export default function TrialPage() {
  return <TrialPageClient />;
}
