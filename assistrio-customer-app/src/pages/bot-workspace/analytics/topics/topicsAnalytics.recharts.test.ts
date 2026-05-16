import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function listTsFilesRecursive(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) listTsFilesRecursive(p, acc);
    else if (name.isFile() && (name.name.endsWith('.tsx') || name.name.endsWith('.ts'))) acc.push(p);
  }
  return acc;
}

describe('Topics analytics (Recharts, no Apex)', () => {
  it('no Topics analytics source file imports apexcharts or react-apexcharts', () => {
    const files = listTsFilesRecursive(__dirname).filter(
      (f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx') && !f.endsWith('.spec.ts'),
    );
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/apexcharts|react-apexcharts|ApexChartLoader|ApexOptions/i);
    }
  });

  it('time-series chart uses Recharts LineChart (Trends view)', () => {
    const src = readFileSync(join(__dirname, 'TopicsOverTimeChart.tsx'), 'utf8');
    expect(src).toMatch(/from 'recharts'/);
    expect(src).toMatch(/ResponsiveContainer/);
    expect(src).toMatch(/LineChart/);
    expect(src).toMatch(/monotone/);
    expect(src).not.toMatch(/AreaChart/);
  });

  it('fastest growing section uses Recharts LineChart slope (Previous → Current)', () => {
    const src = readFileSync(join(__dirname, 'TopicsFastestGrowingSection.tsx'), 'utf8');
    expect(src).toMatch(/from 'recharts'/);
    expect(src).toMatch(/LineChart/);
    expect(src).toMatch(/<Line\b/);
    expect(src).toContain("xLabel: 'Previous'");
    expect(src).toContain("xLabel: 'Current'");
  });

  it('topic by sentiment section uses stacked horizontal Recharts bars', () => {
    const src = readFileSync(join(__dirname, 'TopicsTopicBySentimentSection.tsx'), 'utf8');
    expect(src).toMatch(/from 'recharts'/);
    expect(src).toMatch(/BarChart/);
    expect(src).toMatch(/layout=\"vertical\"/);
    expect(src).toMatch(/stackId/);
  });
});
