import { HttpException } from '@nestjs/common';
import { DEFAULT_KB_FIELD_LIMITS } from './knowledge-plan-limits';
import {
  assertDatasheetUploadWithinPlanLimit,
  assertDocumentUploadBatchFileCountAtMost,
  assertDocumentUploadWithinPlanLimit,
  PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE,
  PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE,
  PLAN_LIMIT_DOCUMENT_FILE_SIZE_ERROR_CODE,
  planLimitDatasheetFileSizeException,
  planLimitDocumentBatchCountException,
  planLimitDocumentFileSizeException,
} from './kb-upload-plan-limit.util';

describe('kb-upload-plan-limit.util', () => {
  const docMax = DEFAULT_KB_FIELD_LIMITS.documentMaxUploadBytes;
  const sheetMax = DEFAULT_KB_FIELD_LIMITS.datasheetMaxUploadBytes;

  it('document: allows exactly the plan limit', () => {
    expect(() => assertDocumentUploadWithinPlanLimit(docMax)).not.toThrow();
  });

  it('document: rejects one byte over limit with errorCode', () => {
    try {
      assertDocumentUploadWithinPlanLimit(docMax + 1);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const ex = e as HttpException;
      const body = ex.getResponse() as { errorCode?: string; message?: string };
      expect(body.errorCode).toBe(PLAN_LIMIT_DOCUMENT_FILE_SIZE_ERROR_CODE);
      expect(body.message).toBe('Document files can be up to 20 MB.');
      return;
    }
    throw new Error('expected throw');
  });

  it('datasheet: allows exactly the plan limit', () => {
    expect(() => assertDatasheetUploadWithinPlanLimit(sheetMax)).not.toThrow();
  });

  it('datasheet: rejects one byte over limit with errorCode', () => {
    try {
      assertDatasheetUploadWithinPlanLimit(sheetMax + 1);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const body = (e as HttpException).getResponse() as { errorCode?: string };
      expect(body.errorCode).toBe(PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE);
      return;
    }
    throw new Error('expected throw');
  });

  it('factory helpers return HttpException with status 413 payload', () => {
    const d = planLimitDocumentFileSizeException();
    expect(d.getStatus()).toBe(413);
    expect((d.getResponse() as { errorCode: string }).errorCode).toBe(PLAN_LIMIT_DOCUMENT_FILE_SIZE_ERROR_CODE);
    const s = planLimitDatasheetFileSizeException();
    expect(s.getStatus()).toBe(413);
    expect((s.getResponse() as { errorCode: string }).errorCode).toBe(PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE);
  });

  describe('assertDocumentUploadBatchFileCountAtMost', () => {
    const max = 5;

    it('allows 5 files in one upload', () => {
      expect(() => assertDocumentUploadBatchFileCountAtMost(5, max)).not.toThrow();
    });

    it('allows 5 even when max is default', () => {
      expect(() => assertDocumentUploadBatchFileCountAtMost(5)).not.toThrow();
    });

    it('rejects 6 files (HTTP 400 + plan_limit_document_batch_count)', () => {
      try {
        assertDocumentUploadBatchFileCountAtMost(6, max);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(400);
        const body = ex.getResponse() as {
          errorCode?: string;
          maxFilesPerUpload?: number;
          incomingFiles?: number;
          message?: string;
        };
        expect(body.errorCode).toBe(PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE);
        expect(body.maxFilesPerUpload).toBe(5);
        expect(body.incomingFiles).toBe(6);
        expect(body.message).toBe('You can upload up to 5 files at a time.');
        return;
      }
      throw new Error('expected throw');
    });

    it('planLimitDocumentBatchCountException shape', () => {
      const ex = planLimitDocumentBatchCountException({ maxFilesPerUpload: 5, incomingFiles: 10 });
      expect(ex.getStatus()).toBe(400);
      const b = ex.getResponse() as { incomingFiles: number };
      expect(b.incomingFiles).toBe(10);
    });
  });
});
