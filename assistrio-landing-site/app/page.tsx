import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { Hero } from "@/components/sections/home/hero";
import { HomeLiveDemos } from "@/components/sections/home/home-live-demos";

const HOME_TITLE = "AI Support Agents for your website";

export const metadata: Metadata = {
  ...marketingPageMetadata({
    title: HOME_TITLE,
    description:
      "Try curated showcase AI Support Agents on this site, or contact Assistrio. Anonymous visitors are tracked for product analytics only.",
    path: "/",
  }),
  title: { absolute: `${HOME_TITLE} · Assistrio` },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <HomeLiveDemos />
    </>
  );
}
