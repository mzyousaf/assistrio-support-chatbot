/**
 * Unified local draft for public trial onboarding.
 * Reads legacy v1 profile blob and v2 workspace JSON; persists as v3.
 */

import type { TrialKnowledgeFaqItem } from "./trial-knowledge-normalize";
import { parseTrialFaqsFromApi } from "./trial-knowledge-normalize";
import { TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS, TRIAL_KNOWLEDGE_SNIPPET_MIN_CHARS } from "./trial-utf8-bytes";

export const TRIAL_WORKSPACE_DRAFT_STORAGE_KEY = "assistrio_trial_workspace_draft_v2";

/** Legacy — still read for migration */
export const TRIAL_LEGACY_PROFILE_DRAFT_STORAGE_KEY = "assistrio_trial_profile_draft_v1";

export type TrialProfileQuickLink = {
  id: string;
  label: string;
  url: string;
};

export type { TrialKnowledgeFaqItem } from "./trial-knowledge-normalize";

export type TrialWorkspaceKnowledgePlaceholder = {
  /** Draft-side placeholder; uploaded files live in `uploadedAssets`. After create-agent, platform `documents` + ingestion apply. */
  documents: unknown[];
  faqs: TrialKnowledgeFaqItem[];
  notes: string;
};

/** Avatar uploaded via Assistrio (S3); distinct from {@link TrialAvatarByUserURL}. */
export type TrialAvatarByUpload = {
  url: string;
  assetKey?: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  updatedAt: string;
};

/** User-entered external image URL only (never an Assistrio upload URL). */
export type TrialAvatarByUserURL = {
  url: string;
  updatedAt: string;
};

export type TrialWorkspaceProfile = {
  agentName: string;
  /** One or more category tags; at least one is required for a complete profile. */
  categories: string[];
  /**
   * Resolved display URL: latest of `avatarByUpload` vs `avatarByUserURL`, then legacy `avatarUrl` data
   * when structured fields are absent (local preview / migration).
   */
  avatarUrl: string;
  avatarByUpload?: TrialAvatarByUpload | null;
  /** `null` means the user cleared the external URL field (sync removes server-side user URL on next save). */
  avatarByUserURL?: TrialAvatarByUserURL | null;
  brandColor: string;
  quickLinks: TrialProfileQuickLink[];
};

/** Same rule as backend: newest `updatedAt` wins; single source if only one exists; else legacy string. */
export function resolveFinalAvatarUrl(profile: {
  avatarUrl?: string;
  avatarByUpload?: TrialAvatarByUpload | null;
  avatarByUserURL?: TrialAvatarByUserURL | null;
}): string {
  const up = profile.avatarByUpload ?? undefined;
  const uu = profile.avatarByUserURL ?? undefined;
  const tUp = up?.updatedAt ? Date.parse(up.updatedAt) : 0;
  const tUu = uu?.updatedAt ? Date.parse(uu.updatedAt) : 0;
  const legacy = typeof profile.avatarUrl === "string" ? profile.avatarUrl.trim() : "";

  if (up?.url && !uu?.url) return up.url.trim();
  if (!up?.url && uu?.url) return uu.url.trim();
  if (up?.url && uu?.url) {
    if (tUp > tUu) return up.url.trim();
    if (tUu > tUp) return uu.url.trim();
    return up.url.trim();
  }
  return legacy;
}

export function finalizeTrialProfile(p: TrialWorkspaceProfile): TrialWorkspaceProfile {
  return { ...p, avatarUrl: resolveFinalAvatarUrl(p) };
}

function parseTrialAvatarByUploadFromJson(raw: unknown): TrialAvatarByUpload | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url) return undefined;
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt : new Date().toISOString();
  const out: TrialAvatarByUpload = { url, updatedAt };
  if (typeof o.assetKey === "string" && o.assetKey.trim()) out.assetKey = o.assetKey.trim().slice(0, 1024);
  if (typeof o.originalFilename === "string") out.originalFilename = o.originalFilename.slice(0, 500);
  if (typeof o.mimeType === "string") out.mimeType = o.mimeType.slice(0, 200);
  const sz = o.sizeBytes;
  if (typeof sz === "number" && Number.isFinite(sz) && sz >= 0) out.sizeBytes = Math.floor(sz);
  return out;
}

function parseTrialAvatarByUserURLFromJson(raw: unknown): TrialAvatarByUserURL | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url) return undefined;
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt : new Date().toISOString();
  return { url, updatedAt };
}

/**
 * When stored JSON has only flat `avatarUrl` (no structured subdocs), infer sources without losing data.
 * Non-http values (e.g. data URLs) stay in `avatarUrl` only.
 */
function inferStructuredAvatarsFromLegacyProfileAvatarOnly(
  avatarUrl: string,
  updatedAtIso: string,
): Pick<TrialWorkspaceProfile, "avatarByUpload" | "avatarByUserURL"> {
  const u = avatarUrl.trim();
  if (!u) return {};
  if (/^https?:\/\//i.test(u)) {
    return { avatarByUserURL: { url: u, updatedAt: updatedAtIso } };
  }
  return {};
}

