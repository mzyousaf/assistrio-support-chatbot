import type { PlanItem } from "@/components/sections/home/plans-pricing-grid";

/** Source-of-truth copy for homepage + /pricing — keep tiers aligned. */
export const HOMEPAGE_PRICING_PLANS: PlanItem[] = [
  {
    name: "Explore",
    priceDisplay: "$0",
    badge: "Try it free",
    groups: [
      {
        title: "Try instantly",
        items: [
          "Instant evaluation — no card required.",
          "Browse live examples in the gallery (shared demo quota)",
          "Create 1 evaluation bot for your allowed website",
          "1 allowed website (sub-sites on that website included)",
          "Website chat widget — same runtime model as Launch",
        ],
      },
      {
        title: "Knowledge & outcomes",
        items: [
          "Document, FAQ, and notes knowledge support",
          "Lead capture",
          "Basic insights",
        ],
      },
      {
        title: "Included",
        items: ["Evaluation access on Assistrio infrastructure", "Support included"],
      },
    ],
    cta: "Try it free",
    href: "/trial",
    variant: "secondary",
    ctaPathLabel: "For evaluation",
    ctaSupportingText: "Your bot on your allowed website · limited quota · no card",
  },
  {
    name: "Launch",
    priceDisplay: "$500",
    priceSubline: "first month, then $150/month",
    badge: "Most Popular",
    featured: true,
    groups: [
      {
        title: "Capacity",
        items: [
          "Up to 5 bots included",
          "1,000 monthly AI credits — if you add your own OpenAI key, credits do not burn",
          "Each bot: 1 allowed website, including sub-sites on that website",
          "Additional bots: $25/month per bot",
        ],
      },
      {
        title: "Product depth",
        items: [
          "Website chat widget",
          "Document, FAQ, notes, and URL knowledge base",
          "Lead capture and lead tracking",
          "Public and private bot controls",
          "Access key and secret key support",
          "Insights dashboard, chats per bot, leads analytics, sentiment insights, and topic insights",
        ],
      },
      {
        title: "Operations",
        items: ["Hosting included", "Maintenance included", "Support included"],
      },
    ],
    cta: "Launch Hosted",
    href: "/contact",
    variant: "primary",
    ctaPathLabel: "For production",
    ctaSupportingText: "Hosted runtime · full product · business use",
  },
  {
    name: "Enterprise",
    priceDisplay: "Custom pricing",
    groups: [
      {
        title: "Who it is for",
        items: ["For businesses that want private deployment and codebase ownership."],
      },
      {
        title: "Includes",
        items: [
          "Private deployment",
          "Client-specific codebase handoff",
          "Full product access",
          "Deployment documentation",
          "Environment and setup guidance",
          "Handover support",
          "Ongoing support options",
          "Custom commercial terms",
        ],
      },
    ],
    cta: "Talk to Sales",
    href: "/contact",
    variant: "secondary",
    ctaPathLabel: "For private deployment",
    ctaSupportingText: "Enterprise · codebase handoff · custom terms",
  },
];

export const PRICING_PAGE_PLANS: PlanItem[] = [
  {
    name: "Explore",
    priceDisplay: "$0",
    badge: "Try it free",
    groups: [
      {
        title: "Evaluation",
        items: [
          "Instant evaluation — no card required.",
          "Browse live gallery examples (shared demo quota)",
          "Create 1 evaluation bot for your allowed website",
          "1 allowed website",
          "Sub-sites on that website included",
          "Website chat widget",
        ],
      },
      {
        title: "Knowledge & signals",
        items: [
          "Document, FAQ, and notes knowledge support",
          "Lead capture",
          "Basic insights",
        ],
      },
      {
        title: "Included",
        items: ["Evaluation access on Assistrio infrastructure", "Support included"],
      },
    ],
    cta: "Try it free",
    href: "/trial",
    variant: "secondary",
    ctaPathLabel: "For evaluation",
    ctaSupportingText: "Your bot on your allowed website · limited quota · no card",
  },
  {
    name: "Launch",
    priceDisplay: "$500",
    priceSubline: "first month, then $150/month",
    badge: "Most Popular",
    featured: true,
    groups: [
      {
        title: "Capacity & allowed websites",
        items: [
          "Up to 5 bots",
          "1,000 monthly AI credits",
          "If you add your own OpenAI key, credits do not burn",
          "Each bot: 1 allowed website, including sub-sites on that website",
          "Additional bots: $25/month per bot",
        ],
      },
      {
        title: "Product",
        items: [
          "Website chat widget",
          "Document, FAQ, notes, and URL knowledge base",
          "Lead capture and lead tracking",
          "Public and private bot controls",
          "Access key and secret key support",
        ],
      },
      {
        title: "Insights",
        items: [
          "Insights dashboard",
          "Chats per bot",
          "Leads analytics",
          "Sentiment insights",
          "Topic insights",
        ],
      },
      {
        title: "Operations",
        items: ["Hosting included", "Maintenance included", "Support included"],
      },
    ],
    cta: "Launch Hosted",
    href: "/contact",
    variant: "primary",
    ctaPathLabel: "For production",
    ctaSupportingText: "Hosted runtime · full product · business use",
  },
  {
    name: "Enterprise",
    priceDisplay: "Custom pricing",
    groups: [
      {
        title: "Positioning",
        items: ["For businesses that want private deployment and codebase ownership."],
      },
      {
        title: "Delivery & partnership",
        items: [
          "Private deployment",
          "Client-specific codebase handoff",
          "Full product access",
          "Deployment documentation",
          "Environment and setup guidance",
          "Handover support",
          "Ongoing support options",
          "Custom commercial terms",
        ],
      },
    ],
    cta: "Talk to Sales",
    href: "/contact",
    variant: "secondary",
    ctaPathLabel: "For private deployment",
    ctaSupportingText: "Enterprise · codebase handoff · custom terms",
  },
];

/** Row keys align with comparison table columns: Explore · Launch · Enterprise. */
export type PricingComparisonRow = {
  label: string;
  explore: string;
  launch: string;
  enterprise: string;
};

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    label: "Price",
    explore: "$0",
    launch: "$500 first month, then $150/month",
    enterprise: "Custom pricing",
  },
  {
    label: "Best for",
    explore: "Instant product try-out",
    launch: "Production on Assistrio-hosted infrastructure",
    enterprise: "Private deployment and codebase ownership",
  },
  {
    label: "Bots",
    explore: "1 evaluation bot · gallery live examples",
    launch: "Up to 5 included · $25/month per additional bot",
    enterprise: "Per your agreement",
  },
  {
    label: "AI credits",
    explore: "Explore quota limits apply",
    launch: "1,000/month included · BYOK does not consume credits",
    enterprise: "Per your agreement",
  },
  {
    label: "Allowed websites",
    explore: "1 allowed website (sub-sites included)",
    launch: "Per bot: 1 allowed website, sub-sites included",
    enterprise: "Per your deployment",
  },
  {
    label: "Knowledge & analytics",
    explore: "Docs, FAQs, notes · basic insights",
    launch: "Full knowledge base (incl. URLs) · dashboard, leads, sentiment, topics",
    enterprise: "Full product capabilities in your environment",
  },
  {
    label: "Infrastructure",
    explore: "Evaluation access on Assistrio",
    launch: "Fully managed by Assistrio",
    enterprise: "Your infrastructure",
  },
  {
    label: "Support",
    explore: "Included",
    launch: "Included",
    enterprise: "Handover plus ongoing options",
  },
];
