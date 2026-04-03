import type { Metadata } from "next";
import { BotsPageClient } from "./BotsPageClient";

export const metadata: Metadata = {
  title: "AI Support Bots — Assistrio",
  description:
    "Create your agent or browse showcase demos. Each demo has a detail page with a live widget.",
};

export default function BotsPage() {
  return <BotsPageClient />;
}
