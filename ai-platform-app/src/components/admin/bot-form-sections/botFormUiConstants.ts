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
] as const;

export const BEHAVIOR_PRESETS = [
  { value: "default", label: "Default helper" },
  { value: "support", label: "Support agent" },
  { value: "sales", label: "Sales assistant" },
  { value: "technical", label: "Technical assistant" },
  { value: "marketing", label: "Marketing assistant" },
  { value: "consultative", label: "Consultative advisor" },
  { value: "teacher", label: "Teacher and explainer" },
  { value: "empathetic", label: "Empathetic listener" },
  { value: "strict", label: "Strict policy-based" },
] as const;

export const EXAMPLE_QUESTIONS_MAX = 5;

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
