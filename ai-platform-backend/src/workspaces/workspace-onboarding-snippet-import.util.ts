import { randomUUID } from 'crypto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { BOT_FIELD_MAX, clampStr } from '../workspace/shared/bot-field-limits';
import {
  ONBOARDING_KNOWLEDGE_SNIPPETS_MAX,
  ONBOARDING_SNIPPET_IMPORT_SKIPPED_REASON,
} from './workspace-onboarding-knowledge-limits.constants';
import type { OnboardingSnippetDto } from './workspace-onboarding-knowledge-normalize.util';
import { parseCsvBufferToRows, type QaImportErrorRow } from './workspace-onboarding-qa-import.util';
import * as XLSX from 'xlsx';

export type SnippetImportErrorRow = QaImportErrorRow;

export type ParsedSnippetImportRow = {
  title: string;
  description: string;
};

export const ONBOARDING_SNIPPET_IMPORT_SAMPLE_CSV =
  'title,description,content\nReturn policy,Short summary,Customers can request returns within 30 days of purchase with proof of order.\nSupport hours,,Live chat support is available Monday-Friday 9 AM to 6 PM.\n';

const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const IMPORT_MAX_ROWS = 100;

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
    { error: 'Unsupported file type. Use a .csv or .xlsx file.', errorCode: 'unsupported_file_type' },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function readBodyFromRow(row: string[], idx: Map<string, number>): string {
  const description = String(row[idx.get('description') ?? -1] ?? '').trim();
  const content = String(row[idx.get('content') ?? -1] ?? '').trim();
  const snippet = String(row[idx.get('snippet') ?? -1] ?? '').trim();
  const parts = [description, content || snippet].map((part) => part.trim()).filter(Boolean);
  return parts.join('\n\n');
}

export function parseSnippetImportSpreadsheet(
  buffer: Buffer,
  fileName: string,
): { rows: ParsedSnippetImportRow[]; errors: SnippetImportErrorRow[] } {
  if (buffer.length > IMPORT_MAX_FILE_BYTES) {
    throw new HttpException(
      { error: 'Import file is too large (max 2 MB).', errorCode: 'file_too_large' },
      HttpStatus.BAD_REQUEST,
    );
  }

  const grid = spreadsheetRowsFromBuffer(buffer, fileName);
  if (grid.length < 2) {
    throw new HttpException(
      { error: 'Spreadsheet must include a header and at least one data row.', errorCode: 'csv_invalid' },
      HttpStatus.BAD_REQUEST,
    );
  }

  const [header, ...bodyRows] = grid;
  const idx = headerIndexMap(header);
  const hasBodyColumn = idx.has('description') || idx.has('content') || idx.has('snippet');
  if (!idx.has('title') || !hasBodyColumn) {
    throw new HttpException(
      {
        error: 'Invalid headers. Required: title and at least one of description, content.',
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

  const errors: SnippetImportErrorRow[] = [];
  const rows: ParsedSnippetImportRow[] = [];

  bodyRows.forEach((row, i) => {
    const rowNo = i + 2;
    const title = clampStr(String(row[idx.get('title') ?? -1] ?? '').trim(), BOT_FIELD_MAX.knowledgeSnippetTitle);
    const description = clampStr(readBodyFromRow(row, idx), BOT_FIELD_MAX.knowledgeSnippetBody);

    if (!title) errors.push({ row: rowNo, column: 'title', message: 'Title is required.' });
    if (!description) {
      errors.push({
        row: rowNo,
        column: 'content',
        message: 'Description or content is required.',
      });
    }

    if (title && description) {
      rows.push({ title, description });
    }
  });

  return { rows, errors };
}

export type SnippetImportMergeResult = {
  merged: OnboardingSnippetDto[];
  imported: number;
  skippedCount: number;
  skippedReason?: string;
};

export function mergeSnippetImportRows(
  existing: OnboardingSnippetDto[],
  incoming: ParsedSnippetImportRow[],
): SnippetImportMergeResult {
  const slots = Math.max(0, ONBOARDING_KNOWLEDGE_SNIPPETS_MAX - existing.length);
  const toAdd = incoming.slice(0, slots);
  const skippedCount = Math.max(0, incoming.length - toAdd.length);

  const now = new Date().toISOString();
  const baseSeq = Date.now();
  const merged = [
    ...existing,
    ...toAdd.map((row, index) => ({
      id: randomUUID(),
      title: row.title,
      description: row.description,
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
    ...(skippedCount > 0 ? { skippedReason: ONBOARDING_SNIPPET_IMPORT_SKIPPED_REASON } : {}),
  };
}
