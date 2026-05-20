import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  CustomerChatsAnalyticsStartedFromBreakdownItem,
  CustomerChatsAnalyticsTopPageRow,
} from '@/api/types';
import { ChatsByCountrySection } from './ChatsByCountrySection';
import { CHATS_TOP_PAGES_COLLAPSED_LIMIT, ChatsTopPagesPanel } from './ChatsTopPagesPanel';
import { ChatsWidgetSourceChart } from './ChatsWidgetSourceChart';

vi.mock('./ChatsGeoChart', () => ({
  ChatsGeoChart: ({ data }: { data: unknown[][] }) => (
    <div data-testid="geo-chart-mock" data-packages="corechart,geochart">
      {JSON.stringify(data)}
    </div>
  ),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: unknown }) => (
    <div data-testid="recharts-responsive">{children as ReactNode}</div>
  ),
  PieChart: ({ children }: { children?: unknown }) => <div data-testid="pie-chart">{children as ReactNode}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));

describe('ChatsByCountrySection', () => {
  it('renders GeoChart with header-only data when no countries', () => {
    const html = renderToStaticMarkup(<ChatsByCountrySection countries={[]} />);
    expect(html).toContain('geo-chart-mock');
    expect(html).toContain('Country');
    expect(html).toContain('Chats');
    expect(html).not.toContain('New chats with location data will appear here');
    expect(html).not.toContain('Loading map…');
  });

  it('renders empty ranking state when no country signal', () => {
    const html = renderToStaticMarkup(
      <ChatsByCountrySection countries={[{ country: null, countryCode: null, conversations: 0, messages: 0 }]} />,
    );
    expect(html).toContain('geo-chart-mock');
    expect(html).toContain('Country');
    expect(html).toContain('Chats');
    expect(html).toContain('No country data yet.');
  });

  it('renders geo chart data and ranking without coordinates', () => {
    const html = renderToStaticMarkup(
      <ChatsByCountrySection
        countries={[{ country: 'Pakistan', countryCode: 'PK', conversations: 12, messages: 20 }]}
      />,
    );
    expect(html).toContain('Pakistan');
    expect(html).toContain('geo-chart-mock');
    expect(html).toContain('data-packages="corechart,geochart"');
    expect(html).toContain('PK');
    expect(html).toContain('12');
    expect(html).not.toContain('12 / 20');
    expect(html).not.toContain('latitude');
    expect(html).not.toContain('ipHash');
  });

  it('hides View all when there are 10 or fewer countries', () => {
    const html = renderToStaticMarkup(
      <ChatsByCountrySection
        countries={[{ country: 'Pakistan', countryCode: 'PK', conversations: 5, messages: 0 }]}
      />,
    );
    expect(html).not.toContain('View all');
  });

  it('shows View all and Unknown tag for unlocated chats', () => {
    const codes = ['PK', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'PL', 'SE'] as const;
    const countries = [
      { country: null, countryCode: null, conversations: 50, messages: 0 },
      ...codes.map((countryCode, i) => ({
        country: `Land ${i}`,
        countryCode,
        conversations: 20 - i,
        messages: 0,
      })),
    ];
    const html = renderToStaticMarkup(<ChatsByCountrySection countries={countries} />);
    expect(html).toContain('View all');
    expect(html).toContain('Unknown');
    expect(html).not.toContain('Land 10');
  });

  it('loads corechart and geochart packages for Google Charts', () => {
    const html = renderToStaticMarkup(
      <ChatsByCountrySection
        countries={[{ country: 'Pakistan', countryCode: 'PK', conversations: 12, messages: 20 }]}
      />,
    );
    expect(html).toContain('data-packages="corechart,geochart"');
    expect(html).toContain('Country');
    expect(html).toContain('Chats');
  });
});

