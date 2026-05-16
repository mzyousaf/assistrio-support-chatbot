import * as fs from 'fs/promises';
import { KbService } from './kb.service';

jest.mock('fs/promises');

describe('KbService.extractTextFromUpload', () => {
  const kb = new KbService({} as never);

  beforeEach(() => {
    jest.mocked(fs.readFile).mockReset();
  });

  it('returns unsupported_file_type for unknown extension without reading disk', async () => {
    const r = await kb.extractTextFromUpload({ filePath: '/tmp/x', fileName: 'data.bin' });
    expect(r.extracted).toBe(false);
    expect(r.reason).toBe('unsupported_file_type');
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('reads utf8 txt and extracts normalized text', async () => {
    jest.mocked(fs.readFile).mockResolvedValueOnce('  hello  \n\nworld  ');
    const r = await kb.extractTextFromUpload({ filePath: '/tmp/a.txt', fileName: 'a.txt' });
    expect(r.extracted).toBe(true);
    expect(r.text).toMatch(/hello/);
    expect(r.text).toMatch(/world/);
    expect(fs.readFile).toHaveBeenCalledWith('/tmp/a.txt', 'utf8');
  });

  it('returns empty when normalized content is blank', async () => {
    jest.mocked(fs.readFile).mockResolvedValueOnce('  \n\t  \n  ');
    const r = await kb.extractTextFromUpload({ filePath: '/tmp/a.txt', fileName: 'a.txt' });
    expect(r.extracted).toBe(false);
    expect(r.reason).toBe('empty');
  });

  it('returns extraction_failed when read throws for txt', async () => {
    jest.mocked(fs.readFile).mockRejectedValueOnce(new Error('enoent'));
    const r = await kb.extractTextFromUpload({ filePath: '/tmp/a.txt', fileName: 'a.txt' });
    expect(r.extracted).toBe(false);
    expect(r.reason).toBe('extraction_failed');
  });
});
