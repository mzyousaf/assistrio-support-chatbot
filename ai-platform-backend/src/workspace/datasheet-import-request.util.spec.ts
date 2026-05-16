import { HttpException } from '@nestjs/common';
import { readDatasheetFileFromMultipart } from './datasheet-import-request.util';
import { PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE } from '../knowledge/kb-upload-plan-limit.util';

/** Keep buffers tiny in CI: only this spec's imports see a reduced datasheet cap. */
jest.mock('../knowledge/knowledge-plan-limits', () => {
  const actual = jest.requireActual<typeof import('../knowledge/knowledge-plan-limits')>(
    '../knowledge/knowledge-plan-limits',
  );
  return {
    ...actual,
    DEFAULT_KB_FIELD_LIMITS: {
      ...actual.DEFAULT_KB_FIELD_LIMITS,
      datasheetMaxUploadBytes: 4096,
    },
  };
});

function buildMultipartRequest(size: number, name = 't.csv') {
  return {
    parts: async function* () {
      yield {
        type: 'file' as const,
        fieldname: 'file',
        filename: name,
        mimetype: 'text/csv',
        toBuffer: async () => Buffer.alloc(size),
      };
    },
  };
}

describe('readDatasheetFileFromMultipart', () => {
  const max = 4096;

  it('accepts file at exactly mocked plan limit', async () => {
    const r = buildMultipartRequest(max);
    const out = await readDatasheetFileFromMultipart(r as never, () => {});
    expect(out.buffer.length).toBe(max);
  });

  it('rejects file one byte over plan limit before returning', async () => {
    const r = buildMultipartRequest(max + 1);
    try {
      await readDatasheetFileFromMultipart(r as never, () => {});
      throw new Error('expected HttpException');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(413);
      const body = (e as HttpException).getResponse() as { errorCode?: string };
      expect(body.errorCode).toBe(PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE);
    }
  });
});