function migrateProfileFromStorage(p: TrialWorkspaceProfile, updatedAtIso: string): TrialWorkspaceProfile {
  let next: TrialWorkspaceProfile = { ...p };
  const hasUpload = Boolean(next.avatarByUpload);
  const userUrlUnset = next.avatarByUserURL === undefined;
  if (!hasUpload && userUrlUnset && next.avatarUrl.trim()) {
    next = { ...next, ...inferStructuredAvatarsFromLegacyProfileAvatarOnly(next.avatarUrl, updatedAtIso) };
  }
  return finalizeTrialProfile(next);
}

/** Normalizes API / JSON `profile` objects (including server draft GET) into a finalized workspace profile. */
export function buildTrialProfileFromApiProfileJson(
  profile: Record<string, unknown>,
  updatedAtIso: string,
): TrialWorkspaceProfile {
  const base = createEmptyWorkspaceDraft().profile;
  const avatarByUploadParsed =
    profile.avatarByUpload === null ? null : parseTrialAvatarByUploadFromJson(profile.avatarByUpload);
  const avatarByUserURLParsed =
    profile.avatarByUserURL === null ? null : parseTrialAvatarByUserURLFromJson(profile.avatarByUserURL);
  return migrateProfileFromStorage(
    {
      agentName: typeof profile.agentName === "string" ? profile.agentName : "",
      categories: normalizeProfileCategories(profile.categories, profile.category),
      avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : "",
      ...(avatarByUploadParsed === null
        ? { avatarByUpload: null }
        : avatarByUploadParsed
          ? { avatarByUpload: avatarByUploadParsed }
          : {}),
      ...(avatarByUserURLParsed === null
        ? { avatarByUserURL: null }
        : avatarByUserURLParsed
          ? { avatarByUserURL: avatarByUserURLParsed }
          : {}),
      brandColor:
        typeof profile.brandColor === "string" && profile.brandColor.startsWith("#")
          ? profile.brandColor
          : base.brandColor,
      quickLinks: Array.isArray(profile.quickLinks)
        ? profile.quickLinks
            .filter(
              (l): l is TrialProfileQuickLink =>
                l != null &&
                typeof l === "object" &&
                typeof (l as TrialProfileQuickLink).id === "string" &&
                typeof (l as TrialProfileQuickLink).label === "string" &&
                typeof (l as TrialProfileQuickLink).url === "string",
            )
            .slice(0, 12)
        : [],
    },
    updatedAtIso,
  );
}

/** Step 2 — replaces free-form describeAgent (migrated into whatAgentDoes). */
export type TrialWorkspaceBehavior = {
  whatAgentDoes: string;
  tone: string;
  audience: string;
  responseStyle: string;
  exampleResponsibilities: string;
  /** Large “brain” field — synthesis / edge cases */
  additionalGuidance: string;
};

/** After successful Create AI Agent — persisted on server draft. */
export type TrialAgentSnapshot = {
  botId: string;
  slug: string;
  accessKey: string;
  name: string;
  imageUrl?: string;
  allowedDomain: string;
  createdAt: string;
};

/** Server-backed asset metadata (S3 key + display fields). Mirrors Nest onboarding draft API. */
export type TrialWorkspaceUploadedAsset = {
  kind: "avatar" | "knowledge_document";
  assetKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  /** ISO timestamp from API */
  uploadedAt: string;
  url?: string;
};

export type TrialWorkspaceDraftV3 = {
  version: 3;
  profile: TrialWorkspaceProfile;
  behavior: TrialWorkspaceBehavior;
  knowledge: TrialWorkspaceKnowledgePlaceholder;
  allowedWebsite: string;
  /** Extra domains (one per line) allowed for the widget */
  allowedDomainsExtra: string;
  /** User continued past KB shell toward website step */
  knowledgeContinued: boolean;
  /**
   * Highest setup step index (0–3) the user may open. Advances when Next completes a step
   * (or equivalent, e.g. Continue to Go Live). New drafts start at 0 (profile only).
   */
  setupExplicitMaxStepIndex: number;
  /** True after the user has completed step i at least once (Next, Continue to Go Live, or Create AI Agent). */
  setupStepOnceCompleted: [boolean, boolean, boolean, boolean];
  updatedAt: string;
  /** Optional — synced from server draft API */
  uploadedAssets?: TrialWorkspaceUploadedAsset[];
  describeAgent?: string;
  currentStepId?: TrialSetupStepId;
  lastUpdatedStepId?: TrialSetupStepId;
  onboardingCompleted?: boolean;
  /** Present after server-side agent creation */
  trialAgent?: TrialAgentSnapshot;
};

/** Alias for consumers */
export type TrialWorkspaceDraft = TrialWorkspaceDraftV3;

/** Default when starting a new draft or when stored category is empty / unknown. */
export const TRIAL_DEFAULT_PROFILE_CATEGORY = "support";

