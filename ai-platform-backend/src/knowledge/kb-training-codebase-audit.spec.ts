import * as fs from 'fs';
import * as path from 'path';

/**
 * Lightweight static checks so refactors do not reintroduce ExtractJob on non-doc scopes
 * or training logic coupled to `documents.status`.
 */
function readSrc(relFromKnowledgeDir: string): string {
  return fs.readFileSync(path.join(__dirname, relFromKnowledgeDir), 'utf8');
}

describe('KB training architecture invariants (source checks)', () => {
  it('knowledge-base-item.service must not create ExtractJobs (deleteMany on hard-remove is OK)', () => {
    const s = readSrc('knowledge-base-item.service.ts');
    expect(s).not.toMatch(/extractJobModel\.create\b/);
    expect(s).toContain('extractJobModel.deleteMany');
  });

  it('knowledge-training-job.service only uses TrainJob (no ExtractJob)', () => {
    const s = readSrc('knowledge-training-job.service.ts');
    expect(s).not.toContain('ExtractJob');
  });

  it('ingestion.service owns extractJobModel.create for KB extraction queue', () => {
    const s = readSrc('../ingestion/ingestion.service.ts');
    expect(s).toContain('extractJobModel.create');
  });

  it('document-effective-training-status util documents documents.status exclusion', () => {
    const s = readSrc('document-effective-training-status.util.ts');
    expect(s).toContain('documents.status');
    expect(s).toMatch(/must not contribute|not contribute/i);
  });
});
