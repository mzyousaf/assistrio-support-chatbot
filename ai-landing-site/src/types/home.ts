import type { Cta } from "./common";

export type HomeHeroContent = {
  headline: string;
  subheadline: string;
  body: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  tertiaryCta?: Cta;
};

export type HomeCapabilityStripContent = {
  headline: string;
  subheadline: string;
  body: string;
  linkCta?: Cta;
};

export type ValuePropItem = {
  title: string;
  description: string;
  icon: "knowledge" | "support" | "tickets" | "leads" | "voice";
};

export type HomeValuePropsContent = {
  headline: string;
  subheadline: string;
  body?: string;
  items: ValuePropItem[];
  ctas: Cta[];
};

export type HowItWorksStep = {
  title: string;
  description: string;
};

export type HomeHowItWorksContent = {
  headline: string;
  subheadline: string;
  steps: HowItWorksStep[];
  ctas: Cta[];
};

export type UseCaseItem = {
  title: string;
  description: string;
  cta?: Cta;
};

export type HomeUseCasesContent = {
  headline: string;
  subheadline: string;
  items: UseCaseItem[];
  sectionCtas: Cta[];
};

export type PublicBotPreview = {
  id: string;
  name: string;
  description: string;
  href: string;
  /** Optional — home marketing cards; when absent, initials are shown */
  avatarEmoji?: string;
  imageUrl?: string;
};

export type HomePublicBotsPreviewContent = {
  headline: string;
  subheadline: string;
  body: string;
  bots: PublicBotPreview[];
  viewAllCta: Cta;
};

export type HomeCreateAgentCtaContent = {
  headline: string;
  subheadline: string;
  body: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
};

export type ComparisonRow = {
  label: string;
  assistrio: string;
  typical: string;
};

export type HomeWhyAssistrioContent = {
  headline: string;
  subheadline: string;
  body: string;
  rows: ComparisonRow[];
  ctas: Cta[];
};

export type DeliveryColumn = {
  title: string;
  description: string;
  bullets: string[];
  badge?: string;
};

export type HomeHostedVsCustomContent = {
  headline: string;
  subheadline: string;
  intro?: string;
  columns: DeliveryColumn[];
  ctas: Cta[];
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type HomeFaqContent = {
  headline: string;
  subheadline: string;
  items: FaqItem[];
  footerCta?: Cta;
};

export type HomeFinalCtaContent = {
  headline: string;
  subheadline: string;
  body: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  tertiaryCta?: Cta;
};

export type HomePageContent = {
  hero: HomeHeroContent;
  capabilityStrip: HomeCapabilityStripContent;
  valueProps: HomeValuePropsContent;
  howItWorks: HomeHowItWorksContent;
  useCases: HomeUseCasesContent;
  publicBotsPreview: HomePublicBotsPreviewContent;
  createAgentCta: HomeCreateAgentCtaContent;
  whyAssistrio: HomeWhyAssistrioContent;
  hostedVsCustom: HomeHostedVsCustomContent;
  faq: HomeFaqContent;
  finalCta: HomeFinalCtaContent;
};
