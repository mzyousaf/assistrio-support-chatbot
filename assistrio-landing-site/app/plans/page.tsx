import type { Metadata } from "next";
import { LandingPlansView } from "@/components/plans/landing-plans-view";
import { marketingPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingPageMetadata({
  title: "Plans",
  description:
    "Compare Assistrio pricing — start with a free trial, then choose Starter or Pro for more AI credits, storage, and team capacity.",
  path: "/plans",
});

export default function PlansPage() {
  return <LandingPlansView />;
}
