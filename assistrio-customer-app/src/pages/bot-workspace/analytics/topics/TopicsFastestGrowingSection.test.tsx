import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerTopicsFastestGrowingItem } from '@/api/types';
import { TopicsFastestGrowingSection, compareFastestGrowingDisplay } from './TopicsFastestGrowingSection';

function row(partial: Partial<CustomerTopicsFastestGrowingItem> & Pick<CustomerTopicsFastestGrowingItem, 'topic' | 'label'>): CustomerTopicsFastestGrowingItem {
  return {
    currentCount: 0,
    previousCount: 0,
    change: 0,
    changePercent: null,
    growthLabel: null,
    messages: 0,
    conversations: 0,
    ...partial,
  };
}

describe('TopicsFastestGrowingSection', () => {
  it('compareFastestGrowingDisplay: positive % first, then |change|, then currentCount', () => {
    const hiPct = row({
      topic: 'pricing',
      label: 'Pricing',
      currentCount: 30,
      previousCount: 10,
      change: 20,
      changePercent: 200,
      growthLabel: null,
    });
    const midPct = row({
      topic: 'billing',
      label: 'Billing',
      currentCount: 20,
      previousCount: 10,
      change: 10,
      changePercent: 100,
      growthLabel: null,
    });
    const newer = row({
      topic: 'refund',
      label: 'Refund',
      currentCount: 50,
      previousCount: 0,
      change: 50,
      changePercent: null,
      growthLabel: 'New',
    });
    const sorted = [newer, midPct, hiPct].sort(compareFastestGrowingDisplay);
    expect(sorted.map((r) => r.topic)).toEqual(['pricing', 'billing', 'refund']);
  });

  it('empty state when no rows', () => {
    const html = renderToStaticMarkup(<TopicsFastestGrowingSection rows={[]} metricMode="messages" />);
    expect(html).toContain('Not enough topic history yet.');
  });

  it('badge shows New when growthLabel is New (source)', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'TopicsFastestGrowingSection.tsx'), 'utf8');
    expect(src).toContain("{formatChangeSigned(r.change)} / {r.growthLabel === 'New' ? 'New' : formatGrowthPercent(r)}");
  });

  it('does not import hardcoded topic taxonomy lists', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'TopicsFastestGrowingSection.tsx'), 'utf8');
    expect(src).not.toMatch(/TOPIC_DISPLAY_FALLBACK|CUSTOMER_TOPICS_ANALYTICS_MAIN_TOPIC_IDS/);
  });
});
