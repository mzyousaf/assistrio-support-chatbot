import type { HomePageContent } from "@/types/home";
import { siteCtaLabels, siteRoutes } from "./site";

export const homePageContent: HomePageContent = {
  hero: {
    headline: "Custom AI support for your website—trained on how you actually work.",
    subheadline:
      "Give visitors instant, accurate answers from your FAQs, docs, and site content. Fewer repeat questions, smoother pre-sales, and leads that arrive with context.",
    body: "Assistrio is a custom AI support agent built around your business—not a one-size-fits-all widget. It handles support and pre-sales in your voice, so your team stays focused on conversations that need a human.",
    primaryCta: {
      label: siteCtaLabels.createAgent,
      href: siteRoutes.createAgent,
      variant: "primary",
    },
    secondaryCta: {
      label: siteCtaLabels.tryDemo,
      href: siteRoutes.bots,
      variant: "secondary",
    },
    tertiaryCta: {
      label: "See how it works",
      href: "#how-it-works",
      variant: "link",
    },
  },

  capabilityStrip: {
    headline: "Built for answers you can stand behind.",
    subheadline: "One agent. Your sources. Your standards.",
    body: "Trained on the materials you approve. Clear guardrails for tone and topics. A path to your team when someone needs more than a quick answer. Designed for real sites, real customers, and real volume—not demos that fall apart in production.",
    linkCta: {
      label: siteCtaLabels.browseDemos,
      href: siteRoutes.bots,
      variant: "link",
    },
  },

  valueProps: {
    headline: "Support that sounds like you—not a generic chatbot.",
    subheadline:
      "Turn scattered FAQs and docs into one conversational front door for your site.",
    body: "Visitors get guidance grounded in your policies, pricing context, and product detail. You cut repetitive tickets, shorten “how do I…?” threads, and capture interest when people are ready to talk to someone. The experience stays on-brand because it is built from your own knowledge—not a canned script.",
    items: [
      {
        title: "Grounded in your content",
        description:
          "Answers draw from the pages, FAQs, and documents you choose—kept current as you ship and revise.",
        icon: "knowledge",
      },
      {
        title: "Support and pre-sales, together",
        description:
          "Handle troubleshooting, comparisons, and “where do I start?” without sending people in circles.",
        icon: "support",
      },
      {
        title: "Fewer repeat questions",
        description:
          "Deflect Tier‑1 without sounding robotic. Your team gets time back for the issues that need judgment.",
        icon: "tickets",
      },
      {
        title: "Lead capture that fits your flow",
        description:
          "Collect emails or intents when someone is ready for a human—aligned to how you already sell.",
        icon: "leads",
      },
    ],
    ctas: [
      {
        label: siteCtaLabels.exploreHowItWorks,
        href: "#how-it-works",
        variant: "secondary",
      },
      {
        label: siteCtaLabels.createAgent,
        href: siteRoutes.createAgent,
        variant: "primary",
      },
    ],
  },

  howItWorks: {
    headline: "From your content to a live agent—without the guesswork.",
    subheadline:
      "A straightforward path from what you know today to what customers see tomorrow.",
    steps: [
      {
        title: "Share your sources",
        description:
          "Website pages, FAQs, documents, and the nuances that usually live in someone’s head.",
      },
      {
        title: "Shape the experience",
        description:
          "We align tone, boundaries, and how the agent should respond when something is unclear.",
      },
      {
        title: "Go live",
        description:
          "Embed on your site or use a managed setup—whichever fits how you operate.",
      },
      {
        title: "Keep it current",
        description:
          "Update content as you ship, reprice, or refine policies so answers stay trustworthy.",
      },
    ],
    ctas: [
      {
        label: siteCtaLabels.startYourAgent,
        href: siteRoutes.createAgent,
        variant: "primary",
      },
      {
        label: siteCtaLabels.talkToUs,
        href: siteRoutes.contact,
        variant: "secondary",
      },
    ],
  },

  useCases: {
    headline: "Where teams use Assistrio.",
    subheadline: "Same product—shaped for how you sell and support.",
    items: [
      {
        title: "SaaS and product companies",
        description:
          "Onboarding help, plan questions, billing FAQs, and trial support without stretching your inbox.",
      },
      {
        title: "Agencies",
        description:
          "A polished agent experience for your clients’ sites—consistent answers, less back-and-forth, room to grow across accounts.",
      },
      {
        title: "Service businesses",
        description:
          "Coverage areas, offerings, booking context, and qualification—so serious leads rise to the top.",
      },
      {
        title: "Marketplaces and solo operators",
        description:
          "Always-on help when you cannot staff live chat, without sounding like a template.",
      },
    ],
    sectionCtas: [
      {
        label: siteCtaLabels.seeDemoAgents,
        href: siteRoutes.bots,
        variant: "secondary",
      },
      {
        label: siteCtaLabels.createAgent,
        href: siteRoutes.createAgent,
        variant: "primary",
      },
    ],
  },

  publicBotsPreview: {
    headline: "Try it before you commit.",
    subheadline:
      "See how an Assistrio agent responds when it is trained like a real deployment—not a canned demo script.",
    body: "Explore public demo agents built around sample businesses and scenarios. Ask natural questions, follow-ups, and edge cases. When you are ready, we will build yours from your own pages, FAQs, and documents.",
    bots: [
      {
        id: "demo-saas",
        name: "SaaS onboarding assistant",
        description:
          "Plans, trials, and setup—trained on sample product docs and billing FAQs.",
        href: siteRoutes.bots,
        avatarEmoji: "💼",
      },
      {
        id: "demo-agency",
        name: "Agency client concierge",
        description:
          "Services, timelines, and what to expect—grounded in a sample scope and deliverables.",
        href: siteRoutes.bots,
        avatarEmoji: "🎯",
      },
      {
        id: "demo-service",
        name: "Local service desk",
        description:
          "Coverage areas, booking, and pricing qualifiers—without overpromising.",
        href: siteRoutes.bots,
        avatarEmoji: "🏠",
      },
    ],
    viewAllCta: {
      label: siteCtaLabels.viewAllDemos,
      href: siteRoutes.bots,
      variant: "primary",
    },
  },

  createAgentCta: {
    headline: "Ready for an agent that knows your business?",
    subheadline:
      "Tell us about your site and what customers ask—we will help you launch support that earns trust.",
    body: "Whether you are replacing a static FAQ, unblocking a small team, or adding a professional layer for clients, Assistrio is built as a service: scoping, training on approved content, and launch support—so you are not left wiring it alone.",
    primaryCta: {
      label: siteCtaLabels.createAgent,
      href: siteRoutes.createAgent,
      variant: "primary",
    },
    secondaryCta: {
      label: siteCtaLabels.talkToUs,
      href: siteRoutes.contact,
      variant: "secondary",
    },
  },

  whyAssistrio: {
    headline: "Purpose-built for on-site support—not a blank canvas.",
    subheadline:
      "You are not buying a toolkit to figure out later. You are getting a support experience shaped around your content and your customers.",
    body: "Generic chatbots trade speed for credibility. Assistrio starts from what you already publish and what your team already knows—so answers feel specific, not vague. We focus on outcomes: fewer repetitive questions, clearer pre-sales, and a clean handoff when a human should step in. You get a partner for launch and iteration, not just another login.",
    rows: [
      {
        label: "Starting point",
        assistrio: "Your approved pages, FAQs, and docs",
        typical: "Generic scripts or empty prompts",
      },
      {
        label: "Goal",
        assistrio: "Support and pre-sales outcomes on your site",
        typical: "A chat box with no clear owner",
      },
      {
        label: "Launch",
        assistrio: "Hands-on help to go live with confidence",
        typical: "DIY assembly and guesswork",
      },
      {
        label: "When it is unsure",
        assistrio: "Clear next step or human handoff",
        typical: "Confident-sounding guesses",
      },
    ],
    ctas: [
      {
        label: siteCtaLabels.createAgent,
        href: siteRoutes.createAgent,
        variant: "primary",
      },
      {
        label: siteCtaLabels.compareDelivery,
        href: "#hosted-vs-custom",
        variant: "ghost",
      },
    ],
  },

  hostedVsCustom: {
    headline: "Choose how it shows up for your customers.",
    subheadline:
      "Same agent quality—flexible delivery for how your business runs.",
    intro: "Not sure yet? We will recommend a path based on your site, traffic, and how hands-on you want to be.",
    columns: [
      {
        title: "Managed hosted",
        description:
          "Fast to launch, minimal engineering, and an experience we operate for you when you want speed and simplicity.",
        bullets: [
          "Quick path to a live agent",
          "Less for your team to maintain day to day",
          "Ideal when you want outcomes without owning infra",
        ],
      },
      {
        title: "Custom and embedded",
        description:
          "Deeper fit for your site, branding, and workflows—ideal when the experience has to feel native to your product or client portfolio.",
        badge: "Flexible",
        bullets: [
          "Embeds and flows that match your site",
          "Room for bespoke branding and handoff",
          "Great for agencies and product-led teams",
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
    headline: "Questions, answered.",
    subheadline: "Straight talk for teams evaluating AI support seriously.",
    items: [
      {
        question: "What can the agent learn from?",
        answer:
          "Your website, FAQs, PDFs, and other materials you provide—as long as you are comfortable sharing them. You decide what goes in. We help you structure it so customers get useful answers, not noise.",
      },
      {
        question: "How do you keep answers accurate and on-brand?",
        answer:
          "We train and tune the agent against your approved content and your rules for tone and topics. When something is outside its scope, it should say so—not guess.",
      },
      {
        question: "What happens when the agent does not know?",
        answer:
          "It can offer a clear next step: a contact form, email capture, booking link, or handoff message—whatever matches how you want to close the loop with a human.",
      },
      {
        question: "How long does it take to go live?",
        answer:
          "It depends on how much content you have and how polished you want the first version. Many teams start with a focused set of sources and expand once they see real questions from visitors.",
      },
      {
        question: "Do I need developers?",
        answer:
          "Not always. Hosted setups are designed to be lightweight. Custom embeds may need a quick install on your site—we will spell out what your stack requires before you commit.",
      },
      {
        question: "How is my content handled?",
        answer:
          "We treat your materials as business-sensitive and use them to power your agent—not unrelated products. Ask if you need something specific for procurement or client agreements.",
      },
    ],
    footerCta: {
      label: siteCtaLabels.stillUnsure,
      href: siteRoutes.contact,
      variant: "link",
    },
  },

  finalCta: {
    headline: "Put a custom AI support agent on your site.",
    subheadline:
      "Trained on your world. Built for support and pre-sales. Delivered the way your business actually operates.",
    body: "Stop losing visitors to unanswered questions and overloaded inboxes. Assistrio helps you launch an agent that reflects your business—with room to grow from hosted simplicity to a deeper, custom setup.",
    primaryCta: {
      label: siteCtaLabels.createAgent,
      href: siteRoutes.createAgent,
      variant: "primary",
    },
    secondaryCta: {
      label: siteCtaLabels.tryDemo,
      href: siteRoutes.bots,
      variant: "secondary",
    },
    tertiaryCta: {
      label: siteCtaLabels.talkToUs,
      href: siteRoutes.contact,
      variant: "ghost",
    },
  },
};
