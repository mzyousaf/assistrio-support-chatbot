import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { WorkspaceOnboardingDraft } from '../models';
import type { WorkspaceOnboardingResponse } from './workspace-onboarding.types';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { WorkspaceOnboardingKnowledgeStagingService } from './workspace-onboarding-knowledge-staging.service';
import {
  normalizeOnboardingKnowledge,
  ONBOARDING_KNOWLEDGE_QA_MAX,
  ONBOARDING_KNOWLEDGE_SNIPPETS_MAX,
  LEGACY_ONBOARDING_SNIPPET_ID,
  isLegacyOnboardingQaId,
  type OnboardingQaDto,
  type OnboardingSnippetDto,
} from './workspace-onboarding-knowledge-normalize.util';
import {
  mergeQaImportRows,
  ONBOARDING_QA_IMPORT_SAMPLE_CSV,
  parseQaImportSpreadsheet,
} from './workspace-onboarding-qa-import.util';
import {
  mergeSnippetImportRows,
  ONBOARDING_SNIPPET_IMPORT_SAMPLE_CSV,
  parseSnippetImportSpreadsheet,
} from './workspace-onboarding-snippet-import.util';
import { sortOnboardingKbItemsLatestFirst } from './workspace-onboarding-knowledge-sort.util';
import { readDatasheetFileFromMultipart } from '../workspace/datasheet-import-request.util';

type DraftDoc = {
  _id: Types.ObjectId;
  knowledge?: {
    snippets?: Array<Record<string, unknown>>;
    qas?: Array<Record<string, unknown>>;
    knowledgeDescription?: string;
    faqs?: Array<Record<string, unknown>>;
  };
};

@Injectable()
export class WorkspaceOnboardingKnowledgeContentService {
  constructor(
    @InjectModel(WorkspaceOnboardingDraft.name)
    private readonly draftModel: Model<WorkspaceOnboardingDraft>,
    private readonly workspaceOnboardingService: WorkspaceOnboardingService,
    private readonly stagingService: WorkspaceOnboardingKnowledgeStagingService,
  ) {}

  private async loadNormalized(workspaceId: string) {
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftKnowledge =
      onboarding.draft &&
      typeof onboarding.draft === 'object' &&
      'knowledge' in onboarding.draft &&
      onboarding.draft.knowledge != null
        ? onboarding.draft.knowledge
        : onboarding.draft;
    const normalized = normalizeOnboardingKnowledge(
      draftKnowledge as unknown as Parameters<typeof normalizeOnboardingKnowledge>[0],
    );
    return { onboarding, normalized };
  }

