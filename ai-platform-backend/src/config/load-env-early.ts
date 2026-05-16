import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Same file order as `config.module.ts` (`envFilePath`), so `process.env` matches before `NestFactory.create`.
 * - Does not override keys already set in the process environment (shell wins).
 * - Simple `KEY=VALUE` lines; no multiline; strips optional surrounding double quotes.
 */
export function loadEnvFilesBeforeBootstrap(moduleDirname: string): void {
  const skip = process.env.SKIP_DOTENV === '1' || process.env.SKIP_DOTENV === 'true';
  if (skip) return;
  const backendRoot = resolve(moduleDirname, '..');
  for (const name of ['.env', '.env.local'] as const) {
    const p = join(backendRoot, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (key in process.env) continue;
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      (process.env as Record<string, string>)[key] = val;
    }
  }
}