export const TRIAL_PROFILE_CATEGORIES = [
  { id: "support", title: "Support", description: "Help visitors with questions and issues." },
  { id: "sales", title: "Sales", description: "Qualify leads and move conversations forward." },
  { id: "marketing", title: "Marketing", description: "Campaigns, messaging, and brand touchpoints." },
  { id: "onboarding", title: "Onboarding", description: "Guide new users through setup and first steps." },
  { id: "hr", title: "HR", description: "People, policies, and internal employee questions." },
  { id: "legal", title: "Legal", description: "Compliance-oriented answers and disclaimers." },
  { id: "finance", title: "Finance", description: "Billing, pricing context, and money-related queries." },
  { id: "operations", title: "Operations", description: "Day-to-day processes and coordination." },
  { id: "product", title: "Product", description: "Features, roadmap context, and product education." },
  { id: "education", title: "Education", description: "Teaching, courses, and learning support." },
  { id: "healthcare", title: "Healthcare", description: "Patient-friendly information within your scope." },
  { id: "ecommerce", title: "E-commerce", description: "Orders, catalog, and shopping assistance." },
  { id: "compliance", title: "Compliance", description: "Regulatory and policy-sensitive workflows." },
  { id: "documentation", title: "Documentation", description: "Docs, references, and technical help." },
  { id: "general", title: "General", description: "Broad, flexible—great when your AI Agent handles many kinds of questions." },
] as const;

const VALID_CATEGORY_IDS = new Set<string>(TRIAL_PROFILE_CATEGORIES.map((c) => c.id));

/** Maps legacy category ids and normalizes empty/unknown values. */
export function normalizeProfileCategory(raw: string): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (t && VALID_CATEGORY_IDS.has(t)) return t;
  const legacy: Record<string, string> = {
    booking: "onboarding",
    faq: "documentation",
    other: "general",
  };
  if (t && legacy[t]) return legacy[t];
  if (!t) return TRIAL_DEFAULT_PROFILE_CATEGORY;
  return "general";
}

/** Builds a deduped category list from a new `categories` array and/or legacy single `category` string. */
export function normalizeProfileCategories(categories: unknown, legacyCategory: unknown): string[] {
  const set = new Set<string>();
  if (Array.isArray(categories)) {
    for (const x of categories) {
      if (typeof x !== "string" || !x.trim()) continue;
      set.add(normalizeProfileCategory(x));
    }
  }
  if (typeof legacyCategory === "string" && legacyCategory.trim()) {
    set.add(normalizeProfileCategory(legacyCategory));
  }
  if (set.size === 0) {
    return [TRIAL_DEFAULT_PROFILE_CATEGORY];
  }
  return TRIAL_PROFILE_CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
}

type LegacyV1 = {
  version: 1;
  agentName: string;
  category: string;
  website: string;
  describeAgent: string;
  avatarUrl: string;
  brand: string;
  color: string;
  quickLinks: TrialProfileQuickLink[];
  updatedAt: string;
};

type LegacyV2 = {
  version: 2;
  profile: TrialWorkspaceProfile;
  describeAgent: string;
  knowledge: TrialWorkspaceKnowledgePlaceholder;
  allowedWebsite: string;
  updatedAt: string;
};

function emptyBehavior(): TrialWorkspaceBehavior {
  return {
    whatAgentDoes: "",
    tone: "",
    audience: "",
    responseStyle: "",
    exampleResponsibilities: "",
    additionalGuidance: "",
  };
}

export function createEmptyWorkspaceDraft(): TrialWorkspaceDraftV3 {
  return {
    version: 3,
    profile: finalizeTrialProfile({
      agentName: "",
      categories: [TRIAL_DEFAULT_PROFILE_CATEGORY],
      avatarUrl: "",
      brandColor: "#0d9488",
      quickLinks: [],
    }),
    behavior: emptyBehavior(),
    knowledge: { documents: [], faqs: [], notes: "" },
    allowedWebsite: "",
    allowedDomainsExtra: "",
    knowledgeContinued: false,
    setupExplicitMaxStepIndex: 0,
    setupStepOnceCompleted: [false, false, false, false],
    updatedAt: new Date().toISOString(),
    uploadedAssets: [],
  };
}

function parseLegacyV1(raw: string | null): LegacyV1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<LegacyV1>;
    if (o.version !== 1) return null;
    const base = createEmptyWorkspaceDraft();
    const links = Array.isArray(o.quickLinks)
      ? o.quickLinks
        .filter(
          (l): l is TrialProfileQuickLink =>
            l != null &&
            typeof l === "object" &&
            typeof (l as TrialProfileQuickLink).id === "string" &&
            typeof (l as TrialProfileQuickLink).label === "string" &&
            typeof (l as TrialProfileQuickLink).url === "string",
        )
        .slice(0, 12)
      : [];
    return {
      version: 1,
      agentName: typeof o.agentName === "string" ? o.agentName : "",
      category: typeof o.category === "string" ? o.category : "",
      website: typeof o.website === "string" ? o.website : "",
      describeAgent: typeof o.describeAgent === "string" ? o.describeAgent : "",
      avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : "",
      brand: typeof o.brand === "string" ? o.brand : "",
      color: typeof o.color === "string" ? o.color : "",
      quickLinks: links,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
    };
  } catch {
    return null;
  }
}