  private draftDateFromIso(value: string | null | undefined, fallback: Date): Date {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private nextKnowledgeSequence(): number {
    return Date.now();
  }

  private snippetToDraftRow(snippet: OnboardingSnippetDto, fallbackNow: Date) {
    const createdAt = this.draftDateFromIso(snippet.createdAt, fallbackNow);
    return {
      id: snippet.id,
      title: snippet.title,
      description: snippet.description,
      createdAt,
      updatedAt: this.draftDateFromIso(snippet.updatedAt, createdAt),
      ...(snippet.sequence != null ? { sequence: snippet.sequence } : {}),
      ...(snippet.updateSequence != null ? { updateSequence: snippet.updateSequence } : {}),
    };
  }

  private qaToDraftRow(qa: OnboardingQaDto, fallbackNow: Date) {
    const createdAt = this.draftDateFromIso(qa.createdAt, fallbackNow);
    return {
      id: qa.id,
      title: qa.title,
      questions: qa.questions,
      answer: qa.answer,
      createdAt,
      updatedAt: this.draftDateFromIso(qa.updatedAt, createdAt),
      ...(qa.sequence != null ? { sequence: qa.sequence } : {}),
      ...(qa.updateSequence != null ? { updateSequence: qa.updateSequence } : {}),
    };
  }

  private async persistContent(
    workspaceId: string,
    snippets: OnboardingSnippetDto[],
    qas: OnboardingQaDto[],
  ): Promise<WorkspaceOnboardingResponse> {
    const { onboarding } = await this.loadNormalized(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    if (!draftId || !Types.ObjectId.isValid(draftId)) {
      throw new NotFoundException({ error: 'Onboarding draft not found.' });
    }

    const now = new Date();
    await this.draftModel.findByIdAndUpdate(new Types.ObjectId(draftId), {
      $set: {
        'knowledge.snippets': snippets.map((s) => this.snippetToDraftRow(s, now)),
        'knowledge.qas': qas.map((q) => this.qaToDraftRow(q, now)),
        'knowledge.knowledgeDescription': snippets[0]?.description ?? '',
        'knowledge.faqs': qas.flatMap((q) =>
          q.questions.map((question) => ({ question, answer: q.answer })),
        ),
      },
    });

    const refreshed = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    return this.stagingService.attachStagedKnowledgeToResponse(refreshed);
  }

  private async finish(workspaceId: string): Promise<WorkspaceOnboardingResponse> {
    const refreshed = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    return this.stagingService.attachStagedKnowledgeToResponse(refreshed);
  }

  async listSnippets(workspaceId: string): Promise<{ snippets: OnboardingSnippetDto[] }> {
    const { normalized } = await this.loadNormalized(workspaceId);
    return { snippets: sortOnboardingKbItemsLatestFirst(normalized.snippets) };
  }

  async createSnippet(
    workspaceId: string,
    body: { title: string; description: string },
  ): Promise<WorkspaceOnboardingResponse> {
    const { normalized } = await this.loadNormalized(workspaceId);
    if (normalized.snippets.length >= ONBOARDING_KNOWLEDGE_SNIPPETS_MAX) {
      throw new HttpException(
        {
          error: `At most ${ONBOARDING_KNOWLEDGE_SNIPPETS_MAX} snippets are allowed.`,
          errorCode: 'onboarding_snippet_limit_exceeded',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const now = new Date().toISOString();
    const seq = this.nextKnowledgeSequence();
    const snippet: OnboardingSnippetDto = {
      id: randomUUID(),
      title: body.title,
      description: body.description,
      createdAt: now,
      updatedAt: now,
      sequence: seq,
      updateSequence: seq,
    };
    return this.persistContent(workspaceId, [...normalized.snippets, snippet], normalized.qas);
  }

  async updateSnippet(
    workspaceId: string,
    snippetId: string,
    patch: Partial<{ title: string; description: string }>,
  ): Promise<WorkspaceOnboardingResponse> {
    const { normalized } = await this.loadNormalized(workspaceId);
    const idx = normalized.snippets.findIndex((s) => s.id === snippetId);
    if (idx < 0) throw new NotFoundException({ error: 'Snippet not found.' });
    const current = normalized.snippets[idx]!;
    const updateSeq = this.nextKnowledgeSequence();
    const updated: OnboardingSnippetDto = {
      ...current,
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      updatedAt: new Date().toISOString(),
      updateSequence: updateSeq,
    };
    const snippets = [...normalized.snippets];
    snippets[idx] = updated;
    return this.persistContent(workspaceId, snippets, normalized.qas);
  }

  async deleteSnippet(workspaceId: string, snippetId: string): Promise<WorkspaceOnboardingResponse> {
    const { normalized } = await this.loadNormalized(workspaceId);
    if (snippetId === LEGACY_ONBOARDING_SNIPPET_ID) {
      if (!normalized.snippets.some((s) => s.id === LEGACY_ONBOARDING_SNIPPET_ID)) {
        throw new NotFoundException({ error: 'Snippet not found.' });
      }
      return this.persistContent(workspaceId, [], normalized.qas.filter((q) => !isLegacyOnboardingQaId(q.id)));
    }
    const snippets = normalized.snippets.filter((s) => s.id !== snippetId);
    if (snippets.length === normalized.snippets.length) {
      throw new NotFoundException({ error: 'Snippet not found.' });
    }
    const explicitSnippets = snippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID);
    return this.persistContent(workspaceId, explicitSnippets, normalized.qas.filter((q) => !isLegacyOnboardingQaId(q.id)));
  }

  async listQas(workspaceId: string): Promise<{ qas: OnboardingQaDto[] }> {
    const { normalized } = await this.loadNormalized(workspaceId);
    return { qas: sortOnboardingKbItemsLatestFirst(normalized.qas) };
  }

  async createQa(
    workspaceId: string,
    body: { title: string; questions: string[]; answer: string },
  ): Promise<WorkspaceOnboardingResponse> {
    const { normalized } = await this.loadNormalized(workspaceId);
    if (normalized.qas.length >= ONBOARDING_KNOWLEDGE_QA_MAX) {
      throw new HttpException(
        {
          error: `At most ${ONBOARDING_KNOWLEDGE_QA_MAX} Q&A items are allowed.`,
          errorCode: 'onboarding_qa_limit_exceeded',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const now = new Date().toISOString();
    const seq = this.nextKnowledgeSequence();
    const qa: OnboardingQaDto = {
      id: randomUUID(),
      title: body.title,
      questions: body.questions,
      answer: body.answer,
      createdAt: now,
      updatedAt: now,
      sequence: seq,
      updateSequence: seq,
    };
    return this.persistContent(workspaceId, normalized.snippets, [...normalized.qas, qa]);
  }

  async updateQa(
    workspaceId: string,
    qaId: string,
    patch: Partial<{ title: string; questions: string[]; answer: string }>,
  ): Promise<WorkspaceOnboardingResponse> {
    const { normalized } = await this.loadNormalized(workspaceId);
    const idx = normalized.qas.findIndex((q) => q.id === qaId);
    if (idx < 0) throw new NotFoundException({ error: 'Q&A not found.' });
    const current = normalized.qas[idx]!;
    const updateSeq = this.nextKnowledgeSequence();
    const updated: OnboardingQaDto = {
      ...current,
      title: patch.title ?? current.title,
      questions: patch.questions ?? current.questions,
      answer: patch.answer ?? current.answer,
      updatedAt: new Date().toISOString(),
      updateSequence: updateSeq,
    };
    const qas = [...normalized.qas];
    qas[idx] = updated;
    return this.persistContent(workspaceId, normalized.snippets, qas);
  }

  async deleteQa(workspaceId: string, qaId: string): Promise<WorkspaceOnboardingResponse> {
    const { normalized, onboarding } = await this.loadNormalized(workspaceId);
    const target = normalized.qas.find((q) => q.id === qaId);
    if (!target) {
      throw new NotFoundException({ error: 'Q&A not found.' });
    }

    if (isLegacyOnboardingQaId(qaId)) {
      const draftId = onboarding.onboardingDraftId;
      if (!draftId || !Types.ObjectId.isValid(draftId)) {
        throw new NotFoundException({ error: 'Onboarding draft not found.' });
      }
      const draft = (await this.draftModel.findById(new Types.ObjectId(draftId)).lean()) as DraftDoc | null;
      if (!draft) {
        throw new NotFoundException({ error: 'Onboarding draft not found.' });
      }
      const targetQuestion = String(target.questions[0] ?? '').trim();
      const targetAnswer = String(target.answer ?? '').trim();
      const faqs = (Array.isArray(draft.knowledge?.faqs) ? draft.knowledge!.faqs! : []).filter((row) => {
        const q = String(row.question ?? '').trim();
        const a = String(row.answer ?? '').trim();
        return !(q === targetQuestion && a === targetAnswer);
      });
      const now = new Date();
      const explicitSnippets = (Array.isArray(draft.knowledge?.snippets) ? draft.knowledge!.snippets! : [])
        .map((row) => ({
          id: String(row.id ?? '').trim() || randomUUID(),
          title: String(row.title ?? '').trim(),
          description: String(row.description ?? '').trim(),
          createdAt: row.createdAt instanceof Date ? row.createdAt : now,
          updatedAt:
            row.updatedAt instanceof Date
              ? row.updatedAt
              : row.createdAt instanceof Date
                ? row.createdAt
                : now,
        }))
        .filter((row) => row.title && row.description);
      const explicitQas = (Array.isArray(draft.knowledge?.qas) ? draft.knowledge!.qas! : [])
        .map((row) => ({
          id: String(row.id ?? '').trim() || randomUUID(),
          title: String(row.title ?? '').trim(),
          questions: Array.isArray(row.questions) ? row.questions.map((q) => String(q ?? '').trim()).filter(Boolean) : [],
          answer: String(row.answer ?? '').trim(),
          createdAt: row.createdAt instanceof Date ? row.createdAt : now,
          updatedAt:
            row.updatedAt instanceof Date
              ? row.updatedAt
              : row.createdAt instanceof Date
                ? row.createdAt
                : now,
        }))
        .filter((row) => row.title && row.answer && row.questions.length > 0);
      await this.draftModel.findByIdAndUpdate(new Types.ObjectId(draftId), {
        $set: {
          'knowledge.snippets': explicitSnippets,
          'knowledge.qas': explicitQas,
          'knowledge.faqs': faqs,
          'knowledge.knowledgeDescription': String(draft.knowledge?.knowledgeDescription ?? '').trim(),
        },
      });
      return this.finish(workspaceId);
    }

    const qas = normalized.qas.filter((q) => q.id !== qaId);
    return this.persistContent(
      workspaceId,
      normalized.snippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID),
      qas.filter((q) => !isLegacyOnboardingQaId(q.id)),
    );
  }

  async bulkDeleteSnippets(
    workspaceId: string,
    snippetIds: readonly string[],
  ): Promise<WorkspaceOnboardingResponse & { deletedCount: number }> {
    const idSet = new Set(snippetIds.map((id) => id.trim()).filter(Boolean));
    if (idSet.size === 0) {
      throw new NotFoundException({ error: 'Snippet not found.' });
    }

    const { normalized } = await this.loadNormalized(workspaceId);
    let snippets = [...normalized.snippets];
    let qas = [...normalized.qas];
    let deletedCount = 0;

    if (idSet.has(LEGACY_ONBOARDING_SNIPPET_ID) && snippets.some((s) => s.id === LEGACY_ONBOARDING_SNIPPET_ID)) {
      snippets = snippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID);
      qas = qas.filter((q) => !isLegacyOnboardingQaId(q.id));
      idSet.delete(LEGACY_ONBOARDING_SNIPPET_ID);
      deletedCount += 1;
    }

    const explicitBefore = snippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID).length;
    const explicitSnippets = snippets.filter(
      (s) => s.id === LEGACY_ONBOARDING_SNIPPET_ID || !idSet.has(s.id),
    );
    const explicitAfter = explicitSnippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID).length;
    deletedCount += explicitBefore - explicitAfter;

    const response = await this.persistContent(
      workspaceId,
      explicitSnippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID),
      qas.filter((q) => !isLegacyOnboardingQaId(q.id)),
    );
    return { ...response, deletedCount };
  }

  async bulkDeleteQas(
    workspaceId: string,
    qaIds: readonly string[],
  ): Promise<WorkspaceOnboardingResponse & { deletedCount: number }> {
    const idSet = new Set(qaIds.map((id) => id.trim()).filter(Boolean));
    if (idSet.size === 0) {
      throw new NotFoundException({ error: 'Q&A not found.' });
    }

    const { normalized, onboarding } = await this.loadNormalized(workspaceId);
    const legacyIds = [...idSet].filter((id) => isLegacyOnboardingQaId(id));
    const explicitIds = [...idSet].filter((id) => !isLegacyOnboardingQaId(id));
    let deletedCount = 0;

    const explicitBefore = normalized.qas.filter((q) => !isLegacyOnboardingQaId(q.id)).length;
    let qas = normalized.qas.filter((q) => isLegacyOnboardingQaId(q.id) || !explicitIds.includes(q.id));
    deletedCount += explicitBefore - qas.filter((q) => !isLegacyOnboardingQaId(q.id)).length;

    if (legacyIds.length > 0) {
      const draftId = onboarding.onboardingDraftId;
      if (!draftId || !Types.ObjectId.isValid(draftId)) {
        throw new NotFoundException({ error: 'Onboarding draft not found.' });
      }
      const draft = (await this.draftModel.findById(new Types.ObjectId(draftId)).lean()) as DraftDoc | null;
      if (!draft) {
        throw new NotFoundException({ error: 'Onboarding draft not found.' });
      }

      let faqs = Array.isArray(draft.knowledge?.faqs) ? [...draft.knowledge!.faqs!] : [];
      for (const qaId of legacyIds) {
        const target = normalized.qas.find((q) => q.id === qaId);
        if (!target) continue;
        const targetQuestion = String(target.questions[0] ?? '').trim();
        const targetAnswer = String(target.answer ?? '').trim();
        const before = faqs.length;
        faqs = faqs.filter((row) => {
          const q = String(row.question ?? '').trim();
          const a = String(row.answer ?? '').trim();
          return !(q === targetQuestion && a === targetAnswer);
        });
        if (faqs.length < before) deletedCount += 1;
      }

      if (deletedCount === 0) {
        const response = await this.finish(workspaceId);
        return { ...response, deletedCount: 0 };
      }

      const now = new Date();
      const explicitSnippets = (Array.isArray(draft.knowledge?.snippets) ? draft.knowledge!.snippets! : [])
        .map((row) => ({
          id: String(row.id ?? '').trim() || randomUUID(),
          title: String(row.title ?? '').trim(),
          description: String(row.description ?? '').trim(),
          createdAt: row.createdAt instanceof Date ? row.createdAt : now,
          updatedAt:
            row.updatedAt instanceof Date
              ? row.updatedAt
              : row.createdAt instanceof Date
                ? row.createdAt
                : now,
        }))
        .filter((row) => row.title && row.description);
      const explicitQas = qas
        .filter((q) => !isLegacyOnboardingQaId(q.id))
        .map((q) => ({
          id: q.id,
          title: q.title,
          questions: q.questions,
          answer: q.answer,
          createdAt: q.createdAt ? new Date(q.createdAt) : now,
          updatedAt: q.updatedAt ? new Date(q.updatedAt) : q.createdAt ? new Date(q.createdAt) : now,
        }));

      await this.draftModel.findByIdAndUpdate(new Types.ObjectId(draftId), {
        $set: {
          'knowledge.snippets': explicitSnippets,
          'knowledge.qas': explicitQas,
          'knowledge.faqs': faqs,
          'knowledge.knowledgeDescription': String(draft.knowledge?.knowledgeDescription ?? '').trim(),
        },
      });
      const response = await this.finish(workspaceId);
      return { ...response, deletedCount };
    }

    if (deletedCount === 0) {
      const response = await this.finish(workspaceId);
      return { ...response, deletedCount: 0 };
    }

    const response = await this.persistContent(
      workspaceId,
      normalized.snippets.filter((s) => s.id !== LEGACY_ONBOARDING_SNIPPET_ID),
      qas.filter((q) => !isLegacyOnboardingQaId(q.id)),
    );
    return { ...response, deletedCount };
  }

  async importQas(
    workspaceId: string,
    req: FastifyRequest,
  ): Promise<
    WorkspaceOnboardingResponse & {
      imported: number;
      skippedCount?: number;
      skippedReason?: string;
    }
  > {
    const { normalized } = await this.loadNormalized(workspaceId);
    const file = await readDatasheetFileFromMultipart(req as never, () => undefined);
    const ext = (file.originalName.split('.').pop() ?? '').toLowerCase();
    if (ext !== 'csv') {
      throw new HttpException(
        { error: 'Unsupported file type. Use a .csv file.', errorCode: 'unsupported_file_type' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const { rows, errors } = parseQaImportSpreadsheet(file.buffer, file.originalName);
    if (errors.length > 0) {
      throw new HttpException(
        {
          error: 'Spreadsheet has invalid rows. Fix and retry.',
          errorCode: 'import_invalid_rows',
          details: errors,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { merged, imported, skippedCount, skippedReason } = mergeQaImportRows(normalized.qas, rows);
    const response = await this.persistContent(workspaceId, normalized.snippets, merged);
    return { ...response, imported, ...(skippedCount > 0 ? { skippedCount, skippedReason } : {}) };
  }

  async importSnippets(
    workspaceId: string,
    req: FastifyRequest,
  ): Promise<
    WorkspaceOnboardingResponse & {
      imported: number;
      skippedCount?: number;
      skippedReason?: string;
    }
  > {
    const { normalized } = await this.loadNormalized(workspaceId);
    const file = await readDatasheetFileFromMultipart(req as never, () => undefined);
    const ext = (file.originalName.split('.').pop() ?? '').toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      throw new HttpException(
        { error: 'Unsupported file type. Use a .csv or .xlsx file.', errorCode: 'unsupported_file_type' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const { rows, errors } = parseSnippetImportSpreadsheet(file.buffer, file.originalName);
    if (errors.length > 0) {
      throw new HttpException(
        {
          error: 'Spreadsheet has invalid rows. Fix and retry.',
          errorCode: 'import_invalid_rows',
          details: errors,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { merged, imported, skippedCount, skippedReason } = mergeSnippetImportRows(normalized.snippets, rows);
    const response = await this.persistContent(workspaceId, merged, normalized.qas);
    return { ...response, imported, ...(skippedCount > 0 ? { skippedCount, skippedReason } : {}) };
  }
}
