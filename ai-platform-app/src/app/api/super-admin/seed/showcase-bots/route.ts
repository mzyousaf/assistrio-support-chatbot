import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { DocumentModel } from "@/models/Document";
import IngestJob from "@/models/IngestJob";

type ShowcaseBotSeed = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  welcomeMessage?: string;
  exampleQuestions: string[];
  personality: { systemPrompt?: string; tone?: "friendly" | "formal" | "playful" | "technical"; language?: string };
  docs: { title: string; text: string }[];
};

const SHOWCASE_BOTS: ShowcaseBotSeed[] = [
  {
    slug: "saas-product-support",
    name: "SaaS Product Support",
    shortDescription: "Answer questions about your SaaS product, plans, and features.",
    description:
      "A support bot trained on your product docs. Handles billing, feature questions, and onboarding.",
    welcomeMessage: "Hi! I'm here to help with product questions, billing, and features. What can I help with?",
    exampleQuestions: [
      "How do I upgrade my plan?",
      "Where can I find the API documentation?",
      "How do I reset my password?",
    ],
    personality: { systemPrompt: "You are a helpful SaaS product support assistant.", tone: "friendly", language: "en-US" },
    docs: [
      {
        title: "Knowledge Base",
        text: `SaaS Product Support – Knowledge Base

Plans and billing
- Free: 1 user, 100 API calls/month.
- Pro: 5 users, 10,000 API calls/month. Billing is monthly or annual.
- Enterprise: Unlimited users and API calls. Contact sales.

Upgrading: Go to Settings > Billing and click Upgrade. You can switch to annual for 2 months free.

API documentation
- Base URL: https://api.example.com/v1
- Authentication: Bearer token in the Authorization header.
- Rate limits: See your plan. 429 responses include Retry-After.

Password reset
- Use "Forgot password" on the login page. You'll get an email with a link valid for 1 hour.
- If you don't receive it, check spam or request again after 15 minutes.`,
      },
    ],
  },
  {
    slug: "ecommerce-returns-shipping",
    name: "E-commerce Returns & Shipping",
    shortDescription: "Handle returns, refunds, and shipping questions for your store.",
    description:
      "Trained on your return policy and shipping info. Helps customers with orders, tracking, and refunds.",
    welcomeMessage: "Hi! I can help with returns, shipping, and order status. What do you need?",
    exampleQuestions: [
      "What is your return policy?",
      "How do I track my order?",
      "How long do refunds take?",
    ],
    personality: { systemPrompt: "You are a helpful e-commerce customer service assistant.", tone: "friendly", language: "en-US" },
    docs: [
      {
        title: "FAQ",
        text: `E-commerce Returns & Shipping – FAQ

Returns
- You may return most items within 30 days of delivery for a full refund.
- Items must be unused and in original packaging. Exclusions: perishables, personalized items.
- Start a return in Your Account > Orders > Return Item. Print the label and ship within 14 days.

Shipping
- Standard: 5–7 business days. Free over $50.
- Express: 2–3 business days. Flat fee $9.99.
- International: 7–14 business days. Duties may apply.

Tracking: Use the link in your shipping email or go to Your Account > Orders and click Track.

Refunds
- Processed within 5–7 business days after we receive the return. Original payment method is credited.
- Bank processing may add 3–5 extra days.`,
      },
    ],
  },
  {
    slug: "law-firm-intake",
    name: "Law Firm Intake",
    shortDescription: "Collect intake details and direct clients to the right practice area.",
    description:
      "Intake assistant for law firms. Asks qualifying questions and routes to the appropriate team.",
    welcomeMessage: "Welcome. This intake assistant will ask a few questions to connect you with the right team.",
    exampleQuestions: [
      "I need help with a contract dispute.",
      "How do I schedule a consultation?",
      "What practice areas do you cover?",
    ],
    personality: { systemPrompt: "You are a professional law firm intake assistant. Be clear and confidential.", tone: "formal", language: "en-US" },
    docs: [
      {
        title: "Knowledge Base",
        text: `Law Firm Intake – Knowledge Base

Practice areas
- Commercial litigation and contract disputes
- Employment (discrimination, wrongful termination, wage)
- Real estate (residential and commercial)
- Estate planning and probate
- Family law (divorce, custody, support)

Consultations
- Initial consultations are 30 minutes and may be free or at a reduced rate depending on practice area.
- Schedule via this chat, our website, or by calling the office. We respond within 1 business day.

What we need at intake
- Your name and contact information
- Brief description of your matter (no confidential details required upfront)
- Any relevant documents can be shared after the consultation is scheduled.

Confidentiality: Information you provide is treated as confidential and subject to attorney-client privilege once an engagement begins.`,
      },
    ],
  },
  {
    slug: "real-estate-listing-assistant",
    name: "Real Estate Listing Assistant",
    shortDescription: "Answer questions about listed properties and schedule viewings.",
    description:
      "Trained on your listings. Answers questions about features, pricing, and availability and helps schedule showings.",
    welcomeMessage: "Hi! I can tell you about our current listings and help you schedule a viewing. What are you looking for?",
    exampleQuestions: [
      "What 3-bedroom homes do you have under $400k?",
      "How do I schedule a viewing?",
      "Does the downtown condo have parking?",
    ],
    personality: { systemPrompt: "You are a helpful real estate listing assistant. Be clear about features and next steps.", tone: "friendly", language: "en-US" },
    docs: [
      {
        title: "Knowledge Base",
        text: `Real Estate Listing Assistant – Knowledge Base

Listings
- All current listings are on our website with photos, floor plans, and key details.
- Prices and availability are updated daily. Square footage and lot size are in each listing.
- For 3-bedroom homes under $400k, use the filters on the website or ask me and I'll summarize what matches.

Viewings
- Schedule a viewing via our website (listing page > Schedule Tour), this chat, or by calling the office.
- We typically confirm within 24 hours and suggest 2–3 time slots. Weekend and evening slots are available.

Common details
- Downtown condo: 2 beds, 2 baths, 1 assigned underground parking space, HOA includes water and common areas.
- Suburban 3-bed: 2.5 baths, 2-car garage, fenced yard, listed at $385,000.`,
      },
    ],
  },
  {
    slug: "clinic-appointment-assistant",
    name: "Clinic Appointment & Info Assistant",
    shortDescription: "Answer questions about services, hours, and book appointments.",
    description:
      "Trained on clinic info and FAQs. Helps with services, locations, and appointment booking.",
    welcomeMessage: "Hi! I can help with appointments, locations, and general questions. What do you need?",
    exampleQuestions: [
      "What are your opening hours?",
      "How do I book an appointment?",
      "Do you take my insurance?",
    ],
    personality: { systemPrompt: "You are a helpful clinic front-desk assistant. Be clear and respectful about health information.", tone: "friendly", language: "en-US" },
    docs: [
      {
        title: "FAQ",
        text: `Clinic Appointment & Info – FAQ

Hours
- Main location: Mon–Fri 8am–6pm, Sat 9am–1pm. Closed Sundays and holidays.
- Urgent care (same building): Mon–Fri 6pm–9pm, Sat 1pm–5pm.

Appointments
- Book online via the patient portal, this chat, or by phone. Same-day slots may be available.
- New patients: bring ID, insurance card, and any prior records. Arrive 15 minutes early for paperwork.
- Cancellations: please cancel or reschedule at least 24 hours in advance.

Insurance
- We accept most major plans. Check our website for the current list or ask at your first visit.
- Copays and deductibles depend on your plan; we can give an estimate before your visit.`,
      },
      {
        title: "Knowledge Base",
        text: `Clinic Services and Locations

Services: General practice, preventive care, vaccinations, minor procedures, and referrals to specialists when needed.

Main location: 123 Health Ave, Suite 100. Parking in the lot; entrance on the north side.

Patient portal: Register on our website to view results, request refills, and message your provider.`,
      },
    ],
  },
];

