import type { TrialOnboardingAssetMeta, TrialOnboardingQuickLink } from '../models/trial-onboarding-draft.schema';
import { buildTrialProfileAvatarApiPayload } from './trial-avatar-resolve.util';
import {
  TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS,
  TRIAL_MAX_FAQ_ITEMS,
  TRIAL_MAX_KNOWLEDGE_DOCUMENTS,
  TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES,
  TRIAL_MAX_KNOWLEDGE_FILE_BYTES,
} from './trial-knowledge-limits';

export const TRIAL_ONBOARDING_DEFAULT_BRAND_COLOR = '#0d9488';
export const TRIAL_ONBOARDING_DEFAULT_CATEGORY = 'support';

export const TRIAL_SETUP_STEP_IDS = [
  'profile',
  'describe-agent',
  'knowledge-base',
  'go-live',
] as const;

export type TrialSetupStepId = (typeof TRIAL_SETUP_STEP_IDS)[number];

const MAX_AGENT_NAME = 200;
const MAX_COLOR = 32;
const MAX_WEBSITE = 2000;
const MAX_EXTRA_DOMAINS = 8000;
const MAX_DESCRIBE = 20000;
const MAX_QUICK_LINKS = 12;
const MAX_CATEGORIES = 24;
const MAX_ASSETS = 40;
const MAX_BEHAVIOR_FIELD = 12000;
/** Max character length for `knowledge.notes`, aligned with landing trial textarea `maxLength`. */
const MAX_KNOWLEDGE_NOTES_CHARS = TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS;
const MAX_FAQ_ITEMS = TRIAL_MAX_FAQ_ITEMS;
const MAX_FAQ_QUESTION = 2000;
const MAX_FAQ_ANSWER = 8000;
const MAX_FAQ_ID = 80;

export type TrialAvatarByUploadApi = {
  url: string;
  assetKey?: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  updatedAt: string;
};

export type TrialAvatarByUserURLApi = {
  url: string;
  updatedAt: string;
};

export type TrialAgentSnapshotApi = {
  botId: string;
  slug: string;
  accessKey: string;
  name: string;
  imageUrl?: string;
  allowedDomain: string;
  createdAt: string;
};

export type TrialWorkspaceDraftV3Api = {
  version: 3;
  profile: {
    agentName: string;
    categories: string[];
    /** Resolved from latest of {@link avatarByUpload} vs {@link avatarByUserURL} (and legacy read heuristics). */
    avatarUrl: string;
    avatarByUpload?: TrialAvatarByUploadApi;
    avatarByUserURL?: TrialAvatarByUserURLApi;
    brandColor: string;
    quickLinks: Array<{ id: string; label: string; url: string }>;
  };
  behavior: {
    whatAgentDoes: string;
    tone: string;
    audience: string;
    responseStyle: string;
    exampleResponsibilities: string;
    additionalGuidance: string;
  };
  knowledge: { documents: unknown[]; faqs: unknown[]; notes: string };
  allowedWebsite: string;
  allowedDomainsExtra: string;
  knowledgeContinued: boolean;
  setupExplicitMaxStepIndex: number;
  setupStepOnceCompleted: [boolean, boolean, boolean, boolean];
  currentStepId?: string;
  lastUpdatedStepId?: string;
  onboardingCompleted?: boolean;
  /** Optional legacy / free-form field stored server-side */
  describeAgent?: string;
  uploadedAssets: Array<{
    kind: 'avatar' | 'knowledge_document';
    assetKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    url?: string;
  }>;
  /** Present after successful Create AI Agent — unlocks playground. */
  trialAgent?: TrialAgentSnapshotApi;
  updatedAt: string;
};

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function isStepId(v: string): v is TrialSetupStepId {
  return (TRIAL_SETUP_STEP_IDS as readonly string[]).includes(v);
}

function emptyBehavior(): TrialWorkspaceDraftV3Api['behavior'] {
  return {
    whatAgentDoes: '',
    tone: '',
    audience: '',
    responseStyle: '',
    exampleResponsibilities: '',
    additionalGuidance: '',
  };
}

function normalizeCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [TRIAL_ONBOARDING_DEFAULT_CATEGORY];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || !x.trim()) continue;
    out.push(x.trim().slice(0, 64));
    if (out.length >= MAX_CATEGORIES) break;
  }
  return out.length ? out : [TRIAL_ONBOARDING_DEFAULT_CATEGORY];
}

function normalizeQuickLinks(raw: unknown): TrialOnboardingQuickLink[] {
  if (!Array.isArray(raw)) return [];
  const out: TrialOnboardingQuickLink[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = trimStr(o.id, 80);
    const label = trimStr(o.label, 200);
    const url = trimStr(o.url, 2000);
    if (!id || !label || !url) continue;
    out.push({ id, label, url });
    if (out.length >= MAX_QUICK_LINKS) break;
  }
  return out;
}

