export interface ShowcaseBotSeed {
  slug: string;
  name: string;
  /** One-line summary for cards, lists, and SEO snippets (plain text). */
  shortDescription: string;
  /**
   * Long-form **Markdown** for gallery/detail pages: headings, lists, and emphasis render well with a rich-text or MD renderer.
   * Keep `shortDescription` short; put structure and depth here.
   */
  description: string;
  welcomeMessage?: string;
  exampleQuestions: string[];
  personality: { systemPrompt?: string; tone?: 'friendly' | 'formal' | 'playful' | 'technical'; language?: string };
  docs: { title: string; text: string }[];
}

export const SHOWCASE_BOTS: ShowcaseBotSeed[] = [
  {
    slug: 'saas-product-support',
    name: 'SaaS Product Support',
    shortDescription: 'Answer questions about your SaaS product, plans, and features.',
    description: `## SaaS product support

A **first-line support** assistant trained on your product documentation, pricing, and workflows. It deflects repetitive tickets and routes complex issues with clear context.

### Best for
- **Plans & billing** — upgrades, invoices, seat limits, and renewal timing
- **Product how-tos** — features, integrations, and where to click in the app
- **Developer-facing questions** — API basics, auth, and rate limits (from your KB)

### What visitors get
Clear, consistent answers aligned with your docs—ideal for marketing sites, in-app help, and onboarding flows.`,
    welcomeMessage: "Hi! I'm here to help with product questions, billing, and features. What can I help with?",
    exampleQuestions: ['How do I upgrade my plan?', 'Where can I find the API documentation?', 'How do I reset my password?'],
    personality: { systemPrompt: 'You are a helpful SaaS product support assistant.', tone: 'friendly', language: 'en-US' },
    docs: [
      {
        title: 'Knowledge Base',
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
    slug: 'ecommerce-returns-shipping',
    name: 'E-commerce Returns & Shipping',
    shortDescription: 'Handle returns, refunds, and shipping questions for your store.',
    description: `## E‑commerce returns & shipping

Answers **order status**, **return windows**, **refund timing**, and **shipping options** using your store policies—so shoppers self-serve before opening a ticket.

### Covers
- **Returns & exchanges** — eligibility, packaging, and label steps
- **Shipping** — carriers, timeframes, and international duties (as you document)
- **Refunds** — processing time and payment method credits

### Fit
Shopify-style storefronts, D2C brands, and marketplaces that want fewer “where is my order?” emails.`,
    welcomeMessage: "Hi! I can help with returns, shipping, and order status. What do you need?",
    exampleQuestions: ['What is your return policy?', 'How do I track my order?', 'How long do refunds take?'],
    personality: { systemPrompt: 'You are a helpful e-commerce customer service assistant.', tone: 'friendly', language: 'en-US' },
    docs: [
      {
        title: 'FAQ',
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
    slug: 'law-firm-intake',
    name: 'Law Firm Intake',
    shortDescription: 'Collect intake details and direct clients to the right practice area.',
    description: `## Law firm intake

A **structured intake** experience: it gathers matter type, urgency, and contact preferences—then points visitors to the right practice group or scheduling path.

### Designed for
- **Practice-area routing** — litigation, employment, real estate, estates, family, etc.
- **Professional tone** — confidential, no legal advice in chat (policy-driven)
- **Consultation handoff** — clear next steps for humans to follow up

### Note
Copy is illustrative; your firm should align prompts and KB with jurisdictional rules and bar advertising requirements.`,
    welcomeMessage: 'Welcome. This intake assistant will ask a few questions to connect you with the right team.',
    exampleQuestions: ['I need help with a contract dispute.', 'How do I schedule a consultation?', 'What practice areas do you cover?'],
    personality: { systemPrompt: 'You are a professional law firm intake assistant. Be clear and confidential.', tone: 'formal', language: 'en-US' },
    docs: [
      {
        title: 'Knowledge Base',
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
    slug: 'real-estate-listing-assistant',
    name: 'Real Estate Listing Assistant',
    shortDescription: 'Answer questions about listed properties and schedule viewings.',
    description: `## Real estate listings

Helps **buyers and renters** compare properties, understand key facts (beds/baths, parking, HOA), and **request tours**—grounded in your active listings and office process.

### Highlights
- **Search-style help** — e.g. price bands, neighborhoods, must-haves
- **Showing requests** — how to book and what to bring
- **Transparency** — points to MLS/website for photos and legal disclaimers

### Ideal use
Brokerages and teams that want 24/7 answers on listing pages without overloading agents.`,
    welcomeMessage: "Hi! I can tell you about our current listings and help you schedule a viewing. What are you looking for?",
    exampleQuestions: ['What 3-bedroom homes do you have under $400k?', 'How do I schedule a viewing?', 'Does the downtown condo have parking?'],
    personality: { systemPrompt: 'You are a helpful real estate listing assistant. Be clear about features and next steps.', tone: 'friendly', language: 'en-US' },
    docs: [
      {
        title: 'Knowledge Base',
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
    slug: 'clinic-appointment-assistant',
    name: 'Clinic Appointment & Info Assistant',
    shortDescription: 'Answer questions about services, hours, and book appointments.',
    description: `## Clinic information & scheduling

A **front-desk style** assistant for **hours**, **services**, **insurance basics**, and **how to book**—without giving medical advice.

### Suitable for
- **Access & logistics** — locations, parking, portal links
- **Administrative FAQs** — new patient paperwork, cancellations, records requests
- **Triage language** — urgent symptoms → appropriate escalation (per your policy)

### Compliance posture
Uses general facility information only; clinical questions stay with licensed staff.`,
    welcomeMessage: "Hi! I can help with appointments, locations, and general questions. What do you need?",
    exampleQuestions: ['What are your opening hours?', 'How do I book an appointment?', 'Do you take my insurance?'],
    personality: { systemPrompt: 'You are a helpful clinic front-desk assistant. Be clear and respectful about health information.', tone: 'friendly', language: 'en-US' },
    docs: [
      {
        title: 'FAQ',
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
        title: 'Knowledge Base',
        text: `Clinic Services and Locations

Services: General practice, preventive care, vaccinations, minor procedures, and referrals to specialists when needed.

Main location: 123 Health Ave, Suite 100. Parking in the lot; entrance on the north side.

Patient portal: Register on our website to view results, request refills, and message your provider.`,
      },
    ],
  },
];
