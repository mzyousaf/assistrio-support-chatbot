import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ResponseStyleSection } from './ResponseStyleSection';

vi.mock('../../api/customerApi', () => ({
  refineCustomerBotResponseStyle: vi.fn(),
}));

import { refineCustomerBotResponseStyle } from '../../api/customerApi';

const baseProps = {
  botId: '507f1f77bcf86cd799439011',
  enabled: false,
  description: '',
  instructions: '',
  onEnabledChange: vi.fn(),
  onRefined: vi.fn(),
  onTurnOff: vi.fn(),
  markDirty: vi.fn(),
};

describe('ResponseStyleSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('toggle OFF shows muted hint and no free textarea', () => {
    render(<ResponseStyleSection {...baseProps} />);
    expect(screen.getByTestId('response-format-off-hint')).toBeTruthy();
    expect(screen.queryByTestId('response-style-free-textarea')).toBeNull();
    expect(screen.queryByTestId('response-format-on-panel')).toBeNull();
  });

  it('toggle ON shows structured card before refine', () => {
    render(<ResponseStyleSection {...baseProps} enabled />);
    expect(screen.getByTestId('response-format-on-panel')).toBeTruthy();
    expect(screen.getByTestId('describe-response-format-btn')).toBeTruthy();
    expect(screen.queryByTestId('response-style-free-textarea')).toBeNull();
  });

  it('refine calls API and onRefined', async () => {
    vi.mocked(refineCustomerBotResponseStyle).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        mode: 'structured',
        description: 'Title and answer',
        instructions: 'Title: <short title>\nAnswer: <answer>',
        preview: { title: 'Title + Answer', example: 'Title: X\nAnswer: Y' },
      },
    });

    render(<ResponseStyleSection {...baseProps} enabled />);
    fireEvent.click(screen.getByTestId('describe-response-format-btn'));
    fireEvent.change(screen.getByTestId('response-format-description-textarea'), {
      target: { value: 'Title and answer format' },
    });
    fireEvent.click(screen.getByTestId('submit-response-format-refine-btn'));

    await waitFor(() => {
      expect(refineCustomerBotResponseStyle).toHaveBeenCalled();
    });
    expect(baseProps.onRefined).toHaveBeenCalled();
  });

  it('shows locked read-only instructions when refined', () => {
    render(
      <ResponseStyleSection
        {...baseProps}
        enabled
        instructions="Title: <short title>\nAnswer: <answer>"
        description="Title and answer"
      />,
    );
    expect(screen.getByTestId('refined-response-format-card')).toBeTruthy();
    expect(screen.getByTestId('response-format-locked-badge')).toBeTruthy();
    expect(screen.getByTestId('response-format-locked-instructions').textContent).toContain('Title:');
    expect(screen.queryByRole('textbox', { name: /write style/i })).toBeNull();
  });

});
