import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
  title: "About",
  description: "Assistrio provides hosted AI support agents for your allowed websites.",
};

export default function AboutPage() {
  return (
    <Section spacing="default" className="border-b border-[var(--border-default)] bg-white">
      <Container size="compact" className="max-w-2xl">
        <PageIntro eyebrow="Assistrio" title="About Assistrio">
          <div className="space-y-4 text-page-lead">
            <p>
              Assistrio helps teams ship <strong className="font-medium text-slate-800">AI support</strong> that answers
              on your allowed websites, grounded in your knowledge, with branding and analytics in one product.
            </p>
            <p>
              You can <strong className="font-medium text-slate-800">try it free</strong>, browse{" "}
              <strong className="font-medium text-slate-800">live examples</strong> in the gallery, and move to hosted
              production when you are ready.
            </p>
            <p>
              <Link href="/contact" className="font-semibold text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:decoration-[var(--brand-teal)]">
                Contact support
              </Link>{" "}
              for questions, Launch, or Enterprise.
            </p>
          </div>
        </PageIntro>
      </Container>
    </Section>
  );
}