function normalizeBehavior(raw: unknown): TrialWorkspaceDraftV3Api['behavior'] {
  const base = emptyBehavior();
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    whatAgentDoes: trimStr(o.whatAgentDoes, MAX_BEHAVIOR_FIELD),
    tone: trimStr(o.tone, MAX_BEHAVIOR_FIELD),
    audience: trimStr(o.audience, MAX_BEHAVIOR_FIELD),
    responseStyle: trimStr(o.responseStyle, MAX_BEHAVIOR_FIELD),
    exampleResponsibilities: trimStr(o.exampleResponsibilities, MAX_BEHAVIOR_FIELD),
    additionalGuidance: trimStr(o.additionalGuidance, MAX_BEHAVIOR_FIELD),
  };
}

/** Structured FAQ rows for trial KB — consumed later by ingestion (6.1). */
export function normalizeKnowledgeFaqs(raw: unknown): Array<{ id: string; question: string; answer: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; question: string; answer: string }> = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = trimStr(o.id, MAX_FAQ_ID);
    const question = trimStr(o.question, MAX_FAQ_QUESTION);
    const answer = trimStr(o.answer, MAX_FAQ_ANSWER);
    if (!id) continue;
    if (!question.trim() && !answer.trim()) continue;
    out.push({ id, question, answer });
    if (out.length >= MAX_FAQ_ITEMS) break;
  }
  return out;
}

function normalizeKnowledge(raw: unknown): TrialWorkspaceDraftV3Api['knowledge'] {
  const base = { documents: [] as unknown[], faqs: [] as unknown[], notes: '' };
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    documents: Array.isArray(o.documents) ? o.documents.slice(0, 500) : [],
    faqs: normalizeKnowledgeFaqs(o.faqs),
    notes: trimStr(o.notes, MAX_KNOWLEDGE_NOTES_CHARS),
  };
}

function normalizeSetupFlags(raw: unknown): [boolean, boolean, boolean, boolean] {
  const base: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  if (!Array.isArray(raw)) return base;
  for (let i = 0; i < 4; i++) {
    base[i] = Boolean(raw[i]);
  }
  return base;
}

/** Drops excess knowledge docs and enforces per-file and combined size caps (legacy / tampered payloads). */
function clampTrialUploadedAssetsForKnowledgeLimits(assets: TrialOnboardingAssetMeta[]): TrialOnboardingAssetMeta[] {
  const avatars = assets.filter((a) => a.kind === 'avatar');
  const knowledgeInOrder = assets.filter((a) => a.kind === 'knowledge_document');
  const keptAvatar = avatars.slice(-1);
  const underPerFile = knowledgeInOrder.filter((a) => a.sizeBytes <= TRIAL_MAX_KNOWLEDGE_FILE_BYTES);
  let keptKb = underPerFile.slice(0, TRIAL_MAX_KNOWLEDGE_DOCUMENTS);
  let sum = keptKb.reduce((s, a) => s + a.sizeBytes, 0);
  while (sum > TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES && keptKb.length > 0) {
    keptKb = keptKb.slice(0, -1);
    sum = keptKb.reduce((s, a) => s + a.sizeBytes, 0);
  }
  return [...keptAvatar, ...keptKb];
}

function normalizeUploadedAssets(raw: unknown): TrialOnboardingAssetMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: TrialOnboardingAssetMeta[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind === 'avatar' || o.kind === 'knowledge_document' ? o.kind : null;
    if (!kind) continue;
    const assetKey = trimStr(o.assetKey, 1024);
    const originalFilename = trimStr(o.originalFilename, 500);
    const mimeType = trimStr(o.mimeType, 200);
    const sizeRaw = o.sizeBytes;
    const maxStored =
      kind === 'knowledge_document'
        ? TRIAL_MAX_KNOWLEDGE_FILE_BYTES
        : 5_000_000_000;
    const sizeBytes =
      typeof sizeRaw === 'number' && Number.isFinite(sizeRaw) && sizeRaw >= 0
        ? Math.min(Math.floor(sizeRaw), maxStored)
        : 0;
    let uploadedAt: Date;
    if (o.uploadedAt instanceof Date) {
      uploadedAt = o.uploadedAt;
    } else if (typeof o.uploadedAt === 'string' && o.uploadedAt.trim()) {
      const d = new Date(o.uploadedAt);
      uploadedAt = Number.isNaN(d.getTime()) ? new Date() : d;
    } else {
      uploadedAt = new Date();
    }
    const url = trimStr(o.url, 4000);
    if (!assetKey || !originalFilename || !mimeType) continue;
    out.push({
      kind,
      assetKey,
      originalFilename,
      mimeType,
      sizeBytes,
      uploadedAt,
      ...(url ? { url } : {}),
    });
    if (out.length >= MAX_ASSETS) break;
  }
  return clampTrialUploadedAssetsForKnowledgeLimits(out);
}

