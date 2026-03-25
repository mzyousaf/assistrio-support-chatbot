import type { Cta } from "./common";
import type { DeliveryColumn, FaqItem } from "./home";

export type AiSupportsHeroContent = {
  headline: string;
  subheadline: string;
  body?: string;
  primaryCta: Cta;
  secondaryCta: Cta;
};

export type AiSupportsWhatItDoesItem = {
  title: string;
  description: string;
};

export type AiSupportsWhatItDoesContent = {
  headline: string;
  subheadline: string;
  items: AiSupportsWhatItDoesItem[];
};

export type AiSupportsTrainOnItem = {
  title: string;
  description: string;
  icon: "site" | "faq" | "docs" | "context";
};

export type AiSupportsTrainOnContent = {
  headline: string;
  subheadline: string;
  items: AiSupportsTrainOnItem[];
};

export type AiSupportsUseCaseItem = {
  title: string;
  description: string;
};

export type AiSupportsUseCasesContent = {
  headline: string;
  subheadline: string;
  items: AiSupportsUseCaseItem[];
};

export type AiSupportsPathCardContent = {
  kicker: string;
  title: string;
  description: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
};

export type AiSupportsDualPathsContent = {
  headline: string;
  subheadline?: string;
  createPath: AiSupportsPathCardContent;
  demosPath: AiSupportsPathCardContent;
};

export type AiSupportsHostedVsCustomContent = {
  headline: string;
  subheadline: string;
  intro?: string;
  columns: DeliveryColumn[];
  ctas: Cta[];
};

export type AiSupportsFaqContent = {
  headline: string;
  subheadline: string;
  items: FaqItem[];
  footerCta?: Cta;
};

export type AiSupportsFinalCtaContent = {
  headline: string;
  subheadline: string;
  body: string;
  primaryCta: Cta;
  secondaryCta: Cta;
};

export type AiSupportsPageContent = {
  hero: AiSupportsHeroContent;
  whatItDoes: AiSupportsWhatItDoesContent;
  trainOn: AiSupportsTrainOnContent;
  useCases: AiSupportsUseCasesContent;
  dualPaths: AiSupportsDualPathsContent;
  hostedVsCustom: AiSupportsHostedVsCustomContent;
  faq: AiSupportsFaqContent;
  finalCta: AiSupportsFinalCtaContent;
};
