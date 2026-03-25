import type { AiSupportsPageContent } from "@/types/ai-supports";
import { siteCtaLabels, siteRoutes } from "./site";

export const aiSupportsPageContent: AiSupportsPageContent = {
  hero: {
    headline: "AI support that fits your website—and your standards.",
    subheadline:
      "Assistrio helps you launch a custom AI support agent trained on your own pages, FAQs, and documents. Answer support and pre-sales questions, cut repetitive tickets, and capture leads without sounding generic.",
    body: "Use this page to understand the offering, compare delivery options, then choose whether to build your agent or explore public demos first.",
    primaryCta: {
      label: siteCtaLabels.createAgent,
      href: siteRoutes.createAgent,
      variant: "primary",
    },
    secondaryCta: {
      label: siteCtaLabels.browseDemos,
      href: siteRoutes.bots,
      variant: "secondary",
    },
  },

  whatItDoes: {
    headline: "What it does",
    subheadline:
      "One conversational layer on your site—grounded in what you publish and how you serve customers.",
    items: [
      {
        title: "Answers from your knowledge",
        description:
          "Visitors ask in plain language. The agent responds using the sources you approve—so guidance stays specific to your business.",
      },
      {
        title: "Support and pre-sales together",
        description:
          "From troubleshooting to “which plan fits?”—handled in one flow, with a clean path to a human when the situation needs it.",
      },
      {
        title: "Less noise for your team",
        description:
          "Deflect repetitive questions, shorten back-and-forth, and collect intent when someone is ready to talk to a person.",
      },
    ],
  },

  trainOn: {
    headline: "What you can train it on",
    subheadline:
      "Start with what you already have. We help you organize it so answers stay accurate as you update your business.",
    items: [
      {
        title: "Website pages",
        description:
          "Product, pricing, policies, and key landing pages—the content customers already expect you to stand behind.",
        icon: "site",
      },
      {
        title: "FAQs and help articles",
        description:
          "Structured answers, how-tos, and recurring questions your team is tired of repeating.",
        icon: "faq",
      },
      {
        title: "Documents and PDFs",
        description:
          "Specs, onboarding guides, contracts summaries (as appropriate), and internal references you are comfortable including.",
        icon: "docs",
      },
      {
        title: "Business context",
        description:
          "Tone, boundaries, what you sell, what you do not, and how you want tricky topics handled.",
        icon: "context",
      },
    ],
  },

  useCases: {
    headline: "Who it is for",
    subheadline:
      "Teams that want on-site help without a generic chatbot smell—especially when credibility matters.",
    items: [
      {
        title: "SaaS and product companies",
        description:
          "Trials, onboarding, billing questions, and feature clarification—without turning your inbox into a queue.",
      },
      {
        title: "Agencies",
        description:
          "A polished support layer for client sites, consistent answers across accounts, and a path to expand what you deliver.",
      },
      {
        title: "Service businesses",
        description:
          "Qualify leads, explain offerings and coverage, and reduce “quick question” calls that stack up all day.",
      },
      {
        title: "Small teams and operators",
        description:
          "Always-on help when you cannot staff chat—without sending visitors to a wall of text they will not read.",
      },
    ],
  },

  dualPaths: {
    headline: "Choose your next step",
    subheadline:
      "Most teams either start with a demo—or move straight into scoping their own agent.",
    createPath: {
      kicker: "Path 1",
      title: "Create your agent",
      description:
        "Share your site and sources. We help you shape tone, guardrails, and launch—hosted or embedded, depending on what fits.",
      primaryCta: {
        label: siteCtaLabels.createAgent,
        href: siteRoutes.createAgent,
        variant: "primary",
      },
      secondaryCta: {
        label: siteCtaLabels.browseDemos,
        href: siteRoutes.bots,
        variant: "ghost",
      },
    },
    demosPath: {
      kicker: "Path 2",
      title: "Browse public demos",
      description:
        "Try sample agents built around realistic scenarios. See how responses feel when training is done with care—not a canned script.",
      primaryCta: {
        label: siteCtaLabels.browseDemos,
        href: siteRoutes.bots,
        variant: "primary",
      },
      secondaryCta: {
        label: siteCtaLabels.createAgent,
        href: siteRoutes.createAgent,
        variant: "ghost",
      },
    },
  },

  hostedVsCustom: {
    headline: "Hosted vs custom delivery",
    subheadline:
      "Same agent quality—two ways to put it in front of customers, depending on your timeline and stack.",
    intro: "If you are unsure, we will recommend an approach based on your site, traffic, and how native you need the experience to feel.",
    columns: [
      {
        title: "Managed hosted",
        description:
          "The fastest path to a live agent with less engineering overhead—ideal when you want outcomes without owning every detail of hosting.",
        bullets: [
          "Quick launch with a managed experience",
          "Less day-to-day operational burden",
          "Great when speed and simplicity matter most",
        ],
      },
      {
        title: "Custom and embedded",
        description:
          "A closer match to your site and workflows—ideal for product-led teams and agencies delivering client-grade experiences.",
        badge: "Flexible",
        bullets: [
          "Embeds and flows that feel native to your site",
          "Room for branding and handoff details",
          "Strong fit for portfolios and multi-site setups",
        ],
      },
    ],
    ctas: [
      {
        label: siteCtaLabels.discussSetup,
        href: siteRoutes.contact,
        variant: "primary",
      },
      {
        label: siteCtaLabels.createAgent,
        href: siteRoutes.createAgent,
        variant: "secondary",
      },
    ],
  },

  faq: {
    headline: "Objections, handled",
    subheadline:
      "The questions teams ask before they trust an AI support layer on a real website.",
    items: [
      {
        question: "Will it make things up?",
        answer:
          "It should not. The agent is constrained to your approved sources and rules. When something is outside scope, the better behavior is to say so—and offer a next step.",
      },
      {
        question: "Is this just a generic chatbot?",
        answer:
          "No. The point is specificity: your policies, your wording, your offers, and your boundaries. The experience is built around your business—not a one-size template.",
      },
      {
        question: "What if we need a human in the loop?",
        answer:
          "That is normal. We set up clear handoff paths—forms, email capture, booking links, or a simple “talk to the team” message—so qualified conversations still reach you.",
      },
      {
        question: "How much work is it on our side?",
        answer:
          "You provide the sources and decisions (tone, topics, what “good” looks like). We help with structure, launch, and iteration so you are not figuring it out alone.",
      },
      {
        question: "Can we start small?",
        answer:
          "Yes. Many teams begin with a focused slice of content—then expand once they see real visitor questions and gaps.",
      },
    ],
    footerCta: {
      label: siteCtaLabels.talkToUs,
      href: siteRoutes.contact,
      variant: "link",
    },
  },

  finalCta: {
    headline: "Ready to put AI support on your site—your way?",
    subheadline:
      "Train an agent on your content, keep answers on-brand, and choose hosted or custom delivery based on what your business needs.",
    body: "Start with demos if you want proof. Or begin scoping your agent now—either path leads to the same goal: support that feels like it belongs on your website.",
    primaryCta: {
      label: siteCtaLabels.createAgent,
      href: siteRoutes.createAgent,
      variant: "primary",
    },
    secondaryCta: {
      label: siteCtaLabels.browseDemos,
      href: siteRoutes.bots,
      variant: "secondary",
    },
  },
};
