import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const controlAreas: { title: string; text: string }[] = [
  {
    title: "Visual identity",
    text: "Carry your palette into the widget — brand colors, contrast, and layout choices that read as part of your site instead of borrowed UI.",
  },
  {
    title: "Launcher & entry",
    text: "Decide how visitors open the AI Support Agent: launcher treatment, placement, and the first screen they see when they start a session.",
  },
  {
    title: "Welcome & tone",
    text: "Shape the welcome message and conversational tone so the agent introduces itself the way your brand would — helpful, precise, or consultative, within the behavior controls you set.",
  },
  {
    title: "Runtime & allowed websites",
    text: "Separate preview work in Assistrio from public runtime: embed only on allowed websites you choose so production traffic stays on the sites you approved, with server-side checks backing the policy.",
  },
];

export function HomeBrandingExperience() {
  return (
    <Section id="branding" spacing="default" className="border-b border-[var(--border-default)] bg-white">
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader
            id="branding-heading"
            eyebrow="Brand & control"
            title="Your AI Support Agent should feel unmistakably yours"
            titleWide
            align="split"
          >
            <p>
              Branding is not decoration — it is how customers decide whether to trust the answers they see. Assistrio treats{" "}
              <strong className="font-semibold text-slate-800">widget appearance</strong>, <strong className="font-semibold text-slate-800">launcher</strong>,{" "}
              <strong className="font-semibold text-slate-800">welcome messaging</strong>, and <strong className="font-semibold text-slate-800">behavior</strong> as first-class
              product controls for every AI Support Agent, alongside the knowledge and analytics layers.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <ScrollReveal y={22} delay={0.05} className="mt-14 lg:mt-16">
          <div className="grid gap-6 border-t border-[var(--border-strong)] pt-10 sm:grid-cols-2 lg:gap-8 lg:pt-12">
            {controlAreas.map((a) => (
              <div key={a.title} className="max-w-md lg:max-w-none">
                <h3 className="text-block-title">{a.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">{a.text}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
