/**
 * Global routes and CTA labels — single source for nav, footer, and sections.
 */
export const siteRoutes = {
  home: "/",
  bots: "/bots",
  createAgent: "/create-your-bot",
  aiSupports: "/ai-supports",
  contact: "/contact",
} as const;

export type SiteRouteKey = keyof typeof siteRoutes;

export const siteCtaLabels = {
  createAgent: "Create your agent",
  tryDemo: "Try a demo",
  browseDemos: "Browse demos",
  seeHowItWorks: "See how it works",
  talkToUs: "Talk to us",
  compareDelivery: "Compare delivery options",
  discussSetup: "Discuss your setup",
  startYourAgent: "Start your agent",
  viewAllDemos: "View all demos",
  buildMineNext: "Build mine next",
  exploreHowItWorks: "Explore how it works",
  getYourAgent: "Get your agent",
  seeDemoAgents: "See demo agents",
  stillUnsure: "Still unsure? Talk to us",
} as const;

export const siteMeta = {
  name: "Assistrio",
  tagline: "Custom AI support for your website",
} as const;
