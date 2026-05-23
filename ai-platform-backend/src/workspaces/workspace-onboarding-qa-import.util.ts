import { randomUUID } from 'crypto';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { CsvIncrementalParser } from '../workspace/datasheet-csv-stream.util';
import { BOT_FIELD_MAX, clampStr } from '../workspace/shared/bot-field-limits';
import {
  ONBOARDING_KNOWLEDGE_QA_MAX,
  ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX,
  ONBOARDING_QA_IMPORT_SKIPPED_REASON,
} from './workspace-onboarding-knowledge-limits.constants';
import type { OnboardingQaDto } from './workspace-onboarding-knowledge-normalize.util';

export type QaImportErrorRow = { row: number; column: string; message: string };

export type ParsedQaImportRow = {
  title: string;
  questions: string[];
  answer: string;
};

/** Matches playground `GET …/faqs/import-csv-sample`. */
export const ONBOARDING_QA_IMPORT_SAMPLE_CSV =
  'title,questions,answer\nShipping and returns,When do you ship?|How long is delivery?,We ship within 1-2 business days.\nRefund policy,Can I get a refund?|How do returns work?,You can request a refund within 30 days with your order number.\n';

const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const IMPORT_MAX_ROWS = 100;

function splitQuestions(raw: string): string[] {
  const t = String(raw ?? '').trim();
  if (!t) return [];
  return t
    .split(/[\n\r|;]+/)
    .map((q) => q.trim())
    .filter(Boolean);
}

export function parseCsvBufferToRows(buffer: Buffer): string[][] {
  try {
    const parser = new CsvIncrementalParser();
    const rowsFromPush = parser.pushChunk(buffer);
    const rowsFromEnd = parser.end();
    const all = [...rowsFromPush, ...rowsFromEnd].map((r) => r.map((c) => String(c ?? '').trim()));
    return all.filter((r) => r.some((c) => c.length > 0));
  } catch {
    throw new HttpException(
      { error: 'Could not parse CSV file. Check formatting and retry.', errorCode: 'csv_invalid' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function headerIndexMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((cell, i) => {
    const key = String(cell ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (key) map.set(key, i);
  });
  return map;
}

function spreadsheetRowsFromBuffer(buffer: Buffer, fileName: string): string[][] {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (ext === 'csv') {
    return parseCsvBufferToRows(buffer);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const name = wb.SheetNames[0];
    if (!name) return [];
    const sheet = wb.Sheets[name];
    if (!sheet) return [];
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
    return data.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : []));
  }
  throw new HttpException(
    { error: 'Unsupported file type. Use a .csv file.', errorCode: 'unsupported_file_type' },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function readQuestionsRaw(
  row: string[],
  idx: Map<string, number>,
  hasQuestionsCol: boolean,
  hasQuestionCol: boolean,
): string {
  const parts: string[] = [];
  if (hasQuestionCol) {
    const single = String(row[idx.get('question') ?? -1] ?? '').trim();
    if (single) parts.push(single);
  }
  if (hasQuestionsCol) {
    const plural = String(row[idx.get('questions') ?? -1] ?? '').trim();
    if (plural) parts.push(plural);
  }
  return parts.join('|');
}

export function parseQaImportSpreadsheet(
  buffer: Buffer,
  fileName: string,
): { rows: ParsedQaImportRow[]; errors: QaImportErrorRow[] } {
  if (buffer.length > IMPORT_MAX_FILE_BYTES) {
    throw new HttpException(
      { error: 'Import file is too large (max 2 MB).', errorCode: 'file_too_large' },
      HttpStatus.BAD_REQUEST,
    );
  }

  const grid = spreadsheetRowsFromBuffer(buffer, fileName);
  if (grid.length < 2) {
    throw new HttpException(
      { error: 'CSV must include a header and at least one data row.', errorCode: 'csv_invalid' },
      HttpStatus.BAD_REQUEST,
    );
  }

  const [header, ...bodyRows] = grid;
  const idx = headerIndexMap(header);
  const hasQuestionsCol = idx.has('questions');
  const hasQuestionCol = idx.has('question');
  if (!idx.has('title') || !idx.has('answer') || (!hasQuestionsCol && !hasQuestionCol)) {
    throw new HttpException(
      {
        error: 'Invalid CSV headers. Required: title, questions, answer.',
        errorCode: 'csv_invalid',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  if (bodyRows.length > IMPORT_MAX_ROWS) {
    throw new HttpException(
      { error: `At most ${IMPORT_MAX_ROWS} rows can be imported at once.`, errorCode: 'csv_too_many_rows' },
      HttpStatus.BAD_REQUEST,
    );
  }

  const errors: QaImportErrorRow[] = [];
  const rows: ParsedQaImportRow[] = [];

  bodyRows.forEach((row, i) => {
    const rowNo = i + 2;
    const title = clampStr(String(row[idx.get('title') ?? -1] ?? '').trim(), BOT_FIELD_MAX.knowledgeQaTitle);
    const answer = clampStr(String(row[idx.get('answer') ?? -1] ?? '').trim(), BOT_FIELD_MAX.knowledgeQaAnswer);
    const questionsRaw = readQuestionsRaw(row, idx, hasQuestionsCol, hasQuestionCol);
    let questions = splitQuestions(questionsRaw).map((q) =>
      clampStr(q, BOT_FIELD_MAX.knowledgeQaQuestion),
    );
    if (questions.length > ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX) {
      questions = questions.slice(0, ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX);
    }

    if (!answer) errors.push({ row: rowNo, column: 'answer', message: 'Answer is required.' });
    if (!title && questions.length === 0) {
      errors.push({
        row: rowNo,
        column: 'questions',
        message: 'Provide at least one question or a title.',
      });
    }

    if (answer && (title || questions.length > 0)) {
      const resolvedTitle =
        title || clampStr(questions[0] ?? '', BOT_FIELD_MAX.knowledgeQaTitle);
      rows.push({ title: resolvedTitle, questions, answer });
    }
  });

  return { rows, errors };
}

export type QaImportMergeResult = {
  merged: OnboardingQaDto[];
  imported: number;
  skippedCount: number;
  skippedReason?: string;
};

export function mergeQaImportRows(
  existing: OnboardingQaDto[],
  incoming: ParsedQaImportRow[],
): QaImportMergeResult {
  const slots = Math.max(0, ONBOARDING_KNOWLEDGE_QA_MAX - existing.length);
  const toAdd = incoming.slice(0, slots);
  const skippedCount = Math.max(0, incoming.length - toAdd.length);

  const now = new Date().toISOString();
  const baseSeq = Date.now();
  const merged = [
    ...existing,
    ...toAdd.map((row, index) => ({
      id: randomUUID(),
      title: row.title,
      questions: row.questions,
      answer: row.answer,
      createdAt: now,
      updatedAt: now,
      sequence: baseSeq + index,
      updateSequence: baseSeq + index,
    })),
  ];

  return {
    merged,
    imported: toAdd.length,
    skippedCount,
    ...(skippedCount > 0 ? { skippedReason: ONBOARDING_QA_IMPORT_SKIPPED_REASON } : {}),
  };
}
