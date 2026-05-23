import { BadRequestException } from '@nestjs/common';
import { BOT_FIELD_MAX, clampStr } from '../workspace/shared/bot-field-limits';
import {
  ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX,
} from './workspace-onboarding-knowledge-normalize.util';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((q) => clampStr(trimString(q), BOT_FIELD_MAX.knowledgeQaQuestion))
    .filter(Boolean)
    .slice(0, ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX);
}

export function parseOnboardingSnippetBody(body: unknown): { title: string; description: string } {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Snippet payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const title = clampStr(trimString(o.title), BOT_FIELD_MAX.knowledgeSnippetTitle);
  const description = clampStr(trimString(o.description), BOT_FIELD_MAX.knowledgeSnippetBody);
  if (!title) throw new BadRequestException({ error: 'Snippet title is required.' });
  if (!description) throw new BadRequestException({ error: 'Snippet description is required.' });
  return { title, description };
}

export function parseOnboardingQaBody(body: unknown): { title: string; questions: string[]; answer: string } {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Q&A payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const title = clampStr(trimString(o.title), BOT_FIELD_MAX.knowledgeQaTitle);
  const answer = clampStr(trimString(o.answer), BOT_FIELD_MAX.knowledgeQaAnswer);
  const questions = parseQuestions(o.questions);
  if (!title) throw new BadRequestException({ error: 'Q&A title is required.' });
  if (!answer) throw new BadRequestException({ error: 'Q&A answer is required.' });
  if (questions.length === 0) {
    throw new BadRequestException({ error: 'At least one question is required.' });
  }
  return { title, questions, answer };
}

export function parseOnboardingQaPatchBody(
  body: unknown,
): Partial<{ title: string; questions: string[]; answer: string }> {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Q&A payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<{ title: string; questions: string[]; answer: string }> = {};
  if (o.title !== undefined) {
    const title = clampStr(trimString(o.title), BOT_FIELD_MAX.knowledgeQaTitle);
    if (!title) throw new BadRequestException({ error: 'Q&A title is required.' });
    patch.title = title;
  }
  if (o.answer !== undefined) {
    const answer = clampStr(trimString(o.answer), BOT_FIELD_MAX.knowledgeQaAnswer);
    if (!answer) throw new BadRequestException({ error: 'Q&A answer is required.' });
    patch.answer = answer;
  }
  if (o.questions !== undefined) {
    const questions = parseQuestions(o.questions);
    if (questions.length === 0) {
      throw new BadRequestException({ error: 'At least one question is required.' });
    }
    patch.questions = questions;
  }
  if (Object.keys(patch).length === 0) {
    throw new BadRequestException({ error: 'Provide at least one field to update.' });
  }
  return patch;
}

export function parseOnboardingSnippetPatchBody(
  body: unknown,
): Partial<{ title: string; description: string }> {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException({ error: 'Snippet payload is required.' });
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<{ title: string; description: string }> = {};
  if (o.title !== undefined) {
    const title = clampStr(trimString(o.title), BOT_FIELD_MAX.knowledgeSnippetTitle);
    if (!title) throw new BadRequestException({ error: 'Snippet title is required.' });
    patch.title = title;
  }
  if (o.description !== undefined) {
    const description = clampStr(trimString(o.description), BOT_FIELD_MAX.knowledgeSnippetBody);
    if (!description) throw new BadRequestException({ error: 'Snippet description is required.' });
    patch.description = description;
  }
  if (Object.keys(patch).length === 0) {
    throw new BadRequestException({ error: 'Provide at least one field to update.' });
  }
  return patch;
}
