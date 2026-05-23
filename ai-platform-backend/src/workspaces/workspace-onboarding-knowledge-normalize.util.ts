import { randomUUID } from 'crypto';
import type { WorkspaceOnboardingDraftKnowledge } from '../models/workspace-onboarding-draft.schema';
import type {
  WorkspaceOnboardingDraftFaq,
  WorkspaceOnboardingDraftQa,
  WorkspaceOnboardingDraftSnippet,
} from '../models/workspace-onboarding-knowledge.schema';
import { BOT_FIELD_MAX, clampStr } from '../workspace/shared/bot-field-limits';
import {
  ONBOARDING_KNOWLEDGE_QA_MAX,
  ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX,
  ONBOARDING_KNOWLEDGE_SNIPPETS_MAX,
} from './workspace-onboarding-knowledge-limits.constants';

export {
  ONBOARDING_KNOWLEDGE_QA_MAX,
  ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX,
  ONBOARDING_KNOWLEDGE_SNIPPETS_MAX,
} from './workspace-onboarding-knowledge-limits.constants';

export type OnboardingSnippetDto = {
  id: string;
  title: string;
  description: string;
  createdAt: string | null;
  updatedAt: string | null;
  sequence?: number;
  updateSequence?: number;
};

export type OnboardingQaDto = {
  id: string;
  title: string;
  questions: string[];
  answer: string;
  createdAt: string | null;
  updatedAt: string | null;
  sequence?: number;
  updateSequence?: number;
};

export type NormalizedOnboardingKnowledge = {
  snippets: OnboardingSnippetDto[];
  qas: OnboardingQaDto[];
  /** Legacy field preserved for backward compatibility in API responses. */
  knowledgeDescription: string;
  /** Legacy FAQ shape preserved for backward compatibility. */
  faqs: Array<{ question: string; answer: string }>;
};

/** Stable id for virtual snippet synthesized from legacy `knowledgeDescription`. */
export const LEGACY_ONBOARDING_SNIPPET_ID = 'legacy:knowledge-description';

export function legacyFaqQaId(index: number): string {
  return `legacy:faq:${index}`;
}

export function isLegacyOnboardingSnippetId(id: string): boolean {
  return id === LEGACY_ONBOARDING_SNIPPET_ID;
}

export function isLegacyOnboardingQaId(id: string): boolean {
  return id.startsWith('legacy:faq:');
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  return null;
}

function sortNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function legacyFaqToQa(row: WorkspaceOnboardingDraftFaq, index: number): OnboardingQaDto {
  const question = String(row.question ?? '').trim();
  const answer = String(row.answer ?? '').trim();
  const title =
    question.length > 80 ? `${question.slice(0, 77).trim()}…` : question.trim() || `Q&A ${index + 1}`;
  return {
    id: legacyFaqQaId(index),
    title,
    questions: question ? [question] : [],
    answer,
    createdAt: null,
    updatedAt: null,
  };
}

function normalizeSnippetRow(row: WorkspaceOnboardingDraftSnippet): OnboardingSnippetDto | null {
  const title = clampStr(String(row.title ?? '').trim(), BOT_FIELD_MAX.knowledgeSnippetTitle);
  const description = clampStr(String(row.description ?? '').trim(), BOT_FIELD_MAX.knowledgeSnippetBody);
  if (!title || !description) return null;
  const createdAt = isoDate(row.createdAt);
  const updatedAt = isoDate(row.updatedAt);
  const sequence = sortNumber(row.sequence) ?? (createdAt ? Date.parse(createdAt) : undefined);
  const updateSequence =
    sortNumber(row.updateSequence) ?? (updatedAt ? Date.parse(updatedAt) : sequence);
  return {
    id: String(row.id ?? '').trim() || randomUUID(),
    title,
    description,
    createdAt,
    updatedAt,
    ...(sequence != null ? { sequence } : {}),
    ...(updateSequence != null ? { updateSequence } : {}),
  };
}

