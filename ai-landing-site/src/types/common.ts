export type CtaVariant = "primary" | "secondary" | "ghost" | "link";

export type Cta = {
  label: string;
  href: string;
  variant?: CtaVariant;
};

export type SectionHeaderAlign = "left" | "center";