function migrateV1ToV3(v1: LegacyV1): TrialWorkspaceDraftV3 {
  const color =
    v1.color?.startsWith("#") && v1.color.length >= 4 ? v1.color : "#0d9488";
  const draft: TrialWorkspaceDraftV3 = {
    version: 3,
    profile: migrateProfileFromStorage(
      {
        agentName: v1.agentName,
        categories: normalizeProfileCategories([], v1.category),
        avatarUrl: v1.avatarUrl,
        brandColor: color,
        quickLinks: v1.quickLinks,
      },
      v1.updatedAt,
    ),
    behavior: {
      whatAgentDoes: v1.describeAgent,
      tone: "",
      audience: "",
      responseStyle: "",
      exampleResponsibilities: "",
      additionalGuidance: "",
    },
    knowledge: { documents: [], faqs: [], notes: "" },
    allowedWebsite: v1.website,
    allowedDomainsExtra: "",
    knowledgeContinued: false,
    setupExplicitMaxStepIndex: 0,
    setupStepOnceCompleted: [false, false, false, false],
    updatedAt: v1.updatedAt,
  };
  const ex = inferExplicitMaxFromDataCompletion(draft);
  const merged = { ...draft, setupExplicitMaxStepIndex: ex };
  return { ...merged, setupStepOnceCompleted: inferSetupStepOnceCompleted(merged) };
}

function migrateV2ToV3(v2: LegacyV2): TrialWorkspaceDraftV3 {
  const k0 = v2.knowledge ?? { documents: [], faqs: [], notes: "" };
  const draft: TrialWorkspaceDraftV3 = {
    version: 3,
    profile: migrateProfileFromStorage(v2.profile, v2.updatedAt),
    behavior: {
      whatAgentDoes: v2.describeAgent,
      tone: "",
      audience: "",
      responseStyle: "",
      exampleResponsibilities: "",
      additionalGuidance: "",
    },
    knowledge: {
      documents: Array.isArray(k0.documents) ? k0.documents : [],
      faqs: parseTrialFaqsFromApi(k0.faqs),
      notes: typeof k0.notes === "string" ? k0.notes : "",
    },
    allowedWebsite: v2.allowedWebsite,
    allowedDomainsExtra: "",
    knowledgeContinued: false,
    setupExplicitMaxStepIndex: 0,
    setupStepOnceCompleted: [false, false, false, false],
    updatedAt: v2.updatedAt,
  };
  const ex = inferExplicitMaxFromDataCompletion(draft);
  const merged = { ...draft, setupExplicitMaxStepIndex: ex };
  return { ...merged, setupStepOnceCompleted: inferSetupStepOnceCompleted(merged) };
}

function parseV2(raw: string | null): LegacyV2 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<LegacyV2>;
    if (o.version !== 2) return null;
    const base = createEmptyWorkspaceDraft();
    const profile =
      o.profile != null && typeof o.profile === "object" && !Array.isArray(o.profile)
        ? (o.profile as Record<string, unknown>)
        : {};
    const k =
      o.knowledge != null && typeof o.knowledge === "object" && !Array.isArray(o.knowledge)
        ? (o.knowledge as Record<string, unknown>)
        : {};
    const pRaw: TrialWorkspaceProfile = {
      agentName: typeof profile.agentName === "string" ? profile.agentName : "",
      categories: normalizeProfileCategories(profile.categories, profile.category),
      avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : "",
      brandColor:
        typeof profile.brandColor === "string" && profile.brandColor.startsWith("#")
          ? profile.brandColor
          : base.profile.brandColor,
      quickLinks: Array.isArray(profile.quickLinks)
        ? profile.quickLinks
            .filter(
              (l): l is TrialProfileQuickLink =>
                l != null &&
                typeof l === "object" &&
                typeof (l as TrialProfileQuickLink).id === "string" &&
                typeof (l as TrialProfileQuickLink).label === "string" &&
                typeof (l as TrialProfileQuickLink).url === "string",
            )
            .slice(0, 12)
        : [],
    };
    return {
      version: 2,
      profile: migrateProfileFromStorage(pRaw, typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt),
      describeAgent: typeof o.describeAgent === "string" ? o.describeAgent : "",
      knowledge: {
        documents: Array.isArray(k.documents) ? k.documents : [],
        faqs: parseTrialFaqsFromApi(k.faqs),
        notes: typeof k.notes === "string" ? k.notes : "",
      },
      allowedWebsite: typeof o.allowedWebsite === "string" ? o.allowedWebsite : "",
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
    };
  } catch {
    return null;
  }
}

