import { HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  assertDatasheetUploadWithinPlanLimit,
  planLimitDatasheetFileSizeException,
} from '../knowledge/kb-upload-plan-limit.util';
import { isDatasheetImportExtension } from './datasheet-import.util';

type Part =
  | { type: 'file'; fieldname: string; filename?: string; mimetype: string; toBuffer: () => Promise<Buffer> }
  | { type: 'field'; fieldname: string; value: string };

type RequestWithParts = FastifyRequest & { parts: () => AsyncIterableIterator<Part> };

/**
 * Read a single `file` field from a multipart request (datasheet import / preview). Validates size, extension, and
 * "one file only" rule.
 */
export async function readDatasheetFileFromMultipart(
  r: RequestWithParts,
  log: (s: string) => void,
): Promise<{ buffer: Buffer; originalName: string; fileMimetype: string }> {
  let buffer: Buffer | null = null;
  let originalName = 'datasheet';
  let fileMimetype = '';

  try {
    for await (const part of r.parts()) {
      if (part.type === 'file' && part.fieldname === 'file') {
        if (buffer) {
          throw new HttpException(
            { error: 'One file at a time. Use a single "file" field.' },
            HttpStatus.BAD_REQUEST,
          );
        }
        const b = await part.toBuffer();
        if (!b.length) continue;
        originalName = (part.filename || 'datasheet').trim() || 'datasheet';
        fileMimetype = part.mimetype && part.mimetype !== 'application/octet-stream' ? part.mimetype : '';
        const ext = getExtFromFileName(originalName);
        if (!ext || !isDatasheetImportExtension(ext)) {
          throw new HttpException(
            {
              error: 'Unsupported file type. Use a .csv, .xlsx, or .xls file.',
              fileName: originalName,
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        buffer = b;
      }
    }
  } catch (e) {
    if (e instanceof HttpException) throw e;
    const err = e as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
      throw planLimitDatasheetFileSizeException();
    }
    const msg = typeof err.message === 'string' ? err.message : '';
    if (/limit|too large/i.test(msg)) {
      throw planLimitDatasheetFileSizeException();
    }
    log(
      `datasheet multipart read failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`,
    );
    throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
  }

  if (!buffer) {
    throw new HttpException({ error: 'Missing file. Send a multipart field named "file".' }, HttpStatus.BAD_REQUEST);
  }

  assertDatasheetUploadWithinPlanLimit(buffer.length);

  return { buffer, originalName, fileMimetype };
}

function getExtFromFileName(name: string): string {
  const t = name.trim();
  const i = t.lastIndexOf('.');
  if (i < 0) return '';
  return t.slice(i + 1).toLowerCase();
}

export function getExtFromFileNameForDatasheet(name: string): string {
  return getExtFromFileName(name);
}

export function guessContentTypeByExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    default:
      return 'application/octet-stream';
  }
}
