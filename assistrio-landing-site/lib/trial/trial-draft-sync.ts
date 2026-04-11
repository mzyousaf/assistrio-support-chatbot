import {
  buildTrialProfileFromApiProfileJson,
  createEmptyWorkspaceDraft,
  type TrialAgentSnapshot,
  type TrialSetupStepId,
  type TrialWorkspaceDraftV3,
  type TrialWorkspaceUploadedAsset,
} from "@/lib/trial/trial-workspace-draft";
import { parseTrialFaqsFromApi } from "@/lib/trial/trial-knowledge-normalize";

const STEP_ID_SET = new Set<string>(["profile", "describe-agent", "knowledge-base", "go-live"]);

function parseStepId(raw: unknown): TrialSetupStepId | undefined {
  if (typeof raw !== "string") return undefined;
  return STEP_ID_SET.has(raw) ? (raw as TrialSetupStepId) : undefined;
}

function parseUploadedAssetsFromApi(raw: unknown): TrialWorkspaceUploadedAsset[] {
  if (!Array.isArray(raw)) return [];
  const out: TrialWorkspaceUploadedAsset[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind === "avatar" || o.kind === "knowledge_document" ? o.kind : null;
    const assetKey = typeof o.assetKey === "string" ? o.assetKey : "";
    const originalFilename = typeof o.originalFilename === "string" ? o.originalFilename : "";
    const mimeType = typeof o.mimeType === "string" ? o.mimeType : "";
    const sizeBytes =
      typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes) ? Math.max(0, Math.floor(o.sizeBytes)) : 0;
    const uploadedAt = typeof o.uploadedAt === "string" ? o.uploadedAt : "";
    if (!kind || !assetKey || !originalFilename || !mimeType || !uploadedAt) continue;
    const u: TrialWorkspaceUploadedAsset = {
      kind,
      assetKey,
      originalFilename,
      mimeType,
      sizeBytes,
      uploadedAt,
    };
    if (typeof o.url === "string" && o.url.trim()) u.url = o.url;
    out.push(u);
    if (out.length >= 40) break;
  }
  return out;
}

/** Set after a one-time localStorage → server migration so we never overwrite server with stale LS again. */
export const TRIAL_DRAFT_LS_MIGRATION_DONE_KEY = "assistrio_trial_draft_ls_migrated_to_server_v1";

const STEP_IDS: TrialSetupStepId[] = ["profile", "describe-agent", "knowledge-base", "go-live"];