export async function POST() {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const slugs = SHOWCASE_BOTS.map((b) => b.slug);
    const existing = await Bot.find({
      $or: [{ type: "showcase", slug: { $in: slugs } }, { slug: { $in: slugs } }],
    })
      .select("_id slug")
      .lean();

    const existingBySlug = new Map(existing.map((b) => [b.slug, b]));
    const createdBots: { botId: string; slug: string; docsQueued: number }[] = [];
    const skippedBots: { slug: string; reason: string }[] = [];

    for (const seed of SHOWCASE_BOTS) {
      if (existingBySlug.has(seed.slug)) {
        skippedBots.push({ slug: seed.slug, reason: "already_exists" });
        continue;
      }

      const bot = await Bot.create({
        name: seed.name,
        slug: seed.slug,
        type: "showcase",
        status: "published",
        isPublic: true,
        shortDescription: seed.shortDescription,
        description: seed.description,
        welcomeMessage: seed.welcomeMessage,
        exampleQuestions: seed.exampleQuestions,
        personality: seed.personality,
        chatUI: {
          primaryColor: "#14B8A6",
          backgroundStyle: "light",
          bubbleStyle: "rounded",
          avatarStyle: "emoji",
          launcherPosition: "bottom-right",
          font: "inter",
          showBranding: true,
        },
        config: { temperature: 0.3, responseLength: "medium", maxTokens: 512 },
        leadCapture: { enabled: false, fields: [] },
        faqs: [],
        categories: [],
      });

      let docsQueued = 0;
      for (const docSeed of seed.docs) {
        const doc = await DocumentModel.create({
          botId: bot._id,
          title: docSeed.title,
          sourceType: "manual",
          status: "queued",
          text: docSeed.text,
        });
        await IngestJob.create({
          botId: bot._id,
          docId: doc._id,
          status: "queued",
        });
        docsQueued += 1;
      }

      createdBots.push({
        botId: String(bot._id),
        slug: bot.slug,
        docsQueued,
      });
    }

    return NextResponse.json({
      ok: true,
      createdBots,
      skippedBots,
    });
  } catch (error) {
    console.error("Seed showcase bots failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
