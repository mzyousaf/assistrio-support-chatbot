import type { EditorTabValue } from "@/lib/agent-slug-to-tab";
import type { KnowledgeSubsection } from "@/lib/knowledge-subsection";

export const CATEGORY_OPTIONS = [
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "onboarding", label: "Onboarding" },
  { value: "hr", label: "HR" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "operations", label: "Operations" },
  { value: "product", label: "Product" },
  { value: "education", label: "Education" },
  { value: "healthcare", label: "Healthcare" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "compliance", label: "Compliance" },
  { value: "docs", label: "Documentation" },
  { value: "general", label: "General" },
  { value: "engineering", label: "Engineering" },
  { value: "customer_success", label: "Customer Success" },
  { value: "security", label: "Security" },
  { value: "devrel", label: "Developer relations" },
  { value: "community", label: "Community" },
  { value: "nonprofit", label: "Non-profit" },
  { value: "real_estate", label: "Real estate" },
  { value: "internal_it", label: "Internal IT" },
  { value: "travel", label: "Travel" },
  { value: "automotive", label: "Automotive" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "logistics", label: "Logistics" },
  { value: "media", label: "Media" },
  { value: "gaming", label: "Gaming" },
  { value: "government", label: "Government" },
  { value: "insurance", label: "Insurance" },
  { value: "consulting", label: "Consulting" },
  { value: "recruiting", label: "Recruiting" },
  { value: "events", label: "Events" },
  { value: "agriculture", label: "Agriculture" },
  { value: "energy", label: "Energy" },
  { value: "fitness", label: "Fitness" },
  { value: "food_beverage", label: "Food & beverage" },
  { value: "pharma", label: "Pharmaceuticals" },
  { value: "architecture", label: "Architecture" },
  { value: "saas", label: "SaaS" },
  { value: "b2b", label: "B2B" },
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "aerospace", label: "Aerospace" },
  { value: "construction", label: "Construction" },
  { value: "beauty", label: "Beauty" },
  { value: "fashion", label: "Fashion" },
  { value: "music", label: "Music" },
  { value: "publishing", label: "Publishing" },
  { value: "research", label: "Research" },
  { value: "sustainability", label: "Sustainability" },
] as const;

/** Shown under Preset when Default is selected (matches customer copy). */
export const DEFAULT_PRESET_HELPER =
  "Uses the instructions below as the main behavior instructions (no fixed role template).";

export const BEHAVIOR_PRESETS = [
  { value: "default", label: "Default helper — uses instructions" },
  { value: "support", label: "Support agent" },
  { value: "sales", label: "Sales assistant" },
  { value: "technical", label: "Technical assistant" },
  { value: "marketing", label: "Marketing assistant" },
  { value: "consultative", label: "Consultative advisor" },
  { value: "teacher", label: "Teacher and explainer" },
  { value: "empathetic", label: "Empathetic listener" },
  { value: "strict", label: "Strict policy-based" },
  { value: "concise", label: "Concise and direct" },
  { value: "creative", label: "Creative and engaging" },
  { value: "research", label: "Research and analysis" },
  { value: "executive", label: "Executive assistant" },
  { value: "hospitality", label: "Hospitality and service" },
  { value: "coach", label: "Coach and mentor" },
  { value: "analyst", label: "Analyst and data guide" },
  { value: "storyteller", label: "Storytelling guide" },
  { value: "startup", label: "Startup voice" },
  { value: "journalistic", label: "Journalistic and neutral" },
  { value: "companion", label: "Conversational companion" },
  { value: "simplifier", label: "Plain-language simplifier" },
  { value: "facilitator", label: "Facilitator and guide" },
  { value: "advocate", label: "Customer advocate" },
  { value: "negotiator", label: "Negotiation and alignment" },
  { value: "interviewer", label: "Interviewer and screener" },
] as const;

export const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "warm", label: "Warm" },
  { value: "supportive", label: "Supportive" },
  { value: "empathetic", label: "Empathetic" },
  { value: "professional", label: "Professional" },
  { value: "formal", label: "Formal" },
  { value: "confident", label: "Confident" },
  { value: "authoritative", label: "Authoritative" },
  { value: "casual", label: "Casual" },
  { value: "conversational", label: "Conversational" },
  { value: "playful", label: "Playful" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "neutral", label: "Neutral" },
  { value: "diplomatic", label: "Diplomatic" },
  { value: "direct", label: "Direct" },
  { value: "patient", label: "Patient" },
  { value: "calm", label: "Calm" },
  { value: "technical", label: "Technical" },
] as const;

export const EXAMPLE_QUESTIONS_MAX = 10;

export const TAB_IDS = [
  { value: "general", label: "Profile" },
  { value: "behavior", label: "Behavior" },
  { value: "knowledge", label: "Knowledge" },
  { value: "integrations", label: "AI & Integrations" },
  { value: "chat-experience", label: "Chat" },
  { value: "appearance", label: "Appearance" },
  { value: "publish", label: "Publish" },
] as const;

/** Per-route copy when Knowledge is split into Notes / FAQs / Documents. */
export const KNOWLEDGE_SUBSECTION_META: Record<
  KnowledgeSubsection,
  { title: string; description: string }
> = {
  notes: {
    title: "Internal notes",
    description: "Describe scope for admins, control inclusion in replies, and refresh embeddings.",
  },
  faqs: {
    title: "Frequently asked questions",
    description: "Curated Q&A pairs the assistant can draw on—manage entries and retry embedding as needed.",
  },
  documents: {
    title: "Documents",
    description: "Upload and manage source files; track ingestion health and processing status.",
  },
};

/** In-page subheads — distinct from the pane h1 (nav section name) to avoid “Profile · Profile” duplication. */
export const TAB_META: Record<(typeof TAB_IDS)[number]["value"], { title: string; description: string }> = {
  general: { title: "Identity & visibility", description: "Name, avatar, descriptions, and how the agent appears to visitors." },
  behavior: { title: "Tone & instructions", description: "Personality presets, system behavior, and lead capture." },
  knowledge: { title: "Sources & content", description: "FAQs, documents, notes, and ingestion health." },
  integrations: { title: "Models & connectivity", description: "Provider, model, keys, voice, and advanced options." },
  "chat-experience": { title: "Messages & composer", description: "Header, welcome line, suggested prompts, and input tools." },
  appearance: { title: "Theme & launcher", description: "Colors, launcher, panel layout, motion, and branding." },
  publish: { title: "Access & embedding", description: "Domains, embed snippet, runtime keys, and go-live checklist." },
};

export const TAB_CONTENT_CLASS = "mx-auto w-full max-w-[min(1200px,100%)] space-y-8 pb-2";

export type EditorTabKey = EditorTabValue;
