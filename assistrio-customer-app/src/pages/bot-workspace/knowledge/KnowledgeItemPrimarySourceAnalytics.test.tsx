import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { KnowledgeItemPrimarySourceAnalytics } from './KnowledgeItemPrimarySourceAnalytics';
import * as customerApi from '@/api/customerApi';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  ComposedChart: ({ children }: { children?: ReactNode }) => (
    <div data-testid="recharts-composed">{children}</div>
  ),
  Area: () => null,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe('KnowledgeItemPrimarySourceAnalytics', () => {
  const botId = '507f1f77bcf86cd799439011';
  const itemId = '507f191e810c19729de860ea';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows help when knowledgeItemId is missing', () => {
    render(<KnowledgeItemPrimarySourceAnalytics botId={botId} knowledgeItemId={null} />);
    expect(screen.getByText(/Usage analytics are available after this item is saved/i)).toBeTruthy();
  });

  it('renders section, cards, and chart after load', async () => {
    const spy = vi.spyOn(customerApi, 'getCustomerBotKnowledgeItemPrimarySourceAnalytics').mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        source: {
          knowledgeBaseItemId: itemId,
          sourceTitle: 'T',
          sourceType: 'note',
          safeUrl: null,
        },
        summary: {
          primarySourceUses: 3,
          conversations: 2,
          averagePrimarySourceScore: 0.42,
          lastUsedAt: '2026-01-10T12:00:00.000Z',
        },
        timeSeries: [
          {
            date: '2026-01-09T00:00:00.000Z',
            primarySourceUses: 2,
            conversations: 1,
            averageScore: 0.4,
          },
          {
            date: '2026-01-10T00:00:00.000Z',
            primarySourceUses: 1,
            conversations: 1,
            averageScore: 0.44,
          },
        ],
      },
    });

    const { container } = render(<KnowledgeItemPrimarySourceAnalytics botId={botId} knowledgeItemId={itemId} />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    expect(screen.getByTestId('kb-item-primary-source-analytics')).toBeTruthy();
    expect(screen.getByText('Source Usage')).toBeTruthy();

    const grid = container.querySelector('[data-testid="kb-item-primary-source-summary-cards"]');
    expect(grid).toBeTruthy();
    expect(grid?.textContent).toContain('Answers Powered');
    expect(grid?.textContent).toContain('3');

    expect(screen.getByTestId('kb-item-primary-source-chart')).toBeTruthy();
    expect(screen.getByTestId('recharts-composed')).toBeTruthy();

    expect(container.textContent).not.toMatch(/\bchunk\b/i);
    expect(container.textContent).not.toMatch(/\bembedding\b/i);
  });

  it('shows empty chart state when primary uses are zero', async () => {
    vi.spyOn(customerApi, 'getCustomerBotKnowledgeItemPrimarySourceAnalytics').mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        source: {
          knowledgeBaseItemId: itemId,
          sourceTitle: 'T',
          sourceType: 'faq',
          safeUrl: null,
        },
        summary: {
          primarySourceUses: 0,
          conversations: 0,
          averagePrimarySourceScore: null,
          lastUsedAt: null,
        },
        timeSeries: [
          {
            date: '2026-01-10T00:00:00.000Z',
            primarySourceUses: 0,
            conversations: 0,
            averageScore: null,
          },
        ],
      },
    });

    render(<KnowledgeItemPrimarySourceAnalytics botId={botId} knowledgeItemId={itemId} />);

    await waitFor(() => {
      expect(screen.getByText(/No source usage for this range/i)).toBeTruthy();
    });
  });
});
