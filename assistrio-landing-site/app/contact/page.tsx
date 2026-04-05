import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Message Assistrio support at support@assistrio.com or use the contact form.",
};

export default function ContactPage() {
  return (
    <Section
      fillViewport
      spacing="loose"
      className="flex flex-col justify-center border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/20 via-white to-[var(--background)] py-14 sm:py-20"
    >
      <Container size="compact" className="mx-auto w-full max-w-xl">
        <ContactForm />
      </Container>
    </Section>
  );
}
