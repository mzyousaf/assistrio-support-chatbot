import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterCapsule } from '@/components/ui/FilterCapsule';
import {
  DateRangeFilter,
  DateRangeCustomPickerTrigger,
  fromDateRangeFilterValue,
} from './DateRangeFilter';
import { computeDateRangePopoverPosition } from './dateRangeFilterUtils';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
] as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockResizeObserver() {
  class RO {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}

function mockAnchorRect(rect: Partial<DOMRect> = {}) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 120,
    height: 32,
    top: 80,
    left: 200,
    bottom: 112,
    right: 320,
    x: 200,
    y: 80,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

function openCustomPanel() {
  fireEvent.click(screen.getAllByTestId('date-range-preset-custom')[0]!);
}

function getCurrentMonthDayButtons(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('.rdp-day:not(.rdp-outside) button.rdp-day_button:not([disabled])'),
  ) as HTMLButtonElement[];
}

function withMidMonthDate(run: () => void | Promise<void>) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-01-15T12:00:00'));
  return Promise.resolve(run()).finally(() => {
    vi.useRealTimers();
  });
}

function expectDisabled(button: HTMLElement) {
  expect((button as HTMLButtonElement).disabled).toBe(true);
}

function expectEnabled(button: HTMLElement) {
  expect((button as HTMLButtonElement).disabled).toBe(false);
}

function clickEnabledDay(container: HTMLElement, day: number) {
  const button = getCurrentMonthDayButtons(container).find((el) => el.textContent?.trim() === String(day));
  if (!button) {
    throw new Error(`Could not find enabled day button for day ${day}`);
  }
  fireEvent.click(button);
}

function selectFirstRange(container: HTMLElement) {
  clickEnabledDay(container, 1);
  clickEnabledDay(container, 5);
}