describe('ChatsTopPagesPanel', () => {
  it('shows View all and only the first collapsed-limit rows in the card when there are more', () => {
    const total = CHATS_TOP_PAGES_COLLAPSED_LIMIT + 2;
    const rows: CustomerChatsAnalyticsTopPageRow[] = Array.from({ length: total }, (_, i) => ({
      page: `p${i + 1}.com/x`,
      pageLabel: `p${i + 1}.com/x`,
      websiteOrigin: `p${i + 1}.com`,
      conversations: total - i,
      messages: 1,
    }));
    const html = renderToStaticMarkup(<ChatsTopPagesPanel rows={rows} />);
    expect(html).toContain('View all');
    for (let i = 1; i <= CHATS_TOP_PAGES_COLLAPSED_LIMIT; i++) {
      expect(html).toContain(`p${i}.com`);
    }
    expect(html).not.toContain(`p${total}.com`);
  });

  it(`hides View all when at most ${CHATS_TOP_PAGES_COLLAPSED_LIMIT} rows`, () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = Array.from({ length: CHATS_TOP_PAGES_COLLAPSED_LIMIT }, (_, i) => ({
      page: `p${i + 1}.com/x`,
      pageLabel: `p${i + 1}.com/x`,
      websiteOrigin: `p${i + 1}.com`,
      conversations: i + 1,
      messages: 1,
    }));
    const html = renderToStaticMarkup(<ChatsTopPagesPanel rows={rows} />);
    expect(html).not.toContain('View all');
  });

  it('renders normalized page labels without query strings', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      {
        page: 'shop.example.com/pricing',
        pageLabel: 'shop.example.com/pricing',
        websiteOrigin: 'shop.example.com',
        conversations: 3,
        messages: 10,
      },
    ];
    const html = renderToStaticMarkup(<ChatsTopPagesPanel rows={rows} />);
    expect(html).toContain('shop.example.com/pricing');
    expect(html).toContain('href="https://shop.example.com/pricing"');
    expect(html).not.toContain('?');
    expect(html).not.toContain('utm');
    expect(html).toContain('3 chats');
    expect(html).toContain('10 messages');
  });

  it('shows empty state when no rows have signal', () => {
    const html = renderToStaticMarkup(
      <ChatsTopPagesPanel
        rows={[{ page: 'Unknown page', pageLabel: 'Unknown page', websiteOrigin: null, conversations: 0, messages: 0 }]}
      />,
    );
    expect(html).toContain('No page data yet.');
  });

  it('mutes unknown page row and shows helper copy', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      { page: 'a.com/z', pageLabel: 'a.com/z', websiteOrigin: 'a.com', conversations: 2, messages: 1 },
      { page: 'Unknown page', pageLabel: 'Unknown page', websiteOrigin: null, conversations: 5, messages: 1 },
    ];
    const html = renderToStaticMarkup(<ChatsTopPagesPanel rows={rows} />);
    expect(html).toContain('href="https://a.com/z"');
    expect(html).toContain('cursor-help');
    expect(html.indexOf('a.com/z')).toBeLessThan(html.indexOf('Unknown page'));
    expect(html).toContain('text-slate-500');
  });
});

describe('ChatsWidgetSourceChart', () => {
  it('uses friendly labels and does not expose raw startedFrom keys in markup', () => {
    const rows: CustomerChatsAnalyticsStartedFromBreakdownItem[] = [
      {
        key: 'runtime_widget',
        label: 'Chat Widget',
        conversations: 5,
        messages: 12,
      },
      {
        key: 'runtime_iframe',
        label: 'legacy',
        conversations: 2,
        messages: 3,
      },
    ];
    const html = renderToStaticMarkup(<ChatsWidgetSourceChart rows={rows} />);
    expect(html).toContain('Chat Widget');
    expect(html).toContain('Iframe');
    expect(html).not.toContain('runtime_widget');
    expect(html).not.toContain('runtime_iframe');
    expect(html).toContain('data-testid="pie-chart"');
  });

  it('shows empty state when there is no source data', () => {
    const rows: CustomerChatsAnalyticsStartedFromBreakdownItem[] = [
      { key: 'unknown', label: 'Unknown', conversations: 0, messages: 0 },
    ];
    const html = renderToStaticMarkup(<ChatsWidgetSourceChart rows={rows} />);
    expect(html).toContain('No widget channel data yet.');
  });
});
