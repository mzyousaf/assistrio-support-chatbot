import { BadRequestException } from '@nestjs/common';
import type { AllowedOrigin } from '../bots/origin-validation.util';
import { normalizeUserAllowedOriginInput } from '../bots/origin-validation.util';
import {
  WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES,
  type WorkspaceOnboardingDraftSnapshot,
  type WorkspaceOnboardingGoLiveRequest,
} from './workspace-onboarding.types';
import { hasOnboardingTextKnowledge, normalizeOnboardingKnowledge } from './workspace-onboarding-knowledge-normalize.util';
import { MIN_AGENT_INSTRUCTIONS_LENGTH } from './workspace-onboarding.validation';

function onboardingBadRequest(errorCode: string, error: string): BadRequestException {
  return new BadRequestException({ error, errorCode });
}

export function parseWorkspaceOnboardingGoLivePostBody(body: unknown): WorkspaceOnboardingGoLiveRequest {
  if (body == null || typeof body !== 'object') {
    return {};
  }
  const o = body as Record<string, unknown>;
  const origin = typeof o.origin === 'string' && o.origin.trim() ? o.origin.trim() : undefined;
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined;
  const idempotencyKey =
    typeof o.idempotencyKey === 'string' && o.idempotencyKey.trim() ? o.idempotencyKey.trim() : undefined;
  return { origin, label, idempotencyKey };
}

export function mergeAllowedOriginInput(
  origins: AllowedOrigin[],
  origin: string,
  label?: string,
): AllowedOrigin[] {
  const normalized = normalizeUserAllowedOriginInput(origin);
  if (!normalized) {
    throw onboardingBadRequest(
      WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.originInvalid,
      'Allowed origin must be a valid http(s) URL origin.',
    );
  }
  const without = origins.filter((row) => row.origin.trim() !== normalized);
  return [...without, { origin: normalized, ...(label ? { label } : {}), isActive: true }];
}

export function firstActiveAllowedOrigin(origins: AllowedOrigin[]): AllowedOrigin | null {
  for (const row of origins) {
    if (row.isActive === false) continue;
    const origin = String(row.origin ?? '').trim();
    if (origin) return { ...row, origin, isActive: true };
  }
  return null;
}

export function validateOnboardingDraftForGoLive(
  draft: WorkspaceOnboardingDraftSnapshot,
  opts?: { hasStagedDocuments?: boolean; hasStagedDatasheets?: boolean },
): void {
  if (!draft.profile.name.trim()) {
    throw onboardingBadRequest(
      WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.profileIncomplete,
      'Agent name is required before going live.',
    );
  }
  if (!draft.instructions.description.trim()) {
    throw onboardingBadRequest(
      WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.instructionsIncomplete,
      'Agent instructions are required before going live.',
    );
  }
  if (draft.instructions.description.trim().length < MIN_AGENT_INSTRUCTIONS_LENGTH) {
    throw onboardingBadRequest(
      WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.instructionsIncomplete,
      'Describe your AI agent in at least 80 characters before going live.',
    );
  }

  const normalized = normalizeOnboardingKnowledge(
    draft.knowledge as unknown as Parameters<typeof normalizeOnboardingKnowledge>[0],
  );
  const hasTextKnowledge = hasOnboardingTextKnowledge(normalized);
  const hasStagedFiles = Boolean(opts?.hasStagedDocuments || opts?.hasStagedDatasheets);
  if (!hasTextKnowledge && !hasStagedFiles) {
    throw onboardingBadRequest(
      WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.knowledgeIncomplete,
      'Add knowledge — a file, datasheet, text snippet, or Q&A — before going live.',
    );
  }

  if (!firstActiveAllowedOrigin(
    draft.goLive.allowedOrigins.map((row) => ({
      origin: row.origin,
      label: row.label,
      isActive: row.isActive !== false,
    })),
  )) {
    throw onboardingBadRequest(
      WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.originRequired,
      'At least one active allowed origin is required before going live.',
    );
  }
}