function parseV3Json(raw: string | null): TrialWorkspaceDraftV3 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<TrialWorkspaceDraftV3>;
    if (o.version !== 3) return null;
    const base = createEmptyWorkspaceDraft();
    const profile =
      o.profile != null && typeof o.profile === "object" && !Array.isArray(o.profile)
        ? (o.profile as Record<string, unknown>)
        : {};
    const beh =
      o.behavior != null && typeof o.behavior === "object" && !Array.isArray(o.behavior)
        ? (o.behavior as Record<string, unknown>)
        : {};
    const k =
      o.knowledge != null && typeof o.knowledge === "object" && !Array.isArray(o.knowledge)
        ? (o.knowledge as Record<string, unknown>)
        : {};
    const updatedAtForProfile = typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt;
    const draft: TrialWorkspaceDraftV3 = {
      version: 3,
      profile: buildTrialProfileFromApiProfileJson(profile, updatedAtForProfile),
      behavior: {
        whatAgentDoes: typeof beh.whatAgentDoes === "string" ? beh.whatAgentDoes : "",
        tone: typeof beh.tone === "string" ? beh.tone : "",
        audience: typeof beh.audience === "string" ? beh.audience : "",
        responseStyle: typeof beh.responseStyle === "string" ? beh.responseStyle : "",
        exampleResponsibilities:
          typeof beh.exampleResponsibilities === "string" ? beh.exampleResponsibilities : "",
        additionalGuidance: typeof beh.additionalGuidance === "string" ? beh.additionalGuidance : "",
      },
      knowledge: {
        documents: Array.isArray(k.documents) ? k.documents : [],
        faqs: parseTrialFaqsFromApi(k.faqs),
        notes: typeof k.notes === "string" ? k.notes : "",
      },
      allowedWebsite: typeof o.allowedWebsite === "string" ? o.allowedWebsite : "",
      allowedDomainsExtra: typeof o.allowedDomainsExtra === "string" ? o.allowedDomainsExtra : "",
      knowledgeContinued: o.knowledgeContinued === true,
      setupExplicitMaxStepIndex: 0,
      setupStepOnceCompleted: [false, false, false, false],
      updatedAt: updatedAtForProfile,
      uploadedAssets: Array.isArray(o.uploadedAssets) ? (o.uploadedAssets as TrialWorkspaceDraftV3["uploadedAssets"]) : [],
      describeAgent: typeof o.describeAgent === "string" ? o.describeAgent : undefined,
      onboardingCompleted: o.onboardingCompleted === true,
      trialAgent: (() => {
        const ta = o.trialAgent;
        if (ta == null || typeof ta !== "object" || Array.isArray(ta)) return undefined;
        const t = ta as Record<string, unknown>;
        const botId = typeof t.botId === "string" ? t.botId.trim() : "";
        const slug = typeof t.slug === "string" ? t.slug.trim() : "";
        const accessKey = typeof t.accessKey === "string" ? t.accessKey.trim() : "";
        const name = typeof t.name === "string" ? t.name.trim() : "";
        const allowedDomain = typeof t.allowedDomain === "string" ? t.allowedDomain.trim() : "";
        if (!botId || !slug || !accessKey || !name || !allowedDomain) return undefined;
        const snap: TrialAgentSnapshot = {
          botId,
          slug,
          accessKey,
          name,
          allowedDomain,
          createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
        };
        if (typeof t.imageUrl === "string" && t.imageUrl.trim()) snap.imageUrl = t.imageUrl.trim();
        return snap;
      })(),
    };
    const setupExplicitMaxStepIndex =
      typeof o.setupExplicitMaxStepIndex === "number" && !Number.isNaN(o.setupExplicitMaxStepIndex)
        ? Math.min(3, Math.max(0, Math.floor(o.setupExplicitMaxStepIndex)))
        : inferExplicitMaxFromDataCompletion(draft);
    const withEx: TrialWorkspaceDraftV3 = { ...draft, setupExplicitMaxStepIndex };
    const rawOnce = o.setupStepOnceCompleted;
    let setupStepOnceCompleted: [boolean, boolean, boolean, boolean];
    if (Array.isArray(rawOnce) && rawOnce.length === 4 && rawOnce.every((x) => typeof x === "boolean")) {
      const inf = inferSetupStepOnceCompleted(withEx);
      setupStepOnceCompleted = [
        rawOnce[0] === true || inf[0],
        rawOnce[1] === true || inf[1],
        rawOnce[2] === true || inf[2],
        rawOnce[3] === true || inf[3],
      ];
    } else {
      setupStepOnceCompleted = inferSetupStepOnceCompleted(withEx);
    }
    return { ...withEx, setupStepOnceCompleted };
  } catch {
    return null;
  }
}

