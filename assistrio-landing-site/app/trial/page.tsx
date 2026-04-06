import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { TrialPageClient } from "@/components/sections/trial/trial-page-client";

export const metadata: Metadata = marketingPageMetadata({
  title: "Explore & evaluate",
  description:
    "Create your evaluation AI Support Agent with a stable workspace key and allowed websites for runtime embeds — knowledge base, analytics, and branding. No credit card required.",
  path: "/trial",
});

export default function TrialPage() {
  return <TrialPageClient />;
}