export function apiDraftJsonToTrialWorkspaceDraftV3(raw: unknown): TrialWorkspaceDraftV3 {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyWorkspaceDraft();
  }
  const o = raw as Record<string, unknown>;
  const base = createEmptyWorkspaceDraft();
  const profile =
    o.profile != null && typeof o.profile === "object" && !Array.isArray(o.profile)
      ? (o.profile as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const beh =
    o.behavior != null && typeof o.behavior === "object" && !Array.isArray(o.behavior)
      ? (o.behavior as Record<string, unknown>)
      : {};
  const k =
    o.knowledge != null && typeof o.knowledge === "object" && !Array.isArray(o.knowledge)
      ? (o.knowledge as Record<string, unknown>)
      : {};

  const uploadedAssets = parseUploadedAssetsFromApi(o.uploadedAssets);

  const setupStepOnceCompleted = Array.isArray(o.setupStepOnceCompleted)
    ? ([0, 1, 2, 3].map((i) => Boolean((o.setupStepOnceCompleted as unknown[])[i])) as [
        boolean,
        boolean,
        boolean,
        boolean,
      ])
    : base.setupStepOnceCompleted;

  const setupExplicitMaxStepIndex =
    typeof o.setupExplicitMaxStepIndex === "number" && !Number.isNaN(o.setupExplicitMaxStepIndex)
      ? Math.min(3, Math.max(0, Math.floor(o.setupExplicitMaxStepIndex)))
      : base.setupExplicitMaxStepIndex;

  const updatedAtIso = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();
  const profileFromApi = buildTrialProfileFromApiProfileJson(profile, updatedAtIso);

  return {
    version: 3,
    profile: profileFromApi,
    behavior: {
      whatAgentDoes: typeof beh.whatAgentDoes === "string" ? beh.whatAgentDoes : "",
      tone: typeof beh.tone === "string" ? beh.tone : "",
      audience: typeof beh.audience === "string" ? beh.audience : "",
      responseStyle: typeof beh.responseStyle === "string" ? beh.responseStyle : "",
      exampleResponsibilities: typeof beh.exampleResponsibilities === "string" ? beh.exampleResponsibilities : "",
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
    setupExplicitMaxStepIndex,
    setupStepOnceCompleted,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    uploadedAssets,
    describeAgent: typeof o.describeAgent === "string" ? o.describeAgent : undefined,
    currentStepId: parseStepId(o.currentStepId),
    lastUpdatedStepId: parseStepId(o.lastUpdatedStepId),
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
}

/** True when the server draft has no meaningful user-entered progress (safe to migrate local over). */
export function isServerDraftDefaultForMigration(d: TrialWorkspaceDraftV3): boolean {
  const p = d.profile;
  const b = d.behavior;
  const hasText =
    p.agentName.trim().length > 0 ||
    p.quickLinks.length > 0 ||
    b.whatAgentDoes.trim().length > 0 ||
    b.tone.trim().length > 0 ||
    b.audience.trim().length > 0 ||
    b.responseStyle.trim().length > 0 ||
    b.exampleResponsibilities.trim().length > 0 ||
    b.additionalGuidance.trim().length > 0 ||
    d.knowledge.notes.trim().length > 0 ||
    d.allowedWebsite.trim().length > 0 ||
    d.allowedDomainsExtra.trim().length > 0;

  const hasProgress =
    d.knowledgeContinued ||
    (d.setupExplicitMaxStepIndex ?? 0) > 0 ||
    d.setupStepOnceCompleted.some(Boolean) ||
    (d.uploadedAssets?.length ?? 0) > 0 ||
    d.onboardingCompleted === true;

  return !hasText && !hasProgress;
}

/** True when local draft clearly has more user work than an empty default. */
export function hasMeaningfulLocalProgress(d: TrialWorkspaceDraftV3): boolean {
  return !isServerDraftDefaultForMigration(d);
}

/** Full PATCH body to migrate local-only state to the server (one-time). */
export function buildFullMigrationPatchFromDraft(d: TrialWorkspaceDraftV3): Record<string, unknown> {
  const p = d.profile;
  return {
    profile: {
      agentName: p.agentName,
      categories: p.categories,
      brandColor: p.brandColor,
      quickLinks: p.quickLinks,
      ...(p.avatarByUpload != null ? { avatarByUpload: p.avatarByUpload } : {}),
      ...(p.avatarByUserURL !== undefined
        ? { avatarByUserURL: p.avatarByUserURL === null ? null : p.avatarByUserURL }
        : {}),
      ...(!p.avatarByUpload && p.avatarByUserURL === undefined && p.avatarUrl.trim() ? { avatarUrl: p.avatarUrl } : {}),
    },
    behavior: { ...d.behavior },
    describeAgent: d.behavior.whatAgentDoes,
    knowledge: { ...d.knowledge },
    allowedWebsite: d.allowedWebsite,
    allowedDomainsExtra: d.allowedDomainsExtra,
    knowledgeContinued: d.knowledgeContinued,
    setupExplicitMaxStepIndex: d.setupExplicitMaxStepIndex,
    setupStepOnceCompleted: d.setupStepOnceCompleted,
    currentStepId: d.currentStepId,
    lastUpdatedStepId: d.lastUpdatedStepId,
    onboardingCompleted: d.onboardingCompleted ?? false,
    uploadedAssets: d.uploadedAssets ?? [],
  };
}

function bumpProgressAfterCompletingStep(
  d: TrialWorkspaceDraftV3,
  completedStepIndex: number,
): Pick<TrialWorkspaceDraftV3, "setupExplicitMaxStepIndex" | "setupStepOnceCompleted"> {
  const prev = d.setupExplicitMaxStepIndex ?? 0;
  const next = Math.min(3, Math.max(prev, completedStepIndex + 1));
  const once = [...d.setupStepOnceCompleted] as [boolean, boolean, boolean, boolean];
  if (completedStepIndex >= 0 && completedStepIndex <= 3) once[completedStepIndex] = true;
  return {
    setupExplicitMaxStepIndex: next,
    setupStepOnceCompleted: once,
  };
}

/**
 * PATCH payload when the user completes a step via **Next** (or finalize to creating).
 * Must match backend `parseTrialOnboardingDraftPatch` expectations.
 */
export function buildPatchPayloadForStepCompletion(
  d: TrialWorkspaceDraftV3,
  completedStepIndex: number,
  opts?: { finalizeToCreating?: boolean },
): Record<string, unknown> {
  const progress = bumpProgressAfterCompletingStep(d, completedStepIndex);
  const nextStepId = STEP_IDS[Math.min(3, completedStepIndex + 1)];
  const base: Record<string, unknown> = {
    ...progress,
    lastUpdatedStepId: STEP_IDS[completedStepIndex],
    currentStepId: nextStepId,
  };

  switch (completedStepIndex) {
    case 0: {
      const p = d.profile;
      return {
        ...base,
        profile: {
          agentName: p.agentName,
          categories: p.categories,
          brandColor: p.brandColor,
          quickLinks: p.quickLinks,
          ...(p.avatarByUpload != null ? { avatarByUpload: p.avatarByUpload } : {}),
          ...(p.avatarByUserURL !== undefined
            ? { avatarByUserURL: p.avatarByUserURL === null ? null : p.avatarByUserURL }
            : {}),
          ...(!p.avatarByUpload && p.avatarByUserURL === undefined && p.avatarUrl.trim() ? { avatarUrl: p.avatarUrl } : {}),
        },
      };
    }
    case 1:
      return {
        ...base,
        behavior: { ...d.behavior },
        describeAgent: d.behavior.whatAgentDoes,
      };
    case 2:
      return {
        ...base,
        knowledge: { ...d.knowledge },
        uploadedAssets: d.uploadedAssets ?? [],
        knowledgeContinued: true,
      };
    case 3:
      return {
        ...base,
        allowedWebsite: d.allowedWebsite,
        allowedDomainsExtra: d.allowedDomainsExtra,
        onboardingCompleted: opts?.finalizeToCreating === true ? true : (d.onboardingCompleted ?? false),
      };
    default:
      return base;
  }
}

/** State transition for “Continue to Go Live” from the knowledge step (no step index advance via Next bar). */
export function buildPatchForContinueKnowledgeToGoLive(d: TrialWorkspaceDraftV3): Record<string, unknown> {
  const once = [...d.setupStepOnceCompleted] as [boolean, boolean, boolean, boolean];
  once[2] = true;
  const prev = d.setupExplicitMaxStepIndex ?? 0;
  const setupExplicitMaxStepIndex = Math.min(3, Math.max(prev, 3));
  return {
    knowledgeContinued: true,
    setupExplicitMaxStepIndex,
    setupStepOnceCompleted: once,
    lastUpdatedStepId: "knowledge-base",
    currentStepId: "go-live",
    knowledge: { ...d.knowledge },
    uploadedAssets: d.uploadedAssets ?? [],
  };
}
