import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/shared/button-link";
import type { HomeHeroContent } from "@/types/home";

type HomeHeroProps = {
  content: HomeHeroContent;
};

export function HomeHero({ content }: HomeHeroProps) {
  return (
    <Section
      spacious
      variant="accent"
      className="border-b border-neutral-100/80"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              Assistrio
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl lg:text-[3.25rem] lg:leading-tight">
              {content.headline}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600 sm:text-xl">
              {content.subheadline}
            </p>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {content.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ButtonLink
                href={content.primaryCta.href}
                label={content.primaryCta.label}
                variant="primary"
              />
              <ButtonLink
                href={content.secondaryCta.href}
                label={content.secondaryCta.label}
                variant="secondary"
              />
              {content.tertiaryCta ? (
                <ButtonLink
                  href={content.tertiaryCta.href}
                  label={content.tertiaryCta.label}
                  variant="link"
                  className="sm:ml-1"
                />
              ) : null}
            </div>
          </div>

          <div className="relative lg:justify-self-end">
            <div
              className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-brand/10 blur-3xl"
              aria-hidden
            />
            <div className="relative rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-md ring-1 ring-neutral-100">
              <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  A
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Assistrio support
                  </p>
                  <p className="text-xs text-neutral-500">Typically replies instantly</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl rounded-tl-md bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
                  Do you offer annual billing—and can we migrate from our old help
                  center?
                </div>
                <div className="rounded-xl rounded-tr-md border border-brand/15 bg-brand-muted/50 px-4 py-3 text-sm text-neutral-800">
                  Yes. Annual plans are available, and we can train the agent on your
                  exported articles so answers stay consistent during the switch.
                </div>
              </div>
              <p className="mt-5 text-center text-xs text-neutral-500">
                Illustrative preview—not a live chat.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
