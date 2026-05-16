import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('App analytics routes', () => {
  it('uses real Topics and Sentiment pages (no analytics placeholder for those paths)', () => {
    const app = readFileSync(join(dir, 'App.tsx'), 'utf8');
    expect(app).toContain('TopicsAnalyticsPage');
    expect(app).toContain('SentimentAnalyticsPage');
    expect(app).not.toContain('AnalyticsPlaceholderPage');
  });
});
