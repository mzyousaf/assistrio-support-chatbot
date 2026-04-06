import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketingPageMetadata } from "@/lib/site-metadata";

/**
 * Pricing route temporarily disabled (returns 404).
 * Restore the previous `app/pricing/page.tsx` from version control when commercial pricing should be public again.
 */
export const metadata: Metadata = marketingPageMetadata({
  title: "Pricing",
  description:
    "Plans and hosted capacity for AI Support Agents — evaluation, Launch, and Enterprise. (This route is not currently public.)",
  path: "/pricing",
});

export default function PricingPage() {
  notFound();
}