function normalizeQaRow(row: WorkspaceOnboardingDraftQa): OnboardingQaDto | null {
  const title = clampStr(String(row.title ?? '').trim(), BOT_FIELD_MAX.knowledgeQaTitle);
  const answer = clampStr(String(row.answer ?? '').trim(), BOT_FIELD_MAX.knowledgeQaAnswer);
  const questions = (Array.isArray(row.questions) ? row.questions : [])
    .map((q) => clampStr(String(q ?? '').trim(), BOT_FIELD_MAX.knowledgeQaQuestion))
    .filter(Boolean)
    .slice(0, ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX);
  if (!title || !answer || questions.length === 0) return null;
  const createdAt = isoDate(row.createdAt);
  const updatedAt = isoDate(row.updatedAt);
  const sequence = sortNumber(row.sequence) ?? (createdAt ? Date.parse(createdAt) : undefined);
  const updateSequence =
    sortNumber(row.updateSequence) ?? (updatedAt ? Date.parse(updatedAt) : sequence);
  return {
    id: String(row.id ?? '').trim() || randomUUID(),
    title,
    questions,
    answer,
    createdAt,
    updatedAt,
    ...(sequence != null ? { sequence } : {}),
    ...(updateSequence != null ? { updateSequence } : {}),
  };
}

export function normalizeOnboardingKnowledge(
  knowledge: WorkspaceOnboardingDraftKnowledge | undefined,
): NormalizedOnboardingKnowledge {
  const rawSnippets = Array.isArray(knowledge?.snippets) ? knowledge!.snippets! : [];
  let snippets = rawSnippets
    .map(normalizeSnippetRow)
    .filter((row): row is OnboardingSnippetDto => row != null);

  const legacyDescription = String(knowledge?.knowledgeDescription ?? '').trim();
  if (snippets.length === 0 && legacyDescription) {
    snippets = [
      {
        id: LEGACY_ONBOARDING_SNIPPET_ID,
        title: 'General information',
        description: clampStr(legacyDescription, BOT_FIELD_MAX.knowledgeSnippetBody),
        createdAt: null,
        updatedAt: null,
      },
    ];
  }

  const rawQas = Array.isArray(knowledge?.qas) ? knowledge!.qas! : [];
  let qas = rawQas.map(normalizeQaRow).filter((row): row is OnboardingQaDto => row != null);

  const legacyFaqs = Array.isArray(knowledge?.faqs) ? knowledge!.faqs! : [];
  if (qas.length === 0 && legacyFaqs.length > 0) {
    qas = legacyFaqs
      .map((row, i) => {
        const question = String(row.question ?? '').trim();
        const answer = String(row.answer ?? '').trim();
        if (!question || !answer) return null;
        return legacyFaqToQa(row, i);
      })
      .filter((row): row is OnboardingQaDto => row != null);
  }

  const faqs = qas.flatMap((qa) =>
    qa.questions.map((question) => ({ question, answer: qa.answer })),
  );

  return {
    snippets,
    qas,
    knowledgeDescription: snippets[0]?.description ?? legacyDescription,
    faqs,
  };
}

export function isValidOnboardingSnippet(row: Pick<OnboardingSnippetDto, 'title' | 'description'>): boolean {
  return Boolean(String(row.title ?? '').trim() && String(row.description ?? '').trim());
}

export function isValidOnboardingQa(row: Pick<OnboardingQaDto, 'title' | 'questions' | 'answer'>): boolean {
  const questions = (row.questions ?? []).map((q) => String(q ?? '').trim()).filter(Boolean);
  return Boolean(String(row.title ?? '').trim() && String(row.answer ?? '').trim() && questions.length > 0);
}

export function hasOnboardingTextKnowledge(normalized: NormalizedOnboardingKnowledge): boolean {
  return normalized.snippets.some(isValidOnboardingSnippet) || normalized.qas.some(isValidOnboardingQa);
}
