import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/shared/button-link";
import { siteMeta, siteRoutes } from "@/content/site";

export const metadata: Metadata = {
  title: `Contact — ${siteMeta.name}`,
  description: "Talk to Assistrio about a custom AI support agent for your website.",
};

export default function ContactPage() {
  return (
    <main className="py-16 md:py-24">
      <Container className="max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          Talk to us
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          Replace this page with your contact form, calendar link, or email. Routes and
          CTAs across the site already point here.
        </p>
        <div className="mt-8 flex justify-center">
          <ButtonLink
            href={siteRoutes.home}
            label="Back to home"
            variant="secondary"
          />
        </div>
        <p className="mt-10 text-sm text-neutral-500">
          <Link href={siteRoutes.bots} className="font-medium text-brand hover:underline">
            Browse demo bots
          </Link>
        </p>
      </Container>
    </main>
  );
}