function parseDateForAvatar(v: unknown): Date | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** Returns Mongo subdoc for `$set`, or `null` to `$unset`, or `undefined` to skip. */
function normalizeAvatarByUploadPatch(raw: unknown): Record<string, unknown> | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = trimStr(o.url, 2000);
  if (!url) return undefined;
  const updatedAt = parseDateForAvatar(o.updatedAt) ?? new Date();
  const out: Record<string, unknown> = { url, updatedAt };
  const ak = trimStr(o.assetKey, 1024);
  if (ak) out.assetKey = ak;
  const of = trimStr(o.originalFilename, 500);
  if (of) out.originalFilename = of;
  const mt = trimStr(o.mimeType, 200);
  if (mt) out.mimeType = mt;
  const sz = o.sizeBytes;
  if (typeof sz === 'number' && Number.isFinite(sz) && sz >= 0) {
    out.sizeBytes = Math.min(Math.floor(sz), 5_000_000_000);
  }
  return out;
}

function normalizeAvatarByUserURLPatch(raw: unknown): Record<string, unknown> | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = trimStr(o.url, 2000);
  if (!url) return undefined;
  const updatedAt = parseDateForAvatar(o.updatedAt) ?? new Date();
  return { url, updatedAt };
}

export type TrialOnboardingDraftPatchMongo = {
  set: Record<string, unknown>;
  unset?: Record<string, ''>;
};