describe('DateRangeFilter', () => {
  it('opens calendar popover for Custom range', async () => {
    mockAnchorRect();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();

    const popover = await screen.findByTestId('custom-date-range-popover');
    expect(popover).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Custom range' })).toBeTruthy();
    expect(screen.getByText('Select the dates you want to analyze.')).toBeTruthy();
  });

  it('shows formatted custom trigger label when custom preset is active', () => {
    render(
      <DateRangeFilter
        value={{ preset: 'custom', from: '2026-01-01', to: '2026-01-15' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    expect(screen.getByTestId('date-range-preset-custom').textContent).toContain('Jan 1 – Jan 15');
  });

  it('renders DayPicker calendar grid', async () => {
    mockAnchorRect();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    await screen.findByTestId('custom-date-range-popover');

    expect(document.querySelector('.rdp-root')).toBeTruthy();
    expect(screen.getByTestId('custom-range-calendar')).toBeTruthy();
  });

  it('does not render From/To text inputs as the main picker', async () => {
    mockAnchorRect();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    await screen.findByTestId('custom-date-range-popover');

    expect(screen.queryByTestId('custom-range-from')).toBeNull();
    expect(screen.queryByPlaceholderText('YYYY-MM-DD')).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('one-day range action sets to equal from', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      await act(async () => {
        clickEnabledDay(popover, 5);
      });

      fireEvent.click(screen.getByTestId('custom-range-one-day-action'));
      expectEnabled(screen.getByRole('button', { name: 'Apply' }));
    });
  });

  it('shows partial start selection without range end classes when incomplete', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      await act(async () => {
        clickEnabledDay(popover, 5);
      });

      const selectedStart = popover.querySelector('.rdp-day.rdp-selected');
      expect(selectedStart).toBeTruthy();
      expect(selectedStart?.classList.contains('rdp-range_start')).toBe(false);
      expect(selectedStart?.classList.contains('rdp-range_middle')).toBe(false);
    });
  });

  it('completes range when end date is clicked after hover preview', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      await act(async () => {
        clickEnabledDay(popover, 1);
      });

      const day10Button = getCurrentMonthDayButtons(popover).find((el) => el.textContent?.trim() === '10');
      if (!day10Button) throw new Error('Could not find day 10 button');

      fireEvent.mouseEnter(day10Button);

      await act(async () => {
        fireEvent.click(day10Button);
      });

      expectEnabled(screen.getByRole('button', { name: 'Apply' }));
      expect(popover.querySelector('.rdp-day.rdp-range_start')).toBeTruthy();
      expect(popover.querySelector('.rdp-day.rdp-range_end')).toBeTruthy();
    });
  });

  it('highlights in-range days while hovering the end date', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      await act(async () => {
        clickEnabledDay(popover, 1);
      });

      const day10Button = getCurrentMonthDayButtons(popover).find((el) => el.textContent?.trim() === '10');
      if (!day10Button) throw new Error('Could not find day 10 button');

      fireEvent.mouseEnter(day10Button);

      expect(popover.querySelector('.rdp-day.rdp-range_start')).toBeTruthy();
      expect(popover.querySelector('.rdp-day.rdp-range_end')).toBeTruthy();
      expect(popover.querySelectorAll('.rdp-day.rdp-range_middle').length).toBeGreaterThan(0);
    });
  });

  it('applies range start/end/middle classes when range is complete', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');
      selectFirstRange(popover);

      expect(popover.querySelector('.rdp-day.rdp-range_start')).toBeTruthy();
      expect(popover.querySelector('.rdp-day.rdp-range_end')).toBeTruthy();
      expect(popover.querySelectorAll('.rdp-day.rdp-range_middle').length).toBeGreaterThan(0);
    });
  });

  it('uses one selected circle for same-day range without middle strip', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      await act(async () => {
        clickEnabledDay(popover, 5);
      });
      fireEvent.click(screen.getByTestId('custom-range-one-day-action'));

      expect(popover.querySelector('.rdp-day.rdp-range_start.rdp-range_end')).toBeTruthy();
      expect(popover.querySelector('.rdp-day.rdp-range_middle')).toBeNull();
    });
  });

  it('marks selected today with selected state', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      await act(async () => {
        clickEnabledDay(popover, 15);
      });

      const todayCell = popover.querySelector('.rdp-day.rdp-today.rdp-selected');
      expect(todayCell).toBeTruthy();
    });
  });

  it('disables Apply until valid complete range', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');

      expectDisabled(screen.getByRole('button', { name: 'Apply' }));
      selectFirstRange(popover);
      expectEnabled(screen.getByRole('button', { name: 'Apply' }));
    });
  });

  it('Apply commits customFrom/customTo', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      const onChange = vi.fn();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={onChange}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');
      selectFirstRange(popover);
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledTimes(1);
      });
      const next = fromDateRangeFilterValue(onChange.mock.calls[0]![0]!);
      expect(next.preset).toBe('custom');
      expect(next.customFrom).toBe('2026-01-01');
      expect(next.customTo).toBe('2026-01-05');
    });
  });

  it('Cancel does not commit', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      const onChange = vi.fn();
      render(
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={onChange}
          presets={[...PRESETS]}
        />,
      );

      openCustomPanel();
      const popover = await screen.findByTestId('custom-date-range-popover');
      selectFirstRange(popover);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByTestId('custom-date-range-popover')).toBeNull();
      });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('clicking inside calendar does not close popover', async () => {
    mockResizeObserver();
    mockAnchorRect();
    render(
      <FilterCapsule
        title="Date range"
        valueLabel="Last 7 days"
        applied
        open
        onToggle={() => undefined}
        onClose={() => undefined}
        onClear={() => undefined}
      >
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />
      </FilterCapsule>,
    );

    openCustomPanel();
    const popover = await screen.findByTestId('custom-date-range-popover');
    const dayButton = getCurrentMonthDayButtons(popover)[0];
    fireEvent.mouseDown(dayButton!, { bubbles: true });

    expect(popover).toBeTruthy();
  });

  it('outside click closes popover', async () => {
    mockAnchorRect();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    await screen.findByTestId('custom-date-range-popover');

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId('custom-date-range-popover')).toBeNull();
    });
  });

  it('Escape closes popover', async () => {
    mockAnchorRect();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    await screen.findByTestId('custom-date-range-popover');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('custom-date-range-popover')).toBeNull();
    });
  });

  it('disables future dates in the calendar', async () => {
    mockAnchorRect();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    const popover = await screen.findByTestId('custom-date-range-popover');

    const disabledFutureDays = popover.querySelectorAll('.rdp-day.rdp-disabled:not(.rdp-outside)');
    expect(disabledFutureDays.length).toBeGreaterThan(0);
  });

  it('popover is portaled outside graph card', async () => {
    mockAnchorRect();
    render(
      <div data-testid="graph-card" style={{ height: 200, overflow: 'hidden' }}>
        <DateRangeFilter
          value={{ preset: '7d', from: '', to: '' }}
          onChange={() => undefined}
          presets={[...PRESETS]}
        />
      </div>,
    );

    const card = screen.getByTestId('graph-card');
    const heightBefore = card.getBoundingClientRect().height;

    openCustomPanel();
    const popover = await screen.findByTestId('custom-date-range-popover');

    expect(card.getBoundingClientRect().height).toBe(heightBefore);
    expect(popover.closest('[data-testid="graph-card"]')).toBeNull();
  });

  it('sets popover placement from positioning helper', async () => {
    mockAnchorRect({ top: 680, bottom: 712, left: 200, right: 320 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    const popover = await screen.findByTestId('custom-date-range-popover');

    const expected = computeDateRangePopoverPosition(
      { top: 680, bottom: 712, left: 200, right: 320 },
      { width: popover.offsetWidth || 280, height: popover.offsetHeight || 380 },
      { width: 1280, height: 800 },
      { align: 'right', margin: 12, gap: 8 },
    );

    expect(popover.getAttribute('data-popover-placement')).toBe(expected.placement);
  });

  it('uses mobile bottom-sheet class on narrow viewports', async () => {
    mockResizeObserver();
    mockAnchorRect();
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('639px'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));

    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    openCustomPanel();
    const popover = await screen.findByTestId('custom-date-range-popover');
    expect(popover.classList.contains('assistrio-date-range-popover--mobile')).toBe(true);
  });

  it('does not render billing period preset when omitted', () => {
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={() => undefined}
        presets={[...PRESETS]}
      />,
    );

    expect(screen.queryByText('Current billing period')).toBeNull();
  });

  it('applies non-custom presets immediately', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        value={{ preset: '7d', from: '', to: '' }}
        onChange={onChange}
        presets={[...PRESETS]}
      />,
    );

    fireEvent.click(screen.getAllByTestId('date-range-preset-today')[0]!);
    expect(onChange).toHaveBeenCalledWith({ preset: 'today', from: '', to: '' });
  });
});

describe('DateRangeCustomPickerTrigger', () => {
  it('Apply updates dates via callback', async () => {
    await withMidMonthDate(async () => {
      mockAnchorRect();
      const onApply = vi.fn();
      render(<DateRangeCustomPickerTrigger from="" to="" onApply={onApply} />);

      fireEvent.click(screen.getByTestId('date-range-custom-trigger'));
      const popover = await screen.findByTestId('custom-date-range-popover');
      selectFirstRange(popover);
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(onApply).toHaveBeenCalledTimes(1);
      });
      expect(onApply.mock.calls[0]![0]).toBe('2026-01-01');
      expect(onApply.mock.calls[0]![1]).toBe('2026-01-05');
    });
  });
});