function withNormalizedProfileCategories(d: TrialWorkspaceDraftV3): TrialWorkspaceDraftV3 {
  const raw = d.profile as TrialWorkspaceProfile & { category?: string };
  const legacy = typeof raw.category === "string" ? raw.category : undefined;
  const next = normalizeProfileCategories(raw.categories, legacy);
  const prev = raw.categories ?? [];
  if (JSON.stringify(next) === JSON.stringify(prev)) return d;
  return {
    ...d,
    profile: finalizeTrialProfile({ ...d.profile, categories: next }),
  };
}

export function readWorkspaceDraftFromLocalStorage(): TrialWorkspaceDraftV3 {
  if (typeof window === "undefined") return createEmptyWorkspaceDraft();
  const raw = localStorage.getItem(TRIAL_WORKSPACE_DRAFT_STORAGE_KEY);
  const v3 = parseV3Json(raw);
  if (v3) return withNormalizedProfileCategories(v3);
  const v2 = parseV2(raw);
  if (v2) return withNormalizedProfileCategories(migrateV2ToV3(v2));
  const v1raw = localStorage.getItem(TRIAL_LEGACY_PROFILE_DRAFT_STORAGE_KEY);
  const v1 = parseLegacyV1(v1raw);
  if (v1) return withNormalizedProfileCategories(migrateV1ToV3(v1));
  return createEmptyWorkspaceDraft();
}

