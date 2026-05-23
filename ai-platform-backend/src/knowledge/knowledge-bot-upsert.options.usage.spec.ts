import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.join(__dirname, '..');

const PRODUCTION_ONBOARDING_OPTIONS_IMPORT_ALLOWLIST = new Set([
  'knowledge/knowledge-bot-upsert.options.ts',
  'workspace/workspace-onboarding-go-live.service.ts',
  'workspace/workspace-onboarding-knowledge-transfer.service.ts',
]);

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walkTsFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function rel(p: string): string {
  return path.relative(SRC_ROOT, p).replace(/\\/g, '/');
}

describe('ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS production usage guard', () => {
  it('is only imported by onboarding go-live transfer modules (not customer/admin KB APIs)', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS')) continue;
      const r = rel(file);
      if (!PRODUCTION_ONBOARDING_OPTIONS_IMPORT_ALLOWLIST.has(r)) {
        offenders.push(r);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('forceInitialTraining: true is not set outside the options constant definition', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('forceInitialTraining: true')) continue;
      const r = rel(file);
      if (r !== 'knowledge/knowledge-bot-upsert.options.ts') {
        offenders.push(r);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Normal KB upload paths remain free of onboarding force-training hooks', () => {
  it('customer document upload handler does not reference onboarding options', () => {
    const handlerPath = path.join(SRC_ROOT, 'workspace/shared/workspace-bot-document-upload.handler.ts');
    const content = fs.readFileSync(handlerPath, 'utf8');
    expect(content).not.toMatch(/ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS|forceInitialTraining/);
    expect(content).toContain('markTrainingQueued: false');
  });

  it('customer knowledge controller does not reference onboarding options', () => {
    const controllerPath = path.join(SRC_ROOT, 'workspace/customer-knowledge.controller.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');
    expect(content).not.toMatch(/ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS|forceInitialTraining/);
  });

  it('table import service does not reference onboarding options', () => {
    const importPath = path.join(SRC_ROOT, 'ingestion/table-import.service.ts');
    const content = fs.readFileSync(importPath, 'utf8');
    expect(content).not.toMatch(/ONBOARDING_GO_LIVE_KB_UPSERT_OPTIONS|forceInitialTraining/);
  });
});