/** Maps a Mongo lean document into the v3 API shape returned to the landing server. */
export function trialOnboardingDraftDocToApi(
  doc: Record<string, unknown> | null | undefined,
  updatedAt: Date,
): TrialWorkspaceDraftV3Api {
  const d = doc ?? {};
  const behavior = normalizeBehavior(d.behavior);
  const knowledge = normalizeKnowledge(d.knowledge);
  const categories = normalizeCategories(d.categories);
  const quickLinks = normalizeQuickLinks(d.quickLinks);
  const av = buildTrialProfileAvatarApiPayload(d);

  return {
    version: 3,
    profile: {
      agentName: trimStr(d.agentName, MAX_AGENT_NAME),
      categories,
      avatarUrl: av.avatarUrl,
      ...(av.avatarByUpload ? { avatarByUpload: av.avatarByUpload } : {}),
      ...(av.avatarByUserURL ? { avatarByUserURL: av.avatarByUserURL } : {}),
      brandColor: trimStr(d.brandColor, MAX_COLOR) || TRIAL_ONBOARDING_DEFAULT_BRAND_COLOR,
      quickLinks,
    },
    behavior,
    knowledge,
    allowedWebsite: trimStr(d.allowedWebsite, MAX_WEBSITE),
    allowedDomainsExtra: trimStr(d.allowedDomainsExtra, MAX_EXTRA_DOMAINS),
    knowledgeContinued: Boolean(d.knowledgeContinued),
    setupExplicitMaxStepIndex: (() => {
      const n = d.setupExplicitMaxStepIndex;
      if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(3, Math.floor(n)));
    })(),
    setupStepOnceCompleted: normalizeSetupFlags(d.setupStepOnceCompleted),
    currentStepId: (() => {
      const s = trimStr(d.currentStepId, 64);
      return s && isStepId(s) ? s : undefined;
    })(),
    lastUpdatedStepId: (() => {
      const s = trimStr(d.lastUpdatedStepId, 64);
      return s && isStepId(s) ? s : undefined;
    })(),
    onboardingCompleted: Boolean(d.onboardingCompleted),
    describeAgent: trimStr(d.describeAgent, MAX_DESCRIBE) || undefined,
    uploadedAssets: normalizeUploadedAssets(d.uploadedAssets).map((a) => ({
      kind: a.kind,
      assetKey: a.assetKey,
      originalFilename: a.originalFilename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      uploadedAt: (a.uploadedAt instanceof Date ? a.uploadedAt : new Date(a.uploadedAt as unknown as string)).toISOString(),
      ...(a.url ? { url: a.url } : {}),
    })),
    trialAgent: (() => {
      const ta = d.trialAgent;
      if (ta == null || typeof ta !== 'object' || Array.isArray(ta)) return undefined;
      const o = ta as Record<string, unknown>;
      const botId = trimStr(o.botId, 40);
      const slug = trimStr(o.slug, 200);
      const accessKey = trimStr(o.accessKey, 120);
      const name = trimStr(o.name, 200);
      const allowedDomain = trimStr(o.allowedDomain, 500);
      if (!botId || !slug || !accessKey || !name || !allowedDomain) return undefined;
      let createdAt = '';
      if (o.createdAt instanceof Date) createdAt = o.createdAt.toISOString();
      else if (typeof o.createdAt === 'string') createdAt = o.createdAt;
      return {
        botId,
        slug,
        accessKey,
        name,
        allowedDomain,
        ...(trimStr(o.imageUrl, 2000) ? { imageUrl: trimStr(o.imageUrl, 2000) } : {}),
        createdAt: createdAt || new Date().toISOString(),
      };
    })(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function createEmptyTrialOnboardingDraftMongoFields(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    categories: [TRIAL_ONBOARDING_DEFAULT_CATEGORY],
    quickLinks: [],
    behavior: emptyBehavior(),
    knowledge: { documents: [], faqs: [], notes: '' },
    brandColor: TRIAL_ONBOARDING_DEFAULT_BRAND_COLOR,
    setupStepOnceCompleted: [false, false, false, false],
    setupExplicitMaxStepIndex: 0,
    knowledgeContinued: false,
    onboardingCompleted: false,
    uploadedAssets: [],
  };
}

/**
 * Parses a PATCH body from the landing server into sanitized Mongo updates.
 * Unknown keys are ignored.
 */
export function parseTrialOnboardingDraftPatch(body: unknown): TrialOnboardingDraftPatchMongo {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { set: {} };
  }
  const o = body as Record<string, unknown>;
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};

  if ('profile' in o && o.profile != null && typeof o.profile === 'object' && !Array.isArray(o.profile)) {
    const p = o.profile as Record<string, unknown>;
    if ('agentName' in p) set.agentName = trimStr(p.agentName, MAX_AGENT_NAME);
    if ('categories' in p) set.categories = normalizeCategories(p.categories);
    if ('brandColor' in p) {
      const c = trimStr(p.brandColor, MAX_COLOR);
      if (c) set.brandColor = c;
    }
    if ('quickLinks' in p) set.quickLinks = normalizeQuickLinks(p.quickLinks);
    if ('avatarUrl' in p) set.avatarUrl = trimStr(p.avatarUrl, 2000);
    if ('avatarByUpload' in p) {
      const n = normalizeAvatarByUploadPatch(p.avatarByUpload);
      if (n === null) {
        unset.avatarByUpload = '';
        set.avatarUrl = '';
      } else if (n) set.avatarByUpload = n;
    }
    if ('avatarByUserURL' in p) {
      const n = normalizeAvatarByUserURLPatch(p.avatarByUserURL);
      if (n === null) {
        unset.avatarByUserURL = '';
        set.avatarUrl = '';
      } else if (n) set.avatarByUserURL = n;
    }
  }

  if ('behavior' in o) {
    if (o.behavior === null) {
      set.behavior = emptyBehavior();
    } else {
      set.behavior = normalizeBehavior(o.behavior);
    }
  }

  if ('knowledge' in o) {
    if (o.knowledge === null) {
      set.knowledge = { documents: [], faqs: [], notes: '' };
    } else {
      set.knowledge = normalizeKnowledge(o.knowledge);
    }
  }

  if ('describeAgent' in o) set.describeAgent = trimStr(o.describeAgent, MAX_DESCRIBE);

  if ('allowedWebsite' in o) set.allowedWebsite = trimStr(o.allowedWebsite, MAX_WEBSITE);
  if ('allowedDomainsExtra' in o) set.allowedDomainsExtra = trimStr(o.allowedDomainsExtra, MAX_EXTRA_DOMAINS);
  if ('knowledgeContinued' in o) set.knowledgeContinued = Boolean(o.knowledgeContinued);

  if ('setupExplicitMaxStepIndex' in o) {
    const n = o.setupExplicitMaxStepIndex;
    if (typeof n === 'number' && Number.isFinite(n)) {
      set.setupExplicitMaxStepIndex = Math.max(0, Math.min(3, Math.floor(n)));
    }
  }

  if ('setupStepOnceCompleted' in o) {
    set.setupStepOnceCompleted = normalizeSetupFlags(o.setupStepOnceCompleted);
  }

  if ('currentStepId' in o) {
    const s = trimStr(o.currentStepId, 64);
    if (s && isStepId(s)) set.currentStepId = s;
  }

  if ('lastUpdatedStepId' in o) {
    const s = trimStr(o.lastUpdatedStepId, 64);
    if (s && isStepId(s)) set.lastUpdatedStepId = s;
  }

  if ('onboardingCompleted' in o) set.onboardingCompleted = Boolean(o.onboardingCompleted);

  if ('uploadedAssets' in o) {
    set.uploadedAssets = normalizeUploadedAssets(o.uploadedAssets);
  }

  return Object.keys(unset).length > 0 ? { set, unset } : { set };
}