export function writeWorkspaceDraftToLocalStorage(draft: TrialWorkspaceDraftV3): void {
  if (typeof window === "undefined") return;
  try {
    const next: TrialWorkspaceDraftV3 = { ...draft, updatedAt: new Date().toISOString() };
    localStorage.setItem(TRIAL_WORKSPACE_DRAFT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

// —— Setup gating ——

/** Valid CSS hex for profile brand color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA). */
export function isValidProfileBrandColor(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith("#")) return false;
  const h = t.slice(1);
  return /^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(h);
}

export function isSetupProfileComplete(d: TrialWorkspaceDraftV3): boolean {
  const p = d.profile;
  return (
    p.agentName.trim().length > 0 &&
    p.categories.length > 0 &&
    isValidProfileBrandColor(p.brandColor)
  );
}

export function isSetupBehaviorComplete(d: TrialWorkspaceDraftV3): boolean {
  const b = d.behavior;
  return (
    b.whatAgentDoes.trim().length > 0 &&
    b.tone.trim().length > 0 &&
    b.audience.trim().length > 0 &&
    b.responseStyle.trim().length > 0 &&
    b.exampleResponsibilities.trim().length > 0
  );
}

/**
 * Maps the single “describe your agent” textarea into structured behavior fields so
 * {@link isSetupBehaviorComplete} stays satisfied while preserving {@link TrialWorkspaceBehavior.additionalGuidance}.
 */
export function mapUnifiedDescriptionToBehaviorFields(
  raw: string,
  previous: TrialWorkspaceBehavior,
): TrialWorkspaceBehavior {
  const t = raw.trim();
  return {
    ...previous,
    whatAgentDoes: raw.slice(0, 4000),
    tone: t ? raw.slice(0, 200) : "",
    audience: t ? raw.slice(0, 300) : "",
    responseStyle: t ? raw.slice(0, 400) : "",
    exampleResponsibilities: t ? raw.slice(0, 4000) : "",
  };
}

export function isSetupAllowedComplete(d: TrialWorkspaceDraftV3): boolean {
  return d.allowedWebsite.trim().length > 0;
}

/** Re-export for UI and gating (character limits for the Text Snippet field). */
export { TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS, TRIAL_KNOWLEDGE_SNIPPET_MIN_CHARS } from "./trial-utf8-bytes";

/**
 * At least one of: one knowledge file, text ≥ {@link TRIAL_KNOWLEDGE_SNIPPET_MIN_CHARS} trimmed characters
 * (within max character count), or one Q&A pair with both question and answer.
 */
export function isKnowledgeBaseMinimumContentMet(d: TrialWorkspaceDraftV3): boolean {
  const hasDoc = (d.uploadedAssets ?? []).some((a) => a.kind === "knowledge_document");
  if (hasDoc) return true;
  const notes = d.knowledge.notes ?? "";
  const t = notes.trim();
  if (
    t.length >= TRIAL_KNOWLEDGE_SNIPPET_MIN_CHARS &&
    notes.length <= TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS
  ) {
    return true;
  }
  return (d.knowledge.faqs ?? []).some(
    (f) => f.question.trim().length > 0 && f.answer.trim().length > 0,
  );
}

/** Data-only fallback for migrating drafts that predate `setupExplicitMaxStepIndex`. */
function inferExplicitMaxFromDataCompletion(d: TrialWorkspaceDraftV3): number {
  if (!isSetupProfileComplete(d)) return 0;
  if (!isSetupBehaviorComplete(d)) return 1;
  if (!d.knowledgeContinued) return 2;
  if (!isSetupAllowedComplete(d)) return 3;
  return 3;
}

/** Best-effort when `setupStepOnceCompleted` is missing (explicit max + go-live URL). */
function inferSetupStepOnceCompleted(d: TrialWorkspaceDraftV3): [boolean, boolean, boolean, boolean] {
  const ex = d.setupExplicitMaxStepIndex ?? 0;
  return [ex > 0, ex > 1, ex > 2, isSetupAllowedComplete(d) && ex >= 3];
}

/**
 * Highest setup step index (0–3) the user may open — driven by `setupExplicitMaxStepIndex`
 * (advances when the user completes a step via Next / Continue). Falls back to data-only
 * inference for legacy blobs missing the field.
 */
export function maxUnlockedSetupStepIndex(d: TrialWorkspaceDraftV3): number {
  if (typeof d.setupExplicitMaxStepIndex === "number" && !Number.isNaN(d.setupExplicitMaxStepIndex)) {
    return Math.min(3, Math.max(0, Math.floor(d.setupExplicitMaxStepIndex)));
  }
  return inferExplicitMaxFromDataCompletion(d);
}

/** True when all four setup steps are satisfied (ready for agent creation / Prompt 6). */
export function isTrialOnboardingComplete(d: TrialWorkspaceDraftV3): boolean {
  return (
    isSetupProfileComplete(d) &&
    isSetupBehaviorComplete(d) &&
    d.knowledgeContinued &&
    isSetupAllowedComplete(d)
  );
}

export function isSetupStepComplete(stepIndex: number, d: TrialWorkspaceDraftV3): boolean {
  switch (stepIndex) {
    case 0:
      return isSetupProfileComplete(d);
    case 1:
      return isSetupBehaviorComplete(d);
    case 2:
      return d.knowledgeContinued && isKnowledgeBaseMinimumContentMet(d);
    case 3:
      return isSetupAllowedComplete(d);
    default:
      return false;
  }
}

/** First setup step index (0–3) that is not complete, or `null` if all four steps are done. */
export function getFirstIncompleteSetupStepIndex(d: TrialWorkspaceDraftV3): number | null {
  for (let i = 0; i < 4; i++) {
    if (!isSetupStepComplete(i, d)) return i;
  }
  return null;
}

/**
 * Visual segment for the setup rail (vertical stepper nodes, horizontal onboarding card bars).
 * Mirrors `SetupTimelineRow` in `trial-onboarding-stepper.tsx` — keep in sync when changing rail UX.
 */
export type TrialSetupRailSegment = "done" | "error" | "teal" | "muted";

export function getTrialSetupRailSegment(
  index: number,
  d: TrialWorkspaceDraftV3,
  opts: { hydrated: boolean },
): TrialSetupRailSegment {
  const { hydrated } = opts;
  const maxUnlocked = maxUnlockedSetupStepIndex(d);
  const locked = index > maxUnlocked;
  const complete = isSetupStepComplete(index, d);
  const requiredStepIndex = hydrated ? getFirstIncompleteSetupStepIndex(d) : null;
  const required = requiredStepIndex !== null && index === requiredStepIndex && !complete;
  const explicitMax = d.setupExplicitMaxStepIndex ?? 0;
  const isLatestUnlocked = index === explicitMax;
  const showRedRegression =
    d.setupStepOnceCompleted[index] === true && !complete && !isLatestUnlocked;
  const isLatestFrontierIncomplete = isLatestUnlocked && !complete && !locked;
  const showTealNext =
    !showRedRegression && !locked && (required || isLatestFrontierIncomplete);

  if (complete) return "done";
  if (showRedRegression) return "error";
  if (showTealNext) return "teal";
  return "muted"; // locked, quiet unlocked, or pre-hydration edge (neutral node in stepper)
}

/**
 * Short hint for why a setup step blocks progress (empty string if the step is complete).
 */
export function getSetupStepIssueMessage(stepIndex: number, d: TrialWorkspaceDraftV3): string {
  if (isSetupStepComplete(stepIndex, d)) return "";
  switch (stepIndex) {
    case 0: {
      const p = d.profile;
      if (!p.agentName.trim()) return "Agent name is missing";
      if (p.categories.length === 0) return "Choose at least one category.";
      if (!isValidProfileBrandColor(p.brandColor)) {
        return p.brandColor.trim() === "" ? "Choose a brand color." : "Enter a valid hex brand color.";
      }
      return "Complete identity & branding.";
    }
    case 1:
      return "Agent description is missing";
    case 2: {
      if (!isKnowledgeBaseMinimumContentMet(d)) {
        return `Add at least one file, at least 200 characters of notes (up to ${TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS.toLocaleString()} characters), or one Q&A pair with both a question and an answer.`;
      }
      if (!d.knowledgeContinued) {
        return "Use Go Live below to continue.";
      }
      return "";
    }
    case 3:
      return "Add the main website where people will chat with your AI Agent.";
    default:
      return "Complete this step to continue.";
  }
}

/** Why Create AI Agent is disabled — same as the first incomplete step message. */
export function getTrialOnboardingIssueMessage(d: TrialWorkspaceDraftV3): string {
  if (isTrialOnboardingComplete(d)) return "";
  const first = getFirstIncompleteSetupStepIndex(d);
  if (first !== null) return getSetupStepIssueMessage(first, d);
  return "Complete all setup steps.";
}

/**
 * True if a step was completed at least once and is now invalid, **excluding** the latest-unlocked
 * step index (frontier) — that row stays teal, not red, in the stepper.
 */
export function hasSetupRegressionIssue(d: TrialWorkspaceDraftV3): boolean {
  const ex = d.setupExplicitMaxStepIndex ?? 0;
  for (let i = 0; i < 4; i++) {
    if (i === ex) continue;
    if (d.setupStepOnceCompleted[i] && !isSetupStepComplete(i, d)) return true;
  }
  return false;
}

export type TrialSetupStepId = "profile" | "describe-agent" | "knowledge-base" | "go-live";

export type TrialSetupStepConfig = {
  id: TrialSetupStepId;
  /** Primary label in the left rail */
  label: string;
  /** Muted line under the title */
  navSubtitle: string;
  path: string;
  /** Info (?) popover body */
  infoBody: string;
  /** Extra guidance shown only under the active step (expandable rail) */
  expandedGuidance: string;
  /** Right pane heading */
  editorTitle: string;
  /** Right pane subheading */
  editorDescription: string;
};

export const TRIAL_SETUP_STEPS: TrialSetupStepConfig[] = [
  {
    id: "profile",
    label: "Profile",
    navSubtitle: "Name, look & feel",
    path: "/trial/dashboard/setup/profile",
    infoBody:
      "This is how your AI Agent shows up to visitors—name, categories, color, and optional links. Getting this right helps people recognize and trust it before they even start a conversation.",
    expandedGuidance:
      "Take a minute to choose a clear name and a color that fits your brand. You can adjust these details anytime before you go live.",
    editorTitle: "Your AI Agent’s profile",
    editorDescription:
      "Define how your AI Agent looks and is recognized—name, categories, brand color, avatar, and shortcuts to pages you want people to find easily.",
  },
  {
    id: "describe-agent",
    label: "Describe Your AI Agent",
    navSubtitle: "What it helps people with",
    path: "/trial/dashboard/setup/describe-your-agent",
    infoBody:
      "Tell us what your AI Agent should do for visitors day to day. The clearer you are here, the easier it is to shape helpful, on-brand answers in the next steps.",
    expandedGuidance:
      "Include what topics you cover, the tone you want, and what should happen when something is outside your scope (for example, offering a human handoff).",
    editorTitle: "Describe your AI Agent",
    editorDescription:
      "In your own words, explain what your AI Agent should help visitors with—topics, tone, audience, and what “great” looks like when it replies.",
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    navSubtitle: "Text snippets, Q&A & files",
    path: "/trial/dashboard/setup/knowledge-base",
    infoBody:
      "A text snippet is anything you want your AI Agent to remember. Q&A pairs are common questions with answers you’re happy to repeat. Files are documents it can learn from. Capture what matters most for your brand and your visitors.",
    expandedGuidance:
      "Start with a short text snippet, a clear Q&A pair, or a file you already have (for example a PDF or policy)—that gives your AI concrete material to learn from.",
    editorTitle: "Knowledge base",
    editorDescription:
      "Give your AI a knowledge base to train on—upload files, add a text snippet, or define Q&A using the tabs below.",
  },
  {
    id: "go-live",
    label: "Go Live",
    navSubtitle: "Where your AI Agent appears",
    path: "/trial/dashboard/setup/go-live",
    infoBody:
      "Enter the main website address where people will use your AI Agent—usually the homepage or app URL visitors already know. We use this so your AI Agent only appears on sites you trust.",
    expandedGuidance:
      "Use the same address people type in their browser (for example https://www.yoursite.com). You can add extra sites or subdomains later if you need them.",
    editorTitle: "Go live",
    editorDescription:
      "Choose the website where visitors will chat with your AI Agent. Add your main address first; you can include more places your brand shows up when you’re ready.",
  },
];

export function getTrialSetupStepConfig(stepId: TrialSetupStepId): TrialSetupStepConfig {
  const c = TRIAL_SETUP_STEPS.find((s) => s.id === stepId);
  if (!c) throw new Error(`Unknown setup step: ${stepId}`);
  return c;
}

export function getTrialSetupStepIndex(stepId: TrialSetupStepId): number {
  return TRIAL_SETUP_STEPS.findIndex((s) => s.id === stepId);
}

/** Maps URL to setup step. Legacy URLs are not listed — use redirects on those routes. */
export function setupStepIdFromPathname(pathname: string): TrialSetupStepId | null {
  if (pathname.includes("/setup/profile")) return "profile";
  if (pathname.includes("/setup/describe-your-agent")) return "describe-agent";
  if (pathname.includes("/setup/knowledge-base")) return "knowledge-base";
  if (pathname.includes("/setup/go-live")) return "go-live";
  return null;
}
