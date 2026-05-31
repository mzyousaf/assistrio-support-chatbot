import { BadRequestException } from '@nestjs/common';
import {
  isWorkspaceOnboardingStep,
  WORKSPACE_ONBOARDING_STEPS,
} from '../models/workspace-onboarding.constants';
import type {
  WorkspaceOnboardingDraftGoLiveDto,
  WorkspaceOnboardingDraftInstructionsDto,
  WorkspaceOnboardingDraftKnowledgeDto,
  WorkspaceOnboardingDraftProfileDto,
  WorkspaceOnboardingProgressPatch,
} from './workspace-onboarding.types';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const trimmed = trimString(value);
  return trimmed || undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((entry) => trimString(entry))
    .filter(Boolean);
  return items.length ? items : [];
}

function parseRequiredString(body: Record<string, unknown>, key: string, label: string): string {
  const value = trimString(body[key]);
  if (!value) {
    throw new BadRequestException({ error: `${label} is required.` });
  }
  return value;
}

export const MIN_AGENT_INSTRUCTIONS_LENGTH = 80;

export function parseWorkspaceOnboardingProfilePatch(body: unknown): WorkspaceOnboardingDraftProfileDto {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Profile payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const patch: WorkspaceOnboardingDraftProfileDto = {};
  if (o.name !== undefined) {
    patch.name = parseRequiredString(o, 'name', 'Agent name');
  }
  if (o.description !== undefined) patch.description = optionalTrimmedString(o.description);
  if (o.shortDescription !== undefined) patch.shortDescription = optionalTrimmedString(o.shortDescription);
  if (o.brandColor !== undefined) patch.brandColor = optionalTrimmedString(o.brandColor);
  if (o.categories !== undefined) patch.categories = optionalStringArray(o.categories);
  if (o.avatarSource !== undefined) patch.avatarSource = optionalTrimmedString(o.avatarSource);
  if (o.imageUrl !== undefined) patch.imageUrl = optionalTrimmedString(o.imageUrl);
  if (o.avatarEmoji !== undefined) patch.avatarEmoji = optionalTrimmedString(o.avatarEmoji);
  if (o.avatarStorageKey !== undefined) patch.avatarStorageKey = optionalTrimmedString(o.avatarStorageKey);

  if (Object.keys(patch).length === 0) {
    throw new BadRequestException({ error: 'At least one profile field is required.' });
  }

  return patch;
}

export function parseWorkspaceOnboardingInstructionsPatch(
  body: unknown,
): WorkspaceOnboardingDraftInstructionsDto {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Instructions payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const description = parseRequiredString(o, 'description', 'Instructions');
  if (description.length < MIN_AGENT_INSTRUCTIONS_LENGTH) {
    throw new BadRequestException({
      error: 'Describe your AI Agent in at least 80 characters.',
    });
  }
  const systemPrompt = optionalTrimmedString(o.systemPrompt) ?? description;
  const responseLengthRaw = trimString(o.responseLength);
  const responseLength =
    responseLengthRaw === 'short' || responseLengthRaw === 'long' || responseLengthRaw === 'medium'
      ? responseLengthRaw
      : undefined;
  let maxTokens: number | undefined;
  if (typeof o.maxTokens === 'number' && Number.isFinite(o.maxTokens) && o.maxTokens > 0) {
    maxTokens = Math.floor(o.maxTokens);
  }

  return {
    description,
    systemPrompt,
    tone: optionalTrimmedString(o.tone),
    behaviorPreset: optionalTrimmedString(o.behaviorPreset),
    responseLength,
    maxTokens,
  };
}

function parseFaqRows(value: unknown): WorkspaceOnboardingDraftKnowledgeDto['faqs'] {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const question = trimString(o.question);
      const answer = trimString(o.answer);
      if (!question && !answer) return null;
      return { question, answer };
    })
    .filter((row): row is { question: string; answer: string } => row != null);
  return rows;
}

export function parseWorkspaceOnboardingKnowledgePatch(
  body: unknown,
): WorkspaceOnboardingDraftKnowledgeDto {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Knowledge payload is required.' });
  }
  const o = body as Record<string, unknown>;
  return {
    knowledgeDescription: optionalTrimmedString(o.knowledgeDescription),
    faqs: parseFaqRows(o.faqs),
  };
}

export function parseWorkspaceOnboardingGoLivePatch(body: unknown): WorkspaceOnboardingDraftGoLiveDto {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Go live payload is required.' });
  }
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.allowedOrigins)) {
    return { allowedOrigins: [] };
  }

  const allowedOrigins = o.allowedOrigins
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const origin = trimString(row.origin);
      if (!origin) return null;
      return {
        origin,
        label: optionalTrimmedString(row.label),
        isActive: typeof row.isActive === 'boolean' ? row.isActive : true,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return { allowedOrigins };
}

export function parseWorkspaceOnboardingProgressPatch(body: unknown): WorkspaceOnboardingProgressPatch {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Progress payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const patch: WorkspaceOnboardingProgressPatch = {};

  if (o.currentStep != null) {
    if (!isWorkspaceOnboardingStep(o.currentStep)) {
      throw new BadRequestException({
        error: `currentStep must be one of: ${WORKSPACE_ONBOARDING_STEPS.join(', ')}`,
      });
    }
    patch.currentStep = o.currentStep;
  }

  if (o.completedStep != null) {
    if (!isWorkspaceOnboardingStep(o.completedStep)) {
      throw new BadRequestException({
        error: `completedStep must be one of: ${WORKSPACE_ONBOARDING_STEPS.join(', ')}`,
      });
    }
    patch.completedStep = o.completedStep;
  }

  if (!patch.currentStep && !patch.completedStep) {
    throw new BadRequestException({ error: 'Provide currentStep and/or completedStep.' });
  }

  return patch;
}
